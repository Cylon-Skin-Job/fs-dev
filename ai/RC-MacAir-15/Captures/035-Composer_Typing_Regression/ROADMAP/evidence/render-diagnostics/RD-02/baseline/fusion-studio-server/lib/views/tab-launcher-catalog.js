/**
 * @module tab-launcher-catalog
 * @role Closed code-owned launcher catalog metadata (SPEC-02 §5, VRT-009).
 *
 * Maps each adopted view to the exact set of launcher IDs its tab policy may
 * name. Configuration selects among these code-owned choices; it can never
 * introduce a new capability, import path, or executable target. Unknown or
 * wrong-view IDs are rejected by the tab policy parser.
 *
 * Side Chat is deliberately NOT registered here (not even disabled) — SPEC-02
 * §5: "Side Chat is not registered or shown."
 *
 * Version-1 catalog:
 *   capture-viewer → capture.home
 *   file-viewer    → file.open
 */

const TAB_LAUNCHER_CATALOG_VERSION = 1;

const TAB_LAUNCHER_CATALOG = Object.freeze({
  'capture-viewer': Object.freeze(['capture.home']),
  'file-viewer': Object.freeze(['file.open']),
});

/**
 * Return the frozen list of valid launcher IDs for a view, or null when the
 * view has no code-owned launcher catalog entry.
 *
 * @param {string} viewId - canonical view id
 * @returns {readonly string[]|null}
 */
function getCatalogLauncherIds(viewId) {
  if (typeof viewId !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(TAB_LAUNCHER_CATALOG, viewId)) return null;
  return TAB_LAUNCHER_CATALOG[viewId];
}

/**
 * True only when `launcherId` is a code-owned launcher of exactly this view.
 *
 * @param {string} viewId
 * @param {string} launcherId
 * @returns {boolean}
 */
function isCatalogLauncherIdForView(viewId, launcherId) {
  const launcherIds = getCatalogLauncherIds(viewId);
  if (!launcherIds) return false;
  return launcherIds.includes(launcherId);
}

module.exports = {
  TAB_LAUNCHER_CATALOG_VERSION,
  TAB_LAUNCHER_CATALOG,
  getCatalogLauncherIds,
  isCatalogLauncherIdForView,
};
