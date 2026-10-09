/**
 * @module componentTabLauncherCatalog
 * @role Closed code-owned launcher catalog METADATA for component tabs
 *       (SPEC-02 §5, VRT-009/VRT-011A).
 *
 * Metadata only. Launcher/picker functions are bound by the connected
 * view-specific modules in later slices; this module is intentionally
 * structured (fixed entry shape + lookup helpers) so bound functions can be
 * added without reshaping consumers.
 *
 * Rules enforced here by construction:
 *   - the registry is code-owned: configuration can only select IDs listed
 *     here, never introduce import paths, executables, or new capabilities;
 *   - the registry imports no stores, views, or network;
 *   - Side Chat is NOT registered or shown (SPEC-02 §5).
 */

export type ComponentTabLauncherKind = 'component' | 'picker';

export interface ComponentTabLauncherCatalogEntry {
  readonly launcherId: string;
  readonly viewId: string;
  readonly kind: ComponentTabLauncherKind;
  readonly label: string;
  readonly icon?: string;
  readonly description?: string;
}

export const COMPONENT_TAB_LAUNCHER_CATALOG: ReadonlyArray<ComponentTabLauncherCatalogEntry> = Object.freeze([
  Object.freeze({
    launcherId: 'capture.home',
    viewId: 'capture-viewer',
    kind: 'component',
    label: 'Capture Home',
    description: 'Resolve the existing Capture landing presenter; no file or folder creation.',
  }),
  Object.freeze({
    launcherId: 'file.open',
    viewId: 'file-viewer',
    kind: 'picker',
    label: 'Open File',
    description: 'Reveal the file-tree drawer and keep this tab as the destination.',
  }),
]);

/**
 * Exact-match catalog lookup: the launcher must exist AND belong to the
 * requesting view. Unknown or wrong-view IDs return null (fail-closed).
 */
export function findComponentTabLauncherCatalogEntry(
  launcherId: string,
  viewId: string,
): ComponentTabLauncherCatalogEntry | null {
  const entry = COMPONENT_TAB_LAUNCHER_CATALOG.find((candidate) => candidate.launcherId === launcherId);
  if (!entry || entry.viewId !== viewId) return null;
  return entry;
}

/** Ordered launcher IDs the given view's tab policy may name. */
export function componentTabLauncherCatalogIdsForView(viewId: string): readonly string[] {
  return Object.freeze(
    COMPONENT_TAB_LAUNCHER_CATALOG
      .filter((entry) => entry.viewId === viewId)
      .map((entry) => entry.launcherId),
  );
}
