/**
 * @module worksurface/fileViewerWorksurfaceAdapter
 * @role Connected worksurface adapter for the File Viewer (SPEC-03 §10 03A
 *       representative view).
 *
 * The File Viewer owns its content tabs, active tab, and navigation stack
 * (`lib/viewActivity.ts` `activity.tabs`/`activeTabId`/`navigation`). While the
 * view is group-bound this adapter/controller is the only writer/hydrator of
 * those facts; the non-group/Legacy path keeps the existing `state:set`
 * activity persistence and cannot hydrate over a group entry.
 *
 * Content is version 1 and JSON-safe. `sanitize` validates size, types, and
 * version before any renderer mutation; unsupported data is inert with a
 * classified warning and never crashes the workspace.
 */

import { getViewActivity, normalizeViewActivity } from '../viewActivity';
import { hydrateFileViewerActivity } from '../file-tree';
import { usePanelStore } from '../../state/panelStore';
import type { ViewActivityItem, ViewNavigationState } from '../../types';
import type { JsonValue, RestoreResult, SanitizedResult, WorksurfaceAdapter } from './types';

export const FILE_VIEWER_WORKSURFACE_ADAPTER_ID = 'file-viewer';
export const FILE_VIEWER_WORKSURFACE_SCHEMA_VERSION = 1;
export const FILE_VIEWER_WORKSURFACE_MAX_TABS = 200;

interface FileViewerWorksurfaceContent {
  tabs: ViewActivityItem[];
  activeTabId: string | null;
  navigation: ViewNavigationState;
  /**
   * The view's own recent-content history. Electing it into the content lane
   * preserves the existing per-view persistence while group-bound instead of
   * dropping it (the global `activity` write is cut over in group mode).
   */
  recents: ViewActivityItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate and normalize raw adapter content. Unsupported versions/data are
 * inert: the caller keeps the view's current/default behavior and records a
 * classified warning instead of rewriting unknown fields.
 */
export function sanitizeFileViewerWorksurface(
  input: JsonValue,
  storedVersion: number,
): SanitizedResult {
  if (!Number.isInteger(storedVersion) || storedVersion < 1) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (storedVersion > FILE_VIEWER_WORKSURFACE_SCHEMA_VERSION) {
    return { ok: false, content: null, warning: 'unsupported_adapter_version' };
  }
  if (!isRecord(input)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (!Array.isArray(input.tabs)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  const normalized = normalizeViewActivity({
    tabs: input.tabs as unknown as ViewActivityItem[],
    activeTabId: typeof input.activeTabId === 'string' ? input.activeTabId : null,
    navigation: (input.navigation ?? { stack: [], index: -1 }) as unknown as ViewNavigationState,
    recents: Array.isArray(input.recents)
      ? input.recents as unknown as ViewActivityItem[]
      : [],
  });
  const tabs = normalized.tabs.slice(0, FILE_VIEWER_WORKSURFACE_MAX_TABS);
  const activeTabId = normalized.activeTabId
    && tabs.some((tab) => tab.id === normalized.activeTabId)
    ? normalized.activeTabId
    : (tabs[0]?.id ?? null);
  const content: FileViewerWorksurfaceContent = {
    tabs,
    activeTabId,
    navigation: normalized.navigation,
    recents: normalized.recents,
  };
  return { ok: true, content: content as unknown as JsonValue };
}

function captureFileViewerWorksurface(): JsonValue {
  const activity = getViewActivity('file-viewer');
  return {
    tabs: activity.tabs,
    activeTabId: activity.activeTabId,
    navigation: activity.navigation,
    recents: activity.recents,
  } as unknown as JsonValue;
}

async function restoreFileViewerWorksurface(content: JsonValue): Promise<RestoreResult> {
  const sanitized = sanitizeFileViewerWorksurface(
    content,
    FILE_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  );
  if (!sanitized.ok || !isRecord(sanitized.content)) {
    return { restored: false, warning: sanitized.warning ?? 'invalid_content' };
  }
  const accepted = sanitized.content as unknown as FileViewerWorksurfaceContent;
  const activity = {
    recents: accepted.recents,
    navigation: accepted.navigation,
    tabs: accepted.tabs,
    activeTabId: accepted.activeTabId,
  };
  // Hydrate the live render state without touching the non-group global writer.
  usePanelStore.getState().setViewState('file-viewer', { activity });
  hydrateFileViewerActivity(activity);
  return { restored: true };
}

export const fileViewerWorksurfaceAdapter: WorksurfaceAdapter = {
  adapterId: FILE_VIEWER_WORKSURFACE_ADAPTER_ID,
  adapterVersion: FILE_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  capture: captureFileViewerWorksurface,
  sanitize: sanitizeFileViewerWorksurface,
  restore: restoreFileViewerWorksurface,
};
