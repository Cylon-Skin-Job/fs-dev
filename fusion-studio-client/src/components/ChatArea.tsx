import { useRef, useEffect, useState, useCallback } from 'react';
import { usePanelStore } from '../state/panelStore';
import { MessageList } from './MessageList';
import { ChatInput, type ChatInputRef } from './ChatInput';
import { ClipboardTrigger } from '../clipboard';
import { ScreenshotsTrigger } from '../screenshots';
import { RecentFilesTrigger } from '../recent-files';
import { EmojiTrigger } from '../emojis';
import { MicTrigger } from '../mic';
import {
  useHoverIconModal,
  HoverIconModalContainer,
  HoverIconModalList,
} from './hover-icon-modal';
import { ConnectingOverlay } from './ConnectingOverlay';
import { CliPickerDropdown } from './CliPickerDropdown';
import { ThreadJumpDropdown } from './ThreadJumpDropdown';
import { useResolvedHarness } from '../config/harness';
import { useCliAccentResolver } from '../hooks/useCliAccentStyle';
import { useHarnessStatuses } from '../hooks/useHarnessStatuses';
import { threadLinkIntent } from '../lib/thread-link-intent';
import type { Scope, PanelState, Message, StreamSegment } from '../types';

// PER_THREAD_CHAT_STATE: stable empty references so Zustand selectors that
// fall back on a missing thread slot don't return a fresh `[]` each render,
// which would cause React error #185 (infinite re-render).
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_SEGMENTS: StreamSegment[] = [];

interface ChatAreaProps {
  panel: string;
  scope: Scope;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  /**
   * PER_THREAD_CHAT_STATE: when set, ChatArea reads/writes chat state for
   * this specific thread instead of currentThreadIds[scope]. Used by the
   * secondary popup so it can display a different project thread than the
   * primary. Only meaningful when scope='project'.
   */
  threadIdOverride?: string | null;
}

/**
 * PER_THREAD_CHAT_STATE: project chat state is now keyed by threadId.
 * Primary ChatArea reads projectChats[currentThreadIds.project];
 * secondary ChatArea reads projectChats[threadIdOverride];
 * view still reads panels[panel] for agents-viewer.
 */
function selectChatState(scope: Scope, panel: string, tid: string | null) {
  return (state: ReturnType<typeof usePanelStore.getState>): PanelState | undefined => {
    if (scope === 'project') {
      return tid ? state.projectChats[tid] : undefined;
    }
    return state.panels[panel];
  };
}

