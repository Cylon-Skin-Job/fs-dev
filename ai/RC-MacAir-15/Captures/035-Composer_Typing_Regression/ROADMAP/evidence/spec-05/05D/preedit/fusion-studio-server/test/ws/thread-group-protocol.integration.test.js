'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const userDataDir = path.join(os.tmpdir(), `fusion-tg-proto-${process.pid}-${Date.now()}`);
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
const { parseGroupLink } = require('../../lib/thread-groups/application-link');

const MACHINE = 'Fixture-Machine';

const MODEL_CATALOG = {
  defaultProvider: 'deepseek',
  providers: [
    {
      id: 'deepseek',
      label: 'DeepSeek',
      defaultModel: 'deepseek/v4-flash',
      models: [
        { id: 'deepseek/v4-flash', name: 'DeepSeek V4 Flash', variants: ['low', 'high'] },
        { id: 'deepseek/v4-pro', name: 'DeepSeek V4 Pro', variants: ['high'] },
      ],
    },
  ],
};

function writeModelsConfig(projectRoot) {
  const configDir = path.join(projectRoot, 'ai', MACHINE, 'System', 'config');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'opencode-models.json'),
    JSON.stringify(MODEL_CATALOG, null, 2),
    'utf8',
  );
}

function makeWs() {
  return { send: jest.fn(), readyState: 1 };
}

