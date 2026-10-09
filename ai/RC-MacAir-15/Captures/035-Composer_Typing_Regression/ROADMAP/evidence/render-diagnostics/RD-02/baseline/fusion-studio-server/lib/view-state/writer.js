/**
 * View-state writer — STATE_OVERRIDE_SPEC §7.
 *
 * For each leaf key in the patch:
 *   - If the per-view override file exists AND already has that key path,
 *     update the override file (override stays pinned).
 *   - If the key is per-view runtime activity, update/create the per-view
 *     override file.
 *   - Otherwise, update the workspace file.
 *
 * Invariant: the writer only creates a per-view override file for explicitly
 * view-owned runtime keys. Users still control ordinary override files.
 * Writes are atomic (tmp + rename).
 */

const path = require('path');

const {
  resolveViewStateUnderLease,
  assertCallerHeldViewReadinessLease,
  workspacePath,
  viewOverridePath,
  atomicWriteJsonBatch,
  readJsonOrNull,
  deepMerge,
  isPlainObject,
  HARDCODED_DEFAULTS,
} = require('./resolver');
const { acquireViewReadinessLease } = require('../views/readiness-runtime');

const FORCE_VIEW_OVERRIDE_TOP_KEYS = new Set([
  'activity',
  'collections',
  'officeViewerMode',
  'officeViewerCurrentFolder',
  'officeViewerSelectedPath',
  'officeDocumentSidePanel',
  'officePaperBrightness',
  'docViewerTabs',
  'docViewerActiveTabId',
  // VIEW-02 Slice 3: the connected Capture tab collection persists as one
  // versioned field inside the same per-view state document.
  'captureTabRecords',
]);

// CHAT-03 / SPEC-03 §4: the group-keyed thread-worksurface map lives in the
// view capsule state document. Each entry is a whole value with two
// independently revised lanes, so the writer must REPLACE the map rather than
// deep-merge it: a stale content leaf could otherwise survive an adapter
// recapture, and a closed placement disposition must not be resurrected.
const REPLACE_VIEW_OVERRIDE_TOP_KEYS = new Set([
  'threadWorksurfaces',
]);

const FORCE_VIEW_OVERRIDE_PATHS = new Set([
  'collapsed.rightCol',
  'collapsed.contentArea',
  'widths.contentNavLeft',
  'widths.contentNavRight',
]);

const writeQueues = new Map();

function writeQueueKey(projectRoot, viewId) {
  return `${path.resolve(projectRoot)}\0${viewId}`;
}

function hasKeyPath(obj, pathArr) {
  let cur = obj;
  for (const seg of pathArr) {
    if (!isPlainObject(cur)) return false;
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return false;
    cur = cur[seg];
  }
  return true;
}

function setKeyPath(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const seg = pathArr[i];
    if (!isPlainObject(cur[seg])) cur[seg] = {};
    cur = cur[seg];
  }
  cur[pathArr[pathArr.length - 1]] = value;
}

/**
 * Walk `patch` depth-first, yielding [pathArr, leafValue] for every leaf.
 * A leaf is anything that is NOT a plain object — scalars, arrays, null.
 */
function* leafEntries(patch, prefix = []) {
  if (!isPlainObject(patch)) return;
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    const nextPath = [...prefix, key];
    if (isPlainObject(value)) {
      yield* leafEntries(value, nextPath);
    } else {
      yield [nextPath, value];
    }
  }
}

