/**
 * @module ThreadRail
 * @role Portable thread-rail presentation (SPEC-02 §5.3).
 *
 * `ThreadRail` receives one explicit population, its selected group, and
 * callbacks. It renders the rows and kebab menus and emits canonical row
 * intents to its connected outer host. It does not request a list, inspect a
 * panel, or mutate a store directly: this module imports no app store,
 * WebSocket client, controller, service, or filesystem API.
 *
 * `viewId`/`workspaceId` never appear here — the connected host owns the
 * population address. The rail is shared by the production Legacy rail and the
 * explicit view-bound `ThreadedChat` hosts.
 */

import type { CSSProperties, ReactNode } from 'react';
import '../../styles/dropdown.css';
import '../Sidebar.css';
import { formatThreadDisplayName, formatRelativeDate } from '../sidebar/threadOrderUtils';
import type { Thread } from '../../types';

export type ThreadRailView = 'active' | 'archive';

export interface ThreadRailProps {
  /** Presentation scope for DOM ids; never an identity. */
  panel: string;
  rows: Thread[];
  /** Selected visible group for this explicit population. */
  selectedThreadGroupId: string | null;
  /** Selected exact session (Legacy highlight fallback). */
  selectedThreadId: string | null;
  secondaryThreadId: string | null;
  isActive: boolean;
  collapsed?: boolean;
  cliPicker?: ReactNode;
  threadView: ThreadRailView;
  onThreadViewChange: (view: ThreadRailView) => void;
  onTogglePinned: () => void;
  onCreateThread?: () => void;
  resolveCliAccent: (harnessId?: string) => CSSProperties | undefined;
  setThreadRef: (threadId: string, el: HTMLElement | null) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  menuOpenId: string | null;
  setMenuOpenId: (threadId: string | null) => void;
  onOpenThread: (row: Thread) => void;
  onStartRename: (row: Thread) => void;
  onSubmitRename: (row: Thread) => void;
  onCancelRename: () => void;
  onDelete: (row: Thread) => void;
  onCopyLink: (row: Thread) => void;
  onViewMarkdown: (row: Thread) => void;
  /** Legacy-only side-chat intent; omitted by explicit view hosts. */
  onOpenSecondary?: (row: Thread) => void;
  sideChatDisabledReason?: (row: Thread) => string | null;
}

interface ThreadRailContentsProps extends ThreadRailProps {
  preview: boolean;
}

function rowIsSelected(props: ThreadRailProps, row: Thread): boolean {
  if (row.threadGroupId && props.selectedThreadGroupId) {
    return row.threadGroupId === props.selectedThreadGroupId;
  }
  return row.threadId === props.selectedThreadId;
}

