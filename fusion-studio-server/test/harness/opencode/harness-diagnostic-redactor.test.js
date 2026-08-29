/**
 * OpenCode adapter-boundary diagnostic redactor tests (SPEC-03 Slice A / A2).
 *
 * Pins the R5A contract: sensitive-env key families (every alternative,
 * every position), nearby non-sensitive keys staying untouched, the
 * adapter-declared credential key, configured-secret replacement, URL
 * userinfo, token/private-key patterns, $HOME/$WORKSPACE rewriting,
 * control-character removal, per-field byte bounds, the 16-marker cap with
 * overflow, the 24 KiB serialized cap, fail-closed structured-only fallback,
 * and secret-provider degradation.
 */

const {
  redactHarnessDiagnosticDraft,
  SENSITIVE_ENV_KEY_PATTERN,
  ADAPTER_CREDENTIAL_ENV_KEYS,
  TRUNCATION_MARKER_NAMES,
  SHORT_IDENTIFIER_BYTES,
  MESSAGE_PREFIX_BYTES,
  STDERR_TAIL_BYTES,
  MAX_TRUNCATION_MARKERS,
  SERIALIZED_LIMIT_BYTES,
} = require('../../../lib/harness/opencode/harness-diagnostic-redactor');

function baseDraft(overrides = {}) {
  return {
    version: 1,
    harnessId: 'opencode',
    category: 'process_exit',
    exitCode: 1,
    signal: null,
    message: undefined,
    stderrExcerpt: undefined,
    hadRenderableOutput: false,
    hadToolCalls: false,
    truncatedFields: [],
    ...overrides,
  };
}

function defaultOptions(overrides = {}) {
  return {
    getConfiguredSecrets: async () => [],
    homePath: '',
    workspaceRoot: '',
    env: {},
    ...overrides,
  };
}

async function redact(overrides, optionOverrides) {
  return redactHarnessDiagnosticDraft(baseDraft(overrides), defaultOptions(optionOverrides));
}

describe('closed R5A sensitive-environment key policy', () => {
  const VALUE = 'leaky-value-9f8e7d';

  test.each([
    // Every key-family alternative at every position: bare, prefix, suffix, infix.
    ['TOKEN', 'TOKEN'],
    ['TOKEN prefix', 'MY_TOKEN'],
    ['TOKEN suffix', 'TOKEN_X'],
    ['TOKEN infix', 'MY_TOKEN_X'],
    ['SECRET', 'SECRET'],
    ['SECRET infix', 'APP_SECRET_Y'],
    ['PASSWORD', 'PASSWORD'],
    ['PASSWORD infix', 'DB_PASSWORD_Z'],
    ['PASSWD', 'PASSWD'],
    ['PASSWD infix', 'MYSQL_PASSWD_Q'],
    ['API_KEY', 'API_KEY'],
    ['API_KEY infix', 'MY_API_KEY_2'],
    ['APIKEY', 'APIKEY'],
    ['APIKEY infix', 'X_APIKEY_Y'],
    ['PRIVATE_KEY', 'PRIVATE_KEY'],
    ['PRIVATE_KEY infix', 'MY_PRIVATE_KEY_A'],
    ['ACCESS_KEY', 'ACCESS_KEY'],
    ['ACCESS_KEY compound', 'AWS_ACCESS_KEY_ID'],
    ['SESSION', 'SESSION'],
    ['SESSION suffix', 'SESSION_ID'],
    ['COOKIE', 'COOKIE'],
    ['COOKIE infix', 'BROWSER_COOKIE_JAR'],
    ['AUTH', 'AUTH'],
    ['AUTH suffix', 'AUTH_DOMAIN'],
    ['CREDENTIAL', 'CREDENTIAL'],
    ['CREDENTIAL suffix', 'CREDENTIAL_FILE'],
    ['CREDENTIALS', 'CREDENTIALS'],
    ['CREDENTIALS infix', 'GIT_CREDENTIALS_HELPER'],
    ['lower-case key', 'my_token_x'],
    ['mixed-case key', 'Api_Key'],
  ])('replaces the value of sensitive key %s', async (_label, key) => {
    expect(SENSITIVE_ENV_KEY_PATTERN.test(key)).toBe(true);
    const out = await redact(
      { message: `before ${VALUE} after` },
      { env: { [key]: VALUE } },
    );
    expect(out.message).toBe(`before [REDACTED] after`);
    expect(JSON.stringify(out)).not.toContain(VALUE);
  });

  test.each([
    ['boundary-safe TOKEN word', 'TOKENTRACKER'],
    ['non-boundary AUTH word', 'OAUTH_PROVIDER'],
    ['plain tool keys', 'HOME'],
    ['editor key', 'EDITOR'],
    ['unrelated long key', 'KEYSTONE_ROLE'],
    ['seasonal near-miss', 'SEASONAL_MODE'],
    ['cooking near-miss', 'COOKING_TIME'],
  ])('does NOT treat non-sensitive neighbor %s as secret solely for being in env', async (_label, key) => {
    expect(SENSITIVE_ENV_KEY_PATTERN.test(key)).toBe(false);
    const out = await redact(
      { message: `kept ${VALUE} end` },
      { env: { [key]: VALUE } },
    );
    expect(out.message).toBe(`kept ${VALUE} end`);
  });

  it('ignores empty and non-string environment values', async () => {
    const out = await redact(
      { message: 'untouched' },
      { env: { EMPTY_TOKEN: '', NULL_SECRET: null, NUM_API_KEY: 42, VALID: undefined } },
    );
    expect(out.message).toBe('untouched');
  });
});

