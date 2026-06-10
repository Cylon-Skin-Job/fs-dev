/**
 * Harness metadata and default policy fallback for AI backend selection.
 *
 * `ai/system/config/cli.json` is the server-authoritative allow-list/default
 * policy. This file keeps client-side metadata and the OpenCode-only fallback
 * used before `workspace:init` hydrates policy from the server.
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { usePanelStore } from '../state/panelStore';
import type { HarnessStatus, ResolvedCliEntry } from '../types';

export interface HarnessDetails {
  provider: 'kimi' | 'byok' | 'ollama' | string;
  model: string;
  features: string[];
}

export interface HarnessOption {
  id: string;
  name: string;
  description: string;
  materialIcon: string;
  /**
   * Default accent color for this CLI. Applied as `--cli-accent` on chat
   * header, secondary header, and thread rows. User overrides (future
   * SQLite theme cascade) take precedence over this default.
   */
  accentColor?: string;
  details: HarnessDetails;
  enabled: boolean;
  comingSoon?: boolean;
  recommended?: boolean;
}

export const HARNESS_OPTIONS: HarnessOption[] = [
  {
    id: 'kimi',
    name: 'KIMI',
    description: 'Moonshot AI — native wire protocol with thinking, context %, and plan mode',
    materialIcon: 'bedtime',
    accentColor: '#00d4ff',
    details: {
      provider: 'moonshot',
      model: 'k2.5',
      features: ['tools', 'streaming', 'thinking', 'plan_mode', 'context_%']
    },
    enabled: true,
    recommended: true
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI — thinking blocks, 1M context',
    materialIcon: 'smart_toy',
    accentColor: '#D97757',
    details: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      features: ['tools', 'streaming', 'thinking']
    },
    enabled: true
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini CLI — 1M context window',
    materialIcon: 'stars_2',
    accentColor: '#F5DE9B',
    details: {
      provider: 'google',
      model: 'gemini-2.5-pro',
      features: ['tools', 'streaming']
    },
    enabled: true
  },
  {
    id: 'qwen',
    name: 'Qwen',
    description: 'Alibaba Qwen Code CLI — 256K context with thinking',
    materialIcon: 'diamond_shine',
    accentColor: '#B19CD9',
    details: {
      provider: 'alibaba',
      model: 'qwen3-coder',
      features: ['tools', 'streaming', 'thinking']
    },
    enabled: true
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex CLI — GPT-5 series agentic coding',
    materialIcon: 'terminal_2',
    accentColor: '#4169E1',
    details: {
      provider: 'openai',
      model: 'gpt-5.3-codex',
      features: ['tools', 'streaming', 'thinking']
    },
    enabled: true
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode CLI — provider-flexible coding agent with JSON streaming',
    materialIcon: 'all_inclusive',
    accentColor: '#10B981',
    details: {
      provider: 'opencode',
      model: 'configured-default',
      features: ['tools', 'streaming', 'thinking']
    },
    enabled: true
  }
];

// OpenCode-only fallback used until workspace policy is hydrated.
export const DEFAULT_HARNESS = 'opencode';

// Helper to get harness option by ID
export function getHarnessOption(id: string): HarnessOption | undefined {
  return HARNESS_OPTIONS.find(opt => opt.id === id);
}

// Helper to check if a harness is enabled
export function isHarnessEnabled(id: string): boolean {
  const option = getHarnessOption(id);
  return option?.enabled ?? false;
}

// CLI_IDENTITY_SPEC: single lookup helper for harness identity
export function getHarnessIdentity(harnessId: string | null | undefined): {
  name: string;
  icon: string;
  accentColor: string | undefined;
  option: HarnessOption | null;
} {
  if (!harnessId) {
    return { name: 'Unknown', icon: 'help', accentColor: undefined, option: null };
  }
  const option = getHarnessOption(harnessId);
  if (!option) {
    return { name: 'Unknown', icon: 'help', accentColor: undefined, option: null };
  }
  return {
    name: option.name,
    icon: option.materialIcon,
    accentColor: option.accentColor,
    option,
  };
}

/**
 * Resolve the effective accent color for a harness, considering user overrides.
 * Pure function — not coupled to any store.
 */
export function resolveCliAccent(
  harnessId: string | null | undefined,
  overrides: Record<string, string>,
): string | undefined {
  if (!harnessId) return undefined;
  return overrides[harnessId] ?? getHarnessOption(harnessId)?.accentColor;
}

/**
 * Build an inline style object that sets `--cli-accent` if the harness has a
 * resolved color. Components spread this onto the element whose descendants
 * read `var(--cli-accent, fallback)`.
 */
export function cliAccentStyle(
  _harnessId: string | null | undefined,
  _overrides: Record<string, string> = {},
): CSSProperties | undefined {
  void _overrides;
  // Per-CLI accent disabled — IDE icons/titles unify on the chosen theme accent.
  // Function preserved so existing call sites keep working.
  return undefined;
}

