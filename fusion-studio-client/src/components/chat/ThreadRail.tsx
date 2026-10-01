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
 * population address. The rail is shared by the production shell rail and the
 * explicit view-bound `ThreadedChat` hosts.
 */

import type { CSSProperties, ReactNode } from 'react';
import '../../styles/dropdown.css';
import '../Sidebar.css';
import { formatThreadDisplayName, formatRelativeDate } from '../sidebar/threadOrderUtils';
import type { Thread } from '../../types';
import type { ThreadMemberProjection } from '../../types/threadGroupMember';
import { ThreadRailRowMenu } from './ThreadRailRowMenu';

export type ThreadRailView = 'active' | 'archive';

export interface ThreadRailProps {
  /** Presentation scope for DOM ids; never an identity. */
  panel: string;
  rows: Thread[];
  /** Selected visible group for this explicit population. */
  selectedThreadGroupId: string | null;
  /** Selected exact session (Legacy highlight fallback). */
  selectedThreadId: string | null;
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
  onOpenThread: (row: Thread) => void;
  onStartRename: (row: Thread) => void;
  onSubmitRename: (row: Thread) => void;
  onCancelRename: () => void;
  onDelete: (row: Thread) => void;
  onCopyLink: (row: Thread) => void;
  onViewMarkdown: (row: Thread) => void;
  /** SPEC-04 §8: ordered members for a row's group (empty when unavailable). */
  membersForGroup?: (row: Thread) => ThreadMemberProjection[];
  /** SPEC-04 §8: open/focus a non-primary member's Side Chat. */
  onOpenMember?: (row: Thread, member: ThreadMemberProjection) => void;
  /** SPEC-04 §8: copy the exact-member version-1 application link. */
  onCopyLinkMember?: (row: Thread, member: ThreadMemberProjection) => void;
  /** Fired when a row's kebab menu is opened, to request `thread:members`. */
  onRequestMembers?: (row: Thread) => void;
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
    onOpenThread,
    onStartRename,
    onSubmitRename,
    onCancelRename,
    onDelete,
    onCopyLink,
    onViewMarkdown,
    membersForGroup,
    onOpenMember,
    onCopyLinkMember,
    onRequestMembers,
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
              const rowClass = [
                'rv-chat-item',
                rowIsSelected(props, thread) ? 'active' : '',
              ].filter(Boolean).join(' ');

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
                        <ThreadRailRowMenu
                          row={thread}
                          members={membersForGroup?.(thread) ?? []}
                          onOpenMember={onOpenMember}
                          onCopyLinkMember={onCopyLinkMember}
                          onRequestMembers={onRequestMembers}
                          onStartRename={onStartRename}
                          onCopyLink={onCopyLink}
                          onViewMarkdown={onViewMarkdown}
                          onDelete={onDelete}
                        />
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
