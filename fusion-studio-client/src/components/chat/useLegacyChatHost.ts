/**
 * @module useLegacyChatHost
 * @role Connected host for the workspace Legacy Main Chat (SPEC-02 §5.2).
 *
 * Owns every store read/action, validates the workspace/thread relationship,
 * reads session state by exact `threadId`, reads mounted UI state by the
 * mount's own `surfaceId`, and projects the portable `ChatSurfaceModel` and
 * `ChatSurfaceActions`. No store, socket, controller, service, or mutable
 * global crosses into `ChatSurface`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePanelStore } from '../../state/panelStore';
import {
  chatAttachmentOwnerKey,
  useChatFileLinkStore,
} from '../../state/chatFileLinkStore';
import {
  chatComposerDraftOwnerKey,
  useChatComposerDraftStore,
} from '../../state/chatComposerDraftStore';
import { useResolvedHarness, useSelectableHarnesses } from '../../config/harness';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import {
  threadActionCopyLink,
  threadActionMoveChatToSide,
  threadActionRename,
  threadActionSetHarnessSelection,
  threadActionViewMarkdown,
} from '../../lib/ws/threadGroupRows';
import { CHAT_ACTION_EVENT, type ChatActionPayload } from '../../lib/chat-action';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';
import type { ChatInputRef } from '../ChatInput';
import { EMPTY_MESSAGES, EMPTY_SEGMENTS, selectChatState } from './chatAreaConstants';
import {
  requestChatTurnDiagnostic,
  type ChatDiagnosticRouteIds,
} from '../../lib/ws/chat-diagnostic-handlers';
import { writeAndRecord } from '../../clipboard/clipboard-api';
import { acknowledgedHarnessConfigForThread, selectionForThread } from '../../state/slices/chatSurfaceSlice';
import { getWorksurfaceDockOpen } from '../../state/slices/worksurfaceSlice';
import { useChatSurfaceIdentity } from './useChatSurfaceIdentity';
import type {
  ChatMountIdentity,
  ChatSurfaceActions,
  ChatSurfaceHostKind,
  ChatSurfaceModel,
  ChatSurfaceRefs,
} from './chatSurfaceContract';

interface PendingPromptTarget {
  threadId: string;
  text: string;
  composerText: string;
  workspaceId: string | null;
}

type ChatTarget = Pick<PendingPromptTarget, 'threadId'>;

export interface UseLegacyChatHostOptions {
  panel: string;
  /** Explicit session target for non-production/explicit mounts. */
  threadId?: string | null;
  host?: ChatSurfaceHostKind;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  /** Explicit population view binding; `null` is the Legacy host. */
  viewId?: string | null;
  /** Explicit workspace binding; defaults to the active workspace. */
  workspaceId?: string | null;
  /** Explicit visible-group binding (view hosts resolve it from the rail). */
  threadGroupId?: string | null;
  /**
   * Exact current-primary sequence the connected population observed. View
   * hosts pass it from their own rail row; the workspace-global `threads`
   * mirror may not carry the view-bound row (SPEC-04 §4).
   */
  expectedPrimarySequence?: number | null;
  /**
   * When true the host never falls back to the workspace-global
   * `currentThreadId`; an absent explicit target renders the empty surface.
   * Used by view-bound hosts so one view never borrows another's selection.
   */
  explicitTarget?: boolean;
  /**
   * Whether this host's panel is the shell's active panel. Inactive mounted
   * panels render cached state but claim no global insert/Send-to-Chat intent.
   */
  isActive?: boolean;
  /**
   * Component-backed mounts derive their transient `surfaceId` from the
   * descriptor's unique `componentInstanceId` + runtime mount generation
   * (BRIDGE-02 overlay §2 rule 4). When omitted the host mints one from its
   * own mount generation. Never persisted or sent.
   */
  surfaceId?: string;
}

export interface LegacyChatHostProjection {
  identity: ChatMountIdentity;
  chat: ChatSurfaceModel;
  actions: ChatSurfaceActions;
  refs: ChatSurfaceRefs;
  onToggleThreads: () => void;
  onToggleContent: () => void;
}

