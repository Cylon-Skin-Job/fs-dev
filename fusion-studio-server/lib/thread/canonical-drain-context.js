/**
 * @module canonical-drain-context
 * @role Immutable prompt-bound route context + non-serializable drain control.
 *
 * SPEC-01 Slice B (RCC-0108): every accepted prompt (interactive WebSocket or
 * headless automation) is bound to one deeply copied, recursively frozen
 * CanonicalRouteContext (parent contract §4.6) and one CanonicalDrainControl
 * capability that closes over the exact thread runtime / harness session that
 * accepted the prompt.
 *
 * Serialization rules:
 * - The route context is plain data and is safe to serialize.
 * - The drain control closes over callables and must NEVER be serialized into
 *   snapshots or wire messages. JSON.stringify drops its callback properties,
 *   but consumers must not rely on that accident.
 *
 * Freezing scope (documented smallest-correct choice): deep copy/freeze
 * recurses through plain objects and arrays and passes primitives through.
 * Function and symbol VALUES are out of scope for copying/freezing and are
 * passed through by reference; symbol KEYS are skipped during copying.
 */

const DEFAULT_ATTACHMENT_KIND = 'file';
const DEFAULT_ATTACHMENT_LABEL = 'attachment';

/**
 * Defensively normalize client-supplied attachments into the accepted prompt
 * shape. Mirrors the historical thread-runtime-controller behavior exactly so
 * the interactive and automation paths feed identical attachment shapes.
 * Items without a usable path are dropped.
 */
function normalizeRouteAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      kind: typeof item.kind === 'string' ? item.kind : DEFAULT_ATTACHMENT_KIND,
      label: typeof item.label === 'string' ? item.label : DEFAULT_ATTACHMENT_LABEL,
      path: typeof item.path === 'string' ? item.path : '',
      sourceName: typeof item.sourceName === 'string'
        ? item.sourceName
        : (typeof item.label === 'string' ? item.label : DEFAULT_ATTACHMENT_LABEL),
      ...(typeof item.panel === 'string' ? { panel: item.panel } : {}),
      ...(typeof item.relativePath === 'string' ? { relativePath: item.relativePath } : {}),
    }))
    .filter((item) => item.path);
}

/**
 * Deep-copy supported plain-data shapes. Plain objects and arrays are
 * recursed into fresh structures; primitives are returned as-is.
 */
function deepCopyPlainData(value) {
  if (Array.isArray(value)) {
    return value.map(deepCopyPlainData);
  }
  if (value && typeof value === 'object') {
    const copy = {};
    for (const entry of Object.entries(value)) {
      copy[entry[0]] = deepCopyPlainData(entry[1]);
    }
    return copy;
  }
  return value;
}

/**
 * Recursively freeze supported plain-data shapes. Returns the frozen value.
 * Primitives (and out-of-scope function/symbol values) pass through.
 */
function deepFreezePlainData(value) {
  if (Array.isArray(value)) {
    for (const item of value) deepFreezePlainData(item);
    return Object.freeze(value);
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreezePlainData(entry);
    return Object.freeze(value);
  }
  return value;
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Canonical route context requires a non-empty string ${fieldName}`);
  }
}

/**
 * Create the immutable CanonicalRouteContext for one accepted prompt.
 *
 * @param {object} params
 * @param {string} params.workspaceId - owning workspace id (required)
 * @param {string} params.workspace - resolved workspace string (required)
 * @param {string} params.projectRoot - project root path (required)
 * @param {string} params.scope - must be 'project' (RCC-0095)
 * @param {string} params.threadId - accepted thread id (required)
 * @param {string} params.acceptedUserInput - accepted user text (required)
 * @param {Array} [params.attachments] - raw client attachments, normalized
 * @returns {Readonly<CanonicalRouteContext>} deeply copied + frozen context
 */
function createCanonicalRouteContext({
  workspaceId,
  workspace,
  projectRoot,
  scope,
  threadId,
  acceptedUserInput,
  attachments,
}) {
  requireNonEmptyString(workspaceId, 'workspaceId');
  requireNonEmptyString(workspace, 'workspace');
  requireNonEmptyString(projectRoot, 'projectRoot');
  requireNonEmptyString(threadId, 'threadId');
  requireNonEmptyString(acceptedUserInput, 'acceptedUserInput');
  if (scope !== 'project') {
    throw new Error(`Unsupported canonical route scope: ${scope}. Only 'project' is supported.`);
  }

  const context = deepCopyPlainData({
    workspaceId,
    workspace,
    projectRoot,
    scope,
    threadId,
    acceptedUserInput,
    attachments: normalizeRouteAttachments(attachments),
  });
  return deepFreezePlainData(context);
}

/**
 * Create the non-serializable CanonicalDrainControl capability for one drain.
 * The returned object closes over the injected callables; it must be handed
 * only to the runtime owner (never persisted, cloned, or sent on the wire).
 *
 * @param {object} params
 * @param {string} params.drainId - UUID identifying this drain (required)
 * @param {object} params.runtimeKey - structured thread runtime key
 * @param {() => void} params.touchThreadSession - touches the originating lease
 * @param {() => Promise<void>} params.stopHarness - stops only the bound wire
 * @returns {Readonly<CanonicalDrainControl>}
 */
function createCanonicalDrainControl({
  drainId,
  runtimeKey,
  touchThreadSession,
  stopHarness,
}) {
  if (typeof drainId !== 'string' || !drainId) {
    throw new Error('Canonical drain control requires a non-empty string drainId');
  }
  if (!runtimeKey || typeof runtimeKey !== 'object' || Array.isArray(runtimeKey)) {
    throw new Error('Canonical drain control requires a runtimeKey object');
  }
  if (typeof touchThreadSession !== 'function' || typeof stopHarness !== 'function') {
    throw new Error('Canonical drain control requires touchThreadSession and stopHarness callables');
  }

  const control = {
    drainId,
    // Defensive snapshot: later mutation of the caller's key object must not
    // rewrite the control's route identity.
    runtimeKey: deepFreezePlainData({ ...runtimeKey }),
    touchThreadSession() {
      touchThreadSession();
    },
    stopHarness() {
      return stopHarness();
    },
  };
  return Object.freeze(control);
}

module.exports = {
  createCanonicalDrainControl,
  createCanonicalRouteContext,
  normalizeRouteAttachments,
};
