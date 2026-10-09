/**
 * Feature flag system for harness migration.
 *
 * Priority (highest to lowest):
 * 1. Per-thread override (in-memory Map)
 * 2. Global session override
 * 3. Environment variable HARNESS_MODE
 * 4. Default: 'new'
 *
 * @see ../specs/PHASE-2-COMPATIBILITY-LAYER-SPEC.md
 */

/** @typedef {'new'} HarnessMode */

/** @type {HarnessMode[]} */
const VALID_MODES = ['new'];

/**
 * Available harness implementations
 * @type {Array<{id: string, name: string, provider: string}>}
 */
const HARNESS_OPTIONS = [
  { id: 'kimi', name: 'KIMI CLI', provider: 'kimi' },       // External CLI
];

// Per-thread overrides (highest priority)
/** @type {Map<string, HarnessMode>} */
const threadOverrides = new Map();

// Current session override (for testing)
/** @type {HarnessMode | null} */
let globalOverride = null;

/**
 * Check if a mode string is valid.
 * @param {string} mode
 * @returns {mode is HarnessMode}
 */
function isValidMode(mode) {
  return VALID_MODES.includes(mode);
}

/**
 * Get the effective harness mode for a thread.
 * @param {string} [threadId]
 * @returns {HarnessMode}
 */
function getHarnessMode(threadId) {
  // 1. Check thread override
  if (threadId && threadOverrides.has(threadId)) {
    return threadOverrides.get(threadId);
  }

  // 2. Check global session override
  if (globalOverride) {
    return globalOverride;
  }

  // 3. Check environment variable
  const envMode = process.env.HARNESS_MODE;
  if (envMode && isValidMode(envMode)) {
    return envMode;
  }

  // 4. Default to new (direct harness path)
  return 'new';
}

/**
 * Set mode for a specific thread (runtime override).
 * @param {string} threadId
 * @param {HarnessMode} mode
 */
function setThreadMode(threadId, mode) {
  if (!isValidMode(mode)) {
    throw new Error(`Invalid harness mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`);
  }
  threadOverrides.set(threadId, mode);
  console.log(`[FeatureFlags] Set thread ${threadId.slice(0, 8)}... to mode: ${mode}`);
}

/**
 * Clear thread mode override.
 * @param {string} threadId
 */
function clearThreadMode(threadId) {
  threadOverrides.delete(threadId);
  console.log(`[FeatureFlags] Cleared mode override for thread ${threadId.slice(0, 8)}...`);
}

/**
 * Set global mode override for this process.
 * @param {HarnessMode | null} mode
 */
function setGlobalMode(mode) {
  if (mode !== null && !isValidMode(mode)) {
    throw new Error(`Invalid harness mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}`);
  }
  globalOverride = mode;
  console.log(`[FeatureFlags] Set global mode to: ${mode}`);
}

/**
 * Check if we should use the new harness for a thread.
 * Always true — legacy and parallel modes have been retired.
 * @param {string} [threadId]
 * @returns {boolean}
 */
function shouldUseNewHarness(threadId) {
  return true;
}

/**
 * Check if we're in parallel comparison mode.
 * Always false — parallel mode has been retired.
 * @param {string} [threadId]
 * @returns {boolean}
 */
function isParallelMode(threadId) {
  return false;
}

/**
 * Get all feature flag values for debugging.
 * @returns {{
 *   globalOverride: HarnessMode | null;
 *   threadOverrides: Record<string, HarnessMode>;
 *   environment: string | undefined;
 *   effectiveMode: HarnessMode;
 * }}
 */
function getFlagStatus() {
  return {
    globalOverride,
    threadOverrides: Object.fromEntries(threadOverrides),
    environment: process.env.HARNESS_MODE,
    effectiveMode: getHarnessMode()
  };
}

/**
 * Reset all overrides (useful for testing).
 */
function resetOverrides() {
  threadOverrides.clear();
  globalOverride = null;
  console.log('[FeatureFlags] All overrides reset');
}

module.exports = {
  getHarnessMode,
  setThreadMode,
  clearThreadMode,
  setGlobalMode,
  shouldUseNewHarness,
  isParallelMode,
  getFlagStatus,
  resetOverrides,
  HARNESS_OPTIONS,
  // Export types for JSDoc
  /** @type {HarnessMode} */ HarnessMode: null
};
