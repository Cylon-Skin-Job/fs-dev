/**
 * @module useSidebar
 * @role Sidebar state, WebSocket handlers, and thread action callbacks.
 */

import { useEffect, useState, useCallback } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useFileStore } from '../../state/fileStore';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { threadLinkIntent } from '../../lib/thread-link-intent';
import { showToast } from '../../lib/toast';
import { useResolvedHarnessResolver, useSelectableHarnesses } from '../../config/harness';
import { useCliAccentResolver } from '../../hooks/useCliAccentStyle';
import type { Scope } from '../../types';
import { reorderWithSecondary } from './threadOrderUtils';
import { useThreadAnimation } from './useThreadAnimation';

export interface UseSidebarOptions {
  panel: string;
  scope: Scope;
}

export function useSidebar({ panel, scope }: UseSidebarOptions) {
  const config = usePanelStore((s) => s.getPanelConfig(panel));
  const ws = usePanelStore((state) => state.ws);
  const rawThreads = usePanelStore((state) => state.threads[scope]);
  const currentThreadId = usePanelStore((state) => state.currentThreadIds[scope]);
  const currentScope = usePanelStore((state) => state.currentScope);
  const secondary = usePanelStore((state) => state.secondary);
  const openSecondary = usePanelStore((state) => state.openSecondary);
  const toggleCliPicker = usePanelStore((state) => state.toggleCliPicker);
  const selectHarness = usePanelStore((state) => state.selectHarness);
  const createDefaultAssistantThread = usePanelStore((state) => state.createDefaultAssistantThread);
  const setCurrentThreadId = usePanelStore((state) => state.setCurrentThreadId);

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
      ws.send(JSON.stringify({ type: 'thread:list', scope }));
    }
  }, [ws, panel, scope]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'thread:link') {
          if (!msg.filePath) return;
          const intent = threadLinkIntent.consume();
          if (intent === 'view') {
            const aiIdx = msg.filePath.indexOf('ai/');
            const relPath = aiIdx >= 0 ? msg.filePath.slice(aiIdx) : msg.filePath;
            const store = usePanelStore.getState();
            store.setCurrentPanel('file-viewer');
            const name = relPath.split('/').pop() || relPath;
            const { shouldFetch } = useFileStore.getState().openFileTab({
              path: relPath,
              name,
              type: 'file',
              extension: 'md',
            });
            if (shouldFetch) {
              ws.send(JSON.stringify({
                type: 'file_content_request',
                panel: 'file-viewer',
                path: relPath,
              }));
            }
          } else {
            navigator.clipboard.writeText(msg.filePath).then(() => {
              console.log('[Sidebar] Copied link to clipboard:', msg.filePath);
              showToast('Thread link copied');
            }).catch((err) => {
              console.error('[Sidebar] Failed to copy link:', err);
            });
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

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
      createDefaultAssistantThread(scope);
      return;
    }
    toggleCliPicker(panel);
  }, [createDefaultAssistantThread, panel, scope, selectableHarnesses.length, toggleCliPicker]);

  const handleHarnessSelect = useCallback((harnessId: string) => {
    selectHarness(harnessId, scope);
  }, [selectHarness, scope]);

  const handleOpenThread = useCallback((threadId: string) => {
    if (scope === 'view') {
      setCurrentThreadId(scope, threadId);
    }
    sendMessage({ type: 'thread:open', scope, threadId });
  }, [sendMessage, setCurrentThreadId, scope]);

  const handleRenameStart = useCallback((threadId: string, currentName: string) => {
    setRenamingId(threadId);
    setRenameValue(currentName);
  }, []);

  const handleRenameSubmit = useCallback((threadId: string) => {
    if (renameValue.trim()) {
      sendMessage({
        type: 'thread:rename',
        scope,
        threadId,
        name: renameValue.trim(),
      });
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, sendMessage, scope]);

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDeleteThread = useCallback((threadId: string) => {
    if (confirm('Delete this conversation?')) {
      sendMessage({ type: 'thread:delete', scope, threadId });
    }
  }, [sendMessage, scope]);

  const handleCopyLink = useCallback((threadId: string) => {
    sendMessage({ type: 'thread:copyLink', scope, threadId });
  }, [sendMessage, scope]);

  const handleViewMarkdown = useCallback((threadId: string) => {
    threadLinkIntent.set('view');
    sendMessage({ type: 'thread:copyLink', scope, threadId });
  }, [sendMessage, scope]);

  const isActive = currentScope === scope;
  const headerLabel = scope === 'project' ? 'Project' : (config?.name || panel);

  return {
    panel,
    scope,
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
