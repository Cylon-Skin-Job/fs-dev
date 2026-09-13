/**
 * @module useSidebar
 * @role Sidebar state, WebSocket handlers, and thread action callbacks.
 */

import { useEffect, useState, useCallback } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { useResolvedHarnessResolver, useSelectableHarnesses } from '../../config/harness';
import { useCliAccentResolver } from '../../hooks/useCliAccentStyle';
import { reorderWithSecondary } from './threadOrderUtils';
import { useThreadAnimation } from './useThreadAnimation';
import {
  threadActionCopyLink,
  threadActionDelete,
  threadActionRename,
  threadActionViewMarkdown,
  threadOpenRequest,
} from '../../lib/ws/threadGroupRows';

export interface UseSidebarOptions {
  panel: string;
}

export function useSidebar({ panel }: UseSidebarOptions) {
  const ws = usePanelStore((state) => state.ws);
  const rawThreads = usePanelStore((state) => state.threads);
  const currentThreadId = usePanelStore((state) => state.currentThreadId);
  const chatActive = usePanelStore((state) => state.chatActive);
  const secondary = usePanelStore((state) => state.secondary);
  const openSecondary = usePanelStore((state) => state.openSecondary);
  const toggleCliPicker = usePanelStore((state) => state.toggleCliPicker);
  const selectHarness = usePanelStore((state) => state.selectHarness);
  const createDefaultAssistantThread = usePanelStore((state) => state.createDefaultAssistantThread);

  const threads = reorderWithSecondary(rawThreads, currentThreadId, secondary?.threadId ?? null);
  const { setThreadRef } = useThreadAnimation(threads);
  const resolveCliAccent = useCliAccentResolver();
  const resolveHarness = useResolvedHarnessResolver();
  const harnessStatuses = useHarnessStatuses();
  const selectableHarnesses = useSelectableHarnesses(harnessStatuses);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.rv-thread-menu-dropdown') || target.closest('.rv-thread-menu-btn')) return;
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpenId]);

  useEffect(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      // The current rail is the workspace Legacy host: query the explicit
      // null-view population rather than relying on an active-panel fallback.
      ws.send(JSON.stringify({ type: 'thread:list', viewId: null }));
    }
  }, [ws, panel]);

  const sendMessage = useCallback((msg: object) => {
    console.log('[Sidebar] Sending:', msg, 'WS state:', ws?.readyState);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.error('[Sidebar] WebSocket not connected! State:', ws?.readyState);
    }
  }, [ws]);

  const handleCreateThread = useCallback(() => {
    if (selectableHarnesses.length <= 1) {
      createDefaultAssistantThread();
      return;
    }
    toggleCliPicker(panel);
  }, [createDefaultAssistantThread, panel, selectableHarnesses.length, toggleCliPicker]);

  const handleHarnessSelect = useCallback((harnessId: string, modelId?: string) => {
    selectHarness(harnessId, modelId);
  }, [selectHarness]);

  const handleOpenThread = useCallback((threadId: string, threadGroupId?: string) => {
    // Rows are groups: open by the visible-row identity when available; the
    // server resolves the authoritative current primary.
    sendMessage(threadOpenRequest(threadGroupId, threadId));
  }, [sendMessage]);

  const handleRenameStart = useCallback((threadId: string, currentName: string) => {
    setRenamingId(threadId);
    setRenameValue(currentName);
  }, []);

  const handleRenameSubmit = useCallback((threadId: string) => {
    if (renameValue.trim()) {
      const thread = threads.find((candidate) => candidate.threadId === threadId);
      // Canonical group action with a durable retry identity. The server owns
      // the title change and acknowledges; no optimistic local rename.
      sendMessage(threadActionRename({
        threadGroupId: thread?.threadGroupId,
        threadId,
        name: renameValue.trim(),
      }));
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, sendMessage, threads]);

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDeleteThread = useCallback((threadId: string) => {
    if (confirm('Delete this conversation?')) {
      const thread = threads.find((candidate) => candidate.threadId === threadId);
      sendMessage(threadActionDelete({
        threadGroupId: thread?.threadGroupId,
        threadId,
      }));
    }
  }, [sendMessage, threads]);

  const handleCopyLink = useCallback((threadId: string) => {
    const thread = threads.find((candidate) => candidate.threadId === threadId);
    // Canonical group action; the server returns the versioned URI and the
    // shared thread:action:completed handler copies the acknowledged value.
    sendMessage(threadActionCopyLink({
      threadGroupId: thread?.threadGroupId,
      threadId,
    }));
  }, [sendMessage, threads]);

  const handleViewMarkdown = useCallback((threadId: string) => {
    const thread = threads.find((candidate) => candidate.threadId === threadId);
    // Canonical exact-member action; the server returns the validated mirror
    // path and the shared handler opens it in the File Viewer.
    sendMessage(threadActionViewMarkdown({
      threadGroupId: thread?.threadGroupId,
      threadId,
    }));
  }, [sendMessage, threads]);

  const isActive = chatActive;
  const headerLabel = 'Project';

  return {
    panel,
    threads,
    currentThreadId,
    secondary,
    openSecondary,
    setThreadRef,
    resolveCliAccent,
    resolveHarness,
    harnessStatuses,
    showCliPicker: selectableHarnesses.length > 1,
    handleCreateThread,
    handleHarnessSelect,
    renamingId,
    renameValue,
    setRenameValue,
    menuOpenId,
    setMenuOpenId,
    handleOpenThread,
    handleRenameStart,
    handleRenameSubmit,
    handleRenameCancel,
    handleDeleteThread,
    handleCopyLink,
    handleViewMarkdown,
    sendMessage,
    isActive,
    headerLabel,
  };
}
