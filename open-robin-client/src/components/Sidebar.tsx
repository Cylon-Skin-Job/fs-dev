import { useEffect, useState, useCallback, useRef } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useFileStore } from '../state/fileStore';
import { useHarnessStatuses } from '../hooks/useHarnessStatuses';
import { threadLinkIntent } from '../lib/thread-link-intent';
import { showToast } from '../lib/toast';
import { CliPickerDropdown } from './CliPickerDropdown';
import { useResolvedHarnessResolver } from '../config/harness';
import { useCliAccentResolver } from '../hooks/useCliAccentStyle';
import type { Thread, Scope } from '../types';

// SPEC-24e: display name fallback. When a thread has no name (null),
// render the thread ID with milliseconds stripped.
// Format: 2026-04-09T14-30-22-123  →  2026-04-09T14-30-22
function formatThreadDisplayName(thread: Thread): string {
  if (thread.entry?.name) return thread.entry.name;
  return thread.threadId.replace(/-\d{3}$/, '');
}

/**
 * SECONDARY_CHAT_SPEC §4: when a secondary chat is open, move the secondary's
 * thread to position 2 (right after the primary's active thread). This runs
 * both in the sidebar and the thread-jump dropdown, so the visual ordering
 * is consistent everywhere.
 */
function reorderWithSecondary<T extends { threadId: string }>(
  threads: T[],
  primaryId: string | null,
  secondaryId: string | null,
): T[] {
  if (!threads || threads.length === 0) return threads;
  if (!secondaryId) return threads;
  const secondary = threads.find((t) => t.threadId === secondaryId);
  if (!secondary) return threads;
  const remainder = threads.filter((t) => t.threadId !== secondaryId);
  const primaryIdx = remainder.findIndex((t) => t.threadId === primaryId);
  // Insert secondary right after primary; if primary not present, put it at head.
  const insertAt = primaryIdx >= 0 ? primaryIdx + 1 : 0;
  const out = [...remainder];
  out.splice(insertAt, 0, secondary);
  return out;
}

// FLIP animation for thread reordering.
// A previous version gated on `isAnimating` and would skip the next reorder
// if a prior animation's 400ms cleanup hadn't fired yet. That stranded
// inline styles (background / transform / box-shadow) on DOM elements that
// then overrode the class-based `.chat-item.active` highlight whenever the
// user rapidly opened-then-closed a secondary chat. Now: on every reorder
// we synchronously cancel any pending cleanup and scrub inline styles off
// every known row before capturing new positions.
function useThreadAnimation(threads: { threadId: string }[]) {
  const threadRefs = useRef<Map<string, HTMLElement>>(new Map());
  const prevOrder = useRef<string[]>([]);
  const cleanupTimerRef = useRef<number | null>(null);

  const setThreadRef = useCallback((threadId: string, el: HTMLElement | null) => {
    if (el) {
      threadRefs.current.set(threadId, el);
    } else {
      threadRefs.current.delete(threadId);
    }
  }, []);

  const scrubInlineStyles = useCallback(() => {
    threadRefs.current.forEach((el) => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.zIndex = '';
      el.style.boxShadow = '';
      el.style.background = '';
    });
  }, []);

  useEffect(() => {
    const currentOrder = threads.map((t) => t.threadId);
    const prev = prevOrder.current;

    // First render, or no change, just update the baseline.
    if (prev.length === 0 || JSON.stringify(prev) === JSON.stringify(currentOrder)) {
      prevOrder.current = currentOrder;
      return;
    }

    // Cancel any pending cleanup from a prior animation and flush inline
    // styles so this reorder starts from a clean slate.
    if (cleanupTimerRef.current != null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
      scrubInlineStyles();
    }

    // Capture initial positions (First)
    const positions = new Map<string, { top: number; left: number }>();
    threadRefs.current.forEach((el, threadId) => {
      const rect = el.getBoundingClientRect();
      positions.set(threadId, { top: rect.top, left: rect.left });
    });

    prevOrder.current = currentOrder;

    requestAnimationFrame(() => {
      const animations: { el: HTMLElement; dy: number }[] = [];

      threadRefs.current.forEach((el, threadId) => {
        const oldPos = positions.get(threadId);
        if (!oldPos) return;
        const newRect = el.getBoundingClientRect();
        const dy = oldPos.top - newRect.top;
        if (Math.abs(dy) > 1) {
          animations.push({ el, dy });
        }
      });

      if (animations.length === 0) return;

      const topMover = animations.reduce(
        (max, curr) => (curr.dy > max.dy ? curr : max),
        animations[0],
      );

      // Invert
      animations.forEach(({ el, dy }) => {
        el.style.transform = `translateY(${dy}px)`;
        el.style.transition = 'none';
        el.style.zIndex = '1';
      });

      if (topMover && topMover.dy > 50) {
        topMover.el.style.zIndex = '20';
        topMover.el.style.boxShadow = '0 8px 32px rgba(var(--theme-primary-rgb), 0.15), 0 0 0 1px rgba(var(--theme-primary-rgb), 0.3)';
        topMover.el.style.background = 'rgba(var(--theme-primary-rgb), 0.05)';
      }

      // Force reflow
      document.body.offsetHeight;

      // Play
      requestAnimationFrame(() => {
        animations.forEach(({ el }) => {
          el.style.transition = 'transform 400ms cubic-bezier(0.2, 0, 0.2, 1), box-shadow 400ms ease, background 400ms ease';
          el.style.transform = 'translateY(0)';
        });

        cleanupTimerRef.current = window.setTimeout(() => {
          scrubInlineStyles();
          cleanupTimerRef.current = null;
        }, 400);
      });
    });
  }, [threads, scrubInlineStyles]);

  return { setThreadRef };
}

