/**
 * @module ChatAreaHeader
 * @role Primary chat header — identity, CLI/thread dropdowns, more menu.
 *
 * Portable presentation: receives explicit state and callbacks from the mount
 * host (SPEC-02 §5.1). All DOM ids are scoped by the transient `surfaceId`
 * (§6.3) so two mounts never share header/menu identity.
 */

import type { RefObject } from 'react';
import { CliPickerDropdown } from '../CliPickerDropdown';
import { chatSurfaceDomId } from './chatSurfaceContract';
import type { HarnessStatus } from '../../types';

export interface ChatAreaHeaderProps {
  mountId: string;
  panel: string;
  headerRef: RefObject<HTMLDivElement | null>;
  hasThread: boolean;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  cliPickerOpen: boolean;
  moreMenuOpen: boolean;
  harnessStatuses: Record<string, HarnessStatus>;
  showCliPicker: boolean;
  onHarnessSelect: (harnessId: string, modelId?: string) => void;
  onCreateThread: () => void;
  handleToggleThreads: () => void;
  onToggleContent?: () => void;
  onRename: () => void;
  onCopyLink: () => void;
  onViewMarkdown: () => void;
  canMoveToSideChat: boolean;
  onMoveToSideChat: () => void;
  onSetMoreMenuOpen: (open: boolean) => void;
  onCloseCliPicker: () => void;
}

export function ChatAreaHeader({
  mountId,
  panel,
  headerRef,
  hasThread,
  sidebarCollapsed,
  contentCollapsed,
  cliPickerOpen,
  moreMenuOpen,
  harnessStatuses,
  showCliPicker,
  onHarnessSelect,
  onCreateThread,
  handleToggleThreads,
  onRename,
  onCopyLink,
  onViewMarkdown,
  canMoveToSideChat,
  onMoveToSideChat,
  onSetMoreMenuOpen,
  onCloseCliPicker,
  onToggleContent,
}: ChatAreaHeaderProps) {
  const domId = chatSurfaceDomId(mountId);
  return (
    <div className="rv-chat-header" ref={headerRef} data-chat-mount-id={mountId}>
      {sidebarCollapsed && (
        <div className="rv-chat-header-left-controls">
          <button
            className="rv-chat-header-btn rv-chat-thread-dock"
            onClick={handleToggleThreads}
            aria-label="Show threads"
            title="Show threads"
          >
            <span className="material-symbols-outlined">dock_to_right</span>
          </button>
          <button
            className="rv-chat-header-btn rv-chat-new-thread"
            onClick={onCreateThread}
            aria-haspopup={showCliPicker ? 'menu' : undefined}
            aria-expanded={showCliPicker ? cliPickerOpen : undefined}
            aria-controls={showCliPicker ? `cli-picker-${domId}` : undefined}
            aria-label="New chat"
            title="New chat"
          >
            <span className="material-symbols-outlined">edit_square</span>
          </button>
        </div>
      )}
      <div className="rv-chat-header-right">
        <button
          className="rv-chat-header-btn"
          onClick={() => onSetMoreMenuOpen(!moreMenuOpen)}
          aria-haspopup="menu"
          aria-expanded={moreMenuOpen}
          aria-controls={`chat-more-${domId}`}
          aria-label="More options"
          title="More options"
        >
          <span className="material-symbols-outlined">event_list</span>
        </button>
        {contentCollapsed && onToggleContent && (
          <button
            className="rv-chat-header-btn"
            onClick={onToggleContent}
            aria-label="Show content"
            title="Show content"
          >
            <span className="material-symbols-outlined">dock_to_right</span>
          </button>
        )}
      </div>
      {sidebarCollapsed && (
        <>
          {showCliPicker && (
            <CliPickerDropdown
              panel={panel}
              instanceKey={domId}
              open={cliPickerOpen}
              onRequestClose={onCloseCliPicker}
              statuses={harnessStatuses}
              onSelect={onHarnessSelect}
            />
          )}
        </>
      )}
      <div
        className="rv-dropdown rv-chat-more-dropdown"
        role="menu"
        id={`chat-more-${domId}`}
        data-open={moreMenuOpen}
      >
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={handleToggleThreads}
        >
          <span className="material-symbols-outlined">
            {sidebarCollapsed ? 'left_panel_open' : 'left_panel_close'}
          </span>
          <span>{sidebarCollapsed ? 'Show threads' : 'Hide threads'}</span>
        </button>
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={onRename}
          disabled={!hasThread}
        >
          <span className="material-symbols-outlined">edit</span>
          <span>Rename</span>
        </button>
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={onCopyLink}
          disabled={!hasThread}
          title={hasThread ? 'Copy link to this thread' : 'No active thread'}
        >
          <span className="material-symbols-outlined">link_2</span>
          <span>Copy Link</span>
        </button>
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={onViewMarkdown}
          disabled={!hasThread}
        >
          <span className="material-symbols-outlined">docs</span>
          <span>View Markdown</span>
        </button>
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={onMoveToSideChat}
          disabled={!canMoveToSideChat}
          title={canMoveToSideChat
            ? 'Move this chat to a Side Chat tab'
            : 'Move is available for the current Main Chat in a view'}
        >
          <span className="material-symbols-outlined">open_in_new</span>
          <span>Move Chat to Side Chat</span>
        </button>
      </div>
    </div>
  );
}
