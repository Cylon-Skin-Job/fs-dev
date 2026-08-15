'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('workspace registry service', () => {
  let tempRoot;
  let modules;

  beforeEach(async () => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-registry-service-'));
    process.env.FUSION_APP_USER_DATA = path.join(tempRoot, 'user-data');

    modules = {
      db: require('../../lib/db'),
      registry: require('../../lib/workspace/registry-service'),
    };

    await modules.db.initDb();
  });

  afterEach(async () => {
    await modules?.db.closeDb();
    delete process.env.FUSION_APP_USER_DATA;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  test('remove clears FK-owned workspace rows before deleting the workspace', async () => {
    const db = modules.db.getDb();

    await db('workspaces').insert({
      id: 'stale-workspace',
      label: 'Stale Workspace',
      icon: 'folder',
      repo_path: path.join(tempRoot, 'missing'),
      sort_order: 100,
      type: 'code',
    });
    await db('workspace_themes').insert({
      workspace_id: 'stale-workspace',
      primary_color: '#4fc3f7',
      primary_rgb: '79, 195, 247',
      theme_css: ':root {}',
      updated_at: Date.now(),
    });
    await db('workspace_screenshots').insert({
      workspace_id: 'stale-workspace',
      screenshot_png: Buffer.from('png'),
      panel_id: 'file-viewer',
      captured_at: Date.now(),
    });

    await expect(modules.registry.remove('stale-workspace')).resolves.toBe(true);

    await expect(db('workspaces').where({ id: 'stale-workspace' }).first()).resolves.toBeUndefined();
    await expect(
      db('workspace_themes').where({ workspace_id: 'stale-workspace' }).first()
    ).resolves.toBeUndefined();
    await expect(
      db('workspace_screenshots').where({ workspace_id: 'stale-workspace' }).first()
    ).resolves.toBeUndefined();
  });
});
