/**
 * @module workspace-handlers
 * @role Handle workspace-related WebSocket messages (registry, switch, add, remove).
 *
 * Mirrors thread-handlers / stream-handlers / file-handlers pattern: one
 * boolean-returning function, switch on msg.type, early return, final false.
 *
 * Incoming messages:
 *   workspace:init                 — initial registry + active id on connect
 *   workspace:registry_changed     — registry updated (add/remove/rename)
 *   workspace:switched             — active workspace changed
 *   workspace:added                — new workspace joined the registry
 *   workspace:removed              — workspace removed from registry
 *   workspace:add_rejected_duplicate — duplicate path (show modal)
 *   workspace:culled_at_launch     — workspace removed due to missing path (silent)
 *   thread:state_changed           — future use (silent)
 *
 * See docs/WORKSPACE_CLIENT_UI_SPEC.md §3.
 */

import { useWorkspaceStore } from '../../state/workspaceStore';
import { usePanelStore } from '../../state/panelStore';
import { useFileStore } from '../../state/fileStore';
import { rediscoverPanels } from '../panels';
import { loadRootTree } from '../file-tree';
import { showModal, onModalAction } from '../modal';
import { resetSharedStyles } from '../../hooks/useSharedWorkspaceStyles';
import type { WebSocketMessage } from '../../types';

export function handleWorkspaceMessage(msg: WebSocketMessage): boolean {
  const store = useWorkspaceStore.getState();

  switch (msg.type) {
    case 'workspace:init':
      store.setWorkspaces(msg.workspaces ?? []);
      store.setActiveWorkspaceId(msg.activeWorkspaceId ?? null);
      if (msg.homePath) store.setHomePath(msg.homePath);
      store.markInit();
      return true;

    case 'workspace:registry_changed':
      store.setWorkspaces(msg.workspaces ?? []);
      return true;

    case 'workspace:switched': {
      store.setActiveWorkspaceId(msg.to ?? null);
      store.closeSwitcher();
      // Reset file tree — the old workspace's files are stale
      useFileStore.getState().reset();
      // Drop cached shared CSS so the next render loads it from the new workspace
      resetSharedStyles();
      // SECONDARY_CHAT_SPEC §7d: secondary chat is workspace-scoped — blanket close.
      usePanelStore.getState().closeSecondary();
      const ws = usePanelStore.getState().ws;
      if (ws && msg.to) {
        rediscoverPanels(ws).then(() => {
          // Reload file tree from the new workspace's project root
          loadRootTree();
        }).catch((err) => {
          console.error('[workspace] rediscover failed:', err);
        });
      }
      return true;
    }

    case 'workspace:added':
      // Registry will update via workspace:registry_changed, which arrives
      // immediately after. Just close the add/switcher UI.
      store.closeAddModal();
      store.closeSwitcher();
      return true;

    case 'workspace:removed':
      // Registry will update via workspace:registry_changed.
      return true;

    case 'workspace:add_rejected_duplicate': {
      store.closeAddModal();
      const existing = msg.existingWorkspace;
      const label = existing?.label ?? 'unknown';
      // One-shot action listener: on 'confirm', switch to the existing
      // workspace; on 'cancel' or dismiss, do nothing. Reset the listener
      // to a noop afterwards so later modals don't inherit this behavior.
      onModalAction((action) => {
        if (action === 'confirm' && existing) {
          useWorkspaceStore.getState().requestSwitch(existing.id);
        }
        onModalAction(() => {});
      });
      showModal({
        modalType: 'alert',
        config: { type: 'alert' },
        styles: '',
        data: {
          title: 'Workspace already registered',
          message: `This repo is already registered as "${label}". Switch to it?`,
        },
      });
      return true;
    }

    case 'workspace:culled_at_launch':
      // Silent — logged server-side.
      return true;

    case 'thread:state_changed':
      // Available for future UI (activity indicators). No-op today.
      return true;

    default:
      return false;
  }
}
