/** Exact-thread history/live leaf; live revisions never invalidate its parent. */
import { memo, useEffect } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../../state/chatSubmissionStore';
import { MessageList } from '../MessageList';
import { ConnectingOverlay } from '../ConnectingOverlay';
import { TodoDrawer } from './TodoDrawer';
import { EMPTY_MESSAGES, EMPTY_SEGMENTS, selectChatState } from './chatAreaConstants';
import type { ChatSurfaceActions, ChatSurfaceRefs } from './chatSurfaceContract';

interface ConnectedChatHistoryProps {
  workspaceId: string;
  threadId: string;
  hasThread: boolean;
  connectingHarnessName: string | null;
  isSendingForCurrentThread: boolean;
  actions: ChatSurfaceActions;
  refs: ChatSurfaceRefs;
  scrollId: string;
}

export const ConnectedChatHistory = memo(function ConnectedChatHistory({
  workspaceId,
  threadId,
  hasThread,
  connectingHarnessName,
  isSendingForCurrentThread,
  actions,
  refs,
  scrollId,
}: ConnectedChatHistoryProps) {
  const selector = selectChatState(hasThread ? threadId : null);
  const messages = usePanelStore((state) => selector(state)?.messages ?? EMPTY_MESSAGES);
  const currentTurn = usePanelStore((state) => selector(state)?.currentTurn ?? null);
  const segments = usePanelStore((state) => selector(state)?.segments ?? EMPTY_SEGMENTS);
  const pendingTurnEnd = usePanelStore((state) => selector(state)?.pendingTurnEnd ?? false);
  const pendingExchangeSaveTurnId = usePanelStore(
    (state) => selector(state)?.pendingExchangeSaveTurnId ?? null,
  );
  const submissionPhase = useChatSubmissionStore((state) => (
    workspaceId && hasThread
      ? state.attemptsByOwner[chatSubmissionOwnerKey(workspaceId, threadId)]?.phase
      : undefined
  ));

  const isTurnFinalizing = Boolean(pendingTurnEnd || pendingExchangeSaveTurnId);
  const showOrb = (isSendingForCurrentThread || currentTurn?.status === 'streaming')
    && segments.length === 0 && !isTurnFinalizing;
  const showEmptyState = messages.length === 0 && !currentTurn && !showOrb;

  useEffect(() => {
    if (isSendingForCurrentThread && refs.lastUserMsgRef.current) {
      refs.lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isSendingForCurrentThread, messages.length, refs.lastUserMsgRef]);

  return (
    <div className="rv-chat-messages">
      <div className="rv-chat-scroll-viewport" id={scrollId} ref={refs.scrollRef}>
        {connectingHarnessName ? (
          <ConnectingOverlay harnessName={connectingHarnessName} />
        ) : showEmptyState ? (
          <div className="rv-message rv-message-system">
            {hasThread ? 'Start a conversation' : 'No thread selected'}
          </div>
        ) : (
          <MessageList
            threadId={threadId}
            messages={messages}
            currentTurn={currentTurn}
            segments={segments}
            lastUserMsgRef={refs.lastUserMsgRef}
            showOrb={showOrb}
            onRequestDiagnostic={actions.onRequestDiagnostic}
            onCopyDiagnostic={actions.onCopyDiagnostic}
            onAskAIWithDiagnostic={actions.onAskAIWithDiagnostic}
            askAIWithDiagnosticEnabled={submissionPhase !== 'pending'}
          />
        )}
        {hasThread && <div className="rv-chat-scroll-sentinel" />}
      </div>
      <TodoDrawer threadId={threadId} />
    </div>
  );
});
