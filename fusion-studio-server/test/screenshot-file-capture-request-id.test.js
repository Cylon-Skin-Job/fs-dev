jest.mock('../lib/screenshot/source-folder-service', () => ({ refresh: jest.fn() }));
jest.mock('../lib/screenshot/hotkey-screenshot-watcher', () => ({ refresh: jest.fn() }));

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
});
