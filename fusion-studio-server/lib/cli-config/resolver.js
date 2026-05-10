/**
 * CLI-config resolver (CLI_CONFIG_SPEC §6).
 *
 * Effective config = factory catalog ← workspace cli.json ← per-view cli.json.
 * Returns a map keyed by CLI id with every factory field populated plus
 * `order` defaulted from the catalog index.
 */

const { CATALOG, CATALOG_BY_ID } = require('./catalog');
const { loadWorkspaceConfig, loadViewConfig } = require('./loader');

const ALLOWED_KEYS = new Set(['enabled', 'name', 'materialIcon', 'accentColor', 'order']);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function cloneEntry(entry) {
  return {
    id:           entry.id,
    name:         entry.name,
    description:  entry.description,
    materialIcon: entry.materialIcon,
    accentColor:  entry.accentColor,
    details: {
      provider: entry.details.provider,
      model:    entry.details.model,
      features: [...entry.details.features],
    },
    enabled:     entry.enabled,
    comingSoon:  entry.comingSoon,
    recommended: entry.recommended,
  };
}

function validateOverrideEntry(id, override, label) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    console.warn(`[cli-config] ${label}: entry for '${id}' is not an object — ignoring`);
    return {};
  }
  const clean = {};
  for (const key of Object.keys(override)) {
    if (!ALLOWED_KEYS.has(key)) {
      console.warn(`[cli-config] ${label}: unknown key '${key}' on '${id}' — ignored`);
      continue;
    }
    const val = override[key];
    if (val === null) {
      clean[key] = null;
      continue;
    }
    if (key === 'enabled' && typeof val !== 'boolean') {
      console.warn(`[cli-config] ${label}: '${id}.enabled' must be boolean — ignored`);
      continue;
    }
    if ((key === 'name' || key === 'materialIcon') && typeof val !== 'string') {
      console.warn(`[cli-config] ${label}: '${id}.${key}' must be string — ignored`);
      continue;
    }
    if (key === 'accentColor') {
      if (typeof val !== 'string' || !HEX_RE.test(val)) {
        console.warn(`[cli-config] ${label}: '${id}.accentColor' must match #RRGGBB — ignored`);
        continue;
      }
    }
    if (key === 'order' && typeof val !== 'number') {
      console.warn(`[cli-config] ${label}: '${id}.order' must be number — ignored`);
      continue;
    }
    clean[key] = val;
  }
  return clean;
}

function sanitizeOverrides(raw, label) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(raw)) {
    if (!CATALOG_BY_ID[id]) {
      console.warn(`[cli-config] ${label}: unknown CLI id '${id}' — ignored`);
      continue;
    }
    out[id] = validateOverrideEntry(id, raw[id], label);
  }
  return out;
}

function applyOverride(entry, override) {
  if (!override) return entry;
  for (const key of Object.keys(override)) {
    entry[key] = override[key]; // null replaces (spec §3)
  }
  return entry;
}

function buildResolved(workspaceClean, viewClean) {
  const out = {};
  CATALOG.forEach((factory, idx) => {
    const entry = cloneEntry(factory);
    entry.order = idx;
    applyOverride(entry, workspaceClean[factory.id]);
    applyOverride(entry, viewClean[factory.id]);
    out[factory.id] = entry;
  });
  return out;
}

/**
 * Resolve the effective CLI config for a view (or workspace-wide if viewId
 * is null). Deep-merges factory catalog → workspace cli.json → per-view.
 */
async function resolveCliConfig(projectRoot, viewId = null) {
  const workspaceRaw = await loadWorkspaceConfig(projectRoot);
  const viewRaw      = viewId ? await loadViewConfig(projectRoot, viewId) : {};
  const workspaceClean = sanitizeOverrides(workspaceRaw, 'workspace cli.json');
  const viewClean      = sanitizeOverrides(viewRaw,      `per-view cli.json (${viewId})`);
  return buildResolved(workspaceClean, viewClean);
}

/**
 * Load the raw per-view override as a sanitized delta (not merged with
 * workspace). Used by `panel_changed` (spec §7d).
 */
async function resolveViewDelta(projectRoot, viewId) {
  if (!viewId) return {};
  const raw = await loadViewConfig(projectRoot, viewId);
  return sanitizeOverrides(raw, `per-view cli.json (${viewId})`);
}

module.exports = {
  resolveCliConfig,
  resolveViewDelta,
  sanitizeOverrides,
};
