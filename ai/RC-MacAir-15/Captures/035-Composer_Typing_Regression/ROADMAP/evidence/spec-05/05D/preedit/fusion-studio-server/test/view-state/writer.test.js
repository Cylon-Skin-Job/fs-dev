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

function writeManifest(folder, viewId) {
  fs.writeFileSync(path.join(folder, 'manifest.md'), [
    '---',
    `name: ${viewId}`,
    'metadata:',
    `  view-id: ${viewId}`,
    '---',
    '',
  ].join('\n'));
}

describe('view-state writer', () => {
  let tempRoot;
  let previousMachine;

  beforeEach(async () => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-state-')));
    const officeView = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-office-viewer');
    fs.mkdirSync(officeView, { recursive: true });
    writeManifest(officeView, 'office-viewer');
    jest.resetModules();
    const readiness = require('../../lib/views/readiness-runtime');
    const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
    readiness.installViewReadinessOwner(createViewReadinessCoordinator({
      machineIdentity: 'Test-Machine',
      migrationService: {
        ensureReady: async ({ workspaceId, machineIdentity, projectRoot }) => ({
          status: 'verified',
          workspaceId,
          machineIdentity,
          projectRoot,
          destinationRoot: path.join(projectRoot, 'ai', machineIdentity, 'System', 'Views'),
        }),
      },
    }));
    await readiness.ensureWorkspaceViewReadiness({
      workspaceId: 'view-state-writer-test',
      projectRoot: tempRoot,
    });
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
    const officeState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-office-viewer', 'state', 'state.json'));

    expect(resolved.officePaperBrightness).toBe(42);
    expect(workspaceState.officePaperBrightness).toBe(100);
    expect(officeState.officePaperBrightness).toBe(42);
  });

  test('stores Capture tab records and active identity in Capture view state', async () => {
    const captureView = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-capture-viewer');
    fs.mkdirSync(captureView, { recursive: true });
    writeManifest(captureView, 'capture-viewer');
    const { writeViewStatePatch } = require('../../lib/view-state/writer');
    const tabs = [{ id: 'cvt-one', kind: 'doc', path: '001-Captures/note.md' }];

    const resolved = await writeViewStatePatch(tempRoot, 'capture-viewer', {
      docViewerTabs: tabs,
      docViewerActiveTabId: 'cvt-one',
    });

    const workspaceState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'));
    const captureState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-capture-viewer', 'state', 'state.json'));

    expect(resolved.docViewerTabs).toEqual(tabs);
    expect(resolved.docViewerActiveTabId).toBe('cvt-one');
    expect(workspaceState.docViewerTabs).toBeUndefined();
    expect(workspaceState.docViewerActiveTabId).toBeUndefined();
    expect(captureState.docViewerTabs).toEqual(tabs);
    expect(captureState.docViewerActiveTabId).toBe('cvt-one');
  });

  test('stores the VIEW-02 connected Capture tab records in the same view override document', async () => {
    const captureView = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-capture-viewer');
    fs.mkdirSync(captureView, { recursive: true });
    writeManifest(captureView, 'capture-viewer');
    const { writeViewStatePatch } = require('../../lib/view-state/writer');
    const records = {
      schemaVersion: 1,
      tabs: [{
        tabId: 'cvt-records-one',
        content: {
          kind: 'component',
          revision: 0,
          component: {
            schemaVersion: 1,
            componentTypeId: 'capture.landing',
            componentInstanceId: 'cvi-records-one',
            input: { title: 'CAPTURE', locationLabels: ['Capture', 'Documents and Artifacts'] },
            targetKey: 'capture:home',
          },
        },
      }],
      activeTabId: 'cvt-records-one',
      reservations: [],
    };

    const resolved = await writeViewStatePatch(tempRoot, 'capture-viewer', {
      captureTabRecords: records,
    });

    const workspaceState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'));
    const captureState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-capture-viewer', 'state', 'state.json'));

    expect(resolved.captureTabRecords).toEqual(records);
    expect(workspaceState.captureTabRecords).toBeUndefined();
    expect(captureState.captureTabRecords).toEqual(records);
  });

  test('stores right-column collapse state in the view override', async () => {
    const { writeViewStatePatch } = require('../../lib/view-state/writer');

    const resolved = await writeViewStatePatch(tempRoot, 'office-viewer', {
      collapsed: {
        rightCol: true,
      },
    });

    const workspaceState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'));
    const officeState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-office-viewer', 'state', 'state.json'));

    expect(resolved.collapsed.rightCol).toBe(true);
    expect(workspaceState.collapsed.rightCol).toBe(false);
    expect(officeState.collapsed.rightCol).toBe(true);
  });

  test('stores content-area collapse state in the view override', async () => {
    const { writeViewStatePatch } = require('../../lib/view-state/writer');

    const resolved = await writeViewStatePatch(tempRoot, 'office-viewer', {
      collapsed: {
        contentArea: true,
      },
    });

    const workspaceState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'));
    const fileState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-office-viewer', 'state', 'state.json'));

    expect(resolved.collapsed.contentArea).toBe(true);
    expect(workspaceState.collapsed.contentArea).toBe(false);
    expect(fileState.collapsed.contentArea).toBe(true);
  });

  test('stores content navigation widths per view without changing workspace pane widths', async () => {
    const { writeViewStatePatch } = require('../../lib/view-state/writer');

    const resolved = await writeViewStatePatch(tempRoot, 'office-viewer', {
      widths: {
        contentNavLeft: 284,
        contentNavRight: 316,
      },
    });

    const workspaceState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'));
    const officeState = readJson(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-office-viewer', 'state', 'state.json'));

    expect(resolved.widths.contentNavLeft).toBe(284);
    expect(resolved.widths.contentNavRight).toBe(316);
    expect(workspaceState.widths.contentNavLeft).toBe(200);
    expect(workspaceState.widths.contentNavRight).toBe(220);
    expect(officeState.widths.contentNavLeft).toBe(284);
    expect(officeState.widths.contentNavRight).toBe(316);
  });

  test('cached journal-verified readiness cannot turn a committed write into a failed result', async () => {
    const readiness = require('../../lib/views/readiness-runtime');
    const fsPromises = require('fs').promises;
    const originalRename = fsPromises.rename;
    let signalRename;
    let finishRename;
    let renamePaused = false;
    const renameStarted = new Promise(resolve => { signalRename = resolve; });
    const renamePending = new Promise(resolve => { finishRename = resolve; });
    const renameSpy = jest.spyOn(fsPromises, 'rename').mockImplementation(async (...args) => {
      if (!renamePaused) {
        renamePaused = true;
        signalRename();
        await renamePending;
      }
      return originalRename(...args);
    });

    try {
      const { writeViewStatePatch } = require('../../lib/view-state/writer');
      const writing = writeViewStatePatch(tempRoot, 'office-viewer', {
        officePaperBrightness: 61,
      });
      await renameStarted;
      const revalidation = readiness.ensureWorkspaceViewReadiness({
        workspaceId: 'view-state-writer-test',
        projectRoot: tempRoot,
      });

      finishRename();
      await expect(writing).resolves.toMatchObject({ officePaperBrightness: 61 });
      await expect(revalidation).resolves.toMatchObject({
        status: 'verified',
        phase: 'journal_verified',
        verified: true,
      });
      expect(readJson(
        path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-office-viewer', 'state', 'state.json'),
      )).toMatchObject({ officePaperBrightness: 61 });
    } finally {
      renameSpy.mockRestore();
      finishRename();
    }
  });

  test('serializes concurrent patches for the same view', async () => {
    let workspace = {};
    let override = null;
    const overrideSnapshots = [];
    const delay = () => new Promise((resolve) => setTimeout(resolve, 5));

    jest.doMock('../../lib/view-state/resolver', () => ({
      workspacePath: () => 'workspace-state',
      viewOverridePath: () => 'office-override',
      HARDCODED_DEFAULTS: {},
      readJsonOrNull: async (filePath) => {
        await delay();
        if (filePath === 'office-override') {
          overrideSnapshots.push(clone(override));
          return clone(override);
        }
        return clone(workspace);
      },
      atomicWriteJsonBatch: async (writes) => {
        for (const { filePath, obj } of writes) {
          await delay();
          if (filePath === 'office-override') {
            override = clone(obj);
          } else {
            workspace = clone(obj);
          }
        }
      },
      assertCallerHeldViewReadinessLease: () => undefined,
      resolveViewStateUnderLease: async () => deepMerge(workspace, override || {}),
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