// Build a resolved entry from catalog metadata. The fallback policy below uses
// only OpenCode; multi-harness display comes from hydrated `cli.json` policy.
function factoryResolved(option: HarnessOption, idx: number): ResolvedCliEntry {
  return {
    id:           option.id,
    name:         option.name,
    description:  option.description,
    materialIcon: option.materialIcon,
    accentColor:  option.accentColor,
    details: {
      provider: option.details.provider,
      model:    option.details.model,
      features: [...option.details.features],
    },
    enabled:     option.enabled,
    comingSoon:  option.comingSoon,
    recommended: option.recommended,
    order:       idx,
  };
}

function defaultResolvedList(): ResolvedCliEntry[] {
  const idx = HARNESS_OPTIONS.findIndex((o) => o.id === DEFAULT_HARNESS);
  return idx === -1 ? [] : [factoryResolved(HARNESS_OPTIONS[idx], 0)];
}

function applyDelta(
  entry: ResolvedCliEntry,
  delta: Partial<ResolvedCliEntry> | undefined,
): ResolvedCliEntry {
  if (!delta) return entry;
  const out = { ...entry };
  for (const key of Object.keys(delta) as Array<keyof ResolvedCliEntry>) {
    const v = delta[key];
    if (v === undefined) continue;
    // @ts-expect-error — narrow-key assignment across union
    out[key] = v;
  }
  return out;
}

/**
 * Reactive hook: returns the effective `ResolvedCliEntry` for a harness id
 * in the current view. Falls back to catalog metadata for historical threads
 * whose stored harness id is not in the current `cli.json` allow-list.
 */
export function useResolvedHarness(
  harnessId: string | null | undefined,
): ResolvedCliEntry | null {
  const cliConfig    = usePanelStore((s) => s.cliConfig);
  const viewDeltas   = usePanelStore((s) => s.cliConfigViewDelta);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  return useMemo(() => {
    if (!harnessId) return null;
    const base = cliConfig[harnessId]
      ?? (() => {
        const idx = HARNESS_OPTIONS.findIndex((o) => o.id === harnessId);
        if (idx === -1) return null;
        return factoryResolved(HARNESS_OPTIONS[idx], idx);
      })();
    if (!base) return null;
    const viewDelta = viewDeltas[currentPanel]?.[harnessId];
    return applyDelta(base, viewDelta);
  }, [harnessId, cliConfig, viewDeltas, currentPanel]);
}

/**
 * Loop-safe variant of `useResolvedHarness` — returns a resolver callable that
 * can be invoked inside `.map()` without violating the Rules of Hooks.
 */
export function useResolvedHarnessResolver(): (
  harnessId: string | null | undefined,
) => ResolvedCliEntry | null {
  const cliConfig    = usePanelStore((s) => s.cliConfig);
  const viewDeltas   = usePanelStore((s) => s.cliConfigViewDelta);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  return (harnessId) => {
    if (!harnessId) return null;
    const base = cliConfig[harnessId]
      ?? (() => {
        const idx = HARNESS_OPTIONS.findIndex((o) => o.id === harnessId);
        if (idx === -1) return null;
        return factoryResolved(HARNESS_OPTIONS[idx], idx);
      })();
    if (!base) return null;
    const viewDelta = viewDeltas[currentPanel]?.[harnessId];
    return applyDelta(base, viewDelta);
  };
}

/**
 * Reactive hook: returns the resolved workspace harness policy for the current
 * view, sorted by `order`. Before hydration, this is OpenCode-only. Advanced
 * multi-harness configs can list additional enabled harnesses in `cli.json`.
 */
export function useResolvedCliList(): ResolvedCliEntry[] {
  const cliConfig    = usePanelStore((s) => s.cliConfig);
  const viewDeltas   = usePanelStore((s) => s.cliConfigViewDelta);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  return useMemo(() => {
    const base = Object.keys(cliConfig).length
      ? Object.values(cliConfig)
      : defaultResolvedList();
    const delta = viewDeltas[currentPanel] || {};
    const merged = base.map((e) => applyDelta(e, delta[e.id]));
    return merged.sort((a, b) => a.order - b.order);
  }, [cliConfig, viewDeltas, currentPanel]);
}

export function getSelectableHarnesses(
  entries: ResolvedCliEntry[],
  statuses: Record<string, HarnessStatus>,
): ResolvedCliEntry[] {
  return entries.filter((entry) => {
    if (!entry.enabled) return false;
    const status = statuses[entry.id];
    if (!status) return true;
    return status.installed || status.builtIn;
  });
}

export function useSelectableHarnesses(
  statuses: Record<string, HarnessStatus>,
): ResolvedCliEntry[] {
  const resolvedList = useResolvedCliList();
  return useMemo(() => getSelectableHarnesses(resolvedList, statuses), [resolvedList, statuses]);
}
