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
  contentCollapsed?: boolean;
  hideCollapsedRail?: boolean;
  /**
   * When set, ChatArea reads/writes chat state for this specific thread
   * instead of the current workspace thread. Used by the secondary popup.
   */
  threadIdOverride?: string | null;
}

export function ChatArea({ panel, collapsed, sidebarCollapsed, contentCollapsed, hideCollapsedRail, threadIdOverride }: ChatAreaProps) {
  const {
    panel: chatPanel,
    toggleCollapsed,
    cliPickerOpen,
    chatHeaderRef,
    lastUserMsgRef,
    chatContainerRef,
    chatInputRef,
    harnessStatuses,
    showCliPicker,
    moreMenuOpen,
    setMoreMenuOpen,
    handleInsertText,
    handleRequestDiagnostic,
    handleCopyDiagnostic,
    handleAskAIWithDiagnostic,
    handleAddAttachment,
    currentThreadId,
    messages,
    currentTurn,
    segments,
    contextUsage,
    tokenUsage,
    connectingHarnessId,
    connectingHarness,
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
    inputPlaceholder,
    activeWorkspaceId,
    composerDraft,
    handleComposerDraftChange,
    screenshotOwner,
  } = useChatArea({ panel, threadIdOverride });

  const sectionClass = `rv-chat-area rv-chat-area--project${isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${noThread ? ' rv-chat-area--no-thread' : ''}`;
  const isSecondary = !!threadIdOverride;
  const headerProps = {
    panel: chatPanel,
    chatHeaderRef,
    currentThreadId,
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
    handleToggleContent: () => toggleCollapsed(panel, 'contentArea'),
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
    handleInsertText,
    handleAddAttachment,
    warmCurrentThread,
    contextUsage,
    tokenUsage,
    activeWorkspaceId,
    currentThreadId,
    composerDraft,
    handleComposerDraftChange,
    screenshotOwner,
  };

  if (collapsed) {
    if (hideCollapsedRail) {
      return (
        <section
          className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed"
          aria-hidden="true"
        />
      );
    }

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
              onRequestDiagnostic={handleRequestDiagnostic}
              onCopyDiagnostic={handleCopyDiagnostic}
              onAskAIWithDiagnostic={handleAskAIWithDiagnostic}
              askAIWithDiagnosticEnabled={!isAcceptancePending}
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
