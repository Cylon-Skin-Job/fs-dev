'use strict';

const {
  MAX_BUFFERED_REPLIES,
  MAX_BUFFERED_REPLY_BYTES,
  beginWorkspaceBind,
  completeWorkspaceBind,
  currentWorkspacePair,
  sendWorkspaceBoundReply,
} = require('../../lib/ws/workspace-session');

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH_B = '123e4567-e89b-42d3-a456-426614174001';
const EPOCH_A2 = '123e4567-e89b-42d3-a456-426614174002';

function session() {
  return {
    currentWorkspaceId: null,
    workspaceEpoch: null,
    workspaceBindingState: 'binding',
    workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [],
    workspaceReplyBufferBytes: 0,
  };
}

function socket({ failAt = -1 } = {}) {
  const sent = [];
  const closes = [];
  return {
    readyState: 1,
    sent,
    closes,
    send(payload, callback) {
      sent.push(payload);
      callback?.(sent.length === failAt ? new Error('send failed') : undefined);
    },
    close(code, reason) {
      closes.push([code, reason]);
      this.readyState = 3;
    },
  };
}

describe('workspace bind epochs and bounded reply buffer', () => {
  test('each A -> B -> A bind gets a new lowercase UUID and immediately retires the old pair', async () => {
    const values = [EPOCH_A1, EPOCH_B, EPOCH_A2];
    const state = session();
    const ws = socket();

    const first = beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => values.shift() });
    expect(currentWorkspacePair(state)).toBeNull();
    await completeWorkspaceBind(ws, state, { type: 'workspace:init' }, first);
    expect(currentWorkspacePair(state)).toEqual({ workspaceId: 'A', workspaceEpoch: EPOCH_A1 });

    const second = beginWorkspaceBind(state, { workspaceId: 'B', repoPath: '/B', randomUuid: () => values.shift() });
    expect(currentWorkspacePair(state)).toBeNull();
    expect(state.projectRoot).toBeNull();
    await completeWorkspaceBind(ws, state, { type: 'workspace:switched' }, second);
    const third = beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => values.shift() });
    await completeWorkspaceBind(ws, state, { type: 'workspace:switched' }, third);

    expect(currentWorkspacePair(state)).toEqual({ workspaceId: 'A', workspaceEpoch: EPOCH_A2 });
    expect(EPOCH_A2).not.toBe(EPOCH_A1);
    expect(ws.sent.map((item) => JSON.parse(item).workspaceEpoch)).toEqual([EPOCH_A1, EPOCH_B, EPOCH_A2]);
  });

  test('bind frame precedes paired replies and buffered replies keep completion order', async () => {
    const state = session();
    const ws = socket();
    const pair = beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1 });
    await sendWorkspaceBoundReply(ws, state, { type: 'file_save_response', workspaceId: 'A', workspaceEpoch: EPOCH_A1, n: 1 });
    await sendWorkspaceBoundReply(ws, state, { type: 'file_save_response', workspaceId: 'A', workspaceEpoch: EPOCH_A1, n: 2 });

    expect(ws.sent).toEqual([]);
    await expect(completeWorkspaceBind(ws, state, { type: 'workspace:init' }, pair)).resolves.toBe(true);
    expect(ws.sent.map((item) => JSON.parse(item))).toEqual([
      { type: 'workspace:init', workspaceId: 'A', workspaceEpoch: EPOCH_A1 },
      { type: 'file_save_response', workspaceId: 'A', workspaceEpoch: EPOCH_A1, n: 1 },
      { type: 'file_save_response', workspaceId: 'A', workspaceEpoch: EPOCH_A1, n: 2 },
    ]);
    expect(state.workspaceReplyBufferBytes).toBe(0);
  });

  test('pair-less binding rejection is sent immediately instead of entering the bound queue', async () => {
    const state = session();
    const ws = socket();
    beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1 });
    await sendWorkspaceBoundReply(ws, state, {
      type: 'file_save_response', version: 1, requestId: 'request-1', errorCode: 'workspace_unavailable',
    });
    expect(JSON.parse(ws.sent[0])).toMatchObject({ errorCode: 'workspace_unavailable' });
  });

  test('a pair-less File Viewer rejection tagged for the pending pair waits for the bind frame', async () => {
    const state = session();
    const ws = socket();
    const pair = beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1 });
    await sendWorkspaceBoundReply(ws, state, {
      type: 'file_tree_response', version: 1, success: false, code: 'workspace_unavailable',
      requestId: 'request-1', error: 'The workspace is not available.',
    }, pair);
    expect(ws.sent).toEqual([]);
    await completeWorkspaceBind(ws, state, { type: 'workspace:init' }, pair);
    expect(ws.sent.map((item) => JSON.parse(item).type)).toEqual(['workspace:init', 'file_tree_response']);
  });

  test('an old-pair queued reply closes after the B switch frame instead of crossing epochs', async () => {
    const state = session();
    const ws = socket();
    const pairA = beginWorkspaceBind(state, {
      workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1,
    });
    await completeWorkspaceBind(ws, state, { type: 'workspace:init' }, pairA);
    const pairB = beginWorkspaceBind(state, {
      workspaceId: 'B', repoPath: '/B', randomUuid: () => EPOCH_B,
    });
    await sendWorkspaceBoundReply(ws, state, {
      type: 'file_save_response', workspaceId: 'A', workspaceEpoch: EPOCH_A1, requestId: 'old-A',
    });
    await expect(completeWorkspaceBind(ws, state, { type: 'workspace:switched' }, pairB))
      .resolves.toBe(false);
    expect(ws.sent.slice(1).map((item) => JSON.parse(item))).toEqual([
      { type: 'workspace:switched', workspaceId: 'B', workspaceEpoch: EPOCH_B },
    ]);
    expect(ws.closes.at(-1)[0]).toBe(1011);
  });

  test('a bind superseded before its flush sends no stale bind or queued reply', async () => {
    const state = session();
    const ws = socket();
    const pairA = beginWorkspaceBind(state, {
      workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1,
    });
    await sendWorkspaceBoundReply(ws, state, {
      type: 'file_save_response', workspaceId: 'A', workspaceEpoch: EPOCH_A1,
    });
    beginWorkspaceBind(state, {
      workspaceId: 'B', repoPath: '/B', randomUuid: () => EPOCH_B,
    });

    await expect(completeWorkspaceBind(ws, state, { type: 'workspace:init' }, pairA))
      .resolves.toBe(false);
    expect(ws.sent).toEqual([]);
    expect(ws.closes.at(-1)[0]).toBe(1011);
  });

  test('message-count overflow closes for reconnect without exceeding the cap', async () => {
    const state = session();
    const ws = socket();
    beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1 });
    for (let index = 0; index < MAX_BUFFERED_REPLIES; index += 1) {
      await expect(sendWorkspaceBoundReply(ws, state, {
        type: 'reply', workspaceId: 'A', workspaceEpoch: EPOCH_A1, index,
      })).resolves.toBe(true);
    }
    await expect(sendWorkspaceBoundReply(ws, state, {
      type: 'reply', workspaceId: 'A', workspaceEpoch: EPOCH_A1, index: MAX_BUFFERED_REPLIES,
    })).resolves.toBe(false);
    expect(state.workspaceReplyBuffer).toHaveLength(MAX_BUFFERED_REPLIES);
    expect(ws.closes[0][0]).toBe(1011);
  });

  test('serialized-byte overflow closes for reconnect and does not retain the oversized reply', async () => {
    const state = session();
    const ws = socket();
    beginWorkspaceBind(state, { workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1 });
    await expect(sendWorkspaceBoundReply(ws, state, {
      type: 'reply', workspaceId: 'A', workspaceEpoch: EPOCH_A1,
      payload: 'x'.repeat(MAX_BUFFERED_REPLY_BYTES),
    })).resolves.toBe(false);
    expect(state.workspaceReplyBuffer).toEqual([]);
    expect(state.workspaceReplyBufferBytes).toBe(0);
    expect(ws.closes[0][0]).toBe(1011);
  });

  test('bind send and reply send failures close the socket for reconnect', async () => {
    const bindingState = session();
    const bindFailure = socket({ failAt: 1 });
    const pair = beginWorkspaceBind(bindingState, {
      workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1,
    });
    await expect(completeWorkspaceBind(bindFailure, bindingState, { type: 'workspace:init' }, pair))
      .resolves.toBe(false);
    expect(bindFailure.closes[0][0]).toBe(1011);
    expect(currentWorkspacePair(bindingState)).toBeNull();

    const activeState = session();
    const activeSocket = socket();
    const activePair = beginWorkspaceBind(activeState, {
      workspaceId: 'A', repoPath: '/A', randomUuid: () => EPOCH_A1,
    });
    await completeWorkspaceBind(activeSocket, activeState, { type: 'workspace:init' }, activePair);
    activeSocket.readyState = 1;
    activeSocket.send = function send(_payload, callback) { callback(new Error('reply failed')); };
    await expect(sendWorkspaceBoundReply(activeSocket, activeState, {
      type: 'reply', workspaceId: 'A', workspaceEpoch: EPOCH_A1,
    })).rejects.toThrow('reply failed');
    expect(activeSocket.closes.at(-1)[0]).toBe(1011);
  });
});
