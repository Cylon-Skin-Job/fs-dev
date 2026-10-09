'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
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

describe('workspace Office thumbnails', () => {
  let tempRoot;
  let officeRoot;
  let createWorkspaceRequestHandlers;
  let consoleLogSpy;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-thumbnails-'));
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

  function createHandlers() {
    const ws = createWs();
    return {
      ws,
      handlers: createWorkspaceRequestHandlers({
        ws,
        session: { projectRoot: tempRoot },
        getAllClients: () => [],
      }),
    };
  }

  test('saves Office document thumbnails beside the document folder', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    const { ws, handlers } = createHandlers();

    await handlers['office:thumbnail_save']({
      type: 'office:thumbnail_save',
      documentPath: 'assets/README.md',
      dataUrl: `data:image/png;base64,${Buffer.from('thumb').toString('base64')}`,
    });

    expect(fs.readFileSync(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'), 'utf8')).toBe('thumb');
    expect(messagesOf(ws, 'office:thumbnail_saved')[0]).toMatchObject({
      documentPath: 'assets/README.md',
      thumbnailPath: 'assets/.thumbnails/README.md.png',
      savedAt: expect.any(Number),
    });
  });

  test('renames Office document thumbnail sidecars with the document', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    writeFile(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'), 'thumb');
    const { handlers } = createHandlers();

    await handlers['file:rename']({
      type: 'file:rename',
      source: path.join(officeRoot, 'assets', 'README.md'),
      newName: 'Overview.md',
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'))).toBe(false);
    expect(fs.readFileSync(path.join(officeRoot, 'assets', '.thumbnails', 'Overview.md.png'), 'utf8')).toBe('thumb');
  });

  test('archives Office document thumbnail sidecars with the document', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    writeFile(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'), 'thumb');
    const { handlers } = createHandlers();

    await handlers['file:move']({
      type: 'file:move',
      source: path.join(officeRoot, 'assets', 'README.md'),
      target: path.join(officeRoot, '999-Archive'),
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'))).toBe(false);
    expect(fs.readFileSync(path.join(officeRoot, '999-Archive', '.thumbnails', 'README.md.png'), 'utf8')).toBe('thumb');
  });

  test('deletes Office document thumbnail sidecars with the document', async () => {
    writeFile(path.join(officeRoot, 'assets', 'README.md'), '# Assets\n');
    writeFile(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'), 'thumb');
    const { handlers } = createHandlers();

    await handlers['file:delete']({
      type: 'file:delete',
      source: path.join(officeRoot, 'assets', 'README.md'),
    });

    expect(fs.existsSync(path.join(officeRoot, 'assets', 'README.md'))).toBe(false);
    expect(fs.existsSync(path.join(officeRoot, 'assets', '.thumbnails', 'README.md.png'))).toBe(false);
  });
});
