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
      threadManagers: { project: manager, view: manager },
    }]]);
    const handlers = createCrudHandlers({
      wsState,
      sendThreadList: jest.fn(),
      closeThread: jest.fn(),
      pendingReorderTimers: new Map(),
      REORDER_DELAY_MS: 1,
    });

    await handlers.handleThreadOpenAssistant(ws, { scope: 'project', harnessId: 'kimi' });

    expect(manager.createThread).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining("Harness 'kimi' is not allowed"));
  });
});
