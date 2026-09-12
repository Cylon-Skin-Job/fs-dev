'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const aiPaths = require('../../lib/workspace/ai-paths');
const { isValidWorkspaceRoot } = require('../../lib/workspace/bootstrap-service');

const repositoryRoot = path.resolve(__dirname, '..', '..', '..');

function walkSource(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkSource(target));
    else if (/\.(?:[cm]?js|tsx?)$/.test(entry.name)) files.push(target);
  }
  return files;
}

describe('VIEW-01 view-root path owner', () => {
  test('defines one canonical ordinary root and an isolated migration-only root', () => {
    const projectRoot = path.join(path.sep, 'workspace');
    expect(aiPaths.getCanonicalMachineViewsRoot(projectRoot, 'Test-Machine')).toBe(
      path.join(projectRoot, 'ai', 'Test-Machine', 'System', 'Views'),
    );
    expect(aiPaths.getMigrationSourceViewsRoot(projectRoot, 'Test-Machine')).toBe(
      path.join(projectRoot, 'ai', 'Test-Machine', 'Views'),
    );
    expect(aiPaths.getMachineViewsRoot(projectRoot, 'Test-Machine')).toBe(
      aiPaths.getCanonicalMachineViewsRoot(projectRoot, 'Test-Machine'),
    );
  });

  test('workspace validity follows the canonical current-machine owner', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-root-validity-'));
    const previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'Current-Machine';
    try {
      fs.mkdirSync(aiPaths.getMachineViewsRoot(projectRoot, 'Foreign-Machine'), { recursive: true });
      expect(isValidWorkspaceRoot(projectRoot)).toBe(false);

      fs.mkdirSync(aiPaths.getMachineViewsRoot(projectRoot, 'Current-Machine'), { recursive: true });
      expect(isValidWorkspaceRoot(projectRoot)).toBe(true);
    } finally {
      if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = previousMachine;
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  test('keeps direct Views construction inside path, migration/protection, and Electron authorities', () => {
    const roots = [
      path.join(repositoryRoot, 'fusion-studio-server', 'lib'),
      path.join(repositoryRoot, 'fusion-studio-client', 'electron'),
    ];
    const found = new Set();
    for (const root of roots) {
      for (const file of walkSource(root)) {
        const source = fs.readFileSync(file, 'utf8');
        if (/path\.join\([^\n]*['"]Views['"]/.test(source)) {
          found.add(path.relative(repositoryRoot, file));
        }
      }
    }

    expect([...found].sort()).toEqual([
      'fusion-studio-client/electron/view-capsule-registry.cjs',
      'fusion-studio-client/electron/view-capsule-registry.test.cjs',
      'fusion-studio-server/lib/workspace/ai-paths.js',
    ]);
  });

  test('has no unscoped Electron custom-app legacy construction', () => {
    const source = fs.readFileSync(
      path.join(repositoryRoot, 'fusion-studio-client', 'electron', 'protocol-handler.cjs'),
      'utf8',
    );
    const matches = source.match(/path\.join\(activeWorkspacePath, 'ai', 'views', viewId\)/g) || [];
    expect(matches).toHaveLength(0);
    expect(source).not.toContain("path.join(activeWorkspacePath, 'ai', 'views'");
  });

  test('has no ordinary unscoped ai/views construction outside immutable migrations', () => {
    const roots = [
      path.join(repositoryRoot, 'fusion-studio-server', 'lib'),
      path.join(repositoryRoot, 'fusion-studio-client', 'src'),
      path.join(repositoryRoot, 'fusion-studio-client', 'electron'),
    ];
    const found = [];
    for (const root of roots) {
      for (const file of walkSource(root)) {
        const relative = path.relative(repositoryRoot, file);
        if (relative.startsWith(`fusion-studio-server${path.sep}lib${path.sep}db${path.sep}migrations${path.sep}`)) {
          continue;
        }
        const source = fs.readFileSync(file, 'utf8');
        if (/path\.join\([^\n]*['"]ai['"][^\n]*['"]views['"]|ai\/views\//.test(source)) {
          found.push(relative);
        }
      }
    }
    expect(found).toEqual([]);
  });

  test('state defaults and layout service ignore retired unscoped view bytes', async () => {
    const previousMachine = process.env.FUSION_LOCAL_MACHINE;
    const projectRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-root-owner-')));
    process.env.FUSION_LOCAL_MACHINE = 'Test-Machine';
    try {
      const retiredLayout = path.join(projectRoot, 'ai', 'views', 'example-view', 'settings', 'layout.json');
      fs.mkdirSync(path.dirname(retiredLayout), { recursive: true });
      fs.writeFileSync(retiredLayout, '{"threadListWidth":999}\n');

      const { getDefaults, HARDCODED_DEFAULTS } = require('../../lib/view-state/defaults');
      const layoutService = require('../../lib/theme/layout-service');
      expect(getDefaults(projectRoot, 'example-view')).toBe(HARDCODED_DEFAULTS);
      await expect(layoutService.getLayout(projectRoot, 'example-view')).resolves.toEqual({});
      await expect(layoutService.setLayout(projectRoot, 'example-view', {}))
        .rejects.toThrow(/View capsule is unavailable/u);

      const capsule = path.join(
        projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '001-presentation-name',
      );
      fs.mkdirSync(path.join(capsule, 'styles'), { recursive: true });
      fs.writeFileSync(path.join(capsule, 'manifest.md'), [
        '---',
        'metadata:',
        '  view-id: example-view',
        '---',
        '',
      ].join('\n'));
      fs.writeFileSync(path.join(capsule, 'styles', 'layout.json'), '{"threadListWidth":321}\n');
      fs.mkdirSync(path.join(capsule, 'state'), { recursive: true });
      fs.writeFileSync(path.join(capsule, 'state', 'cli.json'), '{"label":"renamed capsule"}\n');

      expect(getDefaults(projectRoot, 'example-view').widths.leftSidebar).toBe(321);
      const cliLoader = require('../../lib/cli-config/loader');
      await expect(cliLoader.loadViewConfig(projectRoot, 'example-view'))
        .resolves.toEqual({ label: 'renamed capsule' });
      await expect(layoutService.getLayout(projectRoot, 'example-view'))
        .resolves.toEqual({ threadListWidth: 321 });
      await layoutService.setLayout(projectRoot, 'example-view', { threadListWidth: 432 });
      expect(JSON.parse(fs.readFileSync(path.join(capsule, 'styles', 'layout.json'), 'utf8')))
        .toEqual({ threadListWidth: 432 });
      expect(JSON.parse(fs.readFileSync(retiredLayout, 'utf8'))).toEqual({ threadListWidth: 999 });

      const duplicate = path.join(
        projectRoot, 'ai', 'Test-Machine', 'System', 'Views', '002-example-view',
      );
      fs.mkdirSync(path.join(duplicate, 'state'), { recursive: true });
      fs.writeFileSync(path.join(duplicate, 'manifest.md'), [
        '---',
        'metadata:',
        '  view-id: example-view',
        '---',
        '',
      ].join('\n'));
      fs.writeFileSync(path.join(duplicate, 'state', 'cli.json'), '{"label":"duplicate"}\n');
      expect(() => getDefaults(projectRoot, 'example-view')).toThrow(/Duplicate metadata\.view-id/u);
      await expect(cliLoader.loadViewConfig(projectRoot, 'example-view'))
        .rejects.toThrow(/Duplicate metadata\.view-id/u);
    } finally {
      if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = previousMachine;
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