async function writeViewStatePatchNow(projectRoot, viewId, patch, callerLease = null) {
  const lease = callerLease || acquireViewReadinessLease({ projectRoot });
  try {
    assertCallerHeldViewReadinessLease(projectRoot, lease);
    const wsFile       = workspacePath(projectRoot);
    const overrideFile = viewOverridePath(projectRoot, viewId);
    const registeredViewRoot = path.dirname(path.dirname(overrideFile));

    // Snapshot current files.
    const workspaceBefore = await readJsonOrNull(wsFile);
    const workspace      = workspaceBefore || JSON.parse(JSON.stringify(HARDCODED_DEFAULTS));
    const overrideBefore = await readJsonOrNull(overrideFile);
    const overrideExists = overrideBefore !== null;

    // Accumulate routed patches.
    const workspaceUpdates = {};
    const overrideUpdates  = {};
    const overrideReplacements = {};
    let overrideTouched = false;

    // Whole-document replacement keys are never flattened into leaves so an
    // exact, caller-computed map replaces the previous value atomically.
    for (const key of REPLACE_VIEW_OVERRIDE_TOP_KEYS) {
      if (isPlainObject(patch) && Object.prototype.hasOwnProperty.call(patch, key)) {
        overrideReplacements[key] = patch[key];
        overrideTouched = true;
      }
    }

    for (const [keyPath, value] of leafEntries(patch)) {
      if (REPLACE_VIEW_OVERRIDE_TOP_KEYS.has(keyPath[0])) continue;
      const pathKey = keyPath.join('.');
      if (FORCE_VIEW_OVERRIDE_TOP_KEYS.has(keyPath[0]) || FORCE_VIEW_OVERRIDE_PATHS.has(pathKey)) {
        setKeyPath(overrideUpdates, keyPath, value);
        overrideTouched = true;
      } else if (overrideExists && hasKeyPath(overrideBefore, keyPath)) {
        setKeyPath(overrideUpdates, keyPath, value);
        overrideTouched = true;
      } else {
        setKeyPath(workspaceUpdates, keyPath, value);
      }
    }

    const writes = [];
    if (workspaceBefore === null || Object.keys(workspaceUpdates).length > 0) {
      writes.push({
        filePath: wsFile,
        obj: deepMerge(workspace, workspaceUpdates),
        projectRoot,
      });
    }

    // Apply override updates. Runtime activity is explicitly per-view state, so
    // it can create the override file even when no user override existed yet.
    if (overrideTouched) {
      const nextOverride = deepMerge(overrideBefore || {}, overrideUpdates);
      for (const key of Object.keys(overrideReplacements)) {
        nextOverride[key] = overrideReplacements[key];
      }
      writes.push({
        filePath: overrideFile,
        obj: nextOverride,
        projectRoot,
        trustedViewRoot: registeredViewRoot,
      });
    }

    await atomicWriteJsonBatch(writes);

    return resolveViewStateUnderLease(projectRoot, viewId, lease);
  } finally {
    if (!callerLease) lease.release();
  }
}

function enqueueViewStatePatch(projectRoot, viewId, performWrite) {
  const key = writeQueueKey(projectRoot, viewId);
  const previous = writeQueues.get(key) || Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(performWrite);

  writeQueues.set(key, operation);
  operation
    .finally(() => {
      if (writeQueues.get(key) === operation) {
        writeQueues.delete(key);
      }
    })
    .catch(() => undefined);

  return operation;
}

function writeViewStatePatch(projectRoot, viewId, patch) {
  return enqueueViewStatePatch(
    projectRoot,
    viewId,
    () => writeViewStatePatchNow(projectRoot, viewId, patch),
  );
}

function writeViewStatePatchUnderLease(projectRoot, viewId, patch, lease) {
  return enqueueViewStatePatch(
    projectRoot,
    viewId,
    () => writeViewStatePatchNow(projectRoot, viewId, patch, lease),
  );
}

/**
 * Run one read-modify-write operation inside the per-view write queue. The
 * operation receives no implicit lock token; it must use `writeViewStatePatchNow`
 * (not `writeViewStatePatch`, which would re-enter this queue and deadlock).
 * CHAT-03 / SPEC-03 §6.2 uses this to make CAS + lane merge atomic per view.
 */
function runViewStateWriteExclusive(projectRoot, viewId, operation) {
  return enqueueViewStatePatch(projectRoot, viewId, operation);
}

module.exports = {
  writeViewStatePatch,
  writeViewStatePatchUnderLease,
  runViewStateWriteExclusive,
  // exported for the thread-worksurface service and tests
  writeViewStatePatchNow,
  hasKeyPath,
  setKeyPath,
  leafEntries,
};
