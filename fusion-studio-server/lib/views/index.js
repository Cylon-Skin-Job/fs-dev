/**
 * @module views
 * @role View discovery and resolution
 *
 * Reads the machine-scoped V2 folder structure:
 * ai/<machine>/System/Views/<prefix>-<view-id>/.
 *
 * Nothing in this module touches the database. Everything comes from the
 * filesystem (manifest.md, content.json, styles/icon.md, styles/layout.json).
 */

const path = require('path');
const fs = require('fs');
const registryWriter = require('./workspace-registry-writer');
const aiPaths = require('../workspace/ai-paths');
const { classifyEntrySync } = require('../fs/dirents');
const {
  parseCanonicalViewId,
  canonicalViewIdsEqual,
  assertUniqueCanonicalViewIds,
} = require('./view-id');
const { buildViewCapsulesProjection: assembleViewCapsulesProjection } = require('./view-capsules-projection');
const { buildTabPolicyWireEntry, MAX_TAB_POLICY_PROJECTION_ENTRIES } = require('./tab-policy');
const { parseSimpleYaml } = require('./simple-yaml');

const V2_TOP_LEVEL_CONTENT_ROOTS = new Set(['Wiki', 'Captures', 'Issues', 'Agents', 'Office', 'Email']);
const V2_OPERATIONAL_FALLBACKS = {
  'capture-viewer': 'Captures',
  'wiki-viewer': 'Wiki',
  'issues-viewer': 'Issues',
  'agents-viewer': 'Agents',
  'office-viewer': 'Office',
  'email-viewer': 'Email',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Get the views root directory for a project.
 * @param {string} projectRoot
 * @returns {string}
 */
function getViewsRoot(projectRoot) {
  return aiPaths.getMachineViewsRoot(projectRoot);
}

function getMachineAiRoot(projectRoot) {
  return aiPaths.getMachineAiRoot(projectRoot);
}

function hasV2Views(projectRoot, { strictFilesystemErrors = false } = {}) {
  try {
    return fs.statSync(aiPaths.getMachineViewsRoot(projectRoot)).isDirectory();
  } catch (error) {
    if (strictFilesystemErrors && !['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;
    return false;
  }
}

/**
 * List all view IDs from the machine-scoped System/Views folder.
 * @param {string} projectRoot
 * @returns {string[]}
 */
function listViews(projectRoot, options = {}) {
  return listV2Views(projectRoot, options).map(view => view.id);
}

/**
 * Load a view's identity from its index.json.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadViewIndex(projectRoot, viewId, options = {}) {
  const v2View = loadV2ViewShell(projectRoot, viewId, options);
  return v2View ? v2View.index : null;
}

/**
 * Load a view's content declaration from its content.json.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadContentConfig(projectRoot, viewId, options = {}) {
  const v2View = loadV2ViewShell(projectRoot, viewId, options);
  return v2View ? v2View.content : null;
}

/**
 * Load a view's layout settings from System/Views/<prefix>-<viewId>/styles/layout.json.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadLayoutConfig(projectRoot, viewId, options = {}) {
  const v2View = loadV2ViewShell(projectRoot, viewId, options);
  return v2View ? v2View.layout : null;
}

/**
 * Load everything about a view: identity + content config + layout.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadView(projectRoot, viewId, options = {}) {
  return loadV2ViewShell(projectRoot, viewId, options);
}

/**
 * Load all views, sorted by rank.
 * @param {string} projectRoot
 * @returns {object[]}
 */
function loadAllViews(projectRoot) {
  const ids = listViews(projectRoot);
  return ids
    .map(id => loadView(projectRoot, id))
    .filter(v => v !== null)
    .sort((a, b) => (a.index.rank ?? 999) - (b.index.rank ?? 999));
}

/**
 * Resolve the content path for a view.
 *
 * Rules:
 *   - content.json root declaration
 *   - data-source fallback under ai/<machine>/
 *   - project-root for file-viewer
 *
 * @param {string} projectRoot
 * @param {string} viewId
 * @param {object} [context] - Additional context (e.g., session root for file-viewer)
 * @returns {string|null} - Filesystem path to the view's content root
 */
function resolveContentPath(projectRoot, viewId, context = {}) {
  const view = loadView(projectRoot, viewId, {
    includeHidden: context.includeHidden === true,
    strictFilesystemErrors: context.strictFilesystemErrors === true,
  });
  if (!view) return null;

  return resolveV2ContentPath(projectRoot, view, context);
}

function resolveViewRoot(projectRoot, viewId, options = {}) {
  const view = loadView(projectRoot, viewId, {
    includeHidden: options.includeHidden === true,
    strictFilesystemErrors: options.strictFilesystemErrors === true,
    strictReadiness: options.strictReadiness === true,
  });
  if (view) return view.viewRoot;
  return null;
}

function resolveOperationalViewRoot(projectRoot, viewId, options = {}) {
  return resolveContentPath(projectRoot, viewId, {
    ...options,
    includeHidden: options.includeHidden !== false,
  }) || path.join(getMachineAiRoot(projectRoot), V2_OPERATIONAL_FALLBACKS[viewId] || viewId);
}

function resolveV2ContentPath(projectRoot, view, context = {}) {
  if (view.content && view.content.root !== null && view.content.root !== undefined) {
    return resolveContentRootDeclaration(projectRoot, view, view.content.root, context);
  }
  return resolveDefaultV2ContentPath(projectRoot, view, context);
}

function resolveDefaultV2ContentPath(projectRoot, view, context = {}) {
  const viewId = view.id;
  const machineRoot = getMachineAiRoot(projectRoot);
  const dataSource = view.content?.dataSource || view.index?.metadata?.['data-source'];

  if (dataSource === 'project-root' || viewId === 'file-viewer') {
    return context.sessionRoot || projectRoot;
  }
  if (V2_TOP_LEVEL_CONTENT_ROOTS.has(dataSource)) {
    return path.join(machineRoot, dataSource);
  }
  if (viewId === 'wiki-viewer') return path.join(machineRoot, 'Wiki');
  if (viewId === 'capture-viewer') return path.join(machineRoot, 'Captures');
  if (viewId === 'issues-viewer') return path.join(machineRoot, 'Issues');
  if (viewId === 'agents-viewer') return path.join(machineRoot, 'Agents');
  if (viewId === 'office-viewer') return path.join(machineRoot, 'Office');
  if (viewId === 'email-viewer') return path.join(machineRoot, 'Email');
  return view.viewRoot;
}

function resolveContentRootDeclaration(projectRoot, view, declaration, context = {}) {
  if (typeof declaration === 'string') {
    return resolveWorkspaceRelativeContentPath(projectRoot, view, declaration);
  }
  if (!isPlainObject(declaration)) {
    throw new Error(`View content root is invalid for ${view.id}`);
  }

  const type = declaration.type || 'workspace-relative';
  if (type === 'project-root') {
    return context.sessionRoot || projectRoot;
  }
  if (type === 'workspace-relative') {
    return resolveWorkspaceRelativeContentPath(projectRoot, view, declaration.path);
  }
  if (type === 'machine-relative') {
    return resolveMachineRelativeContentPath(projectRoot, view, declaration.path);
  }
  if (type === 'view-relative') {
    return resolveViewRelativeContentPath(view, declaration.path);
  }
  if (type === 'absolute') {
    return resolveAbsoluteContentPath(projectRoot, view, declaration.path);
  }
  if (type === 'selected-folder') {
    return declaration.path
      ? resolveWorkspaceRelativeContentPath(projectRoot, view, declaration.path)
      : view.viewRoot;
  }
  if (type === 'sqlite' || type === 'none') {
    return view.viewRoot;
  }

  throw new Error(`Unknown content root type for ${view.id}: ${type}`);
}

function expandContentPathVariables(projectRoot, value) {
  return String(value || '')
    .replace(/\$\{machine\}/g, aiPaths.getLocalMachineName())
    .replace(/\$\{workspace\}/g, path.basename(projectRoot));
}

function assertPathInside(candidate, rootPath, message) {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolved;
  }
  throw new Error(message);
}

function resolveWorkspaceRelativeContentPath(projectRoot, view, rawPath) {
  const expanded = expandContentPathVariables(projectRoot, rawPath);
  if (!expanded || path.isAbsolute(expanded)) {
    throw new Error(`Workspace-relative content root must be a relative path for ${view.id}`);
  }
  return assertPathInside(
    path.resolve(projectRoot, expanded),
    projectRoot,
    `View content root escapes workspace for ${view.id}`
  );
}

function resolveMachineRelativeContentPath(projectRoot, view, rawPath) {
  const machineRoot = getMachineAiRoot(projectRoot);
  const expanded = expandContentPathVariables(projectRoot, rawPath);
  if (!expanded || path.isAbsolute(expanded)) {
    throw new Error(`Machine-relative content root must be a relative path for ${view.id}`);
  }
  return assertPathInside(
    path.resolve(machineRoot, expanded),
    machineRoot,
    `View content root escapes machine ai folder for ${view.id}`
  );
}

function resolveViewRelativeContentPath(view, rawPath) {
  const expanded = String(rawPath || '');
  if (!expanded || path.isAbsolute(expanded)) {
    throw new Error(`View-relative content root must be a relative path for ${view.id}`);
  }
  return assertPathInside(
    path.resolve(view.viewRoot, expanded),
    view.viewRoot,
    `View content root escapes view capsule for ${view.id}`
  );
}

function resolveAbsoluteContentPath(projectRoot, view, rawPath) {
  const expanded = expandContentPathVariables(projectRoot, rawPath);
  if (!expanded || !path.isAbsolute(expanded)) {
    throw new Error(`Absolute content root must be an absolute path for ${view.id}`);
  }
  return path.resolve(expanded);
}

function listV2Views(projectRoot, options = {}) {
  if (!hasV2Views(projectRoot, options)) return [];
  const hiddenIds = registryWriter.getV2HiddenViewIds(projectRoot);
  return listV2ViewFolders(projectRoot, options)
    .filter((entry) => !hiddenIds.has(entry.id))
    .map((entry) => loadV2ViewShellFromEntry(projectRoot, entry))
    .filter(Boolean)
    .filter(view => view.index?.metadata?.enabled !== false);
}

function loadV2ViewShell(projectRoot, viewId, options = {}) {
  if (!hasV2Views(projectRoot, options)) return null;
  const parsedViewId = parseCanonicalViewId(viewId, 'requested view');
  if (!options.includeHidden) {
    const hiddenIds = registryWriter.getV2HiddenViewIds(projectRoot);
    if (hiddenIds.has(parsedViewId)) return null;
  }
  const entry = listV2ViewFolders(projectRoot, options).find((candidate) => (
    canonicalViewIdsEqual(candidate.id, parsedViewId)
  ));
  if (!entry) return null;
  return loadV2ViewShellFromEntry(projectRoot, entry, options);
}

function listV2ViewFolders(projectRoot, {
  strictFilesystemErrors = false,
} = {}) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  let dirents;
  try {
    dirents = fs.readdirSync(viewsRoot, { withFileTypes: true });
  } catch (error) {
    if (strictFilesystemErrors && !['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;
    return [];
  }

  const entries = dirents
      .filter((entry) => classifyEntrySync(
        viewsRoot,
        entry,
        { strictFilesystemErrors },
      ).isDir && !entry.name.startsWith('.'))
      .map((entry) => {
        const match = entry.name.match(/^(\d+)-(.+)$/);
        const order = match ? Number(match[1]) : 999;
        const viewRoot = path.join(viewsRoot, entry.name);
        const manifest = readFrontmatter(
          path.join(viewRoot, 'manifest.md'),
          { strictFilesystemErrors },
        );
        const metadata = Object.hasOwn(manifest, 'metadata') && isPlainObject(manifest.metadata)
          ? manifest.metadata
          : null;
        const manifestId = metadata && Object.hasOwn(metadata, 'view-id')
          ? metadata['view-id']
          : undefined;
        const id = parseCanonicalViewId(manifestId, `View capsule ${entry.name}`);
        return {
          id,
          folderName: entry.name,
          order,
          viewRoot,
          manifest,
        };
      })
      .sort((a, b) => {
        const orderDiff = a.order - b.order;
        if (orderDiff !== 0) return orderDiff;
        return a.folderName.localeCompare(b.folderName);
      });
  assertUniqueCanonicalViewIds(entries);
  return entries;
}

function loadV2ViewShellFromEntry(projectRoot, entry, { strictFilesystemErrors = false } = {}) {
  const icon = readFrontmatter(
    path.join(entry.viewRoot, 'styles', 'icon.md'),
    { strictFilesystemErrors },
  );
  const metadata = entry.manifest.metadata || {};
  const id = entry.id;
  const contentConfig = readJsonObject(
    path.join(entry.viewRoot, 'content.json'),
    `View content config is invalid for ${id}`
  ) || {};
  const layoutConfig = readJsonObject(
    path.join(entry.viewRoot, 'styles', 'layout.json'),
    `View layout config is invalid for ${id}`
  ) || {};
  const viewSettings = extractV2ViewSettings(metadata);
  return {
    id,
    index: {
      id,
      label: entry.manifest.name || displayLabelFromId(id),
      icon: icon.metadata?.['icon-name'] || 'folder',
      rank: entry.order,
      type: metadata['view-type'] || 'placeholder',
      metadata,
      ...viewSettings,
    },
    content: normalizeV2ContentConfig(contentConfig, metadata),
    // Raw optional `tabs` object from content.json (undefined when absent).
    // Parsed strictly by tab-policy.js at projection time; a malformed value
    // never fails view discovery — see buildTabPoliciesProjection.
    tabsRaw: contentConfig.tabs,
    layout: layoutConfig,
    viewRoot: entry.viewRoot,
    v2: true,
  };
}

/**
 * Build the path-free capsule correlation record forwarded to Electron.
 * Canonical discovery is mandatory for every caller, so an invalid or
 * duplicate manifest identity can never become path authority.
 */
function buildViewCapsulesProjection(projectRoot, workspaceId, options = {}) {
  const machineIdentity = Object.prototype.hasOwnProperty.call(options, 'machineIdentity')
    ? options.machineIdentity
    : aiPaths.getLocalMachineName();

  if (!hasV2Views(projectRoot, { strictFilesystemErrors: true })) {
    throw new Error('View capsule root is unavailable');
  }

  const entries = listV2ViewFolders(projectRoot, {
    strictFilesystemErrors: true,
    strictReadiness: true,
  });
  return assembleViewCapsulesProjection({
    workspaceId,
    machineIdentity,
    entries,
  });
}

/**
 * Build the frozen path-free `tabPolicies` projection for the given canonical
 * view ids (SPEC-02 §4). One entry per view that HAS a `tabs` object in its
 * content.json:
 *   - valid config   → {schemaVersion: 1, status: "ready", policy};
 *   - invalid config → {schemaVersion: 1, status: "unavailable",
 *                       code: "tab_configuration_unavailable"};
 *   - no `tabs` key  → no entry at all (absence = legacy renderer path).
 *
 * A malformed `tabs` object never throws here: only that view's entry becomes
 * unavailable. Whole-file content.json parse failures still surface as the
 * existing viewRegistryUnavailable degradation upstream (readJsonObject
 * throws during shell loading).
 *
 * @param {string} projectRoot
 * @param {string[]} viewIds - canonical visible view ids from strict discovery
 * @returns {object} frozen map viewId → frozen wire entry
 */
function buildTabPoliciesProjection(projectRoot, viewIds) {
  if (!Array.isArray(viewIds) || viewIds.length > MAX_TAB_POLICY_PROJECTION_ENTRIES) {
    throw new Error('Tab policy projection exceeds the supported entry limit');
  }
  const entries = {};
  for (const viewId of viewIds) {
    const canonicalViewId = parseCanonicalViewId(viewId, 'tab policy projection');
    const view = loadV2ViewShell(projectRoot, canonicalViewId, { strictFilesystemErrors: true });
    if (!view) continue;
    const wireEntry = buildTabPolicyWireEntry(view.tabsRaw, canonicalViewId);
    if (wireEntry) entries[canonicalViewId] = wireEntry;
  }
  return Object.freeze(entries);
}

function extractV2ViewSettings(metadata) {
  const settings = {};
  if (typeof metadata.url === 'string' && metadata.url.trim()) {
    settings.url = metadata.url.trim();
  }
  if (typeof metadata.homepage === 'string' && metadata.homepage.trim()) {
    settings.homepage = metadata.homepage.trim();
  }
  const chrome = {};
  if (metadata['chrome-url-bar'] !== undefined) {
    chrome.urlBar = metadata['chrome-url-bar'] === true || metadata['chrome-url-bar'] === 'true';
  }
  if (metadata['chrome-nav-buttons'] !== undefined) {
    chrome.navButtons = metadata['chrome-nav-buttons'] === true || metadata['chrome-nav-buttons'] === 'true';
  }
  if (metadata['chrome-tabs'] !== undefined) {
    chrome.tabs = metadata['chrome-tabs'] === true || metadata['chrome-tabs'] === 'true';
  }
  if (Object.keys(chrome).length > 0) settings.chrome = chrome;
  return settings;
}

function normalizeV2ContentConfig(config, metadata) {
  return {
    display: typeof config.display === 'string' ? config.display : metadata['view-type'] || 'placeholder',
    chat: config.chat === undefined ? null : config.chat,
    dataSource: typeof config.dataSource === 'string' ? config.dataSource : metadata['data-source'] || null,
    root: config.root === undefined ? null : config.root,
  };
}

function readJsonObject(filePath, errorPrefix) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isPlainObject(parsed)) {
      throw new Error('expected a JSON object');
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`${errorPrefix}: ${err.message}`);
  }
}