export function useLegacyChatHost({
  panel,
  threadId: threadIdProp,
  host = 'legacy-main',
  sidebarCollapsed = false,
  contentCollapsed = false,
  viewId: viewIdProp = null,
  workspaceId: workspaceIdProp = null,
  threadGroupId: threadGroupIdProp = null,
  expectedPrimarySequence: expectedPrimarySequenceProp = null,
  explicitTarget = false,
  isActive: isActivePanel = true,
  surfaceId: surfaceIdProp,
}: UseLegacyChatHostOptions): LegacyChatHostProjection {
  // The host always calls the minting hook (Rules of Hooks); a component-backed
  // mount overrides the minted value with its `componentInstanceId`-derived id.
  const mintedSurfaceId = useChatSurfaceIdentity(host);
  const surfaceId = surfaceIdProp ?? mintedSurfaceId;
  // An explicit mount (thread-targeted or non-production view host) never
  // borrows the workspace-global pending-connecting state. The pending new
  // thread has no `threadId`, so it is owned by the initiating surface.
  const explicitMount = Boolean(threadIdProp) || explicitTarget;

  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const selectHarness = usePanelStore((s) => s.selectHarness);
  const createDefaultAssistantThread = usePanelStore((s) => s.createDefaultAssistantThread);
  const sendMessage = usePanelStore((s) => s.sendMessage);
  const warmThread = usePanelStore((s) => s.warmThread);
  const finalizeTurn = usePanelStore((s) => s.finalizeTurn);
  const setPendingPromptAcceptance = usePanelStore((s) => s.setPendingPromptAcceptance);
  const setPromptRetryDraft = usePanelStore((s) => s.setPromptRetryDraft);
  const setConnectingHarnessId = usePanelStore((s) => s.setConnectingHarnessId);
  const setWireReady = usePanelStore((s) => s.setWireReady);
  const beginHarnessSelection = usePanelStore((s) => s.beginHarnessSelection);
  const addPendingAttachment = useChatFileLinkStore((s) => s.addPendingAttachment);
  const setComposerDraft = useChatComposerDraftStore((s) => s.setDraft);

  const headerRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputRef>(null);

  const justSentRef = useRef(false);
  const [sendingTarget, setSendingTarget] = useState<ChatTarget | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [cliPickerOpen, setCliPickerOpen] = useState(false);
  const [threadDropdownOpen, setThreadDropdownOpen] = useState(false);
  const pendingPromptRef = useRef<PendingPromptTarget | null>(null);

  const primaryThreadId = usePanelStore((s) => s.currentThreadId);
  // An explicit view host never borrows the workspace-global current thread.
  const threadId = explicitTarget
    ? (threadIdProp ?? '')
    : (threadIdProp ?? primaryThreadId ?? '');
  const hasThread = !!threadId;

  const activeWorkspaceId = usePanelStore((s) => s.activeWorkspaceId);
  const workspaceId = workspaceIdProp ?? activeWorkspaceId;
  const threads = usePanelStore((s) => s.threads);
  const threadRow = useMemo(
    () => threads.find((t) => t.threadId === threadId),
    [threads, threadId],
  );
  const threadGroupId = threadGroupIdProp ?? threadRow?.threadGroupId ?? '';
  const expectedPrimarySequence = expectedPrimarySequenceProp
    ?? threadRow?.currentPrimarySequence
    ?? null;

  const selector = selectChatState(hasThread ? threadId : null);
  const messages = usePanelStore((s) => selector(s)?.messages ?? EMPTY_MESSAGES);
  const currentTurn = usePanelStore((s) => selector(s)?.currentTurn ?? null);
  const segments = usePanelStore((s) => selector(s)?.segments ?? EMPTY_SEGMENTS);
  const pendingTurnEnd = usePanelStore((s) => selector(s)?.pendingTurnEnd ?? false);
  const pendingExchangeSaveTurnId = usePanelStore((s) => selector(s)?.pendingExchangeSaveTurnId ?? null);
  const pendingPromptAcceptance = usePanelStore(
    (s) => selector(s)?.pendingPromptAcceptance ?? null,
  );
  const retryPromptDraft = usePanelStore((s) => selector(s)?.retryPromptDraft ?? null);
  const contextUsage = usePanelStore(
    (s) => (hasThread ? (s.contextUsageByThread[threadId] ?? 0) : 0),
  );
  const tokenUsage = usePanelStore(
    (s) => (hasThread ? (s.tokenUsageByThread[threadId] ?? null) : null),
  );
  const wireReadyForThread = usePanelStore(
    (s) => (hasThread ? (s.wireReadyByThread[threadId] ?? false) : false),
  );
  const harnessSelection = usePanelStore(
    (s) => selectionForThread(s, hasThread ? threadId : null),
  );
  const connectingHarnessId = usePanelStore((s) => s.connectingHarnessId);
  const connectingHarnessBySurface = usePanelStore((s) => s.connectingHarnessBySurface);
  const setConnectingHarnessForSurface = usePanelStore((s) => s.setConnectingHarnessForSurface);
  const clearConnectingHarnessForSurface = usePanelStore((s) => s.clearConnectingHarnessForSurface);
  const chatActive = usePanelStore((s) => s.chatActive);
  const harnessStatuses = useHarnessStatuses();
  const selectableHarnesses = useSelectableHarnesses(harnessStatuses);

  // The pending new-thread "connecting" state has no `threadId` yet. Explicit
  // mounts read ONLY their own surface-owned claim; the production Legacy host
  // reads the workspace-global mirror. Two mounted surfaces can never display
  // each other's connecting state (SPEC-02 §6.2, 02A-D2).
  const surfaceConnectingHarnessId = explicitMount
    ? (connectingHarnessBySurface[surfaceId] ?? null)
    : connectingHarnessId;
  const surfaceConnectingHarness = useResolvedHarness(surfaceConnectingHarnessId);

  const composerDraft = useChatComposerDraftStore((s) => {
    if (!workspaceId || !hasThread) return '';
    return s.draftsByOwner[chatComposerDraftOwnerKey(workspaceId, threadId)] ?? '';
  });

  const isSendingForCurrentThread = sendingTarget?.threadId === threadId;
  const isAcceptancePending = pendingPromptAcceptance !== null;
  const isTurnFinalizing = Boolean(pendingTurnEnd || pendingExchangeSaveTurnId);
  const showOrb = (isSendingForCurrentThread || currentTurn?.status === 'streaming')
    && segments.length === 0 && !isTurnFinalizing;
  const isTurnActive = (!!currentTurn || isSendingForCurrentThread) && !isTurnFinalizing;
  const isActive = hasThread && (threadIdProp ? true : chatActive);

  const hasPendingAcceptance = useCallback((tid: string | null) => {
    if (!tid) return false;
    return usePanelStore.getState().projectChats[tid]?.pendingPromptAcceptance != null;
  }, []);

  const warmCurrentThread = useCallback(() => {
    if (!threadId || !isActive || hasPendingAcceptance(threadId)) return;
    warmThread(threadId);
  }, [threadId, isActive, hasPendingAcceptance, warmThread]);

  // ── Send / composer lifecycle (exact-session targets) ──────────────────────

  const sendToThread = useCallback((targetThreadId: string, text: string) => {
    if (hasPendingAcceptance(targetThreadId)) return;
    if (!workspaceId) return;
    const attachmentKey = chatAttachmentOwnerKey(workspaceId, targetThreadId);
    const attachments = useChatFileLinkStore.getState()
      .pendingAttachmentsByOwner[attachmentKey]?.attachments ?? [];
    pendingPromptRef.current = {
      threadId: targetThreadId,
      text,
      composerText: inputRef.current?.getText() ?? text,
      workspaceId,
    };
    setPromptRetryDraft(targetThreadId, null);
    setPendingPromptAcceptance(targetThreadId, {
      text,
      composerText: pendingPromptRef.current.composerText,
      workspaceId,
      attachmentIds: attachments.map((attachment) => attachment.id),
    });

    const state = usePanelStore.getState();
    const cs = state.projectChats[targetThreadId];
    if (cs?.currentTurn) {
      finalizeTurn(targetThreadId);
    }

    // SPEC-02 §6.2: Send snapshots the last server-acknowledged portable
    // selection for THIS exact threadId. It never reads a panel-global config.
    sendMessage(text, targetThreadId, attachments, {
      harnessConfig: acknowledgedHarnessConfigForThread(state, targetThreadId),
    });
  }, [finalizeTurn, hasPendingAcceptance, sendMessage, setPendingPromptAcceptance, setPromptRetryDraft, workspaceId]);

  const handleSend = useCallback((text: string) => {
    if (!threadId) return;
    sendToThread(threadId, text);
  }, [sendToThread, threadId]);

  const handleAddAttachment = useCallback((attachment: ChatLinkAttachment) => {
    if (!workspaceId || !threadId) return;
    warmCurrentThread();
    addPendingAttachment(workspaceId, threadId, attachment);
    inputRef.current?.focus();
  }, [addPendingAttachment, threadId, warmCurrentThread, workspaceId]);

  const handleInsertText = useCallback((text: string) => {
    warmCurrentThread();
    inputRef.current?.insertText(text);
  }, [warmCurrentThread]);

  const handleReplaceText = useCallback((text: string) => {
    warmCurrentThread();
    inputRef.current?.replaceText(text);
  }, [warmCurrentThread]);

  const handleAppendText = useCallback((text: string) => {
    warmCurrentThread();
    inputRef.current?.appendText(text);
  }, [warmCurrentThread]);

  const handleComposerDraftChange = useCallback((text: string) => {
    if (!workspaceId || !threadId) return;
    if (usePanelStore.getState().activeWorkspaceId !== workspaceId) return;
    setComposerDraft(workspaceId, threadId, text);
  }, [setComposerDraft, threadId, workspaceId]);

  const handleModelSelectionChange = useCallback((patch: { modelId?: string | null; variant?: string | null }) => {
    if (!threadId) return;
    const socket = usePanelStore.getState().ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const current = selectionForThread(usePanelStore.getState(), threadId).acknowledged;
    const nextModel = patch.modelId !== undefined ? patch.modelId : current.model;
    if (!nextModel) return;
    const nextVariant = patch.variant !== undefined ? patch.variant : current.variant;
    const request = threadActionSetHarnessSelection({
      threadGroupId,
      threadId,
      model: nextModel,
      variant: nextVariant ?? null,
    });
    beginHarnessSelection(threadId, {
      modelId: nextModel,
      variant: nextVariant ?? null,
      requestId: request.requestId,
    });
    socket.send(JSON.stringify(request));
  }, [beginHarnessSelection, threadGroupId, threadId]);

  // ── Thread actions (exact group/member) ────────────────────────────────────

  const handleCopyLink = useCallback(() => {
    const socket = usePanelStore.getState().ws;
    if (threadId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(threadActionCopyLink({ threadGroupId, threadId })));
    }
    setMoreMenuOpen(false);
  }, [threadGroupId, threadId]);

  const handleRename = useCallback(() => {
    setMoreMenuOpen(false);
    const socket = usePanelStore.getState().ws;
    if (!threadId || !socket || socket.readyState !== WebSocket.OPEN) return;
    const currentName = threadRow?.entry?.name ?? '';
    const next = window.prompt('Rename thread:', currentName);
    const trimmed = next?.trim();
    if (trimmed && trimmed !== currentName) {
      socket.send(JSON.stringify(threadActionRename({ threadGroupId, threadId, name: trimmed })));
    }
  }, [threadGroupId, threadId, threadRow]);

  const handleViewMarkdown = useCallback(() => {
    const socket = usePanelStore.getState().ws;
    if (threadId && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(threadActionViewMarkdown({ threadGroupId, threadId })));
    }
    setMoreMenuOpen(false);
  }, [threadGroupId, threadId]);

  const handleMoveToSideChat = useCallback(() => {
    setMoreMenuOpen(false);
    const socket = usePanelStore.getState().ws;
    if (!threadId || !threadGroupId || !Number.isInteger(expectedPrimarySequence)
      || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(threadActionMoveChatToSide({
      threadGroupId,
      threadId,
      expectedPrimarySequence: expectedPrimarySequence as number,
    })));
  }, [expectedPrimarySequence, threadGroupId, threadId]);

  const handleStop = useCallback(() => {
    const state = usePanelStore.getState();
    if (!threadId || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    const cs = state.projectChats[threadId];
    if (cs?.currentTurn) {
      state.setPendingExchangeSave(threadId, cs.currentTurn.id);
      state.ws.send(JSON.stringify({ type: 'turn:stop', threadId }));
    }
  }, [threadId]);

  const handleCreateThread = useCallback(() => {
    if (selectableHarnesses.length <= 1) {
      if (explicitMount) {
        // An explicit mount never mutates the workspace-global pending-
        // connecting mirror (it would surface on the production host). It
        // sends the accepted open-assistant intent directly.
        const socket = usePanelStore.getState().ws;
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'thread:open-assistant' }));
        }
        return;
      }
      createDefaultAssistantThread();
      return;
    }
    setCliPickerOpen(true);
  }, [createDefaultAssistantThread, explicitMount, selectableHarnesses.length]);

  const handleHarnessSelect = useCallback((harnessId: string, modelId?: string) => {
    if (explicitMount) {
      // Surface-owned pending-connecting claim, keyed by this mount's
      // `surfaceId`; the global mirror is left untouched.
      setConnectingHarnessForSurface(surfaceId, harnessId);
      const socket = usePanelStore.getState().ws;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'thread:open-assistant',
          harnessId,
          ...(modelId ? { harnessConfig: { model: modelId } } : {}),
        }));
      }
      setCliPickerOpen(false);
      return;
    }
    selectHarness(harnessId, modelId);
    setCliPickerOpen(false);
  }, [explicitMount, selectHarness, setConnectingHarnessForSurface, surfaceId]);

  // SPEC-04 §3: a Side Chat has no nested list; its list button operates the
  // outer owning view's ThreadRail dock instead of a local/global sidebar.
  const sideTabHost = host === 'side-tab';
  const handleToggleThreads = useCallback(() => {
    setMoreMenuOpen(false);
    if (sideTabHost && workspaceId && viewIdProp) {
      const state = usePanelStore.getState();
      state.setWorksurfaceDockOpen(
        workspaceId,
        viewIdProp,
        !getWorksurfaceDockOpen(state, workspaceId, viewIdProp),
      );
      return;
    }
    toggleCollapsed(panel, 'leftSidebar');
  }, [panel, sideTabHost, toggleCollapsed, viewIdProp, workspaceId]);

  const handleToggleContent = useCallback(() => {
    toggleCollapsed(panel, 'contentArea');
  }, [panel, toggleCollapsed]);

  const handleRequestDiagnostic = useCallback((route: ChatDiagnosticRouteIds) => (
    requestChatTurnDiagnostic(route)
  ), []);

  const handleCopyDiagnostic = useCallback(async (text: string) => {
    await writeAndRecord(text, 'chat-diagnostic');
  }, []);

  const handleAskAIWithDiagnostic = useCallback((text: string) => {
    if (hasPendingAcceptance(threadId)) return false;
    // Explicit append only. ChatInput preserves the current draft byte-for-byte.
    handleAppendText(text);
    return true;
  }, [handleAppendText, hasPendingAcceptance, threadId]);

  // ── Effects (scroll, drafts, connecting, prompt lifecycle) ─────────────────

  useEffect(() => {
    const restorableDraft = pendingPromptAcceptance ?? retryPromptDraft;
    if (!restorableDraft) return;
    const input = inputRef.current;
    if (input?.getText() === '') input.replaceText(restorableDraft.composerText);
  }, [pendingPromptAcceptance, retryPromptDraft]);

  useEffect(() => {
    const owner = pendingPromptRef.current;
    if (!owner) return;
    if (owner.workspaceId !== workspaceId || !threads.some((thread) => thread.threadId === owner.threadId)) {
      pendingPromptRef.current = null;
    }
  }, [workspaceId, threads]);

  useEffect(() => {
    if (justSentRef.current && lastUserMsgRef.current) {
      justSentRef.current = false;
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages.length]);

  useEffect(() => {
    if (segments.length > 0 && isSendingForCurrentThread) {
      const id = window.setTimeout(() => setSendingTarget(null), 0);
      return () => window.clearTimeout(id);
    }
  }, [segments.length, isSendingForCurrentThread]);

  useEffect(() => {
    if (explicitMount) {
      // Clear this surface's own pending-connecting claim once its session's
      // wire is ready. Never touches the global mirror or another surface.
      if (!wireReadyForThread) return;
      if (!(surfaceId in connectingHarnessBySurface)) return;
      clearConnectingHarnessForSurface(surfaceId);
      return;
    }
    if (wireReadyForThread && connectingHarnessId) {
      setConnectingHarnessId(null);
      setWireReady(false);
    }
  }, [
    explicitMount,
    wireReadyForThread,
    surfaceId,
    connectingHarnessBySurface,
    clearConnectingHarnessForSurface,
    connectingHarnessId,
    setConnectingHarnessId,
    setWireReady,
  ]);

  // An unmounted explicit surface releases its own pending-connecting claim.
  useEffect(() => () => {
    clearConnectingHarnessForSurface(surfaceId);
  }, [clearConnectingHarnessForSurface, surfaceId]);

  useEffect(() => {
    if (!cliPickerOpen && !threadDropdownOpen && !moreMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCliPickerOpen(false);
        setThreadDropdownOpen(false);
        setMoreMenuOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('.rv-dropdown[data-open="true"]')) {
        return;
      }
      const node = headerRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        setCliPickerOpen(false);
        setThreadDropdownOpen(false);
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [cliPickerOpen, threadDropdownOpen, moreMenuOpen]);

  // Prompt acceptance/failure/terminal events correlated to the exact thread.
  useEffect(() => {
    const handleAccepted = (e: Event) => {
      const detail = (e as CustomEvent<{
        threadId: string;
        content: string;
        pendingPromptMatched?: boolean;
        pendingPromptComposerText?: string;
      }>).detail;
      if (!detail) return;
      const durable = usePanelStore.getState().projectChats[detail.threadId]?.pendingPromptAcceptance;
      const local = pendingPromptRef.current;
      const matchesDurable = durable?.text === detail.content;
      const matchesLocalOwner = local?.threadId === detail.threadId
        && local.text === detail.content
        && local.workspaceId === workspaceId;
      const matchesVisibleLocal = matchesLocalOwner
        && threadId === detail.threadId
        && inputRef.current?.getText() === local.composerText;
      const matchesRestored = detail.pendingPromptMatched === true
        && threadId === detail.threadId
        && inputRef.current?.getText() === detail.pendingPromptComposerText;
      if (!matchesDurable && !matchesLocalOwner && !matchesRestored) return;
      if (matchesDurable) setPendingPromptAcceptance(detail.threadId, null);
      if (matchesLocalOwner) pendingPromptRef.current = null;
      if (!matchesVisibleLocal && !matchesRestored) return;
      setSendingTarget({ threadId: detail.threadId });
      justSentRef.current = true;
      inputRef.current?.clearText();
    };
    const handleFailed = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId?: string }>).detail;
      if (!detail?.threadId) return;
      const local = pendingPromptRef.current;
      if (!local) {
        setSendingTarget((target) => (target?.threadId === detail.threadId ? null : target));
        return;
      }
      if (detail.threadId !== local.threadId) return;
      pendingPromptRef.current = null;
      setSendingTarget((target) => (target?.threadId === local.threadId ? null : target));
    };
    const handleTurnEnded = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId?: string }>).detail;
      if (!detail?.threadId) return;
      setSendingTarget((target) => (target?.threadId === detail.threadId ? null : target));
    };
    window.addEventListener('fusion:prompt-accepted', handleAccepted);
    window.addEventListener('fusion:prompt-acceptance-failed', handleFailed);
    window.addEventListener('fusion:turn-ended', handleTurnEnded);
    return () => {
      window.removeEventListener('fusion:prompt-accepted', handleAccepted);
      window.removeEventListener('fusion:prompt-acceptance-failed', handleFailed);
      window.removeEventListener('fusion:turn-ended', handleTurnEnded);
    };
  }, [workspaceId, threadId, setPendingPromptAcceptance]);

  // Cross-surface insert / Send-to-Chat intents target the production Legacy
  // host only (explicit non-production mounts never claim global intents), and
  // only the shell's active panel claims them (inactive panels stay mounted
  // but must not double-consume a global intent).
  useEffect(() => {
    if (threadIdProp || explicitTarget || !isActivePanel) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string') handleInsertText(text);
    };
    window.addEventListener('fusion:chat-insert', handler);
    return () => window.removeEventListener('fusion:chat-insert', handler);
  }, [threadIdProp, explicitTarget, isActivePanel, handleInsertText]);

  useEffect(() => {
    if (threadIdProp || explicitTarget || !isActivePanel) return;
    const applyChatAction = (action: ChatActionPayload, content: string) => {
      if (action.target === 'current') {
        if (action.delivery === 'send') {
          const tid = usePanelStore.getState().currentThreadId;
          if (tid) sendToThread(tid, content);
        } else {
          handleInsertText(content);
        }
        return;
      }
      if (action.target !== 'new') return;
      const socket = usePanelStore.getState().ws;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const handleThreadOpened = (messageEvent: MessageEvent) => {
        try {
          const msg = JSON.parse(messageEvent.data);
          if (msg.type !== 'thread:opened' || !msg.threadId) return;
          socket.removeEventListener('message', handleThreadOpened);
          if (action.delivery === 'send') sendToThread(msg.threadId, content);
          else handleReplaceText(content);
        } catch {
          // Ignore non-JSON socket messages.
        }
      };
      socket.addEventListener('message', handleThreadOpened);
      socket.send(JSON.stringify({
        type: 'thread:open-assistant',
        ...(action.threadName ? { name: action.threadName } : {}),
      }));
    };

    const handleChatAction = (event: Event) => {
      const action = (event as CustomEvent<ChatActionPayload>).detail;
      if (!action) return;
      if (action.attachment) {
        if (action.target !== 'current') return;
        handleAddAttachment(action.attachment);
        return;
      }
      if (typeof action.content === 'string') {
        applyChatAction(action, action.content);
        return;
      }
      if (typeof action.promptId !== 'string') return;
      const socket = usePanelStore.getState().ws;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const requestId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const handlePromptResolved = (messageEvent: MessageEvent) => {
        try {
          const msg = JSON.parse(messageEvent.data);
          if (msg.requestId !== requestId) return;
          if (msg.type !== 'prompt:resolved' && msg.type !== 'prompt:resolve_error') return;
          socket.removeEventListener('message', handlePromptResolved);
          if (msg.type === 'prompt:resolved' && typeof msg.content === 'string') {
            applyChatAction(action, msg.content);
          }
        } catch {
          // Ignore non-JSON socket messages.
        }
      };
      socket.addEventListener('message', handlePromptResolved);
      socket.send(JSON.stringify({
        type: 'prompt:resolve',
        requestId,
        promptId: action.promptId,
        variables: action.variables || {},
      }));
    };
    window.addEventListener(CHAT_ACTION_EVENT, handleChatAction);
    return () => window.removeEventListener(CHAT_ACTION_EVENT, handleChatAction);
  }, [threadIdProp, explicitTarget, isActivePanel, handleAddAttachment, handleInsertText, handleReplaceText, sendToThread]);

  const identity: ChatMountIdentity = {
    workspaceId: workspaceId ?? '',
    viewId: viewIdProp,
    threadGroupId,
    threadId,
    surfaceId,
    host,
  };

  const chat: ChatSurfaceModel = {
    hasThread,
    messages,
    currentTurn,
    segments,
    contextUsage,
    tokenUsage,
    composerDraft,
    isActive,
    isTurnActive,
    isTurnFinalizing,
    showOrb,
    isAcceptancePending,
    connectingHarnessName: surfaceConnectingHarness?.name ?? null,
    modelSelection: {
      modelId: harnessSelection.acknowledged.model,
      variant: harnessSelection.acknowledged.variant,
      pending: harnessSelection.pending !== null,
    },
    harnessStatuses,
    isThreadsCollapsed: sidebarCollapsed || sideTabHost,
    isContentCollapsed: contentCollapsed,
    showCliPicker: selectableHarnesses.length > 1,
    cliPickerOpen,
    moreMenuOpen,
    canMoveToSideChat: host === 'main'
      && Boolean(viewIdProp)
      && Boolean(threadGroupId)
      && hasThread
      && Number.isInteger(expectedPrimarySequence)
      && !isTurnActive
      && !isAcceptancePending
      // SPEC-04 §4: no active/accepting turn AND no unresolved Stop boundary.
      && !isTurnFinalizing
      && harnessSelection.pending === null,
  };

  const actions: ChatSurfaceActions = {
    onSend: handleSend,
    onStop: handleStop,
    onWarmIntent: warmCurrentThread,
    onInsertText: handleInsertText,
    onAddAttachment: handleAddAttachment,
    onComposerDraftChange: handleComposerDraftChange,
    onCreateThread: handleCreateThread,
    onHarnessSelect: handleHarnessSelect,
    onToggleContent: handleToggleContent,
    onToggleCliPicker: () => setCliPickerOpen((v) => !v),
    onCloseCliPicker: () => setCliPickerOpen(false),
    onSetMoreMenuOpen: setMoreMenuOpen,
    onRename: handleRename,
    onCopyLink: handleCopyLink,
    onViewMarkdown: handleViewMarkdown,
    onMoveToSideChat: handleMoveToSideChat,
    onModelSelectionChange: handleModelSelectionChange,
    onRequestDiagnostic: handleRequestDiagnostic,
    onCopyDiagnostic: handleCopyDiagnostic,
    onAskAIWithDiagnostic: handleAskAIWithDiagnostic,
  };

  const refs: ChatSurfaceRefs = {
    headerRef,
    lastUserMsgRef,
    scrollRef,
    inputRef,
  };

  return { identity, chat, actions, refs, onToggleThreads: handleToggleThreads, onToggleContent: handleToggleContent };
}
