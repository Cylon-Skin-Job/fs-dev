/**
 * @module ChatSessionHost
 * @role Connected explicit-session host for view-bound Main and Side Chat mounts.
 */

import { usePanelStore } from '../../state/panelStore';
import { ChatSurface } from './ChatSurface';
import { useChatSessionHost } from './useChatSessionHost';
import type { ChatSurfaceHostKind } from './chatSurfaceContract';

export interface ChatSessionHostProps {
  panel: string;
  workspaceId: string;
  viewId: string;
  threadGroupId: string | null;
  threadId: string | null;
  host: ChatSurfaceHostKind;
  threadName?: string;
  expectedPrimarySequence?: number | null;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  hideCollapsedRail?: boolean;
  isActive?: boolean;
  surfaceId?: string;
}

export function ChatSessionHost({
  panel,
  workspaceId,
  viewId,
  threadGroupId,
  threadId,
  host,
  threadName,
  expectedPrimarySequence,
  collapsed,
  sidebarCollapsed,
  contentCollapsed,
  hideCollapsedRail,
  isActive = true,
  surfaceId,
}: ChatSessionHostProps) {
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const projection = useChatSessionHost({
    panel,
    workspaceId,
    viewId,
    threadGroupId,
    threadId,
    host,
    threadName,
    expectedPrimarySequence,
    sidebarCollapsed,
    contentCollapsed,
    isActive,
    surfaceId,
  });

  if (collapsed) {
    if (hideCollapsedRail) {
      return (
        <section
          className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed"
          data-surface-id={projection.identity.surfaceId}
          aria-hidden="true"
        />
      );
    }
    return (
      <section
        className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed"
        data-surface-id={projection.identity.surfaceId}
      >
        <button
          className="rv-collapse-rail-btn"
          onClick={() => toggleCollapsed(panel, 'leftChat')}
          title="Expand chat"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </section>
    );
  }

  return (
    <ChatSurface
      {...projection.identity}
      shell={projection.shell}
      header={projection.header}
      composer={projection.composer}
      actions={projection.actions}
      refs={projection.refs}
      panel={panel}
      onToggleThreads={projection.onToggleThreads}
      onToggleContent={projection.onToggleContent}
    />
  );
}
