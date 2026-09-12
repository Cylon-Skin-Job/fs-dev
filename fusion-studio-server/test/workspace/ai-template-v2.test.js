'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const createService = require('../../lib/workspace/create-service');
const aiPaths = require('../../lib/workspace/ai-paths');
const views = require('../../lib/views');
const readiness = require('../../lib/views/readiness-runtime');
const cliConfig = require('../../lib/cli-config');
const themesService = require('../../lib/theme/themes-service');
const viewStateResolver = require('../../lib/view-state/resolver');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function scaffoldProject(options) {
  const machineIdentity = aiPaths.sanitizeMachineName(options.machineName || aiPaths.getLocalMachineName());
  const leaseFor = (projectRoot) => Object.freeze({
    phase: 'journal_verified',
    verified: true,
    projectRoot: path.resolve(projectRoot),
    viewsRoot: aiPaths.getMachineViewsRoot(projectRoot, machineIdentity),
    complete: () => true,
    release() {},
  });
  readiness.installViewReadinessOwner({
    ensureReady: async () => ({ status: 'verified', verified: true }),
    acquireLease: ({ projectRoot }) => leaseFor(projectRoot),
    acquireViewlessScaffoldLease: ({ projectRoot, machineIdentity: requestedMachine }) => {
      if (requestedMachine !== machineIdentity) {
        const error = new Error('View registry unavailable');
        error.code = 'view_registry_unavailable';
        throw error;
      }
      return leaseFor(projectRoot);
    },
    getStatus: () => ({ status: 'ready', verified: true }),
  });
  return createService.scaffoldProject(options);
}

