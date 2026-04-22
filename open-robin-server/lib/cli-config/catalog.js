/**
 * Server-side mirror of the client's HARNESS_OPTIONS catalog.
 *
 * Keep in sync with `open-robin-client/src/config/harness.ts`. The `id`,
 * `name`, `materialIcon`, `accentColor`, and `enabled` triples must match.
 *
 * Duplication is accepted short-term (CLI_CONFIG_SPEC §7a, open question §13.2).
 */

const CATALOG = Object.freeze([
  Object.freeze({
    id: 'kimi',
    name: 'KIMI',
    description: 'Moonshot AI — native wire protocol with thinking, context %, and plan mode',
    materialIcon: 'bedtime',
    accentColor: '#00d4ff',
    details: Object.freeze({
      provider: 'moonshot',
      model: 'k2.5',
      features: Object.freeze(['tools', 'streaming', 'thinking', 'plan_mode', 'context_%']),
    }),
    enabled: true,
    recommended: true,
  }),
  Object.freeze({
    id: 'robin',
    name: 'Robin',
    description: 'Built-in Vercel AI SDK — BYOK, works with any OpenAI-compatible provider',
    materialIcon: 'auto_awesome',
    details: Object.freeze({
      provider: 'byok',
      model: 'configurable',
      features: Object.freeze(['tools', 'streaming']),
    }),
    enabled: true,
  }),
  Object.freeze({
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI — thinking blocks, 1M context',
    materialIcon: 'smart_toy',
    accentColor: '#D97757',
    details: Object.freeze({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      features: Object.freeze(['tools', 'streaming', 'thinking']),
    }),
    enabled: true,
  }),
  Object.freeze({
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini CLI — 1M context window',
    materialIcon: 'stars_2',
    accentColor: '#F5DE9B',
    details: Object.freeze({
      provider: 'google',
      model: 'gemini-2.5-pro',
      features: Object.freeze(['tools', 'streaming']),
    }),
    enabled: true,
  }),
  Object.freeze({
    id: 'qwen',
    name: 'Qwen',
    description: 'Alibaba Qwen Code CLI — 256K context with thinking',
    materialIcon: 'diamond_shine',
    accentColor: '#B19CD9',
    details: Object.freeze({
      provider: 'alibaba',
      model: 'qwen3-coder',
      features: Object.freeze(['tools', 'streaming', 'thinking']),
    }),
    enabled: true,
  }),
  Object.freeze({
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex CLI — GPT-5 series agentic coding',
    materialIcon: 'terminal_2',
    accentColor: '#4169E1',
    details: Object.freeze({
      provider: 'openai',
      model: 'gpt-5.3-codex',
      features: Object.freeze(['tools', 'streaming', 'thinking']),
    }),
    enabled: true,
  }),
]);

const CATALOG_BY_ID = Object.freeze(
  CATALOG.reduce((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {}),
);

module.exports = {
  CATALOG,
  CATALOG_BY_ID,
};
