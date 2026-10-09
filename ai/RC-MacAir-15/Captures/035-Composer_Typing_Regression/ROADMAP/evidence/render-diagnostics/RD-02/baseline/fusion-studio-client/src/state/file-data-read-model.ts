import type {
  FileContentResponseV1,
  FileTreeResponseV1,
  ResourceChangedMessage,
} from '../types/file-explorer';

export interface FileRequestCorrelation {
  requestId: string;
  workspaceId: string | null;
  workspaceEpoch: string | null;
  localGeneration: number;
}

export interface FileTreeRequestRepresentation {
  includeHiddenFolders?: boolean;
}

export interface FileTreeRequestCorrelation
  extends FileRequestCorrelation, FileTreeRequestRepresentation {}

export interface FileResponseCorrelation extends FileRequestCorrelation {
  success: boolean;
  error?: string;
}

export type ProjectionResult = 'applied' | 'duplicate' | 'conflict' | 'stale';

interface CorrelationState {
  generation: number;
  workspaceId: string | null;
  workspaceEpoch: string | null;
}

let nextFileRequestId = 0;

export function cacheKey(panel: string, path: string): string {
  return `${panel}:${path}`;
}

export function parentFolder(filePath: string): string {
  return filePath.split('/').filter(Boolean).slice(0, -1).join('/');
}

export function createRequestCorrelation(state: CorrelationState): FileRequestCorrelation {
  nextFileRequestId += 1;
  return {
    requestId: `file-${state.generation}-${nextFileRequestId}`,
    workspaceId: state.workspaceId,
    workspaceEpoch: state.workspaceEpoch,
    localGeneration: state.generation,
  };
}

export function correlationsMatch(
  pending: FileRequestCorrelation | undefined,
  response: FileResponseCorrelation,
  state: CorrelationState,
): boolean {
  return Boolean(
    pending
    && pending.requestId === response.requestId
    && pending.workspaceId === response.workspaceId
    && pending.workspaceEpoch === response.workspaceEpoch
    && pending.localGeneration === response.localGeneration
    && response.workspaceId === state.workspaceId
    && response.workspaceEpoch === state.workspaceEpoch
    && response.localGeneration === state.generation
  );
}

export function findPendingByRequestId<T extends FileRequestCorrelation>(
  pending: Map<string, T>,
  requestId: string,
): [string, T] | null {
  for (const entry of pending) {
    if (entry[1].requestId === requestId) return entry;
  }
  return null;
}

export function responsePair(response: FileTreeResponseV1 | FileContentResponseV1): {
  workspaceId: string;
  workspaceEpoch: string;
} | null {
  return 'workspaceId' in response && 'workspaceEpoch' in response
    ? { workspaceId: response.workspaceId, workspaceEpoch: response.workspaceEpoch }
    : null;
}

export function trimDedupe(values: Map<string, string>, maxKeys: number): void {
  while (values.size > maxKeys) {
    const oldest = values.keys().next().value as string | undefined;
    if (oldest === undefined) return;
    values.delete(oldest);
  }
}

export function resourceProjectionFingerprint(message: ResourceChangedMessage): string {
  if (message.version === 1) {
    return JSON.stringify([
      message.type,
      message.version,
      message.eventId,
      message.operationId,
      message.workspaceId,
      message.resourceId,
      message.resourceKind,
      message.operation,
      message.panel,
      message.path,
      message.occurredAt,
      message.workspaceEpoch,
    ]);
  }
  return JSON.stringify([
    message.type,
    message.version,
    message.projectionId,
    message.sourceActivityId,
    message.sourceEdgeId,
    message.workspaceId,
    message.resourceKind,
    message.changeKind,
    message.relation,
    message.panel,
    message.path,
    message.occurredAt,
    message.workspaceEpoch,
    message.snapshotId,
    message.state,
    message.state === 'bytes' ? message.resourceId : null,
    message.relation === 'unchanged' ? null : message.checkpointEventId,
    message.relation === 'unchanged' ? null : message.checkpointObservationId,
  ]);
}