function ThreadRailContents(props: ThreadRailProps & { preview: boolean }) {
  const {
    rows,
    secondaryThreadId,
    collapsed,
    cliPicker,
    threadView,
    onThreadViewChange,
    onTogglePinned,
    onCreateThread,
    resolveCliAccent,
    setThreadRef,
    renamingId,
    renameValue,
    setRenameValue,
    menuOpenId,
    setMenuOpenId,
    onOpenThread,
    onStartRename,
    onSubmitRename,
    onCancelRename,
    onDelete,
    onCopyLink,
    onViewMarkdown,
    onOpenSecondary,
    sideChatDisabledReason,
    preview = false,
  } = props as ThreadRailContentsProps;

  void collapsed;

  return (
    <>
      <div className={`rv-thread-sidebar-header${preview ? ' rv-thread-sidebar-header--preview' : ''}`}>
        <button
          type="button"
          className="rv-chat-header-btn rv-sidebar-peek-dock"
          onClick={onTogglePinned}
          aria-label={preview ? 'Pin threads open' : 'Hide threads'}
          title={preview ? 'Pin threads open' : 'Hide threads'}
        >
          <span className="material-symbols-outlined">dock_to_right</span>
        </button>
        <select
          className="rv-thread-view-select"
          aria-label="Thread view"
          value={threadView}
          onChange={(event) => onThreadViewChange(event.target.value as ThreadRailView)}
        >
          <option value="active">Active Threads</option>
          <option value="archive">Archive</option>
        </select>
      </div>

      {onCreateThread && (
        <button
          className="rv-new-chat-btn"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onCreateThread}
        >
          <span className="material-symbols-outlined">edit_square</span>
          <span>New chat</span>
        </button>
      )}
      {cliPicker}

      <div className="rv-thread-list-divider" role="separator" />

      <div className="rv-thread-list">
        {threadView === 'active' ? (
          rows.length === 0 ? (
            <div className="rv-chat-item">
              <span className="rv-chat-item-text">No threads yet</span>
            </div>
          ) : (
            rows.filter((t) => t && t.threadId && t.entry).map((thread) => {
              const isSecondaryRow = secondaryThreadId === thread.threadId;
              const rowClass = [
                'rv-chat-item',
                rowIsSelected(props, thread) ? 'active' : '',
                isSecondaryRow ? 'rv-chat-item--secondary-indent' : '',
              ].filter(Boolean).join(' ');

              const sideChatDisabled = sideChatDisabledReason
                ? sideChatDisabledReason(thread)
                : null;

              return (
                <div
                  key={thread.threadId}
                  ref={(el) => setThreadRef(thread.threadId, el)}
                  className={rowClass}
                  data-thread-group-id={thread.threadGroupId ?? undefined}
                  data-thread-id={thread.threadId}
                  data-selected={rowIsSelected(props, thread) ? 'true' : undefined}
                  style={resolveCliAccent(thread.entry?.harnessId)}
                  onClick={() => onOpenThread(thread)}
                >
                  {renamingId === thread.threadId ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSubmitRename(thread);
                        if (e.key === 'Escape') onCancelRename();
                      }}
                      onBlur={() => onSubmitRename(thread)}
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
                        {menuOpenId === thread.threadId && (
                          <div
                            className="rv-thread-menu-dropdown"
                            onClick={(e) => e.stopPropagation()}
                            onMouseLeave={() => setMenuOpenId(null)}
                          >
                            {onOpenSecondary && (
                              <button
                                className="rv-dropdown-item"
                                onClick={() => {
                                  if (sideChatDisabled) return;
                                  onOpenSecondary(thread);
                                  setMenuOpenId(null);
                                }}
                                disabled={!!sideChatDisabled}
                                title={sideChatDisabled ?? undefined}
                              >
                                <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                                <span>Open a side chat</span>
                              </button>
                            )}
                            <button
                              className="rv-dropdown-item"
                              onClick={() => {
                                onStartRename(thread);
                                setMenuOpenId(null);
                              }}
                            >
                              <span className="material-symbols-outlined">edit</span>
                              <span>Rename</span>
                            </button>
                            <button
                              className="rv-dropdown-item"
                              onClick={() => {
                                onCopyLink(thread);
                                setMenuOpenId(null);
                              }}
                            >
                              <span className="material-symbols-outlined">link_2</span>
                              <span>Copy Link</span>
                            </button>
                            <button
                              className="rv-dropdown-item"
                              onClick={() => {
                                onViewMarkdown(thread);
                                setMenuOpenId(null);
                              }}
                            >
                              <span className="material-symbols-outlined">docs</span>
                              <span>View Markdown</span>
                            </button>
                            <button
                              className="rv-dropdown-item"
                              onClick={() => {
                                onDelete(thread);
                                setMenuOpenId(null);
                              }}
                            >
                              <span className="material-symbols-outlined">delete</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
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
            })
          )
        ) : (
          <div className="rv-chat-item rv-thread-list-empty">
            <span className="rv-chat-item-text">No archived threads</span>
          </div>
        )}
      </div>
    </>
  );
}

export function ThreadRail(props: ThreadRailProps) {
  const { collapsed, isActive, panel } = props;

  if (collapsed) {
    return (
      <aside className="rv-sidebar rv-sidebar--collapsed">
        <div className="rv-sidebar-peek-panel" aria-label="Threads">
          <ThreadRailContents {...props} preview />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`rv-sidebar rv-sidebar--project${isActive ? ' rv-sidebar--active' : ''}`}
      data-thread-rail-panel={panel}
    >
      <ThreadRailContents {...props} preview={false} />
    </aside>
  );
}
