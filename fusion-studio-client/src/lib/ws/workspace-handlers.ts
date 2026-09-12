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
 *   workspace:unavailable_at_launch — registered workspace path/structure unavailable (silent)
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
import { handleOfficePaletteWorkspaceChanged } from './office-palette-handlers';
import { retirePendingResourceProvenanceQueries } from './resource-provenance-protocol';
import {
  clearViewCapsuleProjection,
  forwardViewCapsuleProjection,
  forwardWorkspaceBinding,
  parseViewCapsuleProjection,
} from '../view-capsule-projection';
import { parseTabPolicyProjection } from '../tab-policy-projection';
import type { ThemeEntry, WebSocketMessage } from '../../types';
import type { WorkspacePanelState } from '../../state/panelStoreTypes';

type WorkspaceType = 'code' | 'app';
type WorkspaceStateSnapshot = Pick<Partial<WorkspacePanelState>, 'currentPanel'>;

interface WorkspaceWireMessage extends WebSocketMessage {
  workspaceType?: WorkspaceType;
  sourceMachineName?: string;
  themes?: ThemeEntry[];
  activeThemeId?: string | null;
  styles?: Record<string, string>;
  workspaceStates?: Record<string, WorkspaceStateSnapshot>;
  activeRepoPath?: string | null;
  workspaceEpoch?: string | null;
  bindingRevision?: number;
  fileSaveProtocolVersion?: 1;
  resourceProvenanceProtocolVersion?: 1;
  fileViewerReadProtocolVersion?: 1;
  viewCapsules?: unknown;
  tabPolicies?: unknown;
  viewRegistryUnavailable?: boolean;
  projectRoot?: string | null;
  panelRoots?: Record<string, string>;
}

interface PendingWorkspaceExposure {
  kind: 'init' | 'switch';
  token: number;
  message: WorkspaceWireMessage | null;
  workspaceId: string | null;
  workspaceEpoch: string | null;
  bindingRevision: number;
  runtimeGeneration: string | null;
  bindingReady: Promise<boolean>;
  bindingAccepted: boolean | null;
  fallbackTimer: ReturnType<typeof setTimeout> | null;
}

export interface WorkspaceExposureSnapshot {
  token: number;
  workspaceId: string | null;
  workspaceEpoch: string | null;
  bindingRevision: number;
  runtimeGeneration: string | null;
}

export interface WorkspaceMessageContext {
  runtimeGeneration: string | null;
  isStillCurrent: () => boolean;
}

interface ViewRegistryUpdateCorrelation {
  workspaceId: string | null;
  workspaceEpoch: string | null;
  bindingRevision: number;
  runtimeGeneration: string | null;
  exposureToken: number;
  updateToken: number;
}

let workspaceExposureToken = 0;
let viewRegistryUpdateToken = 0;
let pendingWorkspaceExposure: PendingWorkspaceExposure | null = null;
const WORKSPACE_PROJECTION_TIMEOUT_MS = 5000;

function toWorkspacePanelStateSnapshot(snapshot: WorkspaceStateSnapshot): Partial<WorkspacePanelState> {
  return {
    currentPanel: typeof snapshot.currentPanel === 'string' ? snapshot.currentPanel : undefined,
  };
}

function bindingWorkspaceId(msg: WebSocketMessage, legacyId: string | null | undefined): string | null {
  const pair = msg as unknown as { workspaceId?: string | null };
  return Object.prototype.hasOwnProperty.call(pair, 'workspaceId') ? pair.workspaceId ?? null : legacyId ?? null;
}

function isBindingRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

export async function bootstrapWorkspaceAfterBind(
  ws: WebSocket,
  currentPanel: string | null,
  discover: typeof rediscoverPanels = rediscoverPanels,
): Promise<void> {
  if (currentPanel) ws.send(JSON.stringify({ type: 'set_panel', panel: currentPanel }));
  await discover(ws, { preserveCurrent: true });
}

