const path = require('path');

const { resolveServerLogPath } = require('../lib/logging');

describe('resolveServerLogPath', () => {
  test('keeps development logging beside the server without app user data', () => {
    expect(resolveServerLogPath({
      appUserData: undefined,
      serverDir: '/workspace/fusion-studio-server',
    })).toBe('/workspace/fusion-studio-server/server-live.log');
  });

  test('writes packaged logging into the isolated application profile', () => {
    expect(resolveServerLogPath({
      appUserData: '/Users/test/Library/Application Support/Fusion Studio Alpha',
      serverDir: '/Applications/Fusion Studio Alpha.app/Contents/Resources/fusion-studio-server',
    })).toBe(path.resolve(
      '/Users/test/Library/Application Support/Fusion Studio Alpha/server-live.log',
    ));
  });

  test('treats a blank app user data value as development mode', () => {
    expect(resolveServerLogPath({
      appUserData: '   ',
      serverDir: '/workspace/fusion-studio-server',
    })).toBe('/workspace/fusion-studio-server/server-live.log');
  });
});
