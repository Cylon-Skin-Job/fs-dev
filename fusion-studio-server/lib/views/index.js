/**
 * @module views
 * @role View discovery and resolution
 *
 * Reads ai/system/workspace/views.json first, then ai/views/ folder structure.
 * Provides path resolution and configuration.
 *
 * Nothing in this module touches the database. Everything comes from
 * the filesystem (index.json, content.json, settings/layout.json).
 */

const path = require('path');
const fs = require('fs');
const registryWriter = require('./workspace-registry-writer');
const aiPaths = require('../workspace/ai-paths');

/**
 * Get the views root directory for a project.
 * @param {string} projectRoot
 * @returns {string}
 */
function getViewsRoot(projectRoot) {
  const v2Root = aiPaths.getMachineViewsRoot(projectRoot);
  if (fs.existsSync(v2Root)) return v2Root;
  return path.join(projectRoot, 'ai', 'views');
}

function getLegacyViewsRoot(projectRoot) {
  return path.join(projectRoot, 'ai', 'views');
}

function getMachineAiRoot(projectRoot) {
  return aiPaths.getMachineAiRoot(projectRoot);
}

function hasV2Views(projectRoot) {
  try {
    return fs.lstatSync(aiPaths.getMachineViewsRoot(projectRoot)).isDirectory();
  } catch {
    return false;
  }
}

function getWorkspaceRegistryPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'system', 'workspace', 'views.json');
}

function loadWorkspaceRegistry(projectRoot) {
  try {
    const registry = JSON.parse(fs.readFileSync(getWorkspaceRegistryPath(projectRoot), 'utf-8'));
    if (registry.version !== 1 || !Array.isArray(registry.views)) return null;
    return registry;
  } catch {
    return null;
  }
}

function listRegistryViews(projectRoot) {
  if (hasV2Views(projectRoot)) return null;

  const registry = loadWorkspaceRegistry(projectRoot);
  if (!registry) return null;

  return registry.views
    .map((view, index) => ({ view, index }))
    .filter(({ view }) => view && view.enabled !== false && view.id)
    .filter(({ view }) => fs.existsSync(path.join(projectRoot, view.viewPath || path.join('ai', 'views', view.id))))
    .sort((a, b) => {
      const rankDiff = (a.view.rank ?? 999) - (b.view.rank ?? 999);
      if (rankDiff !== 0) return rankDiff;
      return a.index - b.index;
    })
    .map(({ view }) => view);
}

function loadRegistryView(projectRoot, viewId) {
  const registryViews = listRegistryViews(projectRoot);
  if (!registryViews) return null;
  return registryViews.find(view => view.id === viewId) || null;
}

/**
 * List all view IDs from the workspace registry, falling back to ai/views/ folders.
 * @param {string} projectRoot
 * @returns {string[]}
 */
function listViews(projectRoot) {
  const v2Views = listV2Views(projectRoot);
  if (v2Views) return v2Views.map(view => view.id);

  const registryViews = listRegistryViews(projectRoot);
  if (registryViews) return registryViews.map(view => view.id);

  const viewsRoot = getLegacyViewsRoot(projectRoot);
  if (!fs.existsSync(viewsRoot)) return [];

  return fs.readdirSync(viewsRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(viewsRoot, d.name, 'index.json')))
    .map(d => d.name);
}

/**
 * Load a view's identity from its index.json.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadViewIndex(projectRoot, viewId) {
  const v2View = loadV2ViewShell(projectRoot, viewId);
  if (v2View) return v2View.index;

  const filePath = path.join(getViewsRoot(projectRoot), viewId, 'index.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Load a view's content declaration from its content.json.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadContentConfig(projectRoot, viewId) {
  const v2View = loadV2ViewShell(projectRoot, viewId);
  if (v2View) return v2View.content;

  const filePath = path.join(getViewsRoot(projectRoot), viewId, 'content.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Load a view's layout settings from ai/views/<viewId>/settings/layout.json.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadLayoutConfig(projectRoot, viewId) {
  const v2View = loadV2ViewShell(projectRoot, viewId);
  if (v2View) return v2View.layout;

  const filePath = path.join(getViewsRoot(projectRoot), viewId, 'settings', 'layout.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Load everything about a view: identity + content config + layout.
 * @param {string} projectRoot
 * @param {string} viewId
 * @returns {object|null}
 */
