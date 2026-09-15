/**
 * @module useViewChatHost
 * @role Connected host for one explicit `{workspaceId, viewId}` ThreadedChat
 *       population (SPEC-02 §5.2/§6.1, Slice 02B).
 *
 * Reads only its own composite population and selected group, issues only its
 * own qualified `thread:list` while it is the active host, records every
 * `thread:open` request through the shared correlation state, and mounts the
 * selected group's Main Chat through the existing `ChatSurface` session
 * machinery (session truth stays keyed by `threadId`).
 *
 * This module never places a view-bound rail into production view chrome; the
 * PRODUCTION workspace chat remains the Legacy host (`viewId: null`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useCliAccentResolver } from '../../hooks/useCliAccentStyle';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { useSelectableHarnesses } from '../../config/harness';
import { useThreadAnimation } from '../sidebar/useThreadAnimation';
import {
  getCurrentThreadGroupId,
  getThreadGroupPopulation,
} from '../../state/slices/chatSurfaceSlice';
import {
  threadActionCopyLink,
  threadActionDelete,
  threadActionOpenMemberInSide,
  threadActionRename,
  threadActionViewMarkdown,
  threadMembersRequest,
  threadOpenRequest,
} from '../../lib/ws/threadGroupRows';
import { getThreadMembers } from '../../state/slices/worksurfaceSlice';
import type { ThreadMemberProjection } from '../../state/slices/worksurfaceSlice';
import {
  requestGroupSelection,
  worksurfaceAdapterForView,
} from '../../lib/worksurface/worksurfaceController';
import { useLegacyChatHost, type LegacyChatHostProjection } from './useLegacyChatHost';
import type { ThreadRailProps } from './ThreadRail';
import type { HarnessStatus, Thread } from '../../types';

export interface UseViewChatHostOptions {
  panel: string;
  workspaceId: string;
  viewId: string;
  /** Whether this view host is the active connected host. */
  isActive?: boolean;
}

/** Rail props the connected host owns; the component adds view/CLI chrome. */
export type ViewChatRailProjection = Omit<
  ThreadRailProps,
  'threadView' | 'onThreadViewChange' | 'cliPicker'
>;

export interface ViewChatHostProjection {
  rail: ViewChatRailProjection;
  chatHost: LegacyChatHostProjection;
  showCliPicker: boolean;
  harnessStatuses: Record<string, HarnessStatus>;
  handleHarnessSelect: (harnessId: string, modelId?: string) => void;
}

