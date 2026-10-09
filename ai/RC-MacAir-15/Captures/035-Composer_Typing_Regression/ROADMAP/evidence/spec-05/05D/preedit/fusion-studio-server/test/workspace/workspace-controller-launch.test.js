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
    fs.mkdirSync(path.join(repoPath, 'ai', 'Test-Machine', 'System', 'Views'), { recursive: true });
    return repoPath;
  }

  function createReadyWorkspaceRoot(name) {
    const repoPath = fs.realpathSync(createValidWorkspaceRoot(name));
    const capsule = path.join(repoPath, 'ai', 'Test-Machine', 'System', 'Views', '001-file-viewer');
    fs.mkdirSync(capsule, { recursive: true });
    fs.writeFileSync(path.join(capsule, 'manifest.md'), [
      '---',
      'name: "Files"',
      'metadata:',
      '  view-id: "file-viewer"',
      '  data-source: "none"',
      '---',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(capsule, 'content.json'), JSON.stringify({
      version: 1,
      dataSource: 'none',
      root: { type: 'none' },
    }), 'utf8');
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

  function waitForEvent(type, predicate = () => true) {
    return new Promise((resolve) => {
      const unsubscribe = modules.eventBus.on(type, (event) => {
        if (!predicate(event)) return;
        unsubscribe();
        resolve(event);
      });
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

  test('does not publish controller readiness until registered view readiness finishes', async () => {
    const validPath = createValidWorkspaceRoot('readiness-gated');
    await insertWorkspace({
      id: 'readiness-gated',
      label: 'Readiness Gated',
      repo_path: validPath,
      sort_order: 0,
      ribbon_sort_order: 0,
    });
    const readiness = require('../../lib/views/readiness-runtime');
    let signalEntered;
    let release;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const pending = new Promise(resolve => { release = resolve; });
    const readinessSpy = jest.spyOn(readiness, 'ensureRegisteredWorkspaceReadiness')
      .mockImplementation(async () => {
        signalEntered();
        await pending;
        return new Map();
      });
    const readyEvent = jest.fn();
    modules.eventBus.on('workspace:controller_ready', readyEvent);

    const starting = modules.controller.start();
    await entered;
    expect(readyEvent).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.flat().some((value) => (
      String(value).includes('[WorkspaceController] Launch registry audit:')
    ))).toBe(false);
    release();
    await starting;
    expect(readinessSpy).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'readiness-gated', repoPath: validPath }),
    ]);
    expect(logSpy.mock.calls.flat().some((value) => (
      String(value).includes('[WorkspaceController] Launch registry audit:')
    ))).toBe(true);
    expect(readyEvent).toHaveBeenCalledTimes(1);
  });

  test('retires and drains view readiness before deleting a workspace registry row', async () => {
    const repoPath = createValidWorkspaceRoot('remove-readiness');
    await insertWorkspace({
      id: 'remove-readiness',
      label: 'Remove Readiness',
      repo_path: repoPath,
      sort_order: 0,
      ribbon_sort_order: 0,
    });
    await modules.controller.start();

    const readiness = require('../../lib/views/readiness-runtime');
    let signalEntered;
    let releaseRetirement;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const pending = new Promise(resolve => { releaseRetirement = resolve; });
    const retireSpy = jest.spyOn(readiness, 'retireWorkspaceViewReadiness')
      .mockImplementation(async (_context, retirementEffect) => {
        signalEntered();
        await pending;
        return retirementEffect();
      });
    const removed = new Promise(resolve => modules.eventBus.on('workspace:removed', resolve));

    modules.eventBus.emit('workspace:remove_requested', { workspaceId: 'remove-readiness' });
    await entered;
    await expect(modules.db.getDb()('workspaces').where({ id: 'remove-readiness' }).first())
      .resolves.toBeDefined();

    releaseRetirement();
    await removed;
    await expect(modules.db.getDb()('workspaces').where({ id: 'remove-readiness' }).first())
      .resolves.toBeUndefined();
    expect(retireSpy).toHaveBeenCalledWith({
      workspaceId: 'remove-readiness',
      projectRoot: repoPath,
    }, expect.any(Function));
  });

  test('orders public switch requests while earlier target readiness is pending', async () => {
    const rootA = createValidWorkspaceRoot('workspace-a');
    const rootB = createValidWorkspaceRoot('workspace-b');
    const rootC = createValidWorkspaceRoot('workspace-c');
    for (const [index, [id, repoPath]] of [
      ['workspace-a', rootA],
      ['workspace-b', rootB],
      ['workspace-c', rootC],
    ].entries()) {
      await insertWorkspace({
        id,
        label: id,
        repo_path: repoPath,
        sort_order: index,
        ribbon_sort_order: index,
      });
    }
    await modules.db.getDb()('system_config').insert({
      key: 'last_active_workspace_id', value: 'workspace-a', updated_at: Date.now(),
    }).onConflict('key').merge(['value', 'updated_at']);
    await modules.controller.start();

    const readiness = require('../../lib/views/readiness-runtime');
    const originalEnsure = readiness.ensureWorkspaceViewReadiness;
    let signalBEntered;
    let releaseB;
    const bEntered = new Promise(resolve => { signalBEntered = resolve; });
    const bPending = new Promise(resolve => { releaseB = resolve; });
    const readinessSpy = jest.spyOn(readiness, 'ensureWorkspaceViewReadiness')
      .mockImplementation(async (request) => {
        if (request.workspaceId === 'workspace-b') {
          signalBEntered();
          await bPending;
        }
        return originalEnsure(request);
      });
    const switches = [];
    let resolveTwoSwitches;
    const twoSwitches = new Promise(resolve => { resolveTwoSwitches = resolve; });
    const unsubscribe = modules.eventBus.on('workspace:switched', (event) => {
      switches.push(event.to);
      if (switches.length === 2) resolveTwoSwitches();
    });

    modules.eventBus.emit('workspace:switch_requested', { workspaceId: 'workspace-b' });
    await bEntered;
    modules.eventBus.emit('workspace:switch_requested', { workspaceId: 'workspace-c' });
    await new Promise(resolve => setImmediate(resolve));
    expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-a');

    releaseB();
    await twoSwitches;
    unsubscribe();
    readinessSpy.mockRestore();

    expect(switches).toEqual(['workspace-b', 'workspace-c']);
    expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-c');
    expect(modules.controller.getActiveWorkspaceSync()).toMatchObject({
      id: 'workspace-c', repoPath: rootC,
    });
  });

  test('initial publication lane cannot miss concurrent A to B to A transitions', async () => {
    const rootA = createValidWorkspaceRoot('initial-lane-a');
    const rootB = createValidWorkspaceRoot('initial-lane-b');
    for (const [index, [id, repoPath]] of [
      ['workspace-a', rootA],
      ['workspace-b', rootB],
    ].entries()) {
      await insertWorkspace({
        id, label: id, repo_path: repoPath, sort_order: index, ribbon_sort_order: index,
      });
    }
    await modules.db.getDb()('system_config').insert({
      key: 'last_active_workspace_id', value: 'workspace-a', updated_at: Date.now(),
    }).onConflict('key').merge(['value', 'updated_at']);
    await modules.controller.start();

    let signalEntered;
    let releasePublication;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const held = new Promise(resolve => { releasePublication = resolve; });
    const initialSnapshots = [];
    let sessionVisible = false;
    const switches = [];
    let resolveSwitches;
    const twoSwitches = new Promise(resolve => { resolveSwitches = resolve; });
    const unsubscribe = modules.eventBus.on('workspace:switched', (event) => {
      switches.push({ ...event, sessionVisible });
      if (switches.length === 2) resolveSwitches();
    });

    const initialization = modules.controller.runInWorkspaceLifecycle(async () => {
      initialSnapshots.push({
        workspaceId: modules.controller.getActiveWorkspaceId(),
        revision: modules.controller.getActiveWorkspaceBindingRevision(),
      });
      signalEntered();
      await held;
      initialSnapshots.push({
        workspaceId: modules.controller.getActiveWorkspaceId(),
        revision: modules.controller.getActiveWorkspaceBindingRevision(),
      });
      sessionVisible = true;
    });
    await entered;
    modules.eventBus.emit('workspace:switch_requested', { workspaceId: 'workspace-b' });
    modules.eventBus.emit('workspace:switch_requested', { workspaceId: 'workspace-a' });
    await new Promise(resolve => setImmediate(resolve));
    expect(switches).toEqual([]);

    releasePublication();
    await initialization;
    await twoSwitches;
    unsubscribe();

    expect(initialSnapshots).toEqual([
      { workspaceId: 'workspace-a', revision: 1 },
      { workspaceId: 'workspace-a', revision: 1 },
    ]);
    expect(switches.map(({ to, bindingRevision, sessionVisible: visible }) => (
      [to, bindingRevision, visible]
    ))).toEqual([
      ['workspace-b', 2, true],
      ['workspace-a', 3, true],
    ]);
  });

  test('orders public removal after a pending switch and never reactivates the removed target', async () => {
    const rootA = createValidWorkspaceRoot('remove-race-a');
    const rootB = createValidWorkspaceRoot('remove-race-b');
    await insertWorkspace({
      id: 'workspace-a', label: 'workspace-a', repo_path: rootA,
      sort_order: 0, ribbon_sort_order: 0,
    });
    await insertWorkspace({
      id: 'workspace-b', label: 'workspace-b', repo_path: rootB,
      sort_order: 1, ribbon_sort_order: 1,
    });
    await modules.db.getDb()('system_config').insert({
      key: 'last_active_workspace_id', value: 'workspace-a', updated_at: Date.now(),
    }).onConflict('key').merge(['value', 'updated_at']);
    await modules.controller.start();

    const readiness = require('../../lib/views/readiness-runtime');
    const originalEnsure = readiness.ensureWorkspaceViewReadiness;
    let signalBEntered;
    let releaseB;
    const bEntered = new Promise(resolve => { signalBEntered = resolve; });
    const bPending = new Promise(resolve => { releaseB = resolve; });
    const readinessSpy = jest.spyOn(readiness, 'ensureWorkspaceViewReadiness')
      .mockImplementation(async (request) => {
        if (request.workspaceId === 'workspace-b') {
          signalBEntered();
          await bPending;
        }
        return originalEnsure(request);
      });
    const removed = waitForEvent('workspace:removed', event => event.workspaceId === 'workspace-b');
    const switchedBack = waitForEvent(
      'workspace:switched',
      event => event.from === 'workspace-b' && event.to === 'workspace-a',
    );

    modules.eventBus.emit('workspace:switch_requested', { workspaceId: 'workspace-b' });
    await bEntered;
    modules.eventBus.emit('workspace:remove_requested', { workspaceId: 'workspace-b' });
    await new Promise(resolve => setImmediate(resolve));
    expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-a');
    await expect(modules.db.getDb()('workspaces').where({ id: 'workspace-b' }).first())
      .resolves.toBeDefined();

    releaseB();
    await removed;
    await switchedBack;
    readinessSpy.mockRestore();

    await expect(modules.db.getDb()('workspaces').where({ id: 'workspace-b' }).first())
      .resolves.toBeUndefined();
    expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-a');
    expect(modules.controller.getActiveWorkspaceSync()).toMatchObject({
      id: 'workspace-a', repoPath: rootA,
    });
  });

  test('orders create after an active-workspace removal drains without a stale switch', async () => {
    const rootA = createReadyWorkspaceRoot('create-race-a');
    const rootB = createReadyWorkspaceRoot('create-race-b');
    const rootC = path.join(tempRoot, 'workspace-c');
    await insertWorkspace({
      id: 'workspace-a', label: 'workspace-a', repo_path: rootA,
      sort_order: 0, ribbon_sort_order: 0,
    });
    await insertWorkspace({
      id: 'workspace-b', label: 'workspace-b', repo_path: rootB,
      sort_order: 1, ribbon_sort_order: 1,
    });
    await modules.db.getDb()('system_config').insert({
      key: 'last_active_workspace_id', value: 'workspace-a', updated_at: Date.now(),
    }).onConflict('key').merge(['value', 'updated_at']);
    await modules.controller.start();

    const readiness = require('../../lib/views/readiness-runtime');
    await expect(readiness.ensureWorkspaceViewReadiness({
      workspaceId: 'workspace-a', projectRoot: rootA,
    })).resolves.toMatchObject({ status: 'verified', verified: true });
    let heldLease = readiness.acquireViewReadinessLease({
      workspaceId: 'workspace-a', projectRoot: rootA,
    });
    const switches = [];
    const unsubscribe = modules.eventBus.on('workspace:switched', (event) => switches.push(event));
    const removed = waitForEvent('workspace:removed', event => event.workspaceId === 'workspace-a');
    const created = waitForEvent('workspace:created', event => event.workspace.id === 'workspace-c');
    const switchedToC = waitForEvent('workspace:switched', event => event.to === 'workspace-c');

    try {
      modules.eventBus.emit('workspace:remove_requested', { workspaceId: 'workspace-a' });
      await new Promise(resolve => setImmediate(resolve));
      expect(readiness.getViewReadinessStatus({
        workspaceId: 'workspace-a', projectRoot: rootA,
      })).toMatchObject({ status: 'unavailable', verified: false });

      modules.eventBus.emit('workspace:create_requested', {
        projectPath: rootC,
        label: 'Workspace C',
        connectionId: 'create-race',
      });
      await new Promise(resolve => setImmediate(resolve));
      expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-a');
      expect(fs.existsSync(rootC)).toBe(false);

      heldLease.release();
      heldLease = null;
      await removed;
      await created;
      await switchedToC;
      await new Promise(resolve => setImmediate(resolve));

      expect(switches.map((event) => [event.from, event.to])).toEqual([
        ['workspace-a', 'workspace-b'],
        ['workspace-b', 'workspace-c'],
      ]);
      expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-c');
      expect(modules.controller.getActiveWorkspaceSync()).toMatchObject({
        id: 'workspace-c', repoPath: fs.realpathSync(rootC),
      });
      await expect(modules.db.getDb()('workspaces').where({ id: 'workspace-a' }).first())
        .resolves.toBeUndefined();
    } finally {
      heldLease?.release();
      unsubscribe();
    }
  });

  test('orders add of a path after its pending removal instead of rejecting a stale duplicate', async () => {
    const rootA = createReadyWorkspaceRoot('add-race-a');
    const rootB = createReadyWorkspaceRoot('workspace-b');
    await insertWorkspace({
      id: 'workspace-a', label: 'workspace-a', repo_path: rootA,
      sort_order: 0, ribbon_sort_order: 0,
    });
    await insertWorkspace({
      id: 'workspace-b', label: 'workspace-b', repo_path: rootB,
      sort_order: 1, ribbon_sort_order: 1,
    });
    await modules.db.getDb()('system_config').insert({
      key: 'last_active_workspace_id', value: 'workspace-a', updated_at: Date.now(),
    }).onConflict('key').merge(['value', 'updated_at']);
    await modules.controller.start();

    const readiness = require('../../lib/views/readiness-runtime');
    await expect(readiness.ensureWorkspaceViewReadiness({
      workspaceId: 'workspace-b', projectRoot: rootB,
    })).resolves.toMatchObject({ status: 'verified', verified: true });
    let heldLease = readiness.acquireViewReadinessLease({
      workspaceId: 'workspace-b', projectRoot: rootB,
    });
    const duplicate = jest.fn();
    const unsubscribeDuplicate = modules.eventBus.on('workspace:add_rejected_duplicate', duplicate);
    const removed = waitForEvent('workspace:removed', event => event.workspaceId === 'workspace-b');
    const added = waitForEvent('workspace:added', event => event.workspace.repoPath === rootB);

    try {
      modules.eventBus.emit('workspace:remove_requested', { workspaceId: 'workspace-b' });
      await new Promise(resolve => setImmediate(resolve));
      expect(readiness.getViewReadinessStatus({
        workspaceId: 'workspace-b', projectRoot: rootB,
      })).toMatchObject({ status: 'unavailable', verified: false });

      modules.eventBus.emit('workspace:add_requested', {
        repoPath: rootB,
        connectionId: 'add-race',
      });
      await new Promise(resolve => setImmediate(resolve));
      expect(duplicate).not.toHaveBeenCalled();
      await expect(modules.db.getDb()('workspaces').where({ id: 'workspace-b' }).first())
        .resolves.toBeDefined();

      heldLease.release();
      heldLease = null;
      await removed;
      await expect(added).resolves.toMatchObject({
        workspace: { id: 'workspace-b', repoPath: rootB },
        viewRegistryUnavailable: false,
      });
      expect(duplicate).not.toHaveBeenCalled();
      expect(modules.controller.getActiveWorkspaceId()).toBe('workspace-a');
      await expect(modules.db.getDb()('workspaces').where({ id: 'workspace-b' }).first())
        .resolves.toMatchObject({ id: 'workspace-b', repo_path: rootB });
    } finally {
      heldLease?.release();
      unsubscribeDuplicate();
    }
  });
});
