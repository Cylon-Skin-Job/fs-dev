import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseViewCapsuleProjection } from '../src/lib/view-capsule-projection';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function validProjection() {
  return {
    version: 1,
    workspaceId: 'workspace-123',
    machineIdentity: 'Test-Machine',
    entries: [
      { viewId: 'capture-viewer', folderName: '001-capture-viewer' },
      { viewId: 'file-viewer', folderName: '002-file-viewer' },
    ],
  };
}

class DelayedFirstRegistrySocket {
  private listeners = new Map<string, Set<(event: { data: string }) => void>>();
  private firstRegistryRequest: { panel: string; path: string; requestId: string } | null = null;
  private registryRequestCount = 0;
  private firstRegistryStartedResolver: (() => void) | null = null;
  readonly firstRegistryStarted = new Promise<void>((resolve) => {
    this.firstRegistryStartedResolver = resolve;
  });

  constructor(private readonly immediateRegistryViewId = 'file-viewer') {}

  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: { data: string }) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(raw: string): void {
    const request = JSON.parse(raw);
    if (request.type === 'file_content_request'
      && request.panel === '__workspace__'
      && request.path === 'views.json') {
      this.registryRequestCount += 1;
      if (this.registryRequestCount === 1) {
        this.firstRegistryRequest = request;
        this.firstRegistryStartedResolver?.();
        return;
      }
      this.respondToRegistry(request, this.immediateRegistryViewId);
      return;
    }
    if (request.type === 'file_tree_request') {
      this.emit('message', {
        type: 'file_tree_response', panel: request.panel, success: true, nodes: [],
      });
      return;
    }
    if (request.type === 'file_content_request') {
      this.emit('message', {
        type: 'file_content_response', panel: request.panel, path: request.path,
        requestId: request.requestId, success: false, error: 'fixture metadata absent',
      });
    }
  }

  releaseFirstRegistry(viewId = 'capture-viewer'): void {
    if (!this.firstRegistryRequest) throw new Error('first registry request has not started');
    const request = this.firstRegistryRequest;
    this.firstRegistryRequest = null;
    this.respondToRegistry(request, viewId);
  }

  private respondToRegistry(
    request: { panel: string; path: string; requestId: string },
    viewId: string,
  ): void {
    this.emit('message', {
      type: 'file_content_response', panel: request.panel, path: request.path,
      requestId: request.requestId, success: true,
      content: JSON.stringify({ version: 2, views: [{ id: viewId, enabled: true }] }),
    });
  }

  private emit(type: string, message: unknown): void {
    queueMicrotask(() => {
      const event = { data: JSON.stringify(message) };
      for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
    });
  }
}

async function settleAsyncPanelDiscovery(): Promise<void> {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('accepts and passively copies the exact path-free capsule projection', () => {
  const source = validProjection();
  const parsed = parseViewCapsuleProjection(source);
  expect(parsed).toEqual(source);
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed?.entries)).toBe(true);
  expect(JSON.stringify(parsed)).not.toContain('/');

  source.entries[0].viewId = 'mutated';
  expect(parsed?.entries[0].viewId).toBe('capture-viewer');
});

test('rejects path authority, invalid identities, basenames, duplicates, and excess entries', () => {
  const cases: unknown[] = [
    { ...validProjection(), capsuleRoot: '/forged' },
    { ...validProjection(), workspaceId: 'workspace\0id' },
    { ...validProjection(), machineIdentity: '..' },
    { ...validProjection(), entries: [{ viewId: 'Capture-Viewer', folderName: '001-capture-viewer' }] },
    { ...validProjection(), entries: [{ viewId: 'capture-viewer', folderName: '../capture-viewer' }] },
    { ...validProjection(), entries: [
      { viewId: 'capture-viewer', folderName: '001-capture-viewer' },
      { viewId: 'capture-viewer', folderName: '002-capture-viewer' },
    ] },
    { ...validProjection(), entries: [
      { viewId: 'capture-viewer', folderName: '001-capture-viewer' },
      { viewId: 'file-viewer', folderName: '001-capture-viewer' },
    ] },
    { ...validProjection(), entries: Array.from({ length: 257 }, (_, index) => ({
      viewId: `view-${index}`,
      folderName: `${index}-view`,
    })) },
  ];

  for (const value of cases) expect(parseViewCapsuleProjection(value)).toBeNull();
});

