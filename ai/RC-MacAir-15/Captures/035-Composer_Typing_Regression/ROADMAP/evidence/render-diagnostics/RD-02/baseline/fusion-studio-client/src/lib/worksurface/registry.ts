/**
 * @module worksurface/registry
 * @role Focused adapter registry for participating built-in views.
 *
 * One `adapterId` maps to exactly one connected adapter. Registration is
 * explicit and code-owned; there is no dynamic/plugin discovery in SPEC-03.
 * A view without a registered adapter simply has no worksurface continuity and
 * keeps its existing behavior.
 */

import type { WorksurfaceAdapter } from './types';

const adapters = new Map<string, WorksurfaceAdapter>();

/** Register (or replace) one view worksurface adapter. Last registration wins. */
export function registerWorksurfaceAdapter(adapter: WorksurfaceAdapter): void {
  if (!adapter || typeof adapter.adapterId !== 'string' || !adapter.adapterId) {
    throw new Error('Worksurface adapter requires an adapterId');
  }
  if (!Number.isInteger(adapter.adapterVersion) || adapter.adapterVersion < 1) {
    throw new Error('Worksurface adapter requires an integer adapterVersion');
  }
  adapters.set(adapter.adapterId, adapter);
}

export function getWorksurfaceAdapter(adapterId: string): WorksurfaceAdapter | null {
  return adapters.get(adapterId) ?? null;
}

/** The registered adapter for a view; adapterId is the view id for built-ins. */
export function worksurfaceAdapterForView(viewId: string): WorksurfaceAdapter | null {
  return adapters.get(viewId) ?? null;
}

export function listWorksurfaceAdapters(): WorksurfaceAdapter[] {
  return Array.from(adapters.values());
}

/** Test seam: drop all registrations (never called by production code). */
export function clearWorksurfaceAdapters(): void {
  adapters.clear();
}