describe('adapter-declared credential keys', () => {
  it('declares OPENCODE_PATH (the credential env key the adapter reads)', () => {
    expect(ADAPTER_CREDENTIAL_ENV_KEYS).toEqual(['OPENCODE_PATH']);
  });

  it('replaces OPENCODE_PATH values without matching the closed policy', async () => {
    expect(SENSITIVE_ENV_KEY_PATTERN.test('OPENCODE_PATH')).toBe(false);
    const out = await redact(
      { message: `binary at ${'oc-bin-priv-1234'} end` },
      { env: { OPENCODE_PATH: 'oc-bin-priv-1234' } },
    );
    expect(out.message).toBe('binary at [REDACTED] end');
  });
});

describe('configured-secret replacement', () => {
  it('replaces exact configured secret values before pattern redaction', async () => {
    const secret = 'sk-live-configured-secret-777';
    const configured = `prefix-${secret}`;
    const out = await redact(
      { message: `using ${configured}`, stderrExcerpt: `trace: ${configured}\ntail` },
      { getConfiguredSecrets: async () => [configured] },
    );
    expect(out.message).toBe('using [REDACTED]');
    expect(out.stderrExcerpt).toContain('[REDACTED]');
    expect(JSON.stringify(out)).not.toContain(secret);
  });

  it('replaces the longest overlapping secret first', async () => {
    const out = await redact(
      { message: 'aaa111bbb' },
      { getConfiguredSecrets: async () => ['aa111b', 'aaa111bbb'] },
    );
    expect(out.message).toBe('[REDACTED]');
  });
});

describe('free-form pattern and path redaction', () => {
  it('redacts URL userinfo', async () => {
    const out = await redact({ message: 'see https://alice:hunter2@example.com/path now' });
    expect(out.message).toBe('see https://[REDACTED]@example.com/path now');
  });

  it('redacts bearer/basic schemes', async () => {
    const out = await redact({ message: 'Authorization: Bearer abc123.def456_GHI789 end' });
    // The bearer rule strips the token first; the leftover "Authorization:"
    // assignment is then neutralized by the kv rule (documented stacking).
    expect(out.message).toBe('Authorization=[REDACTED] [REDACTED] end');
    expect(JSON.stringify(out)).not.toContain('abc123.def456_GHI789');
  });

  it('redacts key/token kv assignments', async () => {
    const out = await redact({ message: 'api_key=abcd1234wxyz and token=zzzz9999yyyy done' });
    expect(out.message).toBe('api_key=[REDACTED] and token=[REDACTED] done');
  });

  it('redacts PEM private-key blocks', async () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\nmore\n-----END PRIVATE KEY-----';
    const out = await redact({ stderrExcerpt: `before ${pem} after` });
    expect(out.stderrExcerpt).toContain('[REDACTED_PRIVATE_KEY]');
    expect(out.stderrExcerpt).not.toContain('MIIEvQIBADANBg');
  });

  it('rewrites user-home and project-root prefixes to $HOME/$WORKSPACE', async () => {
    const out = await redact(
      { message: '/Users/tester/projects/demo/src/app.js failed under /Users/tester/.zshrc' },
      { homePath: '/Users/tester', workspaceRoot: '/Users/tester/projects/demo' },
    );
    expect(out.message).toBe('$WORKSPACE/src/app.js failed under $HOME/.zshrc');
  });

  it('strips disallowed control characters (documented choice: newlines kept, tab to space)', async () => {
    // a b c TAB d CR e LF f  →  tab normalizes to space, CR to newline,
    // the newline is preserved for readability.
    const out = await redact({ message: 'abc\td\re\nf' });
    expect(out.message).toBe('abc d\ne\nf');
  });
});

