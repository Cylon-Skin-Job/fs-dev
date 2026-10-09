import type { FileSaveRequestV1, FileSaveResponseV1, SaveReason } from '../../types/file-explorer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PRE_ACCEPTANCE_ERRORS = {
  path_not_allowed: 'The requested path is not allowed.',
  unsupported_text: 'Only supported UTF-8 text can be saved.',
  too_large: 'The file exceeds the 10 MiB limit.',
  save_busy: 'Too many saves are queued for this file.',
  storage_unavailable: 'Save storage is temporarily unavailable.',
} as const;
const ACCEPTED_FAILURE_ERRORS = {
  snapshot_failed: 'The existing file could not be captured safely.',
  unsupported_preimage: 'The existing file is not supported UTF-8 text.',
  preimage_too_large: 'The existing file exceeds the 10 MiB limit.',
  preimage_conflict: 'The file changed before it could be replaced.',
  write_prepare_failed: 'The replacement could not be prepared.',
  replace_failed: 'The file could not be replaced.',
  permission_denied: 'Permission was denied while saving the file.',
} as const;

export interface WorkspaceBinding {
  workspaceId: string;
  workspaceEpoch: string;
}

export interface PendingFileSaveV1 extends WorkspaceBinding {
  mode: 'v1';
  requestId: string;
  panel: string;
  path: string;
}

