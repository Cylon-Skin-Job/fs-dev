'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('protected theme and generated CSS destinations', () => {
  let root;
  let protectedStyles;
  let themesFile;
  let themesService;
  let createThemeHandlers;

  beforeEach(() => {
    jest.resetModules();
    process.env.FUSION_LOCAL_MACHINE = 'Test Machine';
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-protected-theme-'));
    protectedStyles = path.join(
      root, 'ai', 'Test-Machine', 'System', 'Views', '001-capture', 'styles',
    );
    themesFile = path.join(protectedStyles, 'themes.json');
    fs.mkdirSync(protectedStyles, { recursive: true });
    fs.writeFileSync(themesFile, JSON.stringify({
      version: '1.0',
      schema: '2.0',
      themes: [{ id: 'base', name: 'Base', active: true, builtin: true, accent: '#112233' }],
    }));
    const systemRoot = path.join(root, 'ai', 'Test-Machine', 'System');
    fs.mkdirSync(systemRoot, { recursive: true });
    fs.symlinkSync(protectedStyles, path.join(systemRoot, 'styles'), 'dir');
    themesService = require('../../lib/theme/themes-service');
    createThemeHandlers = require('../../lib/ws/theme-handlers');
  });

  afterEach(() => {
    delete process.env.FUSION_LOCAL_MACHINE;
    fs.rmSync(root, { recursive: true, force: true });
    jest.resetModules();
  });

  test('public theme:save denies a capsule alias without temp or final effects', async () => {
    const ws = {
      readyState: 1,
      sent: [],
      send(value) { this.sent.push(JSON.parse(value)); },
    };
    const handlers = createThemeHandlers({ getAllClients: () => [ws], getProjectRoot: () => root });
    const before = fs.readFileSync(themesFile, 'utf8');

    await handlers['theme:save'](ws, {
      type: 'theme:save',
      theme: { id: 'blocked', name: 'Blocked', active: false, accent: '#445566' },
    });

    expect(ws.sent).toEqual([expect.objectContaining({ type: 'theme:error' })]);
    expect(fs.readFileSync(themesFile, 'utf8')).toBe(before);
    expect(fs.readdirSync(protectedStyles)).toEqual(['themes.json']);
  });

  test('generated CSS refresh denies a capsule alias without a sidecar write', async () => {
    await expect(themesService.generateCss(root, 'base'))
      .rejects.toMatchObject({ code: 'PROTECTED_VIEW_PATH' });

    expect(fs.existsSync(path.join(protectedStyles, 'themes.css'))).toBe(false);
    expect(fs.readdirSync(protectedStyles)).toEqual(['themes.json']);
  });

  test('ordinary theme JSON and generated CSS writes remain functional', async () => {
    const stylesRoot = path.join(root, 'ai', 'Test-Machine', 'System', 'styles');
    fs.unlinkSync(stylesRoot);
    fs.mkdirSync(stylesRoot, { recursive: true });
    fs.writeFileSync(path.join(stylesRoot, 'themes.json'), fs.readFileSync(themesFile));

    await themesService.save(root, {
      id: 'ordinary', name: 'Ordinary', active: false, accent: '#445566',
    });
    await themesService.generateCss(root, 'base');

    const stored = JSON.parse(fs.readFileSync(path.join(stylesRoot, 'themes.json'), 'utf8'));
    expect(stored.themes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ordinary', name: 'Ordinary' }),
    ]));
    expect(fs.readFileSync(path.join(stylesRoot, 'themes.css'), 'utf8')).toContain(':root');
  });
});
