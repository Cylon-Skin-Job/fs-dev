/**
 * @module fileConnectedTabs
 * @role VIEW-02 Slice 4 — view-side entry points into the connected File
 *       owner's serialized intent lane (SPEC-02 §8/§10, VRT-011A, VRT-012).
 *
 * The connected adapter hook registers its runtime here so view modules
 * OUTSIDE the adapter (the file-tree drawer's public open path,
 * `lib/file-tree.ts`) can route file selection through TABS-03 and the owner
 * transitions through the SAME lane without importing stores into the shell.
 * Nothing here reimplements matching/fill/append/reveal — that is entirely
 * the accepted TABS-03 controller's job. VRT-011A picker-selection
 * preparation and the following TABS-03 `current` call run in ONE intent-lane
 * turn, so no other activate/close/plus/placement intent can interleave.
 */

import { usePanelStore } from '../../state/panelStore';
import { showToast } from '../../lib/toast';
import type { FileInfo } from '../../types/file-explorer';
import type { ConnectedTabOwnerRuntime } from './componentTabConnectedOwner';
import {
  canonicalFilePath,
  FILE_DOCUMENT_PRESENTER_ID,
  fileDocumentTargetKey,
} from './fileConnectedPresenterTargets';

let activeRuntime: ConnectedTabOwnerRuntime | null = null;
let activeWorkspaceId: string | null = null;

/** Called by the connected adapter hook when its runtime mounts/unmounts. */
export function setActiveFileConnectedRuntime(
  runtime: ConnectedTabOwnerRuntime | null,
  workspaceId: string | null,
): void {
  activeRuntime = runtime;
  activeWorkspaceId = runtime ? workspaceId : null;
}

/** True when the connected File path owns this view's tab surface now. */
export function isFileConnectedActive(): boolean {
  if (!activeRuntime || activeWorkspaceId === null) return false;
  // The registered runtime is the owner for this workspace while the adapter
  // hook is mounted — including the established post-close collection (zero
  // tabs), where re-entry happens through THIS lane, never the legacy path.
  // Every lane operation still guards currency internally (bounded no-ops
  // across workspace switch/disconnect).
  return usePanelStore.getState().activeWorkspaceId === activeWorkspaceId;
}

let requestSequence = 0;

/** One component-backed active tab's still-live identity (SPEC-01 §5). */
export interface ActiveFileConnectedTabComponent {
  tabId: string;
  componentTypeId: string;
  componentInstanceId: string;
  presenterId: string;
  targetKey?: string;
}

/** Read-only view of the active connected File owner's live tab context. */
export interface ActiveFileConnectedTabContext {
  workspaceId: string;
  viewId: string;
  activeTabId: string | null;
  activeComponent: ActiveFileConnectedTabComponent | null;
}

/**
 * BRIDGE-01 SPEC-01 §5 read-only accessor: a fresh translation of the active
 * connected File owner's current state, used by the mediated-save context
 * adapter. It exposes no runtime and mutates nothing. Returns null when no
 * runtime is registered. Values are raw owner reads; the adapter owns the
 * fixed caps and fail-open omission.
 */
export function readActiveFileConnectedTabContext(): ActiveFileConnectedTabContext | null {
  if (!activeRuntime || activeWorkspaceId === null) return null;
  const collection = activeRuntime.readCollection();
  const activeTab = collection.activeTabId === null
    ? undefined
    : collection.tabs.find((tab) => tab.tabId === collection.activeTabId);
  let activeComponent: ActiveFileConnectedTabComponent | null = null;
  if (activeTab && activeTab.content.kind === 'component') {
    const descriptor = activeTab.content.component;
    activeComponent = {
      tabId: activeTab.tabId,
      componentTypeId: descriptor.componentTypeId,
      componentInstanceId: descriptor.componentInstanceId,
      // File presenter IDs are code-owned and equal their component type IDs
      // (fileConnectedPresenterTargets), matching the accepted describer.
      presenterId: descriptor.componentTypeId,
      ...(typeof descriptor.targetKey === 'string' ? { targetKey: descriptor.targetKey } : {}),
    };
  }
  return {
    workspaceId: activeWorkspaceId,
    viewId: activeRuntime.viewId,
    activeTabId: collection.activeTabId,
    activeComponent,
  };
}

/**
 * Routes one file open through TABS-03 from the connected owner's serialized
 * lane. Returns false when the connected path is not active, so the caller can
 * fall back to the established legacy behavior. Populated tabs are never
 * overwritten; exact matches activate and reveal; an unreserved waiting Empty
 * tab is filled by `current`; `new` appends when there is no exact match.
 *
 * VIEW-02 §4.1: when the connected entry point IS active and still fails
 * (stale lane, rejected placement, bad path), the failure is bounded — the
 * established toast, never a silent legacy fallback.
 *
 * VRT-011A: when a `file.open` picker reservation is pending, its exact
 * identity is carried into this lane turn — preparation (release + activate
 * that exact still-Empty destination at the expected revision) and the
 * TABS-03 `current` call run in the SAME turn. A stale identity aborts the
 * whole selection with no state change.
 */
export function openFileDocument(request: {
  file: Pick<FileInfo, 'path'>;
  disposition: 'current' | 'new';
}): boolean {
  if (!activeRuntime || activeWorkspaceId === null) {
    showToast('The file could not be opened. Try again.');
    return false;
  }
  if (usePanelStore.getState().activeWorkspaceId !== activeWorkspaceId) {
    showToast('The file could not be opened. Try again.');
    return false;
  }
  const path = canonicalFilePath(request.file.path);
  if (!path) {
    showToast('The file could not be opened. Try again.');
    return false;
  }
  const runtime = activeRuntime;
  const requestId = `file-open-${Date.now().toString(36)}-${requestSequence++}`;
  void runtime.runIntent(async (turn) => {
    const picker = runtime.pickerCurrent();
    if (picker) {
      const prepared = turn.preparePickerSelection(picker);
      if (prepared !== 'ok') return; // stale/canceled/replaced: bounded no-op
    }
    const result = await turn.place({
      schemaVersion: 1,
      requestId,
      disposition: request.disposition,
      target: {
        presenterId: FILE_DOCUMENT_PRESENTER_ID,
        targetKey: fileDocumentTargetKey(path),
      },
    });
    if (!result.ok) showToast('The file could not be opened. Try again.');
  }).catch(() => {
    showToast('The file could not be opened. Try again.');
  });
  return true;
}
