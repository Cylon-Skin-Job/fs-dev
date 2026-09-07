'use strict';

const { spawnSync } = require('node:child_process');
const {
  ADAPTER_KEYS,
  COMMON_KEYS,
  buildHarnessChildEnvironment,
} = require('../../lib/harness/child-environment');

const FORBIDDEN = Object.freeze({
  FUSION_SHELL_MASTER: 'master-canary',
  FUSION_BOOTSTRAP_FD: '3',
  FUSION_RUNTIME_GENERATION: 'generation-canary',
  SHELL_AUTH_PROOF: 'proof-canary',
  SERVER_CONNECTION_ROLE: 'trusted-shell',
  TEST_INJECTED_AUTHORITY: 'test-authority-canary',
  SPEC00C_UNKNOWN_HOST_VALUE: 'unknown-canary',
});

const CREDENTIAL_KEYS = Object.freeze([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'QWEN_API_KEY',
  'DASHSCOPE_API_KEY',
  'KIMI_API_KEY',
]);

const SOURCE_CREDENTIALS = Object.freeze(Object.fromEntries(
  CREDENTIAL_KEYS.map((key) => [key, `credential-${key.toLowerCase()}`]),
));

test('documents a closed family allowlist', () => {
  expect(Object.keys(ADAPTER_KEYS).sort()).toEqual([
    'claude-code', 'codex', 'gemini', 'kimi', 'locator', 'opencode',
    'probe', 'qwen', 'runner',
  ]);
  expect(COMMON_KEYS).toContain('PATH');
  expect(COMMON_KEYS).toContain('HOME');
  expect(COMMON_KEYS).not.toContain('NODE_OPTIONS');
});

test('unknown families fail closed', () => {
  expect(() => buildHarnessChildEnvironment('unknown')).toThrow('Unknown harness child environment family');
});

for (const [family, allowedKey, expectedCredentials] of [
  ['locator', 'PATH', []],
  ['probe', 'PATH', []],
  ['runner', 'ANTHROPIC_API_KEY', ['ANTHROPIC_API_KEY', 'KIMI_API_KEY']],
  ['kimi', 'ANTHROPIC_API_KEY', ['ANTHROPIC_API_KEY', 'KIMI_API_KEY']],
  ['opencode', 'OPENAI_API_KEY', [
    'ANTHROPIC_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'GEMINI_API_KEY',
    'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY',
  ]],
  ['codex', 'OPENAI_API_KEY', ['OPENAI_API_KEY']],
  ['claude-code', 'ANTHROPIC_API_KEY', ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']],
  ['gemini', 'GEMINI_API_KEY', ['GEMINI_API_KEY', 'GOOGLE_API_KEY']],
  ['qwen', 'QWEN_API_KEY', ['DASHSCOPE_API_KEY', 'QWEN_API_KEY']],
]) {
  test(`${family} child receives only its own allowlisted credentials and no authority/unknown canary`, () => {
    const source = {
      ...process.env,
      ...FORBIDDEN,
      ...SOURCE_CREDENTIALS,
      [allowedKey]: `allowed-${family}`,
    };
    const env = buildHarnessChildEnvironment(family, {
      source,
      overrides: {
        TERM: 'xterm-256color',
        FUSION_SHELL_MASTER: 'override-master-canary',
      },
    });
    const child = spawnSync(process.execPath, ['-e', [
      `process.stdout.write(JSON.stringify({`,
      `allowed: process.env[${JSON.stringify(allowedKey)}],`,
      `term: process.env.TERM,`,
      `credentials: ${JSON.stringify(CREDENTIAL_KEYS)}.filter((key) => process.env[key]).sort(),`,
      `forbidden: Object.keys(process.env).filter((key) => key.includes('FUSION_') || key.includes('AUTHORITY') || key.includes('PROOF') || key.includes('SPEC00C'))`,
      `}))`,
    ].join('')], { encoding: 'utf8', env });

    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      allowed: `allowed-${family}`,
      term: 'xterm-256color',
      credentials: expectedCredentials,
      forbidden: [],
    });
  });
}
