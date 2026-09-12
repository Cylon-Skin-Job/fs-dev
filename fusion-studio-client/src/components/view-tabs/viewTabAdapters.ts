/**
 * @module viewTabAdapters
 * @role Thin store-owning registry boundary for the public ViewTabBar.
 *
 * VIEW-02 Slice 2 split the view-specific connected logic into focused files:
 * `captureViewTabAdapter.ts` and `fileViewTabAdapter.ts` (legacy adapters moved
 * byte-for-byte, plus the VIEW-02 connected bindings), with the shared
 * connected-owner machinery in `componentTabConnectedOwner.ts` /
 * `componentTabConnectedAdapter.ts`. This module stays the registry boundary:
 * the shell host itself never imports view stores.
 *
 * VIEW-02 Slice 3 flips Capture to the connected path when its shipped
 * `tabPolicies` entry is ready (SPEC-02 §9); Slice 4 flips File Explorer the
 * same way (SPEC-02 §10). A view without a ready policy keeps the exact
 * legacy behavior.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  useCaptureAdapter,
  useCaptureConnectedAdapter,
} from './captureViewTabAdapter';
import { CAPTURE_PANEL } from './captureTabsController';
import { readyTabPolicyFor } from './componentTabConnectedAdapter';
import { useFileConnectedAdapter } from './fileConnectedAdapter';
import { getViewTabAdapter, useFileAdapter } from './fileViewTabAdapter';
import type { ViewTabAddAction, ViewTabDescriptor } from './ViewTabStrip';
import type { ViewTabContentAdapter } from './viewTabContentAdapter';

export type { ViewTabContentAdapter } from './viewTabContentAdapter';

export interface ViewTabAdapterModel {
  panelId: string;
  label: string;
  tabs: ViewTabDescriptor[];
  activeId: string;
  tabPanelTabIndex: 0 | -1;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  add?: ViewTabAddAction;
  content?: ViewTabContentAdapter;
}

export { getViewTabAdapter };

/** Store-owning registry boundary. The shell host itself never imports view stores. */
export function useViewTabAdapter(panelId: string): ViewTabAdapterModel | null {
  const isCapture = panelId === CAPTURE_PANEL;
  // The connected path activates for capture-viewer ONLY when its shipped
  // tab policy is ready; a view without one keeps exact legacy behavior.
  const capturePolicyReady = usePanelStore(
    (state) => readyTabPolicyFor(state.tabPolicies, CAPTURE_PANEL) !== null,
  );
  const captureConnected = useCaptureConnectedAdapter(isCapture && capturePolicyReady);
  const captureLegacy = useCaptureAdapter(isCapture && !capturePolicyReady);
  // VIEW-02 Slice 4: File Explorer adopts the same policy-gated connected path.
  const isFiles = panelId === 'file-viewer';
  const filePolicyReady = usePanelStore(
    (state) => readyTabPolicyFor(state.tabPolicies, 'file-viewer') !== null,
  );
  const fileConnected = useFileConnectedAdapter(isFiles && filePolicyReady);
  const files = useFileAdapter(isFiles && !filePolicyReady);
  if (isCapture) return capturePolicyReady ? captureConnected : captureLegacy;
  if (isFiles) return filePolicyReady ? fileConnected : files;
  return null;
}