export function useViewChatHost({
  panel,
  workspaceId,
  viewId,
  isActive = true,
}: UseViewChatHostOptions): ViewChatHostProjection {
  const ws = usePanelStore((state) => state.ws);
  const rows = usePanelStore(
    (state) => getThreadGroupPopulation(state, workspaceId, viewId),
  );
  const selectedThreadGroupId = usePanelStore(
    (state) => getCurrentThreadGroupId(state, workspaceId, viewId),
  );
  // Subscribe to the ordered member projections so a menu opened before the
  // `thread:members` response lands re-renders with the member list.
  const threadMembersByGroup = usePanelStore((state) => state.threadMembersByGroup);
  const selectedRow = useMemo(
    () => rows.find((row) => row.threadGroupId === selectedThreadGroupId) ?? null,
    [rows, selectedThreadGroupId],
  );
  const displayThreadId = selectedRow?.threadId ?? '';

  const chatHost = useLegacyChatHost({
    panel,
    threadId: displayThreadId || null,
    host: 'main',
    viewId,
    workspaceId,
    threadGroupId: selectedRow?.threadGroupId ?? null,
    expectedPrimarySequence: selectedRow?.currentPrimarySequence ?? null,
    explicitTarget: true,
    isActive,
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const resolveCliAccent = useCliAccentResolver();
  const harnessStatuses = useHarnessStatuses();
  const selectableHarnesses = useSelectableHarnesses(harnessStatuses);
  const { setThreadRef } = useThreadAnimation(rows);

  const sendMessage = useCallback((msg: object) => {
    const socket = usePanelStore.getState().ws;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }, []);

  // Request ownership: only the active host asks for its own population, once
  // per mounted connection/address. An inactive mounted host issues nothing.
  // 02B advisory A-1: the request is generation-aware — a reconnected socket
  // (new `ws` identity) re-issues its qualified `thread:list` even for the
  // same address, so a reconnect cannot be left with a stale population.
  const requestedForRef = useRef<{ address: string; ws: WebSocket } | null>(null);
  useEffect(() => {
    if (!isActive) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const address = `${workspaceId}::${viewId}`;
    if (requestedForRef.current?.address === address && requestedForRef.current.ws === ws) {
      return;
    }
    requestedForRef.current = { address, ws };
    ws.send(JSON.stringify({ type: 'thread:list', viewId }));
  }, [isActive, ws, workspaceId, viewId]);

  // MRU auto-open for this exact population, active host only. A view with a
  // registered worksurface adapter routes first selection through the
  // acknowledgement-gated group switch so the exact stored content is restored.
  useEffect(() => {
    if (!isActive) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (selectedThreadGroupId || rows.length === 0) return;
    const mru = rows[0];
    if (!mru.threadGroupId) return;
    if (worksurfaceAdapterForView(viewId)
      && requestGroupSelection(workspaceId, viewId, mru.threadGroupId)) {
      return;
    }
    usePanelStore.getState().requestThreadOpen({
      workspaceId,
      viewId,
      threadId: mru.threadId,
      threadGroupId: mru.threadGroupId,
    });
    ws.send(JSON.stringify(threadOpenRequest(mru.threadGroupId, mru.threadId)));
  }, [isActive, ws, workspaceId, viewId, selectedThreadGroupId, rows]);

  const handleOpenThread = useCallback((row: Thread) => {
    // CHAT-03 / SPEC-03 §6.1: when this view is worksurface-capable, selecting
    // another group flushes the outgoing capture first and keeps the outgoing
    // group selected until the correlated server acknowledgement lands.
    if (worksurfaceAdapterForView(viewId)
      && row.threadGroupId
      && requestGroupSelection(workspaceId, viewId, row.threadGroupId)) {
      return;
    }
    usePanelStore.getState().requestThreadOpen({
      workspaceId,
      viewId,
      threadId: row.threadId,
      threadGroupId: row.threadGroupId,
    });
    sendMessage(threadOpenRequest(row.threadGroupId, row.threadId));
  }, [sendMessage, workspaceId, viewId]);

  const handleCreateThread = useCallback(() => {
    // Bind the new group to this exact view, never the active panel.
    sendMessage({ type: 'thread:open-assistant', viewId });
  }, [sendMessage, viewId]);

  const handleStartRename = useCallback((row: Thread) => {
    setRenamingId(row.threadId);
    setRenameValue(row.entry?.name || '');
  }, []);

  const handleSubmitRename = useCallback((row: Thread) => {
    if (renameValue.trim()) {
      sendMessage(threadActionRename({
        threadGroupId: row.threadGroupId,
        threadId: row.threadId,
        name: renameValue.trim(),
      }));
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, sendMessage]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDelete = useCallback((row: Thread) => {
    if (confirm('Delete this conversation?')) {
      sendMessage(threadActionDelete({
        threadGroupId: row.threadGroupId,
        threadId: row.threadId,
      }));
    }
  }, [sendMessage]);

  const handleCopyLink = useCallback((row: Thread) => {
    sendMessage(threadActionCopyLink({
      threadGroupId: row.threadGroupId,
      threadId: row.threadId,
    }));
  }, [sendMessage]);

  const handleViewMarkdown = useCallback((row: Thread) => {
    sendMessage(threadActionViewMarkdown({
      threadGroupId: row.threadGroupId,
      threadId: row.threadId,
    }));
  }, [sendMessage]);

  const handleRequestMembers = useCallback((row: Thread) => {
    if (!row.threadGroupId) return;
    sendMessage(threadMembersRequest(row.threadGroupId));
  }, [sendMessage]);

  const handleOpenMember = useCallback((row: Thread, member: ThreadMemberProjection) => {
    if (!row.threadGroupId || !member?.threadId || member.isPrimary) return;
    sendMessage(threadActionOpenMemberInSide({
      threadGroupId: row.threadGroupId,
      threadId: member.threadId,
    }));
  }, [sendMessage]);

  const handleCopyLinkMember = useCallback((row: Thread, member: ThreadMemberProjection) => {
    if (!row.threadGroupId || !member?.threadId) return;
    sendMessage(threadActionCopyLink({
      threadGroupId: row.threadGroupId,
      threadId: member.threadId,
    }));
  }, [sendMessage]);

  const membersForGroup = useCallback((row: Thread): ThreadMemberProjection[] => {
    void threadMembersByGroup;
    return getThreadMembers(
      usePanelStore.getState(),
      workspaceId,
      row.threadGroupId ?? '',
    );
  }, [threadMembersByGroup, workspaceId]);

  const handleHarnessSelect = useCallback((harnessId: string, modelId?: string) => {
    usePanelStore.getState().selectHarness(harnessId, modelId);
  }, []);

  const rail: ViewChatRailProjection = {
    panel,
    rows,
    selectedThreadGroupId,
    selectedThreadId: displayThreadId || null,
    isActive,
    // Explicit view hosts own no shell rail-collapse; the rail still renders
    // the shared dock control and invokes the connected callback.
    onTogglePinned: () => undefined,
    onCreateThread: handleCreateThread,
    resolveCliAccent,
    setThreadRef,
    renamingId,
    renameValue,
    setRenameValue,
    menuOpenId,
    setMenuOpenId,
    onOpenThread: handleOpenThread,
    onStartRename: handleStartRename,
    onSubmitRename: handleSubmitRename,
    onCancelRename: handleCancelRename,
    onDelete: handleDelete,
    onCopyLink: handleCopyLink,
    onViewMarkdown: handleViewMarkdown,
    membersForGroup,
    onOpenMember: handleOpenMember,
    onCopyLinkMember: handleCopyLinkMember,
    onRequestMembers: handleRequestMembers,
  };

  return {
    rail,
    chatHost,
    showCliPicker: selectableHarnesses.length > 1,
    harnessStatuses,
    handleHarnessSelect,
  };
}
