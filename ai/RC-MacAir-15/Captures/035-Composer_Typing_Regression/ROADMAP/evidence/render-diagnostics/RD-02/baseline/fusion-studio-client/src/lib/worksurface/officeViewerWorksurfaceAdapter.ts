/**
 * @module worksurface/officeViewerWorksurfaceAdapter
 * @role Connected worksurface adapter for the Office Viewer (SPEC-03 §10 03D
 *       remaining in-scope production view).
 *
 * Inventory (writer/hydrator cutover, SPEC-03 §5): the Office Viewer owns its
 * document navigation — mode (`home|recent|starred|archive`), current folder,
 * selected document path, and document side panel — plus its activity recents
 * (`lib/viewActivity.ts`). Those writers are
 * `components/office/OfficeGrid.tsx` and
 * `components/office/OfficeDocumentPage.tsx`; while the view is group-bound the
 * adapter/controller is the only writer/hydrator of those facts.
 *
 * `officePaperBrightness` is a display preference, not content navigation, and
 * stays in the non-group global writer. No tab schema is invented.
 *
 * Content is version 1 and JSON-safe. `sanitize` validates size, types,
 * supported modes/panels, and version before any renderer mutation; unsupported
 * data is inert with a classified warning and never crashes the workspace.
 */

import { getViewActivity, normalizeViewActivity } from '../viewActivity';
import { usePanelStore } from '../../state/panelStore';
import { useFileDataStore } from '../../state/fileDataStore';
import type { ViewActivityState, ViewUIState } from '../../types';
import type { JsonValue, RestoreResult, SanitizedResult, WorksurfaceAdapter } from './types';

export const OFFICE_VIEWER_WORKSURFACE_ADAPTER_ID = 'office-viewer';
export const OFFICE_VIEWER_WORKSURFACE_SCHEMA_VERSION = 1;

const OFFICE_PANEL = 'office-viewer';
const MODES = ['home', 'recent', 'starred', 'archive'] as const;
const SIDE_PANELS = ['none', 'files'] as const;

type OfficeViewerMode = typeof MODES[number];
type OfficeSidePanel = typeof SIDE_PANELS[number];

/** The Office Viewer keys elected into the content lane. */
export { OFFICE_VIEWER_CONTENT_KEYS } from './viewContentKeys';

interface OfficeViewerWorksurfaceContent {
  mode: OfficeViewerMode;
  currentFolder: string | null;
  selectedPath: string | null;
  sidePanel: OfficeSidePanel;
  activity: ViewActivityState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeMode(value: unknown): OfficeViewerMode {
  return (MODES as readonly string[]).includes(value as string)
    ? value as OfficeViewerMode
    : 'home';
}

function safeSidePanel(value: unknown): OfficeSidePanel {
  return (SIDE_PANELS as readonly string[]).includes(value as string)
    ? value as OfficeSidePanel
    : 'none';
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
export function sanitizeOfficeViewerWorksurface(
  input: JsonValue,
  storedVersion: number,
): SanitizedResult {
  if (!Number.isInteger(storedVersion) || storedVersion < 1) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (storedVersion > OFFICE_VIEWER_WORKSURFACE_SCHEMA_VERSION) {
    return { ok: false, content: null, warning: 'unsupported_adapter_version' };
  }
  if (!isRecord(input)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  const content: OfficeViewerWorksurfaceContent = {
    mode: safeMode(input.mode),
    currentFolder: safePath(input.currentFolder),
    selectedPath: safePath(input.selectedPath),
    sidePanel: safeSidePanel(input.sidePanel),
    activity: normalizeViewActivity(input.activity as Partial<ViewActivityState> | null),
  };
  return { ok: true, content: content as unknown as JsonValue };
}

function captureOfficeViewerWorksurface(): JsonValue {
  const state = usePanelStore.getState().viewStates[OFFICE_PANEL] ?? ({} as Partial<ViewUIState>);
  return {
    mode: state.officeViewerMode ?? 'home',
    currentFolder: state.officeViewerCurrentFolder ?? null,
    selectedPath: state.officeViewerSelectedPath ?? null,
    sidePanel: state.officeDocumentSidePanel ?? 'none',
    activity: getViewActivity(OFFICE_PANEL),
  } as unknown as JsonValue;
}

/** Report a selected document as unavailable only when its folder tree is loaded. */
function unavailableSelectedPath(content: OfficeViewerWorksurfaceContent): string[] {
  const selected = content.selectedPath;
  if (!selected) return [];
  const lastSlash = selected.lastIndexOf('/');
  const folder = lastSlash === -1 ? '' : selected.slice(0, lastSlash);
  const tree = useFileDataStore.getState().trees[`${OFFICE_PANEL}:${folder}`];
  if (!tree) return [];
  return tree.some((node) => node.type === 'file' && node.path === selected) ? [] : [selected];
}

async function restoreOfficeViewerWorksurface(content: JsonValue): Promise<RestoreResult> {
  const sanitized = sanitizeOfficeViewerWorksurface(
    content,
    OFFICE_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  );
  if (!sanitized.ok || !isRecord(sanitized.content)) {
    return { restored: false, warning: sanitized.warning ?? 'invalid_content' };
  }
  const accepted = sanitized.content as unknown as OfficeViewerWorksurfaceContent;
  // Hydrate the live render state without touching the non-group global writer.
  usePanelStore.getState().setViewState(OFFICE_PANEL, {
    officeViewerMode: accepted.mode,
    officeViewerCurrentFolder: accepted.currentFolder,
    officeViewerSelectedPath: accepted.selectedPath,
    officeDocumentSidePanel: accepted.sidePanel,
    activity: accepted.activity,
  });
  const unavailable = unavailableSelectedPath(accepted);
  return {
    restored: true,
    ...(unavailable.length > 0
      ? { unavailable, warning: 'unavailable_content' }
      : {}),
  };
}

export const officeViewerWorksurfaceAdapter: WorksurfaceAdapter = {
  adapterId: OFFICE_VIEWER_WORKSURFACE_ADAPTER_ID,
  adapterVersion: OFFICE_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  capture: captureOfficeViewerWorksurface,
  sanitize: sanitizeOfficeViewerWorksurface,
  restore: restoreOfficeViewerWorksurface,
};
