const createScreenshotHandlers = require('../lib/screenshot/ws-handlers');

describe('screenshot:file-capture request correlation', () => {
  test('echoes requestId when rejecting an invalid capture request', async () => {
    const sent = [];
    const ws = {
      send(payload) {
        sent.push(JSON.parse(payload));
      },
    };
    const handlers = createScreenshotHandlers({ getAllClients: () => [] });

    await handlers['screenshot:file-capture'](ws, {
      type: 'screenshot:file-capture',
      requestId: 'capture-request-1',
      workspaceId: 'workspace-1',
    });

    expect(sent).toEqual([{
      type: 'screenshot:error',
      requestId: 'capture-request-1',
      message: 'screenshot:file-capture requires workspaceId and dataUrl',
    }]);
  });

  test('saves the direct capture and echoes its requestId without folder services', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-direct-screenshot-'));
    const previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Screenshot-Test';
    const workspaceController = require('../lib/workspace/workspace-controller');
    jest.spyOn(workspaceController, 'getActiveWorkspaceSync').mockReturnValue({
      id: 'workspace-1', repo_path: root,
    });
    try {
      const handlers = require('../lib/screenshot/ws-handlers')({ getAllClients: () => [] });
      const sent = [];
      const ws = { send(payload) { sent.push(JSON.parse(payload)); } };
      await handlers['screenshot:file-capture'](ws, {
        type: 'screenshot:file-capture',
        requestId: 'capture-request-2',
        workspaceId: 'workspace-1',
        dataUrl: 'data:image/png;base64,aW1hZ2U=',
      });

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        type: 'screenshot:file-captured',
        requestId: 'capture-request-2',
        workspaceId: 'workspace-1',
      });
      expect(sent[0].savedPath).toContain(path.join('ai', 'Screenshot-Test', 'Data', 'Screenshots'));
      expect(fs.readFileSync(sent[0].savedPath)).toEqual(Buffer.from('image'));
      expect(handlers['screenshot:refresh-source']).toBeUndefined();
    } finally {
      jest.restoreAllMocks();
      jest.resetModules();
      fs.rmSync(root, { recursive: true, force: true });
      if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    }
  });
});

describe('screenshot:file-capture save isolation', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const crypto = require('crypto');
  const capturedAt = Date.parse('2026-01-02T03:04:05Z');
  const redImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
  const blueImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==', 'base64');
  let root;
  let previousMachine;

  beforeEach(() => {
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-screenshot-isolation-'));
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Screenshot-Test';
    const workspaceController = require('../lib/workspace/workspace-controller');
    jest.spyOn(workspaceController, 'getActiveWorkspaceSync').mockReturnValue({
      id: 'workspace-1', repo_path: root,
    });
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(capturedAt);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetModules();
    fs.rmSync(root, { recursive: true, force: true });
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
  });

  test('concurrent captures at the same timestamp retain their own paths and image bytes', async () => {
    const handlers = require('../lib/screenshot/ws-handlers')({ getAllClients: () => [] });
    const sent = [];
    const ws = { send(payload) { sent.push(JSON.parse(payload)); } };
    const requests = [
      { requestId: 'capture-red', image: redImage },
      { requestId: 'capture-blue', image: blueImage },
    ];

    await Promise.all(requests.map(({ requestId, image }) => handlers['screenshot:file-capture'](ws, {
      type: 'screenshot:file-capture',
      requestId,
      workspaceId: 'workspace-1',
      dataUrl: `data:image/png;base64,${image.toString('base64')}`,
    })));

    expect(sent).toHaveLength(2);
    expect(sent.map((response) => response.requestId).sort()).toEqual(['capture-blue', 'capture-red']);
    expect(new Set(sent.map((response) => response.savedPath)).size).toBe(2);
    const screenshotDir = path.join(root, 'ai', 'Screenshot-Test', 'Data', 'Screenshots');
    for (const { requestId, image } of requests) {
      const response = sent.find((item) => item.requestId === requestId);
      expect(response).toEqual({
        type: 'screenshot:file-captured', requestId, workspaceId: 'workspace-1',
        savedPath: expect.any(String), capturedAt,
      });
      expect(path.dirname(response.savedPath)).toBe(screenshotDir);
      expect(fs.readFileSync(response.savedPath)).toEqual(image);
    }
    expect(fs.readdirSync(screenshotDir).sort()).toEqual(sent.map((response) => path.basename(response.savedPath)).sort());
  });

  test('rejects an existing generated path without overwriting its image', async () => {
    const saveId = '00000000-0000-4000-8000-000000000001';
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(saveId);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const screenshotDir = path.join(root, 'ai', 'Screenshot-Test', 'Data', 'Screenshots');
    const existingPath = path.join(screenshotDir, `fusion-capture-2026-01-02T03-04-05-000Z-${saveId}.png`);
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.writeFileSync(existingPath, redImage);
    const handlers = require('../lib/screenshot/ws-handlers')({ getAllClients: () => [] });
    const sent = [];
    const ws = { send(payload) { sent.push(JSON.parse(payload)); } };

    await handlers['screenshot:file-capture'](ws, {
      type: 'screenshot:file-capture',
      requestId: 'capture-existing',
      workspaceId: 'workspace-1',
      dataUrl: `data:image/png;base64,${blueImage.toString('base64')}`,
    });

    expect(sent).toEqual([{
      type: 'screenshot:error', requestId: 'capture-existing',
      message: expect.stringContaining('EEXIST'),
    }]);
    expect(fs.readFileSync(existingPath)).toEqual(redImage);
    expect(fs.readdirSync(screenshotDir)).toEqual([path.basename(existingPath)]);
  });
});
