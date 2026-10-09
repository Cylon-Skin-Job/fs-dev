'use strict';

const path = require('path');
const registryServiceDefault = require('../workspace/registry-service');
const aiPathsDefault = require('../workspace/ai-paths');
const {
  VISIBLE_COLOR_LIMIT,
  globalDocument,
  localDocument,
  normalizeCustomColors,
  parseGlobalConfig,
  parseLocalConfig,
  parseLocalSelector,
  visibleColors,
} = require('./palette-codec');
const { PaletteError } = require('./palette-errors');
const { createPaletteFileStore } = require('./palette-file-store');
const { createPalettePathHelper } = require('./palette-paths');

const MISSING_LOCAL = Object.freeze({ customColors: Object.freeze([]), syncEnabled: true, missing: true });
const MISSING_GLOBAL = Object.freeze({ customColors: Object.freeze([]), missing: true });

function createPaletteService(options = {}) {
  const registryService = options.registryService || registryServiceDefault;
  const aiPaths = options.aiPaths || aiPathsDefault;
  const pathHelper = options.pathHelper || createPalettePathHelper();
  const store = options.store || createPaletteFileStore();

  async function locations(workspaceId) {
    let workspace;
    try {
      workspace = await registryService.getById(workspaceId);
    } catch {
      throw new PaletteError('READ_FAILED');
    }
    if (!workspace) throw new PaletteError('UNKNOWN_WORKSPACE');
    if (workspace.id !== workspaceId || typeof workspace.repoPath !== 'string' || !path.isAbsolute(workspace.repoPath)) {
      throw new PaletteError('PATH_REJECTED');
    }
    const workspaceRoot = path.resolve(workspace.repoPath);
    let configRoot;
    try {
      configRoot = path.resolve(aiPaths.getSystemConfigRoot(workspaceRoot));
    } catch {
      throw new PaletteError('PATH_REJECTED');
    }
    const relative = path.relative(workspaceRoot, configRoot);
    if (!relative || path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
      throw new PaletteError('PATH_REJECTED');
    }
    return {
      local: pathHelper.getLocalLocation(workspaceRoot, configRoot),
      global: pathHelper.getGlobalLocation(),
    };
  }

  async function readLocalSelector(location) {
    const raw = await store.read(location, { enforceSizeLimit: false });
    if (!raw) return MISSING_LOCAL;
    const selector = parseLocalSelector(raw);
    return { ...selector, missing: false, raw };
  }

  async function readLocalConfig(location, selector) {
    if (selector.missing) return MISSING_LOCAL;
    return { ...parseLocalConfig(selector.raw), missing: false };
  }

  async function readGlobalConfig(location) {
    const raw = await store.read(location);
    return raw ? { ...parseGlobalConfig(raw), missing: false } : MISSING_GLOBAL;
  }

  function project(customColors, syncEnabled) {
    return {
      storedColors: [...customColors],
      visibleColors: visibleColors(customColors),
      syncEnabled,
      availability: 'ready',
    };
  }

  async function withSelectedError(syncEnabled, operation) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof PaletteError && typeof error.syncEnabled !== 'boolean') {
        error.syncEnabled = syncEnabled;
      }
      throw error;
    }
  }

  async function selectedState(resolved, selector) {
    return withSelectedError(selector.syncEnabled, async () => {
      if (selector.syncEnabled) {
        const global = await readGlobalConfig(resolved.global);
        return project(global.customColors, true);
      }
      const local = await readLocalConfig(resolved.local, selector);
      return project(local.customColors, false);
    });
  }

  async function get(workspaceId) {
    const resolved = await locations(workspaceId);
    const selector = await readLocalSelector(resolved.local);
    return selectedState(resolved, selector);
  }

  function updatedColors(customColors, operation, color) {
    const normalized = normalizeCustomColors([color]);
    const canonical = normalized[0];
    const present = customColors.includes(canonical);
    if (operation === 'add') {
      if (present) return { customColors, idempotent: true };
      if (customColors.length >= VISIBLE_COLOR_LIMIT) throw new PaletteError('PALETTE_LIMIT');
      return { customColors: [...customColors, canonical], idempotent: false };
    }
    if (!present) return { customColors, idempotent: true };
    return { customColors: customColors.filter((candidate) => candidate !== canonical), idempotent: false };
  }

  async function mutateColor(workspaceId, operation, color) {
    const resolved = await locations(workspaceId);
    const selector = await readLocalSelector(resolved.local);
    let selected;
    let location;
    await withSelectedError(selector.syncEnabled, async () => {
      if (selector.syncEnabled) {
        selected = await readGlobalConfig(resolved.global);
        location = resolved.global;
      } else {
        selected = await readLocalConfig(resolved.local, selector);
        location = resolved.local;
      }
    });

    let update;
    try {
      update = updatedColors(selected.customColors, operation, color);
    } catch (error) {
      if (error instanceof PaletteError) error.syncEnabled = selector.syncEnabled;
      throw error;
    }
    if (!update.idempotent) {
      const document = selector.syncEnabled
        ? globalDocument(update.customColors)
        : localDocument({ customColors: update.customColors, syncEnabled: false });
      await withSelectedError(selector.syncEnabled, () => store.write(location, document));
    }
    return { ...project(update.customColors, selector.syncEnabled), idempotent: update.idempotent };
  }

  async function setSync(workspaceId, enabled) {
    const resolved = await locations(workspaceId);
    const selector = await readLocalSelector(resolved.local);
    if (selector.syncEnabled === enabled) return selectedState(resolved, selector);
    const local = await readLocalConfig(resolved.local, selector);
    const nextState = enabled
      ? await withSelectedError(true, async () => {
          const global = await readGlobalConfig(resolved.global);
          return project(global.customColors, true);
        })
      : project(local.customColors, false);
    const preservedLocalColors = selector.missing ? [] : selector.value.custom_colors;
    await withSelectedError(selector.syncEnabled, () => (
      store.write(resolved.local, {
        custom_colors: [...preservedLocalColors],
        sync_enabled: enabled,
      })
    ));
    return nextState;
  }

  return Object.freeze({
    get,
    add: (workspaceId, color) => mutateColor(workspaceId, 'add', color),
    remove: (workspaceId, color) => mutateColor(workspaceId, 'remove', color),
    setSync,
  });
}

module.exports = { createPaletteService };
