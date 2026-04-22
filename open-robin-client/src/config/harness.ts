/**
 * Harness configuration for AI backend selection
 *
 * Defines available harness options and their properties.
 * Used by the CliPickerDropdown component.
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { usePanelStore } from '../state/panelStore';
import type { ResolvedCliEntry } from '../types';

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
    id: 'robin',
    name: 'Robin',
    description: 'Built-in Vercel AI SDK — BYOK, works with any OpenAI-compatible provider',
    materialIcon: 'auto_awesome',
    details: {
      provider: 'byok',
      model: 'configurable',
      features: ['tools', 'streaming']
    },
    enabled: true
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
  }
];

// Default harness - KIMI is the primary experience
export const DEFAULT_HARNESS = 'kimi';

// System prompt prefix for Robin
export const ROBIN_SYSTEM_PROMPT = `You are Robin, a helpful AI assistant. You provide clear, accurate, and helpful responses while being direct and efficient in your communication.`;

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
  harnessId: string | null | undefined,
  overrides: Record<string, string> = {},
): CSSProperties | undefined {
  const color = resolveCliAccent(harnessId, overrides);
  if (!color) return undefined;
  return { ['--cli-accent' as string]: color } as CSSProperties;
}

// CLI_CONFIG_SPEC §8b: build a factory-shaped ResolvedCliEntry from a
// HarnessOption. Used as fallback until `workspace:init` hydrates cliConfig.
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
 * in the current view. Falls back to the hardcoded factory catalog if
 * `workspace:init` has not yet hydrated the store.
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
 * Reactive hook: returns the full resolved CLI catalog for the current view,
 * sorted by `order`. Consumers iterating (pickers, sidebars) should use this
 * and `.filter(e => e.enabled)`.
 */
export function useResolvedCliList(): ResolvedCliEntry[] {
  const cliConfig    = usePanelStore((s) => s.cliConfig);
  const viewDeltas   = usePanelStore((s) => s.cliConfigViewDelta);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  return useMemo(() => {
    const base = Object.keys(cliConfig).length
      ? Object.values(cliConfig)
      : HARNESS_OPTIONS.map(factoryResolved);
    const delta = viewDeltas[currentPanel] || {};
    const merged = base.map((e) => applyDelta(e, delta[e.id]));
    return merged.sort((a, b) => a.order - b.order);
  }, [cliConfig, viewDeltas, currentPanel]);
}
