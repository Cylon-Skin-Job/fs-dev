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
const createService = require('../workspace/create-service');

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

function assertWorkspaceRegistry(projectRoot) {
  const registryPath = getWorkspaceRegistryPath(projectRoot);
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch (err) {
    throw new Error('Workspace view registry is missing or invalid');
  }

  if (registry.version !== 1 || !Array.isArray(registry.views)) {
    throw new Error('Workspace view registry is missing or invalid');
  }

  return { registryPath, registry };
}

function updateWorkspaceViewRegistry(projectRoot, request) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  const viewId = typeof request?.viewId === 'string' ? request.viewId.trim() : '';
  if (!viewId) {
    throw new Error('View id is required');
  }

  const patch = request.patch || null;
  const move = request.move || null;
  const allowedPatchFields = new Set(['label', 'icon', 'enabled']);

  if (patch !== null) {
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('View patch must be an object');
    }
    for (const field of Object.keys(patch)) {
      if (!allowedPatchFields.has(field)) {
        throw new Error(`Cannot update view field: ${field}`);
      }
    }
    if ('label' in patch && (typeof patch.label !== 'string' || patch.label.trim() === '')) {
      throw new Error('View label must be a non-empty string');
    }
    if ('icon' in patch && (typeof patch.icon !== 'string' || patch.icon.trim() === '')) {
      throw new Error('View icon must be a non-empty string');
    }
    if ('enabled' in patch && typeof patch.enabled !== 'boolean') {
      throw new Error('View enabled must be a boolean');
    }
  }

  if (move !== null && move !== 'up' && move !== 'down') {
    throw new Error('View move must be up or down');
  }

  const { registryPath, registry } = assertWorkspaceRegistry(projectRoot);
  const views = registry.views.map(view => ({ ...view }));
  const targetIndex = views.findIndex(view => view && view.id === viewId);
  if (targetIndex === -1) {
    throw new Error('View not found');
  }

  if (patch && patch.enabled === false && views[targetIndex].enabled !== false) {
    const enabledCount = views.filter(view => view && view.enabled !== false).length;
    if (enabledCount <= 1) {
      throw new Error('At least one view must remain visible');
    }
  }

  if (patch) {
    if ('label' in patch) views[targetIndex].label = patch.label.trim();
    if ('icon' in patch) views[targetIndex].icon = patch.icon.trim();
    if ('enabled' in patch) views[targetIndex].enabled = patch.enabled;
  }

  if (move) {
    const enabledViews = views
      .map((view, index) => ({ view, index }))
      .filter(({ view }) => view && view.enabled !== false);
    const enabledIndex = enabledViews.findIndex(({ view }) => view.id === viewId);
    const neighborIndex = move === 'up' ? enabledIndex - 1 : enabledIndex + 1;

    if (enabledIndex !== -1 && neighborIndex >= 0 && neighborIndex < enabledViews.length) {
      const swapped = [...enabledViews];
      [swapped[enabledIndex], swapped[neighborIndex]] = [swapped[neighborIndex], swapped[enabledIndex]];
      const enabledIds = new Set(swapped.map(({ view }) => view.id));
      const rankedEnabledViews = swapped.map(({ view }, index) => ({ ...view, rank: index }));
      const disabledViews = views.filter(view => !enabledIds.has(view.id));
      registry.views = [...rankedEnabledViews, ...disabledViews];
    } else {
      registry.views = views;
    }
  } else {
    registry.views = views;
  }

  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
  return registry;
}

function writeWorkspaceRegistry(registryPath, registry) {
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
}

function getInstalledBaseViewIds(registry) {
  return new Set(registry.views
    .filter(Boolean)
    .map(view => view.baseViewId || view.id)
    .filter(Boolean));
}

function isTemplateFolderAvailable(template) {
  if (!template || typeof template.templatePath !== 'string') return false;
  const source = path.resolve(createService.getSystemSourceRoot(), template.templatePath);
  const relative = path.relative(createService.getTemplateRoot(), source);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  try {
    return fs.lstatSync(source).isDirectory();
  } catch {
    return false;
  }
}

function getWorkspaceViewOptions(projectRoot) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  const { registry } = assertWorkspaceRegistry(projectRoot);
  const installedBaseViewIds = getInstalledBaseViewIds(registry);
  const manifest = createService.readManifest();

  return {
    hiddenViews: registry.views
      .filter(view => view && view.enabled === false)
      .map(view => ({
        id: view.id,
        baseViewId: view.baseViewId || view.id,
        label: view.label || view.id,
        icon: view.icon || 'folder',
      })),
    availableTemplates: manifest.views
      .filter(template => template && !installedBaseViewIds.has(template.baseViewId || template.id))
      .filter(isTemplateFolderAvailable),
  };
}

function restoreWorkspaceView(projectRoot, viewId) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  const id = typeof viewId === 'string' ? viewId.trim() : '';
  if (!id) {
    throw new Error('View id is required');
  }

  const { registryPath, registry } = assertWorkspaceRegistry(projectRoot);
  const target = registry.views.find(view => view && view.id === id);
  if (!target) {
    throw new Error('View not found');
  }

  target.enabled = true;
  writeWorkspaceRegistry(registryPath, registry);
  return registry;
}

function addWorkspaceView(projectRoot, templateId) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  const id = typeof templateId === 'string' ? templateId.trim() : '';
  if (!id) {
    throw new Error('Template id is required');
  }

  const { registryPath, registry } = assertWorkspaceRegistry(projectRoot);
  const manifest = createService.readManifest();
  const template = manifest.views.find(view => view && view.id === id);
  if (!template) {
    throw new Error('Unknown view template');
  }

  const installedBaseViewIds = getInstalledBaseViewIds(registry);
  if (installedBaseViewIds.has(template.baseViewId || template.id)) {
    throw new Error('View template is already installed');
  }

  const aiViewsPath = path.resolve(projectRoot, 'ai', 'views');
  const destination = path.resolve(aiViewsPath, template.id);
  const destinationRelative = path.relative(aiViewsPath, destination);
  if (destinationRelative.startsWith('..') || path.isAbsolute(destinationRelative)) {
    throw new Error('Destination path escapes ai/views');
  }
  if (fs.existsSync(destination)) {
    throw new Error('View destination already exists');
  }

  const source = path.resolve(createService.getSystemSourceRoot(), template.templatePath);
  const sourceRelative = path.relative(createService.getTemplateRoot(), source);
  if (sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative)) {
    throw new Error('Template path escapes view-templates');
  }
  if (!fs.existsSync(source) || !fs.lstatSync(source).isDirectory()) {
    throw new Error('Template source is missing');
  }

  try {
    createService.copyTemplateDirectory(source, destination);
  } catch (err) {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    throw err;
  }

  const enabledRanks = registry.views
    .filter(view => view && view.enabled !== false && typeof view.rank === 'number')
    .map(view => view.rank);
  const nextRank = enabledRanks.length > 0 ? Math.max(...enabledRanks) + 1 : 1;
  registry.views.push({
    id: template.id,
    baseViewId: template.id,
    label: template.label,
    icon: template.icon || 'folder',
    rank: nextRank,
    enabled: true,
    source: template.group === 'default' ? 'default' : 'optional',
    viewPath: 'ai/views/' + template.id,
  });

  writeWorkspaceRegistry(registryPath, registry);
  return registry;
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
  getWorkspaceViewOptions,
  restoreWorkspaceView,
  addWorkspaceView,
  updateWorkspaceViewRegistry,
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
