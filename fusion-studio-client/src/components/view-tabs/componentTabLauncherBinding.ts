/**
 * @module componentTabLauncherBinding
 * @role Binds the closed launcher catalog metadata to code-owned launcher
 *       functions supplied by connected view modules (SPEC-02 §5, VRT-009,
 *       VRT-011A). The catalog itself stays store-free and view-free; this
 *       module adds the binding contract and the fail-closed lookup.
 */

import {
  findComponentTabLauncherCatalogEntry,
} from './componentTabLauncherCatalog';
import type { ReservationIdentity } from './componentTabTypes';

/** Outcome of one code-owned launcher invocation. */
export type ConnectedTabLauncherOutcome =
  | { kind: 'component'; descriptor: unknown }
  | { kind: 'pending' };

export interface ConnectedTabLaunchContext {
  reservation: ReservationIdentity;
  workspaceId: string | null;
  viewId: string;
}

export type ConnectedTabLauncher = (
  context: ConnectedTabLaunchContext,
) => ConnectedTabLauncherOutcome | Promise<ConnectedTabLauncherOutcome>;

/** Catalog-bound launcher: code-owned function plus its fixed kind and icon. */
export interface ConnectedTabLauncherBinding {
  kind: 'component' | 'picker';
  icon: string;
  launcher: ConnectedTabLauncher;
}

/**
 * Catalog-backed launcher binding lookup. Fails closed: the launcher must exist
 * in the closed catalog AND belong to the requesting view AND its fixed kind
 * must match the bound function. Side Chat is not in the catalog, so it can
 * never be bound or shown (SPEC-02 §5).
 */
export function bindCatalogLaunchers(
  bindings: ReadonlyArray<{ launcherId: string; binding: ConnectedTabLauncherBinding }>,
): (launcherId: string, viewId: string) => ConnectedTabLauncherBinding | null {
  const byId = new Map(bindings.map((entry) => [entry.launcherId, entry.binding]));
  return (launcherId, viewId) => {
    const entry = findComponentTabLauncherCatalogEntry(launcherId, viewId);
    const binding = byId.get(launcherId);
    if (!entry || !binding || binding.kind !== entry.kind) return null;
    return binding;
  };
}