interface SidebarProps {
  panel: string;
  scope: Scope;
  collapsed?: boolean;
}

export function Sidebar({ panel, scope, collapsed }: SidebarProps) {
  const config = usePanelStore((s) => s.getPanelConfig(panel));
  const ws = usePanelStore((state) => state.ws);
  // SPEC-26c: sidebar reads from its scope's thread list. Project sidebar
  // reads state.threads.project; view sidebar reads state.threads.view.
  const rawThreads = usePanelStore((state) => state.threads[scope]);
  const currentThreadId = usePanelStore((state) => state.currentThreadIds[scope]);
  const currentScope = usePanelStore((state) => state.currentScope);
  const secondary = usePanelStore((state) => state.secondary);
  const openSecondary = usePanelStore((state) => state.openSecondary);
  const toggleCliPicker = usePanelStore((state) => state.toggleCliPicker);

  // SECONDARY_CHAT_SPEC §4: when a secondary is open, reorder the list so
  // the secondary's thread sits at position 2, indented beneath the primary.
  const threads = reorderWithSecondary(rawThreads, currentThreadId, secondary?.threadId ?? null);
  const { setThreadRef } = useThreadAnimation(threads);
  const resolveCliAccent = useCliAccentResolver();
  const resolveHarness = useResolvedHarnessResolver();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Close kebab menu on click outside of both the dropdown and its trigger.
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

  // Request thread list when connected. SPEC-26c: scoped per sidebar.
  useEffect(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:list', scope }));
    }
  }, [ws, panel, scope]);

  // Handle WebSocket messages for copy-link.
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'thread:link') {
          if (!msg.filePath) return;
          const intent = threadLinkIntent.consume();
          if (intent === 'view') {
            // View Markdown: switch to code-viewer and open the file tab.
            // Server returns an absolute path; file_content_request expects
            // a workspace-relative path (it re-joins with the workspace
            // root on the server side). Strip everything up to the "ai/"
            // segment to get the relative form.
            const aiIdx = msg.filePath.indexOf('ai/');
            const relPath = aiIdx >= 0 ? msg.filePath.slice(aiIdx) : msg.filePath;
            const store = usePanelStore.getState();
            store.setCurrentPanel('code-viewer');
            const name = relPath.split('/').pop() || relPath;
            const { shouldFetch } = useFileStore.getState().openFileTab({
              path: relPath,
              name,
              type: 'file',
              extension: 'md',
            });
            if (shouldFetch) {
              ws.send(JSON.stringify({
                type: 'file_content_request',
                panel: 'code-viewer',
                path: relPath,
              }));
            }
          } else {
            // Default intent: copy the file path to clipboard.
            navigator.clipboard.writeText(msg.filePath).then(() => {
              console.log('[Sidebar] Copied link to clipboard:', msg.filePath);
              showToast('Thread link copied');
            }).catch(err => {
              console.error('[Sidebar] Failed to copy link:', err);
            });
          }
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);
  
  const sendMessage = useCallback((msg: object) => {
    console.log('[Sidebar] Sending:', msg, 'WS state:', ws?.readyState);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.error('[Sidebar] WebSocket not connected! State:', ws?.readyState);
    }
  }, [ws]);
  
  // Open the CLI picker dropdown — same entry point as the chat header's
  // playlist_add button. Selecting a CLI creates the new thread.
  const handleCreateThread = () => {
    toggleCliPicker(panel);
  };

  const harnessStatuses = useHarnessStatuses();
  const selectHarness = usePanelStore((state) => state.selectHarness);
  const handleHarnessSelect = useCallback((harnessId: string) => {
    selectHarness(harnessId, scope);
  }, [selectHarness, scope]);

  const handleOpenThread = (threadId: string) => {
    sendMessage({ type: 'thread:open-assistant', scope, threadId });
  };

  const handleRenameStart = (threadId: string, currentName: string) => {
    setRenamingId(threadId);
    setRenameValue(currentName);
  };

  const handleRenameSubmit = (threadId: string) => {
    if (renameValue.trim()) {
      sendMessage({
        type: 'thread:rename',
        scope,
        threadId,
        name: renameValue.trim()
      });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDeleteThread = (threadId: string) => {
    if (confirm('Delete this conversation?')) {
      sendMessage({ type: 'thread:delete', scope, threadId });
    }
  };

  const handleCopyLink = (threadId: string) => {
    sendMessage({ type: 'thread:copyLink', scope, threadId });
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'unknown';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'unknown';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return 'unknown';
    }
  };
  
  const isActive = currentScope === scope;
  const headerLabel = scope === 'project' ? 'Project' : (config?.name || panel);

  // Collapsed — render an empty placeholder so the grid's 5-child layout
  // stays aligned (track 1 is 0px, so nothing shows). Returning null would
  // shift ResizeHandle/ChatArea/ContentArea one track left and blank the UI.
  if (collapsed) {
    return <aside className="sidebar sidebar--collapsed" aria-hidden="true" />;
  }

  return (
    <aside className={`sidebar sidebar--${scope}${isActive ? ' sidebar--active' : ''}`}>
      {scope !== 'project' && (
        <div className="sidebar-header">
          {headerLabel}
        </div>
      )}

      <button
        className="new-chat-btn"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleCreateThread}
      >
        New Thread
      </button>
      <CliPickerDropdown
        panel={panel}
        statuses={harnessStatuses}
        onSelect={handleHarnessSelect}
      />
      
      <div className="thread-list">
        {!threads || threads.length === 0 ? (
          <div className="chat-item">
            <span className="chat-item-text">No threads yet</span>
          </div>
        ) : (
          threads.filter(t => t && t.threadId && t.entry).map((thread) => {
            const isSecondaryRow = secondary?.threadId === thread.threadId;
            const rowClass = [
              'chat-item',
              currentThreadId === thread.threadId ? 'active' : '',
              isSecondaryRow ? 'chat-item--secondary-indent' : '',
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
                  style={{
                    width: '100%',
                    padding: '2px 4px',
                    fontSize: '12px',
                    border: '1px solid var(--theme-border)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
              ) : (
                <>
                  <div className="thread-row thread-row-top">
                    <span className="chat-item-text" title={formatThreadDisplayName(thread)}>
                      <span className="material-symbols-outlined rv-thread-row-icon">
                        {resolveHarness(thread.entry?.harnessId)?.materialIcon ?? 'help'}
                      </span>
                      {formatThreadDisplayName(thread)}
                      {thread.entry?.status === 'active' && (
                        <span style={{ color: '#4caf50', marginLeft: '4px', fontSize: '8px' }}>●</span>
                      )}
                    </span>
                    <button 
                      className="thread-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === thread.threadId ? null : thread.threadId);
                      }}
                      title="More options"
                    >
                      ⋮
                    </button>
                    {menuOpenId === thread.threadId && (() => {
                      // SECONDARY_CHAT_SPEC §5a: "Open as Secondary" at top of
                      // the menu. Grayed (never hidden) when:
                      //   - this thread is already the primary's active thread
                      //   - a secondary is already open (any thread)
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
                        className="thread-menu-dropdown"
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
                            threadLinkIntent.set('view');
                            sendMessage({ type: 'thread:copyLink', scope, threadId: thread.threadId });
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
                  <div className="thread-row thread-row-bottom">
                    <span className="chat-item-meta">
                      {thread.entry?.messageCount || 0} msgs · {formatDate(thread.entry?.createdAt)}
                    </span>
                  </div>
                </>
              )}
            </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
