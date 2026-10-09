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
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-folder-mutations-')));
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
      writeViewStatePatchUnderLease: jest.fn(async (_root, _view, state) => state),
    }));
    require('../../lib/views/readiness-runtime').installViewReadinessOwner({
      ensureReady: async () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
      acquireLease: ({ projectRoot }) => ({
        phase: 'precutover_staged',
        verified: false,
        projectRoot,
        release() {},
      }),
      getStatus: () => ({ status: 'staged', phase: 'precutover_staged', verified: false }),
    });
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
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
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
    let signalStateEntered;
    const stateEntered = new Promise(resolve => { signalStateEntered = resolve; });
    resolveViewStateMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveState = resolve;
      signalStateEntered();
    }));
    const { ws, session, handlers } = createHandlers();

    const pending = handlers['state:get']({
      type: 'state:get',
      view: 'capture-viewer',
      requestId: 'state-load-a',
    });
    await stateEntered;
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

  test('trusted state writes reach the dedicated view-state owner', async () => {
    const viewState = require('../../lib/view-state');
    const { ws, handlers } = createHandlers();
    await handlers['state:set']({
      type: 'state:set',
      view: 'capture-viewer',
      state: { docViewerActiveTabId: 'capture-one' },
      clientMutationId: 42,
    });

    expect(viewState.writeViewStatePatchUnderLease).toHaveBeenCalledWith(
      tempRoot,
      'capture-viewer',
      { docViewerActiveTabId: 'capture-one' },
      expect.objectContaining({ projectRoot: tempRoot }),
    );
    expect(messagesOf(ws, 'state:result')[0]).toMatchObject({
      view: 'capture-viewer',
      clientMutationId: 42,
      state: { docViewerActiveTabId: 'capture-one' },
    });
  });

  test('view readiness conflict returns only bounded unavailable state', async () => {
    const readiness = require('../../lib/views/readiness-runtime');
    const { ViewRelocationError } = require('../../lib/views/relocation-errors');
    readiness.installViewReadinessOwner({
      ensureReady: async () => { throw new ViewRelocationError('root_conflict'); },
      acquireLease: () => { throw new Error('unreachable'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    const { ws, handlers } = createHandlers();
    await handlers['state:get']({
      type: 'state:get',
      view: 'capture-viewer',
      requestId: 'readiness-conflict',
    });
    expect(messagesOf(ws, 'state:error')).toEqual([{
      type: 'state:error',
      view: 'capture-viewer',
      requestId: 'readiness-conflict',
      workspaceId: 'workspace-a',
      code: 'view_registry_unavailable',
      message: 'view_registry_unavailable',
    }]);
    expect(resolveViewStateMock).not.toHaveBeenCalled();
  });

  test('no-workspace failures preserve operation-family correlation', async () => {
    const ws = createWs();
    const session = { projectRoot: null, currentWorkspaceId: 'workspace-a' };
    Object.defineProperty(session, 'connectionRole', { value: 'trusted-shell', enumerable: false });
    const handlers = createWorkspaceRequestHandlers({
      ws,
      session,
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

  test('archives Office folders with directory mutation metadata', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const broadcastWs = createWs();
    const { ws, handlers } = createHandlers(createWs(), [broadcastWs]);

    await handlers['file:move']({
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

  test('denies protected source and destination mutations atomically through public workspace routes', async () => {
    const canonical = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-files');
    const retired = path.join(tempRoot, 'ai', 'Test-Machine', 'Views', '001-files');
    writeFile(path.join(canonical, 'content.json'), 'canonical');
    writeFile(path.join(retired, 'content.json'), 'retired');
    const source = path.join(officeRoot, 'deploy.md');
    writeFile(source, 'deploy');
    const { ws, handlers } = createHandlers();

    await handlers['file:move']({
      type: 'file:move', source, target: canonical, requestId: 'move-protected-target',
    });
    expect(fs.readFileSync(source, 'utf8')).toBe('deploy');
    expect(fs.readFileSync(path.join(canonical, 'content.json'), 'utf8')).toBe('canonical');
    expect(fs.existsSync(path.join(canonical, 'archive'))).toBe(false);

    await handlers['file:rename']({
      type: 'file:rename', source: path.join(retired, 'content.json'), newName: 'renamed.json',
      requestId: 'rename-protected-source',
    });
    expect(fs.readFileSync(path.join(retired, 'content.json'), 'utf8')).toBe('retired');
    expect(fs.existsSync(path.join(retired, 'renamed.json'))).toBe(false);

    await handlers['file:delete']({
      type: 'file:delete', source: path.join(canonical, 'content.json'), requestId: 'delete-protected',
    });
    await handlers['file:delete']({
      type: 'file:delete', source: path.join(tempRoot, 'ai', 'Test-Machine'), requestId: 'delete-ancestor',
    });
    expect(fs.readFileSync(path.join(canonical, 'content.json'), 'utf8')).toBe('canonical');
    expect(fs.readFileSync(path.join(retired, 'content.json'), 'utf8')).toBe('retired');
    expect(messagesOf(ws, 'file:moved')).toEqual([]);
    expect(messagesOf(ws, 'file:renamed')).toEqual([]);
    expect(messagesOf(ws, 'file:deleted')).toEqual([]);
  });

  test('denies projected protected-tree installation before a public directory move', async () => {
    const source = path.join(tempRoot, 'staging', 'NewMachine');
    const protectedPayload = path.join(source, 'System', 'Views', '001-rogue', 'manifest.md');
    writeFile(protectedPayload, 'rogue');
    const { ws, handlers } = createHandlers();

    await handlers['file:move']({
      type: 'file:move', source, target: path.join(tempRoot, 'ai'), requestId: 'projected-tree',
    });

    expect(fs.readFileSync(protectedPayload, 'utf8')).toBe('rogue');
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'NewMachine'))).toBe(false);
    expect(messagesOf(ws, 'file:moved')).toEqual([]);
  });

  test('denies projected installation through a symlinked ai physical root with no machine entry', async () => {
    fs.rmSync(path.join(tempRoot, 'ai'), { recursive: true, force: true });
    const storageRoot = path.join(tempRoot, 'storage');
    fs.mkdirSync(storageRoot, { recursive: true });
    fs.symlinkSync(storageRoot, path.join(tempRoot, 'ai'), 'dir');
    const source = path.join(tempRoot, 'staging', 'FutureMachine');
    const protectedPayload = path.join(source, 'System', 'Views', '001-rogue', 'manifest.md');
    writeFile(protectedPayload, 'rogue');
    const { ws, handlers } = createHandlers();

    await handlers['file:move']({
      type: 'file:move', source, target: storageRoot, requestId: 'projected-physical-ai',
    });

    expect(fs.readFileSync(protectedPayload, 'utf8')).toBe('rogue');
    expect(fs.existsSync(path.join(storageRoot, 'FutureMachine'))).toBe(false);
    expect(messagesOf(ws, 'file:moved')).toEqual([]);
  });

  test('denies projected protected-tree installation before a public directory rename', async () => {
    const source = path.join(tempRoot, 'ai', 'Rename-Machine', 'staged-system');
    const protectedPayload = path.join(source, 'Views', '001-rogue', 'manifest.md');
    writeFile(protectedPayload, 'rogue');
    const { ws, handlers } = createHandlers();

    await handlers['file:rename']({
      type: 'file:rename', source, newName: 'System', requestId: 'projected-tree-rename',
    });

    expect(fs.readFileSync(protectedPayload, 'utf8')).toBe('rogue');
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'Rename-Machine', 'System'))).toBe(false);
    expect(messagesOf(ws, 'file:renamed')).toEqual([]);
  });

  test('denies projected protected-tree installation through symlinks before move and rename', async () => {
    const moveSource = path.join(tempRoot, 'staging', 'Symlink-Machine');
    const moveExternalSystem = path.join(tempRoot, 'external-move-system');
    writeFile(path.join(moveExternalSystem, 'Views', '001-rogue', 'manifest.md'), 'move-rogue');
    fs.mkdirSync(moveSource, { recursive: true });
    fs.symlinkSync(moveExternalSystem, path.join(moveSource, 'System'), 'dir');

    const renameMachine = path.join(tempRoot, 'ai', 'Symlink-Rename-Machine');
    const renameExternalSystem = path.join(renameMachine, 'external-system');
    writeFile(path.join(renameExternalSystem, 'Views', '001-rogue', 'manifest.md'), 'rename-rogue');
    const renameSource = path.join(renameMachine, 'staged-system');
    fs.symlinkSync('external-system', renameSource, 'dir');
    const { ws, handlers } = createHandlers();

    await handlers['file:move']({
      type: 'file:move', source: moveSource, target: path.join(tempRoot, 'ai'),
      requestId: 'projected-symlink-move',
    });
    await handlers['file:rename']({
      type: 'file:rename', source: renameSource, newName: 'System',
      requestId: 'projected-symlink-rename',
    });

    expect(fs.lstatSync(path.join(moveSource, 'System')).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'Symlink-Machine'))).toBe(false);
    expect(fs.lstatSync(renameSource).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(renameMachine, 'System'))).toBe(false);
    expect(messagesOf(ws, 'file:moved')).toEqual([]);
    expect(messagesOf(ws, 'file:renamed')).toEqual([]);
  });

  test('denies public deletion of a declared ancestor with a symlinked protected root', async () => {
    const systemRoot = path.join(tempRoot, 'ai', 'Symlink-Machine', 'System');
    const externalRoot = path.join(tempRoot, 'external-capsules');
    const protectedFile = path.join(externalRoot, '001-files', 'content.json');
    writeFile(protectedFile, 'protected');
    fs.mkdirSync(systemRoot, { recursive: true });
    fs.symlinkSync(externalRoot, path.join(systemRoot, 'Views'), 'dir');
    const { ws, handlers } = createHandlers();

    await handlers['file:delete']({
      type: 'file:delete', source: systemRoot, requestId: 'symlink-root-ancestor',
    });

    expect(fs.lstatSync(path.join(systemRoot, 'Views')).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('protected');
    expect(messagesOf(ws, 'file:deleted')).toEqual([]);
  });

  test('denies a registered nested workspace protected-tree ancestor before public deletion', async () => {
    const nestedWorkspace = path.join(tempRoot, 'nested-workspace');
    const nestedSystem = path.join(nestedWorkspace, 'ai', 'Nested-Machine', 'System');
    const protectedFile = path.join(nestedSystem, 'Views', '001-files', 'content.json');
    writeFile(protectedFile, 'nested-protected');
    const workspaceRegistry = require('../../lib/workspace/registry-service');
    jest.spyOn(workspaceRegistry, 'list').mockResolvedValue([
      { id: 'workspace-a', repoPath: tempRoot },
      { id: 'workspace-b', repoPath: nestedWorkspace },
    ]);
    const { ws, handlers } = createHandlers();

    await handlers['file:delete']({
      type: 'file:delete', source: nestedSystem, requestId: 'nested-workspace-ancestor',
    });

    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('nested-protected');
    expect(messagesOf(ws, 'file:deleted')).toEqual([]);
  });

  test('denies symlink and hard-link aliases without changing protected identities', async () => {
    const protectedFile = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-files', 'content.json');
    writeFile(protectedFile, 'protected');
    const symlinkAlias = path.join(officeRoot, 'protected-alias.json');
    const hardLinkAlias = path.join(officeRoot, 'protected-hard-link.json');
    fs.symlinkSync(protectedFile, symlinkAlias);
    fs.linkSync(protectedFile, hardLinkAlias);
    const { ws, handlers } = createHandlers();

    await handlers['file:delete']({ type: 'file:delete', source: symlinkAlias });
    await handlers['file:delete']({ type: 'file:delete', source: hardLinkAlias });

    expect(fs.lstatSync(symlinkAlias).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(hardLinkAlias)).toBe(true);
    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('protected');
    expect(messagesOf(ws, 'file:deleted')).toEqual([]);
  });

  test('collision archival does not partially archive a protected hard-link destination', async () => {
    const protectedFile = path.join(tempRoot, 'ai', 'Test-Machine', 'Views', '001-files', 'deploy.md');
    const source = path.join(officeRoot, 'incoming', 'deploy.md');
    const target = path.join(officeRoot, '999-Archive');
    const destination = path.join(target, 'deploy.md');
    writeFile(protectedFile, 'protected');
    writeFile(source, 'incoming');
    fs.linkSync(protectedFile, destination);
    const { ws, handlers } = createHandlers();

    await handlers['file:move']({ type: 'file:move', source, target });

    expect(fs.readFileSync(source, 'utf8')).toBe('incoming');
    expect(fs.readFileSync(destination, 'utf8')).toBe('protected');
    expect(fs.readFileSync(protectedFile, 'utf8')).toBe('protected');
    expect(fs.existsSync(path.join(target, 'archive'))).toBe(false);
    expect(messagesOf(ws, 'file:moved')).toEqual([]);
  });

  test('collision archival projects relative symlinks before moving the existing destination', async () => {
    jest.useFakeTimers().setSystemTime(Date.parse('2026-01-02T03:04:05Z'));
    try {
      const canonical = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views');
      const source = path.join(officeRoot, 'incoming', 'deploy');
      const target = path.join(officeRoot, '999-Archive');
      const destination = path.join(target, 'deploy');
      const archivePath = path.join(target, 'archive', 'deploy-2026-01-02T03-04-05');
      writeFile(path.join(canonical, '001-files', 'manifest.md'), 'protected');
      writeFile(path.join(source, 'incoming.md'), 'incoming');
      fs.mkdirSync(destination, { recursive: true });
      const futureAlias = path.join(archivePath, 'protected-alias');
      fs.symlinkSync(path.relative(path.dirname(futureAlias), canonical), path.join(destination, 'protected-alias'), 'dir');
      const { ws, handlers } = createHandlers();

      await handlers['file:move']({ type: 'file:move', source, target });

      expect(fs.existsSync(source)).toBe(true);
      expect(fs.lstatSync(path.join(destination, 'protected-alias')).isSymbolicLink()).toBe(true);
      expect(fs.existsSync(archivePath)).toBe(false);
      expect(messagesOf(ws, 'file:moved')).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  test('Office thumbnail relocation projects a relative symlink before the primary move', async () => {
    const canonical = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views');
    const source = path.join(officeRoot, 'incoming', 'deep', 'report.md');
    const target = path.join(officeRoot, '999-Archive');
    const destination = path.join(target, 'report.md');
    const sourceThumbnail = path.join(path.dirname(source), '.thumbnails', 'report.md.png');
    const targetThumbnail = path.join(target, '.thumbnails', 'report.md.png');
    writeFile(path.join(canonical, '001-files', 'manifest.md'), 'protected');
    writeFile(source, '# Report');
    fs.mkdirSync(path.dirname(sourceThumbnail), { recursive: true });
    fs.symlinkSync(path.relative(path.dirname(targetThumbnail), canonical), sourceThumbnail, 'dir');
    expect(fs.existsSync(sourceThumbnail)).toBe(false);
    const { ws, handlers } = createHandlers();

    await handlers['file:move']({ type: 'file:move', source, target });

    expect(fs.readFileSync(source, 'utf8')).toBe('# Report');
    expect(fs.lstatSync(sourceThumbnail).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(destination)).toBe(false);
    expect(messagesOf(ws, 'file:moved')).toEqual([]);
  });

  test('generated Office thumbnail writes cannot target a protected tree through an alias', async () => {
    const canonical = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-files');
    const document = path.join(officeRoot, 'report.md');
    writeFile(path.join(canonical, 'content.json'), 'protected');
    writeFile(document, '# Report');
    fs.symlinkSync(canonical, path.join(officeRoot, '.thumbnails'), 'dir');
    const { ws, handlers } = createHandlers();

    await handlers['office:thumbnail_save']({
      type: 'office:thumbnail_save',
      documentPath: 'report.md',
      dataUrl: 'data:image/png;base64,aW1hZ2U=',
    });

    expect(fs.existsSync(path.join(canonical, 'report.md.png'))).toBe(false);
    expect(messagesOf(ws, 'office:thumbnail_saved')).toEqual([]);
    expect(messagesOf(ws, 'office:thumbnail_error')).toHaveLength(1);
  });

  test('generated Office thumbnail writes deny a broken final symlink into a protected tree', async () => {
    const canonical = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-files');
    const document = path.join(officeRoot, 'report.md');
    const protectedFutureFile = path.join(canonical, 'future.png');
    writeFile(path.join(canonical, 'content.json'), 'protected');
    writeFile(document, '# Report');
    const thumbnail = path.join(officeRoot, '.thumbnails', 'report.md.png');
    fs.mkdirSync(path.dirname(thumbnail), { recursive: true });
    fs.symlinkSync(protectedFutureFile, thumbnail);
    const { ws, handlers } = createHandlers();

    await handlers['office:thumbnail_save']({
      type: 'office:thumbnail_save',
      documentPath: 'report.md',
      dataUrl: 'data:image/png;base64,aW1hZ2U=',
    });

    expect(fs.lstatSync(thumbnail).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(protectedFutureFile)).toBe(false);
    expect(messagesOf(ws, 'office:thumbnail_saved')).toEqual([]);
  });

  test('Office sidecar denial prevents a partial primary rename', async () => {
    const canonical = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-files');
    const document = path.join(officeRoot, 'report.md');
    writeFile(path.join(canonical, 'report.md.png'), 'protected-thumbnail');
    writeFile(document, '# Report');
    fs.symlinkSync(canonical, path.join(officeRoot, '.thumbnails'), 'dir');
    const { ws, handlers } = createHandlers();

    await handlers['file:rename']({
      type: 'file:rename', source: document, newName: 'renamed.md',
    });

    expect(fs.readFileSync(document, 'utf8')).toBe('# Report');
    expect(fs.existsSync(path.join(officeRoot, 'renamed.md'))).toBe(false);
    expect(fs.readFileSync(path.join(canonical, 'report.md.png'), 'utf8')).toBe('protected-thumbnail');
    expect(messagesOf(ws, 'file:renamed')).toEqual([]);
  });

  test('untrusted state writes reject request-supplied authority before effects', async () => {
    const ws = createWs();
    const writeViewStatePatchUnderLease = require('../../lib/view-state').writeViewStatePatchUnderLease;
    const session = { projectRoot: tempRoot, currentWorkspaceId: 'workspace-a' };
    const handlers = createWorkspaceRequestHandlers({ ws, session, getAllClients: () => [] });

    await handlers['state:set']({
      type: 'state:set', view: 'capture-viewer', state: { marker: 'forged' },
      role: 'trusted-shell', origin: 'fusion-shell://app', authority: true,
    });

    expect(writeViewStatePatchUnderLease).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([{
      type: 'error', code: 'VIEW_MUTATION_DENIED', message: 'View mutation denied',
    }]);
  });
});
