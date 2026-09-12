/**
 * View-state resolver — STATE_OVERRIDE_SPEC §6.
 *
 * Effective state = workspace default ← deep-merged per-view override.
 * Workspace file is seeded with hardcoded defaults on first run.
 * Invalid JSON in the override file logs a warning and falls back to
 * workspace-only; never crashes.
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const aiPaths = require('../workspace/ai-paths');
const views = require('../views');
const {
  assertGenericViewMutationAllowed,
  resolveRealMutationTarget,
} = require('../views/protected-path-policy');
const {
  acquireViewReadinessLease,
  assertActiveViewReadinessLease,
} = require('../views/readiness-runtime');

const HARDCODED_DEFAULTS = Object.freeze({
  widths: {
    leftSidebar:    220,
    leftChat:       320,
    rightSecondary: 400,
    rightCol:       220,
    contentNavLeft: 200,
    contentNavRight: 220,
  },
  collapsed: {
    leftSidebar: false,
    leftChat:    false,
    rightCol:    false,
    contentArea: false,
  },
  popup: {
    open:     false,
    x:        -1,
    y:        -1,
    width:    420,
    height:   520,
    threadId: null,
  },
  currentThreadId:   null,
  secondaryThreadId: null,
  // TINTS_SPEC §3: per-surface tint toggles. All default false (neutral).
  tints: {
    leftPanel:     false,
    rightPanel:    false,
    cards:         false,
    contentPanels: false,
    borders: {
      threads: false,
      chat:    false,
    },
  },
  docViewerMode: 'active',
  docViewerActiveSelectedPath: null,
  docViewerArchiveSelectedPath: null,
  docViewerLastOpenedPath: null,
  docViewerActiveGridScroll: 0,
  docViewerArchiveGridScroll: 0,
  docViewerActiveDocScroll: 0,
  docViewerArchiveDocScroll: 0,
  officeViewerMode: 'home',
  officeViewerCurrentFolder: null,
  officeViewerSelectedPath: null,
  officeDocumentSidePanel: 'none',
  officePaperBrightness: 100,
  activity: {
    recents: [],
    navigation: {
      stack: [],
      index: -1,
    },
    tabs: [],
    activeTabId: null,
  },
  collections: {
    starred: [],
    pinnedFolders: [],
  },
});

function workspacePath(projectRoot) {
  return path.join(aiPaths.getSystemStateRoot(projectRoot), 'state.json');
}

function viewOverridePath(projectRoot, viewId) {
  const viewRoot = views.resolveViewRoot(projectRoot, viewId, {
    includeHidden: true,
    strictFilesystemErrors: true,
    strictReadiness: true,
  });
  if (!viewRoot) throw new Error('View is not registered');
  return path.join(viewRoot, 'state', 'state.json');
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

async function assertTrustedViewStatePathsAllowed(viewRoot, paths) {
  const declaredRoot = path.resolve(viewRoot);
  const realRoot = await fs.realpath(declaredRoot);
  for (const candidate of paths) {
    const logical = path.resolve(candidate);
    if (!isInside(declaredRoot, logical)) throw new Error('View state path escapes its registered capsule');
    const resolved = await resolveRealMutationTarget(logical, fs);
    if (!isInside(realRoot, resolved)) throw new Error('View state path escapes its registered capsule');
    try {
      const stat = await fs.lstat(logical);
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1)) {
        throw new Error('View state path has an unsafe identity');
      }
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
  }
}

async function collectPinnedStateAncestry(projectRoot, filePath) {
  const boundary = path.resolve(projectRoot);
  const parent = path.dirname(path.resolve(filePath));
  if (!isInside(boundary, parent)) throw new Error('State destination escapes its workspace');
  const relative = path.relative(boundary, parent);
  const segments = relative ? relative.split(path.sep) : [];
  const pins = [];
  let cursor = boundary;
  const boundaryStat = await fs.stat(boundary);
  if (!boundaryStat.isDirectory()) throw new Error('Workspace root is not a directory');
  pins.push({ path: boundary, follow: true, dev: boundaryStat.dev, ino: boundaryStat.ino });

  for (const segment of segments) {
    cursor = path.join(cursor, segment);
    let stat;
    try {
      stat = await fs.lstat(cursor);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') break;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('State destination has unsafe ancestry');
    }
    pins.push({ path: cursor, follow: false, dev: stat.dev, ino: stat.ino });
  }
  return pins;
}

async function assertPinnedStateAncestryUnchanged(pins) {
  for (const pin of pins) {
    const stat = pin.follow ? await fs.stat(pin.path) : await fs.lstat(pin.path);
    if (
      (!pin.follow && stat.isSymbolicLink())
      || !stat.isDirectory()
      || stat.dev !== pin.dev
      || stat.ino !== pin.ino
    ) throw new Error('State destination ancestry changed');
  }
}

function clampNum(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return patch;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (isPlainObject(pv) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], pv);
    } else {
      out[key] = pv;
    }
  }
  return out;
}

async function atomicWriteJson(filePath, obj, options = {}) {
  await atomicWriteJsonBatch([{ ...options, filePath, obj }]);
}

async function atomicWriteJsonBatch(writes) {
  const plans = writes.map((write) => ({
    ...write,
    filePath: path.resolve(write.filePath),
    tmpPath: `${path.resolve(write.filePath)}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
  }));

  const ancestryPins = new Map();

  // Every final, parent, exact temporary destination, and declared directory
  // ancestry is admitted before any member performs filesystem work.
  for (const plan of plans) {
    if (typeof plan.projectRoot !== 'string') {
      throw new Error('State write requires a workspace root');
    }
    const mutationPaths = [path.dirname(plan.filePath), plan.filePath, plan.tmpPath];
    if (plan.trustedViewRoot) {
      await assertTrustedViewStatePathsAllowed(plan.trustedViewRoot, mutationPaths);
    } else if (plan.projectRoot) {
      await assertGenericViewMutationAllowed({
        projectRoot: plan.projectRoot,
        paths: mutationPaths,
      });
    }
    for (const pin of await collectPinnedStateAncestry(plan.projectRoot, plan.filePath)) {
      ancestryPins.set(pin.path, pin);
    }
    let finalStat = null;
    try {
      finalStat = await fs.lstat(plan.filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
    if (finalStat && (!finalStat.isFile() || finalStat.nlink !== 1)) {
      throw new Error('State destination has an unsafe identity');
    }
    try {
      await fs.lstat(plan.tmpPath);
      throw new Error('State temporary destination already exists');
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
  }

  await assertPinnedStateAncestryUnchanged([...ancestryPins.values()]);

  for (const plan of plans) {
    let handle = null;
    let ownsTemp = false;
    try {
      await fs.mkdir(path.dirname(plan.filePath), { recursive: true });
      handle = await fs.open(
        plan.tmpPath,
        fsSync.constants.O_WRONLY
          | fsSync.constants.O_CREAT
          | fsSync.constants.O_EXCL
          | fsSync.constants.O_NOFOLLOW,
        0o600,
      );
      ownsTemp = true;
      await handle.writeFile(JSON.stringify(plan.obj, null, 2));
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(plan.tmpPath, plan.filePath);
      ownsTemp = false;
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      if (ownsTemp) await fs.unlink(plan.tmpPath).catch(() => undefined);
      throw error;
    }
  }
}

async function readJsonOrNull(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function readOverrideOrEmpty(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    console.warn(`[view-state] invalid override file ${filePath}: ${err.message} — using workspace only`);
    return {};
  }
}

async function loadOrSeedWorkspace(projectRoot) {
  const file = workspacePath(projectRoot);
  const existing = await readJsonOrNull(file);
  if (existing) return existing;
  // Reads are side-effect free. The trusted state writer seeds this file as
  // part of its preflighted compound write when a mutation is requested.
  return JSON.parse(JSON.stringify(HARDCODED_DEFAULTS));
}

function normalize(state) {
  const out = deepMerge(HARDCODED_DEFAULTS, state);
  out.widths.leftSidebar    = clampNum(out.widths.leftSidebar,    120, 600);
  out.widths.leftChat       = clampNum(out.widths.leftChat,       120, 600);
  out.widths.rightSecondary = clampNum(out.widths.rightSecondary, 120, 600);
  out.widths.rightCol       = clampNum(out.widths.rightCol,       120, 600);
  out.widths.contentNavLeft = clampNum(out.widths.contentNavLeft, 160, 600);
  out.widths.contentNavRight = clampNum(out.widths.contentNavRight, 160, 600);
  out.popup.width  = clampNum(out.popup.width,  280, 1200);
  out.popup.height = clampNum(out.popup.height, 240, 1200);
  const paperBrightness = typeof out.officePaperBrightness === 'number'
    ? out.officePaperBrightness
    : Number(out.officePaperBrightness);
  out.officePaperBrightness = Number.isFinite(paperBrightness)
    ? clampNum(paperBrightness, 0, 100)
    : HARDCODED_DEFAULTS.officePaperBrightness;
  return out;
}

/**
 * Resolve effective view state without creating files from this read path.
 */
function assertCallerHeldViewReadinessLease(projectRoot, lease) {
  assertActiveViewReadinessLease({ projectRoot }, lease);
}

async function resolveViewStateUnderLease(projectRoot, viewId, lease) {
  assertCallerHeldViewReadinessLease(projectRoot, lease);
  const overrideFile = viewOverridePath(projectRoot, viewId);
  const workspace = await loadOrSeedWorkspace(projectRoot);
  const override  = await readOverrideOrEmpty(overrideFile);
  return normalize(deepMerge(workspace, override));
}

async function resolveViewState(projectRoot, viewId) {
  const lease = acquireViewReadinessLease({ projectRoot });
  try {
    return await resolveViewStateUnderLease(projectRoot, viewId, lease);
  } finally {
    lease.release();
  }
}

module.exports = {
  resolveViewState,
  resolveViewStateUnderLease,
  assertCallerHeldViewReadinessLease,
  HARDCODED_DEFAULTS,
  workspacePath,
  viewOverridePath,
  atomicWriteJson,
  atomicWriteJsonBatch,
  readJsonOrNull,
  readOverrideOrEmpty,
  deepMerge,
  isPlainObject,
};
