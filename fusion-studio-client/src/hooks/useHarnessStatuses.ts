/**
 * Shared hook for harness install statuses. Backed by panelStore so
 * `harness:status_changed` WebSocket updates flow through to every
 * consumer reactively. The first mount per page-load triggers the
 * seed fetch from /api/harnesses; subsequent mounts read from cache.
 */

import { useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import type { HarnessStatus } from '../types';

let seeded = false;
let inflight: Promise<void> | null = null;

async function seedOnce() {
  if (seeded) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/harnesses');
      if (!res.ok) return;
      const list: HarnessStatus[] = await res.json();
      const map = list.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, HarnessStatus>);
      usePanelStore.getState().setHarnessStatuses(map);
      seeded = true;
    } catch {
      // silent — dropdown falls back to config defaults
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useHarnessStatuses(): Record<string, HarnessStatus> {
  const statuses = usePanelStore((s) => s.harnessStatuses);
  useEffect(() => { seedOnce(); }, []);
  return statuses;
}
