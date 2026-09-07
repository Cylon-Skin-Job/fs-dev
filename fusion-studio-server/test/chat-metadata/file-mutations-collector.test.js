'use strict';

describe('file mutations collector', () => {
  let emit;
  let getCollectors;

  beforeEach(() => {
    jest.resetModules();
    ({ emit } = require('../../lib/event-bus'));
    ({ getCollectors } = require('../../lib/chat-metadata/exchange-metadata-registry'));
    require('../../lib/chat-metadata/collectors/file-mutations');
  });

  afterEach(() => {
    jest.resetModules();
  });

  function collector() {
    const match = getCollectors().find((entry) => entry.id === 'file-mutations');
    if (!match) throw new Error('file-mutations collector was not registered');
    return match;
  }

  test('records watcher file:changed once and ignores legacy underscore bus events', async () => {
    emit('chat:turn_begin', {
      workspaceId: 'workspace-1',
      projectRoot: '/workspace-1',
      workspaceEpoch: 'epoch-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      timestamp: 1000,
    });

    emit('file_changed', {
      workspaceId: 'workspace-1',
      panel: 'file-viewer',
      filePath: 'docs/example.md',
      change: 'modified',
      timestamp: 1100,
    });

    emit('file:changed', {
      workspaceId: 'workspace-1',
      projectRoot: '/workspace-1',
      filePath: 'docs/example.md',
      event: 'modify',
      timestamp: 1200,
      context: { type: 'file' },
    });

    expect(collector().collect({
      workspaceId: 'workspace-1',
      projectRoot: '/workspace-1',
      workspaceEpoch: 'epoch-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
    })).toEqual({
      fileMutations: [{
        event: 'modify',
        path: 'docs/example.md',
        source: 'file:changed',
        ts: 1200,
      }],
    });
  });

  test('rejects unqualified and foreign-workspace watcher events', () => {
    emit('chat:turn_begin', {
      workspaceId: 'workspace-1', projectRoot: '/workspace-1',
      workspaceEpoch: 'epoch-1', threadId: 'same-id', turnId: 'turn-1', timestamp: 1000,
    });
    emit('chat:turn_begin', {
      workspaceId: 'workspace-2', projectRoot: '/workspace-2',
      workspaceEpoch: 'epoch-2', threadId: 'same-id', turnId: 'turn-2', timestamp: 1000,
    });
    emit('file:changed', { filePath: '/A/private.txt', event: 'modify', timestamp: 1100 });
    emit('file:changed', {
      workspaceId: 'workspace-1', projectRoot: '/workspace-1',
      filePath: 'A.txt', event: 'modify', timestamp: 1200,
    });

    expect(collector().collect({
      workspaceId: 'workspace-2', projectRoot: '/workspace-2', workspaceEpoch: 'epoch-2',
      threadId: 'same-id', turnId: 'turn-2',
    }))
      .toEqual({ fileMutations: [] });
    expect(collector().collect({
      workspaceId: 'workspace-1', projectRoot: '/workspace-1', workspaceEpoch: 'epoch-1',
      threadId: 'same-id', turnId: 'turn-1',
    }))
      .toEqual({ fileMutations: [expect.objectContaining({ path: 'A.txt' })] });
  });

  test('routes a complete exact tuple to only its live same-root turn', () => {
    const shared = { workspaceId: 'workspace-1', projectRoot: '/workspace-1' };
    const turnA = {
      ...shared, workspaceEpoch: 'epoch-a', threadId: 'thread-a', turnId: 'turn-a',
    };
    const turnB = {
      ...shared, workspaceEpoch: 'epoch-b', threadId: 'thread-b', turnId: 'turn-b',
    };
    emit('chat:turn_begin', { ...turnA, timestamp: 1000 });
    emit('chat:turn_begin', { ...turnB, timestamp: 1001 });

    emit('file:changed', {
      ...turnA, filePath: 'owned-by-a.txt', event: 'modify', timestamp: 1010,
    });
    emit('chat:turn_end', { ...turnA, timestamp: 1020 });
    emit('file:changed', {
      ...turnA, filePath: 'after-a-ended.txt', event: 'modify', timestamp: 1030,
    });

    expect(collector().collect(turnA)).toEqual({
      fileMutations: [expect.objectContaining({ path: 'owned-by-a.txt' })],
    });
    expect(collector().collect(turnB)).toEqual({ fileMutations: [] });
  });

  test('suppresses an ambiguous unqualified watcher observation', () => {
    const shared = { workspaceId: 'workspace-1', projectRoot: '/workspace-1' };
    const turnA = {
      ...shared, workspaceEpoch: 'epoch-a', threadId: 'thread-a', turnId: 'turn-a',
    };
    const turnB = {
      ...shared, workspaceEpoch: 'epoch-b', threadId: 'thread-b', turnId: 'turn-b',
    };
    emit('chat:turn_begin', { ...turnA, timestamp: 1000 });
    emit('chat:turn_begin', { ...turnB, timestamp: 1001 });

    emit('file:changed', {
      ...shared, filePath: 'ambiguous.txt', event: 'modify', timestamp: 1010,
    });

    expect(collector().collect(turnA)).toEqual({ fileMutations: [] });
    expect(collector().collect(turnB)).toEqual({ fileMutations: [] });
  });

  test('suppresses watcher observations carrying a partial turn tuple', () => {
    const turn = {
      workspaceId: 'workspace-1', projectRoot: '/workspace-1',
      workspaceEpoch: 'epoch-1', threadId: 'thread-1', turnId: 'turn-1',
    };
    emit('chat:turn_begin', { ...turn, timestamp: 1000 });

    [
      { workspaceEpoch: turn.workspaceEpoch },
      { threadId: turn.threadId },
      { turnId: turn.turnId },
      { workspaceEpoch: turn.workspaceEpoch, threadId: turn.threadId },
      { workspaceEpoch: turn.workspaceEpoch, turnId: turn.turnId },
      { threadId: turn.threadId, turnId: turn.turnId },
    ].forEach((partialIdentity, index) => {
      emit('file:changed', {
        workspaceId: turn.workspaceId,
        projectRoot: turn.projectRoot,
        ...partialIdentity,
        filePath: `partial-${index}.txt`,
        event: 'modify',
        timestamp: 1010 + index,
      });
    });

    expect(collector().collect(turn)).toEqual({ fileMutations: [] });
  });

  test('overlapping finalization keeps mutations correlated to the exact turn', () => {
    const base = {
      workspaceId: 'workspace-1', projectRoot: '/workspace-1',
      workspaceEpoch: 'epoch-1', threadId: 'thread-1',
    };
    emit('chat:turn_begin', { ...base, turnId: 'turn-1', timestamp: 1000 });
    emit('file:changed', {
      workspaceId: base.workspaceId, projectRoot: base.projectRoot,
      filePath: 'one.txt', event: 'modify', timestamp: 1010,
    });
    emit('chat:turn_end', { ...base, turnId: 'turn-1', timestamp: 1020 });
    emit('chat:turn_begin', { ...base, turnId: 'turn-2', timestamp: 1030 });
    emit('file:changed', {
      workspaceId: base.workspaceId, projectRoot: base.projectRoot,
      filePath: 'two.txt', event: 'modify', timestamp: 1040,
    });

    expect(collector().collect({ ...base, turnId: 'turn-1' })).toEqual({
      fileMutations: [expect.objectContaining({ path: 'one.txt' })],
    });
    expect(collector().collect({ ...base, turnId: 'turn-2' })).toEqual({
      fileMutations: [expect.objectContaining({ path: 'two.txt' })],
    });
  });
});
