/**
 * @module SidebarThreadList
 * @role Thread rows with rename inline, kebab menu, and FLIP refs.
 */

import { formatThreadDisplayName, formatRelativeDate } from './threadOrderUtils';
import type { useSidebar } from './useSidebar';

type SidebarThreadListProps = Pick<
  ReturnType<typeof useSidebar>,
  | 'threads'
  | 'currentThreadId'
  | 'secondary'
  | 'openSecondary'
  | 'setThreadRef'
  | 'resolveCliAccent'
  | 'renamingId'
  | 'renameValue'
  | 'setRenameValue'
  | 'menuOpenId'
  | 'setMenuOpenId'
  | 'handleOpenThread'
  | 'handleRenameStart'
  | 'handleRenameSubmit'
  | 'handleRenameCancel'
  | 'handleDeleteThread'
  | 'handleCopyLink'
  | 'handleViewMarkdown'
>;

export function SidebarThreadList(props: SidebarThreadListProps) {
  const {
    threads,
    currentThreadId,
    secondary,
    openSecondary,
    setThreadRef,
    resolveCliAccent,
    renamingId,
    renameValue,
    setRenameValue,
    menuOpenId,
    setMenuOpenId,
    handleOpenThread,
    handleRenameStart,
    handleRenameSubmit,
    handleRenameCancel,
    handleDeleteThread,
    handleCopyLink,
    handleViewMarkdown,
  } = props;

  if (!threads || threads.length === 0) {
    return (
      <div className="rv-chat-item">
        <span className="rv-chat-item-text">No threads yet</span>
      </div>
    );
  }

  return (
    <>
      {threads.filter((t) => t && t.threadId && t.entry).map((thread) => {
        const isSecondaryRow = secondary?.threadId === thread.threadId;
        const rowClass = [
          'rv-chat-item',
          currentThreadId === thread.threadId ? 'active' : '',
          isSecondaryRow ? 'rv-chat-item--secondary-indent' : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={thread.threadId}
            ref={(el) => setThreadRef(thread.threadId, el)}
            className={rowClass}
            style={resolveCliAccent(thread.entry?.harnessId)}
            onClick={() => handleOpenThread(thread.threadId)}
          >
            {renamingId === thread.threadId ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(thread.threadId);
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                onBlur={() => handleRenameSubmit(thread.threadId)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="rv-thread-rename-input"
              />
            ) : (
              <>
                <div className="rv-thread-row rv-thread-row-top">
                  <span className="rv-chat-item-text" title={formatThreadDisplayName(thread)}>
                    {formatThreadDisplayName(thread)}
                    {thread.entry?.status === 'active' && (
                      <span className="rv-thread-status-dot--active">●</span>
                    )}
                  </span>
                  <button
                    className="rv-thread-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === thread.threadId ? null : thread.threadId);
                    }}
                    aria-label="More options"
                    title="More options"
                  >
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                  {menuOpenId === thread.threadId && (() => {
                    const isPrimary = currentThreadId === thread.threadId;
                    const secondaryOpen = !!secondary;
                    const openAsSecondaryDisabled = isPrimary || secondaryOpen;
                    const openAsSecondaryTitle = isPrimary
                      ? 'Already primary'
                      : secondaryOpen
                        ? 'Close the current secondary first'
                        : undefined;
                    return (
                      <div
                        className="rv-thread-menu-dropdown"
                        onClick={(e) => e.stopPropagation()}
                        onMouseLeave={() => setMenuOpenId(null)}
                      >
                        <button
                          className="rv-dropdown-item"
                          onClick={() => {
                            if (openAsSecondaryDisabled) return;
                            openSecondary(thread.threadId);
                            setMenuOpenId(null);
                          }}
                          disabled={openAsSecondaryDisabled}
                          title={openAsSecondaryTitle}
                        >
                          <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                          <span>Open a side chat</span>
                        </button>
                        <button
                          className="rv-dropdown-item"
                          onClick={() => {
                            handleRenameStart(thread.threadId, thread.entry?.name || '');
                            setMenuOpenId(null);
                          }}
                        >
                          <span className="material-symbols-outlined">edit</span>
                          <span>Rename</span>
                        </button>
                        <button
                          className="rv-dropdown-item"
                          onClick={() => {
                            handleCopyLink(thread.threadId);
                            setMenuOpenId(null);
                          }}
                        >
                          <span className="material-symbols-outlined">link_2</span>
                          <span>Copy Link</span>
                        </button>
                        <button
                          className="rv-dropdown-item"
                          onClick={() => {
                            handleViewMarkdown(thread.threadId);
                            setMenuOpenId(null);
                          }}
                        >
                          <span className="material-symbols-outlined">docs</span>
                          <span>View Markdown</span>
                        </button>
                        <button
                          className="rv-dropdown-item"
                          onClick={() => {
                            handleDeleteThread(thread.threadId);
                            setMenuOpenId(null);
                          }}
                        >
                          <span className="material-symbols-outlined">delete</span>
                          <span>Delete</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <div className="rv-thread-row rv-thread-row-bottom">
                  <span className="rv-chat-item-meta">
                    {thread.entry?.messageCount || 0} msgs · {formatRelativeDate(thread.entry?.createdAt)}
                  </span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
