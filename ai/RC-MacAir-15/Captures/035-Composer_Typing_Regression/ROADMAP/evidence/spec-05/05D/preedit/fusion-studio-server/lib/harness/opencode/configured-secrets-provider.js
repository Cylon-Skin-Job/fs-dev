/**
 * @module opencode/configured-secrets-provider
 * @role Real configured-secrets provider for the OpenCode adapter's
 *        diagnostic redaction (RCC-0108 SPEC-03 Slice A §A3).
 *
 * Backed by the existing secrets owner: lib/secrets/api-keys/backend.list()
 * supplies configured key names; the macOS Keychain accessor (lib/secrets)
 * supplies their values via getMany(). Both modules are required lazily
 * INSIDE the provider to avoid import cycles and load-time DB coupling.
 *
 * Failure posture: any error degrades to [] so adapter-boundary redaction
 * continues with an empty configured-secret list (fail-open to pattern and
 * path redaction, never fail-open to leaking).
 */

function createConfiguredSecretsProvider() {
  return async function getConfiguredSecrets() {
    try {
      const backend = require('../../secrets/api-keys/backend');
      const rows = await backend.list();
      const names = (Array.isArray(rows) ? rows : [])
        .map((row) => row?.name)
        .filter((name) => typeof name === 'string' && name.length > 0);
      if (names.length === 0) return [];
      const keychain = require('../../secrets');
      const values = await keychain.getMany(names);
      return Object.values(values || {})
        .filter((value) => typeof value === 'string' && value.length > 0);
    } catch {
      return [];
    }
  };
}

module.exports = { createConfiguredSecretsProvider };
