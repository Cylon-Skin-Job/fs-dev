import '../styles/dropdown.css';
import './ChatArea.css';
import { useMemo } from 'react';
import { usePanelStore } from '../state/panelStore';
import { ChatSurface } from './chat/ChatSurface';
import type { ChatSessionHostProjection } from './chat/useChatSessionHost';

interface ChatAreaProps {
  panel: string;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  hideCollapsedRail?: boolean;
  /** Connected chat projection for this panel's view-bound population. */
  chatHost: ChatSessionHostProjection;
}

/**
 * Production workspace chat column (owner direction 2026-09-19). It renders
 * the connected view-bound Main Chat projection for this panel's own view
 * population. Side Chat is a group member presented through the composable
 * `fusion.chat-surface` tab path, never a second ChatArea mount.
 */
export function ChatArea({
  panel,
  collapsed,
  sidebarCollapsed,
  contentCollapsed,
  hideCollapsedRail,
  chatHost,
}: ChatAreaProps) {
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const { identity, shell, header, composer, actions, refs, onToggleThreads, onToggleContent } = chatHost;
  const shellPresentation = useMemo(() => ({
    ...shell,
    isThreadsCollapsed: sidebarCollapsed ?? false,
    isContentCollapsed: contentCollapsed ?? false,
  }), [contentCollapsed, shell, sidebarCollapsed]);

  if (collapsed) {
    if (hideCollapsedRail) {
      return (
        <section
          className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed"
          data-surface-id={identity.surfaceId}
          aria-hidden="true"
        />
      );
    }

    return (
      <section
        className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed"
        data-surface-id={identity.surfaceId}
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
      {...identity}
      shell={shellPresentation}
      header={header}
      composer={composer}
      actions={actions}
      refs={refs}
      panel={panel}
      onToggleThreads={onToggleThreads}
      onToggleContent={onToggleContent}
    />
  );
}
