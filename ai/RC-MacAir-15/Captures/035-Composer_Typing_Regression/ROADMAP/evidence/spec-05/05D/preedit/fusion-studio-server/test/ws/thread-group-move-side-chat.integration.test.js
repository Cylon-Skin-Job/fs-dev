'use strict';

/**
 * SPEC-04 slice 04A — Move Chat to Side Chat public route integration.
 *
 * Proves the trusted `thread:action` Move through a real temp workspace + real
 * view-state file: eligibility, sequence/idempotency, the atomic group
 * transition (membership/primary/activity/MRU), the durable placement outbox,
 * SPEC-03 managed placement delivery, restart recovery, and the
 * Move/Delete ordering invariants. No dev database, owner workspace, or Alpha
 * profile is touched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const MACHINE = 'Test-Machine';

const userDataDir = path.join(os.tmpdir(), `fusion-tg-move-${process.pid}-${Date.now()}`);
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
const { createThreadWsHandlers } = require('../../lib/ws/thread-ws-handlers');
const { getProjectThreadManager } = require('../../lib/thread/thread-manager-registry');

const MODEL_CATALOG = {
  defaultProvider: 'deepseek',
  providers: [
    {
      id: 'deepseek',
      label: 'DeepSeek',
      defaultModel: 'deepseek/v4-flash',
      models: [
        { id: 'deepseek/v4-flash', name: 'DeepSeek V4 Flash', variants: ['low', 'high'] },
      ],
    },
  ],
};

function writeManifest(folder, viewId) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'manifest.md'), [
    '---',
    `name: ${viewId}`,
    'metadata:',
    `  view-id: ${viewId}`,
    '---',
    '',
  ].join('\n'));
}

function writeModelsConfig(projectRoot) {
  const configDir = path.join(projectRoot, 'ai', MACHINE, 'System', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'opencode-models.json'),
    JSON.stringify(MODEL_CATALOG, null, 2),
  );
}

function makeProjectRoot(label) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `fusion-tg-move-${label}-`)));
  writeManifest(path.join(root, 'ai', MACHINE, 'System', 'Views', '001-file-viewer'), 'file-viewer');
  // SPEC-04 §11 04B: the bridge-covered chat-capable set spans native adapters
  // (capture-viewer) and adapterless hosts (wiki-viewer); an explicitly
  // ineligible registered view (system-viewer) proves the precommit rejection.
  writeManifest(path.join(root, 'ai', MACHINE, 'System', 'Views', '002-capture-viewer'), 'capture-viewer');
  writeManifest(path.join(root, 'ai', MACHINE, 'System', 'Views', '003-wiki-viewer'), 'wiki-viewer');
  writeManifest(path.join(root, 'ai', MACHINE, 'System', 'Views', '004-system-viewer'), 'system-viewer');
  return root;
}

function readViewState(projectRoot, viewId) {
  const folder = viewId === 'file-viewer' ? '001-file-viewer' : viewId;
  const file = path.join(root0(projectRoot), 'ai', MACHINE, 'System', 'Views', folder, 'state', 'state.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function root0(projectRoot) {
  return projectRoot;
}

function makeWs() {
  return { send: jest.fn(), readyState: 1 };
}

function makeSession(projectRoot, workspaceId, { trusted = true } = {}) {
  const session = {
    currentWorkspaceId: workspaceId,
    workspaceEpoch: 'workspace-epoch-1',
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

function makeHandlers({ ws, session, projectRoot }) {
  return createThreadWsHandlers({
    ws,
    session,
    wireLifecycle: {
      awaitHarnessReady: jest.fn(() => Promise.resolve()),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
    projectRoot,
    getWorkspaceRecipients: () => [],
  });
}

function frames(ws) {
  return ws.send.mock.calls.map((call) => JSON.parse(call[0]));
}

function firstOfType(ws, type) {
  return frames(ws).find((message) => message.type === type) || null;
}

describe('move_chat_to_side public route', () => {
  let previousMachine;
  let workspaceCounter = 0;
  let readiness;
  let coordinator;

  beforeAll(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    readiness = require('../../lib/views/readiness-runtime');
    const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
    coordinator = createViewReadinessCoordinator({
      machineIdentity: MACHINE,
      migrationService: {
        ensureReady: async (request) => ({
          ...request,
          status: 'verified',
          destinationRoot: path.join(request.projectRoot, 'ai', MACHINE, 'System', 'Views'),
        }),
      },
    });
    readiness.installViewReadinessOwner(coordinator);
    await initDb();
  });

  afterAll(async () => {
    await closeDb();
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    if (previousUserDataDir === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousUserDataDir;
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  async function makeHarness(label) {
    workspaceCounter += 1;
    const workspaceId = `workspace-move-${workspaceCounter}`;
    const projectRoot = makeProjectRoot(`${label}-${workspaceCounter}`);
    await readiness.ensureWorkspaceViewReadiness({ workspaceId, projectRoot });
    const manager = getProjectThreadManager(projectRoot, workspaceId);
    const activation = await manager.ensureGroupsActivated();
    expect(activation.ok).toBe(true);
    const ws = makeWs();
    ThreadWebSocketHandler.setPanel(ws, 'file-viewer', {
      projectRoot, viewName: 'file-viewer', workspaceId, workspaceEpoch: 'workspace-epoch-1',
    });
    const handlers = makeHandlers({
      ws, session: makeSession(projectRoot, workspaceId), projectRoot,
    });
    return { workspaceId, projectRoot, manager, ws, handlers };
  }

  async function seedViewBoundGroup(h, { name = 'Alpha', model = null, variant = null, viewId = 'file-viewer' } = {}) {
    const threadId = `t-${h.workspaceId}`;
    const groupId = `tg-${h.workspaceId}`;
    await h.manager.createThread(threadId, name, {
      harnessId: 'opencode', groupId, viewId,
    });
    if (model) await h.manager.updateHarnessConfig(threadId, { model, ...(variant ? { variant } : {}) });
    return { threadId, groupId, viewId };
  }

  async function readPlacementEntry(projectRoot, viewId, groupId) {
    const { getThreadWorksurface } = require('../../lib/view-state/thread-worksurface');
    const summary = await getThreadWorksurface(projectRoot, viewId, groupId);
    return summary.entry;
  }

  test('one Move keeps A unchanged, creates empty B, makes B primary, and keeps one group row', async () => {
    const h = await makeHarness('happy');
    const { threadId, groupId } = await seedViewBoundGroup(h);

    await h.handlers['thread:action']({
      action: 'move_chat_to_side',
      requestId: 'm-1',
      threadGroupId: groupId,
      threadId,
      expectedPrimarySequence: 1,
    });

    const ack = firstOfType(h.ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'move_chat_to_side',
      requestId: 'm-1',
      threadGroupId: groupId,
      movedThreadId: threadId,
      currentPrimarySequence: 2,
      placementStatus: 'applied',
    });
    expect(typeof ack.newMainThreadId).toBe('string');
    expect(ack.newMainThreadId).not.toBe(threadId);
    expect(typeof ack.sideChatPlacementId).toBe('string');
    expect(JSON.stringify(ack)).not.toContain('surfaceId');

    const db = getDb();
    // The group still has exactly one member-row (A) plus the new empty B.
    const members = await db('thread_group_members').where({ group_id: groupId }).orderBy('ordinal');
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ thread_id: threadId, ordinal: 1, origin_kind: 'initial' });
    expect(members[1]).toMatchObject({
      thread_id: ack.newMainThreadId, ordinal: 2, origin_kind: 'move-to-side-chat-primary',
    });
    const primaryEvents = await db('thread_group_primary_events').where({ group_id: groupId }).orderBy('sequence');
    expect(primaryEvents).toHaveLength(2);
    expect(primaryEvents[1]).toMatchObject({
      sequence: 2, previous_thread_id: threadId, next_thread_id: ack.newMainThreadId,
      reason: 'move-to-side-chat',
    });
    const group = await db('thread_groups').where({ group_id: groupId }).first();
    expect(group.current_primary_thread_id).toBe(ack.newMainThreadId);

    // A unchanged: same session row, no transcript changes; B is empty.
    const aRow = await db('threads').where({ thread_id: threadId }).first();
    const bRow = await db('threads').where({ thread_id: ack.newMainThreadId }).first();
    expect(aRow.message_count).toBe(0);
    expect(bRow).toMatchObject({ workspace_id: h.workspaceId, message_count: 0, status: 'suspended' });
    expect(JSON.parse(bRow.harness_config || '{}')).toEqual({});

    // Exactly one idempotent activity and one MRU clock.
    const activity = await db('thread_group_activity_events').where({ group_id: groupId });
    expect(activity.map((row) => row.kind).sort()).toEqual(['initial', 'move-chat-to-side']);
    expect(activity.find((row) => row.kind === 'move-chat-to-side')).toMatchObject({
      event_key: 'move:m-1', thread_id: ack.newMainThreadId,
    });

    // Placement outbox applied + SPEC-03 lane materialized with the accepted shape.
    const outbox = await db('thread_group_placement_outbox').where({ group_id: groupId }).first();
    expect(outbox).toMatchObject({
      side_chat_placement_id: ack.sideChatPlacementId,
      thread_id: threadId,
      status: 'applied',
      view_id: 'file-viewer',
    });
    expect(JSON.stringify(outbox)).not.toContain('surfaceId');

    const state = readViewState(h.projectRoot, 'file-viewer');
    const entry = state.threadWorksurfaces?.[groupId];
    expect(entry).toBeTruthy();
    const placement = entry.managedComponentPlacements[ack.sideChatPlacementId];
    expect(placement).toMatchObject({ placementId: ack.sideChatPlacementId, disposition: 'open' });
    expect(placement.descriptor).toMatchObject({
      schemaVersion: 1,
      componentTypeId: 'fusion.chat-surface',
      componentInstanceId: `chat-side:${ack.sideChatPlacementId}`,
      targetKey: ack.sideChatPlacementId,
      input: {
        workspaceId: h.workspaceId,
        viewId: 'file-viewer',
        threadGroupId: groupId,
        threadId,
        host: 'side-tab',
      },
    });
    expect(JSON.stringify(entry)).not.toContain('surfaceId');
    expect(JSON.stringify(entry)).not.toContain('transcript');
  });

  test('B inherits only the stored harness binding and acknowledged portable selection', async () => {
    const h = await makeHarness('inherit');
    writeModelsConfig(h.projectRoot);
    const { threadId, groupId } = await seedViewBoundGroup(h, { model: 'deepseek/v4-flash', variant: 'high' });

    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-inherit',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    const bRow = await getDb()('threads').where({ thread_id: ack.newMainThreadId }).first();
    expect(bRow.harness_id).toBe('opencode');
    expect(JSON.parse(bRow.harness_config)).toEqual({ model: 'deepseek/v4-flash', variant: 'high' });
  });

  test('replay returns the recorded result and creates no second session or tab', async () => {
    const h = await makeHarness('replay');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    const payload = {
      action: 'move_chat_to_side', requestId: 'm-replay',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    };

    await h.handlers['thread:action'](payload);
    const first = firstOfType(h.ws, 'thread:action:completed');
    h.ws.send.mockClear();
    await h.handlers['thread:action'](payload);
    const second = firstOfType(h.ws, 'thread:action:completed');
    expect(second).toMatchObject({
      newMainThreadId: first.newMainThreadId,
      sideChatPlacementId: first.sideChatPlacementId,
      replayed: true,
    });
    const db = getDb();
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(2);
    expect(await db('thread_group_placement_outbox').where({ group_id: groupId })).toHaveLength(1);
    expect(await db('thread_group_action_results').where({ request_id: 'm-replay' })).toHaveLength(1);
  });

  test('different input under the same requestId returns request_mismatch', async () => {
    const h = await makeHarness('mismatch');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-mismatch',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-mismatch',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 99,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({
      action: 'move_chat_to_side', code: 'request_mismatch',
    });
  });

  test('two windows cannot both commit from one expected sequence', async () => {
    const h = await makeHarness('race');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    const base = { action: 'move_chat_to_side', threadGroupId: groupId, threadId, expectedPrimarySequence: 1 };

    await h.handlers['thread:action']({ ...base, requestId: 'm-race-1' });
    expect(firstOfType(h.ws, 'thread:action:completed')).toBeTruthy();
    h.ws.send.mockClear();

    await h.handlers['thread:action']({ ...base, requestId: 'm-race-2' });
    const error = firstOfType(h.ws, 'thread:action:error');
    expect(['stale_primary', 'not_primary']).toContain(error.code);
    const db = getDb();
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(2);
  });

  test('a non-primary member cannot be moved; busy and Legacy groups fail inertly', async () => {
    const h = await makeHarness('inert');
    const { threadId, groupId } = await seedViewBoundGroup(h);

    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-notprimary',
      threadGroupId: groupId, threadId: 't-not-a-member', expectedPrimarySequence: 1,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'not_found' });

    h.ws.send.mockClear();
    const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
    threadRuntimeManager.markInFlight({
      workspaceId: h.workspaceId, projectRoot: h.projectRoot,
      workspaceEpoch: 'workspace-epoch-1', scope: 'project', threadId,
    });
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-busy',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'group_busy' });
    threadRuntimeManager.fenceResource({
      workspaceId: h.workspaceId, projectRoot: h.projectRoot, threadId,
    });

    // Legacy group (viewId null) is not a valid main host for Move.
    const legacyId = `tg-legacy-${h.workspaceId}`;
    const legacyThread = `t-legacy-${h.workspaceId}`;
    await h.manager.createThread(legacyThread, 'Legacy', {
      harnessId: 'opencode', groupId: legacyId, viewId: null,
    });
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-legacy',
      threadGroupId: legacyId, threadId: legacyThread, expectedPrimarySequence: 1,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'not_found' });
    expect(await getDb()('thread_group_members').where({ group_id: legacyId })).toHaveLength(1);
  });

  test('Delete-first makes Move inert and creates nothing', async () => {
    const h = await makeHarness('delete-first');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    await h.handlers['thread:action']({
      action: 'delete', requestId: 'd-first', threadGroupId: groupId,
    });
    expect(firstOfType(h.ws, 'thread:action:completed')).toMatchObject({ deleted: true });

    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-after-delete',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'not_found' });
    const db = getDb();
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(0);
    expect(await db('thread_group_placement_outbox').where({ group_id: groupId })).toHaveLength(0);
  });

  test('Move-first then Delete removes both members and placements', async () => {
    const h = await makeHarness('move-delete');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-before-delete',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    const moveAck = firstOfType(h.ws, 'thread:action:completed');
    h.ws.send.mockClear();

    await h.handlers['thread:action']({
      action: 'delete', requestId: 'd-after-move', threadGroupId: groupId,
    });
    const deleteAck = firstOfType(h.ws, 'thread:action:completed');
    expect(deleteAck).toMatchObject({ action: 'delete', deleted: true });
    expect(deleteAck.members.map((member) => member.threadId).sort())
      .toEqual([moveAck.newMainThreadId, threadId].sort());
    const db = getDb();
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(0);
    const state = readViewState(h.projectRoot, 'file-viewer');
    expect(state.threadWorksurfaces?.[groupId]).toBeUndefined();
  });

  test('a committed Move whose delivery failed recovers on restart sweep without a duplicate', async () => {
    const h = await makeHarness('recovery');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-recover',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    const db = getDb();
    const outbox = await db('thread_group_placement_outbox').where({ group_id: groupId }).first();

    // Simulate a crash before delivery: mark the instruction pending and remove
    // the materialized lane placement (the file mutation had not happened).
    await db('thread_group_placement_outbox')
      .where({ side_chat_placement_id: ack.sideChatPlacementId })
      .update({ status: 'pending', applied_at: null });
    const stateFile = path.join(
      h.projectRoot, 'ai', MACHINE, 'System', 'Views', '001-file-viewer', 'state', 'state.json',
    );
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    delete state.threadWorksurfaces[groupId].managedComponentPlacements[ack.sideChatPlacementId];
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

    await h.manager.retryPlacementDeliveryForGroup(groupId);

    const reread = readViewState(h.projectRoot, 'file-viewer');
    expect(reread.threadWorksurfaces[groupId].managedComponentPlacements[ack.sideChatPlacementId])
      .toMatchObject({ disposition: 'open' });
    const refreshed = await db('thread_group_placement_outbox')
      .where({ side_chat_placement_id: ack.sideChatPlacementId }).first();
    expect(refreshed.status).toBe('applied');
    // Repeated delivery is an acknowledged no-op: still exactly one placement.
    await h.manager.retryPlacementDeliveryForGroup(groupId);
    const after = readViewState(h.projectRoot, 'file-viewer');
    expect(Object.keys(after.threadWorksurfaces[groupId].managedComponentPlacements))
      .toEqual([ack.sideChatPlacementId]);
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(2);
    expect(outbox.side_chat_placement_id).toBe(ack.sideChatPlacementId);
  });

  test('redundant client workspace/view authority fields are schema-rejected', async () => {
    const h = await makeHarness('reject-authority');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-reject',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
      workspaceId: h.workspaceId, viewId: 'file-viewer',
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({
      action: 'move_chat_to_side', code: 'invalid_request',
    });
    expect(await getDb()('thread_group_members').where({ group_id: groupId })).toHaveLength(1);
  });

  test('a fresh ThreadManager restart reads back the committed transition and placement', async () => {
    const h = await makeHarness('restart');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-restart',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    const ack = firstOfType(h.ws, 'thread:action:completed');

    const restarted = new ThreadManager({ projectRoot: h.projectRoot, workspaceId: h.workspaceId });
    const activation = await restarted.ensureGroupsActivated();
    expect(activation.ok).toBe(true);
    const projection = await h.manager.threadGroups.resolveOpenTarget({ threadGroupId: groupId });
    expect(projection.target.projection).toMatchObject({
      threadGroupId: groupId,
      currentPrimaryThreadId: ack.newMainThreadId,
      currentPrimarySequence: 2,
      memberCount: 2,
    });
    const state = readViewState(h.projectRoot, 'file-viewer');
    expect(state.threadWorksurfaces[groupId].managedComponentPlacements[ack.sideChatPlacementId].disposition)
      .toBe('open');
  });

  test('Move succeeds for a capture-viewer-bound group and persists a capture-view placement', async () => {
    const h = await makeHarness('capture-view');
    const { threadId, groupId } = await seedViewBoundGroup(h, { viewId: 'capture-viewer' });

    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-capture',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'move_chat_to_side',
      viewId: 'capture-viewer',
      movedThreadId: threadId,
      placementStatus: 'applied',
    });
    expect(JSON.stringify(ack)).not.toContain('surfaceId');

    const db = getDb();
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(2);
    const outbox = await db('thread_group_placement_outbox').where({ group_id: groupId }).first();
    expect(outbox).toMatchObject({ view_id: 'capture-viewer', thread_id: threadId, status: 'applied' });

    const entry = await readPlacementEntry(h.projectRoot, 'capture-viewer', groupId);
    expect(entry).toBeTruthy();
    const placement = entry.managedComponentPlacements[ack.sideChatPlacementId];
    expect(placement).toMatchObject({ placementId: ack.sideChatPlacementId, disposition: 'open' });
    expect(placement.descriptor).toMatchObject({
      componentTypeId: 'fusion.chat-surface',
      input: {
        workspaceId: h.workspaceId,
        viewId: 'capture-viewer',
        threadGroupId: groupId,
        threadId,
        host: 'side-tab',
      },
    });
    expect(JSON.stringify(entry)).not.toContain('surfaceId');
  });

  test('Move succeeds for a wiki-viewer-bound group (adapterless host) and persists the placement', async () => {
    const h = await makeHarness('wiki-view');
    const { threadId, groupId } = await seedViewBoundGroup(h, { viewId: 'wiki-viewer' });

    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-wiki',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'move_chat_to_side',
      viewId: 'wiki-viewer',
      movedThreadId: threadId,
      placementStatus: 'applied',
    });

    const db = getDb();
    expect(await db('thread_group_members').where({ group_id: groupId })).toHaveLength(2);
    const entry = await readPlacementEntry(h.projectRoot, 'wiki-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId])
      .toMatchObject({ disposition: 'open' });
    // The Side Chat descriptor carries durable identities only.
    expect(JSON.stringify(entry)).not.toContain('surfaceId');
  });

  test('a registered but not chat-capable view rejects before creating any row', async () => {
    const h = await makeHarness('ineligible-view');
    const { threadId, groupId } = await seedViewBoundGroup(h, { viewId: 'system-viewer' });
    const db = getDb();
    const snapshot = async () => ({
      members: await db('thread_group_members').where({ group_id: groupId }).count({ n: '*' }).first(),
      primaryEvents: await db('thread_group_primary_events').where({ group_id: groupId }).count({ n: '*' }).first(),
      activity: await db('thread_group_activity_events').where({ group_id: groupId }).count({ n: '*' }).first(),
      outbox: await db('thread_group_placement_outbox').where({ group_id: groupId }).count({ n: '*' }).first(),
      threads: await db('threads').where({ thread_id: threadId }).count({ n: '*' }).first(),
    });
    const before = await snapshot();
    expect(Number(before.members.n)).toBe(1);

    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'move_chat_to_side', requestId: 'm-ineligible',
      threadGroupId: groupId, threadId, expectedPrimarySequence: 1,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({
      action: 'move_chat_to_side', code: 'view_not_supported',
    });

    const after = await snapshot();
    expect(after).toEqual(before);
    expect(Number(after.outbox.n)).toBe(0);
    expect(await db('thread_group_action_results').where({ request_id: 'm-ineligible' })).toHaveLength(0);
  });

  test.each([false, true])('public Move survives mirror and placement ACK outage; replay preserves closed=%s', async (closed) => {
    const h = await makeHarness(`ack-${closed}`);
    const { threadId, groupId } = await seedViewBoundGroup(h);
    const repo = require('../../lib/thread-groups/repository');
    const mirror = jest.spyOn(repo, 'markMirrorRecovery').mockRejectedValue(new Error('mirror ACK unavailable'));
    const placement = jest.spyOn(repo, 'markPlacementOutbox').mockRejectedValue(new Error('placement ACK unavailable'));
    let ack;
    try {
      await h.handlers['thread:action']({ action: 'move_chat_to_side', requestId: 'move-ack',
        threadGroupId: groupId, threadId, expectedPrimarySequence: 1 });
      ack = firstOfType(h.ws, 'thread:action:completed');
      expect(ack).toMatchObject({ action: 'move_chat_to_side' });
      expect(await getDb()('thread_group_members').where({ group_id: groupId })).toHaveLength(2);
      expect((await getDb()('thread_group_placement_outbox').where({ group_id: groupId }).first()).status).toBe('pending');
    } finally { mirror.mockRestore(); placement.mockRestore(); }
    const lane = () => readViewState(h.projectRoot, 'file-viewer').threadWorksurfaces[groupId].managedComponentPlacements;
    expect(lane()[ack.sideChatPlacementId].disposition).toBe('open');
    if (closed) {
      const { mutateManagedPlacement } = require('../../lib/view-state/thread-worksurface');
      await mutateManagedPlacement(h.projectRoot, 'file-viewer', groupId,
        { placementId: ack.sideChatPlacementId, operation: 'close',
          expectedPlacementRevision: readViewState(h.projectRoot, 'file-viewer').threadWorksurfaces[groupId].placementRevision });
    }
    await closeDb(); await initDb();
    const restarted = new ThreadManager({ projectRoot: h.projectRoot, workspaceId: h.workspaceId });
    await restarted.ensureGroupsActivated();
    await restarted.retryPlacementDeliveryForGroup(groupId);
    expect(Object.keys(lane())).toEqual([ack.sideChatPlacementId]);
    expect(lane()[ack.sideChatPlacementId].disposition).toBe(closed ? 'closed' : 'open');
    expect((await getDb()('thread_group_placement_outbox').where({ group_id: groupId }).first()).status).toBe('applied');
    expect((await restarted.getRichHistory(ack.newMainThreadId))?.exchanges || []).toHaveLength(0);
    expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(1);
  });

  test.each(['warm', 'automation'])('Delete fences a concurrently requested %s before SQL deletion', async (lane) => {
    const h = await makeHarness(`delete-${lane}`);
    const { threadId, groupId } = await seedViewBoundGroup(h);
    const { spawnThreadWire } = require('../../lib/harness/compat');
    const beforeSpawns = spawnThreadWire.mock.calls.length;
    let entered;
    let release;
    const reached = new Promise((resolve) => { entered = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    const original = h.manager._fenceGroupMember.bind(h.manager);
    const fence = jest.spyOn(h.manager, '_fenceGroupMember').mockImplementation(async (id) => {
      entered(); await gate; return original(id);
    });
    const deleting = h.handlers['thread:action']({ action: 'delete', requestId: 'delete-admission', threadGroupId: groupId });
    await reached;
    const admission = lane === 'warm'
      ? h.handlers['thread:warm']({ type: 'thread:warm', threadId })
      : require('../../lib/thread/thread-runtime-automation').sendAutomationPrompt({
        workspaceId: h.workspaceId, projectRoot: h.projectRoot, threadId }, 'late prompt');
    await new Promise((resolve) => setImmediate(resolve));
    release();
    try { await deleting; await admission; } finally { fence.mockRestore(); }
    expect(firstOfType(h.ws, 'thread:action:completed')).toMatchObject({ deleted: true });
    expect(spawnThreadWire.mock.calls.length).toBe(beforeSpawns);
    expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(0);
    const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
    expect(threadRuntimeManager.getRuntimeForResource({ workspaceId: h.workspaceId, projectRoot: h.projectRoot, threadId })).toBeNull();
    expect(h.manager.getSession(threadId)).toBeUndefined();
  });

  test('public warm admitted first completes under the lease before Delete retires its provider', async () => {
    const h = await makeHarness('warm-delete');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    const { EventEmitter } = require('events');
    const wire = new EventEmitter();
    wire.kill = () => { wire.exitCode = 0; wire.emit('exit', 0); };
    const { spawnThreadWire } = require('../../lib/harness/compat');
    spawnThreadWire.mockReturnValueOnce(wire);
    let entered; let release;
    const reached = new Promise((resolve) => { entered = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    const handlers = createThreadWsHandlers({ ws: h.ws, projectRoot: h.projectRoot,
      session: makeSession(h.projectRoot, h.workspaceId), wireLifecycle: {
        awaitHarnessReady: async () => { entered(); await gate; },
        initializeWire: () => {}, setupWireHandlers: () => {},
      }, getWorkspaceRecipients: () => [] });
    const warming = handlers['thread:warm']({ type: 'thread:warm', threadId });
    await reached;
    const deleting = h.handlers['thread:action']({ action: 'delete', requestId: 'delete-after-warm', threadGroupId: groupId });
    await new Promise((resolve) => setImmediate(resolve));
    expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(1);
    release(); await warming; await deleting;
    expect(firstOfType(h.ws, 'thread:action:completed')).toMatchObject({ deleted: true });
    expect(h.manager.getSession(threadId)).toBeUndefined();
    expect(wire.exitCode).toBe(0);
  });

  test('automation reserves IN_FLIGHT before releasing admission; public Delete rejects without mutation', async () => {
    const h = await makeHarness('automation-delete');
    const { threadId, groupId } = await seedViewBoundGroup(h);
    const { EventEmitter } = require('events');
    const wire = new EventEmitter();
    wire._usesDirectCanonicalEvents = true;
    wire._sendMessage = async function* () {};
    wire.kill = () => { wire.exitCode = 0; wire.emit('exit', 0); };
    require('../../lib/harness/compat').spawnThreadWire.mockReturnValueOnce(wire);
    let entered; let release;
    const reached = new Promise((resolve) => { entered = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    const original = h.manager.addMessage.bind(h.manager);
    const persist = jest.spyOn(h.manager, 'addMessage').mockImplementation(async (...args) => {
      entered(); await gate; return original(...args);
    });
    const sending = require('../../lib/thread/thread-runtime-automation').sendAutomationPrompt({
      workspaceId: h.workspaceId, projectRoot: h.projectRoot, threadId }, 'owned automation');
    await reached;
    await h.handlers['thread:action']({ action: 'delete', requestId: 'delete-during-automation', threadGroupId: groupId });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'group_busy' });
    expect(await getDb()('threads').where({ thread_id: threadId })).toHaveLength(1);
    release();
    try { await sending; } finally { persist.mockRestore(); await h.manager.closeSession(threadId); }
  });

});
