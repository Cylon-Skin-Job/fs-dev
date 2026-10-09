/**
 * MessageList — Pure routing between Live and Instant renderers.
 *
 * Completed/history messages → InstantSegmentRenderer + message reply chrome
 * Snapshot catch-up baseline → InstantSegmentRenderer only (still unfinished)
 * Current turn              → LiveSegmentRenderer (orb → animated typing)
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

import { memo } from 'react';
import { usePanelStore } from '../state/panelStore';
import type { Message, AssistantTurn, StreamSegment } from '../types';
import { LiveSegmentRenderer } from './LiveSegmentRenderer';
import { InstantSegmentRenderer } from './InstantSegmentRenderer';
import { extractAssistantReplyText } from '../lib/chat/reply-text';
import { readMessageTerminalError } from '../lib/chat/terminal-error';
import { ChatTurnError } from './chat/ChatTurnError';
import { ChatDiagnosticDetails } from './chat/ChatDiagnosticDetails';
import { AssistantReplyChrome } from './chat/AssistantReplyChrome';
import { AssistantReplyBookmarkModal } from './chat/AssistantReplyBookmarkModal';
import { useAssistantReplyChromeController } from './chat/useAssistantReplyChromeController';
import type { ChatDiagnosticRouteIds } from '../lib/ws/chat-diagnostic-handlers';
import type { ValidatedChatTurnDiagnosticReport } from '../lib/chat/diagnostic-report';
import {
  messageContentRevision,
  messageMetadataRevision,
} from '../lib/chat/message-revisions';

interface MessageListProps {
  // PER_THREAD_CHAT_STATE: the mounted host passes its exact session's threadId.
  threadId: string | null;
  messages: Message[];
  currentTurn: AssistantTurn | null;
  segments: StreamSegment[];
  lastUserMsgRef?: React.RefObject<HTMLDivElement | null>;
  showOrb?: boolean;
  onRequestDiagnostic: (
    route: ChatDiagnosticRouteIds,
  ) => Promise<ValidatedChatTurnDiagnosticReport | null>;
  onCopyDiagnostic: (text: string) => Promise<void>;
  onAskAIWithDiagnostic: (text: string) => Promise<boolean | 'pending-acceptance'>;
  askAIWithDiagnosticEnabled: boolean;
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

/**
 * SPEC-05 Slice B (parent §4.13): ONE validated safe terminal error after all
 * accumulated output, before reply chrome — read through the single
 * client-boundary validation read (readMessageTerminalError), so the
 * immediate finalize-time envelope wins over the later saved-metadata
 * fallback and the two can never render together. A truly absent source
 * renders nothing; any present malformed value maps to the generic safe row.
 */
function AssistantTurnError({
  threadId,
  message,
  onRequestDiagnostic,
  onCopyDiagnostic,
  onAskAIWithDiagnostic,
  askAIWithDiagnosticEnabled,
}: {
  threadId: string | null;
  message: Message;
  onRequestDiagnostic: MessageListProps['onRequestDiagnostic'];
  onCopyDiagnostic: MessageListProps['onCopyDiagnostic'];
  onAskAIWithDiagnostic: MessageListProps['onAskAIWithDiagnostic'];
  askAIWithDiagnosticEnabled: boolean;
}) {
  const terminalError = readMessageTerminalError(message);
  if (!terminalError) return null;
  const metadataTurnId = message.metadata?.turnId;
  const turnId = typeof metadataTurnId === 'string' && metadataTurnId.length > 0
    ? metadataTurnId
    : message.id;
  return (
    <>
      <ChatTurnError error={terminalError} />
      {threadId && terminalError.diagnosticId ? (
        <ChatDiagnosticDetails
          threadId={threadId}
          turnId={turnId}
          diagnosticId={terminalError.diagnosticId}
          onRequest={onRequestDiagnostic}
          onCopy={onCopyDiagnostic}
          onAskAI={onAskAIWithDiagnostic}
          askAIEnabled={askAIWithDiagnosticEnabled}
        />
      ) : null}
    </>
  );
}

interface HistoryMessageRowProps {
  threadId: string | null;
  message: Message;
  isLastUser: boolean;
  lastUserMsgRef?: React.RefObject<HTMLDivElement | null>;
  onRequestDiagnostic: MessageListProps['onRequestDiagnostic'];
  onCopyDiagnostic: MessageListProps['onCopyDiagnostic'];
  onAskAIWithDiagnostic: MessageListProps['onAskAIWithDiagnostic'];
  askAIWithDiagnosticEnabled: boolean;
}

