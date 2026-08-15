const path = require('path');
const fs = require('fs');
const createService = require('../workspace/create-service');
const aiPaths = require('../workspace/ai-paths');
const { classifyEntrySync } = require('../fs/dirents');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getV2WorkspaceStatePath(projectRoot) {
  return path.join(aiPaths.getSystemStateRoot(projectRoot), 'state.json');
}

function getV2ViewStatePath(entry) {
  return path.join(entry.folderPath, 'state', 'state.json');
}

function readV2WorkspaceState(projectRoot) {
  const filePath = getV2WorkspaceStatePath(projectRoot);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return isPlainObject(parsed) ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error('Workspace state is invalid: ' + err.message);
  }
}

function writeJsonFile(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
}

function quoteYamlScalar(value) {
  const raw = String(value || '');
  if (/^[A-Za-z0-9._ -]+$/.test(raw)) return raw;
  return JSON.stringify(raw);
}

function parseYamlScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  return value.replace(/^['"]|['"]$/g, '');
}

function parseSimpleYaml(yamlText) {
  const result = {};
  let currentObject = result;
  for (const rawLine of String(yamlText || '').split(/\r?\n/)) {
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

function readFrontmatter(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
    return match ? parseSimpleYaml(match[1]) : {};
  } catch {
    return {};
  }
}

function replaceTopLevelFrontmatterField(filePath, key, value, fallbackBody) {
  const nextLine = `${key}: ${quoteYamlScalar(value)}`;
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    text = fallbackBody;
  }

  const match = text.match(/^---\s*\n([\s\S]*?)\n---([\s\S]*)$/);
  if (!match) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\n${nextLine}\n---\n`, 'utf-8');
    return;
  }

  const lines = match[1].split(/\r?\n/);
  const fieldIndex = lines.findIndex((line) => line.match(new RegExp(`^${key}:\\s*`)));
  if (fieldIndex >= 0) {
    lines[fieldIndex] = nextLine;
  } else {
    lines.unshift(nextLine);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${lines.join('\n')}\n---${match[2]}`, 'utf-8');
}

function replaceIconFrontmatter(filePath, iconName, fallbackLabel) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    text = `---\nname: ${quoteYamlScalar(fallbackLabel || 'View Icon')}\ndescription: This file determines what icon is rendered in the left side nav.\nmetadata:\n  icon-name: folder\n---\n`;
  }

  const match = text.match(/^---\s*\n([\s\S]*?)\n---([\s\S]*)$/);
  if (!match) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nname: ${quoteYamlScalar(fallbackLabel || 'View Icon')}\nmetadata:\n  icon-name: ${quoteYamlScalar(iconName)}\n---\n`, 'utf-8');
    return;
  }

  const lines = match[1].split(/\r?\n/);
  const iconIndex = lines.findIndex((line) => line.match(/^\s+icon-name:\s*/));
  if (iconIndex >= 0) {
    const indent = lines[iconIndex].match(/^\s*/)[0] || '  ';
    lines[iconIndex] = `${indent}icon-name: ${quoteYamlScalar(iconName)}`;
  } else {
    const metadataIndex = lines.findIndex((line) => line.match(/^metadata:\s*$/));
    if (metadataIndex >= 0) {
      lines.splice(metadataIndex + 1, 0, `  icon-name: ${quoteYamlScalar(iconName)}`);
    } else {
      lines.push('metadata:', `  icon-name: ${quoteYamlScalar(iconName)}`);
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${lines.join('\n')}\n---${match[2]}`, 'utf-8');
}

function getV2ManifestPath(entry) {
  return path.join(entry.folderPath, 'manifest.md');
}

function getV2IconPath(entry) {
  return path.join(entry.folderPath, 'styles', 'icon.md');
}

function getV2ViewLabel(entry, fallback) {
  const manifest = entry.manifest || readFrontmatter(getV2ManifestPath(entry));
  return manifest.name || fallback || entry.id;
}

function getV2ViewIcon(entry, fallback = 'folder') {
  const icon = readFrontmatter(getV2IconPath(entry));
  const iconName = icon.metadata && icon.metadata['icon-name'];
  return typeof iconName === 'string' && iconName.trim() ? iconName.trim() : fallback;
}

function setV2ViewLabel(entry, label) {
  replaceTopLevelFrontmatterField(
    getV2ManifestPath(entry),
    'name',
    label,
    `---\nname: ${quoteYamlScalar(entry.id)}\nmetadata:\n  view-id: ${quoteYamlScalar(entry.id)}\n---\n`
  );
}

function setV2ViewIcon(entry, iconName) {
  setV2IconFile(entry, iconName, `${getV2ViewLabel(entry, entry.id)} Icon`);
}

