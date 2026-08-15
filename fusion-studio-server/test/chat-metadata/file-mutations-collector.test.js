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

  function collector() {
    const match = getCollectors().find((entry) => entry.id === 'file-mutations');
    if (!match) throw new Error('file-mutations collector was not registered');
    return match;
  }

  test('records watcher file:changed once and ignores legacy underscore bus events', async () => {
    emit('chat:turn_begin', {
      workspaceId: 'workspace-1',
      threadId: 'thread-1',
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
      filePath: 'docs/example.md',
      event: 'modify',
      timestamp: 1200,
      context: { type: 'file' },
    });

    expect(collector().collect({
      workspaceId: 'workspace-1',
      threadId: 'thread-1',
    })).toEqual({
      fileMutations: [{
        event: 'modify',
        path: 'docs/example.md',
        source: 'file:changed',
        ts: 1200,
      }],
    });
  });
});
