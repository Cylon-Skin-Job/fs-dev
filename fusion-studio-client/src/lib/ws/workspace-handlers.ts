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
 *   workspace:ribbon_removed       — workspace hidden from ribbon; evict runtime cache
 *   workspace:add_rejected_duplicate — duplicate path (show modal)
 *   workspace:add_rejected_missing_ai — missing /ai folder (show modal)
 *   workspace:create_manifest         — view template catalog for Create New
 *   workspace:create_rejected         — create failed (show inline error)
 *   workspace:created                 — new workspace created (close modal)
 *   workspace:view_registry_updated   — active workspace views changed
 *   workspace:view_update_rejected    — view registry update failed
 *   workspace:culled_at_launch     — workspace removed due to missing path (silent)
 *   thread:state_changed           — future use (silent)
 *
 * See docs/WORKSPACE_CLIENT_UI_SPEC.md §3.
 */

import { useWorkspaceStore } from '../../state/workspaceStore';
import { usePanelStore } from '../../state/panelStore';
import { useFileStore } from '../../state/fileStore';
import { useWikiStore } from '../../state/wikiStore';
import { useFileDataStore } from '../../state/fileDataStore';
import { useScreenshotStore } from '../../state/screenshotStore';
import { preloadIcons } from '../icon-registry';
import { rediscoverPanels } from '../panels';
import { loadRootTree } from '../file-tree';
import { showModal, onModalAction } from '../modal';
import { resetSharedStyles, injectWorkspaceStyles } from '../../hooks/useSharedWorkspaceStyles';
import type { WebSocketMessage } from '../../types';

