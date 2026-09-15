/**
 * @module worksurface/wikiViewerWorksurfaceAdapter
 * @role Connected worksurface adapter for the Wiki Viewer (SPEC-03 §10 03B
 *       second representative view).
 *
 * Inventory (writer/hydrator cutover, SPEC-03 §5): the Wiki Viewer's only
 * content navigation fact is its `activity.navigation` history stack + cursor,
 * owned today by `state/wikiStore.ts` through `lib/viewActivity.ts`
 * (`pushViewNavigation` / `setViewNavigationIndex`) and re-derived from
 * `getViewActivity('wiki-viewer')` when the folder tree publishes. While the
 * view is group-bound this adapter/controller is the only writer/hydrator of
 * that fact; the non-group/Legacy path keeps the established `state:set`
 * activity persistence and cannot hydrate over a group entry.
 *
 * Content is version 1 and JSON-safe: an ordered navigation stack of existing
 * `ViewActivityItem`s plus an index. No transcript/runtime state, no tabs, no
 * scroll schema is invented.
 */

import { getViewActivity, normalizeViewActivity } from '../viewActivity';
import { findWikiNodeByPath, useWikiStore } from '../../state/wikiStore';
import { usePanelStore } from '../../state/panelStore';
import type { ViewNavigationState } from '../../types';
import type { JsonValue, RestoreResult, SanitizedResult, WorksurfaceAdapter } from './types';

export const WIKI_VIEWER_WORKSURFACE_ADAPTER_ID = 'wiki-viewer';
export const WIKI_VIEWER_WORKSURFACE_SCHEMA_VERSION = 1;
export const WIKI_VIEWER_WORKSURFACE_MAX_NAV = 100;

interface WikiViewerWorksurfaceContent {
  navigation: ViewNavigationState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate and normalize raw adapter content. Unsupported versions/data are
 * inert: the caller keeps the view's current/default behavior and records a
 * classified warning instead of rewriting unknown fields.
 */
export function sanitizeWikiViewerWorksurface(
  input: JsonValue,
  storedVersion: number,
): SanitizedResult {
  if (!Number.isInteger(storedVersion) || storedVersion < 1) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (storedVersion > WIKI_VIEWER_WORKSURFACE_SCHEMA_VERSION) {
    return { ok: false, content: null, warning: 'unsupported_adapter_version' };
  }
  if (!isRecord(input)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (!isRecord(input.navigation)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  const normalized = normalizeViewActivity({
    navigation: input.navigation as unknown as ViewNavigationState,
  });
  const content: WikiViewerWorksurfaceContent = {
    navigation: {
      stack: normalized.navigation.stack.slice(-WIKI_VIEWER_WORKSURFACE_MAX_NAV),
      index: normalized.navigation.index,
    },
  };
  return { ok: true, content: content as unknown as JsonValue };
}

function captureWikiViewerWorksurface(): JsonValue {
  const activity = getViewActivity('wiki-viewer');
  return {
    navigation: activity.navigation,
  } as unknown as JsonValue;
}

async function restoreWikiViewerWorksurface(content: JsonValue): Promise<RestoreResult> {
  const sanitized = sanitizeWikiViewerWorksurface(
    content,
    WIKI_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  );
  if (!sanitized.ok || !isRecord(sanitized.content)) {
    return { restored: false, warning: sanitized.warning ?? 'invalid_content' };
  }
  const accepted = sanitized.content as unknown as WikiViewerWorksurfaceContent;
  const store = usePanelStore.getState();
  const current = getViewActivity('wiki-viewer');
  // Hydrate the live render state without touching the non-group global writer.
  store.setViewState('wiki-viewer', {
    activity: { ...current, navigation: accepted.navigation },
  });

  // Re-derive the in-memory wiki history from the restored navigation. Missing
  // or renamed folders are reported as unavailable and fall back to the view's
  // existing default/empty representation without rebinding the group.
  const wiki = useWikiStore.getState();
  const unavailable: string[] = [];
  if (wiki.root) {
    for (const item of accepted.navigation.stack) {
      if (!findWikiNodeByPath(wiki.root, item.path)) unavailable.push(item.path);
    }
    wiki.setRoot(wiki.root);
  }
  return {
    restored: true,
    ...(unavailable.length > 0
      ? { unavailable, warning: 'unavailable_content' }
      : {}),
  };
}

export const wikiViewerWorksurfaceAdapter: WorksurfaceAdapter = {
  adapterId: WIKI_VIEWER_WORKSURFACE_ADAPTER_ID,
  adapterVersion: WIKI_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  capture: captureWikiViewerWorksurface,
  sanitize: sanitizeWikiViewerWorksurface,
  restore: restoreWikiViewerWorksurface,
};
