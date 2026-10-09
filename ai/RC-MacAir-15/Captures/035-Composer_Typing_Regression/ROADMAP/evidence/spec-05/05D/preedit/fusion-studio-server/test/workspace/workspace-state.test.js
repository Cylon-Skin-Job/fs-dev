'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe('workspace state access', () => {
  let tempRoot;
  let repoPath;
  let stateFile;
  let workspaceState;

  beforeEach(() => {
    jest.resetModules();
    process.env.FUSION_LOCAL_MACHINE = 'Test Machine';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-workspace-state-'));
    repoPath = path.join(tempRoot, 'project');
    stateFile = path.join(repoPath, 'ai', 'Test-Machine', 'System', 'state', 'state.json');
    workspaceState = require('../../lib/workspace/workspace-state');
  });

  afterEach(() => {
    delete process.env.FUSION_LOCAL_MACHINE;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  test('save persists currentPanel into workspace System state', async () => {
    writeJson(stateFile, {
      widths: { leftSidebar: 277, leftChat: 413 },
      workspace: { currentPanel: 'wiki-viewer' },
    });

    await workspaceState.save('fs-dev', {
      currentPanel: 'office-viewer',
      viewStates: {
        'office-viewer': { shouldNotPersistHere: true },
      },
    }, {
      repoPath,
      allowedViewIds: ['office-viewer', 'wiki-viewer'],
    });

    expect(readJson(stateFile)).toEqual({
      widths: { leftSidebar: 277, leftChat: 413 },
      workspace: { currentPanel: 'office-viewer' },
    });
  });

  test('get reads currentPanel from workspace System state', () => {
    writeJson(stateFile, {
      workspace: { currentPanel: 'capture-viewer' },
    });

    expect(workspaceState.get('fs-dev', {
      repoPath,
      allowedViewIds: ['capture-viewer', 'office-viewer'],
    })).toEqual({
      currentPanel: 'capture-viewer',
    });
  });

  test('save drops currentPanel when it is not an allowed view', async () => {
    writeJson(stateFile, {
      workspace: { currentPanel: 'office-viewer' },
    });

    await workspaceState.save('fs-dev', {
      currentPanel: 'old-viewer',
    }, {
      repoPath,
      allowedViewIds: ['office-viewer'],
    });

    expect(readJson(stateFile)).toEqual({
      workspace: {},
    });
  });

  test('save denies a System state symlink into a protected capsule before temp or final writes', async () => {
    const protectedStateRoot = path.join(
      repoPath, 'ai', 'Test-Machine', 'System', 'Views', '001-capture', 'state',
    );
    fs.mkdirSync(protectedStateRoot, { recursive: true });
    fs.mkdirSync(path.dirname(path.dirname(stateFile)), { recursive: true });
    fs.symlinkSync(protectedStateRoot, path.dirname(stateFile), 'dir');

    await expect(workspaceState.save('fs-dev', {
      currentPanel: 'capture-viewer',
    }, {
      repoPath,
      allowedViewIds: ['capture-viewer'],
    })).rejects.toMatchObject({ code: 'PROTECTED_VIEW_PATH' });

    expect(fs.existsSync(path.join(protectedStateRoot, 'state.json'))).toBe(false);
    expect(fs.readdirSync(protectedStateRoot)).toEqual([]);
  });

  test('loadAll reads active panels from workspace-local state files', () => {
    const otherRepoPath = path.join(tempRoot, 'other-project');
    const otherStateFile = path.join(otherRepoPath, 'ai', 'Test-Machine', 'System', 'state', 'state.json');
    writeJson(stateFile, { workspace: { currentPanel: 'office-viewer' } });
    writeJson(otherStateFile, { workspace: { currentPanel: 'capture-viewer' } });

    expect(workspaceState.loadAll([
      { id: 'fs-dev', repoPath },
      { id: 'other', repoPath: otherRepoPath },
    ])).toEqual({
      'fs-dev': { currentPanel: 'office-viewer' },
      other: { currentPanel: 'capture-viewer' },
    });
  });
});
