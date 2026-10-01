/** Retire a server-deleted group's clean binding without discarding dirty content. */
import { usePanelStore } from '../../state/panelStore';
import { getWorksurfaceBinding, getWorksurfacePendingCapture, getWorksurfaceConflict,
  worksurfaceKey } from '../../state/slices/worksurfaceSlice';
import { tracked, releaseRequest, inFlightByView, deferredByView,
  reconnectRetryByView } from './worksurfaceRuntime';

export function retireDeletedWorksurfaceGroup(workspaceId: string, viewId: string, groupId: string): void {
  const store=usePanelStore.getState();
  const key=worksurfaceKey(workspaceId,viewId);
  const binding=getWorksurfaceBinding(store,workspaceId,viewId);
  const isBound=binding?.threadGroupId===groupId;
  const dirty=isBound && (getWorksurfacePendingCapture(store,workspaceId,viewId)
    || getWorksurfaceConflict(store,workspaceId,viewId) || inFlightByView.has(key));
  // Pending content retains the existing explicit retry / warned-discard path.
  // Clean groups have nothing left to flush after their server-owned deletion.
  if (!dirty) {
    for (const request of tracked.values()) {
      if(request.workspaceId===workspaceId && request.viewId===viewId && request.threadGroupId===groupId) {
        releaseRequest(request.requestId);
      }
    }
    if(isBound) {
      deferredByView.delete(key);
      reconnectRetryByView.delete(key);
      store.clearWorksurfaceBinding(workspaceId,viewId);
    }
  }
  store.removeWorksurfaceEntry(workspaceId,viewId,groupId);
}
