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
      icon: 'open_run',
    });
    expect(switched).toMatchObject({
      from: 'fs-dev',
      to: 'new-profile-created',
      repoPath: projectPath,
    });
    expect(workspace).toMatchObject({ id: 'new-profile-created', repoPath: projectPath });
    expect(modules.views.listViews(projectPath)).toEqual([
      'capture-viewer',
      'file-viewer',
      'wiki-viewer',
      'issues-viewer',
      'agents-viewer',
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-capture-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.readdirSync(path.join(machineRoot, 'Views')).some((name) => name.endsWith('-office-viewer'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('request handler creates the fixed new profile even if a template id is sent', async () => {
    const projectPath = path.join(tempRoot, 'template-id-ignored');
    const handlers = modules.requestHandlers.createWorkspaceRequestHandlers({
      ws: { send: jest.fn() },
      session: { connectionId: 'smoke-template-id-ignored' },
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
    const workspace = await modules.registry.getByRepoPath(projectPath);
    const machineRoot = path.join(projectPath, 'ai', 'Smoke-Machine');

    expect(created.connectionId).toBe('smoke-template-id-ignored');
    expect(created.workspace).toMatchObject({
      id: 'template-id-ignored',
      label: 'Template Id Ignored Smoke',
      repoPath: projectPath,
      icon: 'open_run',
    });
    expect(switched).toMatchObject({
      from: 'fs-dev',
      to: 'template-id-ignored',
      repoPath: projectPath,
    });
    expect(workspace).toMatchObject({ id: 'template-id-ignored', repoPath: projectPath });
    expect(modules.views.listViews(projectPath)).toEqual([
      'capture-viewer',
      'file-viewer',
      'wiki-viewer',
      'issues-viewer',
      'agents-viewer',
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-capture-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Office'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });
});
