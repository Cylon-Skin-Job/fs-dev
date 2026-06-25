import { usePanelStore } from '../../state/panelStore';
import type { WebSocketMessage } from '../../types';

/**
 * Read the active chat state slot for a threadId.
 * PER_THREAD_CHAT_STATE: chat slots are keyed by threadId.
 */
function readChatState(threadId: string) {
  const state = usePanelStore.getState();
  return state.projectChats[threadId];
}

export function handleTurnBegin(
  msg: WebSocketMessage,
  threadId: string,
  resetTransientStreamState: () => void,
): void {
  const store = usePanelStore.getState();
  console.log('[WS] Turn begin threadId=', threadId?.slice(0, 8));
  // Safety net: if the previous turn wasn't finalized (edge case —
  // finalizeTurn normally handles this), snapshot it now. In the
  // normal flow, currentTurn is already null by this point because
  // finalizeTurn cleared it.
  const chatState = readChatState(threadId);
  if (chatState) {
    const prevTurn = chatState.currentTurn;
    const segments = chatState.segments;

    if (prevTurn) {
      console.warn('[WS] turn_begin: previous turn was not finalized — snapshotting now');
      store.addMessage(threadId, {
        id: prevTurn.id,
        type: 'assistant',
        content: prevTurn.content,
        timestamp: Date.now(),
        segments: segments.length > 0 ? [...segments] : undefined,
      });
    }
  }

  store.resetSegments(threadId);
  resetTransientStreamState();

  // CRITICAL: Clear pendingTurnEnd from the PREVIOUS turn.
  //
  // If the old turn's renderer hadn't finished revealing when this
  // turn_begin arrives, pendingTurnEnd is still true. Without this
  // clear, the NEW turn would inherit it — causing premature
  // finalization as soon as the first segment of the new turn
  // finishes revealing.
  //
  // KNOWN PAST BUG (DO NOT REMOVE):
  // Omitting this line caused new turns to finalize immediately
  // after their first segment, because the stale pendingTurnEnd
  // from the previous turn was still set.
  store.setPendingTurnEnd(threadId, false);
  store.setPendingExchangeSave(threadId, null);

  store.setCurrentTurn(threadId, {
    id: msg.turnId || '',
    content: '',
    status: 'streaming',
    hasThinking: false,
    thinkingContent: '',
  });
}

export function handleTurnEnd(msg: WebSocketMessage, threadId: string): void {
  const store = usePanelStore.getState();
  // turn_end signals that the API has finished producing content.
  // Normal completion keeps the paced reveal gate: set pendingTurnEnd and
  // let LiveSegmentRenderer finalize after it catches up.
  //
  // Interrupted/error terminal turns mimic CLI Escape: flush immediately
  // into history so Stop does not sit behind typing/collapse delays.
  //
  // LIFECYCLE:
  //   turn_end arrives → setPendingTurnEnd(true)
  //                    → MessageList passes onRevealComplete to LiveSegmentRenderer
  //                    → LiveSegmentRenderer's completion effect checks:
  //                        revealedCount >= segments.length AND onRevealComplete defined
  //                    → When both true: finalizeTurn() fires ONCE
  //                    → currentTurn.status = 'complete', pendingTurnEnd = false
  //
  // EITHER ORDER IS SAFE:
  //   Stream finishes first: pendingTurnEnd set, renderer catches up later, effect fires.
  //   Renderer catches up first: all revealed, then turn_end arrives, effect fires.
  //
  // See LiveSegmentRenderer.tsx completion detection comments for the
  // full explanation of why this is an effect and not a callback.
  const currentTurn = readChatState(threadId)?.currentTurn;

  if (currentTurn) {
    const flushImmediately = msg.partial === true ||
      msg.reason === 'interrupted' ||
      msg.reason === 'error';

    // Mark last segment complete (closing tag) so reveal knows it's done
    const segs = readChatState(threadId)?.segments || [];
    if (segs.length > 0) {
      const lastSeg = segs[segs.length - 1];
      if (!lastSeg.complete) {
        store.updateLastSegment(threadId, { complete: true });
      }
    }
    store.setPendingTurnEnd(threadId, true);
    store.setPendingExchangeSave(threadId, msg.turnId || currentTurn.id);
    window.dispatchEvent(new CustomEvent('fusion:turn-ended', {
      detail: { threadId, reason: msg.reason, partial: msg.partial },
    }));

    if (flushImmediately) {
      store.finalizeTurn(threadId);
    }
  }
}
