'use strict';

function assertPublishers(publishers) {
  if (!publishers || typeof publishers !== 'object' || Array.isArray(publishers)) {
    throw new TypeError('exact file-save publishers are required');
  }
  const keys = Object.keys(publishers).sort();
  if (keys.join(',') !== 'publishFileCommandAccepted,publishResourceMutated') {
    throw new TypeError('unexpected file-save publisher set');
  }
  if (keys.some((key) => typeof publishers[key] !== 'function')) {
    throw new TypeError('file-save publishers must be functions');
  }
}

function createFactReplay({
  operations,
  reservations,
  publishers,
  publishResourceRefreshRequired = async () => {},
  clock = Date.now,
  writeDiagnostic = () => {},
}) {
  if (!operations || !reservations) throw new TypeError('fact repositories are required');
  assertPublishers(publishers);
  if (typeof publishResourceRefreshRequired !== 'function') {
    throw new TypeError('resource recovery publisher is required');
  }

  function diagnose(code) {
    try { writeDiagnostic(code); } catch (_error) {}
  }

  async function refreshOrOriginal(operation) {
    try {
      return await operations.getById(operation.operationId) || operation;
    } catch (_error) {
      return operation;
    }
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

  async function publishCommand(operation) {
    if (operation.commandFactAdmissionState === 'admitted') return operation;
    try {
      const [reservation, body] = await Promise.all([
        reservations.issue({ operationId: operation.operationId, schemaKey: 'file.command_accepted' }),
        operations.getCommandFactBody(operation.operationId),
      ]);
      const report = await publishers.publishFileCommandAccepted({ reservation, body });
      if (!report || report.admitted !== true || report.eventId !== operation.commandAcceptedEventId) {
        diagnose('file_command_admission_pending');
        return refreshOrOriginal(operation);
      }
      return operations.markCommandFactAdmitted(operation.operationId, clock());
    } catch (_error) {
      diagnose('file_command_admission_pending');
      return refreshOrOriginal(operation);
    }
  }

  async function publishResource(operation) {
    if (operation.state !== 'succeeded') return operation;
    if (operation.factAdmissionState === 'admitted' && operation.ledgerProjectionState !== 'pending') {
      return operation;
    }
    let factAdmitted = false;
    try {
      const [reservation, body] = await Promise.all([
        reservations.issue({ operationId: operation.operationId, schemaKey: 'resource.mutated' }),
        operations.getResourceFactBody(operation.operationId),
      ]);
      const report = await publishers.publishResourceMutated({ reservation, body });
      if (!report || report.admitted !== true || report.eventId !== operation.resourceEventId) {
        diagnose('resource_fact_admission_pending');
        await recover(operation, 'fact_publish_failed');
        return refreshOrOriginal(operation);
      }
      factAdmitted = true;
      if (!Array.isArray(report.deliveries) || !report.deliveries.some((delivery) => (
        delivery?.handlerKey === 'system.resource-render-projection'
        && delivery.status === 'invoked'
      ))) {
        await recover(operation, 'projection_unavailable');
      }
      let current = await operations.getById(operation.operationId);
      if (current.factAdmissionState === 'pending') {
        current = await operations.markResourceFactAdmitted(operation.operationId, clock());
      }
      if (current.ledgerProjectionState === 'pending') diagnose('resource_ledger_projection_pending');
      if (current.ledgerProjectionState === 'conflict') diagnose('resource_ledger_projection_conflict');
      return current;
    } catch (_error) {
      diagnose('resource_fact_admission_pending');
      if (!factAdmitted) await recover(operation, 'fact_publish_failed');
      return refreshOrOriginal(operation);
    }
  }

  return Object.freeze({ publishCommand, publishResource });
}

module.exports = { assertPublishers, createFactReplay };
