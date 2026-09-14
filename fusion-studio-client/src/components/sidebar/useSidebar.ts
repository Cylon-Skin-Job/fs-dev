/**
 * @module useSidebar
 * @role Connected Legacy rail host: population reads, list-request ownership,
 *       and canonical thread-action intents for the portable `ThreadRail`.
 *
 * SPEC-02 §6.1: the rail reads the explicit `{activeWorkspaceId, viewId: null}`
 * Legacy population and its selected group. Only the active panel host issues
 * the qualified `thread:list` request; inactive mounted panels render cached
 * state and never solicit or steal selection.
 */

import { useEffect, useState, useCallback } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { useResolvedHarnessResolver, useSelectableHarnesses } from '../../config/harness';
import { useCliAccentResolver } from '../../hooks/useCliAccentStyle';
import { reorderWithSecondary } from './threadOrderUtils';
import { useThreadAnimation } from './useThreadAnimation';
import {
  EMPTY_THREAD_GROUP_POPULATION,
  getCurrentThreadGroupId,
} from '../../state/slices/chatSurfaceSlice';
import {
  threadActionCopyLink,
  threadActionDelete,
  threadActionRename,
  threadActionViewMarkdown,
  threadOpenRequest,
} from '../../lib/ws/threadGroupRows';
import type { Thread } from '../../types';

export interface UseSidebarOptions {
  panel: string;
  /** Whether this panel is the shell's active panel (list-request ownership). */
  isActive?: boolean;
}

export function useSidebar({ panel, isActive = true }: UseSidebarOptions) {
  const ws = usePanelStore((state) => state.ws);
  const workspaceId = usePanelStore((state) => state.activeWorkspaceId);
  const rawThreads = usePanelStore((state) => state.threads);
  const population = usePanelStore((state) => {
    if (!state.activeWorkspaceId) return EMPTY_THREAD_GROUP_POPULATION;
    const map = state.legacyThreadGroupsByWorkspaceId;
    return map[state.activeWorkspaceId] !== undefined
      ? map[state.activeWorkspaceId]
      : state.threads;
  });
  const currentThreadId = usePanelStore((state) => state.currentThreadId);
  const selectedThreadGroupId = usePanelStore(
    (state) => getCurrentThreadGroupId(state, state.activeWorkspaceId, null),
  );
  const chatActive = usePanelStore((state) => state.chatActive);
  const secondary = usePanelStore((state) => state.secondary);
  const openSecondary = usePanelStore((state) => state.openSecondary);
  const toggleCliPicker = usePanelStore((state) => state.toggleCliPicker);
  const selectHarness = usePanelStore((state) => state.selectHarness);
  const createDefaultAssistantThread = usePanelStore((state) => state.createDefaultAssistantThread);

  const threads = reorderWithSecondary(
    population.length > 0 ? population : rawThreads,
    currentThreadId,
    secondary?.threadId ?? null,
  );
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
    // SPEC-02 §6.1: only the active connected host solicits its population.
    // An inactive mounted panel renders cached state and issues no request.
    if (!isActive) return;
    if (!workspaceId) return;
    if (ws?.readyState === WebSocket.OPEN) {
      // Explicit null-view Legacy population; never an active-panel fallback.
      ws.send(JSON.stringify({ type: 'thread:list', viewId: null }));
    }
  }, [ws, panel, isActive, workspaceId]);

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

  const handleOpenThread = useCallback((row: Thread) => {
    // Rows are groups: open by the visible-row identity; the server resolves
    // the authoritative current primary. Record the exact correlated request
    // for the Legacy population so a late response cannot steal selection
    // (SPEC-02 §6.1).
    usePanelStore.getState().requestThreadOpen({
      workspaceId,
      viewId: null,
      threadId: row.threadId,
      threadGroupId: row.threadGroupId,
    });
    sendMessage(threadOpenRequest(row.threadGroupId, row.threadId));
  }, [sendMessage, workspaceId]);

  const handleOpenSecondary = useCallback((row: Thread) => {
    openSecondary(row.threadId);
  }, [openSecondary]);

  const sideChatDisabledReason = useCallback((row: Thread): string | null => {
    if (currentThreadId === row.threadId) return 'Already primary';
    if (secondary) return 'Close the current secondary first';
    return null;
  }, [currentThreadId, secondary]);

  const handleRenameStart = useCallback((row: Thread) => {
    setRenamingId(row.threadId);
    setRenameValue(row.entry?.name || '');
  }, []);

  const handleRenameSubmit = useCallback((row: Thread) => {
    if (renameValue.trim()) {
      // Canonical group action with a durable retry identity. The server owns
      // the title change and acknowledges; no optimistic local rename.
      sendMessage(threadActionRename({
        threadGroupId: row.threadGroupId,
        threadId: row.threadId,
        name: renameValue.trim(),
      }));
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, sendMessage]);

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDeleteThread = useCallback((row: Thread) => {
    if (confirm('Delete this conversation?')) {
      sendMessage(threadActionDelete({
        threadGroupId: row.threadGroupId,
        threadId: row.threadId,
      }));
    }
  }, [sendMessage]);

  const handleCopyLink = useCallback((row: Thread) => {
    // Canonical group action; the server returns the versioned URI and the
    // shared thread:action:completed handler copies the acknowledged value.
    sendMessage(threadActionCopyLink({
      threadGroupId: row.threadGroupId,
      threadId: row.threadId,
    }));
  }, [sendMessage]);

  const handleViewMarkdown = useCallback((row: Thread) => {
    // Canonical exact-member action; the server returns the validated mirror
    // path and the shared handler opens it in the File Viewer.
    sendMessage(threadActionViewMarkdown({
      threadGroupId: row.threadGroupId,
      threadId: row.threadId,
    }));
  }, [sendMessage]);

  const isActiveStyle = chatActive;
  const headerLabel = 'Project';

  return {
    panel,
    threads,
    currentThreadId,
    selectedThreadGroupId,
    secondary,
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
    handleOpenSecondary,
    sideChatDisabledReason,
    handleRenameStart,
    handleRenameSubmit,
    handleRenameCancel,
    handleDeleteThread,
    handleCopyLink,
    handleViewMarkdown,
    sendMessage,
    isActive: isActiveStyle,
    headerLabel,
  };
}
