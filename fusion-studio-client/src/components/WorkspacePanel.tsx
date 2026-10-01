/**
 * @module WorkspacePanel
 * @role Compose one view's rail, chat, and content as sibling shell regions.
 *
 * Chat subscriptions terminate inside ViewChatShell. ContentArea therefore
 * does not re-render when a draft or live session projection changes.
 */

import { memo, type CSSProperties } from 'react';
import { clampPaneWidth, usePanelStore } from '../state/panelStore';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { ContentArea } from './ContentArea';
import { LeftSidebarResize, LeftChatResize } from './ResizeHandle';
import { useViewChatHost } from './chat/useViewChatHost';

const DEFAULT_WIDTHS = { leftSidebar: 220, leftChat: 360 };
const DEFAULT_COLLAPSED = {
  leftSidebar: false,
  leftChat: false,
  rightCol: false,
  contentArea: false,
};

interface ViewChatShellProps {
  panel: string;
  workspaceId: string;
  collapsedSidebar: boolean;
  collapsedChat: boolean;
  collapsedContent: boolean;
  isActive: boolean;
}

function ViewChatShell({
  panel,
  workspaceId,
  collapsedSidebar,
  collapsedChat,
  collapsedContent,
  isActive,
}: ViewChatShellProps) {
  const viewChat = useViewChatHost({ panel, workspaceId, viewId: panel, isActive });
  return (
    <>
      <Sidebar
        panel={panel}
        collapsed={collapsedSidebar}
        rail={viewChat.rail}
        showCliPicker={viewChat.showCliPicker}
        harnessStatuses={viewChat.harnessStatuses}
        onHarnessSelect={viewChat.handleHarnessSelect}
      />
      <LeftSidebarResize panel={panel} />
      <ChatArea
        panel={panel}
        collapsed={collapsedChat}
        sidebarCollapsed={collapsedSidebar}
        contentCollapsed={collapsedContent}
        hideCollapsedRail
        chatHost={viewChat.chatHost}
      />
      <LeftChatResize panel={panel} />
    </>
  );
}

interface WorkspacePanelContentProps extends ViewChatShellProps {}

const WorkspacePanelContent = memo(function WorkspacePanelContent({
  panel,
  workspaceId,
  collapsedSidebar,
  collapsedChat,
  collapsedContent,
  isActive,
}: WorkspacePanelContentProps) {
  return (
    <>
      <ViewChatShell
        panel={panel}
        workspaceId={workspaceId}
        collapsedSidebar={collapsedSidebar}
        collapsedChat={collapsedChat}
        collapsedContent={collapsedContent}
        isActive={isActive}
      />
      <ContentArea panel={panel} workspaceId={workspaceId} />
    </>
  );
});

export function WorkspacePanel({ panelId, isActive }: {
  panelId: string;
  isActive: boolean;
}) {
  const workspaceId = usePanelStore((state) => state.activeWorkspaceId) ?? '';
  const viewState = usePanelStore((state) => state.viewStates[panelId]);
  const widths = { ...DEFAULT_WIDTHS, ...(viewState?.widths ?? {}) };
  const collapsed = { ...DEFAULT_COLLAPSED, ...(viewState?.collapsed ?? {}) };
  const leftSidebarWidth = clampPaneWidth('leftSidebar', widths.leftSidebar);

  const gridStyle: CSSProperties = {
    '--left-sidebar-w': collapsed.leftSidebar ? '0px' : `min(${leftSidebarWidth}px, 25vw)`,
    '--left-sidebar-expanded-w': `min(${leftSidebarWidth}px, 25vw)`,
    '--left-chat-w': `${collapsed.leftChat ? 0 : Math.max(360, widths.leftChat)}px`,
    '--right-col-w': `${widths.rightCol ?? 220}px`,
    '--file-tree-w': `${collapsed.rightCol ? 0 : (widths.rightCol ?? 220)}px`,
  } as CSSProperties;
  const panelClasses = [
    'rv-panel',
    'rv-layout-dual-chat',
    isActive ? 'active' : '',
    collapsed.leftSidebar ? 'rv-panel--sidebar-collapsed' : '',
    collapsed.contentArea ? 'rv-panel--content-collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <div data-panel={panelId} className={panelClasses} style={gridStyle}>
      <WorkspacePanelContent
        panel={panelId}
        workspaceId={workspaceId}
        collapsedSidebar={collapsed.leftSidebar}
        collapsedChat={collapsed.leftChat}
        collapsedContent={collapsed.contentArea}
        isActive={isActive}
      />
    </div>
  );
}
