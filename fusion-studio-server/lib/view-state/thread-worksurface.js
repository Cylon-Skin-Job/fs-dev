/**
 * Thread Worksurface — CHAT-03 / SPEC-03 §4, §6.2, §7.
 *
 * The view-state document remains the sole owner of worksurface content. One
 * group-keyed entry lives at the logical key
 * `viewStates[viewId].threadWorksurfaces[threadGroupId]` and is persisted in
 * the view capsule state document through the accepted view-state service —
 * never through renderer file writes and never duplicated in SQLite.
 *
 * Two independently revised lanes live in one entry:
 *   - adapter-owned `content` (opaque, validated JSON);
 *   - service-owned `managedComponentPlacements` (empty throughout SPEC-03).
 *
 * A content PUT server-merges against the current placement lane; a placement
 * mutation server-merges against the current content lane. Callers can never
 * replace the opposite lane. `workspaceId` is derived from the containing
 * service/connection identity and is never accepted from a renderer. `viewId`
 * must be a registered view id (`null`/Legacy has no entry) and `threadGroupId`
 * is always the worksurface key; `threadId` and `surfaceId` never appear here.
 *
 * CAS correctness depends on the read-modify-write running inside the
 * view-state writer's per-view queue (`runViewStateWriteExclusive`), so two
 * concurrent lane mutations cannot observe the same base.
 */

'use strict';

const crypto = require('crypto');

const {
  resolveViewStateUnderLease,
} = require('./resolver');
const {
  writeViewStatePatchNow,
  runViewStateWriteExclusive,
} = require('./writer');
const viewReadiness = require('../views/readiness-runtime');

/** Top-level view-state key holding the group-keyed worksurface map. */
const WORKSPACE_KEY = 'threadWorksurfaces';

const SCHEMA_VERSION = 1;
const CONTENT_LANE = 'content';
const PLACEMENT_LANE = 'placement';

/** Bounded limits (SPEC-03 §7: payload and entry limits + focused abuse tests). */
const MAX_CONTENT_BYTES = 256 * 1024;
const MAX_ADAPTER_ID_BYTES = 128;
const MAX_ADAPTER_VERSION = 10000;
const MAX_REVISION_BYTES = 128;
const MAX_PLACEMENT_ID_BYTES = 128;
const MAX_DESCRIPTOR_BYTES = 64 * 1024;
const MAX_PLACEMENTS = 64;
const MAX_JSON_DEPTH = 32;

/**
 * Reserved identity for a service-created entry that has a placement lane but
 * no adapter content yet. SPEC-04 is the first real producer; SPEC-03 only
 * proves the empty-lane merge and concurrency behavior.
 */
const SERVICE_ADAPTER_ID = 'service-managed';
const SERVICE_ADAPTER_VERSION = 1;

const PLACEMENT_OPERATIONS = Object.freeze(new Set(['upsert', 'close']));

function boundedError(code, message, extra) {
  const error = new Error(message || code);
  error.code = code;
  if (extra && typeof extra === 'object') Object.assign(error, extra);
  return error;
}

