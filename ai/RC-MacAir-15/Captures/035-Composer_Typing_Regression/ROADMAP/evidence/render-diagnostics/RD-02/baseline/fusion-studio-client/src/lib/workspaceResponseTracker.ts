export type WorkspaceRequestFamily = 'state:get' | 'file:move' | 'file:rename' | 'file:delete';

interface WorkspaceRequestOrigin {
  family: WorkspaceRequestFamily;
  workspaceId: string | null;
  view?: string;
  mutationWatermark?: number;
  hadPendingMutation?: boolean;
}

const pendingRequests = new Map<string, WorkspaceRequestOrigin>();
let sequence = 0;

export function nextWorkspaceRequestId(
  family: WorkspaceRequestFamily,
  workspaceId: string | null,
  stateLoad?: Pick<WorkspaceRequestOrigin, 'view' | 'mutationWatermark' | 'hadPendingMutation'>,
): string {
  const requestId = `workspace-request-${Date.now().toString(36)}-${(sequence++).toString(36)}`;
  pendingRequests.set(requestId, { family, workspaceId, ...stateLoad });
  return requestId;
}

/**
 * Settle one correlated response and decide whether it still belongs to the
 * live workspace. Missing correlation remains accepted for compatibility
 * with older/current-workspace server frames.
 */
export function shouldApplyWorkspaceResponse(
  family: WorkspaceRequestFamily,
  requestId: string | undefined,
  responseWorkspaceId: string | null | undefined,
  activeWorkspaceId: string | null,
  stateLoad?: { view: string; mutationWatermark: number },
): boolean {
  if (!requestId) {
    return responseWorkspaceId === undefined || responseWorkspaceId === activeWorkspaceId;
  }
  const origin = pendingRequests.get(requestId);
  pendingRequests.delete(requestId);
  if (!origin) return false;
  const sameOrigin = origin.family === family
    && origin.workspaceId === activeWorkspaceId
    && (responseWorkspaceId === undefined || origin.workspaceId === responseWorkspaceId);
  if (!sameOrigin) return false;
  if (family !== 'state:get' || !origin.view || !stateLoad) return true;
  return !origin.hadPendingMutation
    && origin.view === stateLoad.view
    && origin.mutationWatermark === stateLoad.mutationWatermark;
}

/** Drop request IDs whose originating WebSocket can no longer answer them. */
export function abandonWorkspaceRequests(): void {
  pendingRequests.clear();
}
