'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const createService = require('../../lib/workspace/create-service');
const aiPaths = require('../../lib/workspace/ai-paths');
const views = require('../../lib/views');
const { buildPanelConfig } = require('../../lib/ws/connection-init');
const viewReadiness = require('../../lib/views/readiness-runtime');
const { installHistoricalReadinessFixture } = require('./historical-readiness-fixture');
const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
const { TAB_POLICY_UNAVAILABLE_CODE } = require('../../lib/views/tab-policy');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function captureTabsPolicy() {
  return {
    schemaVersion: 1,
    initial: { kind: 'launcher', launcherId: 'capture.home' },
    plus: { enabled: true },
    empty: {
      tabLabel: 'New Capture Tab',
      locationLabel: 'New Capture Tab',
      launcherIds: ['capture.home'],
    },
    location: {
      omitTerminalNames: ['PAGE.md'],
      historyControls: 'presenter',
    },
    newTab: {
      blankKind: 'home',
      autoOpenDrawer: false,
    },
  };
}

describe('tab policy projection on panel_config', () => {
  let tempRoot;
  let oldFusionLocalMachine;

  beforeEach(() => {
    oldFusionLocalMachine = process.env.FUSION_LOCAL_MACHINE;
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-tab-policy-')));
  });

  afterEach(() => {
    if (oldFusionLocalMachine == null) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = oldFusionLocalMachine;
    }
    installHistoricalReadinessFixture();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function scaffoldWithViews(machineName, viewIds) {
    const projectPath = path.join(tempRoot, machineName.toLowerCase());
    const coordinator = createViewReadinessCoordinator({
      machineIdentity: machineName,
      migrationService: { ensureReady: async () => { throw new Error('not used by scaffold fixture'); } },
    });
    viewReadiness.installViewReadinessOwner(coordinator);
    createService.scaffoldProject({ projectPath, machineName, viewIds });
    viewReadiness.installViewReadinessOwner({
      ensureReady: async ({ workspaceId }) => ({
        status: 'verified', phase: 'journal_verified', verified: true, workspaceId, projectRoot: projectPath,
      }),
      acquireLease: () => ({
        phase: 'journal_verified',
        verified: true,
        projectRoot: projectPath,
        viewsRoot: aiPaths.getMachineViewsRoot(projectPath, machineName),
        release() {},
      }),
      getStatus: () => ({ status: 'ready', verified: true }),
    });
    process.env.FUSION_LOCAL_MACHINE = machineName;
    const viewsRoot = aiPaths.getMachineViewsRoot(projectPath, machineName);
    const contentPath = (viewId) => {
      const folderName = fs.readdirSync(viewsRoot)
        .filter((name) => /^\d+-/.test(name))
        .find((name) => {
          const manifest = fs.readFileSync(path.join(viewsRoot, name, 'manifest.md'), 'utf8');
          return new RegExp(`^  view-id: ${viewId}$`, 'm').test(manifest);
        });
      if (!folderName) throw new Error(`fixture capsule not found for ${viewId}`);
      return path.join(viewsRoot, folderName, 'content.json');
    };
    return {
      projectPath,
      machineRoot: path.join(projectPath, 'ai', machineName),
      contentPath,
    };
  }

  test('views with no tabs key are absent from tabPolicies while the frame stays intact', async () => {
    const scaffold = scaffoldWithViews('TabPolicyLegacyBox', ['capture-viewer']);
    // VIEW-02 Slice 3 ships the Capture tab policy in the canonical template,
    // so the absence case removes the shipped tabs key explicitly.
    const content = JSON.parse(fs.readFileSync(scaffold.contentPath('capture-viewer'), 'utf8'));
    delete content.tabs;
    writeJson(scaffold.contentPath('capture-viewer'), content);

    const msg = await buildPanelConfig(scaffold.projectPath, 'workspace-123', 'epoch-123');

    expect(msg.tabPolicies).toEqual({});
    expect(Object.isFrozen(msg.tabPolicies)).toBe(true);
    expect(msg.panelRoots).toHaveProperty('capture-viewer');
    expect(msg.viewCapsules).toMatchObject({ version: 1, workspaceId: 'workspace-123' });
    expect(msg.viewRegistryUnavailable).toBeUndefined();
  });

  test('a valid tabs config projects the exact normalized ready policy', async () => {
    const scaffold = scaffoldWithViews('TabPolicyReadyBox', ['capture-viewer']);
    writeJson(scaffold.contentPath('capture-viewer'), {
      version: 1,
      dataSource: 'Captures',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Captures' },
      tabs: captureTabsPolicy(),
    });

    const msg = await buildPanelConfig(scaffold.projectPath, 'workspace-123', 'epoch-123');

    expect(msg.tabPolicies).toEqual({
      'capture-viewer': {
        schemaVersion: 1,
        status: 'ready',
        policy: captureTabsPolicy(),
      },
    });
    expect(Object.isFrozen(msg.tabPolicies)).toBe(true);
    expect(Object.isFrozen(msg.tabPolicies['capture-viewer'])).toBe(true);
    expect(Object.isFrozen(msg.tabPolicies['capture-viewer'].policy)).toBe(true);
    expect(msg.panelRoots).toHaveProperty('capture-viewer');
    expect(msg.viewRegistryUnavailable).toBeUndefined();
  });

  test('each malformed present tabs value degrades only that view to the bounded unavailable entry', async () => {
    const scaffold = scaffoldWithViews('TabPolicyDegradedBox', ['capture-viewer']);
    const malformedValues = [
      null,
      5,
      'tabs',
      {},
      { ...captureTabsPolicy(), schemaVersion: 2 },
      { ...captureTabsPolicy(), extra: true },
      { ...captureTabsPolicy(), plus: { enabled: 'yes' } },
      { ...captureTabsPolicy(), initial: { kind: 'launcher', launcherId: 'side.chat' } },
      { ...captureTabsPolicy(), empty: { ...captureTabsPolicy().empty, launcherIds: ['file.open'] } },
      { ...captureTabsPolicy(), newTab: { ...captureTabsPolicy().newTab, blankKind: 'blank' } },
      { ...captureTabsPolicy(), newTab: { ...captureTabsPolicy().newTab, autoOpenDrawer: 'yes' } },
    ];

    for (const tabs of malformedValues) {
      writeJson(scaffold.contentPath('capture-viewer'), {
        version: 1,
        dataSource: 'Captures',
        root: { type: 'workspace-relative', path: 'ai/${machine}/Captures' },
        tabs,
      });

      const msg = await buildPanelConfig(scaffold.projectPath, 'workspace-123', 'epoch-123');

      expect(msg.tabPolicies).toEqual({
        'capture-viewer': {
          schemaVersion: 1,
          status: 'unavailable',
          code: TAB_POLICY_UNAVAILABLE_CODE,
        },
      });
      expect(TAB_POLICY_UNAVAILABLE_CODE).toBe('tab_configuration_unavailable');
      // The view stays discoverable and the rest of the frame is intact.
      expect(msg.panelRoots).toHaveProperty('capture-viewer');
      expect(msg.viewCapsules).toMatchObject({ version: 1, workspaceId: 'workspace-123' });
      expect(msg.viewRegistryUnavailable).toBeUndefined();
    }
  });

  test('mixed views project per-view ready policies for their own catalog ids', async () => {
    const scaffold = scaffoldWithViews('TabPolicyMixedBox', ['capture-viewer', 'file-viewer']);
    writeJson(scaffold.contentPath('capture-viewer'), {
      version: 1,
      dataSource: 'Captures',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Captures' },
      tabs: captureTabsPolicy(),
    });
    writeJson(scaffold.contentPath('file-viewer'), {
      version: 1,
      dataSource: 'project-root',
      root: { type: 'project-root' },
      tabs: {
        schemaVersion: 1,
        initial: { kind: 'empty' },
        plus: { enabled: true },
        empty: {
          tabLabel: 'New File Tab',
          locationLabel: 'New File Tab',
          launcherIds: ['file.open'],
        },
        location: {
          omitTerminalNames: [],
          historyControls: 'none',
        },
        newTab: {
          blankKind: 'empty',
          autoOpenDrawer: true,
        },
      },
    });

    const msg = await buildPanelConfig(scaffold.projectPath, 'workspace-123', 'epoch-123');

    expect(Object.keys(msg.tabPolicies).sort()).toEqual(['capture-viewer', 'file-viewer']);
    expect(msg.tabPolicies['capture-viewer']).toEqual({
      schemaVersion: 1,
      status: 'ready',
      policy: captureTabsPolicy(),
    });
    expect(msg.tabPolicies['file-viewer']).toEqual({
      schemaVersion: 1,
      status: 'ready',
      policy: {
        schemaVersion: 1,
        initial: { kind: 'empty' },
        plus: { enabled: true },
        empty: {
          tabLabel: 'New File Tab',
          locationLabel: 'New File Tab',
          launcherIds: ['file.open'],
        },
        location: { omitTerminalNames: [], historyControls: 'none' },
        newTab: { blankKind: 'empty', autoOpenDrawer: true },
      },
    });
    expect(msg.panelRoots).toHaveProperty('capture-viewer');
    expect(msg.panelRoots).toHaveProperty('file-viewer');
  });

  test('a pre-§7 tabs config without newTab projects the total default newTab record', async () => {
    const scaffold = scaffoldWithViews('TabPolicyLegacyNewTabBox', ['capture-viewer']);
    const legacyTabs = captureTabsPolicy();
    delete legacyTabs.newTab;
    writeJson(scaffold.contentPath('capture-viewer'), {
      version: 1,
      dataSource: 'Captures',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Captures' },
      tabs: legacyTabs,
    });

    const msg = await buildPanelConfig(scaffold.projectPath, 'workspace-123', 'epoch-123');

    expect(msg.tabPolicies).toEqual({
      'capture-viewer': {
        schemaVersion: 1,
        status: 'ready',
        policy: {
          ...legacyTabs,
          newTab: { blankKind: 'empty', autoOpenDrawer: false },
        },
      },
    });
  });

  test('a whole-file malformed content.json still degrades to viewRegistryUnavailable', async () => {
    const scaffold = scaffoldWithViews('TabPolicyWholeFileBox', ['capture-viewer']);
    fs.mkdirSync(path.dirname(scaffold.contentPath('capture-viewer')), { recursive: true });
    fs.writeFileSync(scaffold.contentPath('capture-viewer'), '{ this is not json', 'utf8');

    const msg = await buildPanelConfig(scaffold.projectPath, 'workspace-123', 'epoch-123');

    expect(msg).toEqual({
      type: 'panel_config',
      projectRoot: scaffold.projectPath,
      projectName: path.basename(scaffold.projectPath),
      workspaceId: 'workspace-123',
      workspaceEpoch: 'epoch-123',
      viewRegistryUnavailable: { code: 'view_registry_unavailable' },
    });
  });

  test('direct projection builds the frozen path-free map from strict discovery', async () => {
    const scaffold = scaffoldWithViews('TabPolicyDirectBox', ['capture-viewer']);
    writeJson(scaffold.contentPath('capture-viewer'), {
      version: 1,
      dataSource: 'Captures',
      root: { type: 'workspace-relative', path: 'ai/${machine}/Captures' },
      tabs: captureTabsPolicy(),
    });

    const projection = views.buildTabPoliciesProjection(
      scaffold.projectPath,
      views.listViews(scaffold.projectPath),
    );

    expect(JSON.stringify(projection)).not.toContain(`${path.sep}ai${path.sep}`);
    expect(projection).toEqual({
      'capture-viewer': { schemaVersion: 1, status: 'ready', policy: captureTabsPolicy() },
    });
    expect(Object.isFrozen(projection)).toBe(true);
  });
});
