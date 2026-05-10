import { useEffect, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { threadLinkIntent } from '../lib/thread-link-intent';
import { useResolvedHarnessResolver } from '../config/harness';
import { useCliAccentResolver } from '../hooks/useCliAccentStyle';
import type { Scope, Thread } from '../types';

interface ThreadJumpDropdownProps {
  panel: string;
  scope: Scope;
}

function formatThreadName(thread: Thread): string {
  if (thread.entry?.name) return thread.entry.name;
  return thread.threadId.replace(/-\d{3}$/, '');
}

/**
 * SECONDARY_CHAT_SPEC §4: same reorder as Sidebar — secondary's thread
 * goes to position 2 (right after primary's active thread).
 */
function reorderWithSecondary(
  threads: Thread[],
  primaryId: string | null,
  secondaryId: string | null,
): Thread[] {
  if (!threads || threads.length === 0) return threads;
  if (!secondaryId) return threads;
  const secondary = threads.find((t) => t.threadId === secondaryId);
  if (!secondary) return threads;
  const remainder = threads.filter((t) => t.threadId !== secondaryId);
  const primaryIdx = remainder.findIndex((t) => t.threadId === primaryId);
  const insertAt = primaryIdx >= 0 ? primaryIdx + 1 : 0;
  const out = [...remainder];
  out.splice(insertAt, 0, secondary);
  return out;
}

export function ThreadJumpDropdown({ panel, scope }: ThreadJumpDropdownProps) {
  const open = usePanelStore((s) => !!s.threadDropdownOpen[panel]);
  const rawThreads = usePanelStore((s) => s.threads[scope]);
  const currentThreadId = usePanelStore((s) => s.currentThreadIds[scope]);
  const secondary = usePanelStore((s) => s.secondary);
  const openSecondary = usePanelStore((s) => s.openSecondary);
  const ws = usePanelStore((s) => s.ws);
  const closeThreadDropdown = usePanelStore((s) => s.closeThreadDropdown);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Close kebab on click outside the dropdown button + menu.
  useEffect(() => {
    if (!menuOpenId) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.thread-menu-dropdown') || target.closest('.thread-menu-btn')) return;
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpenId]);

  const threads = reorderWithSecondary(rawThreads, currentThreadId, secondary?.threadId ?? null);
  const resolveCliAccent = useCliAccentResolver();
  const resolveHarness = useResolvedHarnessResolver();

  const sendMessage = (msg: object) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const handleSelect = (threadId: string) => {
    if (threadId !== currentThreadId && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:open-assistant', scope, threadId }));
    }
    closeThreadDropdown(panel);
  };

  const handleCopyLink = (threadId: string) => {
    sendMessage({ type: 'thread:copyLink', scope, threadId });
  };

  const handleDelete = (threadId: string) => {
    if (confirm('Delete this conversation?')) {
      sendMessage({ type: 'thread:delete', scope, threadId });
    }
  };

  return (
    <div
      className="rv-dropdown rv-thread-dropdown"
      role="menu"
      data-open={open}
      id={`thread-dropdown-${panel}`}
      aria-label="Jump to thread"
    >
      {threads.length === 0 ? (
        <div className="rv-dropdown-empty">No threads — tap the new-chat button</div>
      ) : (
        threads.map((t) => {
          const active = t.threadId === currentThreadId;
          const isSecondaryRow = secondary?.threadId === t.threadId;
          const rowClass = [
            'rv-dropdown-item',
            isSecondaryRow ? 'chat-item--secondary-indent' : '',
          ].filter(Boolean).join(' ');

          const isPrimary = currentThreadId === t.threadId;
          const secondaryOpen = !!secondary;
          const openAsSecondaryDisabled = isPrimary || secondaryOpen;
          const openAsSecondaryTitle = isPrimary
            ? 'Already primary'
            : secondaryOpen
              ? 'Close the current secondary first'
              : undefined;

          return (
            <div
              key={t.threadId}
              role="menuitem"
              className={rowClass}
              aria-current={active ? 'true' : undefined}
              onClick={() => handleSelect(t.threadId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                ...(resolveCliAccent(t.entry?.harnessId) || {}),
              }}
            >
              <span>
                <span className="material-symbols-outlined rv-thread-row-icon">
                  {resolveHarness(t.entry?.harnessId)?.materialIcon ?? 'help'}
                </span>
                {formatThreadName(t)}
              </span>
              <button
                className="thread-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === t.threadId ? null : t.threadId);
                }}
                title="More options"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                ⋮
              </button>
              {menuOpenId === t.threadId && (
                <div
                  className="thread-menu-dropdown"
                  onClick={(e) => e.stopPropagation()}
                  onMouseLeave={() => setMenuOpenId(null)}
                >
                  <button
                    className="rv-dropdown-item"
                    onClick={() => {
                      if (openAsSecondaryDisabled) return;
                      openSecondary(t.threadId);
                      setMenuOpenId(null);
                      closeThreadDropdown(panel);
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
                      handleCopyLink(t.threadId);
                      setMenuOpenId(null);
                    }}
                  >
                    <span className="material-symbols-outlined">link_2</span>
                    <span>Copy Link</span>
                  </button>
                  <button
                    className="rv-dropdown-item"
                    onClick={() => {
                      threadLinkIntent.set('view');
                      sendMessage({ type: 'thread:copyLink', scope, threadId: t.threadId });
                      setMenuOpenId(null);
                    }}
                  >
                    <span className="material-symbols-outlined">docs</span>
                    <span>View Markdown</span>
                  </button>
                  <button
                    className="rv-dropdown-item"
                    onClick={() => {
                      handleDelete(t.threadId);
                      setMenuOpenId(null);
                    }}
                  >
                    <span className="material-symbols-outlined">delete</span>
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default ThreadJumpDropdown;
