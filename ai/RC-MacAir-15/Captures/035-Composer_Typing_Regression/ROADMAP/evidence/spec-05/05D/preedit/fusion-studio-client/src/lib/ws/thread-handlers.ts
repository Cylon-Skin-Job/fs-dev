/**
 * @module thread-handlers
 * @role Handle thread-related WebSocket messages (CRUD, history conversion).
 *
 * Extracted from ws-client.ts (spec 05b) so thread logic is isolated.
 * RCC-0095: single workspace chat — all routing is by threadId. The server
 * still stamps scope: 'project' on the wire; the client ignores it.
 */

import { usePanelStore } from '../../state/panelStore';
import { useChatFileLinkStore } from '../../state/chatFileLinkStore';
import { useChatComposerDraftStore } from '../../state/chatComposerDraftStore';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../../state/chatSubmissionStore';
import { finishAcceptedPromptExecution, settlePromptRecovery, trackAcceptedPromptExecution } from '../chat/prompt-submission-recovery';
import { useFileStore } from '../../state/fileStore';
import { loadRootTree, loadFileContent } from '../file-tree';
import { readTokenUsage } from '../chat/context-usage';
import { sanitizeTerminalErrorMetadata } from '../chat/terminal-error';
import { showToast } from '../toast';
import { convertPartToSegment } from './assistant-parts';
import { installLiveTurnSnapshot } from './snapshot-restore';
import { threadRowsFromProjections } from './threadGroupRows';
import {
  getCurrentThreadGroupId,
  matchesPendingThreadOpen,
} from '../../state/slices/chatSurfaceSlice';
import { requestWorksurfaceEntryRead } from '../worksurface/worksurfaceController';
import { isSideChatCapableView } from '../worksurface/sideChatViews';
import type { WebSocketMessage, ExchangeData, LiveTurnSnapshot, Thread } from '../../types';

/**
 * True when any visible group population names `threadId` as its current
 * primary (the replacement Main Chat of an accepted Move). Used only to admit a
 * live frame for an exact owned session; it never invents state.
 */
