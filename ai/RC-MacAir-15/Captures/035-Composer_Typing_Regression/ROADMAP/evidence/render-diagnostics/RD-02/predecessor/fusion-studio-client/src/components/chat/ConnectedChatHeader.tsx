/** Header leaf with exact-session activity gating for Move to Side Chat. */
import { memo } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../../state/chatSubmissionStore';
import { hasAcceptedPromptExecutionWatch } from '../../lib/chat/prompt-submission-recovery';
import { ChatAreaHeader } from './ChatAreaHeader';
import type {
  ChatSurfaceActions,
  ChatSurfaceHeaderPresentation,
  ChatSurfaceRefs,
  ChatSurfaceShellPresentation,
} from './chatSurfaceContract';

interface ConnectedChatHeaderProps {
  workspaceId: string;
  threadId: string;
  surfaceId: string;
  panel: string;
  shell: ChatSurfaceShellPresentation;
  header: ChatSurfaceHeaderPresentation;
  actions: ChatSurfaceActions;
  headerRef: ChatSurfaceRefs['headerRef'];
  onToggleThreads: () => void;
  onToggleContent?: () => void;
}

export const ConnectedChatHeader = memo(function ConnectedChatHeader({
  workspaceId,
  threadId,
  surfaceId,
  panel,
  shell,
  header,
  actions,
  headerRef,
  onToggleThreads,
  onToggleContent,
}: ConnectedChatHeaderProps) {
  const ownerReady = Boolean(workspaceId && shell.hasThread && threadId);
  const submissionBusy = useChatSubmissionStore((state) => {
    if (!ownerReady) return false;
    const attempt = state.attemptsByOwner[chatSubmissionOwnerKey(workspaceId, threadId)];
    return attempt?.phase === 'pending' || attempt?.phase === 'unknown'
      || Boolean(attempt?.phase === 'accepted'
        && hasAcceptedPromptExecutionWatch(workspaceId, threadId, attempt.requestId));
  });
  const turnBusy = usePanelStore((state) => {
    const chat = ownerReady ? state.projectChats[threadId] : null;
    return Boolean(chat?.currentTurn || chat?.pendingTurnEnd || chat?.pendingExchangeSaveTurnId);
  });

  return (
    <ChatAreaHeader
      mountId={surfaceId}
      panel={panel}
      headerRef={headerRef}
      hasThread={shell.hasThread}
      threadName={header.threadName}
      sidebarCollapsed={shell.isThreadsCollapsed}
      contentCollapsed={shell.isContentCollapsed}
      cliPickerOpen={header.cliPickerOpen}
      harnessStatuses={header.harnessStatuses}
      showCliPicker={header.showCliPicker}
      handleToggleThreads={onToggleThreads}
      onHarnessSelect={actions.onHarnessSelect}
      onCreateThread={actions.onCreateThread}
      onRename={actions.onRename}
      onCopyLink={actions.onCopyLink}
      onViewMarkdown={actions.onViewMarkdown}
      canMoveToSideChat={header.canMoveToSideChatBase
        && !turnBusy
        && !shell.isSendingForCurrentThread
        && !submissionBusy}
      onMoveToSideChat={actions.onMoveToSideChat}
      onCloseCliPicker={actions.onCloseCliPicker}
      onToggleContent={onToggleContent}
    />
  );
});