function applyWorkspaceSwitch(
  workspaceMsg: WorkspaceWireMessage,
  registryAvailable: boolean,
  deferPanelRediscovery = false,
  rediscoveryShouldCommit?: () => boolean,
): void {
  const msg = workspaceMsg;
  const store = useWorkspaceStore.getState();
  const workspaceId = bindingWorkspaceId(msg, msg.to);
  retirePendingResourceProvenanceQueries();
  store.applyWorkspaceBinding(
    workspaceId,
    workspaceMsg.workspaceEpoch ?? null,
    workspaceMsg.fileSaveProtocolVersion ?? null,
    workspaceMsg.resourceProvenanceProtocolVersion ?? null,
    workspaceMsg.fileViewerReadProtocolVersion ?? null,
    workspaceMsg.bindingRevision ?? null,
  );
  useFileDataStore.getState().beginWorkspaceGeneration(workspaceId, workspaceMsg.workspaceEpoch ?? null);
  store.completeWorkspacePreviewSwitch(workspaceId);
  store.setWorkspaceType(workspaceMsg.workspaceType ?? 'code');

  usePanelStore.getState().activateWorkspace(workspaceId);
  useFileStore.getState().activateWorkspace(workspaceId);
  useWikiStore.getState().activateWorkspace(workspaceId);

  const panelStore = usePanelStore.getState();
  if (!registryAvailable) {
    panelStore.setPanelConfigs([]);
    panelStore.setPanelRoots({});
    panelStore.setTabPolicies(null);
  }
  const previewPanelId = workspaceId ? useScreenshotStore.getState().activePanels[workspaceId] : null;
  if (registryAvailable && previewPanelId && panelStore.panelConfigs.some((config) => config.id === previewPanelId)) {
    panelStore.setCurrentPanel(previewPanelId);
  }

  if (msg.repoPath && !panelStore.projectRoot) panelStore.setProjectRoot(msg.repoPath);
  if (workspaceMsg.styles) injectWorkspaceStyles(workspaceMsg.styles);
  else resetSharedStyles();
  usePanelStore.getState().hydrateThemes(
    workspaceMsg.themes ?? [],
    workspaceMsg.activeThemeId ?? null,
  );
  panelStore.closeSecondary();

  const isCached = workspaceId && panelStore.workspaceState[workspaceId];
  const ws = panelStore.ws;
  if (registryAvailable && !deferPanelRediscovery && !isCached && ws && workspaceId) {
    rediscoverPanels(ws, { shouldCommit: rediscoveryShouldCommit }).then(() => loadRootTree()).catch((err) => {
      void err;
      console.error('[WS] workspace_rediscover_failed');
    });
  } else if (registryAvailable && !deferPanelRediscovery && ws && workspaceId) {
    if (panelStore.panelConfigs.length === 0) {
      rediscoverPanels(ws, { shouldCommit: rediscoveryShouldCommit }).catch((err) => {
        void err;
        console.error('[WS] workspace_rediscover_failed');
      });
    } else if (panelStore.currentPanel) {
      ws.send(JSON.stringify({ type: 'set_panel', panel: panelStore.currentPanel }));
    }
    loadRootTree();
  }
  store.markInit();
}

function completeWorkspaceInit(
  workspaceId: string | null,
  registryAvailable: boolean,
): void {
  if (!registryAvailable) {
    const panelStore = usePanelStore.getState();
    panelStore.setPanelConfigs([]);
    panelStore.setPanelRoots({});
    panelStore.setTabPolicies(null);
  }
  useWorkspaceStore.getState().markInit();
  handleOfficePaletteWorkspaceChanged(workspaceId);
}

export function retirePendingWorkspaceExposure(): void {
  workspaceExposureToken += 1;
  viewRegistryUpdateToken += 1;
  if (pendingWorkspaceExposure?.fallbackTimer) {
    clearTimeout(pendingWorkspaceExposure.fallbackTimer);
  }
  pendingWorkspaceExposure = null;
}

function isCurrentViewRegistryUpdate(
  expected: Readonly<ViewRegistryUpdateCorrelation>,
  context: WorkspaceMessageContext,
): boolean {
  if (!context.isStillCurrent()
    || context.runtimeGeneration !== expected.runtimeGeneration
    || workspaceExposureToken !== expected.exposureToken
    || viewRegistryUpdateToken !== expected.updateToken) return false;
  const pending = pendingWorkspaceExposure;
  if (pending) {
    return pending.token === expected.exposureToken
      && pending.workspaceId === expected.workspaceId
      && pending.workspaceEpoch === expected.workspaceEpoch
      && pending.bindingRevision === expected.bindingRevision
      && pending.runtimeGeneration === expected.runtimeGeneration;
  }
  const current = useWorkspaceStore.getState();
  return current.activeWorkspaceId === expected.workspaceId
    && current.workspaceEpoch === expected.workspaceEpoch
    && current.bindingRevision === expected.bindingRevision;
}

