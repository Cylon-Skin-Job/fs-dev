'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileExplorerHandlers } = require('../../lib/file-explorer');

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function writeV2View(projectRoot, folderName, { id, label, icon, viewType = 'captures', dataSource = 'Captures' }) {
  const viewRoot = path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views', folderName);
  writeFile(path.join(viewRoot, 'manifest.md'), `---
name: ${label}
metadata:
  view-id: ${id}
  view-type: ${viewType}
  data-source: ${dataSource}
  enabled: true
---
`);
  writeFile(path.join(viewRoot, 'styles', 'icon.md'), `---
name: ${label} Icon
description: This file determines what icon is rendered in the left side nav.
metadata:
  icon-name: ${icon}
---
`);
  writeFile(path.join(viewRoot, 'content.json'), JSON.stringify({ display: viewType, dataSource }, null, 2));
}

function createWs() {
  return {
    sent: [],
    send(message) {
      this.sent.push(JSON.parse(message));
    },
  };
}

describe('v2 virtual view metadata', () => {
  let tempRoot;
  let oldFusionLocalMachine;

  beforeEach(() => {
    oldFusionLocalMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Test Machine';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-v2-virtual-metadata-'));
    writeV2View(tempRoot, '001-capture-viewer', {
      id: 'capture-viewer',
      label: 'Captures',
      icon: 'open_run',
    });
  });

  afterEach(() => {
    if (oldFusionLocalMachine == null) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = oldFusionLocalMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('serves v2 workspace registry from view folders', async () => {
    const ws = createWs();
    const handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath: () => null,
    });

    await handlers.handleFileContentRequest(ws, {
      panel: '__workspace__',
      path: 'views.json',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_content_response',
      panel: '__workspace__',
      path: 'views.json',
      success: true,
    });
    const registry = JSON.parse(ws.sent[0].content);
    expect(registry).toMatchObject({
      version: 2,
      views: [
        {
          id: 'capture-viewer',
          label: 'Captures',
          icon: 'open_run',
          enabled: true,
        },
      ],
    });
  });

  test('serves v2 panel index metadata from manifest and styles/icon.md', async () => {
    const ws = createWs();
    const handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath: () => null,
    });

    await handlers.handleFileContentRequest(ws, {
      panel: '__panels__',
      path: 'capture-viewer/index.json',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_content_response',
      panel: '__panels__',
      path: 'capture-viewer/index.json',
      success: true,
    });
    const index = JSON.parse(ws.sent[0].content);
    expect(index).toMatchObject({
      id: 'capture-viewer',
      label: 'Captures',
      icon: 'open_run',
      type: 'captures',
    });
  });

  test('serves arbitrary v2 view capsule files through the view id alias', async () => {
    writeFile(
      path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-capture-viewer', 'ui', 'module.js'),
      'export default {};\n'
    );
    const ws = createWs();
    const handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath: () => null,
    });

    await handlers.handleFileContentRequest(ws, {
      panel: '__panels__',
      path: 'capture-viewer/ui/module.js',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_content_response',
      panel: '__panels__',
      path: 'capture-viewer/ui/module.js',
      success: true,
      content: 'export default {};\n',
    });
  });

  test('blocks traversal through the v2 view id alias', async () => {
    const ws = createWs();
    const handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath: () => null,
    });

    await handlers.handleFileContentRequest(ws, {
      panel: '__panels__',
      path: 'capture-viewer/../../package.json',
    });

    expect(ws.sent[0]).toMatchObject({
      type: 'file_content_response',
      panel: '__panels__',
      path: 'capture-viewer/../../package.json',
      success: false,
    });
  });

  test('does not fall back to unnumbered view folders for missing v2 alias files', async () => {
    const ws = createWs();
    const getPanelPath = jest.fn(() => {
      throw new Error('legacy fallback should not be used for v2 aliases');
    });
    const handlers = createFileExplorerHandlers({
      getProjectRoot: () => tempRoot,
      getPanelPath,
    });

    await handlers.handleFileContentRequest(ws, {
      panel: '__panels__',
      path: 'capture-viewer/ui/module.js',
    });

    expect(getPanelPath).not.toHaveBeenCalled();
    expect(ws.sent[0]).toMatchObject({
      type: 'file_content_response',
      panel: '__panels__',
      path: 'capture-viewer/ui/module.js',
      success: false,
      code: 'ENOENT',
    });
  });
});
