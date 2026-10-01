/**
 * @module save-action-context
 * @role BRIDGE-01 SPEC-01 §5 — bounded, synchronous, fail-open renderer adapter
 *       that snapshots the live active-view/tab context at mediated-save
 *       command time for `reportedUiContext`.
 *
 * One job: read existing selectors and return a plain `ComponentActionContext`.
 * It owns no state, subscribes to nothing, adds no Zustand field, writes no
 * view capsule, performs no I/O, awaits nothing, imports nothing dynamically,
 * and traverses nothing beyond the active tab record. Any failure or missing
 * field omits that field (or the whole context) and never blocks, delays, or
 * rewrites the save; no value is guessed.
 *
 * The context is opaque query context, never a principal, permission, resource
 * identity, or causal claim (INTERFACE-CONTRACT.md §Shared boundaries).
 */

import type { ComponentActionContext } from '../types/file-explorer';
import { usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';
import { readActiveFileConnectedTabContext } from '../components/view-tabs/fileConnectedTabs';

/** WebSocket-standard identifier bound used by the mediated-save protocol. */
const IDENTIFIER_MAX_BYTES = 128;
/** Matches the accepted TABS-03 `COMPONENT_TAB_LIMITS.maxTargetKeyBytes`. */
const TARGET_KEY_MAX_BYTES = 512;

/**
 * A non-empty, well-formed Unicode string within the fixed byte cap; anything
 * else is omitted. Mirrors the mediated-save protocol's scalar-string rule
 * (no lone UTF-16 surrogates) without inventing a substitute value.
 */
function boundedScalar(value: unknown, maxBytes: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  if (new TextEncoder().encode(value).byteLength > maxBytes) return undefined;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return undefined;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return undefined;
    }
  }
  return value;
}

function buildContext(panel: string): ComponentActionContext | undefined {
  // Workspace is the renderer echo; the server derives authority later.
  const workspaceId = boundedScalar(
    useWorkspaceStore.getState().activeWorkspaceId,
    IDENTIFIER_MAX_BYTES,
  );
  const viewId = boundedScalar(panel, IDENTIFIER_MAX_BYTES);
  if (!workspaceId || !viewId) return undefined;

  // Registered-view guard: never invent a viewId for an unknown/legacy panel.
  const registered = usePanelStore.getState().panelConfigs.some(
    (config) => config.id === viewId,
  );
  if (!registered) return undefined;

  const context: ComponentActionContext = { workspaceId, viewId };

  // The connected owner is the accepted source for component-backed File tabs;
  // its owner identity must still match the current workspace/view or it is
  // stale and contributes no tab fields.
  const owner = readActiveFileConnectedTabContext();
  if (!owner
    || owner.workspaceId !== workspaceId
    || owner.viewId !== viewId
    || !owner.activeComponent) {
    return context;
  }

  const component = owner.activeComponent;
  const tabId = boundedScalar(component.tabId, IDENTIFIER_MAX_BYTES);
  const componentTypeId = boundedScalar(component.componentTypeId, IDENTIFIER_MAX_BYTES);
  const componentInstanceId = boundedScalar(component.componentInstanceId, IDENTIFIER_MAX_BYTES);
  const presenterId = boundedScalar(component.presenterId, IDENTIFIER_MAX_BYTES);
  const targetKey = boundedScalar(component.targetKey, TARGET_KEY_MAX_BYTES);
  if (tabId) context.tabId = tabId;
  if (componentTypeId) context.componentTypeId = componentTypeId;
  if (componentInstanceId) context.componentInstanceId = componentInstanceId;
  if (presenterId) context.presenterId = presenterId;
  if (targetKey) context.targetKey = targetKey;
  return context;
}

/**
 * Snapshot the current UI action context for one mediated save. `panel` is the
 * command's initiating view (the panel owning the document being saved).
 *
 * Returns `undefined` (whole-context omission) when the workspace or registered
 * view identity is unavailable, or on any unexpected failure. Per-field caps
 * drop only the offending field. Never throws.
 */
export function readSaveActionContext(panel: string): ComponentActionContext | undefined {
  try {
    return buildContext(panel);
  } catch {
    return undefined;
  }
}
