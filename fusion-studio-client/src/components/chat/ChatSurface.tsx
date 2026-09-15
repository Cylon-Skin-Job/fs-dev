/**
 * @module ChatSurface
 * @role Portable composable chat presentation boundary (SPEC-02 §5.1).
 *
 * `ChatSurface` renders one explicit session model and emits explicit actions.
 * Its own module imports no app store, WebSocket client, thread controller,
 * service, filesystem API, or tab owner. Existing connected descendants
 * (MessageList, TodoDrawer, composer menus/attachments) may remain internally
 * connected per CHAT-RD-014, but every behavior receives or resolves the
 * explicit `threadId`/`surfaceId`; none falls back to a global current
 * thread/panel.
 *
 * Transient DOM/focus/menu identity is keyed by the mount's `surfaceId`
 * (§6.3); two mounts of one session share session truth but never DOM ids,
 * focus restoration, or open-menu state.
 */

import { MessageList } from '../MessageList';
import { ConnectingOverlay } from '../ConnectingOverlay';
import { ChatAreaHeader } from './ChatAreaHeader';
import { ChatAreaFooter } from './ChatAreaFooter';
import { TodoDrawer } from './TodoDrawer';
import { chatSurfaceDomId, type ChatSurfaceProps, type ChatSurfaceRefs } from './chatSurfaceContract';

export interface ChatSurfaceComponentProps extends ChatSurfaceProps {
  refs: ChatSurfaceRefs;
  panel: string;
  /** Outer shell content-collapse toggle; shell state is never chat identity. */
  onToggleContent?: () => void;
}

export function ChatSurface({
  workspaceId,
  viewId,
  threadGroupId,
  threadId,
  surfaceId,
  host,
  chat,
  actions,
  refs,
  panel,
  onToggleThreads,
  onToggleContent,
}: ChatSurfaceComponentProps) {
  void threadGroupId;

  const domId = chatSurfaceDomId(surfaceId);
  const sectionClass = `rv-chat-area rv-chat-area--project${chat.isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${!chat.hasThread ? ' rv-chat-area--no-thread' : ''}`;
  const showEmptyState = chat.messages.length === 0 && !chat.currentTurn && !chat.showOrb;

  return (
    <section
      className={sectionClass}
      id={`chat-surface-${domId}`}
      data-surface-id={surfaceId}
      data-chat-host={host}
      data-chat-thread-id={threadId}
      data-chat-workspace-id={workspaceId}
      data-chat-view-id={viewId ?? ''}
    >
      <ChatAreaHeader
        mountId={surfaceId}
        panel={panel}
        headerRef={refs.headerRef}
        hasThread={chat.hasThread}
        sidebarCollapsed={chat.isThreadsCollapsed}
        contentCollapsed={chat.isContentCollapsed}
        cliPickerOpen={chat.cliPickerOpen}
        moreMenuOpen={chat.moreMenuOpen}
        harnessStatuses={chat.harnessStatuses}
        showCliPicker={chat.showCliPicker}
        handleToggleThreads={onToggleThreads}
        onHarnessSelect={actions.onHarnessSelect}
        onCreateThread={actions.onCreateThread}
        onRename={actions.onRename}
        onCopyLink={actions.onCopyLink}
        onViewMarkdown={actions.onViewMarkdown}
        canMoveToSideChat={chat.canMoveToSideChat}
        onMoveToSideChat={actions.onMoveToSideChat}
        onSetMoreMenuOpen={actions.onSetMoreMenuOpen}
        onCloseCliPicker={actions.onCloseCliPicker}
        onToggleContent={onToggleContent}
      />
      <div className="rv-chat-messages">
        <div
          className="rv-chat-scroll-viewport"
          id={`chat-scroll-${domId}`}
          ref={refs.scrollRef}
        >
          {chat.connectingHarnessName ? (
            <ConnectingOverlay harnessName={chat.connectingHarnessName} />
          ) : showEmptyState ? (
            <div className="rv-message rv-message-system">
              {chat.hasThread ? 'Start a conversation' : 'No thread selected'}
            </div>
          ) : (
            <MessageList
              threadId={threadId}
              messages={chat.messages}
              currentTurn={chat.currentTurn}
              segments={chat.segments}
              lastUserMsgRef={refs.lastUserMsgRef}
              showOrb={chat.showOrb}
              onRequestDiagnostic={actions.onRequestDiagnostic}
              onCopyDiagnostic={actions.onCopyDiagnostic}
              onAskAIWithDiagnostic={actions.onAskAIWithDiagnostic}
              askAIWithDiagnosticEnabled={!chat.isAcceptancePending}
            />
          )}

          {chat.hasThread && <div className="rv-chat-scroll-sentinel" />}
        </div>

        <TodoDrawer threadId={threadId} />
      </div>

      <ChatAreaFooter
        mountId={surfaceId}
        panel={panel}
        inputRef={refs.inputRef}
        onSend={actions.onSend}
        onStop={actions.onStop}
        noThread={!chat.hasThread}
        isActive={chat.isActive}
        inputPlaceholder={chat.hasThread
          ? (chat.isActive ? undefined : 'Click a thread in this rv-sidebar to activate')
          : ''}
        isTurnActive={chat.isTurnActive}
        isTurnFinalizing={chat.isTurnFinalizing}
        isAcceptancePending={chat.isAcceptancePending}
        onInsertText={actions.onInsertText}
        onAddAttachment={actions.onAddAttachment}
        onWarmIntent={actions.onWarmIntent}
        contextUsage={chat.contextUsage}
        tokenUsage={chat.tokenUsage}
        workspaceId={workspaceId}
        threadId={chat.hasThread ? threadId : null}
        composerDraft={chat.composerDraft}
        onComposerDraftChange={actions.onComposerDraftChange}
        modelSelection={chat.modelSelection}
        onModelSelectionChange={actions.onModelSelectionChange}
        screenshotOwner={chat.hasThread ? {
          workspaceId,
          threadId,
          surface: 'primary',
        } : null}
      />
    </section>
  );
}
