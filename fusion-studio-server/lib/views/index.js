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

/**
 * Get the views root directory for a project.
 * @param {string} projectRoot
 * @returns {string}
 */
function getViewsRoot(projectRoot) {
  return path.join(projectRoot, 'ai', 'views');
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
  const registryViews = listRegistryViews(projectRoot);
  if (registryViews) return registryViews.map(view => view.id);

  const viewsRoot = getViewsRoot(projectRoot);
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
  getWorkspaceRegistryPath,
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