export function handleWorkspaceMessage(msg: WebSocketMessage): boolean {
  const store = useWorkspaceStore.getState();

  switch (msg.type) {
    case 'workspace:init': {
      console.log('[workspace-handlers] workspace:init received:', msg);
      const workspaces = msg.workspaces ?? [];
      store.setWorkspaces(workspaces);
      store.setActiveWorkspaceId(msg.activeWorkspaceId ?? null);
      store.setWorkspaceType((msg as any).workspaceType ?? 'code');
      console.log('[workspace-handlers] activeWorkspaceId set to:', msg.activeWorkspaceId);
      if (msg.homePath) store.setHomePath(msg.homePath);
      usePanelStore.getState().hydrateCliConfig(msg.cliConfig ?? {});
      usePanelStore.getState().hydrateThemes((msg as any).themes ?? [], (msg as any).activeThemeId ?? null);
      // INSTANT_THEME_SWITCH: inject pre-loaded CSS synchronously if available
      if ((msg as any).styles) {
        injectWorkspaceStyles((msg as any).styles);
      }
      // WORKSPACE_CACHE_PERSISTENCE: hydrate cached workspace states from server
      const cachedStates = (msg as any).cachedStates ?? {};
      for (const [wsId, cached] of Object.entries(cachedStates)) {
        if (typeof cached === 'object' && cached !== null) {
          // Strip internal server metadata before seeding
          const { _savedAt, ...state } = cached as any;
          usePanelStore.getState().seedWorkspaceState(wsId, state);
        }
      }
      // If there's an active workspace on init, activate it so the cached
      // state loads immediately (avoids a blank-first-load after refresh).
      const activeId = msg.activeWorkspaceId ?? null;
      const panelBefore = usePanelStore.getState().currentPanel;
      if (activeId) {
        usePanelStore.getState().activateWorkspace(activeId);
        useFileStore.getState().activateWorkspace(activeId);
        useWikiStore.getState().activateWorkspace(activeId);
      }
      // Sync panel with server if the cached panel differs from the default
      // that was already sent in ws.onopen (set_panel is idempotent-ish).
      const panelStore = usePanelStore.getState();
      const wsConn = panelStore.ws;
      if (wsConn && wsConn.readyState === WebSocket.OPEN && panelStore.currentPanel && panelStore.currentPanel !== panelBefore) {
        wsConn.send(JSON.stringify({ type: 'set_panel', panel: panelStore.currentPanel }));
      }
      // Preload workspace icon SVGs from Fusion Home so the ribbon
      // renders inline SVGs instead of font glyphs on first paint.
      const iconNames = workspaces.map((w: any) => w.icon || 'folder').filter(Boolean);
      if (iconNames.length > 0) {
        preloadIcons(iconNames).catch(() => {});
      }

      // Keep Electron protocol handler's workspace root in sync
      const activeWs = workspaces.find((w: any) => w.id === msg.activeWorkspaceId);
      const activeRepoPath = (msg as any).activeRepoPath ?? activeWs?.repoPath ?? null;
      window.electronAPI?.setWorkspaceRoot(activeRepoPath);

      store.markInit();
      // Request existing screenshots so the ribbon can show thumbnails immediately
      const wsConn2 = usePanelStore.getState().ws;
      if (wsConn2 && wsConn2.readyState === WebSocket.OPEN) {
        wsConn2.send(JSON.stringify({ type: 'screenshot:list' }));
      }
      return true;
    }

    case 'workspace:registry_changed': {
      const updatedWorkspaces = msg.workspaces ?? [];
      store.setWorkspaces(updatedWorkspaces);
      // Preload any newly added workspace icons
      const updatedIcons = updatedWorkspaces.map((w: any) => w.icon || 'folder').filter(Boolean);
      if (updatedIcons.length > 0) {
        preloadIcons(updatedIcons).catch(() => {});
      }
      return true;
    }

    case 'workspace:switched': {
      const workspaceId = msg.to ?? null;
      store.setActiveWorkspaceId(workspaceId);
      store.completeWorkspacePreviewSwitch(workspaceId);
      store.setWorkspaceType((msg as any).workspaceType ?? 'code');

      // Keep Electron protocol handler's workspace root in sync
      window.electronAPI?.setWorkspaceRoot((msg as any).repoPath ?? null);

      // WORKSPACE_ISOLATION_SPEC: swap to cached workspace state (or empty)
      usePanelStore.getState().activateWorkspace(workspaceId);
      useFileStore.getState().activateWorkspace(workspaceId);
      useWikiStore.getState().activateWorkspace(workspaceId);

      // Clear the global file data cache so we don't show stale trees/content
      // from a different workspace. fileDataStore keys are panel:path, not
      // workspace-scoped, so cross-workspace pollution is possible.
      useFileDataStore.getState().clearAll();

      // Re-read stores AFTER activateWorkspace so we use the NEW workspace's state
      const panelStore = usePanelStore.getState();
      const previewPanelId = workspaceId ? useScreenshotStore.getState().activePanels[workspaceId] : null;
      if (previewPanelId && panelStore.panelConfigs.some((config) => config.id === previewPanelId)) {
        panelStore.setCurrentPanel(previewPanelId);
      }

      // Use repoPath from the switch message to seed projectRoot if the cache
      // is empty. panel_config will arrive shortly after with the canonical value.
      if (msg.repoPath && !panelStore.projectRoot) {
        panelStore.setProjectRoot(msg.repoPath);
      }

      // INSTANT_THEME_SWITCH: if the server sent pre-loaded CSS, inject it
      // synchronously instead of triggering 7 async WebSocket fetches.
      if ((msg as any).styles) {
        injectWorkspaceStyles((msg as any).styles);
      } else {
        // Fallback for older servers: invalidate cache so the hook refetches
        resetSharedStyles();
      }

      // Hydrate themes for the new workspace so the theme picker shows the
      // correct workspace's settings instead of stale data from the previous one.
      usePanelStore.getState().hydrateThemes(
        (msg as any).themes ?? [],
        (msg as any).activeThemeId ?? null,
      );

      // SECONDARY_CHAT_SPEC §7d: secondary chat is workspace-scoped — blanket close.
      panelStore.closeSecondary();

      // If this workspace has never been visited, request panels and file tree.
      // If cached, render immediately without blocking.
      const isCached = workspaceId && panelStore.workspaceState[workspaceId];
      const ws = panelStore.ws;

      if (!isCached && ws && workspaceId) {
        // First visit: discover panels from the new workspace
        rediscoverPanels(ws).then(() => {
          // After discovery, load file tree in the background
          loadRootTree();
        }).catch((err) => {
          console.error('[workspace] rediscover failed:', err);
        });
      } else if (ws && workspaceId) {
        // Cached visit: panels already known; tell the server which panel we're on
        // so it can set up the correct view manager and thread scope.
        if (panelStore.panelConfigs.length === 0) {
          // Edge case: cache exists but has no panels (shouldn't happen, but safe)
          rediscoverPanels(ws).catch((err) => {
            console.error('[workspace] rediscover failed:', err);
          });
        } else if (panelStore.currentPanel) {
          ws.send(JSON.stringify({ type: 'set_panel', panel: panelStore.currentPanel }));
        }
        loadRootTree();
      }

      return true;
    }

    case 'workspace:added':
      // Registry will update via workspace:registry_changed, which arrives
      // immediately after. Just close the add UI.
      store.closeAddModal();
      return true;

    case 'workspace:removed':
      // Registry will update via workspace:registry_changed.
      return true;

    case 'workspace:ribbon_removed':
      if (msg.workspaceId) {
        usePanelStore.getState().evictWorkspaceRuntimeState(msg.workspaceId);
        useFileStore.getState().evictWorkspaceTree(msg.workspaceId);
      }
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

    case 'workspace:add_rejected_missing_ai': {
      store.closeAddModal();
      showModal({
        modalType: 'alert',
        config: { type: 'alert' },
        styles: '',
        data: {
          title: 'Project requires /ai',
          message: 'This folder cannot be added because it does not contain an /ai folder. Choose a project that already has /ai, or create the project through the future Create New flow.',
        },
      });
      return true;
    }

    case 'workspace:create_manifest': {
      if (msg.manifest) {
        store.setCreateManifest(msg.manifest);
      }
      return true;
    }

    case 'workspace:create_rejected': {
      store.setCreateError(msg.message || 'Unable to create project.');
      return true;
    }

    case 'workspace:ribbon_reorder_rejected': {
      console.warn('[workspace] ribbon reorder rejected:', msg.message || 'unknown reason');
      return true;
    }

    case 'workspace:created': {
      store.closeCreateModal();
      return true;
    }

    case 'workspace:view_options': {
      usePanelStore.getState().setViewOptions(msg.hiddenViews ?? [], msg.availableTemplates ?? []);
      return true;
    }

    case 'workspace:view_registry_updated': {
      const panelStore = usePanelStore.getState();
      panelStore.setViewRegistryUpdateError(null);
      const ws = panelStore.ws;
      if (ws) {
        rediscoverPanels(ws, { preserveCurrent: true, chooseNearestIfMissing: true }).catch((err) => {
          console.error('[workspace] view registry rediscover failed:', err);
          usePanelStore.getState().setViewRegistryUpdateError('View registry updated, but the rail did not refresh.');
        });
      }
      return true;
    }

    case 'workspace:view_update_rejected': {
      usePanelStore.getState().setViewRegistryUpdateError(msg.message || 'Unable to update view.');
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