function setV2IconFile(entry, iconName, fallbackLabel) {
  replaceIconFrontmatter(getV2IconPath(entry), iconName, fallbackLabel);
}

function writeV2WorkspaceState(projectRoot, state) {
  const filePath = getV2WorkspaceStatePath(projectRoot);
  writeJsonFile(filePath, state);
}

function readV2ViewState(entry) {
  try {
    const parsed = JSON.parse(fs.readFileSync(getV2ViewStatePath(entry), 'utf-8'));
    return isPlainObject(parsed) ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`View state is invalid for ${entry.id}: ${err.message}`);
  }
}

function writeV2ViewState(entry, state) {
  writeJsonFile(getV2ViewStatePath(entry), state);
}

function isV2ViewHidden(entry) {
  const state = readV2ViewState(entry);
  if (isPlainObject(state.display) && state.display.hidden === true) return true;
  if (state.hidden === true) return true;
  return false;
}

function setV2ViewHidden(entry, hidden) {
  const state = readV2ViewState(entry);
  const display = isPlainObject(state.display) ? state.display : {};
  display.hidden = Boolean(hidden);
  state.display = display;
  delete state.hidden;
  writeV2ViewState(entry, state);
}

function getWorkspaceHiddenViewIds(projectRoot) {
  const state = readV2WorkspaceState(projectRoot);
  const hidden = state.views && state.views.hidden;
  if (Array.isArray(hidden)) {
    return new Set(hidden.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()));
  }
  if (isPlainObject(hidden)) {
    return new Set(Object.entries(hidden)
      .filter(([, value]) => value !== false)
      .map(([id]) => id));
  }
  return new Set();
}

function clearWorkspaceHiddenViewState(projectRoot) {
  const state = readV2WorkspaceState(projectRoot);
  if (!isPlainObject(state.views) || state.views.hidden === undefined) return;
  delete state.views.hidden;
  if (Object.keys(state.views).length === 0) {
    delete state.views;
  }
  writeV2WorkspaceState(projectRoot, state);
}

function getV2HiddenViewIds(projectRoot) {
  const hiddenIds = getWorkspaceHiddenViewIds(projectRoot);
  for (const entry of listV2ViewFolders(projectRoot)) {
    if (isV2ViewHidden(entry)) {
      hiddenIds.add(entry.id);
    }
  }
  return hiddenIds;
}

function writeV2HiddenViewIds(projectRoot, hiddenIds) {
  const hidden = new Set(hiddenIds);
  for (const entry of listV2ViewFolders(projectRoot)) {
    setV2ViewHidden(entry, hidden.has(entry.id));
  }
  clearWorkspaceHiddenViewState(projectRoot);
}

function updateWorkspaceViewRegistry(projectRoot, request) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  return updateV2WorkspaceViews(projectRoot, request);
}

function isTemplateFolderAvailable(template) {
  if (!template || typeof template.templatePath !== 'string') return false;
  const source = path.resolve(createService.getSystemSourceRoot(), template.templatePath);
  const allowedRoots = [createService.getAiTemplateViewsRoot()];
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

  const entries = listV2ViewFolders(projectRoot);
  const hiddenIds = getV2HiddenViewIds(projectRoot);
  const installedBaseViewIds = new Set(entries.map((view) => view.id));
  const manifest = createService.readManifest();
  const templatesById = new Map(manifest.views.map((view) => [view.id, view]));

  return {
    hiddenViews: entries
      .filter((entry) => hiddenIds.has(entry.id))
      .map((entry) => {
        const template = templatesById.get(entry.id) || {};
        return {
          id: entry.id,
          baseViewId: entry.id,
          label: getV2ViewLabel(entry, template.label || entry.id),
          icon: getV2ViewIcon(entry, template.icon || 'folder'),
        };
      }),
    availableTemplates: manifest.views
      .filter(template => template && !installedBaseViewIds.has(template.baseViewId || template.id))
      .filter(isTemplateFolderAvailable),
  };
}

function restoreWorkspaceView(projectRoot, viewId) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  return restoreV2WorkspaceView(projectRoot, viewId);
}

function addWorkspaceView(projectRoot, templateId) {
  if (!projectRoot) {
    throw new Error('No active workspace');
  }

  return addV2WorkspaceView(projectRoot, templateId);
}

