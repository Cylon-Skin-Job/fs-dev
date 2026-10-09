'use strict';

jest.mock('../../lib/watch/core', () => ({
  subscribe: jest.fn(() => jest.fn()),
}));

const { subscribe } = require('../../lib/watch/core');
const { createWatcher } = require('../../lib/watch/workspace-watcher');
const { on } = require('../../lib/event-bus');

describe('workspace watcher exclusions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not watch the served Material Symbols asset library', () => {
    const root = '/workspace';
    createWatcher(root, { workspaceId: 'workspace-1' });

    const { options } = subscribe.mock.calls[0][0];
    expect(options.ignored(`${root}/material-symbols/outlined/add.svg`)).toBe(true);
    expect(options.ignored(`${root}/src/app.js`)).toBe(false);
  });

  test('every watcher event carries its exact workspace and root identity', () => {
    const events = [];
    const unsubscribe = on('file:changed', (event) => events.push(event));
    try {
      const root = '/workspace';
      createWatcher(root, { workspaceId: 'workspace-1' });
      const { handler } = subscribe.mock.calls[0][0];
      handler('change', `${root}/src/app.js`);
      expect(events).toEqual([expect.objectContaining({
        workspaceId: 'workspace-1', projectRoot: root,
        filePath: 'src/app.js', event: 'modify',
      })]);
    } finally {
      unsubscribe();
    }
  });
});
