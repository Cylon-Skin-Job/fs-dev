import type { TokenUsage } from '../../types';

const TOKEN_USAGE_FIELDS = [
  'input_other',
  'input_cache_read',
  'input_cache_creation',
  'input_total',
  'output',
  'total',
  'context_pct',
] as const;

export function readTokenUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Record<string, unknown>;
  const usage: TokenUsage = {};
  let hasValue = false;
  for (const field of TOKEN_USAGE_FIELDS) {
    const candidate = source[field];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      usage[field] = candidate;
      hasValue = true;
    }
  }
  return hasValue ? usage : null;
}

export function getContextInputTokens(usage: TokenUsage | null): number | null {
  if (!usage) return null;
  if (typeof usage.input_total === 'number') return usage.input_total;

  const parts = [usage.input_other, usage.input_cache_read, usage.input_cache_creation]
    .filter((value): value is number => typeof value === 'number');
  if (parts.length === 0) return null;
  return parts.reduce((total, value) => total + value, 0);
}

export function getContextTokenLimit(
  contextUsage: number,
  usage: TokenUsage | null,
): number | null {
  const inputTokens = getContextInputTokens(usage);
  if (inputTokens === null || inputTokens <= 0 || contextUsage <= 0) return null;
  return Math.round(inputTokens / contextUsage);
}

export function formatTokenAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : Number(millions.toFixed(1))}m`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${thousands >= 100 ? Math.round(thousands) : Number(thousands.toFixed(1))}k`;
  }
  return String(Math.round(value));
}

export function formatContextTokenSummary(
  contextUsage: number,
  usage: TokenUsage | null,
): string {
  return `${formatTokenAmount(getContextInputTokens(usage))} of ${formatTokenAmount(getContextTokenLimit(contextUsage, usage))} tokens`;
}
