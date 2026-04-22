/**
 * @module harness-handlers
 * @role Handle harness install-status WebSocket messages.
 *
 * Mirrors workspace-handlers shape: one boolean-returning function,
 * early return on unrelated types. Patches the per-entry slot in
 * panelStore.harnessStatuses so the picker re-renders reactively when
 * the server probes a CLI's install state.
 *
 * See HARNESS_STATUS_CACHE_SPEC §6c.
 */

import { usePanelStore } from '../../state/panelStore';
import type { WebSocketMessage } from '../../types';

export function handleHarnessMessage(msg: WebSocketMessage): boolean {
  if (msg.type !== 'harness:status_changed') return false;
  const id = msg.id;
  if (!id) return true;
  const store = usePanelStore.getState();
  const prior = store.harnessStatuses[id];
  store.setHarnessStatus(id, {
    id,
    installed: !!msg.installed,
    // The wire message only reports installed-state transitions; the
    // builtIn flag is a registry property, never flipped by a probe.
    builtIn: prior?.builtIn ?? false,
    version: msg.version ?? null,
    action: msg.installed ? null : 'install',
    installCommand: prior?.installCommand ?? null,
  });
  return true;
}
