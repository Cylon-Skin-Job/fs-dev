import '../styles/dropdown.css';
import './ChatArea.css';
import { LegacyChatHost } from './chat/LegacyChatHost';

interface ChatAreaProps {
  panel: string;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  hideCollapsedRail?: boolean;
  /** Whether this panel is the shell's active panel (global-intent ownership). */
  isActive?: boolean;
}

/**
 * Production workspace chat column. It renders the Legacy Main Chat host; the
 * retired singleton Secondary Chat (SPEC-04 §10) is no longer part of this
 * surface. Side Chat is a group member presented through the composable
 * `fusion.chat-surface` tab path, never a second ChatArea mount.
 */
export function ChatArea({
  panel,
  collapsed,
  sidebarCollapsed,
  contentCollapsed,
  hideCollapsedRail,
  isActive = true,
}: ChatAreaProps) {
  return (
    <LegacyChatHost
      panel={panel}
      collapsed={collapsed}
      sidebarCollapsed={sidebarCollapsed}
      contentCollapsed={contentCollapsed}
      hideCollapsedRail={hideCollapsedRail}
      isActive={isActive}
    />
  );
}