function beginViewRegistryUpdate(
  workspaceId: string | null,
  workspaceEpoch: string | null,
  context: WorkspaceMessageContext,
): Readonly<{
  correlation: Readonly<ViewRegistryUpdateCorrelation>;
  exposure: Readonly<WorkspaceExposureSnapshot> | null;
}> | null {
  if (!context.isStillCurrent() || typeof workspaceId !== 'string' || typeof workspaceEpoch !== 'string') {
    return null;
  }
  const pending = pendingWorkspaceExposure;
  if (pending) {
    if (pending.workspaceId !== workspaceId
      || pending.workspaceEpoch !== workspaceEpoch
      || pending.runtimeGeneration !== context.runtimeGeneration) return null;
  } else {
    const active = useWorkspaceStore.getState();
    if (!active.hasReceivedInit
      || active.activeWorkspaceId !== workspaceId
      || active.workspaceEpoch !== workspaceEpoch
      || !isBindingRevision(active.bindingRevision)) return null;
  }
  viewRegistryUpdateToken += 1;
  return Object.freeze({
    correlation: Object.freeze({
      workspaceId,
      workspaceEpoch,
      bindingRevision: pending?.bindingRevision ?? useWorkspaceStore.getState().bindingRevision!,
      runtimeGeneration: context.runtimeGeneration,
      exposureToken: workspaceExposureToken,
      updateToken: viewRegistryUpdateToken,
    }),
    exposure: pending ? Object.freeze({
      token: pending.token,
      workspaceId: pending.workspaceId,
      workspaceEpoch: pending.workspaceEpoch,
      bindingRevision: pending.bindingRevision,
      runtimeGeneration: pending.runtimeGeneration,
    }) : null,
  });
}

function armWorkspaceExposureFallback(pending: PendingWorkspaceExposure): void {
  pending.fallbackTimer = setTimeout(() => {
    if (pendingWorkspaceExposure !== pending || pending.token !== workspaceExposureToken) return;
    // A missing projection becomes a bounded unavailable workspace only after
    // Electron has acknowledged clearing the prior map. Rejected/hung IPC
    // remains behind the loading gate and cannot restore cached custom panels.
    if (pending.bindingAccepted !== true) return;
    pendingWorkspaceExposure = null;
    if (pending.kind === 'switch' && pending.message) {
      applyWorkspaceSwitch(pending.message, false);
    } else {
      completeWorkspaceInit(pending.workspaceId, false);
    }
  }, WORKSPACE_PROJECTION_TIMEOUT_MS);
}

function beginWorkspaceSwitch(
  workspaceMsg: WorkspaceWireMessage,
  runtimeGeneration: string | null,
): boolean {
  const store = useWorkspaceStore.getState();
  const workspaceId = bindingWorkspaceId(workspaceMsg, workspaceMsg.to);
  const bindingRevision = workspaceMsg.bindingRevision;
  if (!isBindingRevision(bindingRevision)) return false;
  if (pendingWorkspaceExposure
    ? bindingRevision < pendingWorkspaceExposure.bindingRevision
    : isBindingRevision(store.bindingRevision) && bindingRevision < store.bindingRevision) return false;
  retirePendingWorkspaceExposure();
  const token = workspaceExposureToken;
  store.beginInit();
  const bindingReady = forwardWorkspaceBinding(
    workspaceId, bindingRevision, runtimeGeneration,
  );
  const pending: PendingWorkspaceExposure = {
    kind: 'switch',
    token,
    message: workspaceMsg,
    workspaceId,
    workspaceEpoch: workspaceMsg.workspaceEpoch ?? null,
    bindingRevision,
    runtimeGeneration,
    bindingReady,
    bindingAccepted: null,
    fallbackTimer: null,
  };
  pendingWorkspaceExposure = pending;
  void bindingReady.then((accepted) => {
    pending.bindingAccepted = accepted;
    if (pendingWorkspaceExposure !== pending || pending.token !== workspaceExposureToken) return;
    if (workspaceId === null || workspaceMsg.viewRegistryUnavailable === true) {
      if (pending.fallbackTimer) clearTimeout(pending.fallbackTimer);
      pendingWorkspaceExposure = null;
      applyWorkspaceSwitch(workspaceMsg, false);
    }
  });
  armWorkspaceExposureFallback(pending);
  return true;
}

