'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return patch;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    out[key] = isPlainObject(value) && isPlainObject(out[key])
      ? deepMerge(out[key], value)
      : value;
  }
  return out;
}

function clone(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}

describe('view-state writer', () => {
  let tempRoot;
  let previousMachine;

  beforeEach(() => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-state-'));
    fs.mkdirSync(path.join(tempRoot, 'ai', 'Test-Machine', 'Views', '001-office-viewer'), { recursive: true });
    jest.resetModules();
  });

  afterEach(() => {
    if (previousMachine === undefined) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = previousMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  test('stores Office paper brightness as Office view state', async () => {
    const { writeViewStatePatch } = require('../../lib/view-state/writer');

    const resolved = await writeViewStatePatch(tempRoot, 'office-viewer', {
      officePaperBrightness: 42,
    });

    const workspaceState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'));
    const officeState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'Views', '001-office-viewer', 'state', 'state.json'));

    expect(resolved.officePaperBrightness).toBe(42);
    expect(workspaceState.officePaperBrightness).toBe(100);
    expect(officeState.officePaperBrightness).toBe(42);
  });

  test('serializes concurrent patches for the same view', async () => {
    let workspace = {};
    let override = null;
    const overrideSnapshots = [];
    const delay = () => new Promise((resolve) => setTimeout(resolve, 5));

    jest.doMock('../../lib/view-state/resolver', () => ({
      workspacePath: () => 'workspace-state',
      viewOverridePath: () => 'office-override',
      readJsonOrNull: async (filePath) => {
        await delay();
        if (filePath === 'office-override') {
          overrideSnapshots.push(clone(override));
          return clone(override);
        }
        return clone(workspace);
      },
      atomicWriteJson: async (filePath, obj) => {
        await delay();
        if (filePath === 'office-override') {
          override = clone(obj);
        } else {
          workspace = clone(obj);
        }
      },
      resolveViewState: async () => deepMerge(workspace, override || {}),
      deepMerge,
      isPlainObject,
    }));

    const { writeViewStatePatch } = require('../../lib/view-state/writer');

    await Promise.all([
      writeViewStatePatch(tempRoot, 'office-viewer', {
        officeViewerSelectedPath: 'assets/README.md',
      }),
      writeViewStatePatch(tempRoot, 'office-viewer', {
        activity: {
          recents: [{ id: 'office-viewer:assets/README.md', path: 'assets/README.md' }],
        },
      }),
    ]);

    expect(override).toMatchObject({
      officeViewerSelectedPath: 'assets/README.md',
      activity: {
        recents: [{ id: 'office-viewer:assets/README.md', path: 'assets/README.md' }],
      },
    });
    expect(overrideSnapshots[0]).toBeNull();
    expect(overrideSnapshots[1]).toMatchObject({
      officeViewerSelectedPath: 'assets/README.md',
    });
  });
});
