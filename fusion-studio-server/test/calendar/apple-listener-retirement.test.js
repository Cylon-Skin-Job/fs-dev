'use strict';

jest.mock('../../lib/background-services/config', () => ({
  isEnabled: jest.fn((service) => service === 'calendar.apple' || service === 'calendar.google'),
}));
jest.mock('../../lib/calendar/apple/sync', () => ({ run: jest.fn() }));
jest.mock('../../lib/calendar/google/poller', () => ({ start: jest.fn() }));

describe('Apple Calendar listener retirement', () => {
  beforeEach(() => jest.resetModules());

  test('Calendar startup completes without Apple directory notification and preserves Google polling', () => {
    const appleSync = require('../../lib/calendar/apple/sync');
    const googlePoller = require('../../lib/calendar/google/poller');
    const calendar = require('../../lib/calendar');

    expect(calendar.start()).toBeUndefined();
    expect(appleSync.run).not.toHaveBeenCalled();
    expect(googlePoller.start).toHaveBeenCalledTimes(1);
  });
});
