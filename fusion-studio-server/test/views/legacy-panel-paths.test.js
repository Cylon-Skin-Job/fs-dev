'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('legacy panel path compatibility', () => {
  let tempRoot;
  let modules;

  beforeEach(() => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-legacy-panel-paths-'));
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
    modules = {
      panelPaths: require('../../lib/views/panel-paths'),
    };
  });

  afterEach(() => {
    modules.panelPaths.sessions.clear();
    delete process.env.FUSION_LOCAL_MACHINE;
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
  });

  function bindProjectRoot(projectRoot) {
    const ws = {};
    modules.panelPaths.sessions.set(ws, { projectRoot });
    return ws;
  }

  test('resolves legacy workspace panel roots when V2 views are absent', () => {
    const projectRoot = path.join(tempRoot, 'legacy-workspace');
    writeJson(path.join(projectRoot, 'ai', 'system', 'workspace', 'views.json'), {
      version: 1,
      views: [{ id: 'wiki-viewer', viewPath: 'ai/views/wiki-viewer' }],
    });
    writeFile(path.join(projectRoot, 'ai', 'system', 'styles', 'themes.css'), ':root {}\n');
    writeJson(path.join(projectRoot, 'ai', 'views', 'file-viewer', 'content.json'), {
      display: 'file-explorer',
    });
    writeJson(path.join(projectRoot, 'ai', 'views', 'wiki-viewer', 'index.json'), {
      id: 'wiki-viewer',
      settings: { contentDir: 'ai/views/wiki-viewer/Wiki' },
    });
    writeJson(path.join(projectRoot, 'ai', 'views', 'wiki-viewer', 'content.json'), {
      display: 'wiki',
    });
    writeFile(path.join(projectRoot, 'ai', 'views', 'wiki-viewer', 'Wiki', '001-Topic', 'PAGE.md'), '# Topic\n');

    const ws = bindProjectRoot(projectRoot);

    expect(modules.panelPaths.getPanelPath('__panels__', ws)).toBe(path.join(projectRoot, 'ai', 'views'));
    expect(modules.panelPaths.getPanelPath('__workspace__', ws)).toBe(path.join(projectRoot, 'ai', 'system', 'workspace'));
    expect(modules.panelPaths.getPanelPath('__settings__', ws)).toBe(path.join(projectRoot, 'ai', 'system', 'styles'));
    expect(modules.panelPaths.getPanelPath('file-viewer', ws)).toBe(projectRoot);
    expect(modules.panelPaths.getPanelPath('wiki-viewer', ws)).toBe(
      path.join(projectRoot, 'ai', 'views', 'wiki-viewer', 'Wiki')
    );
  });

  test('prefers machine-scoped V2 panel roots over legacy roots', () => {
    const projectRoot = path.join(tempRoot, 'mixed-workspace');
    writeFile(path.join(projectRoot, 'ai', 'views', 'wiki-viewer', 'Wiki', 'PAGE.md'), '# Legacy\n');
    writeFile(path.join(projectRoot, 'ai', 'Test-Machine', 'Views', '001-wiki-viewer', 'manifest.md'), [
      '---',
      'view-id: wiki-viewer',
      '---',
      '# Wiki',
      '',
    ].join('\n'));

    const ws = bindProjectRoot(projectRoot);

    expect(modules.panelPaths.getPanelPath('__panels__', ws)).toBe(
      path.join(projectRoot, 'ai', 'Test-Machine', 'Views')
    );
  });
});
