const latestMutationByView = new Map<string, number>();
const pendingMutationByView = new Map<string, number>();
let nextMutationId = 1;

export function nextViewStateMutationId(view: string): number {
  const mutationId = nextMutationId;
  nextMutationId += 1;
  latestMutationByView.set(view, mutationId);
  pendingMutationByView.set(view, mutationId);
  return mutationId;
}

export function getLatestViewStateMutationId(view: string): number {
  return latestMutationByView.get(view) ?? 0;
}

export function hasPendingViewStateMutation(view: string): boolean {
  return pendingMutationByView.has(view);
}

export function settleViewStateMutation(view: string, mutationId: number): void {
  if (pendingMutationByView.get(view) === mutationId) {
    pendingMutationByView.delete(view);
  }
}
