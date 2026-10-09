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

describe('capture-viewer archive folder', () => {
  let tempRoot;
  let capturesRoot;
  let handlers;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-doc-archive-'));
    capturesRoot = path.join(tempRoot, 'Captures');
    writeFile(path.join(capturesRoot, '001-Captures', 'active.md'), '# Active\n');
    writeFile(path.join(capturesRoot, '999-Archive', 'archived.md'), '# Archived\n');
    handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath: (panel) => (panel === 'capture-viewer' ? capturesRoot : null),
    });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('hides 999-Archive from the normal capture-viewer root listing', async () => {
    const ws = createWs();

    await handlers.handleFileTreeRequest(ws, {
      panel: 'capture-viewer',
      path: '',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_tree_response',
      panel: 'capture-viewer',
      path: '',
      success: true,
    });
    expect(ws.sent[0].nodes.map((node) => node.name)).toEqual(['001-Captures']);
  });

  test('allows direct listing of the archive folder for Archive mode', async () => {
    const ws = createWs();

    await handlers.handleFileTreeRequest(ws, {
      panel: 'capture-viewer',
      path: '999-Archive',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_tree_response',
      panel: 'capture-viewer',
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

  test('keeps archive files out of capture-viewer recent files', async () => {
    const ws = createWs();

    await handlers.handleRecentFilesRequest(ws, {
      panel: 'capture-viewer',
      limit: 20,
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'recent_files_response',
      panel: 'capture-viewer',
      success: true,
    });
    expect(ws.sent[0].files.map((file) => file.path)).toEqual(['001-Captures/active.md']);
  });
});
