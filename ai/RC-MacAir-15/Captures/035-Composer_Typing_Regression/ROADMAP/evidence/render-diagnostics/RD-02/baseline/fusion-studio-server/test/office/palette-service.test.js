'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { createPaletteFileStore } = require('../../lib/office/palette-file-store');
const { createPalettePathHelper } = require('../../lib/office/palette-paths');
const { createPaletteService } = require('../../lib/office/palette-service');

const MACHINE = 'test-machine';

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value)}\n`);
}

describe('[slice 05S.1] source-selector palette service', () => {
  let root;
  let resourcesRoot;
  let systemManagerRoot;
  let globalPath;
  let workspaces;
  let writes;
  let service;

  function workspaceRoot(id) {
    return path.join(root, id);
  }

  function localPath(id) {
    return path.join(workspaceRoot(id), 'ai', MACHINE, 'System', 'config', 'colors.json');
  }

  async function createWorkspace(id = 'a') {
    const repoPath = workspaceRoot(id);
    await fsp.mkdir(repoPath, { recursive: true });
    workspaces.set(id, { id, repoPath });
  }

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fusion-palette-service-'));
    resourcesRoot = path.join(root, 'resources');
    systemManagerRoot = path.join(resourcesRoot, 'System_Manager');
    globalPath = path.join(
      systemManagerRoot,
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    );
    await fsp.mkdir(systemManagerRoot, { recursive: true });
    workspaces = new Map();
    await createWorkspace();
    writes = [];
    const realStore = createPaletteFileStore();
    const store = {
      read: realStore.read,
      write: jest.fn(async (location, document) => {
        writes.push({ filePath: location.filePath, document });
        await realStore.write(location, document);
      }),
    };
    service = createPaletteService({
      registryService: { getById: async (id) => workspaces.get(id) || null },
      aiPaths: { getSystemConfigRoot: (repoPath) => path.join(repoPath, 'ai', MACHINE, 'System', 'config') },
      pathHelper: createPalettePathHelper({
        getResourcesRoot: () => resourcesRoot,
        getUserDataRoot: () => null,
        repoRoot: resourcesRoot,
      }),
      store,
    });
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('missing local selects global with zero local write; global Add and Remove mutate only global', async () => {
    await writeJson(globalPath, { custom_colors: ['#AA0001'] });
    await expect(service.get('a')).resolves.toMatchObject({
      storedColors: ['#aa0001'], visibleColors: ['#aa0001'], syncEnabled: true,
    });
    await expect(fsp.stat(localPath('a'))).rejects.toMatchObject({ code: 'ENOENT' });

    await expect(service.add('a', '#BB0002')).resolves.toMatchObject({
      storedColors: ['#aa0001', '#bb0002'], syncEnabled: true, idempotent: false,
    });
    await expect(service.remove('a', '#AA0001')).resolves.toMatchObject({
      storedColors: ['#bb0002'], syncEnabled: true, idempotent: false,
    });
    expect(writes.map((entry) => entry.filePath)).toEqual([globalPath, globalPath]);
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({ custom_colors: ['#bb0002'] });
    await expect(fsp.stat(localPath('a'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('local Get/Add/Remove preserves global and writes exactly one selected file per mutation', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath('a'), { custom_colors: ['#200002'], sync_enabled: false });
    await expect(service.get('a')).resolves.toMatchObject({ storedColors: ['#200002'], syncEnabled: false });
    await service.add('a', '#300003');
    await service.remove('a', '#200002');
    expect(writes.map((entry) => entry.filePath)).toEqual([localPath('a'), localPath('a')]);
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual({
      custom_colors: ['#300003'], sync_enabled: false,
    });
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({ custom_colors: ['#100001'] });
  });

  test('toggles both directions without copying arrays and immediately projects the newly selected source', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath('a'), { custom_colors: ['#200002'], sync_enabled: true });

    await expect(service.setSync('a', false)).resolves.toMatchObject({
      storedColors: ['#200002'], syncEnabled: false,
    });
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual({
      custom_colors: ['#200002'], sync_enabled: false,
    });
    await expect(service.setSync('a', true)).resolves.toMatchObject({
      storedColors: ['#100001'], syncEnabled: true,
    });
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual({
      custom_colors: ['#200002'], sync_enabled: true,
    });
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({ custom_colors: ['#100001'] });
    expect(writes.map((entry) => entry.filePath)).toEqual([localPath('a'), localPath('a')]);
  });

  test('toggle changes only the local flag while preserving valid array values exactly', async () => {
    const localColors = ['#ABCDEF', '#abcdef', '#001122'];
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath('a'), { custom_colors: localColors, sync_enabled: true });

    await expect(service.setSync('a', false)).resolves.toMatchObject({
      storedColors: ['#abcdef', '#001122'], syncEnabled: false,
    });
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual({
      custom_colors: localColors, sync_enabled: false,
    });

    await expect(service.setSync('a', true)).resolves.toMatchObject({
      storedColors: ['#100001'], syncEnabled: true,
    });
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual({
      custom_colors: localColors, sync_enabled: true,
    });
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({ custom_colors: ['#100001'] });
  });

  test('does not persist an enabling flag when the newly selected global source is malformed', async () => {
    const local = { custom_colors: ['#200002'], sync_enabled: false };
    await writeJson(localPath('a'), local);
    await fsp.mkdir(path.dirname(globalPath), { recursive: true });
    const malformed = Buffer.from('{"custom_colors":"broken"}\n');
    await fsp.writeFile(globalPath, malformed);

    await expect(service.setSync('a', true)).rejects.toMatchObject({
      code: 'INVALID_SCHEMA', syncEnabled: true,
    });
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual(local);
    expect(await fsp.readFile(globalPath)).toEqual(malformed);
    expect(writes).toHaveLength(0);
  });

  test('materializes missing local only for set_sync and never copies global colors', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await expect(service.setSync('a', false)).resolves.toMatchObject({ storedColors: [], syncEnabled: false });
    expect(JSON.parse(await fsp.readFile(localPath('a'), 'utf8'))).toEqual({
      custom_colors: [], sync_enabled: false,
    });
    expect(writes).toHaveLength(1);
  });

  test('drift and invalid ignored custom_colors are irrelevant while global is selected', async () => {
    await createWorkspace('b');
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath('a'), { custom_colors: ['#aaaaaa'], sync_enabled: true });
    await writeJson(localPath('b'), { custom_colors: { invalid: true }, sync_enabled: true });
    await expect(service.get('a')).resolves.toMatchObject({ storedColors: ['#100001'], syncEnabled: true });
    await expect(service.get('b')).resolves.toMatchObject({ storedColors: ['#100001'], syncEnabled: true });
    await service.add('b', '#200002');
    expect(JSON.parse(await fsp.readFile(localPath('b'), 'utf8'))).toEqual({
      custom_colors: { invalid: true }, sync_enabled: true,
    });
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({
      custom_colors: ['#100001', '#200002'],
    });
  });

  test('malformed or oversized selected source rejects Get and Add without overwrite', async () => {
    await writeJson(localPath('a'), { custom_colors: [], sync_enabled: true });
    await fsp.mkdir(path.dirname(globalPath), { recursive: true });
    const malformed = Buffer.from('{"custom_colors":"broken"}\n');
    await fsp.writeFile(globalPath, malformed);
    await expect(service.get('a')).rejects.toMatchObject({ code: 'INVALID_SCHEMA', syncEnabled: true });
    await expect(service.add('a', '#100001')).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    expect(await fsp.readFile(globalPath)).toEqual(malformed);
    expect(writes).toHaveLength(0);

    const oversized = Buffer.alloc(16_385, 0x20);
    await fsp.writeFile(globalPath, oversized);
    await expect(service.add('a', '#100001')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(await fsp.readFile(globalPath)).toEqual(oversized);
    expect(writes).toHaveLength(0);
  });

  test('malformed selected local source rejects without overwriting either file', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    const malformed = Buffer.from('{"custom_colors":"broken","sync_enabled":false}\n');
    await fsp.mkdir(path.dirname(localPath('a')), { recursive: true });
    await fsp.writeFile(localPath('a'), malformed);
    await expect(service.get('a')).rejects.toMatchObject({ code: 'INVALID_SCHEMA', syncEnabled: false });
    await expect(service.remove('a', '#100001')).rejects.toMatchObject({ code: 'INVALID_SCHEMA' });
    expect(await fsp.readFile(localPath('a'))).toEqual(malformed);
    expect(JSON.parse(await fsp.readFile(globalPath, 'utf8'))).toEqual({ custom_colors: ['#100001'] });
    expect(writes).toHaveLength(0);
  });

  test('unwritable selected source returns a clear error without overwriting either array', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    await writeJson(localPath('a'), { custom_colors: ['#200002'], sync_enabled: true });
    const globalBefore = await fsp.readFile(globalPath);
    const localBefore = await fsp.readFile(localPath('a'));
    const failingPromises = Object.create(fsp);
    failingPromises.writeFile = async (filePath, ...args) => {
      if (path.basename(filePath).startsWith('.colors.json.')) {
        const error = new Error('injected unwritable selected source');
        error.code = 'EACCES';
        throw error;
      }
      return fsp.writeFile(filePath, ...args);
    };
    const rejectingService = createPaletteService({
      registryService: { getById: async (id) => workspaces.get(id) || null },
      aiPaths: { getSystemConfigRoot: (repoPath) => path.join(repoPath, 'ai', MACHINE, 'System', 'config') },
      pathHelper: createPalettePathHelper({
        getResourcesRoot: () => resourcesRoot,
        getUserDataRoot: () => null,
        repoRoot: resourcesRoot,
      }),
      store: createPaletteFileStore({ fsModule: { constants: fs.constants, promises: failingPromises } }),
    });

    await expect(rejectingService.add('a', '#300003')).rejects.toMatchObject({
      code: 'READ_ONLY', syncEnabled: true,
    });
    expect(await fsp.readFile(globalPath)).toEqual(globalBefore);
    expect(await fsp.readFile(localPath('a'))).toEqual(localBefore);
  });

  test('read-only selected file is not replaced by an atomic mutation', async () => {
    await writeJson(globalPath, { custom_colors: ['#100001'] });
    const globalBefore = await fsp.readFile(globalPath);
    await fsp.chmod(globalPath, 0o444);

    await expect(service.add('a', '#200002')).rejects.toMatchObject({
      code: 'READ_ONLY', syncEnabled: true,
    });
    expect(await fsp.readFile(globalPath)).toEqual(globalBefore);
    expect(writes).toHaveLength(1);
  });

  test('rejects a selected symlink without reading or overwriting its external target', async () => {
    const externalPath = path.join(root, 'outside-global.json');
    const externalBytes = Buffer.from('{"custom_colors":["#100001"]}\n');
    await fsp.writeFile(externalPath, externalBytes);
    await fsp.mkdir(path.dirname(globalPath), { recursive: true });
    await fsp.symlink(externalPath, globalPath);

    await expect(service.get('a')).rejects.toMatchObject({ code: 'SYMLINK_REJECTED', syncEnabled: true });
    await expect(service.add('a', '#200002')).rejects.toMatchObject({
      code: 'SYMLINK_REJECTED', syncEnabled: true,
    });
    expect(await fsp.readFile(externalPath)).toEqual(externalBytes);
    expect(writes).toHaveLength(0);
  });

  test('oversized ignored local colors cannot block global Get/Add but remain protected in local mode', async () => {
    const ignoredColors = Array.from({ length: 2000 }, (_, index) => (
      `#${index.toString(16).padStart(6, '0')}`
    ));
    await writeJson(globalPath, { custom_colors: ['#abcdef'] });
    await writeJson(localPath('a'), { custom_colors: ignoredColors, sync_enabled: true });
    const ignoredBytes = await fsp.readFile(localPath('a'));
    expect(ignoredBytes.length).toBeGreaterThan(16_384);

    await expect(service.get('a')).resolves.toMatchObject({ storedColors: ['#abcdef'], syncEnabled: true });
    await expect(service.add('a', '#fedcba')).resolves.toMatchObject({
      storedColors: ['#abcdef', '#fedcba'], syncEnabled: true,
    });
    expect(await fsp.readFile(localPath('a'))).toEqual(ignoredBytes);

    await writeJson(localPath('a'), { custom_colors: ignoredColors, sync_enabled: false });
    const selectedBytes = await fsp.readFile(localPath('a'));
    await expect(service.get('a')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', syncEnabled: false });
    await expect(service.remove('a', ignoredColors[0])).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
    expect(await fsp.readFile(localPath('a'))).toEqual(selectedBytes);
  });

  test('idempotent true toggle ignores malformed local colors and performs no write', async () => {
    await writeJson(globalPath, { custom_colors: ['#abcdef'] });
    const ignoredLocal = Buffer.from('{"custom_colors":{"invalid":true},"sync_enabled":true}\n');
    await fsp.mkdir(path.dirname(localPath('a')), { recursive: true });
    await fsp.writeFile(localPath('a'), ignoredLocal);

    await expect(service.setSync('a', true)).resolves.toMatchObject({
      storedColors: ['#abcdef'], syncEnabled: true,
    });
    expect(await fsp.readFile(localPath('a'))).toEqual(ignoredLocal);
    expect(writes).toHaveLength(0);
  });

  test('packaged machines use independent writable globals and never mutate the resource seed', async () => {
    await writeJson(globalPath, { custom_colors: [] });
    const seedBytes = await fsp.readFile(globalPath);
    await writeJson(localPath('a'), { custom_colors: ['#200002'], sync_enabled: true });
    const userDataA = path.join(root, 'user-data-a');
    const userDataB = path.join(root, 'user-data-b');
    await fsp.mkdir(userDataA);
    await fsp.mkdir(userDataB);
    const liveGlobal = (userDataRoot) => path.join(
      userDataRoot,
      'System_Manager',
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    );
    const packagedService = (userDataRoot) => createPaletteService({
      registryService: { getById: async (id) => workspaces.get(id) || null },
      aiPaths: {
        getSystemConfigRoot: (repoPath) => path.join(repoPath, 'ai', MACHINE, 'System', 'config'),
      },
      pathHelper: createPalettePathHelper({
        getResourcesRoot: () => resourcesRoot,
        getUserDataRoot: () => userDataRoot,
        repoRoot: root,
      }),
    });

    const machineA = packagedService(userDataA);
    await expect(machineA.get('a')).resolves.toMatchObject({ storedColors: [], syncEnabled: true });
    await machineA.add('a', '#100001');
    expect(JSON.parse(await fsp.readFile(liveGlobal(userDataA), 'utf8'))).toEqual({
      custom_colors: ['#100001'],
    });

    const machineB = packagedService(userDataB);
    await expect(machineB.get('a')).resolves.toMatchObject({ storedColors: [], syncEnabled: true });
    await machineB.add('a', '#300003');
    expect(JSON.parse(await fsp.readFile(liveGlobal(userDataB), 'utf8'))).toEqual({
      custom_colors: ['#300003'],
    });
    expect(await fsp.readFile(globalPath)).toEqual(seedBytes);

    await machineB.setSync('a', false);
    await expect(machineB.get('a')).resolves.toMatchObject({ storedColors: ['#200002'], syncEnabled: false });
  });

  test('distinct Add at complete count fails while idempotent Add and Remove perform zero writes', async () => {
    const colors = Array.from({ length: 20 }, (_, index) => `#${index.toString(16).padStart(6, '0')}`);
    await writeJson(globalPath, { custom_colors: colors });
    await expect(service.add('a', colors[0].toUpperCase())).resolves.toMatchObject({ idempotent: true });
    await expect(service.remove('a', '#ffffff')).resolves.toMatchObject({ idempotent: true });
    await expect(service.add('a', '#fffffe')).rejects.toMatchObject({ code: 'PALETTE_LIMIT' });
    expect(writes).toHaveLength(0);
  });

  test('preserves complete storage while exposing only the first 20 colors', async () => {
    const colors = Array.from({ length: 22 }, (_, index) => `#${index.toString(16).padStart(6, '0')}`);
    await writeJson(globalPath, { custom_colors: colors });
    await expect(service.get('a')).resolves.toMatchObject({
      storedColors: colors,
      visibleColors: colors.slice(0, 20),
      syncEnabled: true,
    });
  });
});
