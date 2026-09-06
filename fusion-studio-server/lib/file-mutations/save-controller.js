'use strict';

const fs = require('fs');
const { UUID_PATTERN } = require('./validation-patterns');
const { createAtomicWriter, AtomicWriteError } = require('./atomic-writer');
const { createCheckpointAdapter } = require('./checkpoint-adapter');
const { createFactReplay } = require('./fact-replay');
const { createPathAuthority, fingerprint, PathAuthorityError } = require('./path-authority');
const { createSaveMutex, SaveBusyError } = require('./save-mutex');
const { encodeIntendedText, TextValidationError, validatePreimageBytes } = require('./text-codec');
const {
  assertNonemptyBoundedString,
  fingerprintsEqual,
  normalizeCanonicalPath,
} = require('./provenance-values');
const { intentFromInput, originFromInput, requestBindingHash } = require('./fact-reservation-bindings');
const { MAX_SNAPSHOT_BYTES } = require('./file-version-repository');
const { FileReadLimitError, readFileHandleBounded } = require('./bounded-file-read');

const FIXED_ERRORS = Object.freeze({
  invalid_request: 'The save request is invalid.',
  stale_workspace: 'The workspace changed before this save was accepted.',
  workspace_unavailable: 'The workspace is not available.',
  path_not_allowed: 'The requested path is not allowed.',
  unsupported_text: 'Only supported UTF-8 text can be saved.',
  too_large: 'The file exceeds the 10 MiB limit.',
  save_busy: 'Too many saves are queued for this file.',
  storage_unavailable: 'Save storage is temporarily unavailable.',
  snapshot_failed: 'The existing file could not be captured safely.',
  unsupported_preimage: 'The existing file is not supported UTF-8 text.',
  preimage_too_large: 'The existing file exceeds the 10 MiB limit.',
  preimage_conflict: 'The file changed before it could be replaced.',
  write_prepare_failed: 'The replacement could not be prepared.',
  replace_failed: 'The file could not be replaced.',
  permission_denied: 'Permission was denied while saving the file.',
  mutation_outcome_unknown: 'The save outcome is uncertain and requires reconciliation.',
});

function ids(operation) {
  return {
    operationId: operation.operationId,
    commandId: operation.commandId,
    commandAcceptedEventId: operation.commandAcceptedEventId,
    resourceEventId: operation.resourceEventId,
    resourceId: operation.resourceId,
    fileVersionId: operation.fileVersionId,
    canonicalPath: operation.canonicalPath,
  };
}

function capturedPair(session) {
  const workspaceId = session?.currentWorkspaceId;
  const workspaceEpoch = session?.workspaceEpoch;
  if (session?.workspaceBindingState === 'binding' || session?.binding === true) return null;
  if (typeof workspaceId !== 'string' || typeof workspaceEpoch !== 'string') return null;
  return { workspaceId, workspaceEpoch };
}

