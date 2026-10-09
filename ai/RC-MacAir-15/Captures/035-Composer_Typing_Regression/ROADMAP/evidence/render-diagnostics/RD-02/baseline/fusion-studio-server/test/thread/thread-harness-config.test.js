jest.mock('../../lib/db', () => ({ getDb: jest.fn() }));

const { getDb } = require('../../lib/db');
const { ThreadIndex } = require('../../lib/thread/ThreadIndex');
const { ThreadManager } = require('../../lib/thread/ThreadManager');

describe('thread harness config persistence', () => {
  beforeEach(() => {
    getDb.mockReset();
  });

  it('ThreadIndex.update persists harnessConfig as JSON', async () => {
    const update = jest.fn(async () => 1);
    const first = jest.fn(async () => ({
      thread_id: 'thread-1',
      name: 'Thread 1',
      created_at: '2026-06-05T00:00:00.000Z',
      message_count: 0,
      status: 'suspended',
      scope: 'project',
      view_id: null,
      harness_id: 'opencode',
      harness_config: '{"opencodeSessionId":"ses_1"}',
    }));
    const query = { update, first };
    query.where = jest.fn(() => query);
    getDb.mockReturnValue(jest.fn(() => query));

    const index = new ThreadIndex('workspace-1', 'project', null);
    const entry = await index.update('thread-1', {
      harnessConfig: { opencodeSessionId: 'ses_1' },
    });

    expect(update).toHaveBeenCalledWith({ harness_config: '{"opencodeSessionId":"ses_1"}' });
    expect(entry.harnessConfig).toEqual({ opencodeSessionId: 'ses_1' });
  });

  it('ThreadManager.updateHarnessConfig merges existing config', async () => {
    const manager = new ThreadManager({
      projectRoot: '/project',
      workspaceId: 'workspace-1',
      scope: 'project',
    });
    manager.index = {
      get: jest.fn(async () => ({ harnessConfig: { unrelated: true } })),
      update: jest.fn(async (_threadId, updates) => updates.harnessConfig),
    };

    await manager.updateHarnessConfig('thread-1', { opencodeSessionId: 'ses_1' });

    expect(manager.index.update).toHaveBeenCalledWith('thread-1', {
      harnessConfig: { unrelated: true, opencodeSessionId: 'ses_1' },
    });
  });
});