function mintRevision() {
  return `wsr_${crypto.randomBytes(16).toString('hex')}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) return false;
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (type === 'function' || type === 'symbol' || type === 'bigint' || type === 'undefined') {
    return false;
  }
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (type === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.keys(value).every((key) => isJsonValue(value[key], depth + 1));
  }
  return false;
}

function jsonByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (_error) {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeExpectedRevision(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0
    || Buffer.byteLength(value, 'utf8') > MAX_REVISION_BYTES) {
    throw boundedError('invalid_request', `${field} must be a bounded opaque revision or null`);
  }
  return value;
}

function requireString(value, field, maxBytes) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw boundedError('invalid_request', `${field} is required`);
  }
  if (maxBytes && Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw boundedError('invalid_request', `${field} exceeds its bounded size`);
  }
  return value;
}

function validateContentInput(input = {}) {
  const adapterId = requireString(input.adapterId, 'adapterId', MAX_ADAPTER_ID_BYTES);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(adapterId)) {
    throw boundedError('invalid_adapter', 'adapterId must be a bounded adapter identity');
  }
  const adapterVersion = input.adapterVersion;
  if (!Number.isInteger(adapterVersion)
    || adapterVersion < 1
    || adapterVersion > MAX_ADAPTER_VERSION) {
    throw boundedError('invalid_adapter', 'adapterVersion must be a supported integer');
  }
  if (!isJsonValue(input.content)) {
    throw boundedError('content_invalid', 'content must be JSON-safe');
  }
  if (jsonByteLength(input.content) > MAX_CONTENT_BYTES) {
    throw boundedError('content_too_large', 'content exceeds the worksurface size limit');
  }
  return {
    adapterId,
    adapterVersion,
    content: input.content,
    expectedContentRevision: normalizeExpectedRevision(
      input.expectedContentRevision,
      'expectedContentRevision',
    ),
  };
}

function validatePlacementInput(input = {}) {
  const placementId = requireString(input.placementId, 'placementId', MAX_PLACEMENT_ID_BYTES);
  const operation = input.operation;
  if (!PLACEMENT_OPERATIONS.has(operation)) {
    throw boundedError('invalid_request', 'operation must be upsert or close');
  }
  let descriptor;
  if (operation === 'upsert') {
    if (!isJsonValue(input.descriptor)) {
      throw boundedError('invalid_descriptor', 'upsert requires a JSON-safe descriptor');
    }
    if (jsonByteLength(input.descriptor) > MAX_DESCRIPTOR_BYTES) {
      throw boundedError('invalid_descriptor', 'descriptor exceeds its bounded size');
    }
    descriptor = input.descriptor;
  } else if (input.descriptor !== undefined && input.descriptor !== null) {
    throw boundedError('invalid_descriptor', 'close does not accept a descriptor');
  }
  return {
    placementId,
    operation,
    descriptor,
    expectedPlacementRevision: normalizeExpectedRevision(
      input.expectedPlacementRevision,
      'expectedPlacementRevision',
    ),
  };
}

/** Validate a stored entry; unsupported/invalid data is treated as absent. */
function normalizeEntry(raw) {
  if (!isPlainObject(raw)) return null;
  if (!Number.isInteger(raw.schemaVersion) || raw.schemaVersion < 1) return null;
  if (typeof raw.adapterId !== 'string' || raw.adapterId.length === 0) return null;
  if (!Number.isInteger(raw.adapterVersion) || raw.adapterVersion < 1) return null;
  if (typeof raw.contentRevision !== 'string' || raw.contentRevision.length === 0) return null;
  if (typeof raw.placementRevision !== 'string' || raw.placementRevision.length === 0) return null;
  if (typeof raw.updatedAt !== 'string' || raw.updatedAt.length === 0) return null;
  if (!isJsonValue(raw.content)) return null;
  if (!isPlainObject(raw.managedComponentPlacements)) return null;
  return {
    schemaVersion: raw.schemaVersion,
    adapterId: raw.adapterId,
    adapterVersion: raw.adapterVersion,
    contentRevision: raw.contentRevision,
    placementRevision: raw.placementRevision,
    updatedAt: raw.updatedAt,
    content: raw.content,
    managedComponentPlacements: raw.managedComponentPlacements,
  };
}

function readEntryFromState(state, threadGroupId) {
  const map = state && state[WORKSPACE_KEY];
  if (!isPlainObject(map)) return null;
  return normalizeEntry(map[threadGroupId]);
}

/** The materialized set excludes closed dispositions (SPEC-03 §7). */
function materializedPlacements(entry) {
  const placements = entry?.managedComponentPlacements;
  if (!isPlainObject(placements)) return {};
  const open = {};
  for (const [placementId, record] of Object.entries(placements)) {
    if (isPlainObject(record) && record.disposition === 'open') open[placementId] = record;
  }
  return open;
}

function entrySummary(entry) {
  return {
    entry,
    contentRevision: entry ? entry.contentRevision : null,
    placementRevision: entry ? entry.placementRevision : null,
  };
}

function withLease(projectRoot, lease, operation) {
  if (lease) return operation(lease);
  const acquired = viewReadiness.acquireViewReadinessLease({ projectRoot });
  return Promise.resolve()
    .then(() => operation(acquired))
    .finally(() => acquired.release());
}

/** Resolve with a classification-friendly error for an unregistered view. */
async function resolveStateForView(projectRoot, viewId, lease) {
  try {
    return await resolveViewStateUnderLease(projectRoot, viewId, lease);
  } catch (error) {
    if (error && error.message === 'View is not registered') {
      throw boundedError('invalid_view', 'viewId must be a registered non-Legacy view');
    }
    throw error;
  }
}

/** Read one entry (no mutation, no write queue). */
async function getThreadWorksurface(projectRoot, viewId, threadGroupId, lease) {
  return withLease(projectRoot, lease, async (activeLease) => {
    const state = await resolveStateForView(projectRoot, viewId, activeLease);
    return entrySummary(readEntryFromState(state, threadGroupId));
  });
}

function validateGroupIdentity(viewId, threadGroupId) {
  if (typeof viewId !== 'string' || viewId.trim().length === 0) {
    // `viewId: null` is Legacy and has no worksurface entry (SPEC-03 §4).
    throw boundedError('invalid_view', 'viewId must be a registered non-Legacy view');
  }
  requireString(threadGroupId, 'threadGroupId', 256);
  return { viewId, threadGroupId };
}

async function mutateUnderQueue(projectRoot, viewId, threadGroupId, lease, operation) {
  return runViewStateWriteExclusive(projectRoot, viewId, () => withLease(
    projectRoot,
    lease,
    async (activeLease) => {
      const state = await resolveStateForView(projectRoot, viewId, activeLease);
      const current = readEntryFromState(state, threadGroupId);
      const outcome = await operation(current);
      if (!outcome || !outcome.changed) {
        return { ...entrySummary(current), applied: false, ...(outcome?.extra || {}) };
      }
      const map = isPlainObject(state[WORKSPACE_KEY]) ? { ...state[WORKSPACE_KEY] } : {};
      map[threadGroupId] = outcome.entry;
      const merged = await writeViewStatePatchNow(
        projectRoot,
        viewId,
        { [WORKSPACE_KEY]: map },
        activeLease,
      );
      const persisted = readEntryFromState(merged, threadGroupId) || outcome.entry;
      return { ...entrySummary(persisted), applied: true, ...(outcome.extra || {}) };
    },
  ));
}

/**
 * Exact-entry removal for a deleted group (SPEC-03 §8). Goes through the same
 * per-view write queue and view-state writer as every other lane mutation, so
 * it never mutates a file directly and never races a concurrent lane write.
 *
 * Exactness: only the addressed `{viewId, threadGroupId}` map key is removed;
 * every other view/workspace/group entry is untouched. An already-absent entry
 * is an acknowledged no-op and performs no write (a foreign or never-created
 * key can never create or rewrite a capsule file).
 */
async function removeThreadWorksurface(projectRoot, viewId, threadGroupId, lease) {
  const identity = validateGroupIdentity(viewId, threadGroupId);
  return runViewStateWriteExclusive(projectRoot, identity.viewId, () => withLease(
    projectRoot,
    lease,
    async (activeLease) => {
      const state = await resolveStateForView(projectRoot, identity.viewId, activeLease);
      const current = readEntryFromState(state, identity.threadGroupId);
      if (!current) {
        return {
          applied: true, removed: false, entry: null,
          contentRevision: null, placementRevision: null,
        };
      }
      const map = isPlainObject(state[WORKSPACE_KEY]) ? { ...state[WORKSPACE_KEY] } : {};
      delete map[identity.threadGroupId];
      await writeViewStatePatchNow(
        projectRoot,
        identity.viewId,
        { [WORKSPACE_KEY]: map },
        activeLease,
      );
      return {
        applied: true, removed: true, entry: null,
        contentRevision: null, placementRevision: null,
      };
    },
  ));
}

/**
 * Content-lane PUT. Server-merges against the current placement lane; the
 * placement revision is preserved (or minted once on first creation).
 */
async function putThreadWorksurfaceContent(projectRoot, viewId, threadGroupId, input, lease) {
  const identity = validateGroupIdentity(viewId, threadGroupId);
  const accepted = validateContentInput(input);
  return mutateUnderQueue(projectRoot, identity.viewId, identity.threadGroupId, lease, (current) => {
    const currentRevision = current ? current.contentRevision : null;
    if (accepted.expectedContentRevision !== currentRevision) {
      // SPEC-03 §6.2: an identical local capture acknowledges the current
      // revision instead of failing, without writing a new revision.
      if (current
        && current.adapterId === accepted.adapterId
        && current.adapterVersion === accepted.adapterVersion
        && jsonByteLength(current.content) === jsonByteLength(accepted.content)
        && JSON.stringify(current.content) === JSON.stringify(accepted.content)) {
        return { changed: false, extra: { acknowledged: true } };
      }
      throw boundedError('revision_conflict', 'content revision is stale', {
        lane: CONTENT_LANE,
        ...entrySummary(current),
      });
    }
    const now = new Date().toISOString();
    return {
      changed: true,
      entry: {
        schemaVersion: SCHEMA_VERSION,
        adapterId: accepted.adapterId,
        adapterVersion: accepted.adapterVersion,
        contentRevision: mintRevision(),
        placementRevision: current ? current.placementRevision : mintRevision(),
        updatedAt: now,
        content: accepted.content,
        managedComponentPlacements: current ? current.managedComponentPlacements : {},
      },
    };
  });
}

/**
 * Narrow service-owned managed-placement mutation. Owns only
 * `managedComponentPlacements`; it cannot mutate adapter `content`. `close`
 * stores a disposition and removes the placement from the materialized set
 * without erasing its idempotency history.
 */
async function mutateManagedPlacement(projectRoot, viewId, threadGroupId, input, lease) {
  const identity = validateGroupIdentity(viewId, threadGroupId);
  const accepted = validatePlacementInput(input);
  return mutateUnderQueue(projectRoot, identity.viewId, identity.threadGroupId, lease, (current) => {
    // SPEC-03 §7: the narrow placement mutation addresses workspace/view/group
    // + placement id + expected placement revision + descriptor — with no
    // entry-existence precondition. `upsert` may create the entry with the
    // reserved service-managed identity (content stays null until an adapter
    // writes it), so a later adapterless or never-content-changed group can
    // still carry a Side Chat placement (SPEC-04 §6). `close` still requires an
    // existing placement record to close.
    const currentPlacementRevision = current ? current.placementRevision : null;
    if (accepted.expectedPlacementRevision !== currentPlacementRevision) {
      throw boundedError('revision_conflict', 'placement revision is stale', {
        lane: PLACEMENT_LANE,
        ...entrySummary(current),
      });
    }
    const placements = current
      ? { ...current.managedComponentPlacements }
      : {};
    if (accepted.operation === 'upsert') {
      const existing = placements[accepted.placementId];
      if (!existing && Object.keys(placements).length >= MAX_PLACEMENTS) {
        throw boundedError('placement_limit', 'too many managed placements');
      }
      placements[accepted.placementId] = {
        placementId: accepted.placementId,
        disposition: 'open',
        descriptor: accepted.descriptor,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const existing = placements[accepted.placementId];
      if (!existing) {
        throw boundedError('not_found', 'placement does not exist');
      }
      placements[accepted.placementId] = {
        placementId: accepted.placementId,
        disposition: 'closed',
        ...(isPlainObject(existing) && existing.descriptor !== undefined
          ? { descriptor: existing.descriptor }
          : {}),
        updatedAt: new Date().toISOString(),
      };
    }
    const now = new Date().toISOString();
    return {
      changed: true,
      entry: {
        schemaVersion: current ? current.schemaVersion : SCHEMA_VERSION,
        adapterId: current ? current.adapterId : SERVICE_ADAPTER_ID,
        adapterVersion: current ? current.adapterVersion : SERVICE_ADAPTER_VERSION,
        contentRevision: current ? current.contentRevision : mintRevision(),
        placementRevision: mintRevision(),
        updatedAt: now,
        content: current ? current.content : null,
        managedComponentPlacements: placements,
      },
    };
  });
}

module.exports = {
  WORKSPACE_KEY,
  SCHEMA_VERSION,
  CONTENT_LANE,
  PLACEMENT_LANE,
  SERVICE_ADAPTER_ID,
  SERVICE_ADAPTER_VERSION,
  MAX_CONTENT_BYTES,
  MAX_DESCRIPTOR_BYTES,
  MAX_PLACEMENTS,
  getThreadWorksurface,
  putThreadWorksurfaceContent,
  mutateManagedPlacement,
  removeThreadWorksurface,
  materializedPlacements,
  // exported for focused tests
  isJsonValue,
  validateContentInput,
  validatePlacementInput,
  readEntryFromState,
  mintRevision,
};