function createFileSaveController({
  operations,
  reservations,
  publishers,
  pathAuthority = createPathAuthority(),
  mutex = createSaveMutex(),
  atomicWriter = createAtomicWriter(),
  checkpoint = createCheckpointAdapter(),
  fsPromises = fs.promises,
  clock = Date.now,
  captureWorkspacePair = capturedPair,
  writeDiagnostic = () => {},
  publishResourceRefreshRequired = async () => {},
  terminalResponseCacheLimit = 1024,
} = {}) {
  if (!operations || !reservations) throw new TypeError('file-save repositories are required');
  if (typeof publishResourceRefreshRequired !== 'function') {
    throw new TypeError('resource recovery publisher is required');
  }
  if (!Number.isSafeInteger(terminalResponseCacheLimit) || terminalResponseCacheLimit < 1) {
    throw new TypeError('terminal response cache limit must be positive');
  }
  const replay = createFactReplay({
    operations,
    reservations,
    publishers,
    publishResourceRefreshRequired,
    clock,
    writeDiagnostic,
  });
  const terminalResponsesByRequest = new Map();
  const terminalRequestByOperation = new Map();

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  async function recover(operation, reason) {
    try {
      await publishResourceRefreshRequired(Object.freeze({
        type: 'resource:refresh_required',
        version: 1,
        workspaceId: operation.workspaceId,
        panel: 'file-viewer',
        path: operation.canonicalPath,
        operationId: operation.operationId,
        reason,
      }));
    } catch (_error) {
      diagnose('resource_refresh_required_failed');
    }
  }

  function rejected(errorCode, extra = {}) {
    return Object.freeze({
      type: 'file_save_response',
      version: 1,
      success: false,
      outcome: 'rejected',
      errorCode,
      error: FIXED_ERRORS[errorCode],
      retrySafe: true,
      ...extra,
    });
  }

  function acceptedBase(operation, pair) {
    return {
      type: 'file_save_response',
      version: 1,
      requestId: operation.requestId,
      workspaceId: pair.workspaceId,
      workspaceEpoch: pair.workspaceEpoch,
      panel: operation.ingress.panel,
      path: operation.ingress.path,
      ...ids(operation),
    };
  }

  async function readPreimage(target) {
    if (!target.exists) return { kind: 'absent' };
    let handle;
    try {
      const noFollow = fs.constants.O_NOFOLLOW;
      if (!Number.isInteger(noFollow)) throw Object.assign(new Error('no-follow open is unavailable'), { code: 'ENOTSUP' });
      handle = await fsPromises.open(target.targetPath, fs.constants.O_RDONLY | noFollow);
      const stat = await handle.stat();
      if (stat.size > MAX_SNAPSHOT_BYTES) {
        throw new TextValidationError(FIXED_ERRORS.preimage_too_large, 'preimage_too_large');
      }
      if (!stat.isFile() || !fingerprintsEqual(target.fingerprint, fingerprint(stat))) {
        throw Object.assign(new Error('preimage identity changed'), { code: 'ESTALE' });
      }
      const bytes = await readFileHandleBounded(handle);
      await handle.close();
      handle = null;
      return { kind: 'bytes', bytes: validatePreimageBytes(bytes).bytes };
    } catch (error) {
      try { await handle?.close(); } catch (_closeError) {}
      if (error instanceof TextValidationError) throw error;
      if (error instanceof FileReadLimitError) {
        throw new TextValidationError(FIXED_ERRORS.preimage_too_large, 'preimage_too_large');
      }
      const code = ['EACCES', 'EPERM'].includes(error?.code) ? 'permission_denied' : 'snapshot_failed';
      throw new TextValidationError(FIXED_ERRORS[code], code);
    }
  }

  async function markAcceptedFailure(operation, code) {
    try {
      return await operations.markFailed({
        operationId: operation.operationId,
        failureCode: code,
        completedAt: clock(),
      });
    } catch (_error) {
      diagnose('file_operation_terminal_state_pending');
      try {
        return await operations.getById(operation.operationId) || operation;
      } catch (_refreshError) {
        return operation;
      }
    }
  }

  async function failBeforeWriterInvocation(operation, acceptedFailureCode) {
    let current = operation;
    try {
      current = await operations.getById(operation.operationId) || operation;
    } catch (_error) {}
    if (current.state === 'prepared') {
      try {
        return Object.freeze({
          operation: await operations.markPreparedBeforeReplaceFailed({
            operationId: current.operationId,
            completedAt: clock(),
          }),
          code: 'write_prepare_failed',
        });
      } catch (_error) {
        diagnose('file_operation_terminal_state_pending');
        try { current = await operations.getById(current.operationId) || current; } catch (_refreshError) {}
        return Object.freeze({ operation: current, code: 'write_prepare_failed' });
      }
    }
    return Object.freeze({
      operation: await markAcceptedFailure(current, acceptedFailureCode),
      code: acceptedFailureCode,
    });
  }

  async function cleanupTerminal(operation, target) {
    try {
      await atomicWriter.cleanup({ target, operationId: operation.operationId });
      return await operations.markTempCleanupComplete(operation.operationId, clock());
    } catch (_error) {
      diagnose('file_operation_temp_cleanup_pending');
      return operation;
    }
  }

  function cacheTerminalResponse(operationId, requestCacheKey, response) {
    const previousKey = terminalRequestByOperation.get(operationId);
    if (previousKey) terminalResponsesByRequest.delete(previousKey);
    terminalResponsesByRequest.delete(requestCacheKey);
    terminalResponsesByRequest.set(requestCacheKey, Object.freeze({ operationId, response }));
    terminalRequestByOperation.set(operationId, requestCacheKey);
    while (terminalResponsesByRequest.size > terminalResponseCacheLimit) {
      const oldestKey = terminalResponsesByRequest.keys().next().value;
      const oldest = terminalResponsesByRequest.get(oldestKey);
      terminalResponsesByRequest.delete(oldestKey);
      if (oldest) terminalRequestByOperation.delete(oldest.operationId);
    }
  }

  async function persistTerminalResponse(operation, response, requestCacheKey) {
    cacheTerminalResponse(operation.operationId, requestCacheKey, response);
    let recoveryStored = false;
    try {
      await operations.storeResponseSnapshot(operation.operationId, response, clock());
      recoveryStored = true;
    } catch (_error) {
      diagnose('file_operation_response_snapshot_pending');
    }
    let responseStored = false;
    for (let attempt = 0; attempt < 3 && !responseStored; attempt += 1) {
      try {
        await operations.storeTerminalResponse(operation.operationId, response, clock());
        responseStored = true;
      } catch (_error) {}
    }
    if (!responseStored && !recoveryStored) diagnose('file_operation_terminal_response_pending');
    else if (!responseStored) diagnose('file_operation_terminal_response_reconstructed');
    return response;
  }

  function buildSuccessResponse(operation, pair, checkpointState) {
    const provenanceComplete = operation.commandFactAdmissionState === 'admitted'
      && operation.factAdmissionState === 'admitted'
      && operation.ledgerProjectionState === 'stored';
    const warningCodes = [];
    if (checkpointState === 'failed') warningCodes.push('checkpoint_failed');
    if (!provenanceComplete) warningCodes.push('provenance_pending');
    return Object.freeze({
      success: true,
      outcome: 'succeeded',
      ...acceptedBase(operation, pair),
      commandFactState: operation.commandFactAdmissionState,
      resourceFactState: operation.factAdmissionState,
      ledgerState: operation.ledgerProjectionState,
      provenanceState: provenanceComplete ? 'complete' : 'pending_reconciliation',
      checkpointState,
      ...(warningCodes.length ? { warningCodes: Object.freeze(warningCodes) } : {}),
    });
  }

  function outcomeUnknownResponse(operation, pair) {
    return Object.freeze({
      success: false, outcome: 'outcome_unknown', errorCode: 'mutation_outcome_unknown',
      error: FIXED_ERRORS.mutation_outcome_unknown, retrySafe: false,
      ...acceptedBase(operation, pair), commandFactState: operation.commandFactAdmissionState,
      resourceFactState: 'not_emitted', ledgerState: 'not_applicable',
    });
  }

  async function finishSuccess(operation, pair, target) {
    let current = operation;
    try {
      current = await replay.publishResource(current);
    } catch (_error) {
      diagnose('resource_fact_admission_pending');
    }
    let checkpointState = 'failed';
    try {
      checkpointState = await checkpoint.afterSave({
        contentRoot: target.panelReal,
        relativePath: current.ingress.path,
        saveReason: current.intent.saveReason,
        milestone: current.intent.milestone,
      });
    } catch (_error) {
      diagnose('file_checkpoint_failed');
    }
    return buildSuccessResponse(current, pair, checkpointState);
  }

  function failedBeforeReplace(operation, pair, code) {
    return Object.freeze({
      success: false, outcome: 'failed_before_replace', errorCode: code,
      error: FIXED_ERRORS[code], retrySafe: true, ...acceptedBase(operation, pair),
      commandFactState: operation.commandFactAdmissionState,
      resourceFactState: 'not_emitted', ledgerState: 'not_applicable',
    });
  }

  async function replayAcceptedResult(operation, pair, requestCacheKey) {
    const cachedKey = terminalRequestByOperation.get(operation.operationId);
    const cached = cachedKey ? terminalResponsesByRequest.get(cachedKey) : null;
    if (cached) return cached.response;
    if (operation.terminalResponse) {
      cacheTerminalResponse(operation.operationId, requestCacheKey, operation.terminalResponse);
      return operation.terminalResponse;
    }
    const snapshot = operation.responseSnapshot;
    const responsePair = snapshot ? Object.freeze({
      workspaceId: snapshot.workspaceId,
      workspaceEpoch: snapshot.workspaceEpoch,
    }) : pair;
    const responseOperation = snapshot ? Object.freeze({
      ...operation,
      commandFactAdmissionState: snapshot.commandFactState,
      factAdmissionState: snapshot.resourceFactState === 'not_emitted'
        ? operation.factAdmissionState
        : snapshot.resourceFactState,
      ledgerProjectionState: snapshot.ledgerState === 'not_applicable'
        ? operation.ledgerProjectionState
        : snapshot.ledgerState,
    }) : operation;
    let response;
    if (operation.state === 'succeeded') {
      // Missing response persistence is ambiguous with respect to checkpoint
      // completion. Never repeat that side effect.
      response = buildSuccessResponse(responseOperation, responsePair, snapshot?.checkpointState || 'failed');
    } else if (operation.state === 'outcome_unknown'
      || (operation.state === 'prepared' && operation.attemptedAt != null)) {
      response = outcomeUnknownResponse(responseOperation, responsePair);
    } else {
      response = failedBeforeReplace(
        responseOperation,
        responsePair,
        operation.state === 'failed' && FIXED_ERRORS[operation.failureCode]
          ? operation.failureCode
          : 'write_prepare_failed',
      );
    }
    return persistTerminalResponse(operation, response, requestCacheKey);
  }

  async function markDurableSuccess(operation, fingerprintValue) {
    const successInput = Object.freeze({
      operationId: operation.operationId,
      occurredAt: clock(),
      completedAt: clock(),
      fingerprint: fingerprintValue,
    });
    let current = operation;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operations.markSucceeded(successInput);
      } catch (_error) {
        diagnose('file_operation_success_persistence_pending');
        try {
          current = await operations.getById(operation.operationId) || current;
          if (current.state === 'succeeded') return current;
          if (current.state !== 'prepared') break;
        } catch (_refreshError) {}
      }
    }
    return Object.freeze({ ...current, state: 'succeeded' });
  }

  async function save({ session, intent, capturedWorkspacePair }) {
    let requestId;
    try {
      requestId = assertNonemptyBoundedString(intent?.requestId, 128, 'requestId');
      assertNonemptyBoundedString(intent?.expectedWorkspaceId, 128, 'expectedWorkspaceId');
      if (!UUID_PATTERN.test(intent?.expectedWorkspaceEpoch || '')) throw new TypeError('invalid epoch');
    } catch (_error) {
      return rejected('invalid_request', typeof requestId === 'string' ? { requestId } : {});
    }

    let pair;
    if (capturedWorkspacePair !== undefined) {
      if (
        !capturedWorkspacePair
        || typeof capturedWorkspacePair !== 'object'
        || Array.isArray(capturedWorkspacePair)
        || typeof capturedWorkspacePair.workspaceId !== 'string'
        || capturedWorkspacePair.workspaceId.length === 0
        || Buffer.byteLength(capturedWorkspacePair.workspaceId, 'utf8') > 128
        || !UUID_PATTERN.test(capturedWorkspacePair.workspaceEpoch || '')
      ) throw new TypeError('captured workspace pair is invalid');
      pair = Object.freeze({
        workspaceId: capturedWorkspacePair.workspaceId,
        workspaceEpoch: capturedWorkspacePair.workspaceEpoch,
      });
    } else {
      pair = captureWorkspacePair(session);
    }
    if (!pair) return rejected('workspace_unavailable', { requestId });
    if (
      intent.expectedWorkspaceId !== pair.workspaceId
      || intent.expectedWorkspaceEpoch !== pair.workspaceEpoch
    ) return rejected('stale_workspace', { requestId, ...pair });

    let panel;
    let ingressPath;
    let intended;
    let origin;
    let validatedIntent;
    try {
      panel = assertNonemptyBoundedString(intent.panel, 128, 'panel');
      ingressPath = normalizeCanonicalPath(intent.path, 'path');
      intended = encodeIntendedText(intent.content);
      origin = originFromInput({
        kind: 'local_client',
        connectionId: session.connectionId,
        assurance: 'transport_only',
        reportedUiContext: intent.reportedUiContext,
      });
      validatedIntent = intentFromInput(intent);
    } catch (error) {
      const code = error instanceof TextValidationError ? error.code : 'invalid_request';
      return rejected(code, {
        requestId,
        ...pair,
        ...(error instanceof TextValidationError && panel && ingressPath ? { panel, path: ingressPath } : {}),
      });
    }

    const stableRequestHash = requestBindingHash({
      workspaceId: pair.workspaceId,
      requestId,
      ingressPanel: panel,
      ingressPath,
      origin,
      intent: validatedIntent,
      intendedAfterSha256: intended.sha256,
      intendedAfterByteLength: intended.byteLength,
    });
    const requestCacheKey = `${pair.workspaceId}\u0000${origin.connectionId}\u0000${requestId}\u0000${stableRequestHash}`;
    const cachedRequest = terminalResponsesByRequest.get(requestCacheKey);
    if (cachedRequest) return cachedRequest.response;

    let firstTarget;
    try {
      firstTarget = await pathAuthority.resolve({ workspaceId: pair.workspaceId, panel, ingressPath });
    } catch (_error) {
      return rejected('path_not_allowed', { requestId, ...pair, panel, path: ingressPath });
    }
    const mutexKey = `${pair.workspaceId}\u0000${firstTarget.lockPath}`;

    try {
      return await mutex.runExclusive(mutexKey, async () => {
        const queuedReplay = terminalResponsesByRequest.get(requestCacheKey);
        if (queuedReplay) return queuedReplay.response;
        let target;
        try {
          target = await pathAuthority.resolve({ workspaceId: pair.workspaceId, panel, ingressPath });
          if (target.lockPath !== firstTarget.lockPath) throw new PathAuthorityError('Alias changed.');
        } catch (_error) {
          return rejected('path_not_allowed', { requestId, ...pair, panel, path: ingressPath });
        }

        let operation;
        try {
          operation = await operations.reserve({
            workspaceId: pair.workspaceId,
            requestId,
            canonicalPath: target.canonicalPath,
            ingressPanel: panel,
            ingressPath,
            currentFingerprint: target.fingerprint,
            origin,
            saveReason: intent.saveReason,
            milestone: intent.milestone,
            clientActionId: intent.clientActionId,
            acceptedAt: clock(),
            intendedAfterSha256: intended.sha256,
            intendedAfterByteLength: intended.byteLength,
          });
        } catch (_error) {
          return rejected('storage_unavailable', { requestId, ...pair, panel, path: ingressPath });
        }

        if (operation.idempotentReplay) return replayAcceptedResult(operation, pair, requestCacheKey);

        operation = await replay.publishCommand(operation);
        let preimage;
        try {
          preimage = await readPreimage(target);
          operation = await operations.prepare({
            operationId: operation.operationId,
            preimage,
            intendedAfterSha256: intended.sha256,
            intendedAfterByteLength: intended.byteLength,
            preparedAt: clock(),
          });
        } catch (error) {
          const code = error instanceof TextValidationError ? error.code : 'snapshot_failed';
          const failure = await failBeforeWriterInvocation(operation, code);
          operation = failure.operation;
          if (operation.state === 'failed') operation = await cleanupTerminal(operation, target);
          const response = failedBeforeReplace(operation, pair, failure.code);
          return persistTerminalResponse(operation, response, requestCacheKey);
        }

        let writeResult;
        try {
          operation = await operations.markAttempted(operation.operationId, clock());
        } catch (_error) {
          const failure = await failBeforeWriterInvocation(operation, 'write_prepare_failed');
          operation = failure.operation;
          if (operation.state === 'failed') operation = await cleanupTerminal(operation, target);
          const response = failedBeforeReplace(operation, pair, failure.code);
          return persistTerminalResponse(operation, response, requestCacheKey);
        }
        try {
          writeResult = await atomicWriter.replace({
            target,
            operationId: operation.operationId,
            bytes: intended.bytes,
            mutationKind: operation.mutationKind,
            preimageSha256: operation.preimageSha256,
          });
        } catch (error) {
          const atomic = error instanceof AtomicWriteError
            ? error
            : new AtomicWriteError('Atomic replacement failed.', { code: 'write_prepare_failed' });
          if (atomic.renamed) {
            try {
              operation = await operations.markOutcomeUnknown({
                operationId: operation.operationId,
                completedAt: clock(), observedTargetState: 'unreadable',
              });
            } catch (_stateError) { diagnose('file_operation_terminal_state_pending'); }
            if (operation.state === 'outcome_unknown') operation = await cleanupTerminal(operation, target);
            await recover(operation, 'mutation_outcome_unknown');
            const response = outcomeUnknownResponse(operation, pair);
            return persistTerminalResponse(operation, response, requestCacheKey);
          }
          operation = await markAcceptedFailure(operation, atomic.code);
          if (operation.state === 'failed') {
            operation = await cleanupTerminal(operation, target);
          }
          const response = failedBeforeReplace(operation, pair, atomic.code);
          return persistTerminalResponse(operation, response, requestCacheKey);
        }

        try {
          operation = await markDurableSuccess(operation, writeResult.fingerprint);
          if (operation.completedAt == null) throw new Error('success remains pending persistence');
          operation = await cleanupTerminal(operation, target);
        } catch (_error) {
          diagnose('file_operation_success_persistence_pending');
          operation = Object.freeze({ ...operation, state: 'succeeded' });
        }
        const response = await finishSuccess(operation, pair, target);
        return persistTerminalResponse(operation, response, requestCacheKey);
      });
    } catch (error) {
      if (error instanceof SaveBusyError) {
        return rejected('save_busy', { requestId, ...pair, panel, path: ingressPath });
      }
      return rejected('storage_unavailable', { requestId, ...pair, panel, path: ingressPath });
    }
  }

  return Object.freeze({ save });
}

module.exports = { FIXED_ERRORS, createFileSaveController };