export function capturePendingWorkspaceExposure(): Readonly<WorkspaceExposureSnapshot> | null {
  const pending = pendingWorkspaceExposure;
  return pending ? Object.freeze({
    token: pending.token,
    workspaceId: pending.workspaceId,
    workspaceEpoch: pending.workspaceEpoch,
    bindingRevision: pending.bindingRevision,
    runtimeGeneration: pending.runtimeGeneration,
  }) : null;
}

export function canInstallWorkspaceProjection(
  value: unknown,
  expected: Readonly<WorkspaceExposureSnapshot> | null,
  correlation: Readonly<{ workspaceId: string | null; workspaceEpoch: string | null }>,
): boolean {
  const projection = parseViewCapsuleProjection(value);
  if (
    !projection
    || projection.workspaceId !== correlation.workspaceId
    || typeof correlation.workspaceEpoch !== 'string'
  ) return false;
  const pending = pendingWorkspaceExposure;
  if (!expected) {
    const active = useWorkspaceStore.getState();
    return pending === null
      && active.hasReceivedInit
      && active.activeWorkspaceId === correlation.workspaceId
      && active.workspaceEpoch === correlation.workspaceEpoch;
  }
  return Boolean(
    pending
    && pending.token === expected.token
    && pending.workspaceId === expected.workspaceId
    && pending.workspaceEpoch === expected.workspaceEpoch
    && pending.bindingRevision === expected.bindingRevision
    && pending.runtimeGeneration === expected.runtimeGeneration
    && pending.workspaceId === correlation.workspaceId
    && pending.workspaceEpoch === correlation.workspaceEpoch
  );
}

export async function awaitPendingWorkspaceBinding(
  expected: Readonly<WorkspaceExposureSnapshot> | null,
): Promise<boolean> {
  if (!expected) return true;
  const pending = pendingWorkspaceExposure;
  if (!pending
    || pending.token !== expected.token
    || pending.workspaceId !== expected.workspaceId
    || pending.workspaceEpoch !== expected.workspaceEpoch
    || pending.bindingRevision !== expected.bindingRevision
    || pending.runtimeGeneration !== expected.runtimeGeneration) return false;
  const accepted = await pending.bindingReady;
  return Boolean(
    accepted
    && pendingWorkspaceExposure === pending
    && pending.token === workspaceExposureToken
  );
}

export async function acceptInstalledWorkspaceProjection(
  value: unknown,
  expected: Readonly<WorkspaceExposureSnapshot> | null,
  correlation: Readonly<{ workspaceId: string | null; workspaceEpoch: string | null }>,
  {
    deferPanelRediscovery = false,
    shouldCommit,
  }: { deferPanelRediscovery?: boolean; shouldCommit?: () => boolean } = {},
): Promise<boolean> {
  if (!canInstallWorkspaceProjection(value, expected, correlation)) return false;

  const pending = pendingWorkspaceExposure;
  if (!expected) {
    return true;
  }
  if (
    !pending
    || pending.token !== expected.token
    || pending.workspaceId !== expected.workspaceId
    || pending.workspaceEpoch !== expected.workspaceEpoch
    || pending.bindingRevision !== expected.bindingRevision
    || pending.runtimeGeneration !== expected.runtimeGeneration
    || pending.workspaceId !== correlation.workspaceId
    || pending.workspaceEpoch !== correlation.workspaceEpoch
  ) return false;
  const accepted = await pending.bindingReady;
  if (
    !accepted
    || pendingWorkspaceExposure !== pending
    || pending.token !== workspaceExposureToken
    || pending.token !== expected.token
  ) return false;
  if (pending.fallbackTimer) clearTimeout(pending.fallbackTimer);
  pendingWorkspaceExposure = null;
  if (pending.kind === 'switch' && pending.message) {
    applyWorkspaceSwitch(pending.message, true, deferPanelRediscovery, shouldCommit);
  } else {
    completeWorkspaceInit(pending.workspaceId, true);
  }
  return true;
}

