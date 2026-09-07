'use strict';

const PORTABLE_HARNESS_CONFIG_KEYS = Object.freeze(['model', 'variant']);
const OPEN_ASSISTANT_REQUEST_KEYS = new Set([
  'type', 'threadId', 'name', 'scope', 'harnessId', 'harnessConfig',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function portableValue(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function normalizePortableHarnessConfig(value) {
  if (value === undefined) return { ok: true, value: undefined };
  if (!isRecord(value)) return { ok: false, value: undefined };
  if (Object.keys(value).some((key) => !PORTABLE_HARNESS_CONFIG_KEYS.includes(key))) {
    return { ok: false, value: undefined };
  }

  const normalized = {};
  for (const key of PORTABLE_HARNESS_CONFIG_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    if (key === 'variant' && value[key] === null) {
      normalized[key] = null;
      continue;
    }
    const portable = portableValue(value[key]);
    if (!portable) return { ok: false, value: undefined };
    normalized[key] = portable;
  }
  return { ok: true, value: Object.freeze(normalized) };
}

function normalizeOpenAssistantRequest(value) {
  if (!isRecord(value) || value.type !== 'thread:open-assistant') return null;
  if (Object.keys(value).some((key) => !OPEN_ASSISTANT_REQUEST_KEYS.has(key))) return null;

  const harnessConfig = normalizePortableHarnessConfig(value.harnessConfig);
  if (!harnessConfig.ok) return null;
  return Object.freeze({
    ...value,
    ...(harnessConfig.value === undefined ? {} : { harnessConfig: harnessConfig.value }),
  });
}

function sanitizeRuntimeHarnessConfig(harnessId, value) {
  if (!isRecord(value)) return Object.freeze({});
  const result = {};
  for (const key of PORTABLE_HARNESS_CONFIG_KEYS) {
    if (key === 'variant'
      && Object.prototype.hasOwnProperty.call(value, key)
      && value[key] === null) {
      result[key] = null;
      continue;
    }
    const portable = portableValue(value[key]);
    if (portable) result[key] = portable;
  }

  // An ordinary OpenCode session identifier is required for exact provider
  // resume. Any Fork-era marker makes the whole provider-session binding
  // legacy and therefore ineligible for activation.
  const hasForkState = Object.prototype.hasOwnProperty.call(value, 'pendingFork')
    || Object.prototype.hasOwnProperty.call(value, 'forkProvenance');
  if (harnessId === 'opencode' && !hasForkState) {
    const sessionId = portableValue(value.opencodeSessionId);
    if (sessionId) result.opencodeSessionId = sessionId;
  }
  return Object.freeze(result);
}

function mergeRuntimeHarnessConfig(harnessId, current, patch) {
  return sanitizeRuntimeHarnessConfig(harnessId, {
    ...sanitizeRuntimeHarnessConfig(harnessId, current),
    ...(isRecord(patch) ? patch : {}),
  });
}

module.exports = {
  PORTABLE_HARNESS_CONFIG_KEYS,
  mergeRuntimeHarnessConfig,
  normalizeOpenAssistantRequest,
  normalizePortableHarnessConfig,
  sanitizeRuntimeHarnessConfig,
};
