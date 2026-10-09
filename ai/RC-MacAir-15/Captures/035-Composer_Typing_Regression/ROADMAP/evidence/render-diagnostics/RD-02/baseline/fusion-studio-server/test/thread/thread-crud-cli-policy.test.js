const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const { createCrudHandlers } = require('../../lib/thread/thread-crud');

async function writeCliConfig(projectRoot, config) {
  const file = path.join(projectRoot, 'ai', 'system', 'config', 'cli.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config)}\n`);
}

describe('thread CRUD CLI policy enforcement', () => {
  let projectRoot;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'thread-policy-'));
    await writeCliConfig(projectRoot, {
      defaultHarness: 'opencode',
      harnesses: {
        opencode: { enabled: true },
        kimi: { enabled: false },
      },
    });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('rejects explicit harnessId when disabled by cli.json', async () => {
    const ws = { send: jest.fn() };
    const manager = {
      projectRoot,
      createThread: jest.fn(),
    };
    const wsState = new Map([[ws, {
      viewName: 'file-viewer',
      threadManager: manager,
    }]]);
    const handlers = createCrudHandlers({
      wsState,
      sendThreadList: jest.fn(),
      closeThread: jest.fn(),
      pendingReorderTimers: new Map(),
      REORDER_DELAY_MS: 1,
    });

    await handlers.handleThreadOpenAssistant(ws, { harnessId: 'kimi' });

    expect(manager.createThread).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining("Harness 'kimi' is not allowed"));
  });

  it('echoes request and workspace generation through eager created/opened frames and failures', async () => {
    const ws = { send: jest.fn() };
    const manager = {
      workspaceId: 'workspace-1', projectRoot,
      createThread: jest.fn(async (id, _name, options) => ({ threadId: id,
        entry: { name: 'New Chat', harnessId: options.harnessId } })),
      getThread: jest.fn(async () => ({ entry: { name: 'New Chat', harnessId: 'opencode' } })),
      getHistory: jest.fn(async () => ({ messages: [] })),
      getRichHistory: jest.fn(async () => ({ exchanges: [] })),
      index: { markResumed: jest.fn(async () => {}), touch: jest.fn(async () => {}) },
      threadGroups: {
        resolveViewTarget: jest.fn((viewId) => ({ ok: viewId === 'system-viewer', viewId })),
        resolveOpenTarget: jest.fn(async ({ threadGroupId, threadId }) => ({ ok: true,
          target: { threadId, projection: { threadGroupId, workspaceId: 'workspace-1',
            viewId: 'system-viewer', currentPrimaryThreadId: threadId } } })),
      },
    };
    const state = { viewName: 'system-viewer', workspaceEpoch: 'epoch-1', threadManager: manager };
    const pendingReorderTimers = new Map();
    const handlers = createCrudHandlers({
      wsState: new Map([[ws, state]]), sendThreadList: jest.fn(async () => {}),
      pendingReorderTimers, REORDER_DELAY_MS: 10,
    });
    try {
      await handlers.handleThreadOpenAssistant(ws, { type: 'thread:open-assistant',
        requestId: 'create-1', viewId: 'system-viewer' });
      const frames = ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
      const created = frames.find((frame) => frame.type === 'thread:created');
      const opened = frames.find((frame) => frame.type === 'thread:opened');
      expect(created).toMatchObject({ requestId: 'create-1', workspaceId: 'workspace-1',
        workspaceEpoch: 'epoch-1', viewId: 'system-viewer' });
      expect(opened).toMatchObject({ requestId: 'create-1', workspaceId: 'workspace-1',
        workspaceEpoch: 'epoch-1', threadId: created.threadId,
        threadGroupId: created.threadGroupId });
      expect(manager.createThread).toHaveBeenCalledWith(created.threadId, null,
        expect.objectContaining({ requestId: 'create-1', viewId: 'system-viewer' }));

      ws.send.mockClear();
      await handlers.handleThreadOpenAssistant(ws, { type: 'thread:open-assistant',
        requestId: 'create-2', viewId: 'missing-view' });
      expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({
        type: 'error', requestId: 'create-2', code: 'view_not_found',
      });
    } finally {
      for (const timer of pendingReorderTimers.values()) clearTimeout(timer);
    }
  });
});
