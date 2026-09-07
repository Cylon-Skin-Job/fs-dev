'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createWs() {
  return {
    readyState: 1,
    sent: [],
    send(message) {
      this.sent.push(JSON.parse(message));
    },
  };
}

function messagesOf(ws, type) {
  return ws.sent.filter((message) => message.type === type);
}

describe('workspace folder mutations', () => {
  let tempRoot;
  let officeRoot;
  let createWorkspaceRequestHandlers;
  let consoleLogSpy;
  let resolveViewStateMock;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-folder-mutations-'));
    officeRoot = path.join(tempRoot, 'ai', 'Test-Machine', 'Office');
    fs.mkdirSync(path.join(officeRoot, '999-Archive'), { recursive: true });

    jest.resetModules();
    jest.doMock('../../lib/views/panel-paths', () => ({
      getPanelPath: jest.fn((panel, client) => (
        panel === 'office-viewer' && client?.projectRoot
          ? path.join(client.projectRoot, 'ai', 'Test-Machine', 'Office')
          : null
      )),
    }));
    resolveViewStateMock = jest.fn(async () => ({ marker: 'workspace-a-state' }));
    jest.doMock('../../lib/view-state', () => ({
      resolveViewState: resolveViewStateMock,
      writeViewStatePatch: jest.fn(async (_root, _view, state) => state),
    }));
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    ({ createWorkspaceRequestHandlers } = require('../../lib/ws/workspace-request-handlers'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  function createHandlers(ws = createWs(), broadcastClients = []) {
    ws.projectRoot = tempRoot;
    const session = { projectRoot: tempRoot, currentWorkspaceId: 'workspace-a' };
    return {
      ws,
      session,
      handlers: createWorkspaceRequestHandlers({
        ws,
        session,
        getAllClients: () => broadcastClients,
      }),
    };
  }

  test('echoes captured workspace and request correlation for state loads', async () => {
    let resolveState;
    resolveViewStateMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveState = resolve;
    }));
    const { ws, session, handlers } = createHandlers();

    const pending = handlers['state:get']({
      type: 'state:get',
      view: 'capture-viewer',
      requestId: 'state-load-a',
    });
    session.currentWorkspaceId = 'workspace-b';
    resolveState({ marker: 'workspace-a-state' });
    await pending;

    expect(messagesOf(ws, 'state:result')[0]).toMatchObject({
      view: 'capture-viewer',
      requestId: 'state-load-a',
      workspaceId: 'workspace-a',
      state: { marker: 'workspace-a-state' },
    });
  });

  test('no-workspace failures preserve operation-family correlation', async () => {
    const ws = createWs();
    const handlers = createWorkspaceRequestHandlers({
      ws,
      session: { projectRoot: null, currentWorkspaceId: 'workspace-a' },
      getAllClients: () => [],
    });

    await handlers['state:get']({
      type: 'state:get',
      view: 'capture-viewer',
      requestId: 'state-no-root',
    });
    await handlers['state:set']({
      type: 'state:set',
      view: 'capture-viewer',
      state: { docViewerTabs: [] },
      clientMutationId: 41,
    });
    await handlers['file:move']({ type: 'file:move', requestId: 'move-no-root' });
    await handlers['file:rename']({
      type: 'file:rename',
      source: '/missing',
      newName: 'renamed',
      requestId: 'rename-no-root',
    });
    await handlers['file:delete']({
      type: 'file:delete',
      source: '/missing',
      requestId: 'delete-no-root',
    });

    expect(ws.sent).toEqual([
      expect.objectContaining({
        type: 'state:error',
        view: 'capture-viewer',
        requestId: 'state-no-root',
        workspaceId: 'workspace-a',
      }),
      expect.objectContaining({
        type: 'state:error',
        view: 'capture-viewer',
        clientMutationId: 41,
        workspaceId: 'workspace-a',
      }),
      expect.objectContaining({
        type: 'file:move_error',
        requestId: 'move-no-root',
        workspaceId: 'workspace-a',
      }),
      expect.objectContaining({
        type: 'file:rename_error',
        requestId: 'rename-no-root',
        workspaceId: 'workspace-a',
      }),
      expect.objectContaining({
        type: 'file:delete_error',
        requestId: 'delete-no-root',
        workspaceId: 'workspace-a',
      }),
    ]);
  });

  test('folder browse failures do not reflect requester-controlled paths in diagnostics', async () => {
    const canaryPath = path.join(tempRoot, 'SHELL_AUTH_PROOF_NONCE_CANARY', 'missing');
    const { ws, handlers } = createHandlers();

    await handlers['folder:browse']({
      type: 'folder:browse',
      path: canaryPath,
    });

    const [reply] = messagesOf(ws, 'folder:browse_result');
    expect(reply).toMatchObject({
      path: canaryPath,
      success: false,
      error: 'Unable to browse folder',
    });
    expect(reply.error).not.toContain(canaryPath);
  });

  test('archives Office folders with directory mutation metadata', () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const broadcastWs = createWs();
    const { ws, handlers } = createHandlers(createWs(), [broadcastWs]);

    handlers['file:move']({
      type: 'file:move',
      source: path.join(officeRoot, 'assets'),
      target: path.join(officeRoot, '999-Archive'),
      requestId: 'move-a',
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets'))).toBe(false);
    expect(fs.existsSync(path.join(officeRoot, '999-Archive', 'assets', 'README.md'))).toBe(true);
    expect(messagesOf(ws, 'file:moved')[0]).toMatchObject({
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      targetPanel: 'office-viewer',
      targetPath: '999-Archive/assets',
      sourceIsDirectory: true,
      requestId: 'move-a',
      workspaceId: 'workspace-a',
    });
    expect(messagesOf(broadcastWs, 'file_changed')).toEqual([
      expect.objectContaining({ panel: 'office-viewer', filePath: 'assets' }),
      expect.objectContaining({ panel: 'office-viewer', filePath: '999-Archive/assets' }),
    ]);
  });

  test('renames Office folders with directory mutation metadata', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const { ws, handlers } = createHandlers();

    await handlers['file:rename']({
      type: 'file:rename',
      source: path.join(officeRoot, 'assets'),
      newName: 'client-assets',
      requestId: 'rename-a',
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets'))).toBe(false);
    expect(fs.existsSync(path.join(officeRoot, 'client-assets', 'README.md'))).toBe(true);
    expect(messagesOf(ws, 'file:renamed')[0]).toMatchObject({
      newName: 'client-assets',
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      targetPanel: 'office-viewer',
      targetPath: 'client-assets',
      sourceIsDirectory: true,
      requestId: 'rename-a',
      workspaceId: 'workspace-a',
    });
  });

  test('delayed mutation broadcasts stay with clients still on the captured workspace', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const originWs = createWs();
    originWs.projectRoot = tempRoot;
    const workspaceAPeer = createWs();
    const workspaceBPeer = createWs();
    const originSession = { projectRoot: tempRoot, currentWorkspaceId: 'workspace-a' };
    const sessions = new Map([
      [originWs, originSession],
      [workspaceAPeer, { currentWorkspaceId: 'workspace-a' }],
      [workspaceBPeer, { currentWorkspaceId: 'workspace-b' }],
    ]);
    const handlers = createWorkspaceRequestHandlers({
      ws: originWs,
      session: originSession,
      getAllClients: (workspaceId) => Array.from(sessions.entries())
        .filter(([client, clientSession]) => (
          client.readyState === 1 && clientSession.currentWorkspaceId === workspaceId
        ))
        .map(([client]) => client),
    });

    const originalStat = fs.promises.stat.bind(fs.promises);
    let releaseStat;
    const statGate = new Promise((resolve) => {
      releaseStat = resolve;
    });
    const statSpy = jest.spyOn(fs.promises, 'stat').mockImplementationOnce(async (...args) => {
      await statGate;
      return originalStat(...args);
    });

    try {
      const pending = handlers['file:rename']({
        type: 'file:rename',
        source: path.join(officeRoot, 'assets'),
        newName: 'client-assets',
        requestId: 'rename-delayed-a',
      });
      const workspaceBRoot = path.join(tempRoot, 'workspace-b');
      fs.mkdirSync(workspaceBRoot, { recursive: true });
      originSession.projectRoot = workspaceBRoot;
      originSession.currentWorkspaceId = 'workspace-b';
      originWs.projectRoot = workspaceBRoot;
      releaseStat();
      await pending;
    } finally {
      statSpy.mockRestore();
    }

    expect(messagesOf(originWs, 'file_changed')).toEqual([]);
    expect(messagesOf(workspaceBPeer, 'file_changed')).toEqual([]);
    expect(messagesOf(workspaceAPeer, 'file_changed')).toEqual([
      expect.objectContaining({ panel: 'office-viewer', filePath: 'assets' }),
      expect.objectContaining({ panel: 'office-viewer', filePath: 'client-assets' }),
    ]);
    expect(messagesOf(originWs, 'file:renamed')[0]).toMatchObject({
      requestId: 'rename-delayed-a',
      workspaceId: 'workspace-a',
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      targetPanel: 'office-viewer',
      targetPath: 'client-assets',
    });
  });

  test('delayed delete retains captured panel metadata and origin-workspace fanout', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const originWs = createWs();
    originWs.projectRoot = tempRoot;
    const workspaceAPeer = createWs();
    const workspaceBPeer = createWs();
    const originSession = { projectRoot: tempRoot, currentWorkspaceId: 'workspace-a' };
    const sessions = new Map([
      [originWs, originSession],
      [workspaceAPeer, { currentWorkspaceId: 'workspace-a' }],
      [workspaceBPeer, { currentWorkspaceId: 'workspace-b' }],
    ]);
    const handlers = createWorkspaceRequestHandlers({
      ws: originWs,
      session: originSession,
      getAllClients: (workspaceId) => Array.from(sessions.entries())
        .filter(([client, clientSession]) => (
          client.readyState === 1 && clientSession.currentWorkspaceId === workspaceId
        ))
        .map(([client]) => client),
    });
    const originalStat = fs.promises.stat.bind(fs.promises);
    let releaseStat;
    const statGate = new Promise((resolve) => {
      releaseStat = resolve;
    });
    const statSpy = jest.spyOn(fs.promises, 'stat').mockImplementationOnce(async (...args) => {
      await statGate;
      return originalStat(...args);
    });

    try {
      const pending = handlers['file:delete']({
        type: 'file:delete',
        source: path.join(officeRoot, 'assets'),
        requestId: 'delete-delayed-a',
      });
      const workspaceBRoot = path.join(tempRoot, 'workspace-b');
      fs.mkdirSync(workspaceBRoot, { recursive: true });
      originSession.projectRoot = workspaceBRoot;
      originSession.currentWorkspaceId = 'workspace-b';
      originWs.projectRoot = workspaceBRoot;
      releaseStat();
      await pending;
    } finally {
      statSpy.mockRestore();
    }

    expect(messagesOf(originWs, 'file_changed')).toEqual([]);
    expect(messagesOf(workspaceBPeer, 'file_changed')).toEqual([]);
    expect(messagesOf(workspaceAPeer, 'file_changed')).toEqual([
      expect.objectContaining({ panel: 'office-viewer', filePath: 'assets' }),
    ]);
    expect(messagesOf(originWs, 'file:deleted')[0]).toMatchObject({
      requestId: 'delete-delayed-a',
      workspaceId: 'workspace-a',
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
    });
  });

  test('deletes Office folders recursively with directory mutation metadata', async () => {
    writeFile(path.join(officeRoot, 'assets', 'nested', 'README.md'), '# Assets\n');
    const { ws, handlers } = createHandlers();

    await handlers['file:delete']({
      type: 'file:delete',
      source: path.join(officeRoot, 'assets'),
      requestId: 'delete-a',
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets'))).toBe(false);
    expect(messagesOf(ws, 'file:deleted')[0]).toMatchObject({
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      sourceIsDirectory: true,
      requestId: 'delete-a',
      workspaceId: 'workspace-a',
    });
  });
});
