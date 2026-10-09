/**
 * @module useChatSessionHost
 * @role Connected presentation projection for one explicit view-bound session.
 *
 * Every durable identity is supplied by the caller. Draft, completed history,
 * live-turn and submission observation remains in connected leaves; this host
 * observes only stable shell/header/composer projections for its exact session.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useResolvedHarness, useSelectableHarnesses } from '../../config/harness';
import { useHarnessStatuses } from '../../hooks/useHarnessStatuses';
import { selectionForThread } from '../../state/slices/chatSurfaceSlice';
import { useChatMountInteractions } from './useChatMountInteractions';
import { useChatSurfaceIdentity } from './useChatSurfaceIdentity';
import { useChatSessionActions } from './useChatSessionActions';
import type {
  ChatMountIdentity,
  ChatSurfaceActions,
  ChatSurfaceComposerPresentation,
  ChatSurfaceHeaderPresentation,
  ChatSurfaceHostKind,
  ChatSurfaceRefs,
  ChatSurfaceShellPresentation,
} from './chatSurfaceContract';

export interface UseChatSessionHostOptions {
  panel: string;
  workspaceId: string;
  viewId: string;
  threadGroupId: string | null;
  threadId: string | null;
  host: ChatSurfaceHostKind;
  threadName?: string;
  expectedPrimarySequence?: number | null;
  sidebarCollapsed?: boolean;
  contentCollapsed?: boolean;
  isActive?: boolean;
  /** Component-backed mounts may supply their descriptor-derived surface id. */
  surfaceId?: string;
  componentInstanceId?: string;
}

export interface ChatSessionHostProjection {
  identity: ChatMountIdentity;
  shell: ChatSurfaceShellPresentation;
  header: ChatSurfaceHeaderPresentation;
  composer: ChatSurfaceComposerPresentation;
  actions: ChatSurfaceActions;
  refs: ChatSurfaceRefs;
  onToggleThreads: () => void;
  onToggleContent: () => void;
}

export function useChatSessionHost({
  panel,
  workspaceId,
  viewId,
  threadGroupId: threadGroupIdProp,
  threadId: threadIdProp,
  host,
  threadName = '',
  expectedPrimarySequence = null,
  sidebarCollapsed = false,
  contentCollapsed = false,
  isActive: isActivePanel = true,
  surfaceId: surfaceIdProp,
  componentInstanceId,
}: UseChatSessionHostOptions): ChatSessionHostProjection {
  const mintedSurfaceId = useChatSurfaceIdentity(host);
  const surfaceId = surfaceIdProp ?? mintedSurfaceId;
  const threadId = threadIdProp ?? '';
  const threadGroupId = threadGroupIdProp ?? '';
  const hasThread = Boolean(threadId);

  const wireReadyForThread = usePanelStore(
    (state) => (hasThread ? (state.wireReadyByThread[threadId] ?? false) : false),
  );
  const harnessSelection = usePanelStore(
    (state) => selectionForThread(state, hasThread ? threadId : null),
  );
  const surfaceConnectingHarnessId = usePanelStore(
    (state) => state.connectingHarnessBySurface[surfaceId] ?? null,
  );
  const clearConnectingHarnessForSurface = usePanelStore(
    (state) => state.clearConnectingHarnessForSurface,
  );
  const surfaceConnectingHarness = useResolvedHarness(surfaceConnectingHarnessId);
  const harnessStatuses = useHarnessStatuses();
  const selectableHarnesses = useSelectableHarnesses(harnessStatuses);
  const mount = useChatMountInteractions(workspaceId, threadId);
  // Each owner tuple gets a separate adapter slot; stale action closures cannot read a rebound editor.
  const materialRef = useMemo(() => ({ current: null }),
    [workspaceId, viewId, threadGroupId, threadId, surfaceId, host, componentInstanceId]);
  const refs = useMemo(() => ({ ...mount.refs, materialRef }), [mount.refs, materialRef]);
  const isActive = hasThread && isActivePanel;

  const actionProjection = useChatSessionActions({
    panel,
    workspaceId,
    viewId,
    threadGroupId,
    threadId,
    surfaceId,
    host,
    expectedPrimarySequence,
    isActive,
    selectableHarnessCount: selectableHarnesses.length,
    setCliPickerOpen: mount.setCliPickerOpen,
    materialRef,
  });

  useEffect(() => {
    if (!wireReadyForThread || !surfaceConnectingHarnessId) return;
    clearConnectingHarnessForSurface(surfaceId);
  }, [
    clearConnectingHarnessForSurface,
    surfaceConnectingHarnessId,
    surfaceId,
    wireReadyForThread,
  ]);

  useEffect(() => () => {
    clearConnectingHarnessForSurface(surfaceId);
  }, [clearConnectingHarnessForSurface, surfaceId]);

  const onActivate = useCallback(() => usePanelStore.getState().activateMountedChat(surfaceId), [surfaceId]);
  const identity = useMemo<ChatMountIdentity>(() => ({
    workspaceId,
    viewId,
    threadGroupId,
    threadId,
    surfaceId,
    host,
    componentInstanceId,
  }), [componentInstanceId, host, surfaceId, threadGroupId, threadId, viewId, workspaceId]);

  const shell = useMemo<ChatSurfaceShellPresentation>(() => ({
    hasThread,
    isActive,
    isSendingForCurrentThread: mount.isSendingForCurrentThread,
    connectingHarnessName: surfaceConnectingHarness?.name ?? null,
    isThreadsCollapsed: sidebarCollapsed || host === 'side-tab',
    isContentCollapsed: contentCollapsed,
  }), [
    contentCollapsed,
    hasThread,
    host,
    isActive,
    mount.isSendingForCurrentThread,
    sidebarCollapsed,
    surfaceConnectingHarness?.name,
  ]);

  const header = useMemo<ChatSurfaceHeaderPresentation>(() => ({
    threadName,
    harnessStatuses,
    showCliPicker: selectableHarnesses.length > 1,
    cliPickerOpen: mount.cliPickerOpen,
    canMoveToSideChatBase: host === 'main'
      && Boolean(threadGroupId)
      && hasThread
      && Number.isInteger(expectedPrimarySequence)
      && harnessSelection.pending === null,
  }), [
    expectedPrimarySequence,
    harnessSelection.pending,
    harnessStatuses,
    hasThread,
    host,
    mount.cliPickerOpen,
    selectableHarnesses.length,
    threadGroupId,
    threadName,
  ]);

  const composer = useMemo<ChatSurfaceComposerPresentation>(() => ({
    modelSelection: {
      modelId: harnessSelection.acknowledged.model,
      variant: harnessSelection.acknowledged.variant,
      pending: harnessSelection.pending !== null,
    },
  }), [
    harnessSelection.acknowledged.model,
    harnessSelection.acknowledged.variant,
    harnessSelection.pending,
  ]);

  return {
    identity,
    shell,
    header,
    composer,
    actions: { ...actionProjection.actions, onActivate },
    refs,
    onToggleThreads: actionProjection.onToggleThreads,
    onToggleContent: actionProjection.onToggleContent,
  };
}
