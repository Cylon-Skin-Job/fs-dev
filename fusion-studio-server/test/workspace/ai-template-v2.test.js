'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const createService = require('../../lib/workspace/create-service');
const views = require('../../lib/views');
const cliConfig = require('../../lib/cli-config');
const themesService = require('../../lib/theme/themes-service');
const viewStateResolver = require('../../lib/view-state/resolver');

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

  test('scaffolds selected views under ai/<machine>/Views with compact prefixes', () => {
    const projectPath = path.join(tempRoot, 'demo');

    const result = createService.scaffoldProject({
      projectPath,
      machineName: 'RC Test Mac',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    const machineRoot = path.join(projectPath, 'ai', 'RC-Test-Mac');
    expect(result.machineName).toBe('RC-Test-Mac');
    expect(fs.existsSync(path.join(machineRoot, 'System'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Wiki'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Issues'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-browser-viewer'))).toBe(false);

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

    const result = createService.scaffoldProject({
      projectPath,
      machineName: 'Default Box',
    });

    const machineRoot = path.join(projectPath, 'ai', 'Default-Box');
    expect(result.workspaceTemplate).toMatchObject({
      id: 'new',
      selectedViewIds: ['file-viewer', 'wiki-viewer', 'issues-viewer', 'agents-viewer'],
    });
    expect(result.manifest.viewTemplatesRoot).toBe('System_Manager/ai-template/templates/view-templates');
    expect(views.listViews(projectPath)).toEqual([]);

    process.env.FUSION_LOCAL_MACHINE = 'Default Box';
    try {
      expect(views.listViews(projectPath)).toEqual([
        'file-viewer',
        'issues-viewer',
        'wiki-viewer',
        'agents-viewer',
      ]);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-office-viewer'))).toBe(false);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('exposes workspace templates in the v2 create manifest', () => {
    const manifest = createService.readManifest();
    const templatesById = new Map(manifest.workspaceTemplates.map((profile) => [profile.id, profile]));

    expect(manifest.viewTemplatesRoot).toBe('System_Manager/ai-template/templates/view-templates');
    expect(templatesById.get('new')).toMatchObject({
      category: 'new',
      selectedViewIds: ['file-viewer', 'wiki-viewer', 'issues-viewer', 'agents-viewer'],
    });
    expect(templatesById.get('fusion-home')).toMatchObject({
      category: 'startup',
      selectedViewIds: ['office-viewer', 'file-viewer', 'issues-viewer', 'wiki-viewer', 'agents-viewer'],
    });
    expect(templatesById.get('media-studio')).toBeTruthy();
    expect(templatesById.get('invoicing-and-expenses')).toBeTruthy();
    expect(templatesById.get('system-source-files')).toBeTruthy();
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

    const result = createService.scaffoldProject({
      projectPath,
      machineName: 'Startup Box',
      workspaceTemplateId: 'fusion-home',
    });

    const machineRoot = path.join(projectPath, 'ai', 'Startup-Box');
    expect(result.workspaceTemplate).toMatchObject({
      id: 'fusion-home',
      category: 'startup',
    });
    expect(fs.existsSync(path.join(machineRoot, 'Views', '001-office-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '002-file-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '003-issues-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '004-wiki-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'Views', '005-agents-viewer', 'manifest.md'))).toBe(true);
    expect(fs.existsSync(path.join(machineRoot, 'templates'))).toBe(false);
  });

  test('rejects unknown workspace template ids', () => {
    expect(() => createService.scaffoldProject({
      projectPath: path.join(tempRoot, 'unknown-profile'),
      machineName: 'Unknown Box',
      workspaceTemplateId: 'does-not-exist',
    })).toThrow('Unknown workspace template: does-not-exist');
  });

  test('discovers v2 views by filesystem prefix order and resolves top-level data roots', () => {
    const projectPath = path.join(tempRoot, 'demo');
    createService.scaffoldProject({
      projectPath,
      machineName: 'SmokeBox',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'SmokeBox';
    try {
      expect(views.listViews(projectPath)).toEqual([
        'file-viewer',
        'issues-viewer',
        'wiki-viewer',
        'agents-viewer',
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
      expect(views.resolveContentPath(projectPath, 'wiki-viewer')).toBe(path.join(projectPath, 'ai', 'SmokeBox', 'Wiki'));
      expect(views.resolveContentPath(projectPath, 'file-viewer')).toBe(projectPath);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('mutates v2 view order by renaming prefixed folders', () => {
    const projectPath = path.join(tempRoot, 'demo');
    createService.scaffoldProject({
      projectPath,
      machineName: 'MoveBox',
      viewIds: ['wiki-viewer', 'file-viewer', 'agents-viewer', 'issues-viewer'],
    });

    process.env.FUSION_LOCAL_MACHINE = 'MoveBox';
    try {
      views.updateWorkspaceViewRegistry(projectPath, {
        viewId: 'wiki-viewer',
        move: 'up',
      });

      expect(views.listViews(projectPath)).toEqual([
        'file-viewer',
        'wiki-viewer',
        'issues-viewer',
        'agents-viewer',
      ]);
      const viewsRoot = path.join(projectPath, 'ai', 'MoveBox', 'Views');
      expect(fs.existsSync(path.join(viewsRoot, '002-wiki-viewer', 'state', 'state.json'))).toBe(true);
      expect(fs.existsSync(path.join(viewsRoot, '003-issues-viewer', 'state', 'state.json'))).toBe(true);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('removes and re-adds v2 view shells without deleting top-level data folders', () => {
    const projectPath = path.join(tempRoot, 'demo');
    createService.scaffoldProject({
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
        'file-viewer',
        'wiki-viewer',
        'agents-viewer',
      ]);
      expect(fs.existsSync(path.join(machineRoot, 'Issues'))).toBe(true);
      expect(fs.existsSync(path.join(machineRoot, 'Views', '002-issues-viewer'))).toBe(false);

      views.addWorkspaceView(projectPath, 'issues-viewer');
      expect(views.listViews(projectPath)).toEqual([
        'file-viewer',
        'wiki-viewer',
        'agents-viewer',
        'issues-viewer',
      ]);
      expect(fs.existsSync(path.join(machineRoot, 'Views', '004-issues-viewer', 'manifest.md'))).toBe(true);
    } finally {
      delete process.env.FUSION_LOCAL_MACHINE;
    }
  });

  test('resolves v2 system config, styles, and per-view state from machine folder', async () => {
    const projectPath = path.join(tempRoot, 'demo');
    createService.scaffoldProject({
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
        'Views',
        '002-wiki-viewer',
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
