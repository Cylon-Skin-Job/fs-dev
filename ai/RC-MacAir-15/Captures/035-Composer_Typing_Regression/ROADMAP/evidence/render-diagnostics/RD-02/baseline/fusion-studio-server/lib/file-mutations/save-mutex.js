'use strict';

class SaveBusyError extends Error {
  constructor() {
    super('Too many saves are queued for this file.');
    this.name = 'SaveBusyError';
    this.code = 'save_busy';
  }
}

function createSaveMutex({ maxWaiters = 32 } = {}) {
  if (!Number.isInteger(maxWaiters) || maxWaiters < 0) throw new TypeError('maxWaiters must be nonnegative');
  const entries = new Map();

  async function runExclusive(key, task) {
    if (typeof key !== 'string' || !key) throw new TypeError('mutex key is required');
    if (typeof task !== 'function') throw new TypeError('mutex task is required');
    let entry = entries.get(key);
    if (!entry) {
      entry = { active: null, queue: [], saveHandoff: null };
      entries.set(key, entry);
    }
    const saveCount = entry.queue.length + (entry.active === 'save' ? 1 : 0) + (entry.saveHandoff ? 1 : 0);
    if (saveCount >= maxWaiters + 1) throw new SaveBusyError();

    await new Promise((resolve) => {
      if (!entry.active) {
        entry.active = 'save';
        resolve();
      } else if (entry.active === 'observation' && !entry.saveHandoff) {
        entry.saveHandoff = resolve;
      } else {
        entry.queue.push(resolve);
      }
    });

    try {
      return await task();
    } finally {
      const next = entry.queue.shift();
      if (next) {
        entry.active = 'save';
        next();
      }
      else {
        entry.active = null;
        entries.delete(key);
      }
    }
  }

  function tryAcquireObservation(key) {
    if (typeof key !== 'string' || !key) throw new TypeError('mutex key is required');
    let entry = entries.get(key);
    if (entry?.active || entry?.queue.length || entry?.saveHandoff) return null;
    if (!entry) {
      entry = { active: null, queue: [], saveHandoff: null };
      entries.set(key, entry);
    }
    entry.active = 'observation';
    let released = false;
    return Object.freeze({
      release() {
        if (released) return false;
        released = true;
        const current = entries.get(key);
        if (current !== entry || current.active !== 'observation') return false;
        if (current.saveHandoff) {
          const handoff = current.saveHandoff;
          current.saveHandoff = null;
          current.active = 'save';
          handoff();
        } else {
          current.active = null;
          entries.delete(key);
        }
        return true;
      },
    });
  }

  return Object.freeze({ runExclusive, tryAcquireObservation });
}

function parseCoordinatorKey(key) {
  const parts = key.split('\u0000');
  if (parts.length === 2 && parts.every(Boolean)) {
    return { workspaceId: parts[0], path: parts[1], parentScope: false };
  }
  if (parts.length === 3 && parts[0] && parts[1]
    && parts[2] === 'case-insensitive-parent') {
    return { workspaceId: parts[0], path: parts[1], parentScope: true };
  }
  return null;
}

function coordinatorKeysConflict(leftKey, rightKey) {
  if (leftKey === rightKey) return true;
  const left = parseCoordinatorKey(leftKey);
  const right = parseCoordinatorKey(rightKey);
  if (!left || !right || left.workspaceId !== right.workspaceId) return false;
  if (left.parentScope === right.parentScope) return false;
  const parent = left.parentScope ? left : right;
  const exact = left.parentScope ? right : left;
  const slash = exact.path.lastIndexOf('/');
  const exactParent = slash < 0 ? '.' : exact.path.slice(0, slash);
  // The parent-scoped key is emitted only after path authority has detected a
  // case-insensitive volume. Case aliases must therefore share the same
  // conservative coordination domain without changing either persisted path.
  return parent.path.toLowerCase() === exactParent.toLowerCase();
}

function createPathCoordinator({ maxWaiters = 32 } = {}) {
  if (!Number.isInteger(maxWaiters) || maxWaiters < 0) {
    throw new TypeError('maxWaiters must be nonnegative');
  }
  const activeSaves = new Set();
  const queuedSaves = [];
  const activeObservations = new Map();

  function hasConflict(key, values, getKey = (value) => value.key) {
    return [...values].some((value) => coordinatorKeysConflict(key, getKey(value)));
  }

  function dispatch() {
    for (let index = 0; index < queuedSaves.length;) {
      const request = queuedSaves[index];
      const earlierConflict = queuedSaves.slice(0, index)
        .some((earlier) => coordinatorKeysConflict(request.key, earlier.key));
      if (earlierConflict
        || hasConflict(request.key, activeSaves)
        || hasConflict(request.key, activeObservations.keys(), (value) => value)) {
        index += 1;
        continue;
      }
      queuedSaves.splice(index, 1);
      activeSaves.add(request);
      request.resolve();
    }
  }

  async function runExclusive(key, task) {
    if (typeof key !== 'string' || !key) throw new TypeError('mutex key is required');
    if (typeof task !== 'function') throw new TypeError('mutex task is required');
    const saveCount = [...activeSaves, ...queuedSaves]
      .filter((request) => coordinatorKeysConflict(key, request.key)).length;
    if (saveCount >= maxWaiters + 1) throw new SaveBusyError();
    let resolveStart;
    const ready = new Promise((resolve) => { resolveStart = resolve; });
    const request = { key, resolve: resolveStart };
    queuedSaves.push(request);
    dispatch();
    await ready;
    try {
      return await task();
    } finally {
      activeSaves.delete(request);
      dispatch();
    }
  }

  function tryAcquireObservation(key) {
    if (typeof key !== 'string' || !key) throw new TypeError('mutex key is required');
    if (hasConflict(key, activeSaves)
      || hasConflict(key, queuedSaves)
      || activeObservations.has(key)) return null;
    activeObservations.set(key, (activeObservations.get(key) ?? 0) + 1);
    let released = false;
    return Object.freeze({
      release() {
        if (released) return false;
        released = true;
        const count = activeObservations.get(key);
        if (!count) return false;
        if (count === 1) activeObservations.delete(key);
        else activeObservations.set(key, count - 1);
        dispatch();
        return true;
      },
    });
  }

  return Object.freeze({ runExclusive, tryAcquireObservation });
}

module.exports = {
  SaveBusyError,
  coordinatorKeysConflict,
  createPathCoordinator,
  createSaveMutex,
};