test('installs projections before panel roots or refreshed discovery become interactive', () => {
  const workspaceHandlers = fs.readFileSync(path.join(projectRoot, 'src/lib/ws/workspace-handlers.ts'), 'utf8');
  const projectionFrame = workspaceHandlers.slice(
    workspaceHandlers.indexOf('function processViewRegistryFrame('),
    workspaceHandlers.indexOf('export function handleWorkspaceMessage('),
  );
  expect(projectionFrame.indexOf('beginViewRegistryUpdate')).toBeGreaterThan(-1);
  expect(projectionFrame.indexOf('beginViewRegistryUpdate')).toBeLessThan(projectionFrame.indexOf('awaitPendingWorkspaceBinding'));
  expect(projectionFrame.indexOf('canInstallWorkspaceProjection')).toBeLessThan(projectionFrame.indexOf('forwardViewCapsuleProjection'));
  expect(projectionFrame.indexOf('forwardViewCapsuleProjection')).toBeLessThan(projectionFrame.indexOf('if (workspaceMsg.panelRoots)'));
  expect(projectionFrame.indexOf('clearViewCapsuleProjection')).toBeGreaterThan(-1);
  expect(projectionFrame.indexOf('forwardViewCapsuleProjection')).toBeLessThan(projectionFrame.indexOf('rediscoverPanels'));
  expect(projectionFrame.match(/isCurrentViewRegistryUpdate/g)?.length).toBeGreaterThanOrEqual(5);
  expect(workspaceHandlers).toContain('context.isStillCurrent()');
  expect(projectionFrame).toContain('context.runtimeGeneration');
});

