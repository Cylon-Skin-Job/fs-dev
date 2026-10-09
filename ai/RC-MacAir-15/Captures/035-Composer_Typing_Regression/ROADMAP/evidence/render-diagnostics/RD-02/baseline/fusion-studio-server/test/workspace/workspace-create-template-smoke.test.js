'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function observeEvent(on, type) {
  let unsubscribe = () => {};
  let timeout;
  const promise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${type}`));
    }, 5000);
    unsubscribe = on(type, (event) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(event);
    });
  });
  return {
    promise,
    cancel() {
      clearTimeout(timeout);
      unsubscribe();
    },
  };
}

function waitForEvent(on, type) {
  return observeEvent(on, type).promise;
}

describe('workspace create template profile smoke', () => {
  let tempRoot;
  let modules;

  beforeEach(async () => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-workspace-create-smoke-'));
    process.env.FUSION_APP_USER_DATA = path.join(tempRoot, 'user-data');
    process.env.FUSION_LOCAL_MACHINE = 'Smoke Machine';

    modules = {
      db: require('../../lib/db'),
      eventBus: require('../../lib/event-bus'),
      controller: require('../../lib/workspace/workspace-controller'),
      registry: require('../../lib/workspace/registry-service'),
      views: require('../../lib/views'),
      requestHandlers: require('../../lib/ws/workspace-request-handlers'),
    };

    await modules.db.initDb();
    await modules.controller.start();
  });

  afterEach(async () => {
    modules?.eventBus.bus.removeAllListeners();
    await modules?.db.closeDb();
    delete process.env.FUSION_APP_USER_DATA;
    delete process.env.FUSION_LOCAL_MACHINE;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  test('request handler creates, registers, and switches the default new profile', async () => {
    const projectPath = path.join(tempRoot, 'new-profile-created');
    const session = { connectionId: 'smoke-new' };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session,
    });
    const createdPromise = waitForEvent(modules.eventBus.on, 'workspace:created');
    const switchedPromise = waitForEvent(modules.eventBus.on, 'workspace:switched');
    const rejected = observeEvent(modules.eventBus.on, 'workspace:create_rejected');
    const rejectedPromise = rejected.promise.then((event) => {
      throw new Error(event.message);
    });

    handlers['workspace:create_requested']({
      type: 'workspace:create_requested',
      projectPath,
      label: 'New Profile Smoke',
      workspaceTemplateId: 'new',
    });

    const created = await Promise.race([createdPromise, rejectedPromise]);
    rejected.cancel();
    const switched = await switchedPromise;
    const exactProjectPath = fs.realpathSync(projectPath);
    const workspace = await modules.registry.getByRepoPath(exactProjectPath);
    const machineRoot = path.join(projectPath, 'ai', 'Smoke-Machine');

    expect(created.connectionId).toBe('smoke-new');
    expect(created.workspace).toMatchObject({
      id: 'new-profile-created',
      label: 'New Profile Smoke',
      repoPath: exactProjectPath,
      icon: 'open_run',
    });
    expect(switched).toMatchObject({
      from: null,
      to: 'new-profile-created',
      repoPath: exactProjectPath,
    });
    expect(workspace).toMatchObject({ id: 'new-profile-created', repoPath: exactProjectPath });
    expect(modules.views.listViews(projectPath)).toEqual([
      'capture-viewer',
      'file-viewer',
      'wiki-viewer',
      'issues-viewer',
      'agents-viewer',
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '001-capture-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.readdirSync(path.join(machineRoot, 'System', 'Views')).some((name) => name.endsWith('-office-viewer'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('request handler creates the fixed new profile even if a template id is sent', async () => {
    const projectPath = path.join(tempRoot, 'template-id-ignored');
    const session = { connectionId: 'smoke-template-id-ignored' };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session,
    });
    const createdPromise = waitForEvent(modules.eventBus.on, 'workspace:created');
    const switchedPromise = waitForEvent(modules.eventBus.on, 'workspace:switched');
    const rejected = observeEvent(modules.eventBus.on, 'workspace:create_rejected');
    const rejectedPromise = rejected.promise.then((event) => {
      throw new Error(event.message);
    });

    handlers['workspace:create_requested']({
      type: 'workspace:create_requested',
      projectPath,
      label: 'Template Id Ignored Smoke',
      workspaceTemplateId: 'fusion-home',
    });

    const created = await Promise.race([createdPromise, rejectedPromise]);
    rejected.cancel();
    const switched = await switchedPromise;
    const exactProjectPath = fs.realpathSync(projectPath);
    const workspace = await modules.registry.getByRepoPath(exactProjectPath);
    const machineRoot = path.join(projectPath, 'ai', 'Smoke-Machine');

    expect(created.connectionId).toBe('smoke-template-id-ignored');
    expect(created.workspace).toMatchObject({
      id: 'template-id-ignored',
      label: 'Template Id Ignored Smoke',
      repoPath: exactProjectPath,
      icon: 'open_run',
    });
    expect(switched).toMatchObject({
      from: null,
      to: 'template-id-ignored',
      repoPath: exactProjectPath,
    });
    expect(workspace).toMatchObject({ id: 'template-id-ignored', repoPath: exactProjectPath });
    expect(modules.views.listViews(projectPath)).toEqual([
      'capture-viewer',
      'file-viewer',
      'wiki-viewer',
      'issues-viewer',
      'agents-viewer',
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '001-capture-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Office'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('does not publish a newly created workspace before attachment readiness completes', async () => {
    const projectPath = path.join(tempRoot, 'readiness-gated-create');
    const readiness = require('../../lib/views/readiness-runtime');
    const originalEnsure = readiness.ensureWorkspaceViewReadiness;
    let signalEntered;
    let release;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const pending = new Promise(resolve => { release = resolve; });
    const readinessSpy = jest.spyOn(readiness, 'ensureWorkspaceViewReadiness')
      .mockImplementation(async (request) => {
        if (path.basename(request.projectRoot) === path.basename(projectPath)) {
          signalEntered();
          await pending;
        }
        return originalEnsure(request);
      });
    const session = { connectionId: 'readiness-gated-create' };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session,
    });
    const created = jest.fn();
    const switched = jest.fn();
    modules.eventBus.on('workspace:created', created);
    modules.eventBus.on('workspace:switched', switched);

    handlers['workspace:create_requested']({
      type: 'workspace:create_requested',
      projectPath,
      label: 'Readiness Gated Create',
    });
    await entered;
    expect(created).not.toHaveBeenCalled();
    expect(switched).not.toHaveBeenCalled();
    release();
    await waitForEvent(modules.eventBus.on, 'workspace:switched');
    expect(created).toHaveBeenCalledTimes(1);
    expect(switched).toHaveBeenCalledTimes(1);
    readinessSpy.mockRestore();
  });

  test('untrusted and request-forged workspace scaffold requests fail before effects', () => {
    const projectPath = path.join(tempRoot, 'untrusted-profile');
    const ws = { send: jest.fn() };
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws,
      session: { connectionId: 'untrusted-create' },
    });
    const listener = jest.fn();
    const unsubscribe = modules.eventBus.on('workspace:create_requested', listener);
    const addListener = jest.fn();
    const unsubscribeAdd = modules.eventBus.on('workspace:add_requested', addListener);

    handlers['workspace:create_requested']({
      type: 'workspace:create_requested',
      projectPath,
      label: 'Forged',
      role: 'trusted-shell',
      origin: 'fusion-shell://app',
      authority: true,
      actor: 'shell',
    });
    handlers['workspace:add_requested']({
      type: 'workspace:add_requested',
      repoPath: projectPath,
      role: 'trusted-shell',
      origin: 'fusion-shell://app',
      authority: true,
      actor: 'shell',
    });
    unsubscribe();
    unsubscribeAdd();

    expect(listener).not.toHaveBeenCalled();
    expect(addListener).not.toHaveBeenCalled();
    expect(fs.existsSync(projectPath)).toBe(false);
    expect(ws.send).toHaveBeenCalledTimes(2);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
      type: 'error', code: 'VIEW_MUTATION_DENIED', message: 'View mutation denied',
    }));
  });

  test('trusted workspace add admission still reaches the dedicated scaffold owner', () => {
    const repoPath = path.join(tempRoot, 'trusted-add');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const session = { connectionId: 'trusted-add' };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session,
    });
    const listener = jest.fn();
    const unsubscribe = modules.eventBus.on('workspace:add_requested', listener);

    handlers['workspace:add_requested']({ type: 'workspace:add_requested', repoPath });
    unsubscribe();

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      repoPath, connectionId: 'trusted-add', type: 'workspace:add_requested',
    }));
    warn.mockRestore();
  });

  test('canonical-only attachment is adopted and remains registered', async () => {
    const repoPath = path.join(tempRoot, 'canonical-only-attachment');
    fs.mkdirSync(path.join(repoPath, 'ai', 'Smoke-Machine', 'System', 'Views'), { recursive: true });
    const added = waitForEvent(modules.eventBus.on, 'workspace:added');

    modules.eventBus.emit('workspace:add_requested', {
      type: 'workspace:add_requested',
      repoPath,
      connectionId: 'canonical-only-attachment',
    });

    await expect(added).resolves.toMatchObject({
      workspace: {
        id: 'canonical-only-attachment',
        repoPath: fs.realpathSync(repoPath),
      },
      viewRegistryUnavailable: false,
    });
    await expect(modules.registry.getByRepoPath(fs.realpathSync(repoPath))).resolves.toMatchObject({
      id: 'canonical-only-attachment',
    });
    expect(fs.existsSync(path.join(repoPath, 'ai', 'Smoke-Machine', 'Views'))).toBe(false);
    expect(fs.existsSync(path.join(repoPath, 'ai', 'Smoke-Machine', 'System', 'Views'))).toBe(true);
  });
});
