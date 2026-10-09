/**
 * Fingerprint for an API key value.
 * Width-uniform: 12 dots + last 4 chars regardless of value length.
 * Dot character is U+2022 (BULLET).
 * See SECRETS_MANAGER_SPEC.md §5c.
 */

const DOTS = '••••••••••••';

function compute(value) {
  if (typeof value !== 'string' || value.length < 4) {
    throw new Error('fingerprint requires a string of length >= 4');
  }
  return DOTS + value.slice(-4);
}

module.exports = { compute };
