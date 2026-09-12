const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createRouter, __test__ } = require('../../lib/http/panel-file-route');
const { ViewRelocationError } = require('../../lib/views/relocation-errors');
const viewReadiness = require('../../lib/views/readiness-runtime');
const { installHistoricalReadinessFixture } = require('../views/historical-readiness-fixture');

function mockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    sendFile: jest.fn().mockReturnValue('sent'),
  };
}

describe('panel file route hidden path handling', () => {
  test('allows Office thumbnail cache paths through .thumbnails', () => {
    const res = mockResponse();

    const result = __test__.sendPanelFile(
      res,
      '/workspace/ai/Test-Machine/Office/assets/.thumbnails/README.md.png',
      'assets/.thumbnails/README.md.png'
    );

    expect(result).toBe('sent');
    expect(res.sendFile).toHaveBeenCalledWith(
      '/workspace/ai/Test-Machine/Office/assets/.thumbnails/README.md.png',
      { dotfiles: 'allow' }
    );
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('keeps non-thumbnail hidden paths unavailable', () => {
    const res = mockResponse();

    __test__.sendPanelFile(
      res,
      '/workspace/ai/Test-Machine/Office/assets/.private/README.md.png',
      'assets/.private/README.md.png'
    );

    expect(res.sendFile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith('Not found');
  });

  test('serves normal panel paths without dotfile override', () => {
    const res = mockResponse();

    __test__.sendPanelFile(
      res,
      '/workspace/ai/Test-Machine/Office/assets/README.md',
      'assets/README.md'
    );

    expect(res.sendFile).toHaveBeenCalledWith(
      '/workspace/ai/Test-Machine/Office/assets/README.md',
      undefined
    );
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-cache');
  });
});

describe('panel file view-discovery readiness', () => {
  let server;
  let tempRoot;

  afterEach(async () => {
    installHistoricalReadinessFixture();
    if (server) await new Promise(resolve => server.close(resolve));
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
    server = null;
    tempRoot = null;
  });

  async function startRoute(owner, panel = '__panels__') {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-panel-file-readiness-'));
    const viewsRoot = path.join(tempRoot, 'Views');
    const manifest = path.join(viewsRoot, '001-probe', 'manifest.md');
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.writeFileSync(manifest, 'probe-canary', 'utf8');
    viewReadiness.installViewReadinessOwner(owner);
    const getPanelPathForRoot = jest.fn(() => viewsRoot);
    const app = express();
    app.use('/api/panel-file', createRouter({
      getProjectRoot: () => tempRoot,
      getPanelPathForRoot,
      getWorkspaceId: () => 'workspace-1',
    }));
    server = await new Promise(resolve => {
      const next = app.listen(0, '127.0.0.1', () => resolve(next));
    });
    return {
      getPanelPathForRoot,
      url: `http://127.0.0.1:${server.address().port}/api/panel-file/${panel}/001-probe/manifest.md`,
    };
  }

  test.each(['__panels__', 'probe-viewer'])(
    'returns bounded unavailable without resolving %s bytes',
    async (panel) => {
      const ensureReady = jest.fn(async () => { throw new ViewRelocationError('root_conflict'); });
      const { getPanelPathForRoot, url } = await startRoute({
        ensureReady,
        acquireLease: () => { throw new Error('unreachable'); },
        getStatus: () => ({ status: 'unavailable', verified: false }),
      }, panel);

      const response = await fetch(url);
      expect(response.status).toBe(503);
      await expect(response.text()).resolves.toBe('view_registry_unavailable');
      expect(ensureReady).toHaveBeenCalledWith({ workspaceId: 'workspace-1', projectRoot: tempRoot });
      expect(getPanelPathForRoot).not.toHaveBeenCalled();
    },
  );

  test.each(['__panels__', 'probe-viewer'])(
    'holds and releases readiness while resolving %s',
    async (panel) => {
      const release = jest.fn();
      const { getPanelPathForRoot, url } = await startRoute({
        ensureReady: async () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
        acquireLease: () => ({ phase: 'precutover_staged', verified: false, release }),
        getStatus: () => ({ status: 'staged', verified: false }),
      }, panel);

      const response = await fetch(url);
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('probe-canary');
      expect(getPanelPathForRoot).toHaveBeenCalledWith(tempRoot, panel);
      expect(release).toHaveBeenCalledTimes(1);
    },
  );

  test.each(['__apps__', '__settings__'])(
    'keeps registry-independent %s reads available during a view conflict',
    async (panel) => {
      const ensureReady = jest.fn(async () => { throw new Error('must not be consulted'); });
      const { getPanelPathForRoot, url } = await startRoute({
        ensureReady,
        acquireLease: () => { throw new Error('must not be acquired'); },
        getStatus: () => ({ status: 'unavailable', verified: false }),
      }, panel);

      const response = await fetch(url);
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('probe-canary');
      expect(getPanelPathForRoot).toHaveBeenCalledWith(tempRoot, panel);
      expect(ensureReady).not.toHaveBeenCalled();
    },
  );

  test('resolves from the leased root and gates a concurrently selected replacement workspace', async () => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-panel-file-binding-'));
    const rootA = path.join(tempRoot, 'workspace-a');
    const rootB = path.join(tempRoot, 'workspace-b');
    for (const [root, content] of [[rootA, 'A_BYTES'], [rootB, 'B_BYTES']]) {
      const file = path.join(root, 'Views', '001-probe', 'manifest.md');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, 'utf8');
    }
    let activeRoot = rootA;
    let activeWorkspaceId = 'workspace-a';
    const ensureReady = jest.fn(async (context) => {
      if (context.workspaceId === 'workspace-b') throw new ViewRelocationError('root_conflict');
      activeRoot = rootB;
      activeWorkspaceId = 'workspace-b';
      return { status: 'staged', phase: 'precutover_staged', verified: false };
    });
    const acquireLease = jest.fn(() => ({
      phase: 'precutover_staged',
      verified: false,
      release() {},
    }));
    viewReadiness.installViewReadinessOwner({
      ensureReady,
      acquireLease,
      getStatus: () => ({ status: 'staged', verified: false }),
    });
    const getPanelPathForRoot = jest.fn(root => path.join(root, 'Views'));
    const app = express();
    app.use('/api/panel-file', createRouter({
      getProjectRoot: () => activeRoot,
      getPanelPathForRoot,
      getWorkspaceId: () => activeWorkspaceId,
    }));
    server = await new Promise(resolve => {
      const next = app.listen(0, '127.0.0.1', () => resolve(next));
    });
    const url = `http://127.0.0.1:${server.address().port}/api/panel-file/probe-viewer/001-probe/manifest.md`;

    const first = await fetch(url);
    expect(first.status).toBe(200);
    await expect(first.text()).resolves.toBe('A_BYTES');
    expect(acquireLease).toHaveBeenCalledWith({ workspaceId: 'workspace-a', projectRoot: rootA });
    expect(getPanelPathForRoot).toHaveBeenCalledWith(rootA, 'probe-viewer');

    const second = await fetch(url);
    expect(second.status).toBe(503);
    await expect(second.text()).resolves.toBe('view_registry_unavailable');
    expect(getPanelPathForRoot).toHaveBeenCalledTimes(1);
    expect(ensureReady).toHaveBeenLastCalledWith({ workspaceId: 'workspace-b', projectRoot: rootB });
  });
});
