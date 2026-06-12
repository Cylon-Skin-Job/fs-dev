/**
 * @module ChatAreaHeader
 * @role Primary chat header — identity, CLI/thread dropdowns, more menu.
 */

import { CliPickerDropdown } from '../CliPickerDropdown';
import { ThreadJumpDropdown } from '../ThreadJumpDropdown';
import type { useChatArea } from './useChatArea';

type ChatAreaHeaderProps = Pick<
  ReturnType<typeof useChatArea>,
  | 'panel'
  | 'chatHeaderRef'
  | 'currentThreadId'
  | 'currentThread'
  | 'identity'
  | 'resolveCliAccent'
  | 'cliPickerOpen'
  | 'threadDropdownOpen'
  | 'moreMenuOpen'
  | 'setMoreMenuOpen'
  | 'toggleThreadDropdown'
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
  currentThread,
  identity,
  resolveCliAccent,
  sidebarCollapsed,
  cliPickerOpen,
  threadDropdownOpen,
  moreMenuOpen,
  setMoreMenuOpen,
  toggleThreadDropdown,
  harnessStatuses,
  showCliPicker,
  handleHarnessSelect,
  handleCreateThread,
  handleToggleThreads,
  handleRename,
  handleCopyLink,
  handleViewMarkdown,
}: ChatAreaHeaderProps & { sidebarCollapsed?: boolean }) {
  return (
    <div className="rv-chat-header" ref={chatHeaderRef}>
      {currentThreadId && (
        <div
          className="rv-chat-header-identity"
          style={resolveCliAccent(currentThread?.entry?.harnessId)}
        >
          <span className="material-symbols-outlined">{identity.icon}</span>
          <span className="rv-chat-header-identity-name">{identity.name}</span>
        </div>
      )}
      <div className="rv-chat-header-right">
        {sidebarCollapsed && (
          <>
            <button
              className="rv-chat-header-btn"
              onClick={handleCreateThread}
              aria-haspopup={showCliPicker ? 'menu' : undefined}
              aria-expanded={showCliPicker ? cliPickerOpen : undefined}
              aria-controls={showCliPicker ? `cli-picker-${panel}` : undefined}
              aria-label="New chat"
              title="New chat"
            >
              <span className="material-symbols-outlined">playlist_add</span>
            </button>
            <button
              className="rv-chat-header-btn"
              onClick={() => toggleThreadDropdown(panel)}
              aria-haspopup="menu"
              aria-expanded={threadDropdownOpen}
              aria-controls={`thread-dropdown-${panel}`}
              aria-label="Show thread list"
              title="Show thread list"
            >
              <span className="material-symbols-outlined">subject</span>
            </button>
          </>
        )}
        <button
          className="rv-chat-header-btn"
          onClick={() => setMoreMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={moreMenuOpen}
          aria-controls={`chat-more-${panel}`}
          aria-label="More options"
          title="More options"
        >
          <span className="material-symbols-outlined">more_vert</span>
        </button>
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
          <ThreadJumpDropdown panel={panel} />
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
