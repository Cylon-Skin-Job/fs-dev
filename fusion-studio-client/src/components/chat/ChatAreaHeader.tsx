/**
 * @module ChatAreaHeader
 * @role Primary chat header — identity, CLI/thread dropdowns, more menu.
 */

import { CliPickerDropdown } from '../CliPickerDropdown';
import type { useChatArea } from './useChatArea';

type ChatAreaHeaderProps = Pick<
  ReturnType<typeof useChatArea>,
  | 'panel'
  | 'chatHeaderRef'
  | 'currentThreadId'
  | 'cliPickerOpen'
  | 'moreMenuOpen'
  | 'setMoreMenuOpen'
  | 'harnessStatuses'
  | 'showCliPicker'
  | 'handleHarnessSelect'
  | 'handleCreateThread'
  | 'handleToggleThreads'
  | 'handleRename'
  | 'handleCopyLink'
  | 'handleViewMarkdown'
>;

export function ChatAreaHeader({
  panel,
  chatHeaderRef,
  currentThreadId,
  sidebarCollapsed,
  cliPickerOpen,
  moreMenuOpen,
  setMoreMenuOpen,
  harnessStatuses,
  showCliPicker,
  handleHarnessSelect,
  handleCreateThread,
  handleToggleThreads,
  handleRename,
  handleCopyLink,
  handleViewMarkdown,
  contentCollapsed,
  handleToggleContent,
}: ChatAreaHeaderProps & {
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  handleToggleContent?: () => void;
}) {
  return (
    <div className="rv-chat-header" ref={chatHeaderRef}>
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
            onClick={handleCreateThread}
            aria-haspopup={showCliPicker ? 'menu' : undefined}
            aria-expanded={showCliPicker ? cliPickerOpen : undefined}
            aria-controls={showCliPicker ? `cli-picker-${panel}` : undefined}
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
          onClick={() => setMoreMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={moreMenuOpen}
          aria-controls={`chat-more-${panel}`}
          aria-label="More options"
          title="More options"
        >
          <span className="material-symbols-outlined">event_list</span>
        </button>
        {contentCollapsed && handleToggleContent && (
          <button
            className="rv-chat-header-btn"
            onClick={handleToggleContent}
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
              statuses={harnessStatuses}
              onSelect={handleHarnessSelect}
            />
          )}
        </>
      )}
      <div
        className="rv-dropdown rv-chat-more-dropdown"
        role="menu"
        id={`chat-more-${panel}`}
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
          onClick={handleRename}
          disabled={!currentThreadId}
        >
          <span className="material-symbols-outlined">edit</span>
          <span>Rename</span>
        </button>
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={handleCopyLink}
          disabled={!currentThreadId}
          title={currentThreadId ? 'Copy link to this thread' : 'No active thread'}
        >
          <span className="material-symbols-outlined">link_2</span>
          <span>Copy Link</span>
        </button>
        <button
          className="rv-dropdown-item"
          role="menuitem"
          onClick={handleViewMarkdown}
          disabled={!currentThreadId}
        >
          <span className="material-symbols-outlined">docs</span>
          <span>View Markdown</span>
        </button>
      </div>
    </div>
  );
}
