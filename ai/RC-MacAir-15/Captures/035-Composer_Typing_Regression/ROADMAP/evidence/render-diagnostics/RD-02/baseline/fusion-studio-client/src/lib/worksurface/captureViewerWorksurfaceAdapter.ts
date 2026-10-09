/**
 * @module worksurface/captureViewerWorksurfaceAdapter
 * @role Connected worksurface adapter for the Capture Viewer (SPEC-03 §10 03D
 *       remaining in-scope production view).
 *
 * Inventory (writer/hydrator cutover, SPEC-03 §5): the Capture Viewer owns its
 * classic document navigation — mode, per-mode selected document, last-opened
 * document, per-mode grid/document scroll positions — plus its classic tab
 * collection/active tab (`viewStates['capture-viewer'].docViewerTabs` /
 * `docViewerActiveTabId`) and its activity recents/navigation
 * (`lib/viewActivity.ts`). Those writers are `hooks/useDocViewerState.ts`,
 * `components/view-tabs/captureTabsController.ts`, and
 * `lib/viewActivity.ts`; while the view is group-bound the adapter/controller
 * is the only writer/hydrator of those facts.
 *
 * The VIEW-02 connected generic tab lane (`captureTabRecords`) is a separate
 * acknowledged owner with its own handoff protocol; it is elected into this
 * content lane alongside the classic `docViewerTabs` facts, so the visible tab
 * surface is group-restorable. (The earlier "not elected" note was a stale
 * comment drift recorded by SPEC-03 03D and corrected here.)
 *
 * Content is version 1 and JSON-safe. `sanitize` validates size, types,
 * supported modes, path canonicality, and version before any renderer mutation;
 * unsupported data is inert with a classified warning and never crashes the
 * workspace.
 */

import { getViewActivity, normalizeViewActivity } from '../viewActivity';
import { usePanelStore } from '../../state/panelStore';
import { useFileDataStore } from '../../state/fileDataStore';
import { normalizeCaptureTabs } from '../../components/view-tabs/captureTabDomain';
import {
  captureTabRecordsDocument,
  parseCaptureTabRecordsDocument,
} from '../../components/view-tabs/captureConnectedOwnerPorts';
import type {
  CaptureTabRecordsDocument,
  DocViewerMode,
  DocViewerTab,
  ViewActivityState,
  ViewUIState,
} from '../../types';
import type { JsonValue, RestoreResult, SanitizedResult, WorksurfaceAdapter } from './types';

export const CAPTURE_VIEWER_WORKSURFACE_ADAPTER_ID = 'capture-viewer';
export const CAPTURE_VIEWER_WORKSURFACE_SCHEMA_VERSION = 1;
export const CAPTURE_VIEWER_WORKSURFACE_MAX_TABS = 100;

const CAPTURE_PANEL = 'capture-viewer';
const MODES: readonly DocViewerMode[] = ['active', 'recent', 'starred', 'archive'];
const MAX_SCROLL = 10_000_000;

/** The classic + connected Capture Viewer keys elected into the content lane. */
export { CAPTURE_VIEWER_CONTENT_KEYS } from './viewContentKeys';

interface CaptureViewerWorksurfaceContent {
  mode: DocViewerMode;
  activeSelectedPath: string | null;
  archiveSelectedPath: string | null;
  lastOpenedPath: string | null;
  activeGridScroll: number;
  archiveGridScroll: number;
  activeDocScroll: number;
  archiveDocScroll: number;
  tabs: DocViewerTab[];
  activeTabId: string | null;
  /**
   * VIEW-02 connected records lane (the visible tab surface in a policy-ready
   * workspace). Strictly parsed JSON; `null` when the view has no records.
   */
  captureTabRecords: CaptureTabRecordsDocument | null;
  activity: ViewActivityState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeMode(value: unknown): DocViewerMode {
  return MODES.includes(value as DocViewerMode) ? value as DocViewerMode : 'active';
}

function safeScroll(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_SCROLL, Math.max(0, value));
}

function safePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized || normalized.includes('\0')) return null;
  return normalized;
}

/**
 * Validate and normalize raw adapter content. Unsupported versions/data are
 * inert: the caller keeps the view's current/default behavior and records a
 * classified warning instead of rewriting unknown fields.
 */
