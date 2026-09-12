'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('protected generated CLI configuration destination', () => {
  let root;
  let ensureWorkspaceFile;

  beforeEach(() => {
    jest.resetModules();
    process.env.FUSION_LOCAL_MACHINE = 'Test Machine';
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-protected-cli-config-'));
    ({ ensureWorkspaceFile } = require('../../lib/cli-config/loader'));
  });

  afterEach(() => {
    delete process.env.FUSION_LOCAL_MACHINE;
    fs.rmSync(root, { recursive: true, force: true });
    jest.resetModules();
  });

  test('default config generation denies a capsule symlink before mkdir/temp/final effects', async () => {
    const protectedConfigRoot = path.join(
      root, 'ai', 'Test-Machine', 'System', 'Views', '001-chat', 'state',
    );
    fs.mkdirSync(protectedConfigRoot, { recursive: true });
    const systemRoot = path.join(root, 'ai', 'Test-Machine', 'System');
    fs.symlinkSync(protectedConfigRoot, path.join(systemRoot, 'config'), 'dir');

    await expect(ensureWorkspaceFile(root))
      .rejects.toMatchObject({ code: 'PROTECTED_VIEW_PATH' });

    expect(fs.readdirSync(protectedConfigRoot)).toEqual([]);
  });

  test('ordinary default config generation remains functional', async () => {
    await ensureWorkspaceFile(root);

    const file = path.join(root, 'ai', 'Test-Machine', 'System', 'config', 'cli.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toMatchObject({ defaultHarness: 'opencode' });
    expect(fs.readdirSync(path.dirname(file))).toEqual(['cli.json']);
  });
});
