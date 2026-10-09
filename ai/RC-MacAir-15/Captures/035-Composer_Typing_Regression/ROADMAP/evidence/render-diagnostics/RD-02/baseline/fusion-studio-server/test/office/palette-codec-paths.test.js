'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const {
  parseGlobalConfig,
  parseLocalConfig,
  parseLocalSelector,
} = require('../../lib/office/palette-codec');
const { createPalettePathHelper } = require('../../lib/office/palette-paths');
const {
  seedPackagedGlobalConfigs,
} = require('../../../fusion-studio-client/electron/system-manager-seed.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

describe('[slice 05S.1] palette codecs and global path resolution', () => {
  let root;

  beforeEach(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'fusion-palette-paths-'));
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  test('normalizes unique colors while enforcing exact global and local schemas', () => {
    expect(parseGlobalConfig(Buffer.from('{"custom_colors":["#AABBCC","#aabbcc","#001122"]}'))).toEqual({
      customColors: ['#aabbcc', '#001122'],
    });
    expect(parseLocalConfig(Buffer.from('{"custom_colors":["#ABCDEF"],"sync_enabled":false}'))).toEqual({
      customColors: ['#abcdef'], syncEnabled: false,
    });
    expect(() => parseGlobalConfig(Buffer.from('{"custom_colors":[],"sync_enabled":true}')))
      .toThrow(expect.objectContaining({ code: 'INVALID_SCHEMA' }));
    expect(() => parseLocalConfig(Buffer.from('{"custom_colors":[]}')))
      .toThrow(expect.objectContaining({ code: 'INVALID_SCHEMA' }));
  });

  test('reads the selector without allowing ignored local colors to govern global selection', () => {
    const selector = parseLocalSelector(Buffer.from(
      '{"custom_colors":{"intentionally":"invalid"},"sync_enabled":true}',
    ));
    expect(selector.syncEnabled).toBe(true);
    expect(() => parseLocalConfig(Buffer.from(
      '{"custom_colors":{"intentionally":"invalid"},"sync_enabled":true}',
    ))).toThrow(expect.objectContaining({ code: 'INVALID_SCHEMA', syncEnabled: true }));
  });

  test('uses writable user data for live packaged state and keeps resources as seed-only', async () => {
    const resourcesRoot = path.join(root, 'resources');
    const userDataRoot = path.join(root, 'user-data');
    await fsp.mkdir(path.join(resourcesRoot, 'System_Manager'), { recursive: true });
    await fsp.mkdir(userDataRoot);
    const helper = createPalettePathHelper({
      getResourcesRoot: () => resourcesRoot,
      getUserDataRoot: () => userDataRoot,
      repoRoot: root,
    });
    expect(helper.getGlobalLocation()).toEqual({
      trustedRoot: userDataRoot,
      filePath: path.join(
        userDataRoot,
        'System_Manager',
        'global-configs',
        'office-custom-color-pallete',
        'colors.json',
      ),
    });
    expect(helper.getPackagedSeedLocation().filePath).toBe(path.join(
      resourcesRoot,
      'System_Manager',
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    ));
  });

  test('development without user data uses the repository System_Manager root', async () => {
    const resourcesRoot = path.join(root, 'electron-resources');
    await fsp.mkdir(resourcesRoot);
    const helper = createPalettePathHelper({
      getResourcesRoot: () => resourcesRoot,
      getUserDataRoot: () => null,
      repoRoot: root,
    });
    expect(helper.getSystemManagerRoot()).toBe(path.join(root, 'System_Manager'));
    expect(helper.getGlobalLocation()).toEqual({
      trustedRoot: path.join(root, 'System_Manager'),
      filePath: path.join(
        root,
        'System_Manager',
        'global-configs',
        'office-custom-color-pallete',
        'colors.json',
      ),
    });
  });

  test('packages canonical global configs as a process.resourcesPath seed', async () => {
    const clientPackage = JSON.parse(await fsp.readFile(
      path.join(REPO_ROOT, 'fusion-studio-client', 'package.json'),
      'utf8',
    ));
    expect(clientPackage.build.extraResources).toContainEqual({
      from: '../System_Manager/global-configs',
      to: 'System_Manager/global-configs',
      filter: ['**/*'],
    });

    const source = path.join(
      REPO_ROOT,
      'System_Manager',
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    );
    const sourceBytes = await fsp.readFile(source);
    expect(() => parseGlobalConfig(sourceBytes)).not.toThrow();
    const packagedRoot = path.join(root, 'packaged-resources');
    await fsp.mkdir(path.join(packagedRoot, 'System_Manager'), { recursive: true });
    const helper = createPalettePathHelper({
      getResourcesRoot: () => packagedRoot,
      getUserDataRoot: () => null,
      repoRoot: root,
    });
    expect(path.relative(packagedRoot, helper.getPackagedSeedLocation().filePath)).toBe(
      path.join('System_Manager', 'global-configs', 'office-custom-color-pallete', 'colors.json'),
    );
  });

  test('seeds writable packaged global configs once without overwriting live machine state', async () => {
    const resourcesRoot = path.join(root, 'packaged-resources');
    const userDataRoot = path.join(root, 'user-data');
    const seedPath = path.join(
      resourcesRoot,
      'System_Manager',
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    );
    const livePath = path.join(
      userDataRoot,
      'System_Manager',
      'global-configs',
      'office-custom-color-pallete',
      'colors.json',
    );
    await fsp.mkdir(path.dirname(seedPath), { recursive: true });
    await fsp.mkdir(path.join(userDataRoot, 'System_Manager', 'global-configs', 'another-config'), {
      recursive: true,
    });
    await fsp.writeFile(seedPath, '{"custom_colors":["#100001"]}\n');

    expect(seedPackagedGlobalConfigs({
      resourcesPath: resourcesRoot, userDataPath: userDataRoot, packaged: true,
    }))
      .toMatchObject({ seeded: true });
    expect(await fsp.readFile(livePath, 'utf8')).toBe('{"custom_colors":["#100001"]}\n');

    await fsp.writeFile(livePath, '{"custom_colors":["#200002"]}\n');
    await fsp.writeFile(seedPath, '{"custom_colors":["#300003"]}\n');
    expect(seedPackagedGlobalConfigs({
      resourcesPath: resourcesRoot, userDataPath: userDataRoot, packaged: true,
    }))
      .toMatchObject({ seeded: false, reason: 'existing' });
    expect(await fsp.readFile(livePath, 'utf8')).toBe('{"custom_colors":["#200002"]}\n');
  });

  test('does not seed repository-backed development runs', async () => {
    const resourcesRoot = path.join(root, 'resources');
    expect(seedPackagedGlobalConfigs({ resourcesPath: resourcesRoot, userDataPath: null }))
      .toEqual({ seeded: false, reason: 'development' });
    await expect(fsp.stat(path.join(resourcesRoot, 'System_Manager')))
      .rejects.toMatchObject({ code: 'ENOENT' });
  });
});
