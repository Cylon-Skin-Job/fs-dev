'use strict';

const { createCrudHandlers } = require('../../lib/thread/thread-crud');
const { threadRuntimeManager } = require('../../lib/thread/thread-runtime-manager');
const { createCanonicalChatEventApplier } = require('../../lib/wire/canonical-chat-event-applier');

function makeManager() {
  return {
    workspaceId: 'workspace-1',
    getThread: jest.fn(() => Promise.resolve({ entry: { name: 'Thread 1' } })),
    getHistory: jest.fn(() => Promise.resolve({ messages: [] })),
    getRichHistory: jest.fn(() => Promise.resolve({ exchanges: [] })),
    index: {
      markResumed: jest.fn(() => Promise.resolve()),
      touch: jest.fn(() => Promise.resolve()),
    },
  };
}

function makeHandlers(manager) {
  const ws = { send: jest.fn() };
  const wsState = new Map([[ws, {
    viewName: 'view-1',
    panelId: 'view-1',
    threadId: null,
    threadManager: manager,
  }]]);
  const pendingReorderTimers = new Map();
  const handlers = createCrudHandlers({
    wsState,
    sendThreadList: jest.fn(() => Promise.resolve()),
    closeThread: jest.fn(() => Promise.resolve()),
    pendingReorderTimers,
    REORDER_DELAY_MS: 10,
  });
  return { ws, handlers, pendingReorderTimers };
}

function clearPendingTimers(pendingReorderTimers) {
  for (const timer of pendingReorderTimers.values()) {
    clearTimeout(timer);
  }
  pendingReorderTimers.clear();
}

