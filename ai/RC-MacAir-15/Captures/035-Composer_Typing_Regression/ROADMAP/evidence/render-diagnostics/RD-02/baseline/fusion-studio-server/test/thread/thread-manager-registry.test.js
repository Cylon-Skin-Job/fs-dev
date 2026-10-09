'use strict';

const constructed = [];

jest.mock('../../lib/thread/ThreadManager', () => ({
  ThreadManager: class FakeThreadManager {
    constructor(options) {
      Object.assign(this, options);
      constructed.push(this);
    }

    async init() {}

    async shutdownSessions() { return true; }
  },
}));

const {
  getProjectThreadManager,
  _getProjectThreadManagers,
} = require('../../lib/thread/thread-manager-registry');

afterEach(() => {
  _getProjectThreadManagers().clear();
  constructed.length = 0;
});

test('manager identity includes both workspace id and normalized project root', () => {
  const managerA = getProjectThreadManager('/workspace/a', 'same-workspace');
  const managerAAgain = getProjectThreadManager('/workspace/a/./', 'same-workspace');
  const managerB = getProjectThreadManager('/workspace/b', 'same-workspace');

  expect(managerAAgain).toBe(managerA);
  expect(managerB).not.toBe(managerA);
  expect(managerA.projectRoot).toBe('/workspace/a');
  expect(managerB.projectRoot).toBe('/workspace/b');
  expect(_getProjectThreadManagers().size).toBe(2);
});
