/**
 * Reactive hook wrapper around cliAccentStyle.
 *
 * Sources accent colors from the resolved CLI config (CLI_CONFIG_SPEC §8b),
 * folded with the current view's per-view delta. Returns a CSSProperties
 * object with `--cli-accent` set to the effective color or undefined when
 * the CLI has no accent (e.g. Robin).
 */

import { useMemo } from 'react';
import { usePanelStore } from '../state/panelStore';
import { cliAccentStyle } from '../config/harness';
import type { CSSProperties } from 'react';

function useAccentOverrides(): Record<string, string> {
  const cliConfig    = usePanelStore((s) => s.cliConfig);
  const viewDeltas   = usePanelStore((s) => s.cliConfigViewDelta);
  const currentPanel = usePanelStore((s) => s.currentPanel);
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, entry] of Object.entries(cliConfig)) {
      if (entry.accentColor) out[id] = entry.accentColor;
    }
    const delta = viewDeltas[currentPanel] || {};
    for (const [id, patch] of Object.entries(delta)) {
      if (patch && typeof patch.accentColor === 'string') out[id] = patch.accentColor;
    }
    return out;
  }, [cliConfig, viewDeltas, currentPanel]);
}

export function useCliAccentStyle(
  harnessId: string | null | undefined,
): CSSProperties | undefined {
  const overrides = useAccentOverrides();
  return cliAccentStyle(harnessId, overrides);
}

/**
 * Loop-safe variant: returns a resolver function that can be called inside
 * `.map()` without violating the Rules of Hooks. Use this whenever the call
 * site iterates over a list of harnesses/threads.
 */
export function useCliAccentResolver(): (
  harnessId: string | null | undefined,
) => CSSProperties | undefined {
  const overrides = useAccentOverrides();
  return (harnessId) => cliAccentStyle(harnessId, overrides);
}
