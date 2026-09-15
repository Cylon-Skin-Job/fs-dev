'use strict';

/**
 * CHAT-03 / SPEC-03 §8, §11 — durable group-deletion worksurface cleanup.
 *
 * Exercises the public `thread:action` delete over a real temp workspace,
 * real view-state files, and a real temp SQLite database:
 *   - the view-bound delete atomically records exactly one
 *     `remove-group-worksurface` instruction (Legacy records none);
 *   - the trusted in-process consumer removes only the exact entry through the
 *     view-state writer and acknowledges it;
 *   - an injected writer failure commits the delete, leaves the instruction
 *     unapplied/observable, and a deterministic retry removes exactly the entry;
 *   - repeated delivery is harmless; restart recovery drains a pending
 *     instruction; and cross-view/workspace/group keys are never touched.
 *
 * No dev database, owner workspace, or Alpha profile is touched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-tg-wscleanup-${process.pid}-${Date.now()}`);
const previousUserDataDir = process.env.FUSION_APP_USER_DATA;
process.env.FUSION_APP_USER_DATA = userDataDir;

jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-id') }));

jest.mock('../../lib/harness/compat', () => ({
  spawnThreadWire: jest.fn(() => ({ pid: 4242, kill: jest.fn(), once: jest.fn() })),
}));

jest.mock('../../lib/wire/process-manager', () => ({
  getWireForThread: jest.fn(),
  registerWire: jest.fn(),
  attachClientToWire: jest.fn(),
  unregisterWire: jest.fn(),
  unregisterWireForClient: jest.fn(),
  sendToWire: jest.fn(),
}));

const { initDb, closeDb, getDb } = require('../../lib/db');
const { ThreadWebSocketHandler } = require('../../lib/thread');
const { ThreadManager } = require('../../lib/thread/ThreadManager');
const { getProjectThreadManager } = require('../../lib/thread/thread-manager-registry');
const { createThreadWsHandlers } = require('../../lib/ws/thread-ws-handlers');
const { createWorkspaceRequestHandlers } = require('../../lib/ws/workspace-request-handlers');
const viewReadiness = require('../../lib/views/readiness-runtime');
const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');

const MACHINE = 'Fixture-Machine';
const EPOCH = 'workspace-epoch-1';

const FILE_VIEW = 'file-viewer';
const WIKI_VIEW = 'wiki-viewer';

function writeManifest(viewsRoot, folder, viewId) {
  const dir = path.join(viewsRoot, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.md'), [
    '---',
    `name: ${viewId}`,
    'metadata:',
    `  view-id: ${viewId}`,
    '---',
    '',
  ].join('\n'));
}

function statePath(projectRoot, viewId) {
  const folder = viewId === FILE_VIEW ? '001-file-viewer' : '002-wiki-viewer';
  return path.join(projectRoot, 'ai', MACHINE, 'System', 'Views', folder, 'state', 'state.json');
}

function makeProjectRoot() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-wscleanup-root-')));
  const viewsRoot = path.join(root, 'ai', MACHINE, 'System', 'Views');
  fs.mkdirSync(viewsRoot, { recursive: true });
  writeManifest(viewsRoot, '001-file-viewer', FILE_VIEW);
  writeManifest(viewsRoot, '002-wiki-viewer', WIKI_VIEW);
  return root;
}

function makeWs() {
  const ws = { readyState: 1, sent: [], send(payload) { this.sent.push(JSON.parse(payload)); } };
  ws.send = jest.fn(ws.send.bind(ws));
  return ws;
}

function makeSession(projectRoot, workspaceId, { trusted = true } = {}) {
  const session = {
    currentWorkspaceId: workspaceId,
    workspaceEpoch: EPOCH,
    workspaceBindingState: 'active',
    projectRoot,
  };
  if (trusted) {
    Object.defineProperty(session, 'connectionRole', {
      value: 'trusted-shell', enumerable: false,
    });
  }
  return session;
}

function firstOfType(ws, type) {
  return ws.sent.find((message) => message.type === type) || null;
}

const CONTENT = { schemaVersion: 1, tabs: [], activeTabId: null };

describe('group-delete worksurface cleanup', () => {
  let projectRoot;
  let previousMachine;
  let workspaceCounter = 0;

  beforeAll(() => {
    const coordinator = createViewReadinessCoordinator({
      machineIdentity: MACHINE,
      migrationService: {
        ensureReady: async (request) => ({
          ...request,
          status: 'verified',
          destinationRoot: path.join(request.projectRoot, 'ai', MACHINE, 'System', 'Views'),
        }),
      },
    });
    viewReadiness.installViewReadinessOwner(coordinator);
  });

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    projectRoot = makeProjectRoot();
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    if (previousUserDataDir === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousUserDataDir;
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  function nextWorkspaceId() {
    workspaceCounter += 1;
    return `workspace-wscleanup-${workspaceCounter}`;
  }

  async function makeHarness({ workspaceId, threadId, groupId, viewId = FILE_VIEW }) {
    const manager = getProjectThreadManager(projectRoot, workspaceId);
    await manager.ensureGroupsActivated();
    await viewReadiness.ensureWorkspaceViewReadiness({ workspaceId, projectRoot });
    await manager.createThread(threadId, 'Alpha', {
      harnessId: 'opencode', groupId, viewId,
    });

    const ws = makeWs();
    ThreadWebSocketHandler.setPanel(ws, viewId, {
      projectRoot, viewName: viewId, workspaceId, workspaceEpoch: EPOCH,
    });
    const recipients = [];
    const session = makeSession(projectRoot, workspaceId);
    const threadHandlers = createThreadWsHandlers({
      ws,
      session,
      wireLifecycle: {
        awaitHarnessReady: jest.fn(() => Promise.resolve()),
        initializeWire: jest.fn(),
        setupWireHandlers: jest.fn(),
      },
      projectRoot,
      getWorkspaceRecipients: ({ excludeWs } = {}) => recipients
        .filter((recipient) => recipient.ws && recipient.ws !== excludeWs),
    });
    const workspaceHandlers = createWorkspaceRequestHandlers({
      ws,
      session: makeSession(projectRoot, workspaceId),
      getAllClients: () => [ws],
    });
    return {
      manager, ws, threadHandlers, workspaceHandlers, recipients, session,
      threadId, groupId, viewId,
    };
  }

  async function putEntry(harness, { groupId = harness.groupId, viewId = harness.viewId, content = CONTENT } = {}) {
    await harness.workspaceHandlers['state:worksurface_put']({
      type: 'state:worksurface_put',
      viewId,
      threadGroupId: groupId,
      requestId: `put-${groupId}-${viewId}`,
      expectedContentRevision: null,
      adapterId: viewId,
      adapterVersion: 1,
      content,
    });
  }

  async function getEntry(harness, { groupId = harness.groupId, viewId = harness.viewId } = {}) {
    harness.ws.sent.length = 0;
    await harness.workspaceHandlers['state:worksurface_get']({
      type: 'state:worksurface_get',
      viewId,
      threadGroupId: groupId,
      requestId: `get-${groupId}-${viewId}`,
    });
    return firstOfType(harness.ws, 'state:worksurface_result');
  }

  function readViewState(viewId) {
    const file = statePath(projectRoot, viewId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  async function cleanupRows(workspaceId) {
    return getDb()('thread_group_worksurface_cleanup').where({ workspace_id: workspaceId });
  }

  test('view-bound delete atomically inserts one outbox record, delivers it, and GET reads absent', async () => {
    const workspaceId = nextWorkspaceId();
    const harness = await makeHarness({ workspaceId, threadId: 't-1', groupId: 'tg-1' });
    await putEntry(harness);
    expect(readViewState(FILE_VIEW).threadWorksurfaces['tg-1']).toBeTruthy();

    harness.ws.sent.length = 0;
    await harness.threadHandlers['thread:action']({
      action: 'delete', requestId: 'd-1', threadGroupId: 'tg-1',
    });
    const ack = firstOfType(harness.ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'delete', requestId: 'd-1', threadGroupId: 'tg-1', threadId: 't-1', deleted: true,
    });
    expect(ack.viewStateCleanup).toMatchObject({ status: 'applied', attempts: 1 });
    expect(JSON.stringify(ack)).not.toContain('surfaceId');

    // Exactly one durable instruction, bounded identity/delivery state only.
    const rows = await cleanupRows(workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      idempotency_key: `remove-group-worksurface:${workspaceId}:${FILE_VIEW}:tg-1`,
      workspace_id: workspaceId,
      view_id: FILE_VIEW,
      group_id: 'tg-1',
      status: 'applied',
      attempts: 1,
    });
    expect(rows[0].applied_at).toEqual(expect.any(Number));
    const materialized = JSON.stringify(rows[0]);
    for (const forbidden of ['surfaceId', 'threadId', 'content', 'schemaVersion']) {
      expect(materialized).not.toContain(forbidden);
    }

    // The exact entry is gone and a public GET reads it absent.
    const state = readViewState(FILE_VIEW);
    expect(state.threadWorksurfaces ?? {}).not.toHaveProperty('tg-1');
    const read = await getEntry(harness);
    expect(read).toMatchObject({ entry: null, contentRevision: null, placementRevision: null });

    // The group itself is gone, but the instruction survived it.
    expect(await getDb()('thread_groups').where({ group_id: 'tg-1' })).toHaveLength(0);
    expect(await cleanupRows(workspaceId)).toHaveLength(1);
  });

  test('Legacy groups create no cleanup record and report not_applicable', async () => {
    const workspaceId = nextWorkspaceId();
    const manager = getProjectThreadManager(projectRoot, workspaceId);
    await manager.ensureGroupsActivated();
    await manager.createThread('t-legacy', 'Legacy', { harnessId: 'opencode', groupId: 'tg-legacy', viewId: null });
    const ws = makeWs();
    ThreadWebSocketHandler.setPanel(ws, FILE_VIEW, {
      projectRoot, viewName: FILE_VIEW, workspaceId, workspaceEpoch: EPOCH,
    });
    const handlers = createThreadWsHandlers({
      ws,
      session: makeSession(projectRoot, workspaceId),
      wireLifecycle: {
        awaitHarnessReady: jest.fn(() => Promise.resolve()),
        initializeWire: jest.fn(), setupWireHandlers: jest.fn(),
      },
      projectRoot,
      getWorkspaceRecipients: () => [],
    });

    await handlers['thread:action']({ action: 'delete', requestId: 'd-legacy', threadGroupId: 'tg-legacy' });
    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({ deleted: true, viewId: null });
    expect(ack.viewStateCleanup).toMatchObject({ status: 'not_applicable', attempts: 0 });
    expect(await cleanupRows(workspaceId)).toHaveLength(0);
  });

  test('injected writer failure commits the delete; retry removes exactly the entry; repeat is harmless', async () => {
    const workspaceId = nextWorkspaceId();
    const harness = await makeHarness({ workspaceId, threadId: 't-2', groupId: 'tg-2' });
    await putEntry(harness);
    await putEntry(harness, { groupId: 'tg-keep', content: { schemaVersion: 1, marker: 'keep' } });

    const fsPromises = require('fs').promises;
    const originalRename = fsPromises.rename;
    fsPromises.rename = async () => { throw new Error('injected writer failure'); };
    let failedAck;
    try {
      harness.ws.sent.length = 0;
      await harness.threadHandlers['thread:action']({
        action: 'delete', requestId: 'd-fail', threadGroupId: 'tg-2',
      });
      failedAck = firstOfType(harness.ws, 'thread:action:completed');
    } finally {
      fsPromises.rename = originalRename;
    }

    // The delete committed and stayed success-shaped; cleanup is unapplied but
    // observable and never rolled the group deletion back.
    expect(failedAck).toMatchObject({ deleted: true });
    expect(failedAck.viewStateCleanup.status).not.toBe('applied');
    expect(failedAck.viewStateCleanup.attempts).toBeGreaterThanOrEqual(1);
    expect(await getDb()('thread_groups').where({ group_id: 'tg-2' })).toHaveLength(0);
    const pending = await cleanupRows(workspaceId);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).not.toBe('applied');
    // The exact entry was not removed because the write failed.
    expect(readViewState(FILE_VIEW).threadWorksurfaces['tg-2']).toBeTruthy();

    // Deterministic retry applies only the unapplied instruction.
    const applied = await harness.manager.retryWorksurfaceCleanupForGroup('tg-2');
    expect(applied).toMatchObject({ status: 'applied' });
    const state = readViewState(FILE_VIEW);
    expect(state.threadWorksurfaces ?? {}).not.toHaveProperty('tg-2');
    expect(state.threadWorksurfaces['tg-keep']).toBeTruthy();
    const afterRetry = (await cleanupRows(workspaceId))[0];
    expect(afterRetry.status).toBe('applied');
    const attemptsAfterRetry = afterRetry.attempts;

    // Repeated delivery after success is harmless and never double-counted.
    const again = await harness.manager.retryWorksurfaceCleanupForGroup('tg-2');
    expect(again.status).toBe('applied');
    const repeated = (await cleanupRows(workspaceId))[0];
    expect(repeated.status).toBe('applied');
    expect(repeated.attempts).toBe(attemptsAfterRetry);
    expect(readViewState(FILE_VIEW).threadWorksurfaces['tg-keep']).toBeTruthy();
  });

  test('restart recovery drains a pending instruction over the same database', async () => {
    const workspaceId = nextWorkspaceId();
    const harness = await makeHarness({ workspaceId, threadId: 't-3', groupId: 'tg-3' });
    await putEntry(harness);

    const fsPromises = require('fs').promises;
    const originalRename = fsPromises.rename;
    fsPromises.rename = async () => { throw new Error('injected writer failure'); };
    try {
      await harness.manager.deleteGroup('tg-3');
    } finally {
      fsPromises.rename = originalRename;
    }
    const before = (await cleanupRows(workspaceId))[0];
    expect(before.status).not.toBe('applied');
    expect(readViewState(FILE_VIEW).threadWorksurfaces['tg-3']).toBeTruthy();

    // Fresh manager/handler family over the same DB ("process restart").
    const restarted = new ThreadManager({ projectRoot, workspaceId });
    await restarted.ensureGroupsActivated();

    const after = (await cleanupRows(workspaceId))[0];
    expect(after.status).toBe('applied');
    expect(readViewState(FILE_VIEW).threadWorksurfaces ?? {}).not.toHaveProperty('tg-3');

    // A fresh public GET reads absent after the restart convergence.
    const ws = makeWs();
    const handlers = createWorkspaceRequestHandlers({
      ws,
      session: makeSession(projectRoot, workspaceId),
      getAllClients: () => [ws],
    });
    await handlers['state:worksurface_get']({
      type: 'state:worksurface_get', viewId: FILE_VIEW, threadGroupId: 'tg-3', requestId: 'g-restart',
    });
    expect(firstOfType(ws, 'state:worksurface_result').entry).toBeNull();
  });

  test('cleanup never removes another view, workspace, or group entry', async () => {
    const workspaceId = nextWorkspaceId();
    const otherWorkspaceId = nextWorkspaceId();
    const harness = await makeHarness({ workspaceId, threadId: 't-4', groupId: 'tg-4' });
    await putEntry(harness);
    await putEntry(harness, { groupId: 'tg-other' });
    await putEntry(harness, { viewId: WIKI_VIEW, groupId: 'tg-4', content: { schemaVersion: 1, marker: 'wiki' } });

    const otherRoot = makeProjectRoot();
    try {
      await viewReadiness.ensureWorkspaceViewReadiness({ workspaceId: otherWorkspaceId, projectRoot: otherRoot });
      const otherWs = makeWs();
      const otherHandlers = createWorkspaceRequestHandlers({
        ws: otherWs,
        session: makeSession(otherRoot, otherWorkspaceId),
        getAllClients: () => [otherWs],
      });
      // A same-key entry in a different workspace (identity is the qualified
      // `{workspaceId, viewId, threadGroupId}` tuple).
      await otherHandlers['state:worksurface_put']({
        type: 'state:worksurface_put',
        viewId: FILE_VIEW,
        threadGroupId: 'tg-4',
        requestId: 'put-other-ws',
        expectedContentRevision: null,
        adapterId: FILE_VIEW,
        adapterVersion: 1,
        content: { schemaVersion: 1, marker: 'other-workspace' },
      });

      await harness.threadHandlers['thread:action']({
        action: 'delete', requestId: 'd-cross', threadGroupId: 'tg-4',
      });
      expect(firstOfType(harness.ws, 'thread:action:completed').viewStateCleanup.status).toBe('applied');

      // This workspace/view entry removed; sibling group and sibling view kept.
      const fileState = readViewState(FILE_VIEW);
      expect(fileState.threadWorksurfaces ?? {}).not.toHaveProperty('tg-4');
      expect(fileState.threadWorksurfaces['tg-other']).toBeTruthy();
      const wikiState = readViewState(WIKI_VIEW);
      expect(wikiState.threadWorksurfaces['tg-4']).toMatchObject({ content: { marker: 'wiki' } });

      // The same group id in a different workspace is untouched.
      const otherStateFile = path.join(
        otherRoot, 'ai', MACHINE, 'System', 'Views', '001-file-viewer', 'state', 'state.json',
      );
      const otherState = JSON.parse(fs.readFileSync(otherStateFile, 'utf8'));
      expect(otherState.threadWorksurfaces['tg-4']).toMatchObject({
        content: { marker: 'other-workspace' },
      });
    } finally {
      fs.rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  test('removing a group with no entry is an acknowledged no-op and creates no file', async () => {
    const workspaceId = nextWorkspaceId();
    const harness = await makeHarness({ workspaceId, threadId: 't-5', groupId: 'tg-5' });
    expect(fs.existsSync(statePath(projectRoot, FILE_VIEW))).toBe(false);

    await harness.threadHandlers['thread:action']({
      action: 'delete', requestId: 'd-noop', threadGroupId: 'tg-5',
    });
    const ack = firstOfType(harness.ws, 'thread:action:completed');
    expect(ack.viewStateCleanup).toMatchObject({ status: 'applied', attempts: 1 });
    const rows = await cleanupRows(workspaceId);
    expect(rows[0].status).toBe('applied');
    // No entry existed, so no capsule file was created or rewritten.
    expect(fs.existsSync(statePath(projectRoot, FILE_VIEW))).toBe(false);
  });
});