/**
 * One completed/history row owns its derived-render lifetime. Live frontier
 * updates leave both message revisions unchanged, so React skips the entire
 * row (including Markdown/tool formatting and local expansion state).
 */
const HistoryMessageRow = memo(function HistoryMessageRow({
  threadId,
  message,
  isLastUser,
  lastUserMsgRef,
  onRequestDiagnostic,
  onCopyDiagnostic,
  onAskAIWithDiagnostic,
  askAIWithDiagnosticEnabled,
}: HistoryMessageRowProps) {
  return (
    <div
      ref={isLastUser ? lastUserMsgRef : undefined}
      className={`rv-message rv-message-${message.type}`}
    >
      {message.type === 'user' ? (
        <div className="rv-message-user-content">{message.content}</div>
      ) : message.type === 'assistant' && threadId ? (
        <>
          <InstantSegmentRenderer segments={message.segments} />
          {message.projection !== 'in-flight-snapshot-baseline' ? (
            <>
              <AssistantTurnError
                threadId={threadId}
                message={message}
                onRequestDiagnostic={onRequestDiagnostic}
                onCopyDiagnostic={onCopyDiagnostic}
                onAskAIWithDiagnostic={onAskAIWithDiagnostic}
                askAIWithDiagnosticEnabled={askAIWithDiagnosticEnabled}
              />
              <CompletedAssistantReplyChrome threadId={threadId} message={message} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <InstantSegmentRenderer segments={message.segments} />
          {message.type === 'assistant' ? (
            <AssistantTurnError
              threadId={threadId}
              message={message}
              onRequestDiagnostic={onRequestDiagnostic}
              onCopyDiagnostic={onCopyDiagnostic}
              onAskAIWithDiagnostic={onAskAIWithDiagnostic}
              askAIWithDiagnosticEnabled={askAIWithDiagnosticEnabled}
            />
          ) : null}
        </>
      )}
    </div>
  );
}, (previous, next) => (
  previous.threadId === next.threadId
  && previous.message.id === next.message.id
  && (previous.message.contentRevision ?? messageContentRevision(previous.message))
    === (next.message.contentRevision ?? messageContentRevision(next.message))
  && (previous.message.metadataRevision ?? messageMetadataRevision(previous.message))
    === (next.message.metadataRevision ?? messageMetadataRevision(next.message))
  && previous.isLastUser === next.isLastUser
  && previous.lastUserMsgRef === next.lastUserMsgRef
  && previous.onRequestDiagnostic === next.onRequestDiagnostic
  && previous.onCopyDiagnostic === next.onCopyDiagnostic
  && previous.onAskAIWithDiagnostic === next.onAskAIWithDiagnostic
  && previous.askAIWithDiagnosticEnabled === next.askAIWithDiagnosticEnabled
));

export function MessageList({
  threadId,
  messages,
  currentTurn,
  segments,
  lastUserMsgRef,
  showOrb,
  onRequestDiagnostic,
  onCopyDiagnostic,
  onAskAIWithDiagnostic,
  askAIWithDiagnosticEnabled,
}: MessageListProps) {
  // PER_THREAD_CHAT_STATE: pendingTurnEnd is keyed by threadId.
  const pendingTurnEnd = usePanelStore((s) =>
    threadId ? (s.projectChats[threadId]?.pendingTurnEnd ?? false) : false
  );
  const finalizeTurn = usePanelStore((s) => s.finalizeTurn);

  // SPEC-05 Slice A: this thread's observable transient Working activity —
  // MessageList is the documented presentation routing point into the live
  // renderer; history rows never see it.
  const activity = usePanelStore((s) =>
    threadId ? (s.projectChats[threadId]?.activity ?? null) : null
  );

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
        <HistoryMessageRow
          key={msg.id}
          threadId={threadId}
          message={msg}
          isLastUser={i === lastUserIdx}
          lastUserMsgRef={lastUserMsgRef}
          onRequestDiagnostic={onRequestDiagnostic}
          onCopyDiagnostic={onCopyDiagnostic}
          onAskAIWithDiagnostic={onAskAIWithDiagnostic}
          askAIWithDiagnosticEnabled={askAIWithDiagnosticEnabled}
        />
      ))}

      {(currentTurn || showOrb) && (
        <div
          key={currentTurn?.id ?? 'pending-assistant-turn'}
          className="rv-message rv-message-assistant"
        >
          <LiveSegmentRenderer
            turnId={currentTurn?.id}
            segments={segments}
            activity={activity}
            onRevealComplete={onRevealComplete}
          />
        </div>
      )}
    </>
  );
}
