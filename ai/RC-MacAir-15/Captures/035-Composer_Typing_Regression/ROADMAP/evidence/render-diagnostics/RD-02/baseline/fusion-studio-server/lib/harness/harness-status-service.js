/**
 * Harness install-status service — cache layer in front of per-harness
 * install probes.
 *
 * Reads:  getAll() returns one row per registered harness in the shape
 *         the /api/harnesses endpoint has always returned, sourced from
 *         the harness_status SQLite table. Ids without a cached row
 *         get an optimistic `installed: true` default (spec §3b) so
 *         first-boot UX shows every option enabled while revalidation
 *         runs in the background.
 *
 * Writes: revalidate(id) runs a filesystem-catalog probe via
 *         bin-locator, upserts the row, and emits
 *         `harness:status_changed` on the event bus when the
 *         installed flag differs from the previous row.
 *
 * Scheduling: revalidateAll() enforces at most one in-flight pass plus
 * one queued re-fire — the picker's request storm collapses to two
 * overlapping passes at worst.
 */

const { getDb } = require('../db');
const { emit } = require('../event-bus');
const { findBinary } = require('./bin-locator');

const TABLE = 'harness_status';
const GET_VERSION_BUDGET_MS = 150;

let inFlight = false;
let queued = false;

function registryModule() {
  // Lazy-require to break the registry ↔ service import cycle.
  return require('./registry');
}

function kimiBinaryName() {
  return process.env.KIMI_PATH || 'kimi';
}

function resolveCliName(id, harness) {
  if (id === 'kimi') return kimiBinaryName();
  return harness && harness.cliName ? harness.cliName : null;
}

async function getVersionWithBudget(harness) {
  if (!harness || typeof harness.getVersion !== 'function') return null;
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(null);
    }, GET_VERSION_BUDGET_MS);
    Promise.resolve()
      .then(() => harness.getVersion())
      .then((v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(typeof v === 'string' && v.trim() ? v.trim() : null);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      });
  });
}

function rowToWire(row) {
  return {
    id: row.id,
    installed: !!row.installed,
    binary_path: row.binary_path || null,
    version: row.version || null,
    error: row.error || null,
  };
}

function buildHarnessInfo(id, harness, meta, row) {
  const builtIn = !!meta.builtIn;
  // Optimistic default for ids with no row yet (spec §3b); built-ins
  // always report installed.
  const installed = builtIn ? true : row ? !!row.installed : true;
  return {
    id,
    name: harness.name,
    provider: harness.provider,
    installed,
    builtIn,
    version: row && row.version ? row.version : null,
    action: !builtIn && row && !row.installed ? 'install' : null,
    installCommand: meta.installCommand || null,
    error: row && row.error ? row.error : null,
  };
}

/**
 * Return one HarnessInfo per registered harness, sourced from cache
 * with optimistic defaults for missing rows.
 * @returns {Promise<object[]>}
 */
async function getAll() {
  const { registry } = registryModule();
  const db = getDb();
  const rows = await db(TABLE).select();
  const byId = new Map(rows.map((r) => [r.id, r]));

  const results = [];
  for (const [id, harness] of registry.harnesses) {
    const meta = registry.metadata.get(id) || {};
    results.push(buildHarnessInfo(id, harness, meta, byId.get(id)));
  }
  return results;
}

/**
 * Probe a single harness, upsert its row, and emit on change.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function revalidate(id) {
  const { registry } = registryModule();
  const harness = registry.get(id);
  if (!harness) return null;
  const meta = registry.getMetadata(id) || {};
  const db = getDb();
  const prior = await db(TABLE).where({ id }).first();

  // Built-ins short-circuit — always installed, never probed.
  if (meta.builtIn) {
    const row = {
      id,
      installed: 1,
      binary_path: null,
      version: null,
      checked_at: Date.now(),
      error: null,
    };
    await upsertRow(db, row);
    if (!prior || !prior.installed) emit('harness:status_changed', rowToWire(row));
    return row;
  }

  const cliName = resolveCliName(id, harness);
  let binaryPath = null;
  let error = null;
  if (cliName) {
    try {
      binaryPath = await findBinary(cliName);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  let version = null;
  if (binaryPath) {
    version = await getVersionWithBudget(harness);
  }

  const installed = binaryPath ? 1 : 0;
  const row = {
    id,
    installed,
    binary_path: binaryPath,
    version,
    checked_at: Date.now(),
    error,
  };

  try {
    await upsertRow(db, row);
  } catch (err) {
    console.error('[HarnessStatusService] upsert failed:', err.message);
    return row;
  }

  const priorInstalled = prior ? !!prior.installed : null;
  if (priorInstalled === null || priorInstalled !== !!installed) {
    emit('harness:status_changed', rowToWire(row));
  }
  return row;
}

async function upsertRow(db, row) {
  await db(TABLE).insert(row).onConflict('id').merge();
}

/**
 * Fan out revalidate() across every registered harness. Debounced so
 * that at most one pass runs at a time, with one queued re-fire.
 * @returns {Promise<void>}
 */
async function revalidateAll() {
  if (inFlight) {
    queued = true;
    return;
  }
  inFlight = true;
  try {
    const { registry } = registryModule();
    const ids = Array.from(registry.harnesses.keys());
    await Promise.all(ids.map((id) => revalidate(id).catch((err) => {
      console.error(`[HarnessStatusService] revalidate(${id}) failed:`, err.message);
    })));
  } finally {
    inFlight = false;
    if (queued) {
      queued = false;
      // Fire-and-forget the queued re-run; don't await so the caller
      // isn't blocked on a cascade of revalidations.
      revalidateAll().catch((err) => {
        console.error('[HarnessStatusService] queued revalidateAll failed:', err.message);
      });
    }
  }
}

module.exports = { getAll, revalidate, revalidateAll };
