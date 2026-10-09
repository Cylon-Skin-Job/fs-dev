/**
 * @module harness/errors
 * @role Provider-neutral HarnessRuntimeError marker + closed diagnostic
 *       candidate shape (RCC-0108 SPEC-03 Slice A; parent §4.13/§4.13.1).
 *
 * Shared runtime code checks ONLY a genuine marker via isHarnessRuntimeError()
 * and reads its fixed `code`. Classification of native provider failures into
 * these markers happens exclusively inside owning harness adapter boundaries,
 * which construct real instances of this class. By contract this module
 * contains zero parsing/regEx over error names, messages, or codes — only
 * structural type validation of the closed candidate fields.
 */

/**
 * Closed internal code union. Exactly these three markers may produce a
 * specific terminal catalog result (SPEC-03 §2).
 */
const HARNESS_RUNTIME_ERROR_CODES = Object.freeze([
  'HARNESS_AUTHENTICATION_FAILED',
  'HARNESS_MODEL_TIMEOUT',
  'HARNESS_PROCESS_EXIT',
]);

/**
 * Fixed provider-neutral internal messages per code. These constants are
 * never interpolated with exception, provider, stderr, or path text.
 */
const HARNESS_RUNTIME_ERROR_MESSAGES = Object.freeze({
  HARNESS_AUTHENTICATION_FAILED: 'Harness authentication failed',
  HARNESS_MODEL_TIMEOUT: 'The model response timed out',
  HARNESS_PROCESS_EXIT: 'The harness process ended before the response completed',
});

/** Closed diagnostic candidate category union (HarnessDiagnosticCandidateV1). */
const HARNESS_DIAGNOSTIC_CATEGORIES = Object.freeze([
  'authentication',
  'timeout',
  'process_exit',
  'runtime',
]);

const CANDIDATE_VERSION = 1;

/**
 * Module-scoped hidden brand. Only instances actually constructed by THIS
 * class receive it, so `{ code: 'HARNESS_AUTHENTICATION_FAILED' }`-shaped
 * plain errors, prototype lookalikes, and foreign Error subclasses that never
 * ran this constructor all fail the genuine-marker check. The brand is
 * non-enumerable so it never leaks into serialization or logs.
 */
const GENUINE_MARKER_BRAND = Symbol('HarnessRuntimeErrorGenuineMarker');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function keepOptionalString(value) {
  return isNonEmptyString(value) ? value : undefined;
}

/**
 * Defensively enforce the closed HarnessDiagnosticCandidateV1 shape.
 * Unknown keys are discarded (never copied); optional fields with invalid
 * types are dropped; a draft missing any required field is rejected whole
 * (the marker is then thrown without a candidate rather than blocking the
 * failure publication path).
 */
function sanitizeDiagnosticCandidate(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return undefined;
  if (draft.version !== CANDIDATE_VERSION) return undefined;
  if (!isNonEmptyString(draft.harnessId)) return undefined;
  if (!HARNESS_DIAGNOSTIC_CATEGORIES.includes(draft.category)) return undefined;
  if (typeof draft.hadRenderableOutput !== 'boolean') return undefined;
  if (typeof draft.hadToolCalls !== 'boolean') return undefined;
  if (!Array.isArray(draft.truncatedFields)) return undefined;
  if (!draft.truncatedFields.every((entry) => typeof entry === 'string')) return undefined;

  const candidate = {
    version: CANDIDATE_VERSION,
    harnessId: draft.harnessId,
    category: draft.category,
    hadRenderableOutput: draft.hadRenderableOutput,
    hadToolCalls: draft.hadToolCalls,
    truncatedFields: Object.freeze([...draft.truncatedFields]),
  };

  const optionalStrings = [
    'modelId',
    'providerCode',
    'errorName',
    'signal',
    'message',
    'stderrExcerpt',
    'lastCanonicalEventType',
  ];
  for (const field of optionalStrings) {
    const value = keepOptionalString(draft[field]);
    if (value !== undefined) candidate[field] = value;
  }

  if (typeof draft.exitCode === 'number' && Number.isFinite(draft.exitCode)) {
    candidate.exitCode = draft.exitCode;
  }

  return Object.freeze(candidate);
}

class HarnessRuntimeError extends Error {
  /**
   * @param {typeof HARNESS_RUNTIME_ERROR_CODES[number]} code
   * @param {object} [candidateDraft] already-redacted HarnessDiagnosticCandidateV1
   *        draft produced inside an adapter boundary. Invalid drafts are
   *        discarded; they never throw and never widen the shape.
   */
  constructor(code, candidateDraft) {
    const fixedMessage = HARNESS_RUNTIME_ERROR_MESSAGES[code];
    if (!fixedMessage) {
      throw new TypeError(
        `Unknown HarnessRuntimeError code: ${String(code)}. Allowed codes: ${HARNESS_RUNTIME_ERROR_CODES.join(', ')}`,
      );
    }
    super(fixedMessage);
    this.name = 'HarnessRuntimeError';
    this.code = code;
    this.candidate = sanitizeDiagnosticCandidate(candidateDraft);
    Object.defineProperty(this, GENUINE_MARKER_BRAND, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

/**
 * Genuine marker check. True only for real instances constructed by this
 * class (directly or through a subclass that ran this constructor). Never
 * inspects code/name/message strings, so lookalike-shaped plain objects and
 * foreign error classes are rejected.
 */
function isHarnessRuntimeError(value) {
  return value instanceof HarnessRuntimeError && value[GENUINE_MARKER_BRAND] === true;
}

module.exports = {
  HarnessRuntimeError,
  isHarnessRuntimeError,
  HARNESS_RUNTIME_ERROR_CODES,
  HARNESS_RUNTIME_ERROR_MESSAGES,
  HARNESS_DIAGNOSTIC_CATEGORIES,
};
