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
    jest.doMock('../../lib/cli-config', () => ({
      resolveCliPolicy: jest.fn(async () => ({
        config: {
          opencode: {
            runtime: {},
          },
        },
      })),
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

  it('passes workspace OpenCode runtime policy to initialize', async () => {
    const processProxy = createProcessProxy();
    const startThread = jest.fn(async () => ({
      threadId: 'thread-1',
      process: processProxy,
      sendMessage: jest.fn(),
      stop: jest.fn(),
    }));
    const initialize = jest.fn(async () => {});
    const harness = { initialize, startThread };

    jest.doMock('../../lib/harness/registry', () => ({
      registry: { get: jest.fn(() => harness) },
    }));
    jest.doMock('../../lib/cli-config', () => ({
      resolveCliPolicy: jest.fn(async () => ({
        config: {
          opencode: {
            runtime: {
              model: 'kimi-for-coding/k2p7',
              thinking: true,
            },
          },
        },
      })),
    }));
    jest.doMock('../../lib/db', () => ({
      getDb: () => () => ({
        where: () => ({
          select: () => ({
            first: async () => ({
              harness_id: 'opencode',
              harness_config: '{}',
            }),
          }),
        }),
      }),
    }));

    const { spawnThreadWire } = require('../../lib/harness/compat');
    const wire = spawnThreadWire('thread-1', '/project', { workspaceId: 'workspace-1', viewId: null });
    await wire._harnessPromise;

    expect(initialize).toHaveBeenCalledWith({
      model: 'kimi-for-coding/k2p7',
      thinking: true,
      pure: false,
    });
  });

  it('clears stale OpenCode singleton runtime options when policy is empty', async () => {
    const processProxy = createProcessProxy();
    const startThread = jest.fn(async () => ({
      threadId: 'thread-1',
      process: processProxy,
      sendMessage: jest.fn(),
      stop: jest.fn(),
    }));
    const initialize = jest.fn(async () => {});
    const harness = { initialize, startThread };

    jest.doMock('../../lib/harness/registry', () => ({
      registry: { get: jest.fn(() => harness) },
    }));
    jest.doMock('../../lib/cli-config', () => ({
      resolveCliPolicy: jest.fn(async () => ({
        config: {
          opencode: {
            runtime: {},
          },
        },
      })),
    }));
    jest.doMock('../../lib/db', () => ({
      getDb: () => () => ({
        where: () => ({
          select: () => ({
            first: async () => ({
              harness_id: 'opencode',
              harness_config: '{}',
            }),
          }),
        }),
      }),
    }));

    const { spawnThreadWire } = require('../../lib/harness/compat');
    const wire = spawnThreadWire('thread-1', '/project', { workspaceId: 'workspace-1', viewId: null });
    await wire._harnessPromise;

    expect(initialize).toHaveBeenCalledWith({
      model: null,
      thinking: false,
      pure: false,
    });
  });

  it('marks and closes the outer wire when an idle session is killed', async () => {
    const processProxy = createProcessProxy();
    const stop = jest.fn(async () => {});
    const harness = {
      initialize: jest.fn(async () => {}),
      startThread: jest.fn(async () => ({
        threadId: 'thread-1',
        process: processProxy,
        sendMessage: jest.fn(),
        stop,
      })),
    };

    jest.doMock('../../lib/harness/registry', () => ({
      registry: { get: jest.fn(() => harness) },
    }));
    jest.doMock('../../lib/cli-config', () => ({
      resolveCliPolicy: jest.fn(async () => ({ config: { opencode: { runtime: {} } } })),
    }));
    jest.doMock('../../lib/db', () => ({
      getDb: () => () => ({
        where: () => ({
          select: () => ({
            first: async () => ({ harness_id: 'opencode', harness_config: '{}' }),
          }),
        }),
      }),
    }));

    const { spawnThreadWire } = require('../../lib/harness/compat');
    const wire = spawnThreadWire('thread-1', '/project');
    const exit = jest.fn();
    wire.on('exit', exit);
    await wire._harnessPromise;

    expect(wire.kill('SIGTERM')).toBe(true);
    await new Promise(resolve => setImmediate(resolve));

    expect(wire.killed).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(wire.kill('SIGTERM')).toBe(false);
  });
});