describe('bounds and truncation markers', () => {
  it('bounds short identifiers to 128 UTF-8 bytes and records the marker', async () => {
    const longId = 'x'.repeat(SHORT_IDENTIFIER_BYTES + 72);
    const out = await redact({ harnessId: longId });
    expect(Buffer.byteLength(out.harnessId, 'utf8')).toBeLessThanOrEqual(SHORT_IDENTIFIER_BYTES);
    expect(out.truncatedFields).toContain('harnessId');
  });

  it('keeps multibyte characters intact while bounding identifiers', async () => {
    const multibyte = 'é'.repeat(80); // 160 UTF-8 bytes
    const out = await redact({ modelId: multibyte });
    expect(Buffer.byteLength(out.modelId, 'utf8')).toBeLessThanOrEqual(SHORT_IDENTIFIER_BYTES);
    expect(out.modelId.length).toBeLessThanOrEqual(79);
    expect(out.modelId.endsWith('é')).toBe(true);
  });

  it('keeps the 4 KiB message PREFIX and records the marker', async () => {
    const big = Array.from({ length: 10000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');
    const out = await redact({ message: big });
    expect(Buffer.byteLength(out.message, 'utf8')).toBeLessThanOrEqual(MESSAGE_PREFIX_BYTES);
    expect(out.message.startsWith(big.slice(0, 100))).toBe(true);
    expect(out.truncatedFields).toContain('message');
  });

  it('keeps the 16 KiB stderr TAIL and records the marker', async () => {
    const head = 'head-';
    const big = head + 'y'.repeat(STDERR_TAIL_BYTES + 5000);
    const out = await redact({ stderrExcerpt: big });
    expect(Buffer.byteLength(out.stderrExcerpt, 'utf8')).toBeLessThanOrEqual(STDERR_TAIL_BYTES);
    expect(out.stderrExcerpt.endsWith(big.slice(-64))).toBe(true);
    expect(out.stderrExcerpt.includes(head)).toBe(false);
    expect(out.truncatedFields).toContain('stderrExcerpt');
  });

  it('never records more than 16 fixed-name truncation markers, including overflow seeds', async () => {
    // Seed with 16 entries (duplicates included) to force overflow handling;
    // the recorder dedupes fixed names and hard-caps at 16.
    const seed = TRUNCATION_MARKER_NAMES.concat(TRUNCATION_MARKER_NAMES).slice(0, MAX_TRUNCATION_MARKERS + 4);
    const out = await redact({
      truncatedFields: [...seed],
      message: 'm'.repeat(MESSAGE_PREFIX_BYTES + 300),
      stderrExcerpt: 's'.repeat(STDERR_TAIL_BYTES + 300),
      modelId: 'k'.repeat(SHORT_IDENTIFIER_BYTES + 5),
      signal: 'g'.repeat(SHORT_IDENTIFIER_BYTES + 5),
    });
    expect(out.truncatedFields.length).toBeLessThanOrEqual(MAX_TRUNCATION_MARKERS);
    expect(out.truncatedFields.every((name) => TRUNCATION_MARKER_NAMES.includes(name))).toBe(true);
    expect(new Set(out.truncatedFields).size).toBe(out.truncatedFields.length);
    // Every forced truncation is still honestly represented.
    for (const name of ['message', 'stderrExcerpt', 'modelId', 'signal']) {
      expect(out.truncatedFields).toContain(name);
    }
  });

  it('enforces the 24 KiB serialized cap by progressive free-form truncation', async () => {
    const out = await redact({ stderrExcerpt: '"'.repeat(STDERR_TAIL_BYTES + 4000) });
    const serialized = JSON.stringify(out);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeLessThanOrEqual(SERIALIZED_LIMIT_BYTES);
    expect(out.stderrExcerpt.length).toBeGreaterThan(0);
    expect(out.truncatedFields).toContain('stderrExcerpt');
  });

  it('drops empty free-form text instead of emitting blank fields', async () => {
    const out = await redact({ message: '' }, {});
    expect(out.message).toBeUndefined();
    expect(out.truncatedFields).toEqual([]);
  });
});

describe('fail-closed and provider degradation', () => {
  it('returns structured-only output when a redaction step throws', async () => {
    const poisonedEnv = {};
    Object.defineProperty(poisonedEnv, 'BOOM_TOKEN', {
      enumerable: true,
      get() {
        throw new Error('env scan exploded');
      },
    });
    const out = await redactHarnessDiagnosticDraft(
      baseDraft({
        message: 'free text',
        stderrExcerpt: 'tail',
        modelId: 'model-x',
      }),
      defaultOptions({ env: poisonedEnv }),
    );
    expect(out.message).toBeUndefined();
    expect(out.stderrExcerpt).toBeUndefined();
    expect(out.modelId).toBe('model-x');
    expect(out.harnessId).toBe('opencode');
    expect(out.category).toBe('process_exit');
    expect(out.truncatedFields).toEqual(['message', 'stderrExcerpt']);
  });

  it('degrades a failing secret provider to an empty list and continues', async () => {
    const out = await redact(
      { message: 'still redacted https://u:p@host.dev/x', stderrExcerpt: 'tail kept' },
      { getConfiguredSecrets: async () => { throw new Error('keychain locked'); } },
    );
    expect(out.message).toBe('still redacted https://[REDACTED]@host.dev/x');
    expect(out.stderrExcerpt).toBe('tail kept');
  });

  it('is deterministic apart from the injected provider', async () => {
    const first = await redact({ message: 'same in' }, { homePath: '/h', workspaceRoot: '/w' });
    const second = await redact({ message: 'same in' }, { homePath: '/h', workspaceRoot: '/w' });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('never mutates the caller draft or options.env', async () => {
    const draft = baseDraft({ message: 'm', stderrExcerpt: 's' });
    const env = { SAFE_KEY: 'v' };
    await redactHarnessDiagnosticDraft(draft, defaultOptions({ env }));
    expect(draft.message).toBe('m');
    expect(env).toEqual({ SAFE_KEY: 'v' });
  });
});
