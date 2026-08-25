'use strict';

jest.mock('../../lib/watch/core', () => ({
  subscribe: jest.fn(() => jest.fn()),
}));

const { subscribe } = require('../../lib/watch/core');
const { createWatcher } = require('../../lib/watch/workspace-watcher');

describe('workspace watcher exclusions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not watch the served Material Symbols asset library', () => {
    const root = '/workspace';
    createWatcher(root);

    const { options } = subscribe.mock.calls[0][0];
    expect(options.ignored(`${root}/material-symbols/outlined/add.svg`)).toBe(true);
    expect(options.ignored(`${root}/src/app.js`)).toBe(false);
  });
});
