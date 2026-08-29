/**
 * @module thread/turn-terminal-error
 * @role Allowlisted TurnTerminalError catalog reconstruction + strict
 *       safe-envelope validation for snapshot/publication/metadata use
 *       (RCC-0108 SPEC-03 Slice B; parent §4.13 table — normative values).
 *
 * The ONLY source of kind/code/message/recoverable values is the fixed
 * catalog below — never the thrown input, never provider data, never user
 * text. Shared runtime code checks ONLY a genuine HarnessRuntimeError marker
 * (isHarnessRuntimeError + exact code equality); raw error codes, names,
 * messages, causes, and stacks are never parsed or inspected here.
 *
 * Reason-gating rule (documented contract): an error envelope attaches ONLY
 * to reason 'error'. Normal ('complete') and interrupted terminals never
 * carry one; resolveTerminalErrorForReason() enforces this centrally.
 */

const { isHarnessRuntimeError } = require('../harness/errors');

/** Closed transcript code union (SPEC-03 §2). Only these may be published. */
const TURN_TERMINAL_ERROR_CODES = Object.freeze([
  'AUTHENTICATION_FAILED',
  'MODEL_TIMEOUT',
  'HARNESS_EXITED',
  'MODEL_RESPONSE_FAILED',
]);

/** Closed kind union (parent §4.13). */
const TURN_TERMINAL_ERROR_KINDS = Object.freeze(['runtime', 'authentication']);

/**
 * Upper bound for the optional opaque diagnosticId in CHARACTERS (Unicode
 * code units of the JS string). Slice C produces UUIDs well under this;
 * the 128-UTF-8-byte storage bound is enforced by the diagnostic service.
 */
const MAX_DIAGNOSTIC_ID_LENGTH = 128;

const TERMINAL_ERROR_REASON = 'error';

/**
 * Closed display catalog — parent §4.13 table, EXACT values. Rows are
 * reconstructed from these constants only; messages are fixed constants with
 * no interpolated exception text (each ≤300 Unicode code points by
 * construction).
 */
const TURN_TERMINAL_ERROR_CATALOG = Object.freeze({
  AUTHENTICATION_FAILED: Object.freeze({
    kind: 'authentication',
    code: 'AUTHENTICATION_FAILED',
    message: 'Authentication failed. Check the configured harness credentials and try again.',
    recoverable: true,
  }),
  MODEL_TIMEOUT: Object.freeze({
    kind: 'runtime',
    code: 'MODEL_TIMEOUT',
    message: 'The model response timed out before it completed.',
    recoverable: true,
  }),
  HARNESS_EXITED: Object.freeze({
    kind: 'runtime',
    code: 'HARNESS_EXITED',
    message: 'The model process ended before the response completed.',
    recoverable: true,
  }),
  MODEL_RESPONSE_FAILED: Object.freeze({
    kind: 'runtime',
    code: 'MODEL_RESPONSE_FAILED',
    message: 'The model response failed before it completed.',
    recoverable: true,
  }),
});

/** Genuine internal marker code → catalog row. Exact equality only. */
const MARKER_CODE_TO_CATALOG_ROW = Object.freeze({
  HARNESS_AUTHENTICATION_FAILED: TURN_TERMINAL_ERROR_CATALOG.AUTHENTICATION_FAILED,
  HARNESS_MODEL_TIMEOUT: TURN_TERMINAL_ERROR_CATALOG.MODEL_TIMEOUT,
  HARNESS_PROCESS_EXIT: TURN_TERMINAL_ERROR_CATALOG.HARNESS_EXITED,
});

function makeCatalogRowCopy(row) {
  return Object.freeze({ ...row });
}

/**
 * Reconstruct the TurnTerminalError for one post-turn_begin exception FROM
 * THE CATALOG ROW ONLY. A genuine HarnessRuntimeError marker whose exact
 * known `code` selects its specific row; EVERY other value — plain Errors,
 * marker-shaped lookalikes, strings, null, undefined — yields the generic
 * MODEL_RESPONSE_FAILED fallback row. No field is ever spread or cloned from
 * the input and nothing beyond the genuine-marker check is read from it.
 * diagnosticId is absent at this slice (Slice C adds the UUID lookup).
 *
 * @param {unknown} [err] - the thrown failure (any value)
 * @returns {Readonly<{kind:string,code:string,message:string,recoverable:boolean}>}
 */
function normalizeTurnTerminalError(err) {
  const row = (isHarnessRuntimeError(err) && MARKER_CODE_TO_CATALOG_ROW[err.code])
    || TURN_TERMINAL_ERROR_CATALOG.MODEL_RESPONSE_FAILED;
  return makeCatalogRowCopy(row);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Strict safe-envelope validator for TurnTerminalError values arriving from
 * snapshots, wire payloads, or persisted metadata (rehydration). Accepts ONLY:
 * - a plain object;
 * - kind ∈ {'runtime','authentication'};
 * - code ∈ the four catalog codes;
 * - message EXACTLY equal to that code's fixed catalog message;
 * - recoverable === true;
 * - optional diagnosticId: non-empty string ≤128 chars (opaque);
 * - NO extra own enumerable keys.
 * Any violation returns null. Valid input returns a normalized frozen copy.
 *
 * @param {unknown} value
 * @returns {Readonly<object>|null}
 */
function validateTurnTerminalError(value) {
  if (!isPlainObject(value)) return null;

  const allowedKeys = ['kind', 'code', 'message', 'recoverable', 'diagnosticId'];
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) return null;
  }

  if (!TURN_TERMINAL_ERROR_KINDS.includes(value.kind)) return null;

  const row = TURN_TERMINAL_ERROR_CATALOG[value.code];
  if (!row) return null;
  // Wrong-code message pairing and kind/code mismatch are both rejections:
  // every published field must agree with its single catalog row.
  if (value.message !== row.message) return null;
  if (value.kind !== row.kind) return null;
  if (value.recoverable !== true) return null;

  const validated = {
    kind: value.kind,
    code: value.code,
    message: value.message,
    recoverable: true,
  };
  if (value.diagnosticId !== undefined) {
    const id = value.diagnosticId;
    if (typeof id !== 'string' || !id || id.length > MAX_DIAGNOSTIC_ID_LENGTH) return null;
    validated.diagnosticId = id;
  }
  return Object.freeze(validated);
}

/**
 * Reason gating (parent §4.6/§4.13): an envelope attaches ONLY to reason
 * 'error'. Returns the VALIDATED envelope for an error terminal (or null
 * when absent/invalid), and null for every other reason regardless of what
 * the payload carries. Callers decide their own null policy afterwards:
 * the canonical terminal path substitutes the generic catalog row so an
 * error turn_end ALWAYS carries a valid envelope, while persistence paths
 * omit rather than substitute.
 *
 * @param {string|undefined} reason - terminal reason from the event payload
 * @param {unknown} candidate - raw envelope candidate
 * @returns {Readonly<object>|null}
 */
function resolveTerminalErrorForReason(reason, candidate) {
  if (reason !== TERMINAL_ERROR_REASON) return null;
  return validateTurnTerminalError(candidate);
}

module.exports = {
  TERMINAL_ERROR_REASON,
  MAX_DIAGNOSTIC_ID_LENGTH,
  TURN_TERMINAL_ERROR_CODES,
  TURN_TERMINAL_ERROR_KINDS,
  TURN_TERMINAL_ERROR_CATALOG,
  normalizeTurnTerminalError,
  validateTurnTerminalError,
  resolveTerminalErrorForReason,
};
