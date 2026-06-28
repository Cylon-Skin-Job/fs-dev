import '../styles/dropdown.css';
import './ChatArea.css';
import { MessageList } from './MessageList';
import { ConnectingOverlay } from './ConnectingOverlay';
import { ChatAreaHeader } from './chat/ChatAreaHeader';
import { ChatAreaFooter } from './chat/ChatAreaFooter';
import { TodoDrawer } from './chat/TodoDrawer';
import { useChatArea } from './chat/useChatArea';

interface ChatAreaProps {
  panel: string;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  /**
   * When set, ChatArea reads/writes chat state for this specific thread
   * instead of the current workspace thread. Used by the secondary popup.
   */
  threadIdOverride?: string | null;
}

export function ChatArea({ panel, collapsed, sidebarCollapsed, threadIdOverride }: ChatAreaProps) {
  const {
    panel: chatPanel,
    toggleCollapsed,
    toggleThreadDropdown,
    cliPickerOpen,
    threadDropdownOpen,
    chatHeaderRef,
    lastUserMsgRef,
    chatContainerRef,
    chatInputRef,
    harnessStatuses,
    showCliPicker,
    moreMenuOpen,
    setMoreMenuOpen,
    handleInsertText,
    currentThreadId,
    currentThread,
    messages,
    currentTurn,
    segments,
    contextUsage,
    connectingHarnessId,
    connectingHarness,
    identity,
    resolveCliAccent,
    noThread,
    isActive,
    handleHarnessSelect,
    handleCreateThread,
    handleToggleThreads,
    handleCopyLink,
    handleRename,
    handleViewMarkdown,
    showOrb,
    isTurnActive,
    isTurnFinalizing,
    handleSend,
    handleStop,
    warmCurrentThread,
    isAcceptancePending,
    isForkThreadDisabled,
    handleForkThread,
    inputPlaceholder,
  } = useChatArea({ panel, threadIdOverride });

  const sectionClass = `rv-chat-area rv-chat-area--project${isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${noThread ? ' rv-chat-area--no-thread' : ''}`;
  const isSecondary = !!threadIdOverride;
  const headerProps = {
    panel: chatPanel,
    chatHeaderRef,
    currentThreadId,
    currentThread,
    identity,
    resolveCliAccent,
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
  };
  const footerProps = {
    panel: chatPanel,
    chatInputRef,
    handleSend,
    handleStop,
    noThread,
    isActive,
    inputPlaceholder,
    isTurnActive,
    isTurnFinalizing,
    isAcceptancePending,
    isForkThreadDisabled,
    handleForkThread,
    handleInsertText,
    warmCurrentThread,
    contextUsage,
  };

  if (collapsed) {
    return (
      <section className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed">
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

  return (
    <section className={sectionClass}>
      {!isSecondary && (
        <ChatAreaHeader
          {...headerProps}
          sidebarCollapsed={sidebarCollapsed}
        />
      )}
      <div className="rv-chat-messages">
        <div className="rv-chat-scroll-viewport" ref={chatContainerRef}>
          {connectingHarnessId ? (
            <ConnectingOverlay harnessName={connectingHarness?.name} />
          ) : messages.length === 0 && !currentTurn && !showOrb ? (
            <div className="rv-message rv-message-system">
              {noThread ? 'No thread selected' : 'Start a conversation'}
            </div>
          ) : (
            <MessageList
              threadId={currentThreadId}
              messages={messages}
              currentTurn={currentTurn}
              segments={segments}
              lastUserMsgRef={lastUserMsgRef}
              showOrb={showOrb}
            />
          )}

          {!noThread && <div className="rv-chat-scroll-sentinel" />}
        </div>

        <TodoDrawer threadId={currentThreadId} />
      </div>

      <ChatAreaFooter {...footerProps} />
    </section>
  );
}