describe('thread CRUD live turn snapshots', () => {
  beforeEach(() => {
    threadRuntimeManager.runtimes.clear();
  });

  test('thread:opened includes liveTurn when a snapshot exists', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };
    threadRuntimeManager.beginLiveTurn(key, { turnId: 'turn-1', userInput: 'hello' });
    threadRuntimeManager.appendLiveContent(key, 'hi there');

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened).toMatchObject({
      type: 'thread:opened',
      threadId: 'thread-1',
      scope: 'project',
      liveTurn: {
        workspaceId: 'workspace-1',
        scope: 'project',
        threadId: 'thread-1',
        turnId: 'turn-1',
        userInput: 'hello',
        status: 'in_flight',
        fullText: 'hi there',
      },
    });
    clearPendingTimers(pendingReorderTimers);
  });

  test('thread:opened sends null liveTurn for cold/no-live threads', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.type).toBe('thread:opened');
    expect(opened.liveTurn).toBeNull();
    clearPendingTimers(pendingReorderTimers);
  });

  // ─── SPEC-01 Slice C ────────────────────────────────────────────────

  test('snapshot begun through the drain path carries attachments on the overlay', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };

    const control = {
      drainId: 'drain-crud',
      runtimeKey: key,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    };
    const routeContext = {
      workspaceId: 'workspace-1',
      workspace: 'workspace:workspace-1',
      projectRoot: '/tmp/project',
      scope: 'project',
      threadId: 'thread-1',
      acceptedUserInput: 'hello with files',
      attachments: [{ kind: 'file', label: 'a.txt', path: '/tmp/a.txt', sourceName: 'a.txt' }],
    };
    threadRuntimeManager.claimActiveDrain(key, control, routeContext);
    expect(threadRuntimeManager.beginCanonicalTurn(key, 'drain-crud', {
      turnId: 'turn-1',
      userInput: 'hello with files',
      attachments: routeContext.attachments,
    }).accepted).toBe(true);
    threadRuntimeManager.appendLiveContent(key, 'hi there');

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.liveTurn).toMatchObject({
      turnId: 'turn-1',
      userInput: 'hello with files',
      status: 'in_flight',
      fullText: 'hi there',
    });
    expect(opened.liveTurn.attachments).toEqual([
      { kind: 'file', label: 'a.txt', path: '/tmp/a.txt', sourceName: 'a.txt' },
    ]);
    clearPendingTimers(pendingReorderTimers);
  });

  test('completed snapshot survives drain clear and still overlays thread:opened', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };

    const control = {
      drainId: 'drain-crud-done',
      runtimeKey: key,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    };
    threadRuntimeManager.claimActiveDrain(key, control, null);
    threadRuntimeManager.beginCanonicalTurn(key, 'drain-crud-done', {
      turnId: 'turn-2',
      userInput: 'hello',
    });
    threadRuntimeManager.appendLiveContent(key, 'persisted answer');
    expect(threadRuntimeManager.bindTurnToDrain(key, 'drain-crud-done', 'turn-2')).toBe(true);
    expect(threadRuntimeManager.terminalizeTurn(key, { drainId: 'drain-crud-done', turnId: 'turn-2' }, 'complete')).toBe(true);
    expect(threadRuntimeManager.clearActiveDrainIfCurrent(key, 'drain-crud-done')).toBe(true);

    // Record is gone…
    expect(threadRuntimeManager.getActiveDrain(key)).toBeNull();

    // …but thread:opened still receives the completed snapshot overlay.
    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.liveTurn).toMatchObject({
      turnId: 'turn-2',
      status: 'complete',
      fullText: 'persisted answer',
    });
    clearPendingTimers(pendingReorderTimers);
  });

  // ─── SPEC-02 Slice B: Working-activity fields on the overlay ────────

  /**
   * Claim a drain, begin + bind a canonical turn, and return a real applier
   * bound to that drain so step_begin/turn_end can be driven end-to-end.
   */
  function beginSteppableTurn(key, { turnId }) {
    const control = {
      drainId: `drain-${turnId}`,
      runtimeKey: key,
      touchThreadSession: () => {},
      stopHarness: async () => {},
    };
    const routeContext = {
      workspaceId: key.workspaceId,
      workspace: `workspace:${key.workspaceId}`,
      projectRoot: '/tmp/project',
      scope: key.scope,
      threadId: key.threadId,
      acceptedUserInput: 'watch me work',
      attachments: [],
    };
    threadRuntimeManager.claimActiveDrain(key, control, routeContext);
    expect(threadRuntimeManager.beginCanonicalTurn(key, control.drainId, {
      turnId,
      userInput: 'watch me work',
    }).accepted).toBe(true);
    expect(threadRuntimeManager.bindTurnToDrain(key, control.drainId, turnId)).toBe(true);
    const applier = createCanonicalChatEventApplier({
      emit: () => {},
      checkSettingsBounce: () => null,
      generateTurnId: () => turnId,
    });
    const drainContext = { route: routeContext, control };
    return { applier, drainContext };
  }

  test('thread:opened liveTurn includes Working activity/cursor/ledger/revision driven via the applier flow', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };

    const { applier, drainContext } = beginSteppableTurn(key, { turnId: 'turn-9' });
    applier.applyChatEvent({ type: 'step_begin', payload: { stepId: 's-1' } }, null, drainContext);

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.type).toBe('thread:opened');
    expect(opened.liveTurn).toMatchObject({
      turnId: 'turn-9',
      status: 'in_flight',
      activity: {
        kind: 'working',
        turnId: 'turn-9',
        identity: 'step:s-1',
        stepId: 's-1',
        activityRevision: 1,
      },
      stepCursor: { identity: 'step:s-1' },
      seenStepIdentities: ['step:s-1'],
      activityRevision: 1,
    });
    expect(typeof opened.liveTurn.activity.startedAt).toBe('number'); // JSON-safe over the wire
    clearPendingTimers(pendingReorderTimers);
  });

  test('R-FINDING-2: thread:opened liveTurn reconstructs the published usage/status projection while in flight', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };

    const { applier, drainContext } = beginSteppableTurn(key, { turnId: 'turn-use' });
    // Explicit initialization: before any accepted status_update the served
    // snapshot's usage mirror is null.
    expect(threadRuntimeManager.getLiveTurn(key).usage).toBeNull();
    applier.applyChatEvent({
      type: 'status_update',
      payload: {
        contextUsage: 0.42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-u',
        planMode: true,
      },
    }, null, drainContext);

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.liveTurn).toMatchObject({
      turnId: 'turn-use',
      status: 'in_flight',
      usage: {
        contextUsage: 0.42,
        tokenUsage: { input_other: 100, output: 50 },
        messageId: 'msg-u',
        planMode: true,
      },
    });
    clearPendingTimers(pendingReorderTimers);
  });

  test('terminal snapshot overlay carries cleared transient fields with the revision bump retained', async () => {
    const manager = makeManager();
    const { ws, handlers, pendingReorderTimers } = makeHandlers(manager);
    const key = {
      workspaceId: 'workspace-1',
      scope: 'project',
      threadId: 'thread-1',
    };

    const { applier, drainContext } = beginSteppableTurn(key, { turnId: 'turn-10' });
    applier.applyChatEvent({ type: 'step_begin', payload: { stepId: 's-1' } }, null, drainContext);
    applier.applyChatEvent({ type: 'turn_end', payload: {} }, null, drainContext);

    // SPEC-02 Slice D §3.D rule 4: the retained terminal snapshot sits at its
    // final frontier — read it before the overlay to compare exactly.
    const retainedFrontier = threadRuntimeManager.getLiveTurn(key).streamSeq;
    expect(retainedFrontier).toBeGreaterThanOrEqual(2); // begin + step + terminal mutations

    await handlers.handleThreadOpen(ws, { threadId: 'thread-1' });

    const opened = JSON.parse(ws.send.mock.calls[0][0]);
    expect(opened.liveTurn).toMatchObject({
      turnId: 'turn-10',
      status: 'complete',
      activity: null,
      stepCursor: null,
      seenStepIdentities: [],
      activityRevision: 2, // +1 accept, +1 real Working→cleared at terminalization
      // R-FINDING-2 terminal retention: usage clears with the accumulator
      // reset — both representations agree on the terminal snapshot.
      usage: null,
    });
    // The drain record is gone but the frontier survives carriage intact —
    // a reconnecting client hydrates the authoritative reconstruction baseline.
    expect(opened.liveTurn.streamSeq).toBe(retainedFrontier);
    clearPendingTimers(pendingReorderTimers);
  });
});