function hasV2Views(projectRoot) {
  try {
    return fs.statSync(aiPaths.getMachineViewsRoot(projectRoot)).isDirectory();
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
    const allowedPatchFields = new Set(['label', 'icon', 'enabled']);
    for (const field of Object.keys(patch)) {
      if (!allowedPatchFields.has(field)) {
        throw new Error(`Cannot update v2 view field: ${field}`);
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

  const entries = listV2ViewFolders(projectRoot);
  const targetIndex = entries.findIndex((entry) => entry.id === viewId);
  if (targetIndex === -1) {
    throw new Error('View not found');
  }
  const hiddenIds = getV2HiddenViewIds(projectRoot);
  const visibleEntries = entries.filter((entry) => !hiddenIds.has(entry.id));

  if (patch && 'label' in patch) {
    setV2ViewLabel(entries[targetIndex], patch.label.trim());
  }
  if (patch && 'icon' in patch) {
    setV2ViewIcon(entries[targetIndex], patch.icon.trim());
  }

  if (patch && patch.enabled === false) {
    if (!hiddenIds.has(viewId) && visibleEntries.length <= 1) {
      throw new Error('At least one view must remain visible');
    }
    hiddenIds.add(viewId);
    writeV2HiddenViewIds(projectRoot, hiddenIds);
    return toV2Registry(projectRoot);
  }

  if (patch && patch.enabled === true) {
    hiddenIds.delete(viewId);
    writeV2HiddenViewIds(projectRoot, hiddenIds);
    return toV2Registry(projectRoot);
  }

  if (move) {
    const activeIndex = visibleEntries.findIndex((entry) => entry.id === viewId);
    const neighborIndex = move === 'up' ? activeIndex - 1 : activeIndex + 1;
    if (activeIndex < 0 || neighborIndex < 0 || neighborIndex >= visibleEntries.length) {
      return toV2Registry(projectRoot);
    }
    const reorderedVisible = [...visibleEntries];
    [reorderedVisible[activeIndex], reorderedVisible[neighborIndex]] = [reorderedVisible[neighborIndex], reorderedVisible[activeIndex]];
    const reordered = mergeHiddenViewPositions(entries, reorderedVisible, hiddenIds);
    return rewriteV2ViewFolderOrder(projectRoot, reordered);
  }

  return toV2Registry(projectRoot);
}

function restoreV2WorkspaceView(projectRoot, viewId) {
  const id = typeof viewId === 'string' ? viewId.trim() : '';
  if (!id) {
    throw new Error('View id is required');
  }
  const entries = listV2ViewFolders(projectRoot);
  if (!entries.some((entry) => entry.id === id)) {
    throw new Error('View not found');
  }
  const hiddenIds = getV2HiddenViewIds(projectRoot);
  hiddenIds.delete(id);
  writeV2HiddenViewIds(projectRoot, hiddenIds);
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
    const hiddenIds = getV2HiddenViewIds(projectRoot);
    if (hiddenIds.has(id)) {
      hiddenIds.delete(id);
      writeV2HiddenViewIds(projectRoot, hiddenIds);
      return toV2Registry(projectRoot);
    }
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

function mergeHiddenViewPositions(originalEntries, reorderedVisible, hiddenIds) {
  const visibleQueue = [...reorderedVisible];
  return originalEntries.map((entry) => {
    if (hiddenIds.has(entry.id)) return entry;
    return visibleQueue.shift() || entry;
  });
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
      .filter((entry) => classifyEntrySync(viewsRoot, entry).isDir && !entry.name.startsWith('.'))
      .map((entry) => {
        const match = entry.name.match(/^(\d+)-(.+)$/);
        const folderPath = path.join(viewsRoot, entry.name);
        const manifest = readFrontmatter(path.join(folderPath, 'manifest.md'));
        const manifestId = manifest.metadata && manifest.metadata['view-id'];
        return {
          folderName: entry.name,
          folderPath,
          order: match ? Number(match[1]) : 999,
          id: typeof manifestId === 'string' && manifestId.trim()
            ? manifestId.trim()
            : (match ? match[2] : entry.name),
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

function toV2Registry(projectRoot) {
  const manifest = createService.readManifest();
  const templatesById = new Map(manifest.views.map((view) => [view.id, view]));
  const hiddenIds = getV2HiddenViewIds(projectRoot);
  return {
    version: 2,
    sort: 'filesystem-prefix',
    views: listV2ViewFolders(projectRoot).map((entry, index) => {
      const template = templatesById.get(entry.id) || {};
      return {
        id: entry.id,
        baseViewId: entry.id,
        label: getV2ViewLabel(entry, template.label || entry.id),
        icon: getV2ViewIcon(entry, template.icon || 'folder'),
        rank: index + 1,
        enabled: !hiddenIds.has(entry.id),
        source: template.group === 'default' ? 'default' : 'optional',
        viewPath: path.join('ai', aiPaths.getLocalMachineName(), 'Views', `${String(index + 1).padStart(3, '0')}-${entry.id}`),
      };
    }),
  };
}

module.exports = {
  updateWorkspaceViewRegistry,
  isTemplateFolderAvailable,
  getV2HiddenViewIds,
  getWorkspaceViewOptions,
  restoreWorkspaceView,
  addWorkspaceView,
};
