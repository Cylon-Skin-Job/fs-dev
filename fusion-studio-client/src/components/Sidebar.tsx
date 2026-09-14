import { useState } from 'react';
import '../styles/dropdown.css';
import './Sidebar.css';
import { CliPickerDropdown } from './CliPickerDropdown';
import { ThreadRail } from './chat/ThreadRail';
import { useSidebar } from './sidebar/useSidebar';
import { usePanelStore } from '../state/panelStore';

interface SidebarProps {
  panel: string;
  collapsed?: boolean;
  /** Whether this panel is the shell's active panel (list-request ownership). */
  isActive?: boolean;
}

/**
 * Connected Legacy rail host (SPEC-02 §5.2/§5.3). Reads the explicit
 * `{activeWorkspaceId, viewId: null}` population through `useSidebar` and
 * projects it into the portable `ThreadRail`; it owns every store/WebSocket
 * action and passes none of them into the rail.
 */
export function Sidebar({ panel, collapsed, isActive = true }: SidebarProps) {
  const sidebar = useSidebar({ panel, isActive });
  const toggleCollapsed = usePanelStore((state) => state.toggleCollapsed);
  const [threadView, setThreadView] = useState<'active' | 'archive'>('active');

  return (
    <ThreadRail
      panel={panel}
      collapsed={collapsed}
      rows={sidebar.threads}
      selectedThreadGroupId={sidebar.selectedThreadGroupId}
      selectedThreadId={sidebar.currentThreadId}
      secondaryThreadId={sidebar.secondary?.threadId ?? null}
      isActive={sidebar.isActive}
      threadView={threadView}
      onThreadViewChange={setThreadView}
      onTogglePinned={() => toggleCollapsed(panel, 'leftSidebar')}
      onCreateThread={sidebar.handleCreateThread}
      cliPicker={sidebar.showCliPicker ? (
        <CliPickerDropdown
          panel={panel}
          statuses={sidebar.harnessStatuses}
          onSelect={sidebar.handleHarnessSelect}
        />
      ) : null}
      resolveCliAccent={sidebar.resolveCliAccent}
      setThreadRef={sidebar.setThreadRef}
      renamingId={sidebar.renamingId}
      renameValue={sidebar.renameValue}
      setRenameValue={sidebar.setRenameValue}
      menuOpenId={sidebar.menuOpenId}
      setMenuOpenId={sidebar.setMenuOpenId}
      onOpenThread={sidebar.handleOpenThread}
      onStartRename={sidebar.handleRenameStart}
      onSubmitRename={sidebar.handleRenameSubmit}
      onCancelRename={sidebar.handleRenameCancel}
      onDelete={sidebar.handleDeleteThread}
      onCopyLink={sidebar.handleCopyLink}
      onViewMarkdown={sidebar.handleViewMarkdown}
      onOpenSecondary={sidebar.handleOpenSecondary}
      sideChatDisabledReason={sidebar.sideChatDisabledReason}
    />
  );
}