function makeSession(projectRoot, workspaceId, { trusted }) {
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

function makeWireLifecycle() {
  return {
    awaitHarnessReady: jest.fn(() => Promise.resolve()),
    initializeWire: jest.fn(),
    setupWireHandlers: jest.fn(),
  };
}

function makeHandlers({ ws, session, projectRoot, recipients = [] }) {
  return createThreadWsHandlers({
    ws,
    session,
    wireLifecycle: makeWireLifecycle(),
    projectRoot,
    getWorkspaceRecipients: ({ excludeWs } = {}) => recipients
      .filter((recipient) => recipient.ws && recipient.ws !== excludeWs),
  });
}

async function makeHarness(workspaceId, { recipients = [] } = {}) {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-tg-proto-ws-'));
  fs.mkdirSync(path.join(projectRoot, 'ai', MACHINE, 'System', 'Views'), { recursive: true });
  const manager = getProjectThreadManager(projectRoot, workspaceId);
  await manager.ensureGroupsActivated();
  const ws = makeWs();
  ThreadWebSocketHandler.setPanel(ws, 'file-viewer', {
    projectRoot,
    viewName: 'file-viewer',
    workspaceId,
    workspaceEpoch: 'workspace-epoch-1',
  });
  const session = makeSession(projectRoot, workspaceId, { trusted: true });
  const trusted = makeHandlers({ ws, session, projectRoot, recipients });
  const untrusted = makeHandlers({
    ws,
    session: makeSession(projectRoot, workspaceId, { trusted: false }),
    projectRoot,
    recipients,
  });
  const suffix = workspaceId.replace('workspace-proto-', '');
  return {
    manager,
    projectRoot,
    ws,
    session,
    trusted,
    untrusted,
    recipients,
    threadId: `t-${suffix}`,
    groupId: `tg-${suffix}`,
  };
}

function firstOfType(ws, type) {
  const frame = ws.send.mock.calls.map((call) => JSON.parse(call[0]))
    .find((message) => message.type === type);
  return frame || null;
}

describe('thread group public protocol', () => {
  let previousMachine;
  let workspaceCounter = 0;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
  });

  afterAll(() => {
    if (previousUserDataDir === undefined) delete process.env.FUSION_APP_USER_DATA;
    else process.env.FUSION_APP_USER_DATA = previousUserDataDir;
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  function nextWorkspaceId() {
    workspaceCounter += 1;
    return `workspace-proto-${workspaceCounter}`;
  }

  test('thread:list returns one exact Legacy population with durable identities only', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:list']();

    const list = firstOfType(ws, 'thread:list');
    expect(list.viewId).toBeNull();
    expect(list.threads).toHaveLength(1);
    const row = list.threads[0];
    expect(row).toMatchObject({
      threadGroupId: groupId,
      workspaceId,
      viewId: null,
      currentPrimaryThreadId: threadId,
      currentPrimarySequence: 1,
      memberCount: 1,
    });
    expect(row).not.toHaveProperty('surfaceId');
    expect(row.entry.name).toBe('Alpha');
  });

  test('thread:open resolves the authoritative primary by group and by exact member', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:open']({ threadGroupId: groupId });
    const byGroup = firstOfType(ws, 'thread:opened');
    expect(byGroup).toMatchObject({ threadId: threadId, threadGroupId: groupId, viewId: null });
    expect(byGroup).not.toHaveProperty('surfaceId');

    ws.send.mockClear();
    await trusted['thread:open']({ threadId: threadId });
    expect(firstOfType(ws, 'thread:opened')).toMatchObject({ threadId: threadId, threadGroupId: groupId });
  });

  test('unknown explicit group/member IDs return not_found and never create a replacement', async () => {
    const workspaceId = nextWorkspaceId();
    const { trusted, untrusted, ws, threadId, groupId } = await makeHarness(workspaceId);

    await trusted['thread:open']({ threadGroupId: 'tg-missing' });
    expect(firstOfType(ws, 'error')).toMatchObject({ code: 'not_found' });

    ws.send.mockClear();
    await untrusted['thread:open']({ threadId: 't-missing' });
    expect(firstOfType(ws, 'error')).toMatchObject({ code: 'not_found' });

    await expect(getDb()('threads').where({ workspace_id: workspaceId })).resolves.toHaveLength(0);
    await expect(getDb()('thread_groups').where({ workspace_id: workspaceId })).resolves.toHaveLength(0);
  });

  test('removed raw thread:rename and thread:delete routes leave no aliases', async () => {
    const workspaceId = nextWorkspaceId();
    const { trusted } = await makeHarness(workspaceId);
    expect(trusted['thread:rename']).toBeUndefined();
    expect(trusted['thread:delete']).toBeUndefined();
  });

  test('untrusted group actions and activation are denied before effects', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, untrusted, ws, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });
    const db = getDb();

    await untrusted['thread:open-assistant']({
      type: 'thread:open-assistant',
      role: 'trusted-shell',
      proof: 'forged',
    });
    await untrusted['thread:action']({
      action: 'rename', requestId: 'u-1', threadGroupId: groupId, name: 'Nope', role: 'trusted-shell',
    });
    await untrusted['thread:action']({ action: 'delete', requestId: 'u-2', threadGroupId: groupId });

    const denials = ws.send.mock.calls.map((call) => JSON.parse(call[0]))
      .filter((message) => message.code === 'THREAD_MUTATION_DENIED');
    expect(denials).toHaveLength(3);

    expect(await db('threads').where({ thread_id: threadId })).toHaveLength(1);
    expect(await db('thread_groups').where({ group_id: groupId })).toHaveLength(1);
    expect((await db('thread_groups').where({ group_id: groupId }).first()).name).toBe('Alpha');
    expect(await db('thread_group_action_results')).toHaveLength(0);
  });

  test('trusted rename traverses thread:action and acknowledges the requester', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'rename', requestId: 'r-1', threadGroupId: groupId, name: 'Renamed',
    });

    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'rename',
      requestId: 'r-1',
      threadGroupId: groupId,
      threadId,
      workspaceId,
      viewId: null,
      name: 'Renamed',
    });
    expect(ack).not.toHaveProperty('surfaceId');
    expect(JSON.stringify(ack)).not.toContain('surfaceId');
    expect(JSON.stringify(ack.context)).not.toContain('surfaceId');
    expect((await getDb()('thread_groups').where({ group_id: groupId }).first()).name).toBe('Renamed');
  });

  test('trusted delete traverses thread:action and leaves no orphan', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'delete', requestId: 'd-1', threadGroupId: groupId,
    });

    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'delete', requestId: 'd-1', threadGroupId: groupId, threadId, deleted: true,
    });
    expect(ack).not.toHaveProperty('surfaceId');
    const db = getDb();
    await expect(db('thread_groups').where({ group_id: groupId })).resolves.toHaveLength(0);
    await expect(db('thread_group_members').where({ thread_id: threadId })).resolves.toHaveLength(0);
  });

  test('same requestId replays the stored result; different input returns request_mismatch', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, groupId } = await makeHarness(workspaceId);
    await manager.createThread(`t-${workspaceId.replace('workspace-proto-', '')}`, 'Alpha', {
      harnessId: 'opencode', groupId,
    });

    await trusted['thread:action']({
      action: 'rename', requestId: 'r-replay', threadGroupId: groupId, name: 'Once',
    });
    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'rename', requestId: 'r-replay', threadGroupId: groupId, name: 'Once',
    });
    expect(firstOfType(ws, 'thread:action:completed')).toMatchObject({ name: 'Once' });
    expect(await getDb()('thread_group_action_results').where({ request_id: 'r-replay' })).toHaveLength(1);

    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'rename', requestId: 'r-replay', threadGroupId: groupId, name: 'Twice',
    });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      requestId: 'r-replay', action: 'rename', code: 'request_mismatch',
    });
    expect((await getDb()('thread_groups').where({ group_id: groupId }).first()).name).toBe('Once');
  });

  test('a lost acknowledgement does not rerun the mutation and retry converges', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    const originalSend = ws.send;
    let failOnce = true;
    ws.send = jest.fn((payload) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('socket died before acknowledgement');
      }
      return originalSend(payload);
    });

    // Committed, but the requester never saw the acknowledgement.
    await trusted['thread:action']({
      action: 'delete', requestId: 'd-lost', threadGroupId: groupId,
    });
    ws.send = originalSend;
    expect(await getDb()('thread_groups').where({ group_id: groupId })).toHaveLength(0);

    await trusted['thread:action']({
      action: 'delete', requestId: 'd-lost', threadGroupId: groupId,
    });
    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({ action: 'delete', requestId: 'd-lost', replayed: true, deleted: true });
  });

  test('a second workspace window receives the authoritative fan-out', async () => {
    const workspaceId = nextWorkspaceId();
    const recipients = [];
    const first = await makeHarness(workspaceId, { recipients });
    await first.manager.createThread(first.threadId, 'Alpha', {
      harnessId: 'opencode', groupId: first.groupId,
    });

    const secondWs = makeWs();
    const secondProjectRoot = first.projectRoot;
    ThreadWebSocketHandler.setPanel(secondWs, 'file-viewer', {
      projectRoot: secondProjectRoot,
      viewName: 'file-viewer',
      workspaceId,
      workspaceEpoch: 'workspace-epoch-1',
    });
    const secondSession = makeSession(secondProjectRoot, workspaceId, { trusted: true });
    recipients.push({ ws: secondWs, session: secondSession });
    const secondTrusted = makeHandlers({
      ws: secondWs, session: secondSession, projectRoot: secondProjectRoot, recipients,
    });

    await first.trusted['thread:action']({
      action: 'rename', requestId: 'r-fan', threadGroupId: first.groupId, name: 'Shared',
    });

    const recipientFrame = firstOfType(secondWs, 'thread:action:completed');
    expect(recipientFrame).toMatchObject({
      action: 'rename', threadGroupId: first.groupId, name: 'Shared', fanOut: true,
    });
    expect(recipientFrame).not.toHaveProperty('surfaceId');
    // Independent hydration still returns the authoritative population.
    await secondTrusted['thread:list']();
    expect(firstOfType(secondWs, 'thread:list').threads).toHaveLength(1);
  });

  test('a failed recipient cannot block another delivery or the requester', async () => {
    const workspaceId = nextWorkspaceId();
    const recipients = [];
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId, { recipients });
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    const deadWs = { readyState: 1, send: jest.fn(() => { throw new Error('dead socket'); }) };
    const healthyWs = makeWs();
    recipients.push(
      { ws: deadWs, session: {} },
      { ws: healthyWs, session: {} },
    );

    await expect(trusted['thread:action']({
      action: 'rename', requestId: 'r-isolated', threadGroupId: groupId, name: 'Isolated',
    })).resolves.toBeUndefined();

    expect(firstOfType(ws, 'thread:action:completed')).toMatchObject({ name: 'Isolated' });
    expect(firstOfType(healthyWs, 'thread:action:completed')).toMatchObject({
      name: 'Isolated', fanOut: true,
    });
  });

  test('busy members return group_busy without mutating', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });
    const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
    threadRuntimeManager.markInFlight({
      workspaceId,
      projectRoot: manager.projectRoot,
      workspaceEpoch: 'workspace-epoch-1',
      scope: 'project',
      threadId,
    });

    await trusted['thread:action']({
      action: 'delete', requestId: 'd-busy', threadGroupId: groupId,
    });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'delete', code: 'group_busy',
    });
    expect(await getDb()('thread_groups').where({ group_id: groupId })).toHaveLength(1);
    threadRuntimeManager.fenceResource({
      workspaceId, projectRoot: manager.projectRoot, threadId,
    });
  });

  test('two windows hydrate the same durable group population', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    const secondWs = makeWs();
    ThreadWebSocketHandler.setPanel(secondWs, 'file-viewer', {
      projectRoot: manager.projectRoot,
      viewName: 'file-viewer',
      workspaceId,
      workspaceEpoch: 'workspace-epoch-1',
    });
    const secondTrusted = makeHandlers({
      ws: secondWs,
      session: makeSession(manager.projectRoot, workspaceId, { trusted: true }),
      projectRoot: manager.projectRoot,
    });

    await trusted['thread:list']();
    await secondTrusted['thread:list']();
    const first = firstOfType(ws, 'thread:list');
    const second = firstOfType(secondWs, 'thread:list');
    expect(first.threads.map((row) => row.threadGroupId)).toEqual([groupId]);
    expect(second.threads.map((row) => row.threadGroupId)).toEqual([groupId]);
  });

  test('the removed thread:copyLink and thread:touch routes leave no handler', async () => {
    const workspaceId = nextWorkspaceId();
    const { trusted, untrusted } = await makeHarness(workspaceId);
    expect(trusted['thread:copyLink']).toBeUndefined();
    expect(trusted['thread:touch']).toBeUndefined();
    expect(untrusted['thread:copyLink']).toBeUndefined();
    expect(untrusted['thread:touch']).toBeUndefined();
  });

  test('copy_link returns a versioned group URI with no surfaceId and fail-open context', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'copy_link', requestId: 'c-1', threadGroupId: groupId, threadId,
      context: { surfaceId: 'must-not-persist', tabId: 'tab-1' },
    });

    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'copy_link', requestId: 'c-1', threadGroupId: groupId, threadId,
    });
    expect(typeof ack.link).toBe('string');
    expect(JSON.stringify(ack)).not.toContain('surfaceId');
    expect(ack.context).toMatchObject({ workspaceId, viewId: null, threadGroupId: groupId, threadId });
    expect(ack.context.tabId).toBe('tab-1');
    expect(ack.context).not.toHaveProperty('surfaceId');

    const parsed = parseGroupLink(ack.link);
    expect(parsed).toEqual({
      version: 1, workspaceId, threadGroupId: groupId, viewId: null, threadId,
    });
  });

  test('copy_link replays the same request and rejects different-input reuse', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'copy_link', requestId: 'c-replay', threadGroupId: groupId, threadId,
    });
    const first = firstOfType(ws, 'thread:action:completed');
    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'copy_link', requestId: 'c-replay', threadGroupId: groupId, threadId,
    });
    const replay = firstOfType(ws, 'thread:action:completed');
    expect(replay.link).toBe(first.link);
    expect(await getDb()('thread_group_action_results').where({ request_id: 'c-replay' })).toHaveLength(1);

    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'copy_link', requestId: 'c-replay', threadGroupId: 'tg-other', threadId,
    });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'copy_link', requestId: 'c-replay', code: 'request_mismatch',
    });
  });

  test('resolve_link validates the URI and opens the authoritative Main Chat', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'copy_link', requestId: 'c-resolve-src', threadGroupId: groupId, threadId,
    });
    const link = firstOfType(ws, 'thread:action:completed').link;
    ws.send.mockClear();

    await trusted['thread:action']({
      action: 'resolve_link', requestId: 'r-1', uri: link,
    });

    expect(firstOfType(ws, 'thread:action:completed')).toMatchObject({
      action: 'resolve_link', requestId: 'r-1', threadGroupId: groupId, threadId, resolved: true,
    });
    // Main Chat is opened through the canonical open path; no placement.
    expect(firstOfType(ws, 'thread:opened')).toMatchObject({ threadId, threadGroupId: groupId });
    expect(JSON.stringify(ws.send.mock.calls)).not.toContain('sideChatPlacementId');
  });

  test('resolve_link rejects a foreign or stale URI without borrowing another view', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    const foreign = 'fusion-thread-group:v1?workspaceId=workspace-else&threadGroupId=' + groupId;
    await trusted['thread:action']({ action: 'resolve_link', requestId: 'r-foreign', uri: foreign });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'resolve_link', code: 'not_found',
    });

    ws.send.mockClear();
    // A URI that carries an unknown surfaceId is malformed and rejected.
    const malformed = 'fusion-thread-group:v1?workspaceId=' + workspaceId
      + '&threadGroupId=' + groupId + '&surfaceId=leak';
    await trusted['thread:action']({ action: 'resolve_link', requestId: 'r-malformed', uri: malformed });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'resolve_link', code: 'invalid_link',
    });
  });

  test('view_markdown returns the canonical exact-member mirror path', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, projectRoot, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'view_markdown', requestId: 'v-1', threadGroupId: groupId, threadId,
    });

    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({ action: 'view_markdown', threadGroupId: groupId, threadId });
    const expected = path.join(
      projectRoot, 'ai', MACHINE, 'Data', 'Chatlogs', 'threads', `${threadId}.md`,
    );
    expect(ack.markdownPath).toBe(expected);
    expect(JSON.stringify(ack)).not.toContain('surfaceId');
  });

  test('view_markdown rejects an exact member that is not in the group', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });

    await trusted['thread:action']({
      action: 'view_markdown', requestId: 'v-missing', threadGroupId: groupId, threadId: 't-other',
    });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'view_markdown', code: 'not_found',
    });
  });

  test('set_harness_selection validates model/variant, persists by threadId, and rejects invalid policy input', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, projectRoot, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Alpha', { harnessId: 'opencode', groupId: groupId });
    writeModelsConfig(projectRoot);

    await trusted['thread:action']({
      action: 'set_harness_selection', requestId: 'h-1', threadGroupId: groupId, threadId,
      model: 'deepseek/v4-flash', variant: 'high',
    });
    const ack = firstOfType(ws, 'thread:action:completed');
    expect(ack).toMatchObject({
      action: 'set_harness_selection', threadGroupId: groupId, threadId,
      harnessId: 'opencode', model: 'deepseek/v4-flash', variant: 'high',
    });
    expect(JSON.stringify(ack)).not.toContain('surfaceId');

    const persisted = JSON.parse(
      (await getDb()('threads').where({ thread_id: threadId }).first()).harness_config,
    );
    expect(persisted).toMatchObject({ model: 'deepseek/v4-flash', variant: 'high' });

    // The acknowledged value survives a fresh manager/restart read.
    const restarted = new ThreadManager({ projectRoot, workspaceId });
    const reread = await restarted.getThread(threadId);
    expect(reread.entry.harnessConfig).toMatchObject({
      model: 'deepseek/v4-flash', variant: 'high',
    });

    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'set_harness_selection', requestId: 'h-bad-model', threadGroupId: groupId, threadId,
      model: 'unknown/model', variant: null,
    });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'set_harness_selection', code: 'invalid_selection',
    });

    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'set_harness_selection', requestId: 'h-bad-variant', threadGroupId: groupId, threadId,
      model: 'deepseek/v4-flash', variant: 'ultra',
    });
    expect(firstOfType(ws, 'thread:action:error')).toMatchObject({
      action: 'set_harness_selection', code: 'invalid_selection',
    });

    // Rejection leaves the prior acknowledged value authoritative.
    const stillPersisted = JSON.parse(
      (await getDb()('threads').where({ thread_id: threadId }).first()).harness_config,
    );
    expect(stillPersisted).toMatchObject({ model: 'deepseek/v4-flash', variant: 'high' });
  });

  test('set_harness_selection acknowledges and fans out the same value by threadId', async () => {
    const workspaceId = nextWorkspaceId();
    const recipients = [];
    const first = await makeHarness(workspaceId, { recipients });
    await first.manager.createThread(first.threadId, 'Alpha', {
      harnessId: 'opencode', groupId: first.groupId,
    });
    writeModelsConfig(first.projectRoot);

    const secondWs = makeWs();
    ThreadWebSocketHandler.setPanel(secondWs, 'file-viewer', {
      projectRoot: first.projectRoot,
      viewName: 'file-viewer',
      workspaceId,
      workspaceEpoch: 'workspace-epoch-1',
    });
    const secondSession = makeSession(first.projectRoot, workspaceId, { trusted: true });
    recipients.push({ ws: secondWs, session: secondSession });

    await first.trusted['thread:action']({
      action: 'set_harness_selection', requestId: 'h-fan', threadGroupId: first.groupId,
      threadId: first.threadId, model: 'deepseek/v4-pro', variant: 'high',
    });

    expect(firstOfType(secondWs, 'thread:action:completed')).toMatchObject({
      action: 'set_harness_selection', threadId: first.threadId,
      model: 'deepseek/v4-pro', variant: 'high', fanOut: true,
    });
  });

  test('Legacy groups support copy_link/resolve_link/view_markdown without borrowing a view', async () => {
    const workspaceId = nextWorkspaceId();
    const { manager, ws, trusted, threadId, groupId } = await makeHarness(workspaceId);
    await manager.createThread(threadId, 'Legacy Alpha', {
      harnessId: 'opencode', groupId: groupId, viewId: null,
    });

    await trusted['thread:action']({
      action: 'copy_link', requestId: 'c-legacy', threadGroupId: groupId,
    });
    const link = firstOfType(ws, 'thread:action:completed').link;
    expect(parseGroupLink(link).viewId).toBeNull();
    ws.send.mockClear();

    await trusted['thread:action']({ action: 'resolve_link', requestId: 'r-legacy', uri: link });
    expect(firstOfType(ws, 'thread:action:completed')).toMatchObject({
      action: 'resolve_link', threadGroupId: groupId, threadId, resolved: true, viewId: null,
    });
    expect(firstOfType(ws, 'thread:opened')).toMatchObject({ threadId, viewId: null });

    ws.send.mockClear();
    await trusted['thread:action']({
      action: 'view_markdown', requestId: 'v-legacy', threadGroupId: groupId, threadId,
    });
    expect(firstOfType(ws, 'thread:action:completed')).toMatchObject({
      action: 'view_markdown', threadGroupId: groupId, threadId, viewId: null,
    });
  });
});
