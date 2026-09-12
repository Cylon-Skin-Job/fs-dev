'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeManifest(folder, viewId) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'manifest.md'), [
    '---',
    `name: ${viewId}`,
    'metadata:',
    `  view-id: ${viewId}`,
    '---',
    '',
  ].join('\n'));
}

function createWs(projectRoot) {
  return {
    projectRoot,
    readyState: 1,
    sent: [],
    send(message) { this.sent.push(JSON.parse(message)); },
  };
}

function createSession(projectRoot, role) {
  const session = { projectRoot, currentWorkspaceId: 'workspace-state-test' };
  Object.defineProperty(session, 'connectionRole', { value: role, enumerable: false });
  return session;
}

describe('protected public view-state routes', () => {
  let projectRoot;
  let previousMachine;
  let createWorkspaceRequestHandlers;
  let registeredView;
  let consoleErrorSpy;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
    projectRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-protected-view-state-')));
    registeredView = path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-capture-viewer');
    writeManifest(registeredView, 'capture-viewer');
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.resetModules();
    const readiness = require('../../lib/views/readiness-runtime');
    const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
    const coordinator = createViewReadinessCoordinator({
      machineIdentity: 'Test-Machine',
      migrationService: {
        ensureReady: async (request) => ({
          ...request,
          status: 'verified',
          destinationRoot: path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views'),
        }),
      },
    });
    readiness.installViewReadinessOwner(coordinator);
    await readiness.ensureWorkspaceViewReadiness({ workspaceId: 'workspace-state-test', projectRoot });
    ({ createWorkspaceRequestHandlers } = require('../../lib/ws/workspace-request-handlers'));
  });

  afterEach(() => {
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(projectRoot, { recursive: true, force: true });
    consoleErrorSpy.mockRestore();
    jest.resetModules();
  });

  function handlersFor(role) {
    const ws = createWs(projectRoot);
    const session = createSession(projectRoot, role);
    return {
      ws,
      handlers: createWorkspaceRequestHandlers({ ws, session, getAllClients: () => [] }),
    };
  }

  test('untrusted state:get reports bounded unavailable for conflicting roots without seeding', async () => {
    const protectedState = path.join(
      projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '009-canonical', 'state',
    );
    fs.mkdirSync(protectedState, { recursive: true });
    const systemRoot = path.join(projectRoot, 'ai', 'Test-Machine', 'System');
    fs.symlinkSync(protectedState, path.join(systemRoot, 'state'), 'dir');
    const { ws, handlers } = handlersFor('untrusted');

    await handlers['state:get']({ type: 'state:get', view: 'capture-viewer', requestId: 'read-only' });

    expect(ws.sent).toEqual([{
      type: 'state:error',
      view: 'capture-viewer',
      requestId: 'read-only',
      workspaceId: 'workspace-state-test',
      message: 'Unable to read state',
    }]);
    expect(fs.existsSync(path.join(protectedState, 'state.json'))).toBe(false);
    expect(fs.lstatSync(path.join(systemRoot, 'state')).isSymbolicLink()).toBe(true);
  });

  test.each(['made-up-view', '../System/Views/001-capture', 'Capture-Viewer']) (
    'trusted state:set rejects unregistered or noncanonical request view %p without effects',
    async (view) => {
      const { ws, handlers } = handlersFor('trusted-shell');

      await handlers['state:set']({
        type: 'state:set', view, state: { activity: { tabs: [{ id: 'forged' }] } },
      });

      expect(ws.sent).toEqual([expect.objectContaining({ type: 'state:error', view })]);
      expect(fs.existsSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'state'))).toBe(false);
      expect(fs.readdirSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views'))).toEqual([
        '001-capture-viewer',
      ]);
    },
  );

  test('trusted state:set rejects duplicate manifest identity before effects', async () => {
    writeManifest(
      path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-duplicate'),
      'capture-viewer',
    );
    const { ws, handlers } = handlersFor('trusted-shell');

    await handlers['state:set']({
      type: 'state:set', view: 'capture-viewer', state: { activity: { activeTabId: 'forged' } },
    });

    expect(ws.sent).toEqual([expect.objectContaining({ type: 'state:error', view: 'capture-viewer' })]);
    expect(fs.existsSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'state'))).toBe(false);
    expect(fs.existsSync(path.join(registeredView, 'state'))).toBe(false);
  });

  test('trusted state:set preflights workspace and capsule destinations before either write', async () => {
    const protectedState = path.join(
      projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '009-canonical', 'state',
    );
    fs.mkdirSync(protectedState, { recursive: true });
    fs.symlinkSync(protectedState, path.join(registeredView, 'state'), 'dir');
    const { ws, handlers } = handlersFor('trusted-shell');

    await handlers['state:set']({
      type: 'state:set', view: 'capture-viewer', state: { activity: { activeTabId: 'forged' } },
    });

    expect(ws.sent).toEqual([expect.objectContaining({ type: 'state:error', view: 'capture-viewer' })]);
    expect(fs.existsSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'state'))).toBe(false);
    expect(fs.existsSync(path.join(protectedState, 'state.json'))).toBe(false);
  });

  test('trusted state:set rejects a symlinked registered capsule before either batch write', async () => {
    const externalCapsule = path.join(projectRoot, 'external-capsule');
    fs.rmSync(registeredView, { recursive: true, force: true });
    writeManifest(externalCapsule, 'capture-viewer');
    fs.symlinkSync(externalCapsule, registeredView, 'dir');
    const { ws, handlers } = handlersFor('trusted-shell');

    await handlers['state:set']({
      type: 'state:set', view: 'capture-viewer', state: { activity: { activeTabId: 'forged' } },
    });

    expect(ws.sent).toEqual([expect.objectContaining({ type: 'state:error', view: 'capture-viewer' })]);
    expect(fs.existsSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'state'))).toBe(false);
    expect(fs.existsSync(path.join(externalCapsule, 'state'))).toBe(false);
    expect(fs.lstatSync(registeredView).isSymbolicLink()).toBe(true);
  });

  test('trusted state:set rejects an external workspace-state alias before capsule effects', async () => {
    const externalWorkspaceState = path.join(projectRoot, 'external-workspace-state');
    fs.mkdirSync(externalWorkspaceState);
    const systemRoot = path.join(projectRoot, 'ai', 'Test-Machine', 'System');
    fs.mkdirSync(systemRoot, { recursive: true });
    fs.symlinkSync(externalWorkspaceState, path.join(systemRoot, 'state'), 'dir');
    const { ws, handlers } = handlersFor('trusted-shell');

    await handlers['state:set']({
      type: 'state:set', view: 'capture-viewer', state: { activity: { activeTabId: 'forged' } },
    });

    expect(ws.sent).toEqual([expect.objectContaining({ type: 'state:error', view: 'capture-viewer' })]);
    expect(fs.readdirSync(externalWorkspaceState)).toEqual([]);
    expect(fs.existsSync(path.join(registeredView, 'state'))).toBe(false);
    expect(fs.lstatSync(path.join(systemRoot, 'state')).isSymbolicLink()).toBe(true);
  });

  test('trusted state:set rejects a cross-capsule hard-link identity before workspace effects', async () => {
    const protectedState = path.join(
      projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '009-canonical', 'state.json',
    );
    fs.mkdirSync(path.dirname(protectedState), { recursive: true });
    fs.writeFileSync(protectedState, '{"activity":{}}', 'utf8');
    fs.mkdirSync(path.join(registeredView, 'state'));
    fs.linkSync(protectedState, path.join(registeredView, 'state', 'state.json'));
    const { ws, handlers } = handlersFor('trusted-shell');

    await handlers['state:set']({
      type: 'state:set', view: 'capture-viewer', state: { activity: { activeTabId: 'forged' } },
    });

    expect(ws.sent).toEqual([expect.objectContaining({ type: 'state:error', view: 'capture-viewer' })]);
    expect(fs.existsSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'state'))).toBe(false);
    expect(fs.readFileSync(protectedState, 'utf8')).toBe('{"activity":{}}');
  });

  test('trusted state:set updates exactly one registered manifest-owned capsule', async () => {
    const { ws, handlers } = handlersFor('trusted-shell');

    await handlers['state:set']({
      type: 'state:set',
      view: 'capture-viewer',
      state: { activity: { activeTabId: 'capture-one' } },
      clientMutationId: 9,
    });

    expect(ws.sent).toEqual([
      expect.objectContaining({
        type: 'state:result', view: 'capture-viewer', clientMutationId: 9,
      }),
    ]);
    expect(JSON.parse(fs.readFileSync(path.join(registeredView, 'state', 'state.json'), 'utf8')))
      .toMatchObject({ activity: { activeTabId: 'capture-one' } });
    expect(fs.existsSync(path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json')))
      .toBe(true);
  });

  test('retirement drains an admitted state:set and preserves its post-commit success result', async () => {
    const fsPromises = require('fs').promises;
    const originalRename = fsPromises.rename;
    let signalCommittedRename;
    let releaseCommittedRename;
    let paused = false;
    const committedRename = new Promise(resolve => { signalCommittedRename = resolve; });
    const renameMayReturn = new Promise(resolve => { releaseCommittedRename = resolve; });
    const renameSpy = jest.spyOn(fsPromises, 'rename').mockImplementation(async (...args) => {
      const result = await originalRename(...args);
      if (!paused) {
        paused = true;
        signalCommittedRename();
        await renameMayReturn;
      }
      return result;
    });
    const readiness = require('../../lib/views/readiness-runtime');
    const { ws, handlers } = handlersFor('trusted-shell');

    try {
      const setting = handlers['state:set']({
        type: 'state:set',
        view: 'capture-viewer',
        requestId: 'retirement-after-commit',
        clientMutationId: 10,
        state: { widths: { leftSidebar: 333 } },
      });
      await committedRename;
      const workspaceStatePath = path.join(
        projectRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json',
      );
      expect(JSON.parse(fs.readFileSync(workspaceStatePath, 'utf8')))
        .toMatchObject({ widths: { leftSidebar: 333 } });

      let retired = false;
      const retirement = readiness.retireWorkspaceViewReadiness({
        workspaceId: 'workspace-state-test',
        projectRoot,
      }).then(() => { retired = true; });
      await new Promise(resolve => setImmediate(resolve));
      expect(retired).toBe(false);
      expect(readiness.getViewReadinessStatus({
        workspaceId: 'workspace-state-test', projectRoot,
      })).toMatchObject({ status: 'unavailable', verified: false });

      releaseCommittedRename();
      await setting;
      expect(ws.sent).toEqual([expect.objectContaining({
        type: 'state:result',
        view: 'capture-viewer',
        requestId: 'retirement-after-commit',
        clientMutationId: 10,
        state: expect.objectContaining({ widths: expect.objectContaining({ leftSidebar: 333 }) }),
      })]);
      expect(ws.sent.some(message => message.type === 'state:error')).toBe(false);
      await retirement;
      expect(retired).toBe(true);
    } finally {
      releaseCommittedRename();
      renameSpy.mockRestore();
    }
  });

  test('released and forged caller-held leases fail before state effects', async () => {
    const readiness = require('../../lib/views/readiness-runtime');
    const { writeViewStatePatchUnderLease } = require('../../lib/view-state/writer');
    const context = { workspaceId: 'workspace-state-test', projectRoot };
    const releasedLease = readiness.acquireViewReadinessLease(context);
    releasedLease.release();
    await readiness.retireWorkspaceViewReadiness(context);

    await expect(writeViewStatePatchUnderLease(
      projectRoot,
      'capture-viewer',
      { activity: { activeTabId: 'released-lease-effect' } },
      releasedLease,
    )).rejects.toMatchObject({ code: 'view_registry_unavailable' });
    await expect(writeViewStatePatchUnderLease(
      projectRoot,
      'capture-viewer',
      { activity: { activeTabId: 'forged-lease-effect' } },
      Object.freeze({
        phase: 'precutover_staged',
        verified: false,
        projectRoot,
        release() {},
      }),
    )).rejects.toMatchObject({ code: 'view_registry_unavailable' });

    expect(fs.existsSync(path.join(
      projectRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json',
    ))).toBe(false);
    expect(fs.existsSync(path.join(registeredView, 'state', 'state.json'))).toBe(false);
  });
});