export function ChatArea({ panel, scope, collapsed, sidebarCollapsed, threadIdOverride }: ChatAreaProps) {
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const toggleCliPicker = usePanelStore((s) => s.toggleCliPicker);
  const toggleThreadDropdown = usePanelStore((s) => s.toggleThreadDropdown);
  const closeAllChatHeaderDropdowns = usePanelStore((s) => s.closeAllChatHeaderDropdowns);
  const cliPickerOpen = usePanelStore((s) => !!s.cliPickerOpen[panel]);
  const threadDropdownOpen = usePanelStore((s) => !!s.threadDropdownOpen[panel]);
  const chatHeaderRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const justSentRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const connectingHarnessId = usePanelStore((s) => s.connectingHarnessId);
  const setConnectingHarnessId = usePanelStore((s) => s.setConnectingHarnessId);
  const selectHarness = usePanelStore((s) => s.selectHarness);
  const harnessStatuses = useHarnessStatuses();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleInsertText = (text: string) => {
    chatInputRef.current?.insertText(text);
  };

  // Listen for global chat-insert events from other components (e.g. Office Viewer)
  useEffect(() => {
    if (threadIdOverride) return; // Secondary chat ignores global inserts
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string') handleInsertText(text);
    };
    window.addEventListener('fusion:chat-insert', handler);
    return () => window.removeEventListener('fusion:chat-insert', handler);
  }, [threadIdOverride]);

  // PER_THREAD_CHAT_STATE: resolve the thread this ChatArea is viewing.
  // Primary uses currentThreadIds[scope]; secondary passes threadIdOverride.
  const primaryThreadId = usePanelStore((state) => state.currentThreadIds[scope]);
  const currentThreadId = threadIdOverride ?? primaryThreadId;
  const selector = selectChatState(scope, panel, currentThreadId);
  const messages = usePanelStore((state) => selector(state)?.messages ?? EMPTY_MESSAGES);
  const currentTurn = usePanelStore((state) => selector(state)?.currentTurn ?? null);
  const segments = usePanelStore((state) => selector(state)?.segments ?? EMPTY_SEGMENTS);
  const contextUsage = usePanelStore((state) => state.contextUsage);
  const currentScope = usePanelStore((state) => state.currentScope);
  const wireReady = usePanelStore((state) => state.wireReady);
  const threads = usePanelStore((state) => state.threads[scope]);
  const currentThread = threads.find(t => t.threadId === currentThreadId);
  const resolvedHarness = useResolvedHarness(currentThread?.entry?.harnessId);
  const connectingHarness = useResolvedHarness(connectingHarnessId);
  const identity = resolvedHarness
    ? { name: resolvedHarness.name, icon: resolvedHarness.materialIcon, accentColor: resolvedHarness.accentColor }
    : { name: 'Unknown', icon: 'help', accentColor: undefined };
  const resolveCliAccent = useCliAccentResolver();
  const setWireReady = usePanelStore((state) => state.setWireReady);

  const addMessage = usePanelStore((state) => state.addMessage);
  const sendMessage = usePanelStore((state) => state.sendMessage);
  const finalizeTurn = usePanelStore((state) => state.finalizeTurn);

  // No thread active → show inline harness picker
  const noThread = !currentThreadId;

  // SPEC-26c: inactive chat still renders history but its input is disabled.
  // The other side owns the live wire.
  const isActive = currentScope === scope;

  const handleHarnessSelect = useCallback((harnessId: string) => {
    selectHarness(harnessId, scope);
  }, [selectHarness, scope]);

  // Close chat-header dropdowns on Escape or outside click.
  useEffect(() => {
    if (!cliPickerOpen && !threadDropdownOpen && !moreMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllChatHeaderDropdowns(panel);
        setMoreMenuOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      // Don't close if the click lands inside an open dropdown anywhere in
      // the app — the sidebar's CLI-picker is outside chatHeaderRef, so
      // without this, clicking a harness item closes the dropdown before
      // its own click handler fires.
      if (e.target instanceof Element && e.target.closest('.rv-dropdown[data-open="true"]')) {
        return;
      }
      const node = chatHeaderRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        closeAllChatHeaderDropdowns(panel);
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [cliPickerOpen, threadDropdownOpen, moreMenuOpen, panel, closeAllChatHeaderDropdowns]);

  // More-menu handlers (opened by the more_vert button in the chat header).
  const handleToggleThreads = useCallback(() => {
    toggleCollapsed(panel, 'leftSidebar');
    setMoreMenuOpen(false);
  }, [toggleCollapsed, panel]);

  const handleCopyLink = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadIds.project;
    const socket = store.ws;
    if (tid && socket && socket.readyState === WebSocket.OPEN) {
      threadLinkIntent.set('copy');
      socket.send(JSON.stringify({ type: 'thread:copyLink', scope: 'project', threadId: tid }));
    }
    setMoreMenuOpen(false);
  }, []);

  const handleRename = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadIds.project;
    const socket = store.ws;
    setMoreMenuOpen(false);
    if (!tid || !socket || socket.readyState !== WebSocket.OPEN) return;
    const current = store.threads.project.find((t) => t.threadId === tid);
    const currentName = current?.entry?.name ?? '';
    const next = window.prompt('Rename thread:', currentName);
    const trimmed = next?.trim();
    if (trimmed && trimmed !== currentName) {
      socket.send(JSON.stringify({
        type: 'thread:rename',
        scope: 'project',
        threadId: tid,
        name: trimmed,
      }));
    }
  }, []);

  const handleViewMarkdown = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadIds.project;
    const socket = store.ws;
    if (tid && socket && socket.readyState === WebSocket.OPEN) {
      threadLinkIntent.set('view');
      socket.send(JSON.stringify({ type: 'thread:copyLink', scope: 'project', threadId: tid }));
    }
    setMoreMenuOpen(false);
  }, []);

  // Clear overlay once wire is ready
  useEffect(() => {
    if (wireReady && connectingHarnessId) {
      setConnectingHarnessId(null);
      setWireReady(false);
    }
  }, [wireReady, connectingHarnessId, setConnectingHarnessId, setWireReady]);

  // On send: scroll user bubble to top of viewport
  useEffect(() => {
    if (justSentRef.current && lastUserMsgRef.current) {
      justSentRef.current = false;
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages.length]);

  // Hide orb state when first segment arrives
  useEffect(() => {
    if (segments.length > 0) {
      setIsSending(false);
    }
  }, [segments.length]);

  // Show orb if: local sending state OR streaming with no segments yet
  const showOrb = (isSending || currentTurn?.status === 'streaming') && segments.length === 0;

  // Turn is active if there's a currentTurn (streaming or revealing).
  // This drives the send/stop button toggle.
  const isTurnActive = !!currentTurn || isSending;

  const handleSend = (text: string) => {
    setIsSending(true);

    // If there's an active turn, finalize it BEFORE adding the user
    // message. finalizeTurn snapshots to messages[], clears currentTurn.
    //
    // KNOWN PAST BUG (DO NOT REINTRODUCE):
    // User bubble appeared above the live assistant response mid-stream.
    // PER_THREAD_CHAT_STATE: tid respects threadIdOverride (secondary) or
    // falls back to the primary's current thread.
    const state = usePanelStore.getState();
    const tid = scope === 'project' ? currentThreadId : null;
    const cs = scope === 'project'
      ? (tid ? state.projectChats[tid] : undefined)
      : state.panels[panel];
    if (cs?.currentTurn) {
      finalizeTurn(scope, tid);
    }

    justSentRef.current = true;
    addMessage(scope, tid, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: Date.now()
    });

    sendMessage(text, scope, tid);
  };

  // Stop: immediately finalize the turn — snap all remaining content
  // to display, move to history. The AI may keep running server-side
  // but the client moves on.
  const handleStop = () => {
    const state = usePanelStore.getState();
    const tid = scope === 'project' ? currentThreadId : null;
    const cs = scope === 'project'
      ? (tid ? state.projectChats[tid] : undefined)
      : state.panels[panel];
    if (cs?.currentTurn) {
      finalizeTurn(scope, tid);
    }
    setIsSending(false);
  };

  const sectionClass = `chat-area chat-area--${scope}${isActive ? ' chat-area--active' : ' chat-area--inactive'}${noThread ? ' chat-area--no-thread' : ''}`;
  const inputPlaceholder = noThread
    ? ''
    : !isActive
      ? 'Click a thread in this sidebar to activate'
      : undefined;

  // SPEC-26c-2: collapsed rail variant
  if (collapsed) {
    return (
      <section className={`chat-area chat-area--${scope} chat-area--collapsed`}>
        <button
          className="rv-collapse-rail-btn"
          onClick={() => toggleCollapsed(panel, 'leftChat')}
          title="Expand chat"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </section>
    );
  }

  // SECONDARY_CHAT_SPEC: secondary has its own SecondaryHeader (traffic lights).
  // Skip the primary chat-header row entirely when we're embedded in the
  // secondary popup to avoid a double-header.
  const isSecondary = !!threadIdOverride;

  return (
    <section className={sectionClass}>
      {!isSecondary && (
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
                onClick={() => toggleCliPicker(panel)}
                aria-haspopup="menu"
                aria-expanded={cliPickerOpen}
                aria-controls={`cli-picker-${panel}`}
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
          {/* more_vert button — always visible on primary chat */}
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
        {/* When the sidebar is collapsed, the CLI picker + thread-jump
         * dropdowns live here (anchored under their chat-header triggers).
         * When the sidebar is expanded, the sidebar renders its own CLI
         * picker centered under its "New Thread" button. */}
        {sidebarCollapsed && (
          <>
            <CliPickerDropdown
              panel={panel}
              statuses={harnessStatuses}
              onSelect={handleHarnessSelect}
            />
            <ThreadJumpDropdown panel={panel} scope={scope} />
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
      )}
      <div className="chat-messages" ref={chatContainerRef} style={{ position: 'relative' }}>
        {connectingHarnessId ? (
          <ConnectingOverlay harnessName={connectingHarness?.name} />
        ) : messages.length === 0 && !currentTurn && !showOrb ? (
          <div className="message message-system">
            {noThread ? 'No thread selected' : 'Start a conversation'}
          </div>
        ) : (
          <MessageList
            panel={panel}
            scope={scope}
            threadId={currentThreadId}
            messages={messages}
            currentTurn={currentTurn}
            segments={segments}
            lastUserMsgRef={lastUserMsgRef}
            showOrb={showOrb}
          />
        )}

        {/* Fixed spacer — always present, never changes size.
            Provides scroll room so user bubble can scroll to top of viewport. */}
        {!noThread && <div className="rv-chat-scroll-sentinel" />}
      </div>

      <div className={`chat-footer${noThread ? ' rv-chat-footer--disabled' : ''}`}>
        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          onStop={handleStop}
          disabled={noThread || !isActive}
          placeholder={inputPlaceholder}
          panel={panel}
          isTurnActive={isTurnActive}
        />
        <div className="rv-chat-composer-meta-row">
          <div>
            <ClipboardTrigger onInsert={handleInsertText} />
            <ScreenshotsTrigger onInsert={handleInsertText} />
            <RecentFilesTrigger onInsert={handleInsertText} />
            <EmojiTrigger onInsert={handleInsertText} />
            <MicTrigger onInsert={handleInsertText} />
          </div>
          {isTurnActive ? (
            <button
              className="rv-chat-footer-btn stop-btn"
              onClick={handleStop}
              title="Stop generating"
            >
              <span className="material-symbols-outlined rv-icon-md">
                stop
              </span>
            </button>
          ) : (
            <SendButtonGroup
              chatInputRef={chatInputRef}
              onSend={handleSend}
            />
          )}
        </div>
        <div className="rv-context-usage-container">
          <div className="rv-context-usage-bar-standalone">
            <div
              className="rv-context-usage-fill"
              style={{ width: `${Math.min(contextUsage * 100, 100)}%` }}
            />
          </div>
          <span className="rv-context-usage-text">{Math.round(contextUsage * 100)}%</span>
        </div>
      </div>
    </section>
  );
}

// Send button group with dropdown modal - following MicTrigger pattern
interface SendButtonGroupProps {
  chatInputRef: React.RefObject<ChatInputRef | null>;
  onSend: (text: string) => void;
}

function SendButtonGroup({ chatInputRef, onSend }: SendButtonGroupProps) {
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);

  const {
    isOpen,
    state,
    triggerRef,
    popoverRef,
    triggerProps,
    popoverProps,
    close,
  } = useHoverIconModal({
    id: 'send-dropdown',
    triggerMode: 'click', // Click only, no hover preview (like MicTrigger)
    stayOpenOnLeave: true, // Stays open until Escape/click outside
  });

  // Position the modal above the dropdown button (right-aligned)
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const modalWidth = 200; // Fixed width for dropdown menu
      setPopoverPos({
        left: rect.right - modalWidth,
        bottom: window.innerHeight - rect.top + 8,
      });
    }
  }, [isOpen, triggerRef]);

  const handleSendClick = () => {
    const text = chatInputRef.current?.getText();
    if (text?.trim()) {
      onSend(text.trim());
      chatInputRef.current?.clearText();
    }
  };

  return (
    <>
      <div className="rv-send-button-group">
        <button
          className="rv-send-btn-main"
          onClick={handleSendClick}
          title="Send message"
        >
          Send
        </button>
        <div className="rv-send-btn-divider" />
        <button
          ref={triggerRef}
          className="rv-send-btn-secondary"
          title="More options"
          {...triggerProps}
        >
          <span className="material-symbols-outlined rv-icon-md">
            arrow_drop_down
          </span>
        </button>
      </div>

      <HoverIconModalContainer
        isOpen={isOpen}
        state={state}
        position={popoverPos ?? { left: 0, bottom: 0 }}
        popoverRef={popoverRef}
        popoverProps={popoverProps}
        className="rv-send-dropdown-modal"
      >
        <HoverIconModalList>
          <div className="rv-send-dropdown-content">
            <button className="rv-send-dropdown-item" onClick={() => { close(); }}>
              <span className="material-symbols-outlined">chat</span>
              <span>Send as chat</span>
            </button>
            <button className="rv-send-dropdown-item" onClick={() => { close(); }}>
              <span className="material-symbols-outlined">code</span>
              <span>Send as code block</span>
            </button>
            <button className="rv-send-dropdown-item" onClick={() => { close(); }}>
              <span className="material-symbols-outlined">terminal</span>
              <span>Send as command</span>
            </button>
          </div>
        </HoverIconModalList>
      </HoverIconModalContainer>
    </>
  );
}
