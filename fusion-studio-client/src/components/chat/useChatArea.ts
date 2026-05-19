/**
 * @module useChatArea
 * @role Chat state, send/stop handlers, and scroll/orb effects for ChatArea.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useResolvedHarness } from '../../config/harness';
import { useCliAccentResolver } from '../../hooks/useCliAccentStyle';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { threadLinkIntent } from '../../lib/thread-link-intent';
import type { ChatInputRef } from '../ChatInput';
import type { Scope } from '../../types';
import { EMPTY_MESSAGES, EMPTY_SEGMENTS, selectChatState } from './chatAreaConstants';

export interface UseChatAreaOptions {
  panel: string;
  scope: Scope;
  threadIdOverride?: string | null;
}

export function useChatArea({ panel, scope, threadIdOverride }: UseChatAreaOptions) {
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
  const [isSending, setIsSending] = useState(false);
  const connectingHarnessId = usePanelStore((s) => s.connectingHarnessId);
  const setConnectingHarnessId = usePanelStore((s) => s.setConnectingHarnessId);
  const selectHarness = usePanelStore((s) => s.selectHarness);
  const harnessStatuses = useHarnessStatuses();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleInsertText = useCallback((text: string) => {
    chatInputRef.current?.insertText(text);
  }, []);

  useEffect(() => {
    if (threadIdOverride) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string') handleInsertText(text);
    };
    window.addEventListener('fusion:chat-insert', handler);
    return () => window.removeEventListener('fusion:chat-insert', handler);
  }, [threadIdOverride, handleInsertText]);

  const primaryThreadId = usePanelStore((state) => state.currentThreadIds[scope]);
  const currentThreadId = threadIdOverride ?? primaryThreadId;
  const selector = selectChatState(scope, panel, currentThreadId);
  const messages = usePanelStore((state) => selector(state)?.messages ?? EMPTY_MESSAGES);
  const currentTurn = usePanelStore((state) => selector(state)?.currentTurn ?? null);
  const segments = usePanelStore((state) => selector(state)?.segments ?? EMPTY_SEGMENTS);
  const contextUsage = usePanelStore((state) => state.contextUsage);
  const currentScope = usePanelStore((state) => state.currentScope);
  const wireReady = usePanelStore((state) => state.wireReady);
  const threads = usePanelStore((state) => state.threads[scope]);
  const currentThread = threads.find((t) => t.threadId === currentThreadId);
  const resolvedHarness = useResolvedHarness(currentThread?.entry?.harnessId);
  const connectingHarness = useResolvedHarness(connectingHarnessId);
  const identity = resolvedHarness
    ? { name: resolvedHarness.name, icon: resolvedHarness.materialIcon, accentColor: resolvedHarness.accentColor }
    : { name: 'Unknown', icon: 'help', accentColor: undefined };
  const resolveCliAccent = useCliAccentResolver();
  const setWireReady = usePanelStore((state) => state.setWireReady);

  const addMessage = usePanelStore((state) => state.addMessage);
  const sendMessage = usePanelStore((state) => state.sendMessage);
  const finalizeTurn = usePanelStore((state) => state.finalizeTurn);

  const noThread = !currentThreadId;
  const isActive = currentScope === scope;

  const handleHarnessSelect = useCallback((harnessId: string) => {
    selectHarness(harnessId, scope);
  }, [selectHarness, scope]);

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
    const tid = store.currentThreadIds.project;
    const socket = store.ws;
    if (tid && socket && socket.readyState === WebSocket.OPEN) {
      threadLinkIntent.set('copy');
      socket.send(JSON.stringify({ type: 'thread:copyLink', scope: 'project', threadId: tid }));
    }
    setMoreMenuOpen(false);
  }, []);

  const handleRename = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadIds.project;
    const socket = store.ws;
    setMoreMenuOpen(false);
    if (!tid || !socket || socket.readyState !== WebSocket.OPEN) return;
    const current = store.threads.project.find((t) => t.threadId === tid);
    const currentName = current?.entry?.name ?? '';
    const next = window.prompt('Rename thread:', currentName);
    const trimmed = next?.trim();
    if (trimmed && trimmed !== currentName) {
      socket.send(JSON.stringify({
        type: 'thread:rename',
        scope: 'project',
        threadId: tid,
        name: trimmed,
      }));
    }
  }, []);

  const handleViewMarkdown = useCallback(() => {
    const store = usePanelStore.getState();
    const tid = store.currentThreadIds.project;
    const socket = store.ws;
    if (tid && socket && socket.readyState === WebSocket.OPEN) {
      threadLinkIntent.set('view');
      socket.send(JSON.stringify({ type: 'thread:copyLink', scope: 'project', threadId: tid }));
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
    if (segments.length > 0) {
      setIsSending(false);
    }
  }, [segments.length]);

  const showOrb = (isSending || currentTurn?.status === 'streaming') && segments.length === 0;
  const isTurnActive = !!currentTurn || isSending;

  const handleSend = useCallback((text: string) => {
    setIsSending(true);

    const state = usePanelStore.getState();
    const tid = scope === 'project' ? currentThreadId : null;
    const cs = scope === 'project'
      ? (tid ? state.projectChats[tid] : undefined)
      : state.panels[panel];
    if (cs?.currentTurn) {
      finalizeTurn(scope, tid);
    }

    justSentRef.current = true;
    addMessage(scope, tid, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: Date.now(),
    });

    sendMessage(text, scope, tid);
  }, [scope, panel, currentThreadId, finalizeTurn, addMessage, sendMessage]);

  const handleStop = useCallback(() => {
    const state = usePanelStore.getState();
    const tid = scope === 'project' ? currentThreadId : null;
    const cs = scope === 'project'
      ? (tid ? state.projectChats[tid] : undefined)
      : state.panels[panel];
    if (cs?.currentTurn) {
      finalizeTurn(scope, tid);
    }
    setIsSending(false);
  }, [scope, panel, currentThreadId, finalizeTurn]);

  const inputPlaceholder = noThread
    ? ''
    : !isActive
      ? 'Click a thread in this rv-sidebar to activate'
      : undefined;

  return {
    panel,
    scope,
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
    moreMenuOpen,
    setMoreMenuOpen,
    handleInsertText,
    currentThreadId,
    currentThread,
    messages,
    currentTurn,
    segments,
    contextUsage,
    connectingHarnessId,
    connectingHarness,
    identity,
    resolveCliAccent,
    noThread,
    isActive,
    handleHarnessSelect,
    handleToggleThreads,
    handleCopyLink,
    handleRename,
    handleViewMarkdown,
    showOrb,
    isTurnActive,
    handleSend,
    handleStop,
    inputPlaceholder,
  };
}
