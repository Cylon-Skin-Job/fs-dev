/**
 * @module useChatArea
 * @role Chat state, send/stop handlers, and scroll/orb effects for ChatArea.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
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
import { threadLinkIntent } from '../../lib/thread-link-intent';
import { CHAT_ACTION_EVENT, type ChatActionPayload } from '../../lib/chat-action';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';
import type { ChatInputRef } from '../ChatInput';
import { EMPTY_MESSAGES, EMPTY_SEGMENTS, selectChatState } from './chatAreaConstants';
import { useComposerForkAction } from './useComposerForkAction';
import {
  requestChatTurnDiagnostic,
  type ChatDiagnosticRouteIds,
} from '../../lib/ws/chat-diagnostic-handlers';
import type { ScreenshotAttachmentOwner } from '../../screenshots/chatScreenshotCapture';
import { writeAndRecord } from '../../clipboard/clipboard-api';

interface PendingPromptTarget {
  threadId: string;
  text: string;
  composerText: string;
  workspaceId: string | null;
}

type ChatTarget = Pick<PendingPromptTarget, 'threadId'>;

export interface UseChatAreaOptions {
  panel: string;
  threadIdOverride?: string | null;
}

export function useChatArea({ panel, threadIdOverride }: UseChatAreaOptions) {
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const toggleCliPicker = usePanelStore((s) => s.toggleCliPicker);
  const toggleThreadDropdown = usePanelStore((s) => s.toggleThreadDropdown);
  const closeAllChatHeaderDropdowns = usePanelStore((s) => s.closeAllChatHeaderDropdowns);
  const cliPickerOpen = usePanelStore((s) => !!s.cliPickerOpen[panel]);
  const threadDropdownOpen = usePanelStore((s) => !!s.threadDropdownOpen[panel]);
  const chatHeaderRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const justSentRef = useRef(false);
  const [sendingTarget, setSendingTarget] = useState<ChatTarget | null>(null);
  const pendingPromptRef = useRef<PendingPromptTarget | null>(null);
  const connectingHarnessId = usePanelStore((s) => s.connectingHarnessId);
  const setConnectingHarnessId = usePanelStore((s) => s.setConnectingHarnessId);
  const selectHarness = usePanelStore((s) => s.selectHarness);
  const createDefaultAssistantThread = usePanelStore((s) => s.createDefaultAssistantThread);
  const harnessStatuses = useHarnessStatuses();
  const selectableHarnesses = useSelectableHarnesses(harnessStatuses);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const primaryThreadId = usePanelStore((state) => state.currentThreadId);
  const currentThreadId = threadIdOverride ?? primaryThreadId;
  const isSendingForCurrentThread = sendingTarget?.threadId === currentThreadId;
  const selector = selectChatState(currentThreadId);
  const messages = usePanelStore((state) => selector(state)?.messages ?? EMPTY_MESSAGES);
  const currentTurn = usePanelStore((state) => selector(state)?.currentTurn ?? null);
  const segments = usePanelStore((state) => selector(state)?.segments ?? EMPTY_SEGMENTS);
  const pendingTurnEnd = usePanelStore((state) => selector(state)?.pendingTurnEnd ?? false);
  const pendingExchangeSaveTurnId = usePanelStore((state) => selector(state)?.pendingExchangeSaveTurnId ?? null);
  const pendingPromptAcceptance = usePanelStore(
    (state) => selector(state)?.pendingPromptAcceptance ?? null,
  );
  const retryPromptDraft = usePanelStore(
    (state) => selector(state)?.retryPromptDraft ?? null,
  );
  const activeWorkspaceId = usePanelStore((state) => state.activeWorkspaceId);
  const contextUsage = usePanelStore((state) => state.contextUsage);
  const tokenUsage = usePanelStore((state) => state.tokenUsage);
  const chatActive = usePanelStore((state) => state.chatActive);
  const wireReady = usePanelStore((state) => state.wireReady);
  const threads = usePanelStore((state) => state.threads);
  const currentThread = threads.find((t) => t.threadId === currentThreadId);
  const connectingHarness = useResolvedHarness(connectingHarnessId);
  const setWireReady = usePanelStore((state) => state.setWireReady);

  const sendMessage = usePanelStore((state) => state.sendMessage);
  const warmThread = usePanelStore((state) => state.warmThread);
  const finalizeTurn = usePanelStore((state) => state.finalizeTurn);
  const setPendingPromptAcceptance = usePanelStore((state) => state.setPendingPromptAcceptance);
  const setPromptRetryDraft = usePanelStore((state) => state.setPromptRetryDraft);
  const addPendingAttachment = useChatFileLinkStore((state) => state.addPendingAttachment);

  const noThread = !currentThreadId;
  const isActive = chatActive;
  const isAcceptancePending = pendingPromptAcceptance !== null;
  const composerDraft = useChatComposerDraftStore((state) => {
    if (!activeWorkspaceId || !currentThreadId) return '';
    return state.draftsByOwner[
      chatComposerDraftOwnerKey(activeWorkspaceId, currentThreadId)
    ] ?? '';
  });
  const setComposerDraft = useChatComposerDraftStore((state) => state.setDraft);
  const screenshotOwner: ScreenshotAttachmentOwner | null = activeWorkspaceId && currentThreadId
    ? {
        workspaceId: activeWorkspaceId,
        threadId: currentThreadId,
        surface: threadIdOverride ? 'secondary' : 'primary',
      }
    : null;

  const hasPendingAcceptance = useCallback((threadId: string | null) => {
    if (!threadId) return false;
    return usePanelStore.getState().projectChats[threadId]?.pendingPromptAcceptance != null;
  }, []);

  const warmCurrentThread = useCallback(() => {
    const tid = currentThreadId;
    if (!tid || !isActive || hasPendingAcceptance(tid)) return;
    warmThread(tid);
  }, [currentThreadId, hasPendingAcceptance, isActive, warmThread]);

  const handleAddAttachment = useCallback((attachment: ChatLinkAttachment) => {
    if (!activeWorkspaceId || !currentThreadId) return;
    warmCurrentThread();
    addPendingAttachment(activeWorkspaceId, currentThreadId, attachment);
    chatInputRef.current?.focus();
  }, [activeWorkspaceId, addPendingAttachment, currentThreadId, warmCurrentThread]);

  const handleInsertText = useCallback((text: string) => {
    warmCurrentThread();
    chatInputRef.current?.insertText(text);
  }, [warmCurrentThread]);

  const handleReplaceText = useCallback((text: string) => {
    warmCurrentThread();
    chatInputRef.current?.replaceText(text);
  }, [warmCurrentThread]);

  const handleAppendText = useCallback((text: string) => {
    warmCurrentThread();
    chatInputRef.current?.appendText(text);
  }, [warmCurrentThread]);

  const handleComposerDraftChange = useCallback((text: string) => {
    if (!activeWorkspaceId || !currentThreadId) return;
    const state = usePanelStore.getState();
    if (state.activeWorkspaceId !== activeWorkspaceId) return;
    if (threadIdOverride) {
      if (state.secondary?.threadId !== currentThreadId) return;
    } else if (state.currentThreadId !== currentThreadId) {
      return;
    }
    setComposerDraft(activeWorkspaceId, currentThreadId, text);
  }, [activeWorkspaceId, currentThreadId, setComposerDraft, threadIdOverride]);

  const handleRequestDiagnostic = useCallback((route: ChatDiagnosticRouteIds) => (
    requestChatTurnDiagnostic(route)
  ), []);

  const handleCopyDiagnostic = useCallback(async (text: string) => {
    // Chat Reply Payloads / Clipboard History require every app-owned system
    // clipboard write to use the canonical write + history path.
    await writeAndRecord(text, 'chat-diagnostic');
  }, []);

  const handleAskAIWithDiagnostic = useCallback((text: string) => {
    // The accepted user draft still owns the composer until message:sent.
    // Guard at this final synchronous boundary as well as disabling the UI,
    // because retrieval may have started before acceptance became pending.
    if (hasPendingAcceptance(currentThreadId)) return false;
    // Explicit append only. ChatInput preserves the current draft byte-for-
    // byte, inserts one separator, and never invokes onSend; the user retains
    // review/edit/send authority even when a range was selected beforehand.
    handleAppendText(text);
    return true;
  }, [currentThreadId, handleAppendText, hasPendingAcceptance]);

  useEffect(() => {
    const restorableDraft = pendingPromptAcceptance ?? retryPromptDraft;
    if (!restorableDraft) return;
    const input = chatInputRef.current;
    // ChatInput is component-local; a minimized secondary remounts empty.
    // Restore only that empty remount, preserving the user's exact bytes.
    if (input?.getText() === '') input.replaceText(restorableDraft.composerText);
  }, [pendingPromptAcceptance, retryPromptDraft]);

  useEffect(() => {
    const owner = pendingPromptRef.current;
    if (!owner) return;
    if (owner.workspaceId !== activeWorkspaceId || !threads.some((thread) => thread.threadId === owner.threadId)) {
      pendingPromptRef.current = null;
    }
  }, [activeWorkspaceId, threads]);

  useEffect(() => {
    if (threadIdOverride) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string') handleInsertText(text);
    };
    window.addEventListener('fusion:chat-insert', handler);
    return () => window.removeEventListener('fusion:chat-insert', handler);
  }, [threadIdOverride, handleInsertText]);

  const handleHarnessSelect = useCallback((harnessId: string, modelId?: string) => {
    selectHarness(harnessId, modelId);
  }, [selectHarness]);

  const handleCreateThread = useCallback(() => {
    if (selectableHarnesses.length <= 1) {
      createDefaultAssistantThread();
      return;
    }
    toggleCliPicker(panel);
  }, [createDefaultAssistantThread, panel, selectableHarnesses.length, toggleCliPicker]);

  useEffect(() => {
    if (!cliPickerOpen && !threadDropdownOpen && !moreMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllChatHeaderDropdowns(panel);
        setMoreMenuOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('.rv-dropdown[data-open="true"]')) {
        return;
      }
      const node = chatHeaderRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        closeAllChatHeaderDropdowns(panel);
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [cliPickerOpen, threadDropdownOpen, moreMenuOpen, panel, closeAllChatHeaderDropdowns]);

  const handleToggleThreads = useCallback(() => {
    toggleCollapsed(panel, 'leftSidebar');
    setMoreMenuOpen(false);
  }, [toggleCollapsed, panel]);

  const handleCopyLink = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadId;
    const socket = store.ws;
    if (tid && socket && socket.readyState === WebSocket.OPEN) {
      threadLinkIntent.set('copy');
      socket.send(JSON.stringify({ type: 'thread:copyLink', threadId: tid }));
    }
    setMoreMenuOpen(false);
  }, []);

  const handleRename = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadId;
    const socket = store.ws;
    setMoreMenuOpen(false);
    if (!tid || !socket || socket.readyState !== WebSocket.OPEN) return;
    const current = store.threads.find((t) => t.threadId === tid);
    const currentName = current?.entry?.name ?? '';
    const next = window.prompt('Rename thread:', currentName);
    const trimmed = next?.trim();
    if (trimmed && trimmed !== currentName) {
      socket.send(JSON.stringify({
        type: 'thread:rename',
        threadId: tid,
        name: trimmed,
      }));
    }
  }, []);

  const handleViewMarkdown = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadId;
    const socket = store.ws;
    if (tid && socket && socket.readyState === WebSocket.OPEN) {
      threadLinkIntent.set('view');
      socket.send(JSON.stringify({ type: 'thread:copyLink', threadId: tid }));
    }
    setMoreMenuOpen(false);
  }, []);

  useEffect(() => {
    if (wireReady && connectingHarnessId) {
      setConnectingHarnessId(null);
      setWireReady(false);
    }
  }, [wireReady, connectingHarnessId, setConnectingHarnessId, setWireReady]);

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
        && local.workspaceId === activeWorkspaceId;
      const matchesVisibleLocal = matchesLocalOwner
        && currentThreadId === detail.threadId
        && chatInputRef.current?.getText() === local.composerText;
      const matchesRestored = detail.pendingPromptMatched === true
        && currentThreadId === detail.threadId
        && chatInputRef.current?.getText() === detail.pendingPromptComposerText;
      if (!matchesDurable && !matchesLocalOwner && !matchesRestored) return;
      if (matchesDurable) setPendingPromptAcceptance(detail.threadId, null);
      if (matchesLocalOwner) pendingPromptRef.current = null;
      if (!matchesVisibleLocal && !matchesRestored) return;
      setSendingTarget({ threadId: detail.threadId });
      justSentRef.current = true;
      chatInputRef.current?.clearText();
    };
    const handleFailed = (e: Event) => {
      const detail = (e as CustomEvent<{
        threadId?: string;
        pendingPromptMatched?: boolean;
      }>).detail;
      // Acceptance failure is thread-owned. A route-less/global error cannot
      // guess the current pending prompt, even if another producer dispatches
      // this event without the required correlation field.
      if (!detail?.threadId) return;
      const local = pendingPromptRef.current;
      // Failure deliberately retains the restored/current composer draft.
      if (!local) {
        setSendingTarget((target) => {
          if (!target) return null;
          if (target.threadId !== detail.threadId) return target;
          return null;
        });
        return;
      }
      if (detail.threadId !== local.threadId) return;
      pendingPromptRef.current = null;
      setSendingTarget((target) => {
        if (!target) return null;
        if (target.threadId !== local.threadId) return target;
        return null;
      });
    };
    const handleTurnEnded = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId?: string }>).detail;
      if (!detail?.threadId) return;
      setSendingTarget((target) => {
        if (!target) return null;
        if (target.threadId !== detail.threadId) return target;
        return null;
      });
    };
    window.addEventListener('fusion:prompt-accepted', handleAccepted);
    window.addEventListener('fusion:prompt-acceptance-failed', handleFailed);
    window.addEventListener('fusion:turn-ended', handleTurnEnded);
    return () => {
      window.removeEventListener('fusion:prompt-accepted', handleAccepted);
      window.removeEventListener('fusion:prompt-acceptance-failed', handleFailed);
      window.removeEventListener('fusion:turn-ended', handleTurnEnded);
    };
  }, [activeWorkspaceId, currentThreadId, setPendingPromptAcceptance]);

  const isTurnFinalizing = Boolean(pendingTurnEnd || pendingExchangeSaveTurnId);
  const showOrb = (isSendingForCurrentThread || currentTurn?.status === 'streaming') && segments.length === 0 && !isTurnFinalizing;
  const isTurnActive = (!!currentTurn || isSendingForCurrentThread) && !isTurnFinalizing;
  const { isForkThreadDisabled, handleForkThread } = useComposerForkAction({
    currentThreadId,
    currentThread,
    isActive,
    noThread,
    isAcceptancePending,
    isTurnActive,
    isTurnFinalizing,
    messageCount: messages.length,
  });

  const sendToThread = useCallback((threadId: string, text: string) => {
    if (hasPendingAcceptance(threadId)) return;

    if (!activeWorkspaceId) return;
    const attachmentKey = chatAttachmentOwnerKey(activeWorkspaceId, threadId);
    const attachments = useChatFileLinkStore.getState()
      .pendingAttachmentsByOwner[attachmentKey]?.attachments ?? [];
    pendingPromptRef.current = {
      threadId,
      text,
      composerText: chatInputRef.current?.getText() ?? text,
      workspaceId: activeWorkspaceId,
    };
    setPromptRetryDraft(threadId, null);
    setPendingPromptAcceptance(threadId, {
      text,
      composerText: pendingPromptRef.current.composerText,
      workspaceId: activeWorkspaceId,
      attachmentIds: attachments.map((attachment) => attachment.id),
    });

    const state = usePanelStore.getState();
    const cs = state.projectChats[threadId];
    if (cs?.currentTurn) {
      finalizeTurn(threadId);
    }

    sendMessage(text, threadId, attachments);
  }, [activeWorkspaceId, finalizeTurn, hasPendingAcceptance, sendMessage, setPendingPromptAcceptance, setPromptRetryDraft]);

  const handleSend = useCallback((text: string) => {
    const tid = currentThreadId;
    if (!tid) return;
    sendToThread(tid, text);
  }, [currentThreadId, sendToThread]);

  useEffect(() => {
    if (threadIdOverride) return;

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
          if (action.delivery === 'send') {
            sendToThread(msg.threadId, content);
          } else {
            handleReplaceText(content);
          }
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
  }, [threadIdOverride, handleInsertText, handleReplaceText, sendToThread, handleAddAttachment]);

  const handleStop = useCallback(() => {
    const state = usePanelStore.getState();
    const tid = currentThreadId;
    if (!tid || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    const cs = state.projectChats[tid];
    if (cs?.currentTurn) {
      state.setPendingExchangeSave(tid, cs.currentTurn.id);
      state.ws.send(JSON.stringify({ type: 'turn:stop', threadId: tid }));
    }
  }, [currentThreadId]);

  const inputPlaceholder = noThread
    ? ''
    : !isActive
      ? 'Click a thread in this rv-sidebar to activate'
      : undefined;

  return {
    panel,
    toggleCollapsed,
    toggleCliPicker,
    toggleThreadDropdown,
    cliPickerOpen,
    threadDropdownOpen,
    chatHeaderRef,
    lastUserMsgRef,
    chatContainerRef,
    chatInputRef,
    harnessStatuses,
    showCliPicker: selectableHarnesses.length > 1,
    moreMenuOpen,
    setMoreMenuOpen,
    handleInsertText,
    handleRequestDiagnostic,
    handleCopyDiagnostic,
    handleAskAIWithDiagnostic,
    handleAddAttachment,
    currentThreadId,
    currentThread,
    messages,
    currentTurn,
    segments,
    contextUsage,
    tokenUsage,
    connectingHarnessId,
    connectingHarness,
    noThread,
    isActive,
    handleHarnessSelect,
    handleCreateThread,
    handleToggleThreads,
    handleCopyLink,
    handleRename,
    handleViewMarkdown,
    showOrb,
    isTurnActive,
    isTurnFinalizing,
    handleSend,
    handleStop,
    warmCurrentThread,
    isAcceptancePending,
    isForkThreadDisabled,
    handleForkThread,
    inputPlaceholder,
    activeWorkspaceId,
    composerDraft,
    handleComposerDraftChange,
    screenshotOwner,
  };
}