function acceptClearedWorkspaceProjection(
  expected: Readonly<WorkspaceExposureSnapshot> | null,
  correlation: Readonly<{ workspaceId: string | null; workspaceEpoch: string | null }>,
): boolean {
  if (!expected) return true;
  const pending = pendingWorkspaceExposure;
  if (!pending
    || pending.token !== expected.token
    || pending.workspaceId !== expected.workspaceId
    || pending.workspaceEpoch !== expected.workspaceEpoch
    || pending.bindingRevision !== expected.bindingRevision
    || pending.runtimeGeneration !== expected.runtimeGeneration
    || pending.workspaceId !== correlation.workspaceId
    || pending.workspaceEpoch !== correlation.workspaceEpoch) return false;
  if (pending.fallbackTimer) clearTimeout(pending.fallbackTimer);
  pendingWorkspaceExposure = null;
  if (pending.kind === 'switch' && pending.message) {
    applyWorkspaceSwitch(pending.message, false);
  } else {
    completeWorkspaceInit(pending.workspaceId, false);
  }
  return true;
}

function clearUnavailableViewRegistryUi(): void {
  const panels = usePanelStore.getState();
  panels.setPanelConfigs([]);
  panels.setPanelRoots({});
  panels.setTabPolicies(null);
  panels.setViewRegistryUpdateError('View registry update was unavailable.');
}

function processViewRegistryFrame(
  workspaceMsg: WorkspaceWireMessage,
  context: WorkspaceMessageContext,
  source: 'panel_config' | 'registry_updated',
): void {
  const operation = beginViewRegistryUpdate(
    workspaceMsg.workspaceId ?? null,
    workspaceMsg.workspaceEpoch ?? null,
    context,
  );
  if (!operation) return;
  const { correlation, exposure } = operation;
  const wireCorrelation = {
    workspaceId: correlation.workspaceId,
    workspaceEpoch: correlation.workspaceEpoch,
  };
  void (async () => {
    if (!isCurrentViewRegistryUpdate(correlation, context)) return;
    if (!await awaitPendingWorkspaceBinding(exposure)) return;
    if (!isCurrentViewRegistryUpdate(correlation, context)) return;
    if (!canInstallWorkspaceProjection(workspaceMsg.viewCapsules, exposure, wireCorrelation)) {
      const cleared = await clearViewCapsuleProjection(context.runtimeGeneration);
      if (!isCurrentViewRegistryUpdate(correlation, context)) return;
      if (!cleared) {
        // The workspace loading gate remains closed when Electron cannot
        // acknowledge revocation. An already active rail still fails closed.
        if (!exposure) {
          const panels = usePanelStore.getState();
          panels.setPanelConfigs([]);
          panels.setPanelRoots({});
          // VIEW-02 Slice 1 advisory: tab policies ride the same projection
          // lifecycle as panelConfigs/panelRoots; clear them here too.
          panels.setTabPolicies(null);
        }
        return;
      }
      if (!acceptClearedWorkspaceProjection(exposure, wireCorrelation)) return;
      if (!isCurrentViewRegistryUpdate(correlation, context)) return;
      clearUnavailableViewRegistryUi();
      return;
    }
    if (!await forwardViewCapsuleProjection(
      workspaceMsg.viewCapsules,
      context.runtimeGeneration,
    )) return;
    if (!isCurrentViewRegistryUpdate(correlation, context)) return;
    if (!await acceptInstalledWorkspaceProjection(
      workspaceMsg.viewCapsules,
      exposure,
      wireCorrelation,
      {
        deferPanelRediscovery: source === 'registry_updated',
        shouldCommit: () => isCurrentViewRegistryUpdate(correlation, context),
      },
    )) return;
    if (!isCurrentViewRegistryUpdate(correlation, context)) return;

    const currentPanels = usePanelStore.getState();
    currentPanels.setViewRegistryUpdateError(null);
    if (source === 'panel_config') {
      if (workspaceMsg.projectRoot) currentPanels.setProjectRoot(workspaceMsg.projectRoot);
      if (workspaceMsg.panelRoots) currentPanels.setPanelRoots(workspaceMsg.panelRoots);
      // SPEC-02 §4: store the strict wire projection as received (post
      // envelope validation). Malformed/absent input parses to null = legacy.
      currentPanels.setTabPolicies(parseTabPolicyProjection(workspaceMsg.tabPolicies));
      return;
    }

    const ws = currentPanels.ws;
    if (!ws) return;
    try {
      await rediscoverPanels(ws, {
        preserveCurrent: true,
        chooseNearestIfMissing: true,
        shouldCommit: () => isCurrentViewRegistryUpdate(correlation, context),
      });
    } catch (err) {
      void err;
      console.error('[WS] workspace_rediscover_failed');
      if (isCurrentViewRegistryUpdate(correlation, context)) {
        usePanelStore.getState().setViewRegistryUpdateError('View registry updated, but the rail did not refresh.');
      }
    }
  })();
}