function isGroupPrimaryThread(
  store: ReturnType<typeof usePanelStore.getState>,
  threadId: string,
): boolean {
  const composite = store.threadGroupsByWorkspaceAndView ?? {};
  for (const byView of Object.values(composite)) {
    for (const rows of Object.values(byView ?? {})) {
      if ((rows ?? []).some((row) => row.threadId === threadId)) return true;
    }
  }
  const legacy = store.legacyThreadGroupsByWorkspaceId ?? {};
  for (const rows of Object.values(legacy)) {
    if ((rows ?? []).some((row) => row.threadId === threadId)) return true;
  }
  return false;
}

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
      console.log('[WS] thread:list received:', msg.threads?.length, 'thread groups');
      if (msg.threads) {
        // The server's visible population is Thread Group projections. The
        // echoed `viewId` addresses exactly one population: `null` is the
        // explicit Legacy population; a view id fills only that
        // `{workspaceId, viewId}` pair and never the Legacy backing store.
        const rows: Thread[] = threadRowsFromProjections(msg.threads);
        const responseViewId: string | null = msg.viewId ?? null;
        const workspaceId = store.activeWorkspaceId;
        if (workspaceId) {
          // Drop rows bound to another workspace; a stale/foreign response
          // cannot fill this workspace's population.
          const scoped = rows.filter(
            (row) => !row.workspaceId || row.workspaceId === workspaceId,
          );
          store.setThreadGroupPopulation(workspaceId, responseViewId, scoped);
          // SPEC-04 §7 restart/readback: a qualified view list also triggers the
          // exact per-group entry read, so a persisted open Side Chat placement
          // materializes for an unbound/dockless host without an action frame.
          if (responseViewId !== null && isSideChatCapableView(responseViewId)) {
            for (const row of scoped) {
              if (row.threadGroupId) {
                requestWorksurfaceEntryRead(workspaceId, responseViewId, row.threadGroupId);
              }
            }
          }
          if (responseViewId === null) {
            // Legacy backing store for pre-SPEC-02 consumers; all new reads are
            // qualified through the composite map.
            store.setThreads(scoped);
          }
        }
        // SPEC-02 §6.2: hydrate each session's server-acknowledged portable
        // selection from its own `entry.harnessConfig`. Rows without an entry
        // leave the acknowledged value untouched. Session hydration is safe
        // regardless of population.
        for (const row of rows) {
          if (row.entry) {
            store.hydrateHarnessSelection(
              row.threadId,
              row.entry.harnessConfig,
              row.entry.harnessId ?? null,
            );
          }
        }
        // A null-view response may still be read explicitly for historical
        // cleanup, but it owns no production host and therefore never selects
        // or opens a session. Active view hosts own qualified MRU selection.
      }
      return true;

    case 'thread:members': {
      // SPEC-04 §8: the qualified ordered-member read. Ordered projections
      // only; never transcript content. Hydrate the exact group's list.
      const membersWorkspaceId = typeof msg.workspaceId === 'string' && msg.workspaceId
        ? msg.workspaceId
        : store.activeWorkspaceId;
      if (membersWorkspaceId
        && typeof msg.threadGroupId === 'string' && msg.threadGroupId
        && Array.isArray(msg.members)) {
        store.setThreadMembers(
          membersWorkspaceId,
          msg.threadGroupId,
          msg.members as Parameters<typeof store.setThreadMembers>[2],
        );
      }
      return true;
    }

    case 'thread:members:error':
      // Inert classified failure: nothing to hydrate; the existing member list
      // (if any) is retained rather than replaced with a fabricated one.
      return true;

    case 'thread:created':
      console.log('[WS] thread:created received:', msg.threadId);
      if (msg.thread && msg.threadId) {
        store.addThread({
          threadId: msg.threadId,
          threadGroupId: msg.threadGroupId,
          // Durable view binding of the created group (`null` = explicit
          // Legacy); the client never infers it from the active panel.
          viewId: typeof msg.viewId === 'string' && msg.viewId ? msg.viewId : null,
          entry: msg.thread,
        });
        // A correlated creation is selected only when its matching opened
        // response arrives. Cancellation may leave the committed group intact.
        if (!msg.requestId) {
          store.setCurrentThreadId(msg.threadId);
          store.setChatActive(true);
        }
        // PER_THREAD_CHAT_STATE: clear this thread's slot specifically.
        store.clearChat(msg.threadId);
        store.clearThreadUsage(msg.threadId);
        store.hydrateHarnessSelection(
          msg.threadId,
          msg.thread?.harnessConfig,
          msg.thread?.harnessId ?? null,
        );
        store.setContextUsage(0);
        store.setTokenUsage(null);
        hydrateThreadCandidates([]);
        loadRootTree();
      } else {
        console.error('[WS] thread:created missing data:', msg);
      }
      return true;

    case 'thread:opened': {
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
        if (responseViewId === null) {
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
        } else if (responseWorkspaceId) {
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
        store.consumeThreadOpen(
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
      return true;
    }

    case 'wire_ready':
      store.setChatActive(true);
      store.setWireReady(true);
      if (msg.threadId) store.setThreadWireReady(msg.threadId, true);
      return true;

    case 'thread:action:completed':
      // The server acknowledgement is authoritative; the renderer reflects it
      // and never commits an optimistic rename/delete. The same frame arrives
      // from workspace fan-out in other windows.
      if (msg.action === 'rename' && msg.threadId && typeof msg.name === 'string') {
        // SPEC-02 §6.1: the accepted rename updates the Legacy backing store
        // and every composite population containing this exact thread.
        store.updateThread(msg.threadId, { name: msg.name });
      } else if (msg.action === 'delete' && msg.threadId) {
        // The ack's own population clears the qualified selection even when
        // the row is absent from the current read model.
        store.removeThread(
          msg.threadId,
          typeof msg.threadGroupId === 'string' ? msg.threadGroupId : null,
          typeof msg.viewId === 'string' ? msg.viewId : null,
        );
        // SPEC-03 §8 / 03B-D10: a group delete removes exactly its server
        // worksurface entry, so every live window drops a cached copy of the
        // deleted group. This never touches a pending capture, binding, or
        // conflict. Legacy (`viewId: null`) has no worksurface entry.
        const deletedWorkspaceId = typeof msg.workspaceId === 'string' && msg.workspaceId
          ? msg.workspaceId
          : store.activeWorkspaceId;
        if (deletedWorkspaceId
          && typeof msg.viewId === 'string' && msg.viewId
          && typeof msg.threadGroupId === 'string' && msg.threadGroupId) {
          store.removeWorksurfaceEntry(deletedWorkspaceId, msg.viewId, msg.threadGroupId);
        }
      } else if (msg.action === 'move_chat_to_side'
        && typeof msg.threadGroupId === 'string' && msg.threadGroupId
        && typeof msg.newMainThreadId === 'string' && msg.newMainThreadId) {
        // SPEC-04 §5: the visible row keeps its group identity and now names
        // the new empty Main Chat. The moved member is addressed only through
        // the placement lane, never reconstructed from primary history.
        const moveWorkspaceId = typeof msg.workspaceId === 'string' && msg.workspaceId
          ? msg.workspaceId
          : store.activeWorkspaceId;
        const moveViewId = typeof msg.viewId === 'string' && msg.viewId ? msg.viewId : null;
        if (moveWorkspaceId) {
          store.applyThreadGroupMove({
            workspaceId: moveWorkspaceId,
            viewId: moveViewId,
            threadGroupId: msg.threadGroupId,
            newThreadId: msg.newMainThreadId,
            ...(typeof msg.currentPrimarySequence === 'number'
              ? { currentPrimarySequence: msg.currentPrimarySequence }
              : {}),
          });
          if (moveViewId) {
            requestWorksurfaceEntryRead(moveWorkspaceId, moveViewId, msg.threadGroupId);
          }
        }
        if (!msg.fanOut && typeof msg.sideChatPlacementId === 'string') {
          // SPEC-04 §7: never claim the tab opened when delivery did not apply;
          // a failed/pending placement stays truthful and retryable.
          if (msg.placementStatus === 'applied') {
            showToast('Moved to a Side Chat');
          } else {
            showToast('Moved. The Side Chat tab is pending retry.');
          }
        }
      } else if (msg.action === 'open_member_in_side'
        && typeof msg.threadGroupId === 'string' && msg.threadGroupId
        && typeof msg.sideChatPlacementId === 'string' && msg.sideChatPlacementId) {
        // SPEC-04 §8: the member's lifetime placement is reopened/focused by
        // the server. This window focuses that exact placement (never promotes
        // the member, never treats the broadcast as the request ack) and
        // re-reads acknowledged server truth so the tab materializes.
        const openWorkspaceId = typeof msg.workspaceId === 'string' && msg.workspaceId
          ? msg.workspaceId
          : store.activeWorkspaceId;
        const openViewId = typeof msg.viewId === 'string' && msg.viewId ? msg.viewId : null;
        if (openWorkspaceId && openViewId) {
          store.setActiveSideChatPlacement(
            openWorkspaceId,
            openViewId,
            msg.sideChatPlacementId,
          );
          requestWorksurfaceEntryRead(openWorkspaceId, openViewId, msg.threadGroupId);
        }
        if (!msg.fanOut && msg.placementStatus === 'applied') {
          showToast('Opened the Side Chat');
        }
      } else if (msg.action === 'set_harness_selection' && msg.threadId) {
        // SPEC-02 §6.2: only the exact-session response promotes the pending
        // optimistic value to acknowledged Send authority.
        store.ackHarnessSelection(msg.threadId, msg.requestId, {
          model: typeof msg.model === 'string' ? msg.model : null,
          variant: typeof msg.variant === 'string' ? msg.variant : null,
          harnessId: typeof msg.harnessId === 'string' ? msg.harnessId : null,
        });
      } else if (msg.action === 'copy_link' && !msg.fanOut
        && typeof msg.link === 'string' && msg.link) {
        // The versioned application URI is copied only after the server
        // acknowledgement; no optimistic or fabricated link. A fan-out frame
        // is another window's result and must never touch this clipboard.
        navigator.clipboard.writeText(msg.link).then(() => {
          showToast('Thread link copied');
        }).catch((err) => {
          console.error('[WS] Failed to copy thread link:', err);
          showToast('Could not copy thread link');
        });
      } else if (msg.action === 'view_markdown' && !msg.fanOut
        && typeof msg.markdownPath === 'string' && msg.markdownPath) {
        openThreadMarkdown(msg.markdownPath);
      }
      return true;

    case 'thread:action:error': {
      // Bounded, non-optimistic failure surfacing. group_busy/request_mismatch
      // keep the existing row and explain why nothing changed.
      if (msg.action === 'set_harness_selection' && msg.threadId) {
        // Rejection restores the prior acknowledged value; the optimistic
        // pending value never became Send authority.
        store.rejectHarnessSelection(msg.threadId, msg.requestId);
      }
      const action = msg.action === 'rename'
        ? 'Rename'
        : msg.action === 'delete'
          ? 'Delete'
          : msg.action === 'move_chat_to_side'
            ? 'Move'
            : 'Thread action';
      let detail = 'Thread action failed';
      if (msg.code === 'group_busy') {
        detail = msg.action === 'move_chat_to_side'
          ? 'Thread has an active conversation. Stop it before moving.'
          : 'Thread has an active conversation. Stop it before deleting.';
      }
      else if (msg.code === 'request_mismatch') detail = 'That request was already used with different input.';
      else if (msg.code === 'not_found') detail = 'Thread no longer exists.';
      else if (msg.code === 'invalid_name') detail = 'Thread name is invalid.';
      else if (msg.code === 'invalid_link') detail = 'Thread link is invalid.';
      else if (msg.code === 'not_primary' || msg.code === 'stale_primary') {
        detail = 'Only the current Main Chat can be moved, and the conversation must be up to date.';
      } else if (msg.code === 'view_not_supported') {
        detail = 'This view cannot host a Side Chat.';
      } else if (msg.code === 'invalid_selection' || msg.code === 'selection_unavailable') {
        detail = 'That model or effort is not available.';
      }
      showToast(`${action} failed: ${detail}`);
      return true;
    }

    case 'message:sent':
      if (msg.threadId && typeof msg.content === 'string'
        && typeof msg.requestId === 'string' && typeof msg.turnId === 'string'
        && typeof msg.workspaceId === 'string') {
        if (msg.workspaceId !== store.activeWorkspaceId) return true;
        const attempt = useChatSubmissionStore.getState().attemptsByOwner[
          chatSubmissionOwnerKey(msg.workspaceId, msg.threadId)
        ];
        const isOwnedThread = store.currentThreadId === msg.threadId
          || store.threads.some((thread) => thread.threadId === msg.threadId)
          // SPEC-04 §7/§8: a mounted Side Chat member is a non-primary peer, so
          // it is not in `threads`; its exact mounted chat slot is the owner.
          // A deleted thread's slot is removed by `removeThread`, so this never
          // recreates chat state for a deleted or foreign thread.
          || store.projectChats?.[msg.threadId] !== undefined
          // A group's current primary (the replacement Main Chat B) is a live
          // owner even before its chat slot hydrates.
          || isGroupPrimaryThread(store, msg.threadId)
          // A reconnect status can beat thread:list. The authenticated exact
          // attempt is already session ownership for this server ACK.
          || attempt?.requestId === msg.requestId;
        // A late acknowledgement for a deleted or previous-workspace thread
        // must not recreate chat state in the active workspace. Legitimate
        // current threads still commit their server-owned user bubble even
        // when a remount/reload no longer has a local pending marker.
        if (!isOwnedThread) return true;
        if (!attempt || attempt.requestId !== msg.requestId || attempt.phase === 'rejected') return true;
        const accepted = useChatSubmissionStore.getState().accept(
          msg.workspaceId, msg.threadId, msg.requestId, msg.turnId,
        );
        if (!accepted) return true;
        settlePromptRecovery(msg.workspaceId, msg.threadId, msg.requestId);
        trackAcceptedPromptExecution(useChatSubmissionStore.getState().attemptsByOwner[
          chatSubmissionOwnerKey(msg.workspaceId, msg.threadId)]);
        // A replayed begin or reconnect snapshot can precede this ACK.
        // Do not start an execution timer for a turn already bound live.
        const chat = usePanelStore.getState().projectChats[msg.threadId];
        if (chat?.currentTurn?.id === msg.turnId || chat?.messages.some((message) => (
          message.type === 'assistant' && (message.id === msg.turnId || message.metadata?.turnId === msg.turnId)
        ))) {
          finishAcceptedPromptExecution(msg.workspaceId, msg.threadId, msg.turnId);
        }
        const messageId = `user-${msg.turnId}`;
        if (!usePanelStore.getState().projectChats[msg.threadId]?.messages.some((message) => message.id === messageId)) {
          store.addMessage(msg.threadId, {
            id: messageId,
            type: 'user',
            content: msg.content,
            timestamp: Date.now(),
          });
        }
        useChatFileLinkStore.getState().removeSubmittedAttachments(
          accepted.workspaceId, accepted.threadId, accepted.attachmentGenerations,
        );
        useChatComposerDraftStore.getState().clearDraftIfRevision(
          accepted.workspaceId, accepted.threadId, accepted.draftRevision,
        );
        window.dispatchEvent(new CustomEvent('fusion:prompt-accepted', {
          detail: {
            threadId: msg.threadId,
            workspaceId: msg.workspaceId,
            requestId: msg.requestId,
            turnId: msg.turnId,
            recoveredFromStatus: (msg as WebSocketMessage & { recoveredFromStatus?: boolean }).recoveredFromStatus === true,
          },
        }));
      }
      return true;

    default:
      return false;
  }
}

// --- History conversion helpers (private to this module) ---

/**
 * Open the server-acknowledged exact-member mirror path in the File Viewer.
 * The server resolved the canonical `Data/Chatlogs/threads/<threadId>.md`
 * through ThreadManager; the renderer only translates the workspace-relative
 * `ai/` path for the existing file viewer.
 */
function openThreadMarkdown(filePath: string): void {
  const aiIdx = filePath.indexOf('ai/');
  const relPath = aiIdx >= 0 ? filePath.slice(aiIdx) : filePath;
  const panelStore = usePanelStore.getState();
  panelStore.setCurrentPanel('file-viewer');
  const name = relPath.split('/').pop() || relPath;
  loadFileContent({
    path: relPath,
    name,
    type: 'file',
    extension: 'md',
  });
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
