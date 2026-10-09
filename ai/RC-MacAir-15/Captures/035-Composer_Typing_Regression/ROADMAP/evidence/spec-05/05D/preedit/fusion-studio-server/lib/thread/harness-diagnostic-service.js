/**
 * @module thread/harness-diagnostic-service
 * @role Prompt-bound server diagnostic service — the SOLE owner of the
 *       dedicated `harness_error_diagnostics` table (RCC-0108 SPEC-03
 *       Slice C; parent §4.13.1; owner decisions R5/R5A/R6/R8).
 *
 * Binding rules implemented here:
 *  - The ONLY report input is the already-redacted closed V1 candidate
 *    (HarnessDiagnosticCandidateV1, same closed shape as
 *    lib/harness/errors.js sanitizeDiagnosticCandidate). This service has
 *    NO raw-error input and never traverses an Error/provider object.
 *  - Closed-shape re-validation: unknown keys are discarded; structurally
 *    invalid drafts are rejected WHOLE (the persist call resolves to null).
 *  - Bounds are re-enforced defensively even though the adapter redactor
 *    already applies them (constants imported, not duplicated): 128 UTF-8
 *    bytes per short identifier, 4 KiB message prefix, 16 KiB stderr tail,
 *    ≤16 allowlisted truncation markers, 24 KiB final serialized report.
 *    Out-of-bounds values are CORRECTED (truncated, marker recorded) when a
 *    bounded form exists; a report that still cannot fit the serialized cap
 *    is rejected whole. Policy: correct-then-cap, reject as last resort.
 *  - Retention/caps: 30-day retention, 500 rows per workspace, 5,000 total.
 *  - In ONE transaction BEFORE/WITH each insertion: purge expired rows,
 *    evict oldest rows to both caps (reserving the incoming row's slot so
 *    the caps hold AFTER insertion), then insert. ANY validation/cleanup/
 *    persistence failure rolls back the diagnostic write; the service
 *    resolves to null and NEVER throws into the terminalization path.
 *  - The same purge/evict cleanup runs at startup (best-effort wrapper
 *    warns and never blocks boot).
 *  - Dedicated table only: NEVER event_log, assistant parts, or general
 *    exchange metadata. No canonical UEB publication, no accepted-only
 *    relationship (R8).
 *  - Retrieval: exact workspaceId+threadId+turnId+diagnosticId match;
 *    missing/expired/mismatched/internal-error all yield ONE fixed
 *    value-free unavailable outcome with no distinguishing details.
 *  - Logging: fixed identifiers/type only on failure — report contents are
 *    never logged (R8 no-raw-logging posture).
 */

const { randomUUID } = require('crypto');
const path = require('path');

const { getDb } = require('../db');
const { HARNESS_DIAGNOSTIC_CATEGORIES } = require('../harness/errors');
// Bounds constants come from the adapter redactor (single source of truth);
// this service re-enforces them defensively rather than duplicating literals.
const {
  SHORT_IDENTIFIER_BYTES,
  MESSAGE_PREFIX_BYTES,
  STDERR_TAIL_BYTES,
  MAX_TRUNCATION_MARKERS,
  SERIALIZED_LIMIT_BYTES,
  TRUNCATION_MARKER_NAMES,
} = require('../harness/opencode/harness-diagnostic-redactor');

const TABLE = 'harness_error_diagnostics';
const CANDIDATE_VERSION = 1;

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ROWS_PER_WORKSPACE = 500;
const MAX_ROWS_TOTAL = 5000;

/**
 * The ONE fixed value-free unavailable outcome. Identical for missing,
 * expired, mismatched, malformed, and internal-error cases — callers and
 * clients cannot distinguish why a report is unavailable.
 */
const DIAGNOSTIC_UNAVAILABLE = Object.freeze({ status: 'unavailable' });

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function truncateUtf8Prefix(value, maxBytes) {
  if (byteLength(value) <= maxBytes) return value;
  let out = '';
  let total = 0;
  for (const char of value) {
    const size = byteLength(char);
    if (total + size > maxBytes) break;
    out += char;
    total += size;
  }
  return out;
}

