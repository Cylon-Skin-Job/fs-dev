/**
 * @module fileConnectedPresenterTargets
 * @role VIEW-02 Slice 4 — code-owned File Explorer presenter/target identity
 *       constants shared by the connected ports, adapter, and presenters
 *       (SPEC-02 §10, VRT-012). Pure module: no stores, no network.
 */

/** Canonical File resource key prefix: `file:doc:<canonical path>`. */
export const FILE_VIEWER_TARGET_KEY_PREFIX = 'file:doc:';

/** Presenter IDs are code-owned and equal their component type IDs. */
export const FILE_DOCUMENT_COMPONENT_TYPE = 'file.document';
export const FILE_DOCUMENT_PRESENTER_ID = FILE_DOCUMENT_COMPONENT_TYPE;

/** The connected File Explorer panel identity. */
export const FILE_VIEWER_PANEL_ID = 'file-viewer';

/** Fallback view label when the panel config carries no name. */
export const FILE_VIEWER_FALLBACK_LABEL = 'Files';

/**
 * Canonical file path for the connected File surface (VRT-012 target keys).
 * The canonical path is the EXACT resource path used for fetching/saving
 * through the existing fileDataStore owner — normalization only rejects
 * unsafe shapes and never rewrites a valid hydrated path's meaning.
 */
export function canonicalFilePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) return null;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

/** File document target key for one canonical path. */
export function fileDocumentTargetKey(path: string): string {
  return `${FILE_VIEWER_TARGET_KEY_PREFIX}${path}`;
}

/** Splits one canonical path into display name + lowercase extension. */
export function splitFilePath(path: string): { name: string; extension: string } {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return { name, extension };
}

/**
 * Ordered location segments for one file tab: the view label followed by the
 * full canonical path segments. Display-only; never authoritative.
 */
export function fileLocationLabels(path: string, viewLabel: string): string[] {
  return [viewLabel, ...path.split('/')];
}
