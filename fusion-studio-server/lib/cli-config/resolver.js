/**
 * CLI-config resolver (CLI_CONFIG_SPEC §6).
 *
 * Effective config = workspace cli.json harness policy over catalog metadata,
 * optionally decorated by per-view cli.json display overrides.
 *
 * Workspace `cli.json` is the allow-list/default policy. Missing, empty, or
 * malformed policy resolves to OpenCode-only.
 */

const { CATALOG_BY_ID } = require('./catalog');
const { loadWorkspaceConfig, loadViewConfig, defaultWorkspaceConfig } = require('./loader');

const ALLOWED_KEYS = new Set(['enabled', 'name', 'materialIcon', 'accentColor', 'order', 'model', 'thinking', 'pure']);
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
    runtime:     {},
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
    if (key === 'model') {
      if (typeof val !== 'string' || val.trim() === '') {
        console.warn(`[cli-config] ${label}: '${id}.model' must be non-empty string — ignored`);
        continue;
      }
      clean.details = { ...(clean.details || {}), model: val };
      clean.runtime = { ...(clean.runtime || {}), model: val };
      continue;
    }
    if ((key === 'thinking' || key === 'pure') && typeof val !== 'boolean') {
      console.warn(`[cli-config] ${label}: '${id}.${key}' must be boolean — ignored`);
      continue;
    }
    if (key === 'thinking' || key === 'pure') {
      clean.runtime = { ...(clean.runtime || {}), [key]: val };
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

function isPolicyShape(raw) {
  return raw
    && typeof raw === 'object'
    && !Array.isArray(raw)
    && (Object.prototype.hasOwnProperty.call(raw, 'harnesses')
      || Object.prototype.hasOwnProperty.call(raw, 'defaultHarness'));
}

function normalizeWorkspacePolicy(raw, label) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const policy = isPolicyShape(source)
    ? source
    : {
      defaultHarness: 'opencode',
      harnesses: source,
    };
  const harnesses = policy.harnesses && typeof policy.harnesses === 'object' && !Array.isArray(policy.harnesses)
    ? policy.harnesses
    : {};
  const clean = sanitizeOverrides(harnesses, label);
  const enabledIds = Object.keys(clean).filter((id) => clean[id].enabled !== false);

  if (enabledIds.length === 0) {
    return normalizeWorkspacePolicy(defaultWorkspaceConfig(), `${label} fallback`);
  }

  let defaultHarness = typeof policy.defaultHarness === 'string'
    ? policy.defaultHarness
    : 'opencode';
  if (!clean[defaultHarness] || clean[defaultHarness].enabled === false) {
    if (defaultHarness !== 'opencode') {
      console.warn(`[cli-config] ${label}: defaultHarness '${defaultHarness}' is not listed and enabled — using '${enabledIds[0]}'`);
    }
    defaultHarness = enabledIds.includes('opencode') ? 'opencode' : enabledIds[0];
  }

  return { defaultHarness, harnesses: clean };
}

function applyOverride(entry, override) {
  if (!override) return entry;
  for (const key of Object.keys(override)) {
    if (key === 'details' && override.details) {
      entry.details = { ...entry.details, ...override.details };
      continue;
    }
    if (key === 'runtime' && override.runtime) {
      entry.runtime = { ...(entry.runtime || {}), ...override.runtime };
      continue;
    }
    entry[key] = override[key]; // null replaces (spec §3)
  }
  return entry;
}

function buildResolved(workspaceClean, viewClean) {
  const out = {};
  Object.keys(workspaceClean.harnesses).forEach((id, idx) => {
    const factory = CATALOG_BY_ID[id];
    if (!factory) return;
    const override = workspaceClean.harnesses[id];
    if (override.enabled === false) return;
    const entry = cloneEntry(factory);
    entry.order = idx;
    applyOverride(entry, override);
    applyOverride(entry, viewClean[id]);
    if (entry.enabled !== false) out[id] = entry;
  });
  return out;
}

/**
 * Resolve the effective CLI config for a view (or workspace-wide if viewId
 * is null). Only workspace-listed enabled harnesses are returned; per-view
 * config may decorate those entries for display.
 */
async function resolveCliConfig(projectRoot, viewId = null) {
  const workspaceRaw = await loadWorkspaceConfig(projectRoot);
  const viewRaw      = viewId ? await loadViewConfig(projectRoot, viewId) : {};
  const workspaceClean = normalizeWorkspacePolicy(workspaceRaw, 'workspace cli.json');
  const viewClean      = sanitizeOverrides(viewRaw,      `per-view cli.json (${viewId})`);
  return buildResolved(workspaceClean, viewClean);
}

async function resolveCliPolicy(projectRoot) {
  const workspaceRaw = await loadWorkspaceConfig(projectRoot);
  const policy = normalizeWorkspacePolicy(workspaceRaw, 'workspace cli.json');
  const config = buildResolved(policy, {});
  const enabledIds = Object.keys(config);
  const defaultHarness = config[policy.defaultHarness]
    ? policy.defaultHarness
    : (enabledIds.includes('opencode') ? 'opencode' : enabledIds[0]);
  return { defaultHarness, allowedHarnesses: enabledIds, config };
}

async function resolveDefaultHarness(projectRoot) {
  const policy = await resolveCliPolicy(projectRoot);
  return policy.defaultHarness;
}

async function isHarnessAllowed(projectRoot, harnessId) {
  const policy = await resolveCliPolicy(projectRoot);
  return policy.allowedHarnesses.includes(harnessId);
}

/**
 * Load the raw per-view override as a sanitized delta (not merged with
 * workspace). Used by `panel_changed` (spec §7d).
 */
async function resolveViewDelta(projectRoot, viewId) {
  if (!viewId) return {};
  const raw = await loadViewConfig(projectRoot, viewId);
  const source = isPolicyShape(raw) ? raw.harnesses : raw;
  return sanitizeOverrides(source, `per-view cli.json (${viewId})`);
}

module.exports = {
  resolveCliConfig,
  resolveCliPolicy,
  resolveDefaultHarness,
  isHarnessAllowed,
  resolveViewDelta,
  sanitizeOverrides,
  normalizeWorkspacePolicy,
};