export function sanitizeCaptureViewerWorksurface(
  input: JsonValue,
  storedVersion: number,
): SanitizedResult {
  if (!Number.isInteger(storedVersion) || storedVersion < 1) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (storedVersion > CAPTURE_VIEWER_WORKSURFACE_SCHEMA_VERSION) {
    return { ok: false, content: null, warning: 'unsupported_adapter_version' };
  }
  if (!isRecord(input)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  const normalizedTabs = normalizeCaptureTabs(input.tabs, input.activeTabId);
  let captureTabRecords: CaptureTabRecordsDocument | null = null;
  if (input.captureTabRecords !== undefined && input.captureTabRecords !== null) {
    const parsedRecords = parseCaptureTabRecordsDocument(input.captureTabRecords);
    if (!parsedRecords) {
      // Strict fail-closed: a corrupt connected-records lane makes the whole
      // entry inert (the caller keeps current/default and records a warning).
      return { ok: false, content: null, warning: 'invalid_content' };
    }
    captureTabRecords = captureTabRecordsDocument(parsedRecords);
  }
  const content: CaptureViewerWorksurfaceContent = {
    mode: safeMode(input.mode),
    activeSelectedPath: safePath(input.activeSelectedPath),
    archiveSelectedPath: safePath(input.archiveSelectedPath),
    lastOpenedPath: safePath(input.lastOpenedPath),
    activeGridScroll: safeScroll(input.activeGridScroll),
    archiveGridScroll: safeScroll(input.archiveGridScroll),
    activeDocScroll: safeScroll(input.activeDocScroll),
    archiveDocScroll: safeScroll(input.archiveDocScroll),
    tabs: normalizedTabs.tabs.slice(0, CAPTURE_VIEWER_WORKSURFACE_MAX_TABS),
    activeTabId: normalizedTabs.activeId,
    captureTabRecords,
    activity: normalizeViewActivity(input.activity as Partial<ViewActivityState> | null),
  };
  return { ok: true, content: content as unknown as JsonValue };
}

function captureCaptureViewerWorksurface(): JsonValue {
  const state = usePanelStore.getState().viewStates[CAPTURE_PANEL] ?? ({} as Partial<ViewUIState>);
  const normalizedTabs = normalizeCaptureTabs(state.docViewerTabs, state.docViewerActiveTabId);
  const parsedRecords = parseCaptureTabRecordsDocument(state.captureTabRecords);
  return {
    mode: state.docViewerMode ?? 'active',
    activeSelectedPath: state.docViewerActiveSelectedPath ?? null,
    archiveSelectedPath: state.docViewerArchiveSelectedPath ?? null,
    lastOpenedPath: state.docViewerLastOpenedPath ?? null,
    activeGridScroll: state.docViewerActiveGridScroll ?? 0,
    archiveGridScroll: state.docViewerArchiveGridScroll ?? 0,
    activeDocScroll: state.docViewerActiveDocScroll ?? 0,
    archiveDocScroll: state.docViewerArchiveDocScroll ?? 0,
    tabs: normalizedTabs.tabs,
    activeTabId: normalizedTabs.activeId,
    captureTabRecords: parsedRecords ? captureTabRecordsDocument(parsedRecords) : null,
    activity: getViewActivity(CAPTURE_PANEL),
  } as unknown as JsonValue;
}

/** Report a selected document as unavailable only when its folder tree is loaded. */
function unavailableSelectedPaths(content: CaptureViewerWorksurfaceContent): string[] {
  const trees = useFileDataStore.getState().trees;
  const unavailable: string[] = [];
  for (const selected of [content.activeSelectedPath, content.archiveSelectedPath]) {
    if (!selected) continue;
    const lastSlash = selected.lastIndexOf('/');
    const folder = lastSlash === -1 ? '' : selected.slice(0, lastSlash);
    const tree = trees[`${CAPTURE_PANEL}:${folder}`];
    if (!tree) continue;
    if (!tree.some((node) => node.type === 'file' && node.path === selected)) {
      unavailable.push(selected);
    }
  }
  return unavailable;
}

async function restoreCaptureViewerWorksurface(content: JsonValue): Promise<RestoreResult> {
  const sanitized = sanitizeCaptureViewerWorksurface(
    content,
    CAPTURE_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  );
  if (!sanitized.ok || !isRecord(sanitized.content)) {
    return { restored: false, warning: sanitized.warning ?? 'invalid_content' };
  }
  const accepted = sanitized.content as unknown as CaptureViewerWorksurfaceContent;
  // Hydrate the live render state without touching the non-group global writer.
  usePanelStore.getState().setViewState(CAPTURE_PANEL, {
    docViewerMode: accepted.mode,
    docViewerActiveSelectedPath: accepted.activeSelectedPath,
    docViewerArchiveSelectedPath: accepted.archiveSelectedPath,
    docViewerLastOpenedPath: accepted.lastOpenedPath,
    docViewerActiveGridScroll: accepted.activeGridScroll,
    docViewerArchiveGridScroll: accepted.archiveGridScroll,
    docViewerActiveDocScroll: accepted.activeDocScroll,
    docViewerArchiveDocScroll: accepted.archiveDocScroll,
    docViewerTabs: accepted.tabs,
    docViewerActiveTabId: accepted.activeTabId,
    captureTabRecords: accepted.captureTabRecords,
    activity: accepted.activity,
  });
  const unavailable = unavailableSelectedPaths(accepted);
  return {
    restored: true,
    ...(unavailable.length > 0
      ? { unavailable, warning: 'unavailable_content' }
      : {}),
  };
}

export const captureViewerWorksurfaceAdapter: WorksurfaceAdapter = {
  adapterId: CAPTURE_VIEWER_WORKSURFACE_ADAPTER_ID,
  adapterVersion: CAPTURE_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  capture: captureCaptureViewerWorksurface,
  sanitize: sanitizeCaptureViewerWorksurface,
  restore: restoreCaptureViewerWorksurface,
};
