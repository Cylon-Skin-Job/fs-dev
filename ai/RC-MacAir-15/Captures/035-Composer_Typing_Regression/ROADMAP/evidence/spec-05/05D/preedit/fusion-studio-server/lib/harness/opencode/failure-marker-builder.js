/**
 * @module opencode/failure-marker-builder
 * @role Translate native OpenCode failure signals into provider-neutral
 *        HarnessRuntimeError markers carrying an already-redacted diagnostic
 *        candidate (RCC-0108 SPEC-03 Slice A; parent §4.13).
 *
 * This file is INSIDE the OpenCode adapter boundary. It is the only place in
 * this slice where native protocol codes (-32004) and provider failure text
 * are inspected, solely to SELECT one of three markers. Selected provider
 * text never leaves except through the redactor as bounded free-form fields.
 */

const { HarnessRuntimeError } = require('../errors');
const { redactHarnessDiagnosticDraft } = require('./harness-diagnostic-redactor');

const CATEGORY_TO_CODE = Object.freeze({
  authentication: 'HARNESS_AUTHENTICATION_FAILED',
  timeout: 'HARNESS_MODEL_TIMEOUT',
  process_exit: 'HARNESS_PROCESS_EXIT',
});

/**
 * Provider authentication-failure text observed in captured stderr/process
 * output. Bounded vocabulary chosen from common provider CLI auth failures.
 */
const AUTHENTICATION_FAILURE_PATTERN = new RegExp(
  [
    'authentication failed',
    'authentication error',
    'invalid api key',
    'incorrect api key',
    'api key .*(invalid|expired|missing|not valid)',
    'unauthorized',
    'bad credentials',
    'login required',
    '401 unauthorized',
  ].join('|'),
  'i',
);

/**
 * Model-timeout signal text observed in captured stderr/process output.
 * Conservative: matches explicit provider/CLI timeout reports only.
 */
const TIMEOUT_SIGNAL_PATTERN = /(timed?\s*out|\betimedout\b|deadline\s+exceeded)/i;

/**
 * Select a marker category from native OpenCode signals. Order matters:
 * authentication first, then timeout, then generic process exit — because
 * auth and timeout failures typically surface as non-zero exits too.
 */
function classifyNativeFailure({ nativeAuthFailure, stderr }) {
  if (nativeAuthFailure) return 'authentication';
  const capturedText = typeof stderr === 'string' ? stderr : '';
  if (AUTHENTICATION_FAILURE_PATTERN.test(capturedText)) return 'authentication';
  if (TIMEOUT_SIGNAL_PATTERN.test(capturedText)) return 'timeout';
  return 'process_exit';
}

function firstLineOf(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return undefined;
  const newlineIndex = trimmed.indexOf('\n');
  const line = newlineIndex === -1 ? trimmed : trimmed.slice(0, newlineIndex);
  return line.trim() || undefined;
}

/**
 * Build a genuine HarnessRuntimeError for a native OpenCode failure.
 * The thrown message is the fixed provider-neutral internal text; raw stderr
 * survives ONLY inside the redacted candidate.
 *
 * @param {object} input
 * @param {boolean} [input.nativeAuthFailure] adapter observed -32004
 * @param {string} [input.stderr] captured stderr/process output
 * @param {number} [input.exitCode]
 * @param {string} [input.signal]
 * @param {string} [input.harnessId]
 * @param {string} [input.workspaceRoot] project root for $WORKSPACE rewrite
 * @param {string} [input.homePath] user home for $HOME rewrite
 * @param {object} [input.envSnapshot] env supplied by the adapter at spawn
 * @param {string} [input.lastCanonicalEventType]
 * @param {boolean} [input.hadRenderableOutput]
 * @param {boolean} [input.hadToolCalls]
 * @param {() => Promise<string[]>} [input.getConfiguredSecrets]
 * @returns {Promise<HarnessRuntimeError>}
 */
async function buildHarnessFailureMarker(input = {}) {
  const category = classifyNativeFailure(input);
  const stderr = typeof input.stderr === 'string' ? input.stderr : '';

  const draft = {
    version: 1,
    harnessId: typeof input.harnessId === 'string' && input.harnessId ? input.harnessId : 'opencode',
    category,
    providerCode: input.nativeAuthFailure ? '-32004' : undefined,
    exitCode: Number.isFinite(input.exitCode) ? input.exitCode : undefined,
    signal: typeof input.signal === 'string' && input.signal ? input.signal : undefined,
    message: firstLineOf(stderr),
    stderrExcerpt: stderr.trim() ? stderr : undefined,
    lastCanonicalEventType:
      typeof input.lastCanonicalEventType === 'string' && input.lastCanonicalEventType
        ? input.lastCanonicalEventType
        : undefined,
    hadRenderableOutput: input.hadRenderableOutput === true,
    hadToolCalls: input.hadToolCalls === true,
    truncatedFields: [],
  };

  let candidate;
  try {
    candidate = await redactHarnessDiagnosticDraft(draft, {
      getConfiguredSecrets: input.getConfiguredSecrets,
      env: input.envSnapshot,
      homePath: input.homePath,
      workspaceRoot: input.workspaceRoot,
    });
  } catch {
    // The redactor fails closed internally; this guard additionally keeps
    // candidate construction unable to block marker publication.
    candidate = undefined;
  }

  return new HarnessRuntimeError(CATEGORY_TO_CODE[category], candidate);
}

module.exports = {
  buildHarnessFailureMarker,
  classifyNativeFailure,
};
