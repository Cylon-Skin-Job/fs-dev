/** Exact-session connected composer leaf. No parent observes composer stores. */
import { memo, useCallback } from 'react';
import { usePanelStore } from '../../state/panelStore';
import {
  chatAttachmentOwnerKey,
  useChatFileLinkStore,
} from '../../state/chatFileLinkStore';
import {
  chatComposerDraftOwnerKey,
  useChatComposerDraftStore,
} from '../../state/chatComposerDraftStore';
import {
  chatSubmissionOwnerKey,
  useChatSubmissionStore,
} from '../../state/chatSubmissionStore';
import { hasAcceptedPromptExecutionWatch } from '../../lib/chat/prompt-submission-recovery';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';
import type { ChatSurfaceActions, ChatSurfaceComposerPresentation, ChatSurfaceRefs } from './chatSurfaceContract';
import { ChatAreaFooter } from './ChatAreaFooter';

const EMPTY_ATTACHMENTS: readonly ChatLinkAttachment[] = [];

interface ConnectedChatComposerProps {
  workspaceId: string;
  threadId: string;
  surfaceId: string;
  panel: string;
  hasThread: boolean;
  isActive: boolean;
  isSendingForCurrentThread: boolean;
  composer: ChatSurfaceComposerPresentation;
  actions: ChatSurfaceActions;
  inputRef: ChatSurfaceRefs['inputRef'];
}

export const ConnectedChatComposer = memo(function ConnectedChatComposer({
  workspaceId,
  threadId,
  surfaceId,
  panel,
  hasThread,
  isActive,
  isSendingForCurrentThread,
  composer,
  actions,
  inputRef,
}: ConnectedChatComposerProps) {
  const ownerReady = Boolean(workspaceId && hasThread && threadId);
  const draftKey = ownerReady ? chatComposerDraftOwnerKey(workspaceId, threadId) : '';
  const attachmentKey = ownerReady ? chatAttachmentOwnerKey(workspaceId, threadId) : '';
  const submissionKey = ownerReady ? chatSubmissionOwnerKey(workspaceId, threadId) : '';

  const composerDraft = useChatComposerDraftStore(
    (state) => state.draftsByOwner[draftKey] ?? '',
  );
  const attachments = useChatFileLinkStore(
    (state) => state.pendingAttachmentsByOwner[attachmentKey]?.attachments ?? EMPTY_ATTACHMENTS,
  );
  const submissionAttempt = useChatSubmissionStore(
    (state) => state.attemptsByOwner[submissionKey] ?? null,
  );
  const submissionFeedback = useChatSubmissionStore(
    (state) => state.feedbackByOwner[submissionKey] ?? '',
  );
  const isTurnFinalizing = usePanelStore((state) => {
    const chat = ownerReady ? state.projectChats[threadId] : null;
    return Boolean(chat?.pendingTurnEnd || chat?.pendingExchangeSaveTurnId);
  });
  const hasCurrentTurn = usePanelStore((state) => (
    ownerReady && Boolean(state.projectChats[threadId]?.currentTurn)
  ));
  const contextUsage = usePanelStore((state) => (
    ownerReady ? (state.contextUsageByThread[threadId] ?? 0) : 0
  ));
  const tokenUsage = usePanelStore((state) => (
    ownerReady ? (state.tokenUsageByThread[threadId] ?? null) : null
  ));

  const isAcceptancePending = submissionAttempt?.phase === 'pending';
  const isSubmissionUnresolved = isAcceptancePending || submissionAttempt?.phase === 'unknown';
  const canCheckSubmissionStatus = submissionAttempt?.phase === 'unknown'
    || Boolean(ownerReady && submissionAttempt?.phase === 'accepted'
      && submissionFeedback
      && hasAcceptedPromptExecutionWatch(workspaceId, threadId, submissionAttempt.requestId));
  const isTurnActive = (hasCurrentTurn || isSendingForCurrentThread) && !isTurnFinalizing;

  const handleDraftChange = useCallback((text: string) => {
    if (!ownerReady) return;
    if (usePanelStore.getState().activeWorkspaceId !== workspaceId) return;
    useChatComposerDraftStore.getState().setDraft(workspaceId, threadId, text);
  }, [ownerReady, threadId, workspaceId]);

  const handleRemoveAttachment = useCallback((id: string) => {
    if (!ownerReady) return;
    useChatFileLinkStore.getState().removePendingAttachment(workspaceId, threadId, id);
  }, [ownerReady, threadId, workspaceId]);

  return (
    <ChatAreaFooter
      mountId={surfaceId}
      panel={panel}
      inputRef={inputRef}
      onSend={actions.onSend}
      onStop={actions.onStop}
      noThread={!hasThread}
      isActive={isActive}
      inputPlaceholder={hasThread
        ? (isActive ? undefined : 'Click a thread in this rv-sidebar to activate')
        : ''}
      isTurnActive={isTurnActive}
      isTurnFinalizing={isTurnFinalizing}
      isAcceptancePending={isAcceptancePending}
      isSubmissionUnresolved={isSubmissionUnresolved}
      submissionFeedback={submissionFeedback}
      canCheckSubmissionStatus={canCheckSubmissionStatus}
      onCheckSubmissionStatus={actions.onCheckSubmissionStatus}
      onInsertText={actions.onInsertText}
      onAddAttachment={actions.onAddAttachment}
      onWarmIntent={actions.onWarmIntent}
      contextUsage={contextUsage}
      tokenUsage={tokenUsage}
      threadId={hasThread ? threadId : null}
      attachments={attachments}
      onRemoveAttachment={handleRemoveAttachment}
      composerDraft={composerDraft}
      onComposerDraftChange={handleDraftChange}
      modelSelection={composer.modelSelection}
      onModelSelectionChange={actions.onModelSelectionChange}
      screenshotOwner={hasThread ? {
        workspaceId,
        threadId,
        surface: 'primary',
      } : null}
    />
  );
});