function readFrontmatter(filePath, { strictFilesystemErrors = false } = {}) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (strictFilesystemErrors && !['ENOENT', 'ENOTDIR'].includes(error?.code)) throw error;
    return {};
  }
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function displayLabelFromId(id) {
  return String(id || '')
    .replace(/-viewer$/, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'View';
}

/**
 * Resolve chat config for a view. Returns null if the view has no chat.
 *
 * Chat availability is declared by the view's content.json `chat` field.
 * RCC-0095: the legacy per-view `<view>/chat/` folder is no longer a
 * capability marker — chat is the single workspace chat, and empty
 * per-view chat folders are not required or consulted.
 *
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {{ chatType: string, chatPosition: string }|null}
 */
function resolveChatConfig(projectRoot, viewId) {
  const view = loadView(projectRoot, viewId);
  if (!view || !view.content.chat) return null;

  return {
    chatType: view.content.chat.type,
    chatPosition: view.layout.chatPosition || view.content.chat.position,
  };
}

module.exports = {
  getViewsRoot,
  hasV2Views,
  getWorkspaceViewOptions: registryWriter.getWorkspaceViewOptions,
  restoreWorkspaceView: registryWriter.restoreWorkspaceView,
  addWorkspaceView: registryWriter.addWorkspaceView,
  updateWorkspaceViewRegistry: registryWriter.updateWorkspaceViewRegistry,
  listViews,
  loadViewIndex,
  loadContentConfig,
  loadLayoutConfig,
  loadView,
  loadAllViews,
  resolveViewRoot,
  resolveOperationalViewRoot,
  resolveContentPath,
  resolveChatConfig,
  buildViewCapsulesProjection,
  buildTabPoliciesProjection,
};
