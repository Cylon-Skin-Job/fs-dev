'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileExplorerHandlers } = require('../../lib/file-explorer');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createWs() {
  return {
    sent: [],
    send(message) {
      this.sent.push(JSON.parse(message));
    },
  };
}

describe('office-viewer archive folder', () => {
  let tempRoot;
  let officeRoot;
  let handlers;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-archive-'));
    officeRoot = path.join(tempRoot, 'Office');
    writeFile(path.join(officeRoot, '001-Documents', 'active.md'), '# Active\n');
    writeFile(path.join(officeRoot, '999-Archive', 'archived.md'), '# Archived\n');
    handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath: (panel) => (panel === 'office-viewer' ? officeRoot : null),
    });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('hides 999-Archive from the normal office-viewer root listing', async () => {
    const ws = createWs();

    await handlers.handleFileTreeRequest(ws, {
      panel: 'office-viewer',
      path: '',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_tree_response',
      panel: 'office-viewer',
      path: '',
      success: true,
    });
    expect(ws.sent[0].nodes.map((node) => node.name)).toEqual(['001-Documents']);
  });

  test('allows direct listing of the archive folder for Archive mode', async () => {
    const ws = createWs();

    await handlers.handleFileTreeRequest(ws, {
      panel: 'office-viewer',
      path: '999-Archive',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_tree_response',
      panel: 'office-viewer',
      path: '999-Archive',
      success: true,
    });
    expect(ws.sent[0].nodes).toEqual([
      expect.objectContaining({
        name: 'archived.md',
        path: '999-Archive/archived.md',
        type: 'file',
      }),
    ]);
  });

  test('keeps archive files out of office-viewer recent files', async () => {
    const ws = createWs();

    await handlers.handleRecentFilesRequest(ws, {
      panel: 'office-viewer',
      limit: 20,
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'recent_files_response',
      panel: 'office-viewer',
      success: true,
    });
    expect(ws.sent[0].files.map((file) => file.path)).toEqual(['001-Documents/active.md']);
  });
});
