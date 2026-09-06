import type {
  ResourceChangedMessageV1,
  ResourceChangedMessageV2,
  ResourceRefreshRequiredV1,
} from '../../types/file-explorer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const encoder = new TextEncoder();

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function bounded(value: unknown, maxBytes: number): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\u0000')
    || encoder.encode(value).length > maxBytes) return false;
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

function normalizedPath(value: unknown): value is string {
  if (!bounded(value, 4096) || value.startsWith('/') || value.endsWith('/') || value.includes('\\')) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function validBase(value: Record<string, unknown>): boolean {
  return value.version === 1
    && bounded(value.workspaceId, 128)
    && typeof value.workspaceEpoch === 'string' && UUID_PATTERN.test(value.workspaceEpoch)
    && value.panel === 'file-viewer'
    && normalizedPath(value.path)
    && typeof value.operationId === 'string' && UUID_PATTERN.test(value.operationId);
}

function validObservedBase(value: Record<string, unknown>): boolean {
  return value.version === 2
    && bounded(value.workspaceId, 128)
    && typeof value.workspaceEpoch === 'string' && UUID_PATTERN.test(value.workspaceEpoch)
    && value.panel === 'file-viewer'
    && normalizedPath(value.path)
    && Number.isSafeInteger(value.occurredAt) && (value.occurredAt as number) >= 0;
}

export function isResourceChangedMessageV1(value: unknown): value is ResourceChangedMessageV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, [
    'type', 'version', 'eventId', 'operationId', 'workspaceId', 'resourceId', 'resourceKind',
    'operation', 'panel', 'path', 'occurredAt', 'workspaceEpoch',
  ])
    && item.type === 'resource:changed'
    && validBase(item)
    && typeof item.eventId === 'string' && UUID_PATTERN.test(item.eventId)
    && typeof item.resourceId === 'string' && UUID_PATTERN.test(item.resourceId)
    && item.resourceKind === 'file'
    && (item.operation === 'create' || item.operation === 'modify')
    && Number.isSafeInteger(item.occurredAt) && (item.occurredAt as number) >= 0;
}

export function isResourceChangedMessageV2(value: unknown): value is ResourceChangedMessageV2 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const required = [
    'type', 'version', 'projectionId', 'sourceActivityId', 'sourceEdgeId',
    'workspaceId', 'resourceKind', 'changeKind', 'relation', 'panel', 'path',
    'occurredAt', 'workspaceEpoch', 'snapshotId', 'state',
  ];
  const optional = ['checkpointEventId', 'checkpointObservationId', 'resourceId'];
  const actualKeys = Object.keys(item);
  if (required.some((key) => !Object.hasOwn(item, key))
    || actualKeys.some((key) => !required.includes(key) && !optional.includes(key))) return false;
  if (item.type !== 'resource:changed'
    || !validObservedBase(item)
    || item.resourceKind !== 'file'
    || item.changeKind !== 'state_observed'
    || typeof item.projectionId !== 'string' || !UUID_PATTERN.test(item.projectionId)
    || typeof item.sourceActivityId !== 'string' || !UUID_PATTERN.test(item.sourceActivityId)
    || typeof item.sourceEdgeId !== 'string' || !UUID_PATTERN.test(item.sourceEdgeId)
    || item.projectionId !== item.sourceEdgeId
    || typeof item.snapshotId !== 'string' || !UUID_PATTERN.test(item.snapshotId)
    || !['first_observation', 'changed', 'unchanged'].includes(item.relation as string)
    || !['bytes', 'absent'].includes(item.state as string)) return false;

  const hasCheckpointEvent = Object.hasOwn(item, 'checkpointEventId');
  const hasCheckpointObservation = Object.hasOwn(item, 'checkpointObservationId');
  if (item.relation === 'unchanged') {
    if (hasCheckpointEvent || hasCheckpointObservation) return false;
  } else if (!hasCheckpointEvent || !hasCheckpointObservation
    || typeof item.checkpointEventId !== 'string' || !UUID_PATTERN.test(item.checkpointEventId)
    || typeof item.checkpointObservationId !== 'string' || !UUID_PATTERN.test(item.checkpointObservationId)) {
    return false;
  }

  const hasResource = Object.hasOwn(item, 'resourceId');
  return item.state === 'bytes'
    ? hasResource && typeof item.resourceId === 'string' && UUID_PATTERN.test(item.resourceId)
    : !hasResource;
}

export function isResourceRefreshRequiredV1(value: unknown): value is ResourceRefreshRequiredV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return exactKeys(item, [
    'type', 'version', 'workspaceId', 'panel', 'path', 'operationId', 'workspaceEpoch', 'reason',
  ])
    && item.type === 'resource:refresh_required'
    && validBase(item)
    && ['fact_publish_failed', 'projection_failed', 'projection_unavailable', 'mutation_outcome_unknown']
      .includes(item.reason as string);
}