function truncateUtf8Tail(value, maxBytes) {
  if (byteLength(value) <= maxBytes) return value;
  const chars = Array.from(value);
  const kept = [];
  let total = 0;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const size = byteLength(chars[i]);
    if (total + size > maxBytes) break;
    kept.unshift(chars[i]);
    total += size;
  }
  return kept.join('');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Defensive closed-shape re-validation + bounds enforcement for one
 * already-redacted V1 candidate. Returns a frozen, bounded report object,
 * or undefined when the draft is structurally invalid or cannot fit the
 * serialized cap. Never throws on bad input shape.
 *
 * @param {unknown} draft
 * @returns {Readonly<object>|undefined}
 */
function revalidateCandidate(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return undefined;
  if (draft.version !== CANDIDATE_VERSION) return undefined;
  if (!isNonEmptyString(draft.harnessId)) return undefined;
  if (!HARNESS_DIAGNOSTIC_CATEGORIES.includes(draft.category)) return undefined;
  if (typeof draft.hadRenderableOutput !== 'boolean') return undefined;
  if (typeof draft.hadToolCalls !== 'boolean') return undefined;
  if (!Array.isArray(draft.truncatedFields)) return undefined;
  if (!draft.truncatedFields.every((entry) => typeof entry === 'string')) return undefined;

  // Truncation markers: allowlisted fixed names only, deduped, capped.
  const markers = [];
  const addMarker = (name) => {
    if (!TRUNCATION_MARKER_NAMES.includes(name)) return;
    if (markers.includes(name)) return;
    if (markers.length >= MAX_TRUNCATION_MARKERS) return;
    markers.push(name);
  };
  draft.truncatedFields.forEach(addMarker);

  const report = {
    version: CANDIDATE_VERSION,
    harnessId: truncateUtf8Prefix(draft.harnessId, SHORT_IDENTIFIER_BYTES),
    category: draft.category,
    hadRenderableOutput: draft.hadRenderableOutput,
    hadToolCalls: draft.hadToolCalls,
  };
  if (report.harnessId !== draft.harnessId) addMarker('harnessId');

  // Unknown keys are discarded: only the closed optional fields below are
  // ever read off the draft. Invalid optional values are dropped, not kept.
  for (const field of ['modelId', 'providerCode', 'errorName', 'signal', 'lastCanonicalEventType']) {
    if (!isNonEmptyString(draft[field])) continue;
    const bounded = truncateUtf8Prefix(draft[field], SHORT_IDENTIFIER_BYTES);
    if (bounded !== draft[field]) addMarker(field);
    report[field] = bounded;
  }
  if (typeof draft.exitCode === 'number' && Number.isFinite(draft.exitCode)) {
    report.exitCode = draft.exitCode;
  }
  if (isNonEmptyString(draft.message)) {
    const bounded = truncateUtf8Prefix(draft.message, MESSAGE_PREFIX_BYTES);
    if (bounded !== draft.message) addMarker('message');
    report.message = bounded;
  }
  if (isNonEmptyString(draft.stderrExcerpt)) {
    const bounded = truncateUtf8Tail(draft.stderrExcerpt, STDERR_TAIL_BYTES);
    if (bounded !== draft.stderrExcerpt) addMarker('stderrExcerpt');
    report.stderrExcerpt = bounded;
  }

  // Serialized cap: progressively shrink the free-form fields (largest
  // first, mirroring the redactor's policy) until the report fits. A report
  // with no free-form text left that still exceeds the cap is rejected.
  let guard = 0;
  while (byteLength(JSON.stringify(report)) > SERIALIZED_LIMIT_BYTES && guard < 200) {
    guard += 1;
    const messageChars = report.message === undefined ? 0 : Array.from(report.message).length;
    const stderrChars = report.stderrExcerpt === undefined ? 0 : Array.from(report.stderrExcerpt).length;
    if (messageChars === 0 && stderrChars === 0) return undefined;
    if (messageChars >= stderrChars && messageChars > 0) {
      report.message = Array.from(report.message).slice(0, Math.floor(messageChars / 2)).join('');
      addMarker('message');
    } else {
      report.stderrExcerpt = Array.from(report.stderrExcerpt).slice(Math.ceil(stderrChars / 2)).join('');
      addMarker('stderrExcerpt');
    }
    if (report.message === '') delete report.message;
    if (report.stderrExcerpt === '') delete report.stderrExcerpt;
  }
  if (byteLength(JSON.stringify(report)) > SERIALIZED_LIMIT_BYTES) return undefined;

  report.truncatedFields = Object.freeze(markers);
  return Object.freeze(report);
}

