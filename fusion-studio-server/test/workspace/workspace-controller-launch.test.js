'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('workspace controller launch audit', () => {
  let tempRoot;
  let modules;
  let logSpy;
  let warnSpy;

  beforeEach(async () => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-workspace-launch-'));
    process.env.FUSION_APP_USER_DATA = path.join(tempRoot, 'user-data');
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';

    modules = {
      db: require('../../lib/db'),
      controller: require('../../lib/workspace/workspace-controller'),
      eventBus: require('../../lib/event-bus'),
    };

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await modules.db.initDb();
    await modules.db.getDb()('workspace_screenshots').del();
    await modules.db.getDb()('workspace_themes').del();
    await modules.db.getDb()('workspaces').del();
  });

  afterEach(async () => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    await modules?.db.closeDb();
    delete process.env.FUSION_APP_USER_DATA;
    delete process.env.FUSION_LOCAL_MACHINE;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  function createValidWorkspaceRoot(name) {
    const repoPath = path.join(tempRoot, name);
    fs.mkdirSync(path.join(repoPath, 'ai', 'Test-Machine', 'Views'), { recursive: true });
    return repoPath;
  }

  function createInvalidWorkspaceRoot(name) {
    const repoPath = path.join(tempRoot, name);
    fs.mkdirSync(path.join(repoPath, 'ai'), { recursive: true });
    return repoPath;
  }

  function createLegacyWorkspaceRoot(name) {
    const repoPath = path.join(tempRoot, name);
    fs.mkdirSync(path.join(repoPath, 'ai', 'views', 'file-viewer'), { recursive: true });
    return repoPath;
  }

  async function insertWorkspace(row) {
    await modules.db.getDb()('workspaces').insert({
      icon: 'folder',
      description: null,
      type: 'code',
      ribbon_visible: 1,
      ribbon_sort_order: row.sort_order,
      ...row,
    });
  }

  test('keeps unavailable registered rows and falls back to a launchable workspace', async () => {
    const missingPath = path.join(tempRoot, 'missing');
    const validPath = createValidWorkspaceRoot('valid');
    const invalidPath = createInvalidWorkspaceRoot('invalid');
    const unavailableEvents = [];
    modules.eventBus.on('workspace:unavailable_at_launch', (event) => unavailableEvents.push(event));

    await insertWorkspace({
      id: 'missing',
      label: 'Missing',
      repo_path: missingPath,
      sort_order: 0,
      ribbon_sort_order: 0,
    });
    await insertWorkspace({
      id: 'valid',
      label: 'Valid',
      repo_path: validPath,
      sort_order: 1,
      ribbon_sort_order: 1,
    });
    await insertWorkspace({
      id: 'invalid',
      label: 'Invalid',
      repo_path: invalidPath,
      sort_order: 2,
      ribbon_sort_order: 2,
    });
    await modules.db.getDb()('system_config')
      .insert({
        key: 'last_active_workspace_id',
        value: 'missing',
        updated_at: Date.now(),
      })
      .onConflict('key')
      .merge(['value', 'updated_at']);

    await modules.controller.start();

    const rows = await modules.db.getDb()('workspaces').select('id').orderBy('sort_order', 'asc');
    expect(rows.map((row) => row.id)).toEqual(['missing', 'valid', 'invalid']);
    expect(modules.controller.getActiveWorkspaceId()).toBe('valid');
    expect(unavailableEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ workspaceId: 'missing', reason: 'path_missing' }),
      expect.objectContaining({ workspaceId: 'invalid', reason: 'invalid_structure' }),
    ]));
  });

  test('treats legacy ai/views workspaces as launchable registrations', async () => {
    const legacyPath = createLegacyWorkspaceRoot('legacy');
    const unavailableEvents = [];
    modules.eventBus.on('workspace:unavailable_at_launch', (event) => unavailableEvents.push(event));

    await insertWorkspace({
      id: 'legacy',
      label: 'Legacy',
      repo_path: legacyPath,
      sort_order: 0,
      ribbon_sort_order: 0,
    });

    await modules.controller.start();

    expect(modules.controller.getActiveWorkspaceId()).toBe('legacy');
    expect(unavailableEvents).toEqual([]);
  });
});
