/**
 * @module useSideChatRailAdapter
 * @role Connected store-owning hook for the code-owned SPEC-04 Side Chat rail
 *       composition (SPEC-04 §6/§11 04A–04B).
 *
 * It is the single composition seam above the existing view/tab adapter
 * lookup:
 *   - native-adapted views (`file-viewer`, `capture-viewer`) keep their
 *     adapter as the native-tab owner; the hook composes managed Side Chat
 *     descriptors into the same visible ordered rail and delegates native
 *     actions unchanged (SPEC-04 §6);
 *   - every other registered chat-capable view is an adapterless host; the
 *     bridge activates only while at least one open managed placement exists,
 *     constructs a runtime-only root descriptor for the existing child, and
 *     appends managed Side Chats.
 *
 * With no open placement the hook returns the base model unchanged (native) or
 * null (adapterless), so the non-Move path is byte-identical. It never reads
 * primary history, never invents a placement, and never persists any transient
 * identity.
 */

import { useMemo } from 'react';
import { readOpenSideChatPlacements } from '../../lib/chat/side-chat-placements';
import { usePanelStore } from '../../state/panelStore';
import { getCurrentThreadGroupId } from '../../state/slices/chatSurfaceSlice';
import {
  getActiveSideChatPlacement,
  getWorksurfaceBinding,
  worksurfaceEntryKey,
} from '../../state/slices/worksurfaceSlice';
import { closeSideChatPlacement } from '../../lib/worksurface/worksurfaceController';
import type { ThreadWorksurfaceEntry } from '../../lib/worksurface/types';
import type { ViewTabAdapterModel } from '../view-tabs/viewTabAdapters';
import {
  composeAdapterlessSideChatRail,
  composeSideChatAdapter,
  type SideChatBridgeContext,
} from './sideChatBridge';

/** Views whose own adapter owns the native tabs (SPEC-04 §6). */
const NATIVE_ADAPTED_VIEWS = new Set(['file-viewer', 'capture-viewer']);

function firstGroupWithOpenPlacement(
  entries: Record<string, ThreadWorksurfaceEntry | null> | undefined,
  workspaceId: string,
  viewId: string,
): string | null {
  if (!entries) return null;
  const prefix = `${workspaceId}::${viewId}::`;
  for (const [key, entry] of Object.entries(entries)) {
    if (!key.startsWith(prefix)) continue;
    if (readOpenSideChatPlacements(entry, viewId).length === 0) continue;
    return key.slice(prefix.length);
  }
  return null;
}

export function useSideChatRailAdapter(
  viewId: string,
  base: ViewTabAdapterModel | null,
): ViewTabAdapterModel | null {
  const workspaceId = usePanelStore((state) => state.activeWorkspaceId);
  const viewIcon = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === viewId)?.icon ?? 'tab'
  ));
  const viewLabel = usePanelStore((state) => (
    state.panelConfigs.find((config) => config.id === viewId)?.name ?? viewId
  ));
  const bindingGroupId = usePanelStore((state) => (
    getWorksurfaceBinding(state, workspaceId, viewId)?.threadGroupId ?? null
  ));
  const selectedGroupId = usePanelStore((state) => (
    getCurrentThreadGroupId(state, workspaceId, viewId)
  ));
  const activePlacementId = usePanelStore((state) => (
    getActiveSideChatPlacement(state, workspaceId, viewId)
  ));
  const entries = usePanelStore((state) => state.worksurfaceEntries);

  return useMemo(() => {
    if (!workspaceId) return base;
    const groupId = bindingGroupId
      ?? selectedGroupId
      ?? firstGroupWithOpenPlacement(entries, workspaceId, viewId);
    const entry = groupId
      ? (entries?.[worksurfaceEntryKey(workspaceId, viewId, groupId)] ?? null)
      : null;

    const context: SideChatBridgeContext = {
      workspaceId,
      viewId,
      viewIcon,
      entry,
      activePlacementId,
      threadGroupId: groupId,
      onFocusPlacement: (placementId) => {
        const placement = readOpenSideChatPlacements(entry, viewId).find((item) => item.placementId === placementId);
        if (placement) usePanelStore.getState().requestChatActivation({ workspaceId, viewId,
          threadGroupId: groupId ?? '', threadId: placement.threadId, host: 'side-tab', binding: 'session', componentInstanceId: placement.descriptor.componentInstanceId });
        usePanelStore.getState().setActiveSideChatPlacement(workspaceId, viewId, placementId);
      },
      onFocusNative: () => {
        usePanelStore.getState().setActiveSideChatPlacement(workspaceId, viewId, null);
      },
      onClosePlacement: (placementId) => {
        // Record the durable close disposition against the exact group's
        // placement lane; the member session itself is never deleted.
        closeSideChatPlacement(
          workspaceId,
          viewId,
          groupId ?? '',
          placementId,
          entry?.placementRevision ?? null,
        );
      },
    };

    if (NATIVE_ADAPTED_VIEWS.has(viewId)) {
      if (readOpenSideChatPlacements(entry, viewId).length === 0) return base;
      return composeSideChatAdapter(base, context);
    }

    return composeAdapterlessSideChatRail({ ...context, viewLabel });
  }, [
    activePlacementId,
    base,
    bindingGroupId,
    entries,
    selectedGroupId,
    viewIcon,
    viewLabel,
    viewId,
    workspaceId,
  ]);
}
