/**
 * @module LegacyChatHost
 * @role Connected Legacy Main Chat host (SPEC-02 §5.2).
 *
 * Validates the workspace/thread/group relationship from accepted SPEC-01
 * projections, reads session state by explicit `threadId`, mints its own
 * transient `surfaceId` at mount, and renders the portable `ChatSurface`.
 * This is the production workspace chat composition (`viewId: null`,
 * `host: 'legacy-main'`).
 */

import { usePanelStore } from '../../state/panelStore';
import { ChatSurface } from './ChatSurface';
import { useLegacyChatHost } from './useLegacyChatHost';
import type { ChatSurfaceHostKind } from './chatSurfaceContract';

export interface LegacyChatHostProps {
  panel: string;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  hideCollapsedRail?: boolean;
  /**
   * Explicit session target for non-production/explicit mounts. Omitted by
   * the production Legacy host, which resolves the workspace current thread.
   */
  threadId?: string | null;
  host?: ChatSurfaceHostKind;
  /** Whether this host's panel is the shell's active panel. */
  isActive?: boolean;
}

export function LegacyChatHost({
  panel,
  collapsed,
  sidebarCollapsed,
  contentCollapsed,
  hideCollapsedRail,
  threadId,
  host = 'legacy-main',
  isActive = true,
}: LegacyChatHostProps) {
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const projection = useLegacyChatHost({
    panel,
    threadId,
    host,
    sidebarCollapsed,
    contentCollapsed,
    isActive,
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
      chat={projection.chat}
      actions={projection.actions}
      refs={projection.refs}
      panel={panel}
      onToggleThreads={projection.onToggleThreads}
      onToggleContent={projection.onToggleContent}
    />
  );
}
