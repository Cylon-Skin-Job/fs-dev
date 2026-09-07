'use strict';

/**
 * Environment policy for every production harness/CLI child. The common set
 * covers process discovery, user config roots, locale, temporary files,
 * certificates, and explicitly configured network proxies. Provider secrets
 * are allowed only for the adapter families that consume them.
 */
const COMMON_KEYS = Object.freeze([
  'HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL',
  'TMPDIR', 'TEMP', 'TMP',
  'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM', 'COLORTERM',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME',
  'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
]);

const ADAPTER_KEYS = Object.freeze({
  locator: Object.freeze([]),
  probe: Object.freeze([]),
  runner: Object.freeze(['KIMI_PATH', 'KIMI_API_KEY', 'ANTHROPIC_API_KEY']),
  kimi: Object.freeze(['KIMI_PATH', 'KIMI_API_KEY', 'ANTHROPIC_API_KEY']),
  opencode: Object.freeze([
    'OPENCODE_PATH', 'OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR',
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN',
    'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION',
  ]),
  codex: Object.freeze(['CODEX_HOME', 'OPENAI_API_KEY']),
  'claude-code': Object.freeze(['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']),
  gemini: Object.freeze(['GOOGLE_API_KEY', 'GEMINI_API_KEY']),
  qwen: Object.freeze(['QWEN_API_KEY', 'DASHSCOPE_API_KEY']),
});

function isAllowedValue(value) {
  return typeof value === 'string' && value.length > 0;
}

function buildHarnessChildEnvironment(adapter, options = {}) {
  const adapterKeys = ADAPTER_KEYS[adapter];
  if (!adapterKeys) throw new TypeError('Unknown harness child environment family');
  const source = options.source || process.env;
  const overrides = options.overrides || {};
  const allowed = new Set([...COMMON_KEYS, ...adapterKeys]);
  const result = {};

  for (const key of allowed) {
    const value = Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : source[key];
    if (isAllowedValue(value)) result[key] = value;
  }

  return Object.freeze(result);
}

module.exports = {
  ADAPTER_KEYS,
  COMMON_KEYS,
  buildHarnessChildEnvironment,
};