test('workspace init and switch stay hidden until binding and matching projection are acknowledged', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const previousDocument = (globalThis as unknown as { document?: unknown }).document;
  const previousWebSocket = (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
  let resolveBinding: ((accepted: boolean) => void) | null = null;
  let projectionInstalled = false;
  const bindingCalls: Array<[string | null, number, string]> = [];
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        setWorkspaceBinding: (workspaceId: string | null, revision: number, generation: string) => {
          bindingCalls.push([workspaceId, revision, generation]);
          return new Promise<boolean>((resolve) => { resolveBinding = resolve; });
        },
        replaceViewCapsuleProjection: async () => {
          projectionInstalled = true;
          return true;
        },
      },
    },
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: () => undefined },
    },
    WebSocket: { OPEN: 1 },
  });

  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const projectionOwner = await import('../src/lib/view-capsule-projection');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const runtimeGeneration = 'generation-test-1';
    const messageContext = { runtimeGeneration, isStillCurrent: () => true };
    // Reset the full pre-init precondition, not just the visible fields: a
    // prior test file in the same Playwright worker can leave a bound store
    // (e.g. bindingRevision 3), which would make revision-1 traffic a stale
    // lower revision and early-return before beginInit().
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-old',
      workspaceEpoch: null,
      bindingRevision: null,
      hasReceivedInit: true,
    });
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-old',
      panelConfigs: [{ id: 'old-custom', type: 'custom-app' }] as never,
      panelRoots: { 'old-custom': '/old' },
      ws: null,
    });

    expect(handlers.handleWorkspaceMessage({
      type: 'workspace:switched', workspaceId: 'workspace-invalid', to: 'workspace-invalid',
      repoPath: '/private/tmp/workspace-invalid', workspaceEpoch: 'epoch-invalid', styles: {},
    }, messageContext)).toBe(false);
    expect(bindingCalls).toEqual([]);

    handlers.handleWorkspaceMessage({
      type: 'workspace:switched',
      workspaceId: 'workspace-new',
      bindingRevision: 1,
      to: 'workspace-new',
      repoPath: '/private/tmp/workspace-new',
      workspaceEpoch: 'epoch-new',
      styles: {},
    }, messageContext);
    await Promise.resolve();
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(false);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-old');
    expect(bindingCalls).toEqual([['workspace-new', 1, runtimeGeneration]]);
    const newExposure = handlers.capturePendingWorkspaceExposure();
    expect(newExposure).toMatchObject({ bindingRevision: 1 });
    expect(await handlers.acceptInstalledWorkspaceProjection(
      { ...validProjection(), workspaceId: 'workspace-stale' },
      newExposure,
      { workspaceId: 'workspace-new', workspaceEpoch: 'epoch-new' },
    )).toBe(false);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-old');

    resolveBinding?.(true);
    await Promise.resolve();
    const newProjection = { ...validProjection(), workspaceId: 'workspace-new' };
    expect(await projectionOwner.forwardViewCapsuleProjection(
      newProjection, runtimeGeneration,
    )).toBe(true);
    expect(projectionInstalled).toBe(true);
    expect(await handlers.acceptInstalledWorkspaceProjection(
      newProjection,
      newExposure,
      { workspaceId: 'workspace-new', workspaceEpoch: 'epoch-new' },
    )).toBe(true);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-new');
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(true);

    (globalThis.window as unknown as { electronAPI: { setWorkspaceBinding: () => Promise<boolean> } })
      .electronAPI.setWorkspaceBinding = async () => false;
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', workspaceId: 'workspace-rejected', to: 'workspace-rejected',
      bindingRevision: 2,
      repoPath: '/private/tmp/workspace-rejected', workspaceEpoch: 'epoch-rejected', styles: {},
    }, messageContext);
    await Promise.resolve();
    const rejectedExposure = handlers.capturePendingWorkspaceExposure();
    const rejectedProjection = { ...validProjection(), workspaceId: 'workspace-rejected' };
    expect(await projectionOwner.forwardViewCapsuleProjection(
      rejectedProjection, runtimeGeneration,
    )).toBe(true);
    expect(await handlers.acceptInstalledWorkspaceProjection(
      rejectedProjection,
      rejectedExposure,
      { workspaceId: 'workspace-rejected', workspaceEpoch: 'epoch-rejected' },
    )).toBe(false);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-new');
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(false);

    (globalThis.window as unknown as { electronAPI: { setWorkspaceBinding: () => Promise<boolean> } })
      .electronAPI.setWorkspaceBinding = async () => true;
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', workspaceId: 'workspace-missing', to: 'workspace-missing',
      bindingRevision: 3,
      repoPath: '/private/tmp/workspace-missing', workspaceEpoch: 'epoch-missing', styles: {},
    }, messageContext);
    await new Promise((resolve) => setTimeout(resolve, 5100));
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-missing');
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(true);
    expect(usePanelStore.getState().panelConfigs).toEqual([]);
    expect(usePanelStore.getState().panelRoots).toEqual({});

    let resolveInitBinding: ((accepted: boolean) => void) | null = null;
    (globalThis.window as unknown as { electronAPI: { setWorkspaceBinding: () => Promise<boolean> } })
      .electronAPI.setWorkspaceBinding = () => new Promise<boolean>((resolve) => {
        resolveInitBinding = resolve;
      });
    handlers.handleWorkspaceMessage({
      type: 'workspace:init',
      bindingRevision: 4,
      workspaceId: 'workspace-init',
      activeWorkspaceId: 'workspace-init',
      activeRepoPath: '/private/tmp/workspace-init',
      workspaceEpoch: 'epoch-init',
      workspaces: [{
        id: 'workspace-init', label: 'Init', icon: 'folder', description: null,
        repoPath: '/private/tmp/workspace-init', sortOrder: 0,
      }],
      styles: {},
    }, messageContext);
    await Promise.resolve();
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-init');
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(false);
    const initExposure = handlers.capturePendingWorkspaceExposure();
    expect(await handlers.acceptInstalledWorkspaceProjection(
      { ...validProjection(), workspaceId: 'workspace-stale-init' },
      initExposure,
      { workspaceId: 'workspace-init', workspaceEpoch: 'epoch-init' },
    )).toBe(false);

    resolveInitBinding?.(true);
    await Promise.resolve();
    const initProjection = { ...validProjection(), workspaceId: 'workspace-init' };
    expect(await projectionOwner.forwardViewCapsuleProjection(
      initProjection, runtimeGeneration,
    )).toBe(true);
    expect(await handlers.acceptInstalledWorkspaceProjection(
      initProjection,
      initExposure,
      { workspaceId: 'workspace-init', workspaceEpoch: 'epoch-init' },
    )).toBe(true);
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(true);

    (globalThis.window as unknown as { electronAPI: { setWorkspaceBinding: () => Promise<boolean> } })
      .electronAPI.setWorkspaceBinding = async () => true;
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', workspaceId: 'workspace-a', to: 'workspace-a',
      bindingRevision: 5,
      repoPath: '/private/tmp/workspace-a', workspaceEpoch: 'epoch-a1', styles: {},
    }, messageContext);
    const oldExposure = handlers.capturePendingWorkspaceExposure();
    const oldProjection = { ...validProjection(), workspaceId: 'workspace-a' };
    const oldInstall = projectionOwner.forwardViewCapsuleProjection(
      oldProjection, runtimeGeneration,
    );
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', workspaceId: 'workspace-b', to: 'workspace-b',
      bindingRevision: 6,
      repoPath: '/private/tmp/workspace-b', workspaceEpoch: 'epoch-b', styles: {},
    }, messageContext);
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', workspaceId: 'workspace-a', to: 'workspace-a',
      bindingRevision: 7,
      repoPath: '/private/tmp/workspace-a', workspaceEpoch: 'epoch-a2', styles: {},
    }, messageContext);
    expect(await oldInstall).toBe(false);
    await Promise.resolve();
    expect(await handlers.acceptInstalledWorkspaceProjection(
      oldProjection,
      oldExposure,
      { workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a1' },
    )).toBe(false);
    expect(useWorkspaceStore.getState().hasReceivedInit).toBe(false);
    const currentExposure = handlers.capturePendingWorkspaceExposure();
    expect(currentExposure).toMatchObject({
      workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a2', bindingRevision: 7,
    });
    expect(handlers.canInstallWorkspaceProjection(
      oldProjection,
      oldExposure,
      { workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a1' },
    )).toBe(false);
    expect(await projectionOwner.forwardViewCapsuleProjection(
      oldProjection, runtimeGeneration,
    )).toBe(true);
    expect(await handlers.acceptInstalledWorkspaceProjection(
      oldProjection,
      currentExposure,
      { workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a2' },
    )).toBe(true);

    let lastRegistryProjection: unknown = 'not-called';
    (globalThis.window as unknown as {
      electronAPI: { replaceViewCapsuleProjection: (projection: unknown) => Promise<boolean> };
    }).electronAPI.replaceViewCapsuleProjection = async (projection) => {
      lastRegistryProjection = projection;
      return true;
    };
    usePanelStore.setState({
      panelConfigs: [{ id: 'stale-custom', type: 'custom-app' }] as never,
      panelRoots: { 'stale-custom': '/stale' },
    });
    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-a',
      workspaceEpoch: 'epoch-a2',
      registry: { version: 2 },
    }, messageContext);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastRegistryProjection).toBeNull();
    expect(usePanelStore.getState().panelConfigs).toEqual([]);
    expect(usePanelStore.getState().panelRoots).toEqual({});

    lastRegistryProjection = 'not-called';
    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-stale',
      workspaceEpoch: 'epoch-stale',
      registry: { version: 2 },
    }, messageContext);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lastRegistryProjection).toBe('not-called');
  } finally {
    Object.assign(globalThis, {
      window: previousWindow,
      document: previousDocument,
      WebSocket: previousWebSocket,
    });
  }
});

