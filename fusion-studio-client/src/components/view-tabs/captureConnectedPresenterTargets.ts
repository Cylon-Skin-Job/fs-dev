/**
 * @module captureConnectedPresenterTargets
 * @role VIEW-02 Slice 3 — code-owned Capture presenter/target identity
 *       constants shared by the connected ports, conversion, adapter, and
 *       presenters (SPEC-02 §9). Pure module: no stores, no network.
 */

/** Canonical Capture resource key prefix: `capture:doc:<canonical path>`. */
export const CAPTURE_VIEWER_TARGET_KEY_PREFIX = 'capture:doc:';

/** Stable home target key for the Capture landing presenter. */
export const CAPTURE_HOME_TARGET_KEY = 'capture:home';

/** Bounded-unavailable target key (asserted full-page state with no valid document). */
export const CAPTURE_UNAVAILABLE_TARGET_KEY = 'capture:unavailable';

/** Presenter IDs are code-owned and equal their component type IDs. */
export const CAPTURE_LANDING_COMPONENT_TYPE = 'capture.landing';
export const CAPTURE_LANDING_PRESENTER_ID = CAPTURE_LANDING_COMPONENT_TYPE;
export const CAPTURE_DOCUMENT_PRESENTER_ID = 'capture.document';
export const CAPTURE_UNAVAILABLE_PRESENTER_ID = 'capture.unavailable';

/** Home location segments: `Capture > Documents and Artifacts`. */
export const CAPTURE_LANDING_TARGET_LABELS: readonly [string, string] = [
  'Capture',
  'Documents and Artifacts',
];

const ORDERED_DOCS_FOLDER = /^\d{3}-(.+)$/;

/**
 * Collection label for a Capture document path: the ordered-docs folder label
 * (`001-Specs` → `Specs`), `Archive` for the flat archive folder, or the raw
 * first segment otherwise. Display-only; never authoritative.
 */
export function captureCollectionLabel(path: string): string {
  const firstSegment = path.slice(0, path.indexOf('/'));
  if (!firstSegment) return 'Capture';
  if (firstSegment === '999-Archive') return 'Archive';
  const match = firstSegment.match(ORDERED_DOCS_FOLDER);
  const label = match ? match[1] : firstSegment;
  return label.replace(/[-_]+/g, ' ');
}