function loadView(projectRoot, viewId) {
  const v2View = loadV2ViewShell(projectRoot, viewId);
  if (v2View) return v2View;

  const registryView = loadRegistryView(projectRoot, viewId);
  const index = loadViewIndex(projectRoot, viewId) || (registryView ? {
    id: registryView.id,
    label: registryView.label,
    icon: registryView.icon,
    rank: registryView.rank,
    type: 'placeholder',
  } : null);
  if (!index) return null;

  const content = loadContentConfig(projectRoot, viewId) || { display: 'placeholder', chat: null };
  const layout = loadLayoutConfig(projectRoot, viewId) || {};

  return {
    id: viewId,
    index,
    content,
    layout,
    viewRoot: registryView && registryView.viewPath
      ? path.join(projectRoot, registryView.viewPath)
      : path.join(getViewsRoot(projectRoot), viewId),
  };
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
 *   - file-viewer → project root (or per-session root if provided)
 *   - wiki-viewer → viewRoot/Wiki/ if that folder exists, else viewRoot
 *   - Any other view → viewRoot/content/ if that folder exists, else viewRoot
 *
 * The old display-type resolver registry has been eliminated. Layout is now
 * driven by per-workspace settings/layout.json and React component mapping,
 * not by a server-side content.json display field.
 *
 * @param {string} projectRoot
 * @param {string} viewId
 * @param {object} [context] - Additional context (e.g., session root for file-viewer)
 * @returns {string|null} - Filesystem path to the view's content root
 */
function resolveContentPath(projectRoot, viewId, context = {}) {
  const view = loadView(projectRoot, viewId);
  if (!view) return null;

  // file-viewer is special: it browses the project root, not its own folder
  if (viewId === 'file-viewer') {
    return context.sessionRoot || projectRoot;
  }

  // system-viewer is a built-in system workspace browser. Like file-viewer,
  // its behavior is resolved by server code instead of a view-local iframe app.
  if (viewId === 'system-viewer') {
    return projectRoot;
  }

  if (view.v2 === true) {
    const machineRoot = getMachineAiRoot(projectRoot);
    const dataSource = view.index?.metadata?.['data-source'];
    const topLevelSources = new Set(['Wiki', 'Docs', 'Issues', 'Agents', 'Office']);
    if (topLevelSources.has(dataSource)) {
      return path.join(machineRoot, dataSource);
    }
    if (viewId === 'wiki-viewer') return path.join(machineRoot, 'Wiki');
    if (viewId === 'doc-viewer') return path.join(machineRoot, 'Docs');
    if (viewId === 'issues-viewer') return path.join(machineRoot, 'Issues');
    if (viewId === 'agents-viewer') return path.join(machineRoot, 'Agents');
    if (viewId === 'office-viewer') return path.join(machineRoot, 'Office');
    return view.viewRoot;
  }

  if (viewId === 'wiki-viewer') {
    const wikiPath = path.join(view.viewRoot, 'Wiki');
    if (fs.existsSync(wikiPath)) return wikiPath;
    return view.viewRoot;
  }

  // If the view has a content/ subfolder, use it. Otherwise the view root
  // itself is the content area.
  const contentPath = path.join(view.viewRoot, 'content');
  if (fs.existsSync(contentPath)) return contentPath;

  return view.viewRoot;
}

function listV2Views(projectRoot) {
  if (!hasV2Views(projectRoot)) return null;
  return listV2ViewFolders(projectRoot)
    .map((entry) => loadV2ViewShellFromEntry(projectRoot, entry))
    .filter(Boolean)
    .filter(view => view.index?.metadata?.enabled !== false);
}

function loadV2ViewShell(projectRoot, viewId) {
  if (!hasV2Views(projectRoot)) return null;
  const entry = listV2ViewFolders(projectRoot).find((candidate) => candidate.id === viewId);
  if (!entry) return null;
  return loadV2ViewShellFromEntry(projectRoot, entry);
}

function listV2ViewFolders(projectRoot) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  try {
    return fs.readdirSync(viewsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const match = entry.name.match(/^(\d+)-(.+)$/);
        const order = match ? Number(match[1]) : 999;
        const fallbackId = match ? match[2] : entry.name;
        const viewRoot = path.join(viewsRoot, entry.name);
        const manifest = readFrontmatter(path.join(viewRoot, 'manifest.md'));
        const id = manifest.metadata?.['view-id'] || fallbackId;
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
  } catch {
    return [];
  }
}

function loadV2ViewShellFromEntry(projectRoot, entry) {
  const icon = readFrontmatter(path.join(entry.viewRoot, 'styles', 'icon.md'));
  const metadata = entry.manifest.metadata || {};
  const id = metadata['view-id'] || entry.id;
  return {
    id,
    index: {
      id,
      label: entry.manifest.name || displayLabelFromId(id),
      icon: icon.metadata?.['icon-name'] || 'folder',
      rank: entry.order,
      type: metadata['view-type'] || 'placeholder',
      metadata,
    },
    content: {
      display: metadata['view-type'] || 'placeholder',
      chat: null,
      dataSource: metadata['data-source'] || null,
    },
    layout: {},
    viewRoot: entry.viewRoot,
    v2: true,
  };
}

function readFrontmatter(filePath) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function parseSimpleYaml(yamlText) {
  const result = {};
  let currentObject = result;
  for (const rawLine of yamlText.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (indent === 0) {
      if (rawValue === '') {
        result[key] = {};
        currentObject = result[key];
      } else {
        result[key] = parseYamlScalar(rawValue);
        currentObject = result;
      }
      continue;
    }
    if (currentObject && typeof currentObject === 'object') {
      currentObject[key] = parseYamlScalar(rawValue);
    }
  }
  return result;
}

function parseYamlScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value.replace(/^['"]|['"]$/g, '');
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
  getLegacyViewsRoot,
  getWorkspaceRegistryPath,
  hasV2Views,
  loadWorkspaceRegistry,
  getWorkspaceViewOptions: registryWriter.getWorkspaceViewOptions,
  restoreWorkspaceView: registryWriter.restoreWorkspaceView,
  addWorkspaceView: registryWriter.addWorkspaceView,
  updateWorkspaceViewRegistry: registryWriter.updateWorkspaceViewRegistry,
  listRegistryViews,
  listViews,
  loadViewIndex,
  loadContentConfig,
  loadLayoutConfig,
  loadView,
  loadAllViews,
  resolveContentPath,
  resolveChatConfig,
};
