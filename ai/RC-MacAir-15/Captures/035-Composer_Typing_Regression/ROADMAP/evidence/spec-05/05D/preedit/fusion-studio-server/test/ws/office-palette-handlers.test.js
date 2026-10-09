'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { createPalettePathHelper } = require('../../lib/office/palette-paths');
const { createPaletteService } = require('../../lib/office/palette-service');
const {
  MAX_REQUEST_ID_BYTES,
  createOfficePaletteHandlers,
  validRequestId,
} = require('../../lib/ws/office-palette-handlers');

const MACHINE = 'handler-machine';

describe('[slice 05S.1] correlated palette request handlers', () => {
  let root;
  let workspaceRoot;
  let globalPath;
  let localPath;
  let registryService;
  let service;
  let ws;
  let messages;
  let peer;
  let handlers;
  let session;

  async function writeJson(filePath, value) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, `${JSON.stringify(value)}\n`);
  }

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fusion-palette-handler-'));
    workspaceRoot = path.join(root, 'workspace');
    const resourcesRoot = path.join(root, 'resources');
    globalPath = path.join(
      resourcesRoot,
      'System_Manager',
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    );
    localPath = path.join(workspaceRoot, 'ai', MACHINE, 'System', 'config', 'colors.json');
    await fsp.mkdir(workspaceRoot, { recursive: true });
    await fsp.mkdir(path.join(resourcesRoot, 'System_Manager'), { recursive: true });
    registryService = {
      getById: jest.fn(async (id) => (id === 'workspace-a' ? { id, repoPath: workspaceRoot } : null)),
    };
    service = createPaletteService({
      registryService,
      aiPaths: {
        getSystemConfigRoot: (repoPath) => path.join(repoPath, 'ai', MACHINE, 'System', 'config'),
      },
      pathHelper: createPalettePathHelper({
        getResourcesRoot: () => resourcesRoot,
        getUserDataRoot: () => null,
        repoRoot: resourcesRoot,
      }),
    });
    messages = [];
    ws = { readyState: 1, send: jest.fn((raw) => messages.push(JSON.parse(raw))) };
    peer = { readyState: 1, send: jest.fn() };
    session = { currentWorkspaceId: 'workspace-a' };
    handlers = createOfficePaletteHandlers({
      ws,
      session,
      sessions: new Map([[ws, { currentWorkspaceId: 'workspace-a' }], [peer, { currentWorkspaceId: 'workspace-a' }]]),
      registryService,
      service,
    });
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('real filesystem flow returns one correlated state for Get, Add, toggle, and Remove with no peer broadcast', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath, { custom_colors: ['#200002'], sync_enabled: true });

    await handlers['office:palette_get']({ requestId: 'get-1', workspaceId: 'workspace-a' });
    await handlers['office:palette_add']({ requestId: 'add-1', workspaceId: 'workspace-a', color: '#300003' });
    await handlers['office:palette_set_sync']({ requestId: 'sync-1', workspaceId: 'workspace-a', enabled: false });
    await handlers['office:palette_remove']({ requestId: 'remove-1', workspaceId: 'workspace-a', color: '#200002' });

    expect(messages).toEqual([
      expect.objectContaining({
        type: 'office:palette_state', requestId: 'get-1', operation: 'get', source: 'request',
        customColors: ['#100001'], syncEnabled: true, availability: 'ready', syncStatus: 'ok',
      }),
      expect.objectContaining({
        type: 'office:palette_state', requestId: 'add-1', operation: 'add', source: 'mutation',
        customColors: ['#100001', '#300003'], syncEnabled: true,
      }),
      expect.objectContaining({
        type: 'office:palette_state', requestId: 'sync-1', operation: 'set_sync', source: 'mutation',
        customColors: ['#200002'], syncEnabled: false,
      }),
      expect.objectContaining({
        type: 'office:palette_state', requestId: 'remove-1', operation: 'remove', source: 'mutation',
        customColors: [], syncEnabled: false,
      }),
    ]);
    expect(peer.send).not.toHaveBeenCalled();
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({
      custom_colors: ['#100001', '#300003'],
    });
    expect(JSON.parse(await fsp.readFile(localPath, 'utf8'))).toEqual({
      custom_colors: [], sync_enabled: false,
    });
  });

  test('returns a sanitized correlated unavailable error for malformed selected source', async () => {
    await writeJson(localPath, { custom_colors: [], sync_enabled: true });
    await fsp.mkdir(path.dirname(globalPath), { recursive: true });
    await fsp.writeFile(globalPath, '{"custom_colors":"/secret/path"}\n');

    await handlers['office:palette_get']({ requestId: 'bad-1', workspaceId: 'workspace-a' });

    expect(messages).toEqual([{
      type: 'office:palette_error',
      requestId: 'bad-1',
      workspaceId: 'workspace-a',
      operation: 'get',
      code: 'INVALID_SCHEMA',
      message: 'The workspace palette has an invalid schema.',
      state: {
        customColors: [], syncEnabled: true, source: 'error', availability: 'unavailable', syncStatus: 'degraded',
      },
    }]);
    expect(JSON.stringify(messages)).not.toContain('/secret/path');
  });

  test('workspace switch requests reread only the target selector and selected source', async () => {
    const workspaceBRoot = path.join(root, 'workspace-b');
    const localBPath = path.join(workspaceBRoot, 'ai', MACHINE, 'System', 'config', 'colors.json');
    await fsp.mkdir(workspaceBRoot, { recursive: true });
    registryService.getById.mockImplementation(async (id) => {
      if (id === 'workspace-a') return { id, repoPath: workspaceRoot };
      if (id === 'workspace-b') return { id, repoPath: workspaceBRoot };
      return null;
    });
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath, { custom_colors: ['#aaaaaa'], sync_enabled: true });
    await writeJson(localBPath, { custom_colors: ['#200002'], sync_enabled: false });

    await handlers['office:palette_get']({ requestId: 'a-1', workspaceId: 'workspace-a' });
    session.currentWorkspaceId = 'workspace-b';
    await handlers['office:palette_get']({ requestId: 'b-1', workspaceId: 'workspace-b' });
    await writeJson(localBPath, { custom_colors: ['#300003'], sync_enabled: false });
    await handlers['office:palette_get']({ requestId: 'b-refresh', workspaceId: 'workspace-b' });

    expect(messages.map(({ workspaceId, customColors }) => ({ workspaceId, customColors }))).toEqual([
      { workspaceId: 'workspace-a', customColors: ['#100001'] },
      { workspaceId: 'workspace-b', customColors: ['#200002'] },
      { workspaceId: 'workspace-b', customColors: ['#300003'] },
    ]);
    expect(peer.send).not.toHaveBeenCalled();
  });

  test('validates opaque request IDs, active workspace, and mutation payloads before writes', async () => {
    const boundaryId = 'é'.repeat(64);
    expect(Buffer.byteLength(boundaryId)).toBe(MAX_REQUEST_ID_BYTES);
    expect(validRequestId(boundaryId)).toBe(true);
    expect(validRequestId(`${boundaryId}a`)).toBe(false);

    await handlers['office:palette_get']({ requestId: '', workspaceId: 'workspace-a' });
    await handlers['office:palette_get']({ requestId: 'unknown', workspaceId: 'workspace-z' });
    await handlers['office:palette_add']({ requestId: 'bad-color', workspaceId: 'workspace-a', color: '#nope' });

    expect(messages.map(({ code }) => code)).toEqual(['INVALID_REQUEST', 'UNKNOWN_WORKSPACE', 'INVALID_REQUEST']);
    await expect(fsp.stat(globalPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fsp.stat(localPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('contains no watcher, timer, registry barrier, fanout, or recovery runtime', async () => {
    const serverRoot = path.resolve(__dirname, '..', '..');
    const obsolete = [
      ['palette', 'config', 'watcher.js'],
      ['palette', 'sync', 'coordinator.js'],
      ['palette', 'sync', 'model.js'],
      ['palette', 'removal', 'journal.js'],
    ].map((parts) => parts.join('-'));
    for (const fileName of obsolete) {
      await expect(fsp.stat(path.join(serverRoot, 'lib', 'office', fileName)))
        .rejects.toMatchObject({ code: 'ENOENT' });
    }
    const inspected = await Promise.all([
      fsp.readFile(path.join(serverRoot, 'lib', 'startup.js'), 'utf8'),
      fsp.readFile(path.join(serverRoot, 'lib', 'workspace', 'registry-service.js'), 'utf8'),
      fsp.readFile(path.join(serverRoot, 'lib', 'ws', 'office-palette-handlers.js'), 'utf8'),
      fsp.readFile(path.join(serverRoot, 'lib', 'office', 'palette-service.js'), 'utf8'),
    ]);
    const combined = inspected.join('\n');
    const forbidden = [
      ...obsolete.map((name) => name.slice(0, -3)),
      ['withOfficePalette', 'ReadBarrier'].join(''),
      ['getOfficePaletteRegistry', 'Generation'].join(''),
      ['snapshotForOffice', 'Palette'].join(''),
      ['set', 'Timeout'].join(''),
      ['set', 'Interval'].join(''),
      ['sendWorkspace', 'Connections'].join(''),
      ['reconcil', 'ing'].join(''),
      ['SYNC', 'PARTIAL'].join('_'),
      ['failedWorkspace', 'Ids'].join(''),
    ];
    for (const marker of forbidden) expect(combined).not.toContain(marker);
  });
});
