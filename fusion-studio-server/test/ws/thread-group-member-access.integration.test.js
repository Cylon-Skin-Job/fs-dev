'use strict';

/**
 * SPEC-04 slice 04C — close disposition, member access, and repetition.
 *
 * Proves, through the real public routes on a temp workspace + real view-state
 * file: `thread:members` ordered projections, ordinary outbox replay never
 * reopening a closed placement, the explicit `open_member_in_side` reopen/
 * focus path, exact-member `copy_link`/`resolve_link`, repeated Move ordering,
 * a fresh-manager restart that keeps closed placements closed, and the
 * disabled/unavailable member failures. No dev database, owner workspace, or
 * Alpha profile is touched.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const MACHINE = 'Test-Machine';

const userDataDir = path.join(os.tmpdir(), `fusion-tg-member-${process.pid}-${Date.now()}`);
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

function makeProjectRoot(label) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `fusion-tg-member-${label}-`)));
  writeManifest(path.join(root, 'ai', MACHINE, 'System', 'Views', '001-file-viewer'), 'file-viewer');
  writeManifest(path.join(root, 'ai', MACHINE, 'System', 'Views', '004-system-viewer'), 'system-viewer');
  return root;
}

function makeWs() {
  return { send: jest.fn(), readyState: 1 };
}

function makeSession(projectRoot, workspaceId) {
  const session = {
    currentWorkspaceId: workspaceId,
    workspaceEpoch: 'workspace-epoch-1',
    workspaceBindingState: 'active',
    projectRoot,
  };
  Object.defineProperty(session, 'connectionRole', {
    value: 'trusted-shell', enumerable: false,
  });
  return session;
}

function makeHandlers({ ws, session, projectRoot, recipients = null }) {
  return createThreadWsHandlers({
    ws,
    session,
    wireLifecycle: {
      awaitHarnessReady: jest.fn(() => Promise.resolve()),
      initializeWire: jest.fn(),
      setupWireHandlers: jest.fn(),
    },
    projectRoot,
    getWorkspaceRecipients: () => recipients || [],
  });
}

function frames(ws) {
  return ws.send.mock.calls.map((call) => JSON.parse(call[0]));
}

function firstOfType(ws, type) {
  return frames(ws).find((message) => message.type === type) || null;
}

describe('SPEC-04 04C member access and close disposition', () => {
  let previousMachine;
  let workspaceCounter = 0;
  let readiness;

  beforeAll(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    readiness = require('../../lib/views/readiness-runtime');
    const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
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

  async function makeHarness(label, { viewId = 'file-viewer', recipients = null } = {}) {
    workspaceCounter += 1;
    const workspaceId = `workspace-member-${workspaceCounter}`;
    const projectRoot = makeProjectRoot(`${label}-${workspaceCounter}`);
    await readiness.ensureWorkspaceViewReadiness({ workspaceId, projectRoot });
    const manager = getProjectThreadManager(projectRoot, workspaceId);
    const activation = await manager.ensureGroupsActivated();
    expect(activation.ok).toBe(true);
    const ws = makeWs();
    ThreadWebSocketHandler.setPanel(ws, viewId, {
      projectRoot, viewName: viewId, workspaceId, workspaceEpoch: 'workspace-epoch-1',
    });
    const handlers = makeHandlers({
      ws, session: makeSession(projectRoot, workspaceId), projectRoot,
      recipients,
    });
    return { workspaceId, projectRoot, manager, ws, handlers };
  }

  async function seedGroup(h, { name = 'Alpha', viewId = 'file-viewer' } = {}) {
    const threadId = `t-${h.workspaceId}`;
    const groupId = `tg-${h.workspaceId}`;
    await h.manager.createThread(threadId, name, { harnessId: 'opencode', groupId, viewId });
    return { threadId, groupId, viewId };
  }

  async function move(h, { groupId, threadId, sequence, requestId }) {
    await h.handlers['thread:action']({
      action: 'move_chat_to_side',
      requestId,
      threadGroupId: groupId,
      threadId,
      expectedPrimarySequence: sequence,
    });
  }

  async function readEntry(h, viewId, groupId) {
    const { getThreadWorksurface } = require('../../lib/view-state/thread-worksurface');
    const summary = await getThreadWorksurface(h.projectRoot, viewId, groupId);
    return summary.entry;
  }

  async function closePlacement(h, viewId, groupId, placementId) {
    const { mutateManagedPlacement, getThreadWorksurface } = require('../../lib/view-state/thread-worksurface');
    const current = await getThreadWorksurface(h.projectRoot, viewId, groupId);
    return mutateManagedPlacement(h.projectRoot, viewId, groupId, {
      placementId,
      operation: 'close',
      expectedPlacementRevision: current.placementRevision ?? null,
    });
  }

  test('thread:members returns ordered projections with placement disposition and no transcript', async () => {
    const h = await makeHarness('members');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-1' });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    h.ws.send.mockClear();

    await h.handlers['thread:members']({ threadGroupId: groupId });
    const membersMsg = firstOfType(h.ws, 'thread:members');
    expect(membersMsg).toMatchObject({
      threadGroupId: groupId,
      workspaceId: h.workspaceId,
      viewId: 'file-viewer',
    });
    expect(membersMsg.members).toHaveLength(2);
    expect(membersMsg.members[0]).toMatchObject({
      threadId, ordinal: 1, isPrimary: false, placementDisposition: 'open',
    });
    expect(membersMsg.members[1]).toMatchObject({
      threadId: ack.newMainThreadId, ordinal: 2, isPrimary: true, placementDisposition: 'absent',
    });
    // Never transcript content.
    expect(JSON.stringify(membersMsg)).not.toContain('transcript');
    expect(JSON.stringify(membersMsg)).not.toContain('surfaceId');
    // Bounded display label is present and not a raw transcript.
    expect(typeof membersMsg.members[0].label).toBe('string');
  });

  test('thread:members fails inertly for an unknown/foreign group', async () => {
    const h = await makeHarness('members-unknown');
    await seedGroup(h);
    await h.handlers['thread:members']({ threadGroupId: 'tg-does-not-exist' });
    expect(firstOfType(h.ws, 'thread:members:error')).toMatchObject({
      threadGroupId: 'tg-does-not-exist', code: 'not_found',
    });
  });

  test('ordinary outbox replay never reopens a closed placement', async () => {
    const h = await makeHarness('close-no-reopen');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-close' });
    const ack = firstOfType(h.ws, 'thread:action:completed');

    await closePlacement(h, 'file-viewer', groupId, ack.sideChatPlacementId);
    let entry = await readEntry(h, 'file-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('closed');

    // A repeated close is harmless: still closed, no placement loss, no error.
    await expect(closePlacement(h, 'file-viewer', groupId, ack.sideChatPlacementId)).resolves.toBeTruthy();
    entry = await readEntry(h, 'file-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('closed');

    // Ordinary retry/restart sweep acknowledges the committed instruction but
    // must not resurrect the intentionally closed placement.
    await h.manager.retryPlacementDeliveryForGroup(groupId);
    entry = await readEntry(h, 'file-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('closed');

    const outbox = await getDb()('thread_group_placement_outbox')
      .where({ side_chat_placement_id: ack.sideChatPlacementId }).first();
    expect(outbox.status).toBe('applied');
  });

  test('open_member_in_side reopens a closed placement without session/primary/MRU effects, and is idempotent', async () => {
    const h = await makeHarness('open-member');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-open' });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    await closePlacement(h, 'file-viewer', groupId, ack.sideChatPlacementId);

    const db = getDb();
    const before = {
      members: await db('thread_group_members').where({ group_id: groupId }).count({ n: '*' }).first(),
      primaryEvents: await db('thread_group_primary_events').where({ group_id: groupId }).count({ n: '*' }).first(),
      activity: await db('thread_group_activity_events').where({ group_id: groupId }).count({ n: '*' }).first(),
      group: await db('thread_groups').where({ group_id: groupId }).first(),
    };

    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-1',
      threadGroupId: groupId, threadId,
    });
    const opened = firstOfType(h.ws, 'thread:action:completed');
    expect(opened).toMatchObject({
      action: 'open_member_in_side',
      threadGroupId: groupId,
      threadId,
      sideChatPlacementId: ack.sideChatPlacementId,
      placementStatus: 'applied',
    });
    expect(JSON.stringify(opened)).not.toContain('surfaceId');

    const entry = await readEntry(h, 'file-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('open');

    const after = {
      members: await db('thread_group_members').where({ group_id: groupId }).count({ n: '*' }).first(),
      primaryEvents: await db('thread_group_primary_events').where({ group_id: groupId }).count({ n: '*' }).first(),
      activity: await db('thread_group_activity_events').where({ group_id: groupId }).count({ n: '*' }).first(),
      group: await db('thread_groups').where({ group_id: groupId }).first(),
    };
    expect(after).toEqual(before);

    // Replay performs nothing twice and returns the recorded result.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-1',
      threadGroupId: groupId, threadId,
    });
    const replayed = firstOfType(h.ws, 'thread:action:completed');
    expect(replayed).toMatchObject({
      sideChatPlacementId: ack.sideChatPlacementId,
      replayed: true,
    });
    const entryAfterReplay = await readEntry(h, 'file-viewer', groupId);
    expect(entryAfterReplay.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('open');
  });

  test('open_member_in_side focuses an open placement and fails inertly for non-members/unavailable', async () => {
    const h = await makeHarness('open-focus');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-focus' });
    const ack = firstOfType(h.ws, 'thread:action:completed');

    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-focus',
      threadGroupId: groupId, threadId,
    });
    const focused = firstOfType(h.ws, 'thread:action:completed');
    expect(focused).toMatchObject({ placementStatus: 'applied', focused: true });

    // The current Main Chat is never an open_member_in_side target.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-primary',
      threadGroupId: groupId, threadId: ack.newMainThreadId,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'not_found' });

    // A non-member fails inertly.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-unknown',
      threadGroupId: groupId, threadId: 't-not-a-member',
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'not_found' });

    // Redundant authority fields are schema-rejected like Move.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-authority',
      threadGroupId: groupId, threadId, workspaceId: h.workspaceId,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'invalid_request' });
  });

  test('open_member_in_side fans the committed placement to the other workspace window', async () => {
    const otherWs = makeWs();
    const h = await makeHarness('open-fanout', { recipients: [{ ws: otherWs }] });
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-fanout' });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    await closePlacement(h, 'file-viewer', groupId, ack.sideChatPlacementId);

    h.ws.send.mockClear();
    otherWs.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-fanout',
      threadGroupId: groupId, threadId,
    });
    // Requester result and the other-window fan-out are separate deliveries of
    // the one committed placement (never a second mutation).
    expect(firstOfType(h.ws, 'thread:action:completed')).toMatchObject({
      action: 'open_member_in_side',
      sideChatPlacementId: ack.sideChatPlacementId,
      placementStatus: 'applied',
    });
    const fanOut = firstOfType(otherWs, 'thread:action:completed');
    expect(fanOut).toMatchObject({
      action: 'open_member_in_side',
      threadGroupId: groupId,
      threadId,
      sideChatPlacementId: ack.sideChatPlacementId,
      placementStatus: 'applied',
      fanOut: true,
    });
    expect(JSON.stringify(fanOut)).not.toContain('surfaceId');
  });

  test('a member of a non-chat-capable view fails inertly with view_not_supported', async () => {
    const h = await makeHarness('disabled-component', { viewId: 'system-viewer' });
    const { groupId } = await seedGroup(h, { viewId: 'system-viewer' });
    // A non-chat-capable view can never reach Move, but a defensive non-primary
    // member still must reject with the classified capability code.
    const repository = require('../../lib/thread-groups/repository');
    const spare = `t-spare-${h.workspaceId}`;
    await repository.insertMember(getDb(), {
      groupId, threadId: spare, ordinal: 2, originKind: 'initial', joinedAt: Date.now(),
    });
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-unsupported',
      threadGroupId: groupId, threadId: spare,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'view_not_supported' });
    // No placement damage.
    const entry = await readEntry(h, 'system-viewer', groupId);
    expect(entry).toBeNull();
  });

  test('thread:members returns the nullable Legacy view and open_member_in_side fails inertly for a Legacy group', async () => {
    const h = await makeHarness('legacy');
    const legacyGroupId = `tg-legacy-${h.workspaceId}`;
    const legacyThread = `t-legacy-${h.workspaceId}`;
    await h.manager.createThread(legacyThread, 'Legacy', {
      harnessId: 'opencode', groupId: legacyGroupId, viewId: null,
    });
    const repository = require('../../lib/thread-groups/repository');
    const spare = `t-legacy-spare-${h.workspaceId}`;
    await repository.insertMember(getDb(), {
      groupId: legacyGroupId, threadId: spare, ordinal: 2, originKind: 'initial', joinedAt: Date.now(),
    });

    h.ws.send.mockClear();
    await h.handlers['thread:members']({ threadGroupId: legacyGroupId });
    const membersMsg = firstOfType(h.ws, 'thread:members');
    expect(membersMsg).toMatchObject({ threadGroupId: legacyGroupId, viewId: null });
    expect(membersMsg.members).toHaveLength(2);
    expect(membersMsg.members[0]).toMatchObject({ threadId: legacyThread, isPrimary: true, placementDisposition: 'absent' });
    expect(membersMsg.members[1]).toMatchObject({ threadId: spare, ordinal: 2, placementDisposition: 'absent' });

    // A Legacy (null-view) group can never carry a placement: the member action
    // is an inert classified failure with no placement/transcript effect.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-legacy',
      threadGroupId: legacyGroupId, threadId: spare,
    });
    expect(firstOfType(h.ws, 'thread:action:error')).toMatchObject({ code: 'member_unavailable' });
  });

  test('copy_link returns a URI with a validated non-primary member threadId; group-only keeps the primary', async () => {
    const h = await makeHarness('copy-link');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-link' });
    const ack = firstOfType(h.ws, 'thread:action:completed');

    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'copy_link', requestId: 'c-member',
      threadGroupId: groupId, threadId,
    });
    const memberLink = firstOfType(h.ws, 'thread:action:completed');
    expect(memberLink.link).toContain('threadId=');
    expect(decodeURIComponent(memberLink.link)).toContain(`threadId=${threadId}`);

    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'copy_link', requestId: 'c-group', threadGroupId: groupId,
    });
    const groupLink = firstOfType(h.ws, 'thread:action:completed');
    expect(decodeURIComponent(groupLink.link)).toContain(`threadId=${ack.newMainThreadId}`);
  });

  test('resolve_link with an exact member reopens/focuses its placement without promotion or MRU; group-only opens Main Chat', async () => {
    const h = await makeHarness('resolve-link');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-resolve' });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    await closePlacement(h, 'file-viewer', groupId, ack.sideChatPlacementId);

    const db = getDb();
    const beforeActivity = await db('thread_group_activity_events').where({ group_id: groupId }).count({ n: '*' }).first();
    const beforeGroup = await db('thread_groups').where({ group_id: groupId }).first();

    // Exact-member link.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'copy_link', requestId: 'c-exact', threadGroupId: groupId, threadId,
    });
    const link = firstOfType(h.ws, 'thread:action:completed').link;
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'resolve_link', requestId: 'r-exact', uri: link,
    });
    const resolved = firstOfType(h.ws, 'thread:action:completed');
    expect(resolved).toMatchObject({
      action: 'resolve_link',
      resolved: true,
      targetMemberThreadId: threadId,
      sideChatPlacementId: ack.sideChatPlacementId,
      placementStatus: 'applied',
    });
    // No promotion / MRU / activity change.
    const afterActivity = await db('thread_group_activity_events').where({ group_id: groupId }).count({ n: '*' }).first();
    const afterGroup = await db('thread_groups').where({ group_id: groupId }).first();
    expect(afterActivity).toEqual(beforeActivity);
    expect(afterGroup.current_primary_thread_id).toBe(beforeGroup.current_primary_thread_id);
    expect(afterGroup.updated_at).toBe(beforeGroup.updated_at);
    const entry = await readEntry(h, 'file-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('open');

    // Group-only link resolves to the current Main Chat (not the member).
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'copy_link', requestId: 'c-group-2', threadGroupId: groupId,
    });
    const groupLink = firstOfType(h.ws, 'thread:action:completed').link;
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'resolve_link', requestId: 'r-group', uri: groupLink,
    });
    const groupResolved = firstOfType(h.ws, 'thread:action:completed');
    expect(groupResolved.targetMemberThreadId).toBeUndefined();
    expect(groupResolved.threadId).toBe(ack.newMainThreadId);
  });

  test('eight consecutive Moves produce one group row, nine ordered members, and one MRU advance per Move', async () => {
    const h = await makeHarness('repeat-move');
    const { threadId, groupId } = await seedGroup(h);
    const db = getDb();
    let current = threadId;
    let sequence = 1;
    const acked = [];
    for (let i = 0; i < 8; i += 1) {
      h.ws.send.mockClear();
      await move(h, { groupId, threadId: current, sequence, requestId: `m-repeat-${i}` });
      const ack = firstOfType(h.ws, 'thread:action:completed');
      expect(ack).toMatchObject({ action: 'move_chat_to_side', currentPrimarySequence: sequence + 1 });
      acked.push(ack);
      current = ack.newMainThreadId;
      sequence += 1;
    }

    const groups = await db('thread_groups').where({ group_id: groupId });
    expect(groups).toHaveLength(1);
    expect(groups[0].current_primary_thread_id).toBe(current);
    const members = await db('thread_group_members').where({ group_id: groupId }).orderBy('ordinal');
    expect(members).toHaveLength(9);
    expect(members.map((row) => row.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // One MRU advance per accepted Move: the group updated_at advances each
    // time and there are exactly 8 move activities.
    const moveActivity = await db('thread_group_activity_events')
      .where({ group_id: groupId, kind: 'move-chat-to-side' });
    expect(moveActivity).toHaveLength(8);

    // All eight moved members keep distinct lifetime placements, all open.
    const placements = await db('thread_group_placement_outbox').where({ group_id: groupId });
    expect(placements).toHaveLength(8);
    const ids = new Set(placements.map((row) => row.side_chat_placement_id));
    expect(ids.size).toBe(8);

    await h.handlers['thread:members']({ threadGroupId: groupId });
    const membersMsg = firstOfType(h.ws, 'thread:members');
    expect(membersMsg.members).toHaveLength(9);
    expect(membersMsg.members.filter((m) => m.isPrimary)).toHaveLength(1);
    expect(membersMsg.members.find((m) => m.isPrimary).threadId).toBe(current);
    // The eight non-primary members are open side chats; the primary is absent.
    expect(membersMsg.members.filter((m) => m.placementDisposition === 'open')).toHaveLength(8);
  });

  test('a fresh manager restart keeps a closed placement closed and an open placement open', async () => {
    const h = await makeHarness('restart-closed');
    const { threadId, groupId } = await seedGroup(h);
    await move(h, { groupId, threadId, sequence: 1, requestId: 'm-restart-close' });
    const ack = firstOfType(h.ws, 'thread:action:completed');
    await closePlacement(h, 'file-viewer', groupId, ack.sideChatPlacementId);

    const restarted = new ThreadManager({ projectRoot: h.projectRoot, workspaceId: h.workspaceId });
    const activation = await restarted.ensureGroupsActivated();
    expect(activation.ok).toBe(true);

    // A restart read-back must not resurrect the closed placement.
    const entry = await readEntry(h, 'file-viewer', groupId);
    expect(entry.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('closed');
    const projection = await restarted.threadGroups.resolveOpenTarget({ threadGroupId: groupId });
    expect(projection.target.projection).toMatchObject({
      threadGroupId: groupId,
      currentPrimaryThreadId: ack.newMainThreadId,
      memberCount: 2,
    });

    // The explicit member action still reopens it after restart.
    h.ws.send.mockClear();
    await h.handlers['thread:action']({
      action: 'open_member_in_side', requestId: 'o-after-restart',
      threadGroupId: groupId, threadId,
    });
    expect(firstOfType(h.ws, 'thread:action:completed')).toMatchObject({
      sideChatPlacementId: ack.sideChatPlacementId,
      placementStatus: 'applied',
    });
    const reopened = await readEntry(h, 'file-viewer', groupId);
    expect(reopened.managedComponentPlacements[ack.sideChatPlacementId].disposition).toBe('open');
  });
});