function scalarStringWithin(value: unknown, maxBytes: number): value is string {
  if (typeof value !== 'string' || value.length === 0 || new TextEncoder().encode(value).byteLength > maxBytes) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function validPair(value: Record<string, unknown>): boolean {
  return scalarStringWithin(value.workspaceId, 128)
    && typeof value.workspaceEpoch === 'string'
    && UUID_PATTERN.test(value.workspaceEpoch);
}

function normalizedPath(value: unknown): value is string {
  if (!scalarStringWithin(value, 4096) || value.includes('\0') || value.includes('\\')) return false;
  if (value.startsWith('/') || value.endsWith('/') || value.includes('//')) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function validIngress(value: Record<string, unknown>): boolean {
  return scalarStringWithin(value.panel, 128) && normalizedPath(value.path);
}

const RESPONSE_BASE_KEYS = ['type', 'version', 'success', 'outcome'];
const ACCEPTED_ID_KEYS = [
  'requestId', 'workspaceId', 'workspaceEpoch', 'panel', 'path', 'operationId', 'commandId',
  'commandAcceptedEventId', 'resourceEventId', 'resourceId', 'fileVersionId', 'canonicalPath',
  'commandFactState', 'resourceFactState', 'ledgerState',
];

function validAcceptedIdentity(value: Record<string, unknown>): boolean {
  return scalarStringWithin(value.requestId, 128)
    && validPair(value)
    && validIngress(value)
    && ['operationId', 'commandId', 'commandAcceptedEventId', 'resourceEventId', 'resourceId', 'fileVersionId']
      .every((key) => typeof value[key] === 'string' && UUID_PATTERN.test(value[key] as string))
    && normalizedPath(value.canonicalPath)
    && (value.commandFactState === 'admitted' || value.commandFactState === 'pending');
}

/** Runtime guard matching the locked server response union before store mutation. */
export function isFileSaveResponseV1(value: unknown): value is FileSaveResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (item.type !== 'file_save_response' || item.version !== 1 || typeof item.success !== 'boolean') return false;

  if (item.outcome === 'rejected') {
    if (item.success !== false || item.retrySafe !== true) return false;
    if (item.errorCode === 'invalid_request' && item.workspaceId === undefined) {
      return exactKeys(item, [...RESPONSE_BASE_KEYS, 'errorCode', 'error', 'retrySafe'], ['requestId'])
        && item.error === 'The save request is invalid.'
        && (item.requestId === undefined || scalarStringWithin(item.requestId, 128));
    }
    if (item.errorCode === 'workspace_unavailable') {
      return exactKeys(item, [...RESPONSE_BASE_KEYS, 'errorCode', 'requestId', 'error', 'retrySafe'])
        && scalarStringWithin(item.requestId, 128)
        && item.error === 'The workspace is not available.';
    }
    if (item.errorCode === 'invalid_request' || item.errorCode === 'stale_workspace') {
      return exactKeys(item, [
        ...RESPONSE_BASE_KEYS, 'errorCode', 'requestId', 'workspaceId', 'workspaceEpoch', 'error', 'retrySafe',
      ]) && scalarStringWithin(item.requestId, 128) && validPair(item)
        && item.error === (item.errorCode === 'invalid_request'
          ? 'The save request is invalid.'
          : 'The workspace changed before this save was accepted.');
    }
    if (Object.prototype.hasOwnProperty.call(PRE_ACCEPTANCE_ERRORS, String(item.errorCode))) {
      const code = item.errorCode as keyof typeof PRE_ACCEPTANCE_ERRORS;
      return exactKeys(item, [
        ...RESPONSE_BASE_KEYS, 'errorCode', 'requestId', 'workspaceId', 'workspaceEpoch',
        'panel', 'path', 'error', 'retrySafe',
      ]) && scalarStringWithin(item.requestId, 128) && validPair(item) && validIngress(item)
        && item.error === PRE_ACCEPTANCE_ERRORS[code];
    }
    return false;
  }

  if (item.outcome === 'failed_before_replace') {
    if (item.success !== false || item.retrySafe !== true || !validAcceptedIdentity(item)) return false;
    if (!Object.prototype.hasOwnProperty.call(ACCEPTED_FAILURE_ERRORS, String(item.errorCode))) return false;
    const code = item.errorCode as keyof typeof ACCEPTED_FAILURE_ERRORS;
    return exactKeys(item, [
      ...RESPONSE_BASE_KEYS, ...ACCEPTED_ID_KEYS, 'errorCode', 'error', 'retrySafe',
    ]) && item.resourceFactState === 'not_emitted' && item.ledgerState === 'not_applicable'
      && item.error === ACCEPTED_FAILURE_ERRORS[code];
  }

  if (item.outcome === 'outcome_unknown') {
    return item.success === false && validAcceptedIdentity(item)
      && exactKeys(item, [
        ...RESPONSE_BASE_KEYS, ...ACCEPTED_ID_KEYS, 'errorCode', 'error', 'retrySafe',
      ])
      && item.errorCode === 'mutation_outcome_unknown'
      && item.error === 'The save outcome is uncertain and requires reconciliation.'
      && item.retrySafe === false && item.resourceFactState === 'not_emitted'
      && item.ledgerState === 'not_applicable';
  }

  if (item.outcome !== 'succeeded' || item.success !== true || !validAcceptedIdentity(item)) return false;
  if (!exactKeys(item, [
    ...RESPONSE_BASE_KEYS, ...ACCEPTED_ID_KEYS, 'provenanceState', 'checkpointState',
  ], ['warningCodes'])) return false;
  if (!['admitted', 'pending'].includes(String(item.resourceFactState))) return false;
  if (!['stored', 'pending', 'conflict'].includes(String(item.ledgerState))) return false;
  const complete = item.commandFactState === 'admitted'
    && item.resourceFactState === 'admitted'
    && item.ledgerState === 'stored';
  if (item.provenanceState !== (complete ? 'complete' : 'pending_reconciliation')) return false;
  if (!['not_requested', 'committed', 'no_change', 'failed'].includes(String(item.checkpointState))) return false;
  const expectedWarnings = [
    ...(item.checkpointState === 'failed' ? ['checkpoint_failed'] : []),
    ...(!complete ? ['provenance_pending'] : []),
  ];
  return expectedWarnings.length === 0
    ? item.warningCodes === undefined
    : Array.isArray(item.warningCodes)
      && item.warningCodes.length === expectedWarnings.length
      && item.warningCodes.every((code, index) => code === expectedWarnings[index]);
}

export function createFileSaveRequestV1(input: WorkspaceBinding & {
  panel: string;
  path: string;
  content: string;
  reason?: SaveReason;
  milestone?: string;
  clientActionId?: string;
  reportedUiContext?: FileSaveRequestV1['reportedUiContext'];
}): FileSaveRequestV1 {
  if (input.reason === 'milestone' && input.milestone === undefined) {
    throw new TypeError('milestone reason requires milestone');
  }
  if (input.reason !== 'milestone' && input.milestone !== undefined) {
    throw new TypeError('milestone is only allowed for milestone reason');
  }
  return {
    type: 'file_save',
    version: 1,
    requestId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    workspaceEpoch: input.workspaceEpoch,
    panel: input.panel,
    path: input.path,
    content: input.content,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.milestone !== undefined ? { milestone: input.milestone } : {}),
    ...(input.clientActionId !== undefined ? { clientActionId: input.clientActionId } : {}),
    ...(input.reportedUiContext !== undefined ? { reportedUiContext: input.reportedUiContext } : {}),
  } as FileSaveRequestV1;
}

/**
 * Responses carrying a workspace pair must match both the original request and
 * the client's current atomic binding. Pair-less envelope/binding failures are
 * safe only while the request id is still pending; a bind clears that pending
 * set before an A -> B -> A cycle can make a delayed response look current.
 */
export function responseMatchesPendingFileSave(
  pending: PendingFileSaveV1 | undefined,
  response: FileSaveResponseV1,
  current: WorkspaceBinding | null,
): boolean {
  if (!pending || !response.requestId || pending.requestId !== response.requestId) return false;
  const workspaceId = 'workspaceId' in response ? response.workspaceId : undefined;
  const workspaceEpoch = 'workspaceEpoch' in response ? response.workspaceEpoch : undefined;
  const hasWorkspaceId = workspaceId !== undefined;
  const hasWorkspaceEpoch = workspaceEpoch !== undefined;
  if (hasWorkspaceId !== hasWorkspaceEpoch) return false;
  if (!hasWorkspaceId) return true;
  return Boolean(
    current
    && workspaceId === pending.workspaceId
    && workspaceEpoch === pending.workspaceEpoch
    && current.workspaceId === pending.workspaceId
    && current.workspaceEpoch === pending.workspaceEpoch
  );
}
