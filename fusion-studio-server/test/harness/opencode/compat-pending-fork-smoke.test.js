const { EventEmitter } = require('events');
const { PassThrough } = require('stream');

let mockDb;
let mockThreadRow;
let mockDbUpdates;

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn(() => ({ stdout: '' })),
}));

jest.mock('../../../lib/db', () => ({
  getDb: () => mockDb,
}));

jest.mock('../../../lib/cli-config', () => ({
  resolveCliPolicy: jest.fn(async () => ({
    config: {
      opencode: {
        runtime: {},
      },
    },
  })),
}));

const { spawn } = require('child_process');
const { spawnThreadWire } = require('../../../lib/harness/compat');

function createFakeProcess() {
  const proc = new EventEmitter();
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.killed = false;
  proc.pid = 1234;
  proc.kill = jest.fn(() => {
    proc.killed = true;
    return true;
  });
  return proc;
}

function createMockDb() {
  return (tableName) => {
    if (tableName !== 'threads') {
      throw new Error(`Unexpected table: ${tableName}`);
    }

    return {
      where(column, value) {
        if (column !== 'thread_id' || value !== 'thread-fork') {
          throw new Error(`Unexpected thread lookup: ${column}=${value}`);
        }

        return {
          select(...columns) {
            return {
              first: async () => {
                if (!mockThreadRow) return null;
                return columns.flat().reduce((row, key) => {
                  row[key] = mockThreadRow[key];
                  return row;
                }, {});
              },
            };
          },
          async update(patch) {
            mockDbUpdates.push(patch);
            Object.assign(mockThreadRow, patch);
            return 1;
          },
        };
      },
    };
  };
}

async function collect(asyncIterable) {
  const events = [];
  for await (const event of asyncIterable) {
    events.push(event);
  }
  return events;
}

function emitSuccessfulTextRun(proc, sessionId) {
  proc.stdout.emit('data', `{"type":"text","timestamp":1780703411893,"sessionID":"${sessionId}","part":{"type":"text","text":"forked"}}\n`);
  proc.stdout.emit('data', `{"type":"step_finish","timestamp":1780703411932,"sessionID":"${sessionId}","part":{"type":"step-finish","reason":"stop","messageID":"msg_fork","tokens":{"total":10,"input":3,"output":1,"reasoning":0,"cache":{"write":0,"read":6}}}}\n`);
  proc.emit('close', 0, null);
}

describe('OpenCode pending fork compat smoke', () => {
  beforeEach(() => {
    spawn.mockReset();
    delete process.env.OPENCODE_PATH;
    mockDbUpdates = [];
    mockDb = createMockDb();
    mockThreadRow = {
      thread_id: 'thread-fork',
      harness_id: 'opencode',
      harness_config: JSON.stringify({
        pendingFork: {
          type: 'opencode-current-head',
          status: 'pending',
          sourceThreadId: 'thread-source',
          sourceOpenCodeSessionId: 'ses_source',
        },
      }),
    };
  });

  it('makes restarted pending Fork state inert before provider arguments or persistence', async () => {
    const proc = createFakeProcess();
    spawn.mockReturnValue(proc);

    const wire = spawnThreadWire('thread-fork', '/project', {
      workspaceId: 'workspace-1',
      viewId: null,
    });
    await wire._harnessPromise;
    await Promise.resolve();

    expect(typeof wire._sendMessage).toBe('function');

    const eventsPromise = collect(wire._sendMessage('first fork prompt', { pollIntervalMs: 1 }));
    setImmediate(() => emitSuccessfulTextRun(proc, 'ses_forked'));
    const events = await eventsPromise;

    expect(events.map((event) => event.type)).toEqual(['turn_begin', 'content', 'status_update', 'turn_end']);
    expect(spawn).toHaveBeenCalledWith('opencode', [
      'run', '--format', 'json', '--dir', '/project', 'first fork prompt',
    ], expect.objectContaining({ cwd: '/project' }));
    expect(spawn.mock.calls[0][1]).not.toContain('--fork');
    expect(spawn.mock.calls[0][1]).not.toContain('ses_source');
    expect(mockDbUpdates).toHaveLength(1);

    const writtenConfig = JSON.parse(mockDbUpdates[0].harness_config);
    expect(writtenConfig).toEqual({ opencodeSessionId: 'ses_forked' });
  });
});