async function evictOldestForWorkspace(db, workspaceId, cap) {
  const countRow = await db(TABLE).where('workspace_id', workspaceId).count('* as c').first();
  const excess = Number(countRow?.c || 0) - cap;
  if (excess <= 0) return;
  const oldest = await db(TABLE)
    .where('workspace_id', workspaceId)
    .orderBy('created_at', 'asc')
    .orderByRaw('rowid asc')
    .limit(excess)
    .select('diagnostic_id');
  await db(TABLE).whereIn('diagnostic_id', oldest.map((row) => row.diagnostic_id)).del();
}

/**
 * Purge expired rows, then evict oldest rows to both caps. `reserveSlot`
 * makes room for one incoming row so the caps hold AFTER insertion.
 * Runs inside the caller's transaction when `trx` is supplied. Without a
 * `workspaceId` (startup cleanup), the per-workspace cap is enforced for
 * EVERY workspace over the cap.
 *
 * @param {import('knex').Knex|import('knex').Knex.Transaction} db
 * @param {number} now - ms epoch
 * @param {{ workspaceId?: string, reserveSlot?: boolean }} [options]
 */
async function cleanupHarnessDiagnosticsIn(db, now, options = {}) {
  await db(TABLE).where('expires_at', '<=', now).del();

  const workspaceCap = MAX_ROWS_PER_WORKSPACE - (options.reserveSlot ? 1 : 0);
  if (isNonEmptyString(options.workspaceId)) {
    await evictOldestForWorkspace(db, options.workspaceId, workspaceCap);
  } else {
    const overCap = await db(TABLE)
      .select('workspace_id')
      .groupBy('workspace_id')
      .havingRaw('count(*) > ?', [workspaceCap]);
    for (const row of overCap) {
      await evictOldestForWorkspace(db, row.workspace_id, workspaceCap);
    }
  }

  const totalCap = MAX_ROWS_TOTAL - (options.reserveSlot ? 1 : 0);
  const totalRow = await db(TABLE).count('* as c').first();
  const totalExcess = Number(totalRow?.c || 0) - totalCap;
  if (totalExcess > 0) {
    const oldest = await db(TABLE)
      .orderBy('created_at', 'asc')
      .orderByRaw('rowid asc')
      .limit(totalExcess)
      .select('diagnostic_id');
    await db(TABLE).whereIn('diagnostic_id', oldest.map((row) => row.diagnostic_id)).del();
  }
}

/**
 * The insertion-time/startup cleanup, run as its own transaction.
 * Throws on DB failure — callers decide their own failure policy
 * (persist rolls back to null; the startup wrapper warns and continues).
 *
 * @returns {Promise<void>}
 */
async function cleanupHarnessDiagnostics() {
  const db = getDb();
  await db.transaction(async (trx) => {
    await cleanupHarnessDiagnosticsIn(trx, Date.now());
  });
}

/**
 * Validate and persist one already-redacted diagnostic candidate, bound to
 * the authoritative workspace/thread/turn identity. Best-effort: resolves
 * to a server-generated UUID diagnosticId on success and null on ANY
 * failure (validation, migration availability, cleanup, insertion). Never
 * throws into the terminalization path.
 *
 * @param {{workspaceId?: unknown, projectRoot?: unknown, workspaceEpoch?: unknown, threadId?: unknown, turnId?: unknown}} binding
 * @param {unknown} candidate - already-redacted HarnessDiagnosticCandidateV1
 * @returns {Promise<string|null>}
 */
