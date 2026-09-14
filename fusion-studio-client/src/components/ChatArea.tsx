import '../styles/dropdown.css';
import './ChatArea.css';
import { usePanelStore } from '../state/panelStore';
import { selectionForThread } from '../state/slices/chatSurfaceSlice';
import { threadActionSetHarnessSelection } from '../lib/ws/threadGroupRows';
import { MessageList } from './MessageList';
import { ConnectingOverlay } from './ConnectingOverlay';
import { ChatAreaFooter } from './chat/ChatAreaFooter';
import { TodoDrawer } from './chat/TodoDrawer';
import { LegacyChatHost } from './chat/LegacyChatHost';
import { useChatArea } from './chat/useChatArea';

interface ChatAreaProps {
  panel: string;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  hideCollapsedRail?: boolean;
  /** Whether this panel is the shell's active panel (global-intent ownership). */
  isActive?: boolean;
  /**
   * When set, ChatArea renders the temporary floating Secondary Chat for this
   * exact thread. The legacy Secondary Chat is deliberately NOT a SPEC-02
   * `ChatSurface` mount: it claims no `ChatMountIdentity`, mints no
   * `surfaceId`, and asserts no `host` kind. It keeps its existing
   * store-connected `useChatArea` lifecycle and a legacy-local DOM id only.
   * SPEC-04 retires it after the component-tab replacement passes.
   */
  threadIdOverride?: string | null;
}

function legacyDomKey(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

/**
 * Legacy floating Secondary Chat render. Reuses the existing presentation
 * descendants with the explicit prop contracts introduced for the portable
 * surface, but supplies a legacy-local DOM id derived from the panel — never a
 * minted `surfaceId` and never a `ChatMountIdentity`.
 */
function LegacySecondaryChatArea({ panel, threadIdOverride }: ChatAreaProps) {
  const hostState = useChatArea({ panel, threadIdOverride: threadIdOverride ?? null });
  const threadId = hostState.currentThreadId;
  const mountId = `secondary-legacy-${legacyDomKey(panel)}`;

  const threadGroupId = usePanelStore((state) =>
    (threadId ? state.threads.find((t) => t.threadId === threadId)?.threadGroupId : '') ?? '',
  );
  const harnessSelection = usePanelStore((state) => selectionForThread(state, threadId));
  const modelSelection = {
    modelId: harnessSelection.acknowledged.model,
    variant: harnessSelection.acknowledged.variant,
    pending: harnessSelection.pending !== null,
  };

  const handleModelSelectionChange = (patch: { modelId?: string | null; variant?: string | null }) => {
    if (!threadId) return;
    const socket = usePanelStore.getState().ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const current = selectionForThread(usePanelStore.getState(), threadId).acknowledged;
    const nextModel = patch.modelId !== undefined ? patch.modelId : current.model;
    if (!nextModel) return;
    const nextVariant = patch.variant !== undefined ? patch.variant : current.variant;
    const request = threadActionSetHarnessSelection({
      threadGroupId: threadGroupId || undefined,
      threadId,
      model: nextModel,
      variant: nextVariant ?? null,
    });
    usePanelStore.getState().beginHarnessSelection(threadId, {
      modelId: nextModel,
      variant: nextVariant ?? null,
      requestId: request.requestId,
    });
    socket.send(JSON.stringify(request));
  };

  const sectionClass = `rv-chat-area rv-chat-area--project${hostState.isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${hostState.noThread ? ' rv-chat-area--no-thread' : ''}`;

  return (
    <section
      className={sectionClass}
      id={`chat-legacy-secondary-${legacyDomKey(panel)}`}
      data-chat-mount-id={mountId}
      data-legacy-secondary="true"
    >
      <div className="rv-chat-messages">
        <div className="rv-chat-scroll-viewport" ref={hostState.chatContainerRef}>
          {hostState.connectingHarnessId ? (
            <ConnectingOverlay harnessName={hostState.connectingHarness?.name} />
          ) : hostState.messages.length === 0 && !hostState.currentTurn && !hostState.showOrb ? (
            <div className="rv-message rv-message-system">
              {hostState.noThread ? 'No thread selected' : 'Start a conversation'}
            </div>
          ) : (
            <MessageList
              threadId={hostState.currentThreadId}
              messages={hostState.messages}
              currentTurn={hostState.currentTurn}
              segments={hostState.segments}
              lastUserMsgRef={hostState.lastUserMsgRef}
              showOrb={hostState.showOrb}
              onRequestDiagnostic={hostState.handleRequestDiagnostic}
              onCopyDiagnostic={hostState.handleCopyDiagnostic}
              onAskAIWithDiagnostic={hostState.handleAskAIWithDiagnostic}
              askAIWithDiagnosticEnabled={!hostState.isAcceptancePending}
            />
          )}

          {!hostState.noThread && <div className="rv-chat-scroll-sentinel" />}
        </div>

        <TodoDrawer threadId={hostState.currentThreadId} />
      </div>

      <ChatAreaFooter
        mountId={mountId}
        panel={panel}
        inputRef={hostState.chatInputRef}
        onSend={hostState.handleSend}
        onStop={hostState.handleStop}
        noThread={hostState.noThread}
        isActive={hostState.isActive}
        inputPlaceholder={hostState.inputPlaceholder}
        isTurnActive={hostState.isTurnActive}
        isTurnFinalizing={hostState.isTurnFinalizing}
        isAcceptancePending={hostState.isAcceptancePending}
        onInsertText={hostState.handleInsertText}
        onAddAttachment={hostState.handleAddAttachment}
        onWarmIntent={hostState.warmCurrentThread}
        contextUsage={hostState.contextUsage}
        tokenUsage={hostState.tokenUsage}
        workspaceId={hostState.activeWorkspaceId}
        threadId={hostState.currentThreadId}
        composerDraft={hostState.composerDraft}
        onComposerDraftChange={hostState.handleComposerDraftChange}
        modelSelection={modelSelection}
        onModelSelectionChange={handleModelSelectionChange}
        screenshotOwner={hostState.screenshotOwner}
      />
    </section>
  );
}

export function ChatArea({
  panel,
  collapsed,
  sidebarCollapsed,
  contentCollapsed,
  hideCollapsedRail,
  isActive = true,
  threadIdOverride,
}: ChatAreaProps) {
  if (threadIdOverride !== undefined && threadIdOverride !== null) {
    return <LegacySecondaryChatArea panel={panel} threadIdOverride={threadIdOverride} />;
  }
  return (
    <LegacyChatHost
      panel={panel}
      collapsed={collapsed}
      sidebarCollapsed={sidebarCollapsed}
      contentCollapsed={contentCollapsed}
      hideCollapsedRail={hideCollapsedRail}
      isActive={isActive}
    />
  );
}
