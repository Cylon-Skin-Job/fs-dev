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
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session: { connectionId: 'smoke-new' },
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
    const workspace = await modules.registry.getByRepoPath(projectPath);
    const machineRoot = path.join(projectPath, 'ai', 'Smoke-Machine');

    expect(created.connectionId).toBe('smoke-new');
    expect(created.workspace).toMatchObject({
      id: 'new-profile-created',
      label: 'New Profile Smoke',
      repoPath: projectPath,
      icon: 'code_blocks',
    });
    expect(switched).toMatchObject({
      from: 'fs-dev',
      to: 'new-profile-created',
      repoPath: projectPath,
    });
    expect(workspace).toMatchObject({ id: 'new-profile-created', repoPath: projectPath });
    expect(modules.views.listViews(projectPath)).toEqual([
      'file-viewer',
      'issues-viewer',
      'wiki-viewer',
      'agents-viewer',
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-office-viewer'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('request handler passes startup workspaceTemplateId through to scaffolded views', async () => {
    const projectPath = path.join(tempRoot, 'fusion-home-created');
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session: { connectionId: 'smoke-fusion-home' },
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
      label: 'Fusion Home Smoke',
      workspaceTemplateId: 'fusion-home',
    });

    const created = await Promise.race([createdPromise, rejectedPromise]);
    rejected.cancel();
    const switched = await switchedPromise;
    const workspace = await modules.registry.getByRepoPath(projectPath);
    const machineRoot = path.join(projectPath, 'ai', 'Smoke-Machine');

    expect(created.connectionId).toBe('smoke-fusion-home');
    expect(created.workspace).toMatchObject({
      id: 'fusion-home-created',
      label: 'Fusion Home Smoke',
      repoPath: projectPath,
      icon: 'description',
    });
    expect(switched).toMatchObject({
      from: 'fs-dev',
      to: 'fusion-home-created',
      repoPath: projectPath,
    });
    expect(workspace).toMatchObject({ id: 'fusion-home-created', repoPath: projectPath });
    expect(modules.views.listViews(projectPath)).toEqual([
      'office-viewer',
      'file-viewer',
      'issues-viewer',
      'wiki-viewer',
      'agents-viewer',
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-office-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });
});
