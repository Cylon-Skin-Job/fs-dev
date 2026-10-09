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