async function persistDiagnosticReport(binding, candidate) {
  const workspaceId = binding?.workspaceId;
  const projectRoot = binding?.projectRoot;
  const workspaceEpoch = binding?.workspaceEpoch;
  const threadId = binding?.threadId;
  const turnId = binding?.turnId;
  try {
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(projectRoot)
      || !isNonEmptyString(workspaceEpoch) || !isNonEmptyString(threadId)
      || !isNonEmptyString(turnId)) {
      return null;
    }
    const report = revalidateCandidate(candidate);
    if (!report) return null;
    const serialized = JSON.stringify(report);
    if (byteLength(serialized) > SERIALIZED_LIMIT_BYTES) return null;

    const diagnosticId = randomUUID();
    const now = Date.now();
    const db = getDb();
    // ONE transaction: purge expired → evict oldest to both caps (reserving
    // the incoming slot) → insert. Any failure rolls the write back.
    await db.transaction(async (trx) => {
      await cleanupHarnessDiagnosticsIn(trx, now, { workspaceId, reserveSlot: true });
      await trx(TABLE).insert({
        diagnostic_id: diagnosticId,
        workspace_id: workspaceId,
        project_root: path.resolve(projectRoot),
        workspace_epoch: workspaceEpoch,
        thread_id: threadId,
        turn_id: turnId,
        report_json: serialized,
        created_at: now,
        expires_at: now + RETENTION_MS,
      });
    });
    return diagnosticId;
  } catch {
    // Fixed marker + authoritative opaque identifiers only — neither report
    // contents nor the caught database/provider value is ever logged (R8).
    console.warn('[HarnessDiagnostics] Persist failed', {
      workspaceId,
      threadId,
      turnId,
      marker: 'HARNESS_DIAGNOSTIC_PERSIST_FAILED',
    });
    return null;
  }
}

/**
 * Retrieval-side read consumed by the Slice D WS handler. Exact
 * workspaceId+threadId+turnId+diagnosticId match; expired rows are
 * unavailable. Returns { status: 'available', report, reportJson } or the
 * ONE fixed value-free unavailable outcome (no distinguishing details).
 * Never throws.
 *
 * @param {{workspaceId?: unknown, projectRoot?: unknown, workspaceEpoch?: unknown, threadId?: unknown, turnId?: unknown, diagnosticId?: unknown}} query
 * @returns {Promise<Readonly<{status:'available', report:object, reportJson:string}>|Readonly<{status:'unavailable'}>>}
 */
async function getDiagnosticReport(query) {
  try {
    const { workspaceId, projectRoot, workspaceEpoch, threadId, turnId, diagnosticId } = query || {};
    if (![workspaceId, projectRoot, workspaceEpoch, threadId, turnId, diagnosticId]
      .every(isNonEmptyString)) {
      return DIAGNOSTIC_UNAVAILABLE;
    }
    const db = getDb();
    const row = await db(TABLE)
      .where({
        diagnostic_id: diagnosticId,
        workspace_id: workspaceId,
        project_root: path.resolve(projectRoot),
        workspace_epoch: workspaceEpoch,
        thread_id: threadId,
        turn_id: turnId,
      })
      .first();
    if (!row) return DIAGNOSTIC_UNAVAILABLE;
    if (Number(row.expires_at) <= Date.now()) return DIAGNOSTIC_UNAVAILABLE;
    const report = revalidateCandidate(JSON.parse(row.report_json));
    if (!report) return DIAGNOSTIC_UNAVAILABLE;
    const reportJson = JSON.stringify(report);
    if (byteLength(reportJson) > SERIALIZED_LIMIT_BYTES) return DIAGNOSTIC_UNAVAILABLE;
    return Object.freeze({ status: 'available', report, reportJson });
  } catch {
    return DIAGNOSTIC_UNAVAILABLE;
  }
}

/**
 * Startup cleanup entry point — the SAME purge/expiry + cap eviction as
 * insertion-time cleanup. Best-effort by contract: warns on failure and
 * never blocks boot.
 *
 * @returns {Promise<boolean>} true when cleanup ran successfully
 */
async function runStartupDiagnosticCleanup() {
  try {
    await cleanupHarnessDiagnostics();
    return true;
  } catch {
    console.warn('[HarnessDiagnostics] Startup cleanup failed', {
      marker: 'HARNESS_DIAGNOSTIC_STARTUP_CLEANUP_FAILED',
    });
    return false;
  }
}

module.exports = {
  TABLE,
  RETENTION_MS,
  MAX_ROWS_PER_WORKSPACE,
  MAX_ROWS_TOTAL,
  DIAGNOSTIC_UNAVAILABLE,
  persistDiagnosticReport,
  getDiagnosticReport,
  cleanupHarnessDiagnostics,
  runStartupDiagnosticCleanup,
  // Exported for focused unit tests of the re-validation boundary.
  revalidateCandidate,
};
