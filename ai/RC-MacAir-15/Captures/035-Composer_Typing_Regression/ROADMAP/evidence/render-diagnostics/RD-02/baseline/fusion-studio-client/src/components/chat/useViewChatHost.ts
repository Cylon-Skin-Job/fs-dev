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
 * Owner direction 2026-09-19: this host is the production workspace chat
 * composition. `App.tsx` mounts it once per panel through `PanelContent`, so
 * every view's shell chat shows that view's own family; the Legacy null-view
 * population is no longer a production surface.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePanelStore } from '../../state/panelStore';
import { useCliAccentResolver } from '../../hooks/useCliAccentStyle';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { useSelectableHarnesses } from '../../config/harness';
import { useThreadAnimation } from '../sidebar/useThreadAnimation';
import {
  getCurrentThreadGroupId,
  getThreadGroupPopulation,
} from '../../state/slices/chatSurfaceSlice';
import { threadOpenRequest } from '../../lib/ws/threadGroupRows';
import { copyGroupLink, copyGroupMemberLink, deleteGroup, openGroup, openGroupMember, renameGroup, requestGroupMembers, viewGroupMarkdown } from '../../lib/chat/thread-group-command-controller';
import {
  EMPTY_THREAD_MEMBERS,
  threadMembersKey,
} from '../../state/slices/worksurfaceSlice';
import type { ThreadMemberProjection } from '../../state/slices/worksurfaceSlice';
import {
  requestGroupSelection,
  worksurfaceAdapterForView,
} from '../../lib/worksurface/worksurfaceController';
import { useChatSessionHost, type ChatSessionHostProjection } from './useChatSessionHost';
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
  chatHost: ChatSessionHostProjection;
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
  // Observe only member arrays belonging to rows in this exact population.
  // An unrelated view/group response must not re-render this host.
  const memberLists = usePanelStore(useShallow((state) => rows.map((row) => (
    row.threadGroupId
      ? (state.threadMembersByGroup[threadMembersKey(workspaceId, row.threadGroupId)]
        ?? EMPTY_THREAD_MEMBERS)
      : EMPTY_THREAD_MEMBERS
  ))));
  const selectedRow = useMemo(
    () => rows.find((row) => row.threadGroupId === selectedThreadGroupId) ?? null,
    [rows, selectedThreadGroupId],
  );
  const displayThreadId = selectedRow?.threadId ?? '';

  const chatHost = useChatSessionHost({
    panel,
    threadId: displayThreadId || null,
    host: 'main',
    viewId,
    workspaceId,
    threadGroupId: selectedRow?.threadGroupId ?? null,
    threadName: selectedRow?.entry?.name ?? selectedRow?.name ?? '',
    expectedPrimarySequence: selectedRow?.currentPrimarySequence ?? null,
    isActive,
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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
    openGroup({ workspaceId, threadGroupId: row.threadGroupId ?? '', threadId: row.threadId }, viewId);
  }, [workspaceId, viewId]);

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
      renameGroup({ workspaceId, threadGroupId: row.threadGroupId ?? '', threadId: row.threadId }, renameValue);
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, workspaceId]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDelete = useCallback((row: Thread) => {
    deleteGroup({ workspaceId, threadGroupId: row.threadGroupId ?? '', threadId: row.threadId });
  }, [workspaceId]);

  const handleCopyLink = useCallback((row: Thread) => {
    copyGroupLink({ workspaceId, threadGroupId: row.threadGroupId ?? '', threadId: row.threadId });
  }, [workspaceId]);

  const handleViewMarkdown = useCallback((row: Thread) => {
    viewGroupMarkdown({ workspaceId, threadGroupId: row.threadGroupId ?? '', threadId: row.threadId });
  }, [workspaceId]);

  const handleRequestMembers = useCallback((row: Thread) => {
    if (!row.threadGroupId) return;
    requestGroupMembers({ workspaceId, threadGroupId: row.threadGroupId, threadId: row.threadId });
  }, [workspaceId]);

  const handleOpenMember = useCallback((row: Thread, member: ThreadMemberProjection) => {
    if (!row.threadGroupId || !member?.threadId || member.isPrimary) return;
    openGroupMember({ workspaceId, threadGroupId: row.threadGroupId, threadId: row.threadId }, member.threadId);
  }, [workspaceId]);

  const handleCopyLinkMember = useCallback((row: Thread, member: ThreadMemberProjection) => {
    if (!row.threadGroupId || !member?.threadId) return;
    copyGroupMemberLink({ workspaceId, threadGroupId: row.threadGroupId, threadId: row.threadId }, member.threadId);
  }, [workspaceId]);

  const membersForGroup = useCallback((row: Thread): ThreadMemberProjection[] => {
    const index = rows.findIndex((candidate) => candidate.threadGroupId === row.threadGroupId);
    return index >= 0 ? (memberLists[index] ?? EMPTY_THREAD_MEMBERS) : EMPTY_THREAD_MEMBERS;
  }, [memberLists, rows]);

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