export function handleWorkspaceMessage(
  msg: WebSocketMessage,
  context: WorkspaceMessageContext = { runtimeGeneration: null, isStillCurrent: () => true },
): boolean {
  const store = useWorkspaceStore.getState();
  const workspaceMsg = msg as WorkspaceWireMessage;

  switch (msg.type) {
    case 'panel_config':
      // Uncorrelated panel_config frames are legacy per-panel root hints and do
      // not carry registry authority. Every workspace-correlated frame, even a
      // missing/malformed projection, participates in the shared operation.
      if (typeof workspaceMsg.workspaceId !== 'string'
        || typeof workspaceMsg.workspaceEpoch !== 'string') return false;
      processViewRegistryFrame(workspaceMsg, context, 'panel_config');
      return true;

    case 'workspace:init': {
      if (!isBindingRevision(workspaceMsg.bindingRevision)) return false;
      retirePendingWorkspaceExposure();
      const token = workspaceExposureToken;
      store.beginInit();
      console.log('[workspace-handlers] workspace:init received:', msg);
      const workspaces = msg.workspaces ?? [];
      const workspaceId = bindingWorkspaceId(msg, msg.activeWorkspaceId);
      retirePendingResourceProvenanceQueries();
      store.setWorkspaces(workspaces);
      store.applyWorkspaceBinding(
        workspaceId,
        workspaceMsg.workspaceEpoch ?? null,
        workspaceMsg.fileSaveProtocolVersion ?? null,
        workspaceMsg.resourceProvenanceProtocolVersion ?? null,
        workspaceMsg.fileViewerReadProtocolVersion ?? null,
        workspaceMsg.bindingRevision,
      );
      useFileDataStore.getState().beginWorkspaceGeneration(workspaceId, workspaceMsg.workspaceEpoch ?? null);
      store.setWorkspaceType(workspaceMsg.workspaceType ?? 'code');
      store.setSourceMachineName(workspaceMsg.sourceMachineName ?? 'local-machine');
      console.log('[workspace-handlers] activeWorkspaceId set to:', workspaceId);
      if (msg.homePath) store.setHomePath(msg.homePath);
      usePanelStore.getState().hydrateCliConfig(msg.cliConfig ?? {});
      usePanelStore.getState().hydrateThemes(workspaceMsg.themes ?? [], workspaceMsg.activeThemeId ?? null);
      // INSTANT_THEME_SWITCH: inject pre-loaded CSS synchronously if available
      if (workspaceMsg.styles) {
        injectWorkspaceStyles(workspaceMsg.styles);
      }
      // Hydrate workspace shell state from ai/<machine>/System/state/state.json.
      const workspaceStates = workspaceMsg.workspaceStates ?? {};
      for (const [wsId, snapshot] of Object.entries(workspaceStates)) {
        if (typeof snapshot === 'object' && snapshot !== null) {
          usePanelStore.getState().seedWorkspaceState(wsId, toWorkspacePanelStateSnapshot(snapshot));
        }
      }
      // If there's an active workspace on init, activate it so workspace shell
      // state loads immediately (avoids a blank-first-load after refresh).
      const activeId = workspaceId;
      if (activeId) {
        usePanelStore.getState().activateWorkspace(activeId);
        useFileStore.getState().activateWorkspace(activeId);
        useWikiStore.getState().activateWorkspace(activeId);
      }
      // Queue the acknowledged Electron binding before any request that can
      // produce panel_config. Projection installation is serialized behind it.
      const bindingReady = forwardWorkspaceBinding(
        workspaceId, workspaceMsg.bindingRevision, context.runtimeGeneration,
      );
      const pending: PendingWorkspaceExposure = {
        kind: 'init',
        token,
        message: null,
        workspaceId,
        workspaceEpoch: workspaceMsg.workspaceEpoch ?? null,
        bindingRevision: workspaceMsg.bindingRevision,
        runtimeGeneration: context.runtimeGeneration,
        bindingReady,
        bindingAccepted: null,
        fallbackTimer: null,
      };
      pendingWorkspaceExposure = pending;
      void bindingReady.then((accepted) => {
        pending.bindingAccepted = accepted;
        if (pendingWorkspaceExposure !== pending || pending.token !== workspaceExposureToken) return;
        if (workspaceId === null || workspaceMsg.viewRegistryUnavailable === true) {
          if (pending.fallbackTimer) clearTimeout(pending.fallbackTimer);
          if (!accepted) return;
          pendingWorkspaceExposure = null;
          completeWorkspaceInit(workspaceId, false);
        }
      });
      armWorkspaceExposureFallback(pending);
      // The socket deliberately sends no workspace-bound bootstrap traffic in
      // onopen. Now that the bind frame has been applied atomically, always
      // establish the panel and discover its workspace-scoped configuration.
      const panelStore = usePanelStore.getState();
      const wsConn = panelStore.ws;
      if (wsConn && wsConn.readyState === WebSocket.OPEN) {
        void bindingReady.then((accepted) => {
          if (!accepted) throw new Error('workspace_binding_unavailable');
          return bootstrapWorkspaceAfterBind(wsConn, panelStore.currentPanel);
        }).catch(() => console.error('[WS] workspace_bootstrap_failed'));
      }
      // Preload workspace icon SVGs from Fusion Home so the ribbon
      // renders inline SVGs instead of font glyphs on first paint.
      const iconNames = workspaces.map((w) => w.icon || 'folder').filter(Boolean);
      if (iconNames.length > 0) {
        preloadIcons(iconNames).catch(() => {});
      }

      // Re-request the thread list after workspace activation. A list may have
      // arrived before workspace:init and was intentionally prevented from
      // opening a thread whose state activation would immediately erase.
      const wsConn2 = usePanelStore.getState().ws;
      if (wsConn2 && wsConn2.readyState === WebSocket.OPEN) {
        wsConn2.send(JSON.stringify({ type: 'thread:list' }));
        // Request existing screenshots so the ribbon can show thumbnails immediately
        wsConn2.send(JSON.stringify({ type: 'screenshot:list' }));
      }
      return true;
    }

    case 'workspace:registry_changed': {
      const updatedWorkspaces = msg.workspaces ?? [];
      store.setWorkspaces(updatedWorkspaces);
      // Preload any newly added workspace icons
      const updatedIcons = updatedWorkspaces.map((w) => w.icon || 'folder').filter(Boolean);
      if (updatedIcons.length > 0) {
        preloadIcons(updatedIcons).catch(() => {});
      }
      return true;
    }

    case 'workspace:switched': {
      if (!isBindingRevision(workspaceMsg.bindingRevision)) return false;
      return beginWorkspaceSwitch(workspaceMsg, context.runtimeGeneration);
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
        useFileStore.getState().evictWorkspacePresentation(msg.workspaceId);
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
      processViewRegistryFrame(workspaceMsg, context, 'registry_updated');
      return true;
    }

    case 'workspace:view_update_rejected': {
      usePanelStore.getState().setViewRegistryUpdateError(msg.message || 'Unable to update view.');
      return true;
    }

    case 'workspace:unavailable_at_launch':
      // Silent — logged server-side.
      return true;

    case 'thread:state_changed':
      // Available for future UI (activity indicators). No-op today.
      return true;

    default:
      return false;
  }
}
