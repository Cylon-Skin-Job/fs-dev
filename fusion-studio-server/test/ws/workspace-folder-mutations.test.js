'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createWs() {
  return {
    readyState: 1,
    sent: [],
    send(message) {
      this.sent.push(JSON.parse(message));
    },
  };
}

function messagesOf(ws, type) {
  return ws.sent.filter((message) => message.type === type);
}

describe('workspace folder mutations', () => {
  let tempRoot;
  let officeRoot;
  let createWorkspaceRequestHandlers;
  let consoleLogSpy;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-folder-mutations-'));
    officeRoot = path.join(tempRoot, 'ai', 'Test-Machine', 'Office');
    fs.mkdirSync(path.join(officeRoot, '999-Archive'), { recursive: true });

    jest.resetModules();
    jest.doMock('../../lib/views/panel-paths', () => ({
      getPanelPath: jest.fn((panel) => (panel === 'office-viewer' ? officeRoot : null)),
    }));
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    ({ createWorkspaceRequestHandlers } = require('../../lib/ws/workspace-request-handlers'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  function createHandlers(ws = createWs(), broadcastClients = []) {
    return {
      ws,
      handlers: createWorkspaceRequestHandlers({
        ws,
        session: { projectRoot: tempRoot },
        getAllClients: () => broadcastClients,
      }),
    };
  }

  test('archives Office folders with directory mutation metadata', () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const broadcastWs = createWs();
    const { ws, handlers } = createHandlers(createWs(), [broadcastWs]);

    handlers['file:move']({
      type: 'file:move',
      source: path.join(officeRoot, 'assets'),
      target: path.join(officeRoot, '999-Archive'),
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets'))).toBe(false);
    expect(fs.existsSync(path.join(officeRoot, '999-Archive', 'assets', 'README.md'))).toBe(true);
    expect(messagesOf(ws, 'file:moved')[0]).toMatchObject({
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      targetPanel: 'office-viewer',
      targetPath: '999-Archive/assets',
      sourceIsDirectory: true,
    });
    expect(messagesOf(broadcastWs, 'file_changed')).toEqual([
      expect.objectContaining({ panel: 'office-viewer', filePath: 'assets' }),
      expect.objectContaining({ panel: 'office-viewer', filePath: '999-Archive/assets' }),
    ]);
  });

  test('renames Office folders with directory mutation metadata', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const { ws, handlers } = createHandlers();

    await handlers['file:rename']({
      type: 'file:rename',
      source: path.join(officeRoot, 'assets'),
      newName: 'client-assets',
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets'))).toBe(false);
    expect(fs.existsSync(path.join(officeRoot, 'client-assets', 'README.md'))).toBe(true);
    expect(messagesOf(ws, 'file:renamed')[0]).toMatchObject({
      newName: 'client-assets',
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      targetPanel: 'office-viewer',
      targetPath: 'client-assets',
      sourceIsDirectory: true,
    });
  });

  test('deletes Office folders recursively with directory mutation metadata', async () => {
    writeFile(path.join(officeRoot, 'assets', 'nested', 'README.md'), '# Assets\n');
    const { ws, handlers } = createHandlers();

    await handlers['file:delete']({
      type: 'file:delete',
      source: path.join(officeRoot, 'assets'),
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets'))).toBe(false);
    expect(messagesOf(ws, 'file:deleted')[0]).toMatchObject({
      sourcePanel: 'office-viewer',
      sourcePath: 'assets',
      sourceIsDirectory: true,
    });
  });
});