describe('AI workspace template v2 smoke', () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-ai-template-v2-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('canonical template no longer exposes transitional legacy roots', () => {
    const templateRoot = createService.getAiTemplateRoot();

    expect(fs.existsSync(path.join(templateRoot, 'Views'))).toBe(false);
    expect(fs.existsSync(path.join(templateRoot, 'ai'))).toBe(false);
    expect(fs.existsSync(path.join(templateRoot, 'templates', 'views'))).toBe(false);
    expect(fs.existsSync(path.join(templateRoot, 'templates', 'workspaces'))).toBe(false);
    expect(fs.existsSync(path.join(templateRoot, 'templates', 'view-templates'))).toBe(true);
    expect(fs.existsSync(path.join(templateRoot, 'templates', 'workspace-templates'))).toBe(true);
  });

  test('active template markdown contains no shorthand legacy Views paths', () => {
    const templateRoot = createService.getAiTemplateRoot();
    const stale = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.versions' || entry.name === 'Issues') continue;
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(candidate);
        else if (entry.isFile() && /\.(?:md|txt)$/i.test(entry.name)) {
          const source = fs.readFileSync(candidate, 'utf8');
          if (/(?<![A-Za-z0-9_/])Views\//.test(source)) {
            stale.push(path.relative(templateRoot, candidate));
          }
        }
      }
    };
    visit(templateRoot);
    expect(stale).toEqual([]);
  });

  test('scaffolds selected views under ai/<machine>/System/Views with compact prefixes', () => {
    const projectPath = path.join(tempRoot, 'demo');

    const result = scaffoldProject({
      projectPath,
      machineName: 'RC Test Mac',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    const machineRoot = path.join(projectPath, 'ai', 'RC-Test-Mac');
    expect(result.machineName).toBe('RC-Test-Mac');
    expect(result.selectedViews.map((view) => view.viewPath)).toEqual([
      path.relative(projectPath, path.join(machineRoot, 'System', 'Views', '001-wiki-viewer')),
      path.relative(projectPath, path.join(machineRoot, 'System', 'Views', '002-file-viewer')),
      path.relative(projectPath, path.join(machineRoot, 'System', 'Views', '003-agents-viewer')),
      path.relative(projectPath, path.join(machineRoot, 'System', 'Views', '004-issues-viewer')),
    ]);
    expect(fs.existsSync(path.join(machineRoot, 'System'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Wiki'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Issues'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Agents'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Captures'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'Office'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '001-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '003-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '005-browser-viewer'))).toBe(false);

    const mirrorDbPath = path.join(machineRoot, 'Data', 'Workspace-db', 'workspace.db');
    expect(fs.existsSync(mirrorDbPath)).toBe(true);
    const db = new Database(mirrorDbPath, { readonly: true });
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
      expect(tables).toEqual(expect.arrayContaining([
        'mirror_metadata',
        'runs',
        'chatlogs',
        'universal_event_ledger',
        'file_versioning',
      ]));
      expect(db.prepare("SELECT value FROM mirror_metadata WHERE key = 'schema_version'").get()).toEqual({ value: '1' });
    } finally {
      db.close();
    }
  });

  test('uses templates/workspace-templates/new as the default view profile', () => {
    const projectPath = path.join(tempRoot, 'default-profile');

    const result = scaffoldProject({
      projectPath,
      machineName: 'Default Box',
    });

    const machineRoot = path.join(projectPath, 'ai', 'Default-Box');
    expect(result.workspaceTemplate).toMatchObject({
      id: 'new',
      selectedViewIds: ['capture-viewer', 'file-viewer', 'wiki-viewer', 'issues-viewer', 'agents-viewer'],
    });
    expect(result.manifest.viewTemplatesRoot).toBe('System_Manager/ai-template/templates/view-templates');
    expect(views.listViews(projectPath)).toEqual([]);

    process.env.FUSION_LOCAL_MACHINE = 'Default Box';
    try {
      expect(views.listViews(projectPath)).toEqual([
        'capture-viewer',
        'file-viewer',
        'wiki-viewer',
        'issues-viewer',
        'agents-viewer',
      ]);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
    expect(fs.existsSync(path.join(machineRoot, 'Captures'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Wiki'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Issues'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Agents'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Office'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '001-capture-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.readdirSync(path.join(machineRoot, 'System', 'Views')).some((name) => name.endsWith('-office-viewer'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'Prompts'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'Scripts'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'Tools'))).toBe(false);
  });

  test('exposes workspace templates in the v2 create manifest', () => {
    const manifest = createService.readManifest();
    const templatesById = new Map(manifest.workspaceTemplates.map((profile) => [profile.id, profile]));

    expect(manifest.viewTemplatesRoot).toBe('System_Manager/ai-template/templates/view-templates');
    expect(templatesById.get('new')).toMatchObject({
      category: 'new',
      selectedViewIds: ['capture-viewer', 'file-viewer', 'wiki-viewer', 'issues-viewer', 'agents-viewer'],
    });
    expect(templatesById.get('fusion-home')).toMatchObject({
      category: 'startup',
      selectedViewIds: ['office-viewer', 'file-viewer', 'issues-viewer', 'wiki-viewer', 'agents-viewer'],
    });
    expect(templatesById.get('media-studio')).toBeTruthy();
    expect(templatesById.get('invoicing-and-expenses')).toBeTruthy();
    expect(templatesById.get('system-source-files')).toBeTruthy();
  });

  test('template validation rejects duplicate direct manifest identity keys', () => {
    const captureManifest = path.join(
      createService.getAiTemplateViewsRoot(), '002-capture-viewer', 'manifest.md',
    );
    const readFileSync = fs.readFileSync.bind(fs);
    const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, ...args) => {
      if (path.resolve(String(filePath)) === path.resolve(captureManifest)) {
        return '---\nmetadata:\n  view-id: capture-viewer\n  view-id: file-viewer\n---\n';
      }
      return readFileSync(filePath, ...args);
    });
    try {
      expect(() => createService.readManifest()).toThrow('duplicate YAML mapping key');
    } finally {
      readSpy.mockRestore();
    }
  });

  test('reads startup workspace template profiles separately from new', () => {
    expect(createService.readWorkspaceTemplate('fusion-home')).toMatchObject({
      id: 'fusion-home',
      category: 'startup',
      selectedViewIds: ['office-viewer', 'file-viewer', 'issues-viewer', 'wiki-viewer', 'agents-viewer'],
    });
    expect(createService.readWorkspaceTemplate('media-studio')).toMatchObject({
      id: 'media-studio',
      category: 'startup',
    });
    expect(createService.readWorkspaceTemplate('invoicing-and-expenses')).toMatchObject({
      id: 'invoicing-and-expenses',
      label: 'Invoicing and Expenses',
      category: 'startup',
    });
  });

  test('scaffolds startup workspace templates by id', () => {
    const projectPath = path.join(tempRoot, 'fusion-home-profile');

    const result = scaffoldProject({
      projectPath,
      machineName: 'Startup Box',
      workspaceTemplateId: 'fusion-home',
    });

    const machineRoot = path.join(projectPath, 'ai', 'Startup-Box');
    expect(result.workspaceTemplate).toMatchObject({
      id: 'fusion-home',
      category: 'startup',
    });
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '001-office-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '003-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Office'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Captures'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('rejects unknown workspace template ids', () => {
    expect(() => scaffoldProject({
      projectPath: path.join(tempRoot, 'unknown-profile'),
      machineName: 'Unknown Box',
      workspaceTemplateId: 'does-not-exist',
    })).toThrow('Unknown workspace template: does-not-exist');
  });

  test('rejects a scaffold machine outside the exact readiness lease before filesystem effects', () => {
    const projectPath = path.join(tempRoot, 'wrong-readiness-machine');
    scaffoldProject({ projectPath: path.join(tempRoot, 'owner-seed'), machineName: 'Expected-Machine' });

    expect(() => createService.scaffoldProject({
      projectPath,
      machineName: 'Other-Machine',
    })).toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
    expect(fs.existsSync(projectPath)).toBe(false);
  });

  test('discovers v2 views by filesystem prefix order and resolves top-level data roots', () => {
    const projectPath = path.join(tempRoot, 'demo');
    scaffoldProject({
      projectPath,
      machineName: 'SmokeBox',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'SmokeBox';
    try {
      expect(views.listViews(projectPath)).toEqual([
        'wiki-viewer',
        'file-viewer',
        'agents-viewer',
        'issues-viewer',
      ]);
      expect(views.loadView(projectPath, 'wiki-viewer')).toMatchObject({
        id: 'wiki-viewer',
        index: {
          label: 'Wiki',
          icon: 'full_coverage',
          type: 'wiki',
        },
        v2: true,
      });
      const machineRoot = path.join(projectPath, 'ai', 'SmokeBox');
      expect(readJson(path.join(machineRoot, 'System', 'Views', '001-wiki-viewer', 'content.json'))).toMatchObject({
        dataSource: 'Wiki',
        root: {
          type: 'workspace-relative',
          path: 'ai/${machine}/Wiki',
        },
      });
      expect(views.loadContentConfig(projectPath, 'wiki-viewer')).toMatchObject({
        dataSource: 'Wiki',
        root: {
          type: 'workspace-relative',
          path: 'ai/${machine}/Wiki',
        },
      });
      expect(views.resolveContentPath(projectPath, 'wiki-viewer')).toBe(path.join(projectPath, 'ai', 'SmokeBox', 'Wiki'));
      expect(views.resolveContentPath(projectPath, 'file-viewer')).toBe(projectPath);

      fs.rmSync(path.join(machineRoot, 'System', 'Views', '001-wiki-viewer', 'content.json'));
      expect(views.resolveContentPath(projectPath, 'wiki-viewer')).toBe(path.join(projectPath, 'ai', 'SmokeBox', 'Wiki'));
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('resolves v2 content roots from editable capsule content.json', () => {
    const projectPath = path.join(tempRoot, 'editable-content-root');
    scaffoldProject({
      projectPath,
      machineName: 'SharedWikiBox',
      viewIds: ['wiki-viewer', 'file-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'SharedWikiBox';
    try {
      const contentPath = path.join(projectPath, 'ai', 'SharedWikiBox', 'System', 'Views', '001-wiki-viewer', 'content.json');

      writeJson(contentPath, {
        version: 1,
        dataSource: 'Wiki',
        root: {
          type: 'workspace-relative',
          path: 'shared/wiki',
        },
      });
      expect(views.resolveContentPath(projectPath, 'wiki-viewer')).toBe(path.join(projectPath, 'shared', 'wiki'));

      writeJson(contentPath, {
        version: 1,
        dataSource: 'Wiki',
        root: {
          type: 'workspace-relative',
          path: '../shared/wiki',
        },
      });
      expect(() => views.resolveContentPath(projectPath, 'wiki-viewer')).toThrow('View content root escapes workspace for wiki-viewer');
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('mutates v2 view order by renaming prefixed folders', () => {
    const projectPath = path.join(tempRoot, 'demo');
    scaffoldProject({
      projectPath,
      machineName: 'MoveBox',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'MoveBox';
    try {
      views.updateWorkspaceViewRegistry(projectPath, {
        viewId: 'file-viewer',
        move: 'up',
      });

      expect(views.listViews(projectPath)).toEqual([
        'file-viewer',
        'wiki-viewer',
        'agents-viewer',
        'issues-viewer',
      ]);
      const viewsRoot = path.join(projectPath, 'ai', 'MoveBox', 'System', 'Views');
      expect(fs.existsSync(path.join(viewsRoot, '002-wiki-viewer', 'state', 'state.json'))).toBe(true);
      expect(fs.existsSync(path.join(viewsRoot, '003-agents-viewer', 'state', 'state.json'))).toBe(true);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('hides and restores v2 view shells without deleting folders', () => {
    const projectPath = path.join(tempRoot, 'demo');
    scaffoldProject({
      projectPath,
      machineName: 'AddBox',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'AddBox';
    try {
      views.updateWorkspaceViewRegistry(projectPath, {
        viewId: 'issues-viewer',
        patch: { enabled: false },
      });

      const machineRoot = path.join(projectPath, 'ai', 'AddBox');
      expect(views.listViews(projectPath)).toEqual([
        'wiki-viewer',
        'file-viewer',
        'agents-viewer',
      ]);
      expect(fs.existsSync(path.join(machineRoot, 'Issues'))).toBe(true);
      expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-issues-viewer'))).toBe(true);
      expect(readJson(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'state', 'state.json'))).toMatchObject({
        display: { hidden: true },
      });

      views.addWorkspaceView(projectPath, 'issues-viewer');
      expect(views.listViews(projectPath)).toEqual([
        'wiki-viewer',
        'file-viewer',
        'agents-viewer',
        'issues-viewer',
      ]);
      expect(fs.existsSync(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
      expect(readJson(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'state', 'state.json'))).toMatchObject({
        display: { hidden: false },
      });
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('migrates legacy central hidden state into view capsule state on v2 hide/show writes', () => {
    const projectPath = path.join(tempRoot, 'central-hidden-migration');
    scaffoldProject({
      projectPath,
      machineName: 'CentralHideBox',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'CentralHideBox';
    try {
      const machineRoot = path.join(projectPath, 'ai', 'CentralHideBox');
      const systemStatePath = path.join(machineRoot, 'System', 'state', 'state.json');
      fs.mkdirSync(path.dirname(systemStatePath), { recursive: true });
      fs.writeFileSync(systemStatePath, JSON.stringify({
        views: {
          hidden: {
            'agents-viewer': true,
          },
        },
      }, null, 2) + '\n');

      expect(views.listViews(projectPath)).toEqual([
        'wiki-viewer',
        'file-viewer',
        'issues-viewer',
      ]);

      views.updateWorkspaceViewRegistry(projectPath, {
        viewId: 'issues-viewer',
        patch: { enabled: false },
      });

      expect(readJson(path.join(machineRoot, 'System', 'Views', '003-agents-viewer', 'state', 'state.json'))).toMatchObject({
        display: { hidden: true },
      });
      expect(readJson(path.join(machineRoot, 'System', 'Views', '004-issues-viewer', 'state', 'state.json'))).toMatchObject({
        display: { hidden: true },
      });
      expect(readJson(systemStatePath).views).toBeUndefined();
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('resolves v2 system config, styles, and per-view state from machine folder', async () => {
    const projectPath = path.join(tempRoot, 'demo');
    scaffoldProject({
      projectPath,
      machineName: 'PathBox',
      viewIds: ['wiki-viewer', 'file-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'PathBox';
    try {
      expect(cliConfig.workspacePath(projectPath)).toBe(path.join(
        projectPath,
        'ai',
        'PathBox',
        'System',
        'config',
        'cli.json'
      ));
      await expect(cliConfig.loadWorkspaceConfig(projectPath)).resolves.toMatchObject({
        defaultHarness: 'opencode',
      });
      await expect(themesService.list(projectPath)).resolves.toEqual(expect.any(Array));
      expect(viewStateResolver.workspacePath(projectPath)).toBe(path.join(
        projectPath,
        'ai',
        'PathBox',
        'System',
        'state',
        'state.json'
      ));
      expect(viewStateResolver.viewOverridePath(projectPath, 'wiki-viewer')).toBe(path.join(
        projectPath,
        'ai',
        'PathBox',
        'System',
        'Views',
        '001-wiki-viewer',
        'state',
        'state.json'
      ));
      await expect(viewStateResolver.resolveViewState(projectPath, 'wiki-viewer')).resolves.toMatchObject({
        widths: expect.any(Object),
        collapsed: expect.any(Object),
      });
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });
});
