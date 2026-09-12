'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../lib/workspace/create-service', () => ({
  getSystemSourceRoot: jest.fn(),
  getAiTemplateViewsRoot: jest.fn(),
  readManifest: jest.fn(),
  copyTemplateDirectory: jest.fn(),
}));

const createService = require('../../lib/workspace/create-service');
const views = require('../../lib/views');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeV2View(projectRoot, folderName, options = {}) {
  const id = options.id || folderName.replace(/^\d+-/, '');
  const label = options.label || id;
  const icon = options.icon || 'folder';
  const viewRoot = path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views', folderName);
  fs.mkdirSync(path.join(viewRoot, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(viewRoot, 'manifest.md'), `---
name: ${label}
metadata:
  view-id: ${id}
  view-type: ${options.viewType || 'react'}
  data-source: ${options.dataSource || 'none'}
  enabled: true
---
`, 'utf-8');
  fs.writeFileSync(path.join(viewRoot, 'styles', 'icon.md'), `---
name: ${label} Icon
metadata:
  icon-name: ${icon}
---
`, 'utf-8');
  return viewRoot;
}

function writeTemplate(templateRoot, folderName, id, options = {}) {
  const source = path.join(templateRoot, folderName);
  fs.mkdirSync(path.join(source, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(source, 'manifest.md'), `---
name: ${options.label || id}
metadata:
  view-id: ${id}
  view-type: ${options.viewType || 'react'}
  data-source: ${options.dataSource || 'none'}
---
`, 'utf-8');
  fs.writeFileSync(path.join(source, 'styles', 'icon.md'), `---
name: ${options.label || id} Icon
metadata:
  icon-name: ${options.icon || 'folder'}
---
`, 'utf-8');
  return source;
}

describe('workspace view registry writer', () => {
  let tempRoot;
  let systemSourceRoot;
  let aiTemplateViewsRoot;
  let oldFusionLocalMachine;

  beforeEach(async () => {
    oldFusionLocalMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Test Machine';
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-registry-')));
    systemSourceRoot = path.join(tempRoot, 'system');
    aiTemplateViewsRoot = path.join(systemSourceRoot, 'ai-template', 'templates', 'view-templates');
    fs.mkdirSync(aiTemplateViewsRoot, { recursive: true });
    createService.getAiTemplateViewsRoot.mockReturnValue(aiTemplateViewsRoot);
    createService.getSystemSourceRoot.mockReturnValue(systemSourceRoot);
    createService.readManifest.mockReturnValue({ views: [] });
    createService.copyTemplateDirectory.mockImplementation((source, destination) => {
      fs.cpSync(source, destination, { recursive: true });
    });
    fs.mkdirSync(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views'), { recursive: true });
    const readiness = require('../../lib/views/readiness-runtime');
    readiness.installViewReadinessOwner({
      ensureReady: async () => ({ status: 'verified', phase: 'journal_verified', verified: true }),
      acquireLease: () => ({
        phase: 'journal_verified',
        verified: true,
        projectRoot: tempRoot,
        viewsRoot: path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views'),
        release() {},
      }),
      getStatus: () => ({ status: 'ready', verified: true }),
    });
    await readiness.ensureWorkspaceViewReadiness({
      workspaceId: 'workspace-registry-writer-test',
      projectRoot: tempRoot,
    });
  });

  afterEach(() => {
    if (oldFusionLocalMachine == null) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = oldFusionLocalMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  test('validates update patches and keeps one visible v2 view', () => {
    writeV2View(tempRoot, '001-file-viewer', {
      id: 'file-viewer',
      label: 'Files',
    });

    expect(() => views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'file-viewer',
      patch: { rank: 2 },
    })).toThrow('Cannot update v2 view field: rank');

    expect(() => views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'file-viewer',
      patch: { enabled: false },
    })).toThrow('At least one view must remain visible');

    expect(views.listViews(tempRoot)).toEqual(['file-viewer']);
  });

  test('moves enabled v2 views without reordering hidden views into the visible sequence', () => {
    writeV2View(tempRoot, '001-file-viewer', { id: 'file-viewer', label: 'Files' });
    writeV2View(tempRoot, '002-wiki-viewer', { id: 'wiki-viewer', label: 'Wiki' });
    const notesView = writeV2View(tempRoot, '003-notes-viewer', { id: 'notes-viewer', label: 'Notes' });

    views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'notes-viewer',
      patch: { enabled: false },
    });

    const registry = views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'wiki-viewer',
      move: 'up',
    });

    expect(registry.views.map(view => view.id)).toEqual(['wiki-viewer', 'file-viewer', 'notes-viewer']);
    expect(registry.views.find(view => view.id === 'wiki-viewer')).toMatchObject({ rank: 1, enabled: true });
    expect(registry.views.find(view => view.id === 'file-viewer')).toMatchObject({ rank: 2, enabled: true });
    expect(registry.views.find(view => view.id === 'notes-viewer')).toMatchObject({ enabled: false });
    expect(fs.existsSync(notesView)).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-wiki-viewer'))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-file-viewer'))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '003-notes-viewer'))).toBe(true);
  });

  test('updates v2 view labels and icons in the view capsule files', () => {
    const docView = writeV2View(tempRoot, '001-capture-viewer', {
      id: 'capture-viewer',
      label: 'Captures',
      icon: 'open_run',
      dataSource: 'Captures',
    });
    writeV2View(tempRoot, '002-wiki-viewer', {
      id: 'wiki-viewer',
      label: 'Wiki',
      icon: 'full_coverage',
      dataSource: 'Wiki',
    });

    const registry = views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'capture-viewer',
      patch: { label: 'Documents', icon: 'article' },
    });

    expect(registry.views.find((view) => view.id === 'capture-viewer')).toMatchObject({
      label: 'Documents',
      icon: 'article',
    });
    expect(fs.readFileSync(path.join(docView, 'manifest.md'), 'utf-8')).toContain('name: "Documents"');
    expect(fs.readFileSync(path.join(docView, 'styles', 'icon.md'), 'utf-8')).toContain('icon-name: "article"');
  });

  test('quotes and decodes scalar-like or escaped label and icon strings exactly', () => {
    const viewRoot = writeV2View(tempRoot, '001-capture-viewer', {
      id: 'capture-viewer',
      label: 'Captures',
      icon: 'open_run',
    });

    const roundTripValues = [
      '123',
      '0x10',
      '0o10',
      'true',
      'false',
      'null',
      'A"B',
      'C\\D',
      'Line\nBreak',
      'Control\u0000Character',
      '-',
      '- foo',
      'TRUE',
      'NULL',
      '.inf',
      '2026-09-08',
    ];
    for (const value of roundTripValues) {
      const registry = views.updateWorkspaceViewRegistry(tempRoot, {
        viewId: 'capture-viewer',
        patch: { label: value, icon: value },
      });
      expect(registry.views.find((view) => view.id === 'capture-viewer')).toMatchObject({
        label: value,
        icon: value,
      });
      expect(fs.readFileSync(path.join(viewRoot, 'manifest.md'), 'utf-8'))
        .toContain(`name: ${JSON.stringify(value)}`);
      expect(fs.readFileSync(path.join(viewRoot, 'styles', 'icon.md'), 'utf-8'))
        .toContain(`icon-name: ${JSON.stringify(value)}`);
    }
  });

  test('uses v2 styles/icon.md instead of manifest icon metadata', () => {
    writeV2View(tempRoot, '001-capture-viewer', {
      id: 'capture-viewer',
      label: 'Captures',
      icon: 'open_run',
      dataSource: 'Captures',
    });
    writeV2View(tempRoot, '002-wiki-viewer', {
      id: 'wiki-viewer',
      label: 'Wiki',
      icon: 'full_coverage',
      dataSource: 'Wiki',
    });
    createService.readManifest.mockReturnValue({
      views: [
        { id: 'capture-viewer', label: 'Captures', icon: 'description', group: 'default' },
        { id: 'wiki-viewer', label: 'Wiki', icon: 'menu_book', group: 'default' },
      ],
    });

    const registry = views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'capture-viewer',
    });

    expect(registry.views.find((view) => view.id === 'capture-viewer')).toMatchObject({
      label: 'Captures',
      icon: 'open_run',
    });
    expect(registry.views.find((view) => view.id === 'wiki-viewer')).toMatchObject({
      label: 'Wiki',
      icon: 'full_coverage',
    });
  });

  test('hides v2 views through capsule state without deleting the view folder', () => {
    const fileView = writeV2View(tempRoot, '001-file-viewer', {
      id: 'file-viewer',
      label: 'Files',
      icon: 'folder',
    });
    const wikiView = writeV2View(tempRoot, '002-wiki-viewer', {
      id: 'wiki-viewer',
      label: 'Wiki',
      icon: 'menu_book',
      dataSource: 'Wiki',
    });
    createService.readManifest.mockReturnValue({
      views: [
        { id: 'file-viewer', label: 'Files', icon: 'folder', group: 'default' },
        { id: 'wiki-viewer', label: 'Wiki', icon: 'menu_book', group: 'default' },
      ],
    });

    const registry = views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'wiki-viewer',
      patch: { enabled: false },
    });

    expect(fs.existsSync(fileView)).toBe(true);
    expect(fs.existsSync(wikiView)).toBe(true);
    expect(registry.views.find((view) => view.id === 'wiki-viewer')).toMatchObject({ enabled: false });
    expect(views.listViews(tempRoot)).toEqual(['file-viewer']);

    const state = readJson(path.join(wikiView, 'state', 'state.json'));
    expect(state).toMatchObject({ display: { hidden: true } });
    expect(fs.existsSync(path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'state', 'state.json'))).toBe(false);

    const options = views.getWorkspaceViewOptions(tempRoot);
    expect(options.hiddenViews).toEqual([
      { id: 'wiki-viewer', baseViewId: 'wiki-viewer', label: 'Wiki', icon: 'menu_book' },
    ]);
    expect(options.availableTemplates).toEqual([]);
  });

  test('restores a hidden v2 view by updating capsule state only', () => {
    writeV2View(tempRoot, '001-file-viewer', { id: 'file-viewer', label: 'Files' });
    const wikiView = writeV2View(tempRoot, '002-wiki-viewer', { id: 'wiki-viewer', label: 'Wiki', dataSource: 'Wiki' });

    views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'wiki-viewer',
      patch: { enabled: false },
    });
    const registry = views.restoreWorkspaceView(tempRoot, 'wiki-viewer');

    expect(registry.views.find((view) => view.id === 'wiki-viewer')).toMatchObject({ enabled: true });
    expect(views.listViews(tempRoot)).toEqual(['file-viewer', 'wiki-viewer']);
    const state = readJson(path.join(wikiView, 'state', 'state.json'));
    expect(state).toMatchObject({ display: { hidden: false } });
  });

  test('adds optional templates into the machine-scoped Views folder', () => {
    writeV2View(tempRoot, '001-file-viewer', { id: 'file-viewer', label: 'Files' });
    const source = writeTemplate(aiTemplateViewsRoot, '008-browser-viewer', 'browser-viewer', {
      label: 'Browser',
      icon: 'public',
    });
    createService.readManifest.mockReturnValue({
      views: [
        {
          id: 'browser-viewer',
          baseViewId: 'browser-viewer',
          label: 'Browser',
          icon: 'public',
          templatePath: path.relative(systemSourceRoot, source),
        },
      ],
    });

    const registry = views.addWorkspaceView(tempRoot, 'browser-viewer');
    const destination = path.join(tempRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-browser-viewer');

    expect(createService.copyTemplateDirectory).toHaveBeenCalledWith(source, destination);
    expect(fs.existsSync(path.join(destination, 'manifest.md'))).toBe(true);
    expect(registry.views.map((view) => view.id)).toEqual(['file-viewer', 'browser-viewer']);
  });

  test('rejects duplicate v2 templates by installed view id', () => {
    writeV2View(tempRoot, '001-extras-viewer', { id: 'extras-viewer', label: 'Extras' });
    const source = writeTemplate(aiTemplateViewsRoot, '014-extras-viewer', 'extras-viewer', {
      label: 'Extras',
    });
    createService.readManifest.mockReturnValue({
      views: [
        {
          id: 'extras-viewer',
          baseViewId: 'extras-viewer',
          label: 'Extras',
          templatePath: path.relative(systemSourceRoot, source),
        },
      ],
    });

    expect(() => views.addWorkspaceView(tempRoot, 'extras-viewer')).toThrow('View template is already installed');
    expect(createService.copyTemplateDirectory).not.toHaveBeenCalled();
  });

  test('rejects noncanonical template manifest identities without rewriting them', () => {
    writeV2View(tempRoot, '001-file-viewer', { id: 'file-viewer', label: 'Files' });
    createService.readManifest.mockReturnValue({
      views: [{ id: ' Browser-Viewer ', label: 'Browser' }],
    });

    expect(() => views.getWorkspaceViewOptions(tempRoot)).toThrow('invalid metadata.view-id');
  });

  test('registry reads reject duplicate direct manifest identity keys', () => {
    const viewRoot = writeV2View(tempRoot, '001-file-viewer', {
      id: 'file-viewer',
      label: 'Files',
    });
    fs.writeFileSync(
      path.join(viewRoot, 'manifest.md'),
      '---\nmetadata:\n  view-id: file-viewer\n  view-id: capture-viewer\n---\n',
    );
    expect(() => views.getWorkspaceViewOptions(tempRoot)).toThrow('invalid metadata.view-id');
  });

  test.each([
    ['decimal', 123, '123'],
    ['hexadecimal', 16, '0x10'],
    ['octal', 8, '0o10'],
  ])('rejects %s numeric template identities while accepting the quoted-string result', (_kind, numericId, stringId) => {
    writeV2View(tempRoot, '001-file-viewer', { id: 'file-viewer', label: 'Files' });
    createService.readManifest.mockReturnValue({ views: [{ id: numericId, label: 'Numeric' }] });
    expect(() => views.getWorkspaceViewOptions(tempRoot)).toThrow('invalid metadata.view-id');

    createService.readManifest.mockReturnValue({ views: [{ id: stringId, label: 'Quoted' }] });
    expect(() => views.getWorkspaceViewOptions(tempRoot)).not.toThrow();
  });
});