test('connection retirement invalidates queued and in-flight projection installations', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  let releaseOld: ((accepted: boolean) => void) | null = null;
  let announceOld: (() => void) | null = null;
  const oldStarted = new Promise<void>((resolve) => { announceOld = resolve; });
  let delayedOld = false;
  const installedGenerations: string[] = [];
  const bindingCalls: Array<[string | null, number, string]> = [];
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        setWorkspaceBinding: async (workspaceId: string | null, revision: number, generation: string) => {
          bindingCalls.push([workspaceId, revision, generation]);
          return true;
        },
        replaceViewCapsuleProjection: async (_projection: unknown, generation: string) => {
          installedGenerations.push(generation);
          if (generation === 'generation-old' && !delayedOld) {
            delayedOld = true;
            return new Promise<boolean>((resolve) => {
              releaseOld = resolve;
              announceOld?.();
            });
          }
          return true;
        },
      },
    },
  });

  try {
    const owner = await import('../src/lib/view-capsule-projection');
    const oldInstall = owner.forwardViewCapsuleProjection(validProjection(), 'generation-old');
    await oldStarted;
    const queuedOld = owner.forwardViewCapsuleProjection(validProjection(), 'generation-old');
    expect(await owner.forwardWorkspaceBinding(
      'workspace-new', 1, 'generation-old',
    )).toBe(true);
    expect(bindingCalls).toEqual([
      ['workspace-new', 1, 'generation-old'],
    ]);
    releaseOld?.(true);
    expect(await oldInstall).toBe(false);
    expect(await queuedOld).toBe(false);
    expect(await owner.forwardViewCapsuleProjection(
      validProjection(), 'generation-old',
    )).toBe(true);
    expect(installedGenerations).toEqual(['generation-old', 'generation-old']);

    const retiredBeforeStart = owner.forwardViewCapsuleProjection(
      validProjection(), 'generation-old',
    );
    owner.retireViewCapsuleProjectionInstallations();
    expect(await retiredBeforeStart).toBe(false);
  } finally {
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('stale lower workspace revision cannot retire a newer visible binding', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  const calls: Array<[string | null, number, string]> = [];
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        setWorkspaceBinding: async (workspaceId: string | null, revision: number, generation: string) => {
          calls.push([workspaceId, revision, generation]);
          return true;
        },
      },
    },
  });
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    handlers.retirePendingWorkspaceExposure();
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a3',
      bindingRevision: 3, hasReceivedInit: true,
    });
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      panelConfigs: [{ id: 'current-a', type: 'custom-app' }] as never,
      panelRoots: { 'current-a': '/workspace-a/current' },
      viewRegistryUpdateError: null,
      ws: null,
    });
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };

    expect(handlers.handleWorkspaceMessage({
      type: 'workspace:switched', bindingRevision: 2,
      workspaceId: 'workspace-b', to: 'workspace-b', workspaceEpoch: 'epoch-b2',
      repoPath: '/workspace-b', styles: {},
    }, context)).toBe(false);
    expect(calls).toEqual([]);
    expect(useWorkspaceStore.getState()).toMatchObject({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a3',
      bindingRevision: 3, hasReceivedInit: true,
    });
    expect(usePanelStore.getState()).toMatchObject({
      panelConfigs: [{ id: 'current-a', type: 'custom-app' }],
      panelRoots: { 'current-a': '/workspace-a/current' },
      viewRegistryUpdateError: null,
    });

    expect(handlers.handleWorkspaceMessage({
      type: 'workspace:switched', bindingRevision: 4,
      workspaceId: 'workspace-a', to: 'workspace-a', workspaceEpoch: 'epoch-a4',
      repoPath: '/workspace-a', styles: {},
    }, context)).toBe(true);
    await Promise.resolve();
    expect(calls).toEqual([['workspace-a', 4, 'generation-current']]);
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('delayed unavailable update cannot clear a newer same-workspace projection UI', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  let announceClear: (() => void) | null = null;
  let releaseClear: ((accepted: boolean) => void) | null = null;
  const clearStarted = new Promise<void>((resolve) => { announceClear = resolve; });
  let delayedClear = true;
  const projectionCalls: unknown[] = [];
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        replaceViewCapsuleProjection: (projection: unknown) => {
          projectionCalls.push(projection);
          if (projection === null && delayedClear) {
            delayedClear = false;
            announceClear?.();
            return new Promise<boolean>((resolve) => { releaseClear = resolve; });
          }
          return Promise.resolve(true);
        },
      },
    },
  });

  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const generation = 'generation-current';
    const context = { runtimeGeneration: generation, isStillCurrent: () => true };
    handlers.retirePendingWorkspaceExposure();
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
    });
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      panelConfigs: [{ id: 'workspace-a-custom', type: 'custom-app' }] as never,
      panelRoots: { 'workspace-a-custom': '/workspace-a' },
      viewRegistryUpdateError: null,
      ws: null,
    });

    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-a',
      workspaceEpoch: 'epoch-a',
      registry: { version: 2 },
    }, context);
    await clearStarted;

    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a',
      panelConfigs: [{ id: 'workspace-a-newest', type: 'custom-app' }] as never,
      panelRoots: { 'workspace-a-newest': '/workspace-a-newest' },
      viewRegistryUpdateError: null,
      ws: null,
    });
    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-a',
      workspaceEpoch: 'epoch-a',
      viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
      registry: { version: 2 },
    }, context);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(projectionCalls).toEqual([
      null,
      { ...validProjection(), workspaceId: 'workspace-a' },
    ]);

    releaseClear?.(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useWorkspaceStore.getState()).toMatchObject({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
    });
    expect(usePanelStore.getState()).toMatchObject({
      activeWorkspaceId: 'workspace-a',
      panelConfigs: [{ id: 'workspace-a-newest', type: 'custom-app' }],
      panelRoots: { 'workspace-a-newest': '/workspace-a-newest' },
      viewRegistryUpdateError: null,
    });
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('newer missing or malformed update stays cleared after an older valid install resolves', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const generation = 'generation-current';
    const context = { runtimeGeneration: generation, isStillCurrent: () => true };

    for (const unavailable of ['missing', 'malformed'] as const) {
      let announceValid: (() => void) | null = null;
      let releaseValid: ((accepted: boolean) => void) | null = null;
      const validStarted = new Promise<void>((resolve) => { announceValid = resolve; });
      let delayedValid = true;
      const projectionCalls: unknown[] = [];
      Object.assign(globalThis, {
        window: {
          electronAPI: {
            replaceViewCapsuleProjection: (projection: unknown) => {
              projectionCalls.push(projection);
              if (projection !== null && delayedValid) {
                delayedValid = false;
                announceValid?.();
                return new Promise<boolean>((resolve) => { releaseValid = resolve; });
              }
              return Promise.resolve(true);
            },
          },
        },
      });
      handlers.retirePendingWorkspaceExposure();
      useWorkspaceStore.setState({
        activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
      });
      usePanelStore.setState({
        activeWorkspaceId: 'workspace-a',
        panelConfigs: [{ id: 'workspace-a-old', type: 'custom-app' }] as never,
        panelRoots: { 'workspace-a-old': '/workspace-a-old' },
        viewRegistryUpdateError: null,
        ws: null,
      });

      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-a',
        workspaceEpoch: 'epoch-a',
        viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
        registry: { version: 2 },
      }, context);
      await validStarted;
      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-a',
        workspaceEpoch: 'epoch-a',
        ...(unavailable === 'malformed' ? { viewCapsules: { version: 1 } } : {}),
        registry: { version: 3 },
      }, context);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(projectionCalls).toEqual([
        { ...validProjection(), workspaceId: 'workspace-a' },
        null,
      ]);
      expect(usePanelStore.getState()).toMatchObject({
        panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: 'View registry update was unavailable.',
      });

      releaseValid?.(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(usePanelStore.getState()).toMatchObject({
        panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: 'View registry update was unavailable.',
      });
    }

    usePanelStore.setState({
      panelConfigs: [{ id: 'retained-after-rejection', type: 'custom-app' }] as never,
      panelRoots: { 'retained-after-rejection': '/retained' },
      viewRegistryUpdateError: null,
    });
    handlers.handleWorkspaceMessage({
      type: 'workspace:view_update_rejected', message: 'Mutation rejected',
    }, context);
    expect(usePanelStore.getState()).toMatchObject({
      panelConfigs: [{ id: 'retained-after-rejection', type: 'custom-app' }],
      panelRoots: { 'retained-after-rejection': '/retained' },
      viewRegistryUpdateError: 'Mutation rejected',
    });
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('newer unavailable update stays cleared after older accepted projection rediscovery resolves', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  Object.assign(globalThis, {
    window: { electronAPI: { replaceViewCapsuleProjection: async () => true } },
  });
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };
    for (const unavailable of ['missing', 'malformed'] as const) {
      const socket = new DelayedFirstRegistrySocket();
      handlers.retirePendingWorkspaceExposure();
      useWorkspaceStore.setState({
        activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
      });
      usePanelStore.setState({
        activeWorkspaceId: 'workspace-a',
        panelConfigs: [{ id: 'old-view', type: 'custom-app' }] as never,
        panelRoots: { 'old-view': '/old' },
        viewRegistryUpdateError: null,
        ws: socket as unknown as WebSocket,
      });

      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
        registry: { version: 2 },
      }, context);
      await socket.firstRegistryStarted;

      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        ...(unavailable === 'malformed' ? { viewCapsules: { version: 1 } } : {}),
        registry: { version: 3 },
      }, context);
      await settleAsyncPanelDiscovery();
      expect(usePanelStore.getState()).toMatchObject({
        panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: 'View registry update was unavailable.',
      });

      socket.releaseFirstRegistry('capture-viewer');
      await settleAsyncPanelDiscovery();
      expect(usePanelStore.getState()).toMatchObject({
        panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: 'View registry update was unavailable.',
      });
    }
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('newer unavailable update stays cleared after bootstrap panel rediscovery resolves', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        setWorkspaceBinding: async () => true,
        replaceViewCapsuleProjection: async () => true,
      },
    },
  });
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };
    for (const unavailable of ['missing', 'malformed'] as const) {
      const socket = new DelayedFirstRegistrySocket();
      handlers.retirePendingWorkspaceExposure();
      useWorkspaceStore.setState({
        activeWorkspaceId: 'workspace-old', workspaceEpoch: 'epoch-old', hasReceivedInit: true,
      });
      usePanelStore.setState({
        activeWorkspaceId: 'workspace-old', panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: null, ws: socket as unknown as WebSocket,
      });
      handlers.handleWorkspaceMessage({
        type: 'workspace:switched', bindingRevision: 1, to: 'workspace-a', repoPath: '/workspace-a',
        workspaceEpoch: 'epoch-a',
      }, context);
      handlers.handleWorkspaceMessage({
        type: 'panel_config', workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        panelRoots: { 'panel-a': '/workspace-a/panel-a' },
        viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
      }, context);
      await socket.firstRegistryStarted;

      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated', workspaceId: 'workspace-a',
        workspaceEpoch: 'epoch-a', registry: { version: 3 },
        ...(unavailable === 'malformed' ? { viewCapsules: { version: 1 } } : {}),
      }, context);
      await settleAsyncPanelDiscovery();
      expect(usePanelStore.getState()).toMatchObject({
        panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: 'View registry update was unavailable.',
      });
      socket.releaseFirstRegistry('capture-viewer');
      await settleAsyncPanelDiscovery();
      expect(usePanelStore.getState()).toMatchObject({
        panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: 'View registry update was unavailable.',
      });
    }
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('newer valid update survives older accepted projection rediscovery completion', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  Object.assign(globalThis, {
    window: { electronAPI: { replaceViewCapsuleProjection: async () => true } },
  });
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const socket = new DelayedFirstRegistrySocket('file-viewer');
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };
    handlers.retirePendingWorkspaceExposure();
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
    });
    usePanelStore.setState({
      activeWorkspaceId: 'workspace-a', panelConfigs: [], panelRoots: {},
      viewRegistryUpdateError: null, ws: socket as unknown as WebSocket,
    });

    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
      viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
      registry: { version: 2 },
    }, context);
    await socket.firstRegistryStarted;
    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
      viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
      registry: { version: 3 },
    }, context);
    await settleAsyncPanelDiscovery();
    expect(usePanelStore.getState()).toMatchObject({
      panelConfigs: [expect.objectContaining({ id: 'file-viewer' })],
      viewRegistryUpdateError: null,
    });

    socket.releaseFirstRegistry('capture-viewer');
    await settleAsyncPanelDiscovery();
    expect(usePanelStore.getState()).toMatchObject({
      panelConfigs: [expect.objectContaining({ id: 'file-viewer' })],
      viewRegistryUpdateError: null,
    });
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('newer registry update wins over an in-flight bootstrap panel projection', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };

    for (const newer of ['valid', 'missing', 'malformed'] as const) {
      let releasePanel: ((accepted: boolean) => void) | null = null;
      let announcePanel: (() => void) | null = null;
      const panelStarted = new Promise<void>((resolve) => { announcePanel = resolve; });
      let delayFirstProjection = true;
      Object.assign(globalThis, {
        window: {
          electronAPI: {
            setWorkspaceBinding: async () => true,
            replaceViewCapsuleProjection: (projection: unknown) => {
              if (projection !== null && delayFirstProjection) {
                delayFirstProjection = false;
                announcePanel?.();
                return new Promise<boolean>((resolve) => { releasePanel = resolve; });
              }
              return Promise.resolve(true);
            },
          },
        },
      });
      handlers.retirePendingWorkspaceExposure();
      useWorkspaceStore.setState({
        activeWorkspaceId: 'workspace-old', workspaceEpoch: 'epoch-old', hasReceivedInit: true,
      });
      usePanelStore.setState({
        activeWorkspaceId: 'workspace-old', panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: null, ws: null,
      });
      handlers.handleWorkspaceMessage({
        type: 'workspace:switched', bindingRevision: 1, to: 'workspace-a', repoPath: '/workspace-a',
        workspaceEpoch: 'epoch-a',
      }, context);
      handlers.handleWorkspaceMessage({
        type: 'panel_config', workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        projectRoot: '/workspace-a', panelRoots: { 'panel-a': '/workspace-a/panel-a' },
        viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
      }, context);
      await panelStarted;

      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        ...(newer === 'valid'
          ? { viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' } }
          : newer === 'malformed' ? { viewCapsules: { version: 1 } } : {}),
        registry: { version: 3 },
      }, context);
      if (newer !== 'valid') await settleAsyncPanelDiscovery();
      releasePanel?.(true);
      await settleAsyncPanelDiscovery();

      expect(handlers.capturePendingWorkspaceExposure()).toBeNull();
      expect(useWorkspaceStore.getState()).toMatchObject({
        activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
      });
      expect(usePanelStore.getState().panelRoots).not.toHaveProperty('panel-a');
      if (newer === 'valid') {
        expect(usePanelStore.getState().viewRegistryUpdateError).toBeNull();
      } else {
        expect(usePanelStore.getState()).toMatchObject({
          panelConfigs: [], panelRoots: {},
          viewRegistryUpdateError: 'View registry update was unavailable.',
        });
      }
    }
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('newer bootstrap panel projection wins over an in-flight registry update', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };

    for (const newer of ['valid', 'missing', 'malformed'] as const) {
      let releaseUpdate: ((accepted: boolean) => void) | null = null;
      let announceUpdate: (() => void) | null = null;
      const updateStarted = new Promise<void>((resolve) => { announceUpdate = resolve; });
      let delayFirstProjection = true;
      Object.assign(globalThis, {
        window: {
          electronAPI: {
            setWorkspaceBinding: async () => true,
            replaceViewCapsuleProjection: (projection: unknown) => {
              if (projection !== null && delayFirstProjection) {
                delayFirstProjection = false;
                announceUpdate?.();
                return new Promise<boolean>((resolve) => { releaseUpdate = resolve; });
              }
              return Promise.resolve(true);
            },
          },
        },
      });
      handlers.retirePendingWorkspaceExposure();
      useWorkspaceStore.setState({
        activeWorkspaceId: 'workspace-old', workspaceEpoch: 'epoch-old', hasReceivedInit: true,
      });
      usePanelStore.setState({
        activeWorkspaceId: 'workspace-old', panelConfigs: [], panelRoots: {},
        viewRegistryUpdateError: null, ws: null,
      });
      handlers.handleWorkspaceMessage({
        type: 'workspace:switched', bindingRevision: 1, to: 'workspace-a', repoPath: '/workspace-a',
        workspaceEpoch: 'epoch-a',
      }, context);
      handlers.handleWorkspaceMessage({
        type: 'workspace:view_registry_updated',
        workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
        registry: { version: 2 },
      }, context);
      await updateStarted;

      handlers.handleWorkspaceMessage({
        type: 'panel_config', workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
        projectRoot: '/workspace-a',
        ...(newer === 'valid'
          ? {
              panelRoots: { 'panel-b': '/workspace-a/panel-b' },
              viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
            }
          : newer === 'malformed'
            ? { viewCapsules: { version: 1 } }
            : { viewRegistryUnavailable: true }),
      }, context);
      if (newer !== 'valid') await settleAsyncPanelDiscovery();
      releaseUpdate?.(true);
      await settleAsyncPanelDiscovery();

      expect(handlers.capturePendingWorkspaceExposure()).toBeNull();
      expect(useWorkspaceStore.getState()).toMatchObject({
        activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
      });
      if (newer === 'valid') {
        expect(usePanelStore.getState()).toMatchObject({
          panelRoots: { 'panel-b': '/workspace-a/panel-b' },
          viewRegistryUpdateError: null,
        });
      } else {
        expect(usePanelStore.getState()).toMatchObject({
          panelConfigs: [], panelRoots: {},
          viewRegistryUpdateError: 'View registry update was unavailable.',
        });
      }
    }
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('one valid bootstrap panel projection completes its exact pending exposure', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        setWorkspaceBinding: async () => true,
        replaceViewCapsuleProjection: async () => true,
      },
    },
  });
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    const context = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };
    handlers.retirePendingWorkspaceExposure();
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-old', workspaceEpoch: 'epoch-old', hasReceivedInit: true,
    });
    usePanelStore.setState({ activeWorkspaceId: 'workspace-old', ws: null });
    handlers.handleWorkspaceMessage({
      type: 'workspace:switched', bindingRevision: 1, to: 'workspace-a', repoPath: '/workspace-a',
      workspaceEpoch: 'epoch-a',
    }, context);
    handlers.handleWorkspaceMessage({
      type: 'panel_config', workspaceId: 'workspace-a', workspaceEpoch: 'epoch-a',
      projectRoot: '/workspace-a', panelRoots: { 'panel-a': '/workspace-a/panel-a' },
      viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
    }, context);
    await settleAsyncPanelDiscovery();
    expect(handlers.capturePendingWorkspaceExposure()).toBeNull();
    expect(useWorkspaceStore.getState()).toMatchObject({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-a', bindingRevision: 1, hasReceivedInit: true,
    });
    expect(usePanelStore.getState().panelRoots).toEqual({ 'panel-a': '/workspace-a/panel-a' });
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('stale workspace epoch and retired-generation frames do not invalidate the current projection operation', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  let releaseCurrent: ((accepted: boolean) => void) | null = null;
  let announceCurrent: (() => void) | null = null;
  const currentStarted = new Promise<void>((resolve) => { announceCurrent = resolve; });
  const projectionCalls: unknown[] = [];
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        replaceViewCapsuleProjection: (projection: unknown) => {
          projectionCalls.push(projection);
          if (projection !== null && !releaseCurrent) {
            announceCurrent?.();
            return new Promise<boolean>((resolve) => { releaseCurrent = resolve; });
          }
          return Promise.resolve(true);
        },
      },
    },
  });
  try {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    const { useWorkspaceStore } = await import('../src/state/workspaceStore');
    const { usePanelStore } = await import('../src/state/panelStore');
    handlers.retirePendingWorkspaceExposure();
    useWorkspaceStore.setState({
      activeWorkspaceId: 'workspace-a', workspaceEpoch: 'epoch-current', hasReceivedInit: true,
    });
    usePanelStore.setState({ activeWorkspaceId: 'workspace-a', panelRoots: {}, ws: null });
    const currentContext = { runtimeGeneration: 'generation-current', isStillCurrent: () => true };
    handlers.handleWorkspaceMessage({
      type: 'panel_config', workspaceId: 'workspace-a', workspaceEpoch: 'epoch-current',
      panelRoots: { current: '/workspace-a/current' },
      viewCapsules: { ...validProjection(), workspaceId: 'workspace-a' },
    }, currentContext);
    await currentStarted;

    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated', workspaceId: 'workspace-stale',
      workspaceEpoch: 'epoch-current', registry: { version: 3 },
    }, currentContext);
    handlers.handleWorkspaceMessage({
      type: 'panel_config', workspaceId: 'workspace-a', workspaceEpoch: 'epoch-stale',
      viewRegistryUnavailable: true,
    }, currentContext);
    handlers.handleWorkspaceMessage({
      type: 'workspace:view_registry_updated', workspaceId: 'workspace-a',
      workspaceEpoch: 'epoch-current', registry: { version: 4 },
    }, { runtimeGeneration: 'generation-retired', isStillCurrent: () => false });
    await settleAsyncPanelDiscovery();
    expect(projectionCalls).toHaveLength(1);

    releaseCurrent?.(true);
    await settleAsyncPanelDiscovery();
    expect(usePanelStore.getState()).toMatchObject({
      panelRoots: { current: '/workspace-a/current' },
      viewRegistryUpdateError: null,
    });
  } finally {
    const handlers = await import('../src/lib/ws/workspace-handlers');
    handlers.retirePendingWorkspaceExposure();
    Object.assign(globalThis, { window: previousWindow });
  }
});

test('unavailable projection clears immediately ahead of delayed verification', async () => {
  const previousWindow = (globalThis as unknown as { window?: unknown }).window;
  let releaseVerification: ((accepted: boolean) => void) | null = null;
  let announceVerification: (() => void) | null = null;
  const verificationStarted = new Promise<void>((resolve) => { announceVerification = resolve; });
  const calls: unknown[] = [];
  Object.assign(globalThis, {
    window: {
      electronAPI: {
        replaceViewCapsuleProjection: (projection: unknown) => {
          calls.push(projection);
          if (projection !== null) {
            return new Promise<boolean>((resolve) => {
              releaseVerification = resolve;
              announceVerification?.();
            });
          }
          return Promise.resolve(true);
        },
      },
    },
  });
  try {
    const owner = await import('../src/lib/view-capsule-projection');
    const delayed = owner.forwardViewCapsuleProjection(validProjection(), 'generation-current');
    await verificationStarted;
    expect(await owner.forwardViewCapsuleProjection(null, 'generation-current')).toBe(false);
    expect(calls).toEqual([validProjection(), null]);
    releaseVerification?.(true);
    expect(await delayed).toBe(false);
  } finally {
    Object.assign(globalThis, { window: previousWindow });
  }
});
