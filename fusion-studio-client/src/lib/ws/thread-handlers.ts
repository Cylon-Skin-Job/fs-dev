/**
 * @module thread-handlers
 * @role Handle thread-related WebSocket messages (CRUD, history conversion).
 *
 * Extracted from ws-client.ts (spec 05b) so thread logic is isolated.
 * RCC-0095: single workspace chat — all routing is by threadId. The server
 * still stamps scope: 'project' on the wire; the client ignores it.
 */

import { usePanelStore } from '../../state/panelStore';
import { useWorkspaceStore } from '../../state/workspaceStore';
import { useChatFileLinkStore } from '../../state/chatFileLinkStore';
import { useChatComposerDraftStore } from '../../state/chatComposerDraftStore';
import { useFileStore } from '../../state/fileStore';
import { loadRootTree } from '../file-tree';
import { secondaryTracker } from '../secondary-tracker';
import { readTokenUsage } from '../chat/context-usage';
import { sanitizeTerminalErrorMetadata } from '../chat/terminal-error';
import { convertPartToSegment } from './assistant-parts';
import { installLiveTurnSnapshot } from './snapshot-restore';
import type { WebSocketMessage, ExchangeData, LiveTurnSnapshot } from '../../types';

/**
 * Handle thread-related WebSocket messages.
 * Returns true if the message was handled, false if not recognized.
 */
