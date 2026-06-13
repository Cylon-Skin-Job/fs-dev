'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../lib/workspace/create-service', () => ({
  getSystemSourceRoot: jest.fn(),
  getTemplateRoot: jest.fn(),
  readManifest: jest.fn(),
  copyTemplateDirectory: jest.fn(),
}));

const createService = require('../../lib/workspace/create-service');
const views = require('../../lib/views');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function readRegistry(projectRoot) {
  return JSON.parse(fs.readFileSync(views.getWorkspaceRegistryPath(projectRoot), 'utf-8'));
}

function writeRegistry(projectRoot, registry) {
  writeJson(views.getWorkspaceRegistryPath(projectRoot), registry);
}

describe('workspace view registry writer', () => {
  let tempRoot;
  let templateRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-registry-'));
    templateRoot = path.join(tempRoot, 'system', 'view-templates');
    fs.mkdirSync(templateRoot, { recursive: true });
    createService.getTemplateRoot.mockReturnValue(templateRoot);
    createService.getSystemSourceRoot.mockReturnValue(path.join(tempRoot, 'system'));
    createService.readManifest.mockReturnValue({ views: [] });
    createService.copyTemplateDirectory.mockImplementation((source, destination) => {
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(destination, 'index.json'), JSON.stringify({ source }));
    });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  test('validates update patches and keeps one visible view', () => {
    writeRegistry(tempRoot, {
      version: 1,
      views: [
        { id: 'files', label: 'Files', enabled: true },
      ],
    });

    expect(() => views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'files',
      patch: { rank: 2 },
    })).toThrow('Cannot update view field: rank');

    expect(() => views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'files',
      patch: { enabled: false },
    })).toThrow('At least one view must remain visible');

    expect(readRegistry(tempRoot).views[0]).toMatchObject({
      id: 'files',
      enabled: true,
    });
  });

  test('moves enabled views without reordering disabled views into the visible sequence', () => {
    writeRegistry(tempRoot, {
      version: 1,
      views: [
        { id: 'files', label: 'Files', rank: 0, enabled: true },
        { id: 'wiki', label: 'Wiki', rank: 1, enabled: true },
        { id: 'notes', label: 'Notes', rank: 2, enabled: false },
      ],
    });

    const registry = views.updateWorkspaceViewRegistry(tempRoot, {
      viewId: 'wiki',
      move: 'up',
    });

    expect(registry.views.map(view => view.id)).toEqual(['wiki', 'files', 'notes']);
    expect(registry.views.find(view => view.id === 'wiki')).toMatchObject({ rank: 0 });
    expect(registry.views.find(view => view.id === 'files')).toMatchObject({ rank: 1 });
    expect(registry.views.find(view => view.id === 'notes')).toMatchObject({ enabled: false });
  });

  test('restores a hidden workspace view', () => {
    writeRegistry(tempRoot, {
      version: 1,
      views: [
        { id: 'files', label: 'Files', enabled: true },
        { id: 'wiki', label: 'Wiki', enabled: false },
      ],
    });

    const registry = views.restoreWorkspaceView(tempRoot, 'wiki');

    expect(registry.views.find(view => view.id === 'wiki')).toMatchObject({ enabled: true });
    expect(readRegistry(tempRoot).views.find(view => view.id === 'wiki')).toMatchObject({ enabled: true });
  });

  test('rejects add-template requests whose destination escapes ai/views', () => {
    const source = path.join(templateRoot, 'safe-template');
    fs.mkdirSync(source, { recursive: true });
    createService.readManifest.mockReturnValue({
      views: [
        {
          id: '../escape',
          baseViewId: 'escape',
          label: 'Escape',
          templatePath: 'view-templates/safe-template',
        },
      ],
    });
    writeRegistry(tempRoot, { version: 1, views: [] });

    expect(() => views.addWorkspaceView(tempRoot, '../escape')).toThrow('Destination path escapes ai/views');
    expect(createService.copyTemplateDirectory).not.toHaveBeenCalled();
  });

  test('rejects duplicate templates by installed base view id', () => {
    const source = path.join(templateRoot, 'extras');
    fs.mkdirSync(source, { recursive: true });
    createService.readManifest.mockReturnValue({
      views: [
        {
          id: 'extras',
          baseViewId: 'extras',
          label: 'Extras',
          templatePath: 'view-templates/extras',
        },
      ],
    });
    writeRegistry(tempRoot, {
      version: 1,
      views: [
        { id: 'custom-extras', baseViewId: 'extras', label: 'Extras', enabled: true },
      ],
    });

    expect(() => views.addWorkspaceView(tempRoot, 'extras')).toThrow('View template is already installed');
    expect(createService.copyTemplateDirectory).not.toHaveBeenCalled();
  });
});
