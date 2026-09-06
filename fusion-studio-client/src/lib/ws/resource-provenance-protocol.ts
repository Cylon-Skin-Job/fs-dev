import { usePanelStore } from '../../state/panelStore';
import { useWorkspaceStore } from '../../state/workspaceStore';
import type {
  ResourceProvenanceItemV1,
  ResourceProvenanceQueryV1,
  ResourceProvenanceResponseV1,
} from '../../types/file-explorer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface PendingQuery {
  workspaceId: string;
  workspaceEpoch: string;
  resolve: (items: ResourceProvenanceItemV1[]) => void;
  reject: (error: Error) => void;
}

const pending = new Map<string, PendingQuery>();

function validId(value: unknown, maxBytes = 128): value is string {
  return typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).byteLength <= maxBytes;
}

function validPair(value: Record<string, unknown>): boolean {
  return validId(value.workspaceId) && typeof value.workspaceEpoch === 'string'
    && UUID_PATTERN.test(value.workspaceEpoch);
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function validPath(value: unknown): value is string {
  return validId(value, 4096) && !value.includes('\\') && !value.includes('\0')
    && !value.startsWith('/') && !value.endsWith('/')
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function validTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validItem(value: unknown): value is ResourceProvenanceItemV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!exactKeys(item, [
    'eventId', 'eventType', 'occurredAt', 'acceptedAt', 'operationId', 'commandId',
    'commandAcceptedEventId', 'resourceId', 'fileVersionId', 'mutationKind', 'canonicalPath',
    'ingress', 'origin', 'snapshot',
  ])) return false;
  if (item.eventType !== 'resource.mutated' || !validTimestamp(item.occurredAt)
    || !validTimestamp(item.acceptedAt) || !validPath(item.canonicalPath)
    || !['create', 'modify'].includes(String(item.mutationKind))) return false;
  if (!['eventId', 'operationId', 'commandId', 'commandAcceptedEventId', 'resourceId', 'fileVersionId']
    .every((key) => typeof item[key] === 'string' && UUID_PATTERN.test(item[key] as string))) return false;
  if (!item.ingress || typeof item.ingress !== 'object' || Array.isArray(item.ingress)) return false;
  const ingress = item.ingress as Record<string, unknown>;
  if (!exactKeys(ingress, ['panel', 'path']) || !validId(ingress.panel) || !validPath(ingress.path)) return false;
  if (!item.origin || typeof item.origin !== 'object' || Array.isArray(item.origin)) return false;
  const origin = item.origin as Record<string, unknown>;
  if (!exactKeys(origin, ['kind', 'assurance', 'connectionId']) || origin.kind !== 'local_client'
    || origin.assurance !== 'transport_only' || !validId(origin.connectionId)) return false;
  if (!item.snapshot || typeof item.snapshot !== 'object' || Array.isArray(item.snapshot)) return false;
  const snapshot = item.snapshot as Record<string, unknown>;
  if (snapshot.kind === 'absent') {
    return exactKeys(snapshot, ['kind', 'byteLength', 'capturedAt'])
      && snapshot.byteLength === 0 && validTimestamp(snapshot.capturedAt);
  }
  return snapshot.kind === 'bytes'
    && exactKeys(snapshot, ['kind', 'sha256', 'byteLength', 'capturedAt'])
    && typeof snapshot.sha256 === 'string' && /^[0-9a-f]{64}$/u.test(snapshot.sha256)
    && Number.isSafeInteger(snapshot.byteLength) && Number(snapshot.byteLength) >= 0
    && Number(snapshot.byteLength) <= 10 * 1024 * 1024 && validTimestamp(snapshot.capturedAt);
}

function isResponse(value: unknown): value is ResourceProvenanceResponseV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (!['resource:provenance:result', 'resource:provenance:error'].includes(String(item.type))
    || item.version !== 1) return false;
  if (!validId(item.requestId)) return false;
  if (item.type === 'resource:provenance:result') {
    return exactKeys(item, ['type', 'version', 'requestId', 'workspaceId', 'workspaceEpoch', 'items'])
      && validPair(item) && Array.isArray(item.items) && item.items.length <= 200
      && item.items.every(validItem);
  }
  if (!['invalid_request', 'workspace_unavailable', 'query_failed', 'stale_workspace'].includes(String(item.code))) {
    return false;
  }
  const hasPair = item.workspaceId !== undefined || item.workspaceEpoch !== undefined;
  if (item.code === 'workspace_unavailable') {
    return exactKeys(item, ['type', 'version', 'code', 'requestId']);
  }
  if (item.code === 'query_failed' || item.code === 'stale_workspace') {
    return exactKeys(item, ['type', 'version', 'code', 'requestId', 'workspaceId', 'workspaceEpoch'])
      && validPair(item);
  }
  return hasPair
    ? exactKeys(item, ['type', 'version', 'code', 'requestId', 'workspaceId', 'workspaceEpoch'])
      && validPair(item)
    : exactKeys(item, ['type', 'version', 'code', 'requestId']);
}

export function retirePendingResourceProvenanceQueries(): void {
  for (const entry of pending.values()) entry.reject(new Error('The workspace changed before the query completed.'));
  pending.clear();
}

export function handleResourceProvenanceResponse(value: unknown): boolean {
  if (!isResponse(value)) return false;
  const entry = pending.get(value.requestId!);
  if (!entry) return true;
  const workspace = useWorkspaceStore.getState();
  const hasPair = 'workspaceId' in value && 'workspaceEpoch' in value;
  if (hasPair && (
    value.workspaceId !== entry.workspaceId
    || value.workspaceEpoch !== entry.workspaceEpoch
    || workspace.activeWorkspaceId !== entry.workspaceId
    || workspace.workspaceEpoch !== entry.workspaceEpoch
  )) return true;
  pending.delete(value.requestId!);
  if (value.type === 'resource:provenance:result') entry.resolve(value.items);
  else entry.reject(new Error(`Resource provenance query failed: ${value.code}`));
  return true;
}

export function queryResourceProvenance(
  selectors: Omit<ResourceProvenanceQueryV1, 'type' | 'version' | 'requestId' | 'workspaceId' | 'workspaceEpoch'>,
): Promise<ResourceProvenanceItemV1[]> {
  const workspace = useWorkspaceStore.getState();
  if (!workspace.activeWorkspaceId || !workspace.workspaceEpoch) {
    return Promise.reject(new Error('The workspace is not available.'));
  }
  if (workspace.resourceProvenanceProtocolVersion !== 1) {
    return Promise.reject(new Error('Resource provenance queries are not supported by this server.'));
  }
  const request: ResourceProvenanceQueryV1 = {
    type: 'resource:provenance:query',
    version: 1,
    requestId: crypto.randomUUID(),
    workspaceId: workspace.activeWorkspaceId,
    workspaceEpoch: workspace.workspaceEpoch,
    ...selectors,
  };
  return new Promise((resolve, reject) => {
    pending.set(request.requestId, {
      workspaceId: request.workspaceId,
      workspaceEpoch: request.workspaceEpoch,
      resolve,
      reject,
    });
    const ws = usePanelStore.getState().ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pending.delete(request.requestId);
      reject(new Error('The query connection is unavailable.'));
      return;
    }
    ws.send(JSON.stringify(request));
  });
}
