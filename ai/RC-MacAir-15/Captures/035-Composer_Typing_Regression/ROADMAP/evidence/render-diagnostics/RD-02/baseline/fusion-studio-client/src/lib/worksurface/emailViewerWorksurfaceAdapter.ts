/**
 * @module worksurface/emailViewerWorksurfaceAdapter
 * @role Connected worksurface adapter for the Email Viewer (SPEC-03 §10 03D
 *       remaining in-scope production view).
 *
 * Inventory (writer/hydrator cutover, SPEC-03 §5): the Email Viewer owns its
 * document navigation — mode (`home|recent|starred|archive|inbox|snoozed|sent|
 * scheduled|drafts|spam|trash`), current folder, selected document path, and
 * document side panel — plus its activity recents (`lib/viewActivity.ts`).
 * Those writers are `components/email/EmailGrid.tsx` and
 * `components/email/EmailDocumentPage.tsx`; while the view is group-bound the
 * adapter/controller is the only writer/hydrator of those facts.
 *
 * `emailPaperBrightness` is a display preference, not content navigation, and
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

export const EMAIL_VIEWER_WORKSURFACE_ADAPTER_ID = 'email-viewer';
export const EMAIL_VIEWER_WORKSURFACE_SCHEMA_VERSION = 1;

const EMAIL_PANEL = 'email-viewer';
const MODES = [
  'home', 'recent', 'starred', 'archive',
  'inbox', 'snoozed', 'sent', 'scheduled', 'drafts', 'spam', 'trash',
] as const;
const SIDE_PANELS = ['none', 'files'] as const;

type EmailViewerMode = typeof MODES[number];
type EmailSidePanel = typeof SIDE_PANELS[number];

/** The Email Viewer keys elected into the content lane. */
export { EMAIL_VIEWER_CONTENT_KEYS } from './viewContentKeys';

interface EmailViewerWorksurfaceContent {
  mode: EmailViewerMode;
  currentFolder: string | null;
  selectedPath: string | null;
  sidePanel: EmailSidePanel;
  activity: ViewActivityState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeMode(value: unknown): EmailViewerMode {
  return (MODES as readonly string[]).includes(value as string)
    ? value as EmailViewerMode
    : 'inbox';
}

function safeSidePanel(value: unknown): EmailSidePanel {
  return (SIDE_PANELS as readonly string[]).includes(value as string)
    ? value as EmailSidePanel
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
export function sanitizeEmailViewerWorksurface(
  input: JsonValue,
  storedVersion: number,
): SanitizedResult {
  if (!Number.isInteger(storedVersion) || storedVersion < 1) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  if (storedVersion > EMAIL_VIEWER_WORKSURFACE_SCHEMA_VERSION) {
    return { ok: false, content: null, warning: 'unsupported_adapter_version' };
  }
  if (!isRecord(input)) {
    return { ok: false, content: null, warning: 'invalid_content' };
  }
  const content: EmailViewerWorksurfaceContent = {
    mode: safeMode(input.mode),
    currentFolder: safePath(input.currentFolder),
    selectedPath: safePath(input.selectedPath),
    sidePanel: safeSidePanel(input.sidePanel),
    activity: normalizeViewActivity(input.activity as Partial<ViewActivityState> | null),
  };
  return { ok: true, content: content as unknown as JsonValue };
}

function captureEmailViewerWorksurface(): JsonValue {
  const state = usePanelStore.getState().viewStates[EMAIL_PANEL] ?? ({} as Partial<ViewUIState>);
  return {
    mode: state.emailViewerMode ?? 'inbox',
    currentFolder: state.emailViewerCurrentFolder ?? null,
    selectedPath: state.emailViewerSelectedPath ?? null,
    sidePanel: state.emailDocumentSidePanel ?? 'none',
    activity: getViewActivity(EMAIL_PANEL),
  } as unknown as JsonValue;
}

/** Report a selected document as unavailable only when its folder tree is loaded. */
function unavailableSelectedPath(content: EmailViewerWorksurfaceContent): string[] {
  const selected = content.selectedPath;
  if (!selected) return [];
  const lastSlash = selected.lastIndexOf('/');
  const folder = lastSlash === -1 ? '' : selected.slice(0, lastSlash);
  const tree = useFileDataStore.getState().trees[`${EMAIL_PANEL}:${folder}`];
  if (!tree) return [];
  return tree.some((node) => node.type === 'file' && node.path === selected) ? [] : [selected];
}

async function restoreEmailViewerWorksurface(content: JsonValue): Promise<RestoreResult> {
  const sanitized = sanitizeEmailViewerWorksurface(
    content,
    EMAIL_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  );
  if (!sanitized.ok || !isRecord(sanitized.content)) {
    return { restored: false, warning: sanitized.warning ?? 'invalid_content' };
  }
  const accepted = sanitized.content as unknown as EmailViewerWorksurfaceContent;
  // Hydrate the live render state without touching the non-group global writer.
  usePanelStore.getState().setViewState(EMAIL_PANEL, {
    emailViewerMode: accepted.mode,
    emailViewerCurrentFolder: accepted.currentFolder,
    emailViewerSelectedPath: accepted.selectedPath,
    emailDocumentSidePanel: accepted.sidePanel,
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

export const emailViewerWorksurfaceAdapter: WorksurfaceAdapter = {
  adapterId: EMAIL_VIEWER_WORKSURFACE_ADAPTER_ID,
  adapterVersion: EMAIL_VIEWER_WORKSURFACE_SCHEMA_VERSION,
  capture: captureEmailViewerWorksurface,
  sanitize: sanitizeEmailViewerWorksurface,
  restore: restoreEmailViewerWorksurface,
};
