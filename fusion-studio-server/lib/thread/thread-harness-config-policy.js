'use strict';

const PORTABLE_HARNESS_CONFIG_KEYS = Object.freeze(['model', 'variant']);
const MAX_SELECTION_BYTES = 128;
const OPEN_ASSISTANT_REQUEST_KEYS = new Set([
  'type', 'threadId', 'threadGroupId', 'viewId', 'requestId',
  'name', 'scope', 'harnessId', 'harnessConfig',
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
  // resume. Fork has been removed from the product before group activation, so
  // only a plain provider session binding is eligible for activation.
  if (harnessId === 'opencode') {
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

function boundedSelection(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && Buffer.byteLength(value.trim(), 'utf8') <= MAX_SELECTION_BYTES
    ? value.trim()
    : null;
}

/**
 * Validate a portable `{model, variant}` selection against the current
 * server-owned model policy (`set_harness_selection`, `SPEC-01 §8.2`). The
 * caller supplies the policy's model catalog for the session's server-owned
 * harness; a client-supplied catalog is never accepted. `variant: null` means
 * no explicit variant. An unknown model, an unknown variant, or an absent
 * catalog is rejected so the prior authoritative value is preserved.
 *
 * @param {{ models: object|null, model: unknown, variant: unknown }} input
 * @returns {{ ok: true, model: string, variant: string|null }
 *          | { ok: false, code: 'invalid_selection' }}
 */
function validatePortableSelection({ models, model, variant }) {
  const cleanModel = boundedSelection(model);
  if (!cleanModel) return { ok: false, code: 'invalid_selection' };

  let cleanVariant = null;
  if (variant !== null && variant !== undefined) {
    cleanVariant = boundedSelection(variant);
    if (!cleanVariant) return { ok: false, code: 'invalid_selection' };
  }

  const providers = models && Array.isArray(models.providers) ? models.providers : [];
  const matched = providers
    .flatMap((provider) => (Array.isArray(provider?.models) ? provider.models : []))
    .find((entry) => entry?.id === cleanModel);
  if (!matched) return { ok: false, code: 'invalid_selection' };

  if (cleanVariant !== null) {
    const variants = Array.isArray(matched.variants) ? matched.variants : [];
    if (!variants.includes(cleanVariant)) return { ok: false, code: 'invalid_selection' };
  }
  return { ok: true, model: cleanModel, variant: cleanVariant };
}

module.exports = {
  PORTABLE_HARNESS_CONFIG_KEYS,
  mergeRuntimeHarnessConfig,
  normalizeOpenAssistantRequest,
  normalizePortableHarnessConfig,
  sanitizeRuntimeHarnessConfig,
  validatePortableSelection,
};
