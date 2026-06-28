/**
 * MessageList — Pure routing between Live and Instant renderers.
 *
 * History messages → InstantSegmentRenderer (collapsed, no animation)
 * Current turn     → LiveSegmentRenderer (orb gatekeeper → animated typing)
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ TURN FINALIZATION HANDOFF                                       │
 * │                                                                 │
 * │ This component bridges the store (pendingTurnEnd) and the       │
 * │ renderer (onRevealComplete callback).                           │
 * │                                                                 │
 * │ When pendingTurnEnd is true (turn_end received from API),       │
 * │ onRevealComplete is set to finalizeTurn. LiveSegmentRenderer    │
 * │ calls it when ALL segments have finished revealing.             │
 * │                                                                 │
 * │ The callback can arrive in EITHER ORDER:                        │
 * │   - turn_end first, then renderer catches up → works           │
 * │   - Renderer done first, then turn_end arrives → works         │
 * │                                                                 │
 * │ See LiveSegmentRenderer.tsx for the completion detection logic  │
 * │ that makes both orderings safe.                                 │
 * │                                                                 │
 * │ CRITICAL: onRevealComplete must be undefined (not a no-op)      │
 * │ when pendingTurnEnd is false. LiveSegmentRenderer uses the      │
 * │ presence/absence of this prop as part of its completion gate.   │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { usePanelStore } from '../state/panelStore';
import type { Message, AssistantTurn, StreamSegment } from '../types';
import { LiveSegmentRenderer } from './LiveSegmentRenderer';
import { InstantSegmentRenderer } from './InstantSegmentRenderer';
import { extractAssistantReplyText } from '../lib/chat/reply-text';
import { AssistantReplyChrome } from './chat/AssistantReplyChrome';
import { AssistantReplyBookmarkModal } from './chat/AssistantReplyBookmarkModal';
import { useAssistantReplyChromeController } from './chat/useAssistantReplyChromeController';

interface MessageListProps {
  // PER_THREAD_CHAT_STATE: primary passes the current workspace thread;
  // secondary passes secondary.threadId.
  threadId: string | null;
  messages: Message[];
  currentTurn: AssistantTurn | null;
  segments: StreamSegment[];
  lastUserMsgRef?: React.RefObject<HTMLDivElement | null>;
  showOrb?: boolean;
}

function CompletedAssistantReplyChrome({
  threadId,
  message,
}: {
  threadId: string;
  message: Message;
}) {
  const source = {
    threadId,
    messageId: message.id,
    exchangeSeq: message.exchangeSeq,
    exchangeId: message.exchangeId,
  };
  const payload = extractAssistantReplyText(message.segments);
  const disabled = !message.exchangeId;
  const {
    metadata,
    bookmarkModalProps,
    handleCopyChatId,
    handleCopyReply,
    openBookmarkEditor,
  } = useAssistantReplyChromeController({
    source,
    payload,
    metadata: message.metadata,
    disabled,
  });

  return (
    <div className="rv-assistant-reply-shell">
      <AssistantReplyChrome
        source={source}
        payload={payload}
        metadata={metadata}
        disabled={disabled}
        onCopyReply={handleCopyReply}
        onOpenBookmark={openBookmarkEditor}
        onCopyChatId={handleCopyChatId}
      />
      <AssistantReplyBookmarkModal {...bookmarkModalProps} />
    </div>
  );
}

export function MessageList({
  threadId,
  messages,
  currentTurn,
  segments,
  lastUserMsgRef,
  showOrb,
}: MessageListProps) {
  // PER_THREAD_CHAT_STATE: pendingTurnEnd is keyed by threadId.
  const pendingTurnEnd = usePanelStore((s) =>
    threadId ? (s.projectChats[threadId]?.pendingTurnEnd ?? false) : false
  );
  const finalizeTurn = usePanelStore((s) => s.finalizeTurn);

  // CRITICAL: undefined when not pending, NOT a no-op function.
  // LiveSegmentRenderer's completion effect checks `if (!onRevealComplete) return;`
  const onRevealComplete = pendingTurnEnd ? () => finalizeTurn(threadId) : undefined;

  // Find the last user rv-message index for scroll anchoring
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'user') { lastUserIdx = i; break; }
  }

  return (
    <>
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          ref={i === lastUserIdx ? lastUserMsgRef : undefined}
          className={`rv-message rv-message-${msg.type}`}
        >
          {msg.type === 'user' ? (
            <div className="rv-message-user-content">{msg.content}</div>
          ) : msg.type === 'assistant' && threadId ? (
            <>
              <InstantSegmentRenderer segments={msg.segments} />
              <CompletedAssistantReplyChrome threadId={threadId} message={msg} />
            </>
          ) : (
            <InstantSegmentRenderer segments={msg.segments} />
          )}
        </div>
      ))}

      {(currentTurn || showOrb) && (
        <div
          key={currentTurn?.id ?? 'pending-assistant-turn'}
          className="rv-message rv-message-assistant"
        >
          <LiveSegmentRenderer
            turnId={currentTurn?.id}
            segments={segments}
            onRevealComplete={onRevealComplete}
          />
        </div>
      )}
    </>
  );
}
