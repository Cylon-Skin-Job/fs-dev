interface ViewStateMutationOrigin {
  workspaceId: string | null;
  view: string;
}

const latestMutationByWorkspaceView = new Map<string, number>();
const pendingMutationByWorkspaceView = new Map<string, number>();
const mutationOriginById = new Map<number, ViewStateMutationOrigin>();
let nextMutationId = 1;

function mutationScopeKey(workspaceId: string | null, view: string): string {
  return JSON.stringify([workspaceId, view]);
}

export function nextViewStateMutationId(view: string, workspaceId: string | null): number {
  const mutationId = nextMutationId;
  nextMutationId += 1;
  const key = mutationScopeKey(workspaceId, view);
  latestMutationByWorkspaceView.set(key, mutationId);
  pendingMutationByWorkspaceView.set(key, mutationId);
  mutationOriginById.set(mutationId, { workspaceId, view });
  return mutationId;
}

export function getViewStateMutationOrigin(mutationId: number): ViewStateMutationOrigin | null {
  return mutationOriginById.get(mutationId) ?? null;
}

export function getLatestViewStateMutationId(view: string, workspaceId: string | null): number {
  return latestMutationByWorkspaceView.get(mutationScopeKey(workspaceId, view)) ?? 0;
}

export function hasPendingViewStateMutation(view: string, workspaceId: string | null): boolean {
  return pendingMutationByWorkspaceView.has(mutationScopeKey(workspaceId, view));
}

export function settleViewStateMutation(mutationId: number): void {
  const origin = mutationOriginById.get(mutationId);
  if (!origin) return;
  const key = mutationScopeKey(origin.workspaceId, origin.view);
  if (pendingMutationByWorkspaceView.get(key) === mutationId) {
    pendingMutationByWorkspaceView.delete(key);
  }
  mutationOriginById.delete(mutationId);
}

/**
 * Drop every response record owned by a WebSocket generation that can no
 * longer acknowledge its writes. Keep the latest mutation watermark so a
 * response issued before that mutation cannot become current after reconnect.
 */
export function abandonViewStateMutations(): void {
  pendingMutationByWorkspaceView.clear();
  mutationOriginById.clear();
}
