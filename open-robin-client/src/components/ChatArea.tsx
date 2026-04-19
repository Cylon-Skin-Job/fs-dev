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
import { ChatHarnessPicker, type HarnessStatus } from './ChatHarnessPicker';
import { ConnectingOverlay } from './ConnectingOverlay';
import { CliPickerDropdown } from './CliPickerDropdown';
import { ThreadJumpDropdown } from './ThreadJumpDropdown';
import { getHarnessOption } from '../config/harness';
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
  const [connectingHarnessId, setConnectingHarnessId] = useState<string | null>(null);
  const [harnessStatuses, setHarnessStatuses] = useState<Record<string, HarnessStatus>>({});
  const [harnessLoading, setHarnessLoading] = useState(false);

  const handleInsertText = (text: string) => {
    chatInputRef.current?.insertText(text);
  };

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
  const ws = usePanelStore((state) => state.ws);
  const wireReady = usePanelStore((state) => state.wireReady);
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
    setWireReady(false);
    setConnectingHarnessId(harnessId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'thread:open-assistant', scope, harnessId }));
    }
  }, [ws, setWireReady, scope]);

  // Fetch harness install statuses once on mount — passed to ChatHarnessPicker as props
  const fetchHarnessStatuses = useCallback(async () => {
    setHarnessLoading(true);
    try {
      const res = await fetch('/api/harnesses');
      if (!res.ok) return;
      const list: HarnessStatus[] = await res.json();
      const map = list.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, HarnessStatus>);
      setHarnessStatuses(map);
    } catch {
      // silent — show local config as fallback
    } finally {
      setHarnessLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHarnessStatuses();
  }, [fetchHarnessStatuses]);

  // Close chat-header dropdowns on Escape or outside click.
  useEffect(() => {
    if (!cliPickerOpen && !threadDropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAllChatHeaderDropdowns(panel);
    };
    const onDown = (e: MouseEvent) => {
      const node = chatHeaderRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        closeAllChatHeaderDropdowns(panel);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [cliPickerOpen, threadDropdownOpen, panel, closeAllChatHeaderDropdowns]);

  // Clear overlay once wire is ready
  useEffect(() => {
    if (wireReady && connectingHarnessId) {
      setConnectingHarnessId(null);
      setWireReady(false);
    }
  }, [wireReady, connectingHarnessId, setWireReady]);

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

  const sectionClass = `chat-area chat-area--${scope}${isActive ? ' chat-area--active' : ' chat-area--inactive'}`;
  const inputPlaceholder = !isActive && !noThread
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
        {sidebarCollapsed && (
          <>
            <button
              className="rv-chat-header-btn rv-chat-header-btn--left"
              onClick={() => toggleCollapsed(panel, 'leftSidebar')}
              aria-label="Show threads sidebar"
              aria-expanded={false}
              title="Show threads sidebar"
            >
              <span className="material-symbols-outlined">arrow_menu_open</span>
            </button>
            <div className="rv-chat-header-right">
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
            </div>
            <CliPickerDropdown
              panel={panel}
              statuses={harnessStatuses}
              onSelect={handleHarnessSelect}
            />
            <ThreadJumpDropdown panel={panel} scope={scope} />
          </>
        )}
      </div>
      )}
      <div className="chat-messages" ref={chatContainerRef} style={{ position: 'relative' }}>
        {connectingHarnessId ? (
          <ConnectingOverlay harnessName={getHarnessOption(connectingHarnessId)?.name} />
        ) : noThread ? (
          <ChatHarnessPicker
            onSelect={handleHarnessSelect}
            statuses={harnessStatuses}
            isLoading={harnessLoading}
          />
        ) : messages.length === 0 && !currentTurn && !showOrb ? (
          <div className="message message-system">
            Start a conversation
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
        {!noThread && <div style={{ minHeight: '80vh' }} />}
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
          <div style={{ display: 'flex', gap: '4px' }}>
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
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
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
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
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
