/** Exact-session history hydration and saved/live transcript conversion. */
import { usePanelStore } from '../../state/panelStore';
import { useChatFileLinkStore } from '../../state/chatFileLinkStore';
import { useFileStore } from '../../state/fileStore';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../../state/chatSubmissionStore';
import { finishAcceptedPromptExecution } from '../chat/prompt-submission-recovery';
import { readTokenUsage } from '../chat/context-usage';
import { sanitizeTerminalErrorMetadata } from '../chat/terminal-error';
import { convertPartToSegment } from './assistant-parts';
import { installLiveTurnSnapshot } from './snapshot-restore';
import { getCurrentThreadGroupId, matchesPendingThreadOpen } from '../../state/slices/chatSurfaceSlice';
import type { WebSocketMessage, ExchangeData, LiveTurnSnapshot } from '../../types';

export const hydrateThreadCandidates = (exchanges: ExchangeData[] | undefined) => {
    const openTabPaths = useFileStore.getState().tabs
      .filter((tab) => tab.kind === 'file')
      .map((tab) => tab.file.path);
    useChatFileLinkStore.getState().hydrateThreadAutocompleteCandidates(
      (exchanges || []).map((exchange) => ({
        ...exchange,
        metadata: sanitizeTerminalErrorMetadata(exchange.metadata),
      })),
      openTabPaths,
    );
  };

export function hydrateOpenedThread(msg: WebSocketMessage): void {
  const store = usePanelStore.getState();
      console.log('[WS] thread:opened:', msg.threadId?.slice(0, 8), 'exchanges:', msg.exchanges?.length, 'history:', msg.history?.length, 'contextUsage:', msg.contextUsage);
      if (msg.threadId && msg.thread) {
        // SPEC-02 §6.1/§6.2 late-response discipline: a `thread:opened` may
        // change only its own population's visible selection, and only when it
        // matches this client's correlated open request or the already-selected
        // group. A late response for another population still hydrates THAT
        // session's slot precisely (all mutations below are keyed by
        // `msg.threadId`) but can never steal another population's selection.
        const responseWorkspaceId = typeof msg.workspaceId === 'string' && msg.workspaceId
          ? msg.workspaceId
          : store.activeWorkspaceId;
        const responseViewId: string | null = msg.viewId ?? null;
        const matchesPendingOpen = matchesPendingThreadOpen(
          store,
          { workspaceId: responseWorkspaceId, viewId: responseViewId },
          { threadId: msg.threadId, threadGroupId: msg.threadGroupId },
        );
        if (!msg.historyOnly && responseViewId === null) {
          const shouldSelectLegacy = msg.requestId
            ? matchesPendingOpen
            : store.currentThreadId === msg.threadId || matchesPendingOpen || !store.currentThreadId;
          if (shouldSelectLegacy) {
            store.setCurrentThreadId(msg.threadId);
            store.setChatActive(true);
            if (responseWorkspaceId && msg.threadGroupId) {
              store.setCurrentThreadGroupId(responseWorkspaceId, null, msg.threadGroupId);
            }
          }
        } else if (!msg.historyOnly && responseWorkspaceId) {
          const currentGroupId = getCurrentThreadGroupId(
            store,
            responseWorkspaceId,
            responseViewId,
          );
          const shouldSelectView = msg.requestId
            ? matchesPendingOpen
            : (!!msg.threadGroupId && currentGroupId === msg.threadGroupId)
              || matchesPendingOpen || !currentGroupId;
          if (shouldSelectView && msg.threadGroupId) {
            store.setCurrentThreadGroupId(
              responseWorkspaceId,
              responseViewId,
              msg.threadGroupId,
            );
          }
        }
        if (!msg.historyOnly) store.consumeThreadOpen(
          { workspaceId: responseWorkspaceId, viewId: responseViewId },
          { threadId: msg.threadId, threadGroupId: msg.threadGroupId },
        );

        // Keep server-issued user bubbles whose exchange may not yet have
        // saved. More than one accepted attempt can be awaiting canonical
        // exchange persistence; the session attempt store holds only the
        // latest one, while this slot holds their distinct turn identities.
        const acceptedBubbles = responseWorkspaceId === store.activeWorkspaceId
          ? (store.projectChats[msg.threadId]?.messages ?? []).filter((message) => (
            message.type === 'user' && message.id.startsWith('user-')
          )) : [];
        // PER_THREAD_CHAT_STATE: clear then hydrate this exact thread's slot.
        store.clearChat(msg.threadId);
        store.hydrateHarnessSelection(
          msg.threadId,
          msg.thread?.harnessConfig,
          msg.thread?.harnessId ?? null,
        );
        hydrateThreadCandidates(msg.exchanges || []);

        if (msg.exchanges && msg.exchanges.length > 0) {
          console.log('[WS] Loading', msg.exchanges.length, 'exchanges (rich format)');
          convertExchangesToMessages(msg.threadId, msg.exchanges);
        } else if (msg.history && msg.history.length > 0) {
          console.log('[WS] Loading', msg.history.length, 'messages (legacy format)');
          convertHistoryToMessages(msg.threadId, msg.history);
        }
        // A status-reconciled admission may beat this passive open response.
        // Keep all server-issued unsaved user identities until an exchange
        // with that turnId replaces each one; never infer from equal text.
        if (responseWorkspaceId && responseWorkspaceId === store.activeWorkspaceId) {
          const accepted = useChatSubmissionStore.getState().attemptsByOwner[
            chatSubmissionOwnerKey(responseWorkspaceId, msg.threadId)
          ];
          if (accepted?.phase === 'accepted' && accepted.turnId
            && !acceptedBubbles.some((message) => message.id === `user-${accepted.turnId}`)) {
            acceptedBubbles.push({ id: `user-${accepted.turnId}`, type: 'user',
              content: accepted.text, timestamp: Date.now() });
          }
          for (const bubble of acceptedBubbles) {
            if (usePanelStore.getState().projectChats[msg.threadId]?.messages.some(
              (message) => message.id === bubble.id)) continue;
            store.addMessage(msg.threadId, bubble);
          }
        }
        overlayLiveTurn(msg.threadId, msg.liveTurn, msg.exchanges);
        if (responseWorkspaceId && typeof msg.liveTurn?.turnId === 'string'
          && usePanelStore.getState().projectChats[msg.threadId]?.currentTurn?.id === msg.liveTurn.turnId) {
          finishAcceptedPromptExecution(responseWorkspaceId, msg.threadId, msg.liveTurn.turnId);
        }
        if (responseWorkspaceId) {
          const acceptedTurnId = useChatSubmissionStore.getState().attemptsByOwner[
            chatSubmissionOwnerKey(responseWorkspaceId, msg.threadId)]?.turnId;
          if (acceptedTurnId && msg.exchanges?.some((exchange) => exchange.metadata?.turnId === acceptedTurnId)) {
            finishAcceptedPromptExecution(responseWorkspaceId, msg.threadId, acceptedTurnId);
          }
        }
        restoreContextSnapshot(msg.threadId, msg.exchanges, msg.contextUsage, msg.tokenUsage);
      }
}

