/**
 * @module WorksurfaceConflictBanner
 * @role Non-destructive worksurface conflict projection on the owning view
 *       surface (CHAT-03 / SPEC-03 §6.1, §6.2, §11).
 *
 * Renders only when a bound view has an unresolved conflict. The pending
 * capture stays retained and the outgoing group stays selected; the only
 * discard path is the explicitly named, warned user choice.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  getWorksurfaceBinding,
  getWorksurfaceConflict,
  hasNewerRemoteWorksurfaceState,
} from '../../state/slices/worksurfaceSlice';
import {
  discardPendingWorksurfaceConflict,
  retryPendingWorksurfaceCapture,
} from '../../lib/worksurface/worksurfaceController';

export interface WorksurfaceConflictBannerProps {
  workspaceId: string;
  viewId: string;
}

const CONFLICT_COPY: Record<string, string> = {
  revision_conflict: 'Newer content was saved elsewhere for this thread.',
  timeout: 'The server did not acknowledge the last change in time.',
  worksurface_unavailable: 'The workspace is unavailable; the change is not saved.',
  rejected: 'The server rejected the last change.',
};

export function WorksurfaceConflictBanner({
  workspaceId,
  viewId,
}: WorksurfaceConflictBannerProps) {
  const conflict = usePanelStore(
    (state) => getWorksurfaceConflict(state, workspaceId, viewId),
  );
  const binding = usePanelStore(
    (state) => getWorksurfaceBinding(state, workspaceId, viewId),
  );
  const groupId = binding?.threadGroupId ?? conflict?.threadGroupId ?? '';
  const remoteNewer = usePanelStore(
    (state) => (groupId
      ? hasNewerRemoteWorksurfaceState(state, workspaceId, viewId, groupId)
      : false),
  );

  if (!conflict) return null;

  const groupLabel = conflict.threadGroupId || 'this thread';
  const reasonCopy = CONFLICT_COPY[conflict.kind] ?? CONFLICT_COPY.rejected;
  const discardLabel = conflict.toGroupId ? 'Switch without saving' : 'Discard unsaved changes';
  const lossWarning = conflict.lossRisk
    ? (conflict.toGroupId
      ? `Switching without saving will discard the unsaved content captured for ${groupLabel}.`
      : `Discarding will discard the unsaved content captured for ${groupLabel}.`)
    : `Your retained capture already matches the saved content for ${groupLabel}; nothing would be lost.`;

  return (
    <div
      className="rv-worksurface-conflict"
      data-worksurface-conflict={viewId}
      data-conflict-kind={conflict.kind}
      data-conflict-loss={conflict.lossRisk ? 'true' : 'false'}
      role="alert"
    >
      <div className="rv-worksurface-conflict-message">
        <span className="material-symbols-outlined" aria-hidden="true">error</span>
        <span>{reasonCopy}</span>
        {remoteNewer && (
          <span className="rv-worksurface-conflict-remote">
            A newer remote revision exists; your unsaved change was kept.
          </span>
        )}
      </div>
      <div className="rv-worksurface-conflict-loss">{lossWarning}</div>
      <div className="rv-worksurface-conflict-actions">
        <button
          type="button"
          className="rv-worksurface-conflict-retry"
          onClick={() => retryPendingWorksurfaceCapture(workspaceId, viewId)}
        >
          Retry saving
        </button>
        <button
          type="button"
          className="rv-worksurface-conflict-discard"
          data-worksurface-discard={viewId}
          onClick={() => discardPendingWorksurfaceConflict(workspaceId, viewId)}
        >
          {discardLabel}
        </button>
      </div>
    </div>
  );
}
