const path = require('path');
const fs = require('fs');
const createService = require('../workspace/create-service');
const aiPaths = require('../workspace/ai-paths');

function getWorkspaceRegistryPath(projectRoot) {
  return path.join(projectRoot, 'ai', 'system', 'workspace', 'views.json');
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

  if (hasV2Views(projectRoot)) {
    return updateV2WorkspaceViews(projectRoot, request);
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

  writeWorkspaceRegistry(registryPath, registry);
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
  const allowedRoots = [createService.getTemplateRoot()];
  if (typeof createService.getAiTemplateViewsRoot === 'function') {
    allowedRoots.push(createService.getAiTemplateViewsRoot());
  }
  const isAllowed = allowedRoots.some((root) => {
    const relative = path.relative(root, source);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
  if (!isAllowed) return false;
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

  if (hasV2Views(projectRoot)) {
    const installedBaseViewIds = new Set(listV2ViewFolders(projectRoot).map((view) => view.id));
    const manifest = createService.readManifest();
    return {
      hiddenViews: [],
      availableTemplates: manifest.views
        .filter(template => template && !installedBaseViewIds.has(template.baseViewId || template.id))
        .filter(isTemplateFolderAvailable),
    };
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

  if (hasV2Views(projectRoot)) {
    return addWorkspaceView(projectRoot, viewId);
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

  if (hasV2Views(projectRoot)) {
    return addV2WorkspaceView(projectRoot, templateId);
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

function hasV2Views(projectRoot) {
  try {
    return fs.lstatSync(aiPaths.getMachineViewsRoot(projectRoot)).isDirectory();
  } catch {
    return false;
  }
}

function updateV2WorkspaceViews(projectRoot, request) {
  const viewId = typeof request?.viewId === 'string' ? request.viewId.trim() : '';
  if (!viewId) {
    throw new Error('View id is required');
  }

  const patch = request.patch || null;
  const move = request.move || null;

  if (patch !== null) {
    if (typeof patch !== 'object' || Array.isArray(patch)) {
      throw new Error('View patch must be an object');
    }
    const allowedPatchFields = new Set(['enabled']);
    for (const field of Object.keys(patch)) {
      if (!allowedPatchFields.has(field)) {
        throw new Error(`Cannot update v2 view field: ${field}`);
      }
    }
    if ('enabled' in patch && typeof patch.enabled !== 'boolean') {
      throw new Error('View enabled must be a boolean');
    }
  }

  if (move !== null && move !== 'up' && move !== 'down') {
    throw new Error('View move must be up or down');
  }

  const entries = listV2ViewFolders(projectRoot);
  const targetIndex = entries.findIndex((entry) => entry.id === viewId);
  if (targetIndex === -1) {
    throw new Error('View not found');
  }

  if (patch && patch.enabled === false) {
    if (entries.length <= 1) {
      throw new Error('At least one view must remain visible');
    }
    fs.rmSync(entries[targetIndex].folderPath, { recursive: true, force: true });
    return compactV2ViewFolders(projectRoot);
  }

  if (patch && patch.enabled === true) {
    return toV2Registry(projectRoot);
  }

  if (move) {
    const neighborIndex = move === 'up' ? targetIndex - 1 : targetIndex + 1;
    if (neighborIndex < 0 || neighborIndex >= entries.length) {
      return toV2Registry(projectRoot);
    }
    const reordered = [...entries];
    [reordered[targetIndex], reordered[neighborIndex]] = [reordered[neighborIndex], reordered[targetIndex]];
    return rewriteV2ViewFolderOrder(projectRoot, reordered);
  }

  return toV2Registry(projectRoot);
}

function addV2WorkspaceView(projectRoot, templateId) {
  const id = typeof templateId === 'string' ? templateId.trim() : '';
  if (!id) {
    throw new Error('Template id is required');
  }

  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  const installedIds = new Set(listV2ViewFolders(projectRoot).map((entry) => entry.id));
  if (installedIds.has(id)) {
    throw new Error('View template is already installed');
  }

  const manifest = createService.readManifest();
  const template = manifest.views.find((view) => view && view.id === id);
  if (!template) {
    throw new Error('Unknown view template');
  }
  if (!isTemplateFolderAvailable(template)) {
    throw new Error('Template source is missing');
  }

  const source = path.resolve(createService.getSystemSourceRoot(), template.templatePath);
  const sourceRelative = path.relative(createService.getAiTemplateViewsRoot(), source);
  if (sourceRelative.startsWith('..') || path.isAbsolute(sourceRelative)) {
    throw new Error('Template path escapes ai-template/Views');
  }

  const nextIndex = listV2ViewFolders(projectRoot).length + 1;
  const destination = path.join(viewsRoot, `${String(nextIndex).padStart(3, '0')}-${id}`);
  const destinationRelative = path.relative(viewsRoot, destination);
  if (destinationRelative.startsWith('..') || path.isAbsolute(destinationRelative)) {
    throw new Error('Destination path escapes machine Views');
  }
  if (fs.existsSync(destination)) {
    throw new Error('View destination already exists');
  }

  try {
    createService.copyTemplateDirectory(source, destination);
  } catch (err) {
    if (fs.existsSync(destination)) {
      fs.rmSync(destination, { recursive: true, force: true });
    }
    throw err;
  }

  return toV2Registry(projectRoot);
}

function compactV2ViewFolders(projectRoot) {
  return rewriteV2ViewFolderOrder(projectRoot, listV2ViewFolders(projectRoot));
}

function rewriteV2ViewFolderOrder(projectRoot, orderedEntries) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  const stamp = `${process.pid}-${Date.now()}`;
  const tempEntries = orderedEntries.map((entry, index) => {
    const tempName = `.reorder-${stamp}-${index}-${entry.id}`;
    const tempPath = path.join(viewsRoot, tempName);
    fs.renameSync(entry.folderPath, tempPath);
    return { ...entry, tempPath };
  });

  tempEntries.forEach((entry, index) => {
    const finalPath = path.join(viewsRoot, `${String(index + 1).padStart(3, '0')}-${entry.id}`);
    fs.renameSync(entry.tempPath, finalPath);
  });

  return toV2Registry(projectRoot);
}

function listV2ViewFolders(projectRoot) {
  const viewsRoot = aiPaths.getMachineViewsRoot(projectRoot);
  try {
    return fs.readdirSync(viewsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => {
        const match = entry.name.match(/^(\d+)-(.+)$/);
        return {
          folderName: entry.name,
          folderPath: path.join(viewsRoot, entry.name),
          order: match ? Number(match[1]) : 999,
          id: match ? match[2] : entry.name,
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

function toV2Registry(projectRoot) {
  const manifest = createService.readManifest();
  const templatesById = new Map(manifest.views.map((view) => [view.id, view]));
  return {
    version: 2,
    sort: 'filesystem-prefix',
    views: listV2ViewFolders(projectRoot).map((entry, index) => {
      const template = templatesById.get(entry.id) || {};
      return {
        id: entry.id,
        baseViewId: entry.id,
        label: template.label || entry.id,
        icon: template.icon || 'folder',
        rank: index + 1,
        enabled: true,
        source: template.group === 'default' ? 'default' : 'optional',
        viewPath: path.join('ai', aiPaths.getLocalMachineName(), 'Views', `${String(index + 1).padStart(3, '0')}-${entry.id}`),
      };
    }),
  };
}

module.exports = {
  assertWorkspaceRegistry,
  updateWorkspaceViewRegistry,
  writeWorkspaceRegistry,
  getInstalledBaseViewIds,
  isTemplateFolderAvailable,
  getWorkspaceViewOptions,
  restoreWorkspaceView,
  addWorkspaceView,
};
