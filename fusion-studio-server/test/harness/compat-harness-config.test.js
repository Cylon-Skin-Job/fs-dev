const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

function createProcessProxy() {
  const proc = new EventEmitter();
  proc.pid = 1234;
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.kill = jest.fn(() => true);
  return proc;
}

describe('compat harness config binding', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('passes parsed thread harness_config to startThread', async () => {
    const processProxy = createProcessProxy();
    const startThread = jest.fn(async () => ({
      threadId: 'thread-1',
      process: processProxy,
      sendMessage: jest.fn(),
      stop: jest.fn(),
    }));
    const harness = { initialize: jest.fn(async () => {}), startThread };

    jest.doMock('../../lib/harness/registry', () => ({
      registry: { get: jest.fn(() => harness) },
    }));
    jest.doMock('../../lib/db', () => ({
      getDb: () => () => ({
        where: () => ({
          select: () => ({
            first: async () => ({
              harness_id: 'opencode',
              harness_config: '{"opencodeSessionId":"ses_stored"}',
            }),
          }),
        }),
      }),
    }));

    const { spawnThreadWire } = require('../../lib/harness/compat');
    const wire = spawnThreadWire('thread-1', '/project', { workspaceId: 'workspace-1', viewId: null });
    await wire._harnessPromise;

    expect(startThread).toHaveBeenCalledWith('thread-1', '/project', { workspaceId: 'workspace-1', viewId: null }, expect.objectContaining({
      harnessConfig: { opencodeSessionId: 'ses_stored' },
      updateHarnessConfig: expect.any(Function),
    }));
  });
});