export function handleThreadMessage(msg: WebSocketMessage): boolean {
  const store = usePanelStore.getState();
  const hydrateThreadCandidates = (exchanges: ExchangeData[] | undefined) => {
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

  switch (msg.type) {
    case 'thread:list':
      console.log('[WS] thread:list received:', msg.threads?.length, 'threads');
      if (msg.threads) {
        store.setThreads(msg.threads);
        if (!useWorkspaceStore.getState().hasReceivedInit) {
          console.log('[WS] Deferring MRU thread open until workspace:init');
          return true;
        }
        // Auto-open the MRU (top) thread when none is active. Fills the chat
        // on refresh even when the threads sidebar is hidden.
        const hasActive = store.currentThreadId;
        if (!hasActive && msg.threads.length > 0) {
          const mru = msg.threads[0];
          const ws = store.ws;
          if (ws && ws.readyState === WebSocket.OPEN && mru.threadId) {
            console.log('[WS] Auto-opening MRU thread:', mru.threadId.slice(0, 8));
            // Multiple panels request the same thread list during boot.
            // Mark the MRU as active before the server responds so only the
            // first list response sends thread:open.
            store.setCurrentThreadId(mru.threadId);
            ws.send(JSON.stringify({
              type: 'thread:open',
              threadId: mru.threadId,
            }));
          }
        }
      }
      return true;

    case 'thread:created':
      console.log('[WS] thread:created received:', msg.threadId);
      if (msg.thread && msg.threadId) {
        store.addThread({ threadId: msg.threadId, entry: msg.thread });
        store.setCurrentThreadId(msg.threadId);
        store.setChatActive(true);
        // PER_THREAD_CHAT_STATE: clear this thread's slot specifically.
        store.clearChat(msg.threadId);
        store.setContextUsage(0);
        store.setTokenUsage(null);
        hydrateThreadCandidates([]);
        loadRootTree();
      } else {
        console.error('[WS] thread:created missing data:', msg);
      }
      return true;

    case 'thread:forked':
      console.log('[WS] thread:forked received:', msg.threadId, 'exchanges:', msg.exchanges?.length);
      if (msg.thread && msg.threadId) {
        upsertThreadAtTop(msg.threadId, msg.thread);
        store.setCurrentThreadId(msg.threadId);
        store.setChatActive(true);
        store.clearChat(msg.threadId);
        hydrateThreadCandidates(msg.exchanges || []);

        if (msg.exchanges && msg.exchanges.length > 0) {
          convertExchangesToMessages(msg.threadId, msg.exchanges);
        } else if (msg.history && msg.history.length > 0) {
          convertHistoryToMessages(msg.threadId, msg.history);
        }
        overlayLiveTurn(msg.threadId, msg.liveTurn, msg.exchanges);
        restoreContextSnapshot(msg.exchanges, msg.contextUsage, msg.tokenUsage);
      } else {
        console.error('[WS] thread:forked missing data:', msg);
      }
      return true;

    case 'thread:opened': {
      console.log('[WS] thread:opened:', msg.threadId?.slice(0, 8), 'exchanges:', msg.exchanges?.length, 'history:', msg.history?.length, 'contextUsage:', msg.contextUsage);
      if (msg.threadId && msg.thread) {
        // SECONDARY_CHAT_SPEC: if this thread:opened is for the secondary's
        // thread, hydrate its chat slot but do NOT touch primary state.
        // Check both the live secondary state AND the secondary tracker —
        // the tracker catches the race where the user clicks red before the
        // server's response arrives (secondary is already null, but the
        // response was originally intended for the secondary and must not
        // hijack the primary's current thread).
        const isForSecondary =
          store.secondary?.threadId === msg.threadId ||
          secondaryTracker.has(msg.threadId);

        if (isForSecondary) {
          secondaryTracker.unmark(msg.threadId);
          store.clearChat(msg.threadId);
          if (msg.exchanges && msg.exchanges.length > 0) {
            convertExchangesToMessages(msg.threadId, msg.exchanges);
          } else if (msg.history && msg.history.length > 0) {
            convertHistoryToMessages(msg.threadId, msg.history);
          }
          overlayLiveTurn(msg.threadId, msg.liveTurn, msg.exchanges);
          return true;
        }

        store.setCurrentThreadId(msg.threadId);
        store.setChatActive(true);
        // PER_THREAD_CHAT_STATE: clear then hydrate this thread's slot.
        store.clearChat(msg.threadId);
        hydrateThreadCandidates(msg.exchanges || []);

        if (msg.exchanges && msg.exchanges.length > 0) {
          console.log('[WS] Loading', msg.exchanges.length, 'exchanges (rich format)');
          convertExchangesToMessages(msg.threadId, msg.exchanges);
        } else if (msg.history && msg.history.length > 0) {
          console.log('[WS] Loading', msg.history.length, 'messages (legacy format)');
          convertHistoryToMessages(msg.threadId, msg.history);
        }
        overlayLiveTurn(msg.threadId, msg.liveTurn, msg.exchanges);
        restoreContextSnapshot(msg.exchanges, msg.contextUsage, msg.tokenUsage);
      }
      return true;
    }

    case 'wire_ready':
      store.setChatActive(true);
      store.setWireReady(true);
      return true;

    case 'thread:renamed':
      if (msg.threadId && msg.name) {
        store.updateThread(msg.threadId, { name: msg.name });
      }
      return true;

    case 'thread:deleted':
      if (msg.threadId) {
        store.removeThread(msg.threadId);
      }
      return true;

    case 'message:sent':
      console.log('[WS] Message accepted and saved to thread');
      if (msg.threadId && typeof msg.content === 'string') {
        const isOwnedThread = store.currentThreadId === msg.threadId
          || store.secondary?.threadId === msg.threadId
          || store.threads.some((thread) => thread.threadId === msg.threadId);
        // A late acknowledgement for a deleted or previous-workspace thread
        // must not recreate chat state in the active workspace. Legitimate
        // current threads still commit their server-owned user bubble even
        // when a remount/reload no longer has a local pending marker.
        if (!isOwnedThread) return true;
        const pendingPrompt = store.projectChats[msg.threadId]?.pendingPromptAcceptance;
        const pendingPromptMatched = pendingPrompt?.text === msg.content
          && pendingPrompt.workspaceId === store.activeWorkspaceId;
        if (pendingPromptMatched) {
          store.setPendingPromptAcceptance(msg.threadId, null);
          store.setPromptRetryDraft(msg.threadId, null);
          useChatFileLinkStore.getState().removePendingAttachments(
            pendingPrompt.workspaceId,
            msg.threadId,
            pendingPrompt.attachmentIds,
          );
        }
        store.addMessage(msg.threadId, {
          id: `user-${Date.now()}`,
          type: 'user',
          content: msg.content,
          timestamp: Date.now(),
        });
        window.dispatchEvent(new CustomEvent('fusion:prompt-accepted', {
          detail: {
            threadId: msg.threadId,
            content: msg.content,
            pendingPromptMatched,
            pendingPromptComposerText: pendingPromptMatched
              ? pendingPrompt.composerText
              : undefined,
          },
        }));
        // The durable owner must clear even when its composer is unmounted or
        // another thread is visible. Dispatch first so a mounted exact owner
        // can perform its existing local scroll/clear lifecycle unchanged.
        if (pendingPromptMatched) {
          useChatComposerDraftStore.getState().clearDraft(
            pendingPrompt.workspaceId,
            msg.threadId,
          );
        }
      }
      return true;

    default:
      return false;
  }
}

// --- History conversion helpers (private to this module) ---

function upsertThreadAtTop(threadId: string, entry: NonNullable<WebSocketMessage['thread']>) {
  const store = usePanelStore.getState();
  store.setThreads([
    { threadId, entry },
    ...store.threads.filter((thread) => thread.threadId !== threadId),
  ]);
}

function convertExchangesToMessages(threadId: string, exchanges: ExchangeData[]) {
  const store = usePanelStore.getState();
  exchanges.forEach((exchange, idx) => {
    store.addMessage(threadId, {
      id: `ex-${idx}-user`,
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
  console.log('[WS] Restoring context snapshot:', { contextUsage, tokenUsage });
  store.setContextUsage(contextUsage);
  store.setTokenUsage(tokenUsage);
}

/**
 * Overlay the served live turn onto the hydrated chat slot (thread:opened /
 * thread:forked). Slice C delegates ALL restoration semantics to
 * snapshot-restore.ts: status routing, monotone per-pair authority, atomic
 * in-flight already-revealed install, terminal instant path, and retained
 * terminal-error envelopes live there now.
 */
function overlayLiveTurn(
  threadId: string,
  liveTurn: LiveTurnSnapshot | null | undefined,
  exchanges: ExchangeData[] | undefined,
): void {
  installLiveTurnSnapshot(threadId, liveTurn, exchanges);
}