function convertExchangesToMessages(threadId: string, exchanges: ExchangeData[]) {
  const store = usePanelStore.getState();
  exchanges.forEach((exchange, idx) => {
    const turnId = typeof exchange.metadata?.turnId === 'string' ? exchange.metadata.turnId : null;
    store.addMessage(threadId, {
      id: turnId ? `user-${turnId}` : `ex-${idx}-user`,
      type: 'user',
      content: exchange.user,
      timestamp: exchange.ts,
    });

    const segments = exchange.assistant.parts.map((part) => convertPartToSegment(part));
    const assistantContent = exchange.assistant.parts
      .filter((p): p is { type: 'text'; content: string } => p.type === 'text')
      .map((p) => p.content)
      .join('');

    store.addMessage(threadId, {
      id: exchange.exchangeId ? `exchange-${exchange.exchangeId}-assistant` : `ex-${idx}-assistant`,
      type: 'assistant',
      content: assistantContent,
      timestamp: exchange.ts,
      segments: segments.length > 0 ? segments : undefined,
      exchangeId: exchange.exchangeId,
      exchangeSeq: exchange.seq,
      metadata: sanitizeTerminalErrorMetadata(exchange.metadata),
    });
  });
}

function convertHistoryToMessages(
  threadId: string,
  history: { role: 'user' | 'assistant'; content: string; hasToolCalls?: boolean }[],
) {
  const store = usePanelStore.getState();
  history.forEach((h, idx) => {
    store.addMessage(threadId, {
      id: `hist-${idx}`,
      type: h.role,
      content: h.content,
      timestamp: Date.now() - (history.length - idx) * 1000,
    });
  });
}

function restoreContextSnapshot(
  threadId: string,
  exchanges: ExchangeData[] | undefined,
  messageContextUsage?: number,
  messageTokenUsage?: unknown,
) {
  const lastExchange = exchanges?.[exchanges.length - 1];
  const metadataContextUsage = lastExchange?.metadata?.contextUsage;
  const contextUsage = typeof messageContextUsage === 'number'
    ? messageContextUsage
    : typeof metadataContextUsage === 'number'
      ? metadataContextUsage
      : 0;
  const tokenUsage = readTokenUsage(messageTokenUsage)
    ?? readTokenUsage(lastExchange?.metadata?.tokenUsage);
  const store = usePanelStore.getState();
  console.log('[WS] Restoring context snapshot:', { threadId, contextUsage, tokenUsage });
  // SPEC-02 §6.2: usage is session-owned by exact threadId. The workspace
  // global fields remain only as a compatibility mirror for the currently
  // selected session.
  store.setThreadContextUsage(threadId, contextUsage);
  store.setThreadTokenUsage(threadId, tokenUsage);
  if (store.currentThreadId === threadId) {
    store.setContextUsage(contextUsage);
    store.setTokenUsage(tokenUsage);
  }
}

/**
 * Overlay the served live turn onto the hydrated chat slot (thread:opened).
 * Slice C delegates all restoration semantics to snapshot-restore.ts: status
 * routing, monotone per-pair authority, atomic in-flight already-revealed
 * install, terminal instant path, and retained terminal-error envelopes live
 * there now.
 */
function overlayLiveTurn(
  threadId: string,
  liveTurn: LiveTurnSnapshot | null | undefined,
  exchanges: ExchangeData[] | undefined,
): void {
  installLiveTurnSnapshot(threadId, liveTurn, exchanges);
}
