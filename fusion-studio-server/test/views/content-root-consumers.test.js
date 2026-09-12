'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const createService = require('../../lib/workspace/create-service');
const aiPaths = require('../../lib/workspace/ai-paths');
const wikiTree = require('../../lib/wiki/wiki-tree');
const { createRunFolder } = require('../../lib/runner/run-folder');
const { buildContext } = require('../../lib/runner/prompt-builder');
const { buildPanelConfig, buildViewRegistryUpdated } = require('../../lib/ws/connection-init');
const viewReadiness = require('../../lib/views/readiness-runtime');
const { installHistoricalReadinessFixture } = require('./historical-readiness-fixture');
const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function scaffoldProject(options) {
  const machineIdentity = aiPaths.sanitizeMachineName(options.machineName || aiPaths.getLocalMachineName());
  const projectRoot = path.resolve(options.projectPath);
  const coordinator = createViewReadinessCoordinator({
    machineIdentity,
    migrationService: { ensureReady: async () => { throw new Error('not used by scaffold fixture'); } },
  });
  viewReadiness.installViewReadinessOwner(coordinator);
  const result = createService.scaffoldProject(options);
  viewReadiness.installViewReadinessOwner({
    ensureReady: async ({ workspaceId }) => ({
      status: 'verified', phase: 'journal_verified', verified: true, workspaceId, projectRoot,
    }),
    acquireLease: () => ({
      phase: 'journal_verified',
      verified: true,
      projectRoot,
      viewsRoot: aiPaths.getMachineViewsRoot(projectRoot, machineIdentity),
      release() {},
    }),
    getStatus: () => ({ status: 'ready', verified: true }),
  });
  return result;
}

describe('content root consumers', () => {
  let tempRoot;
  let oldFusionLocalMachine;

  beforeEach(() => {
    oldFusionLocalMachine = process.env.FUSION_LOCAL_MACHINE;
    tempRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-content-consumers-')));
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

  test('wiki tree resolves an edited v2 wiki content root', () => {
    const projectPath = path.join(tempRoot, 'wiki-shared-root');
    scaffoldProject({
      projectPath,
      machineName: 'WikiConsumerBox',
      viewIds: ['wiki-viewer'],
    });
    process.env.FUSION_LOCAL_MACHINE = 'WikiConsumerBox';

    const machineRoot = path.join(projectPath, 'ai', 'WikiConsumerBox');
    writeJson(path.join(machineRoot, 'System', 'Views', '001-wiki-viewer', 'content.json'), {
      version: 1,
      dataSource: 'Wiki',
      root: {
        type: 'workspace-relative',
        path: 'shared/wiki',
      },
    });
    writeFile(path.join(projectPath, 'shared', 'wiki', '001-Topic', 'PAGE.md'), '# Shared topic\n');

    const context = wikiTree.resolveWikiRoot(projectPath);
    expect(context.wikiRoot).toBe(path.join(projectPath, 'shared', 'wiki'));

    const { trees, warnings } = wikiTree.scanWikiTree(projectPath);
    expect(warnings).toEqual([]);
    expect(trees[0]).toMatchObject({
      wikiRoot: path.join(projectPath, 'shared', 'wiki'),
      children: [
        {
          label: 'Topic',
          nodePath: '001-Topic',
          hasPage: true,
        },
      ],
    });
  });

  test('wiki tree resolves the established machine identity without cross-machine discovery', () => {
    const projectPath = path.join(tempRoot, 'wiki-discovered-root');
    scaffoldProject({
      projectPath,
      machineName: 'DiscoveredWikiBox',
      viewIds: ['wiki-viewer'],
    });
    process.env.FUSION_LOCAL_MACHINE = 'DiscoveredWikiBox';

    const machineRoot = path.join(projectPath, 'ai', 'DiscoveredWikiBox');
    writeJson(path.join(machineRoot, 'System', 'Views', '001-wiki-viewer', 'content.json'), {
      version: 1,
      dataSource: 'Wiki',
      root: {
        type: 'workspace-relative',
        path: 'shared/wiki',
      },
    });
    writeFile(path.join(projectPath, 'shared', 'wiki', '001-Topic', 'PAGE.md'), '# Discovered topic\n');

    const context = wikiTree.resolveWikiRoot(projectPath);
    expect(context.wikiRoot).toBe(path.join(projectPath, 'shared', 'wiki'));

    const { nodes, warnings } = wikiTree.queryWiki(projectPath, {
      section: 'Topic',
      limit: 1,
    });
    expect(warnings).toEqual([]);
    expect(nodes).toEqual([
      expect.objectContaining({
        label: 'Topic',
        nodePath: '001-Topic',
        hasPage: true,
      }),
    ]);
  });

  test('wiki tree does not revive an unscoped ai/views fallback', () => {
    const projectPath = path.join(tempRoot, 'wiki-no-retired-fallback');
    process.env.FUSION_LOCAL_MACHINE = 'WikiFallbackBox';
    const machineWiki = path.join(projectPath, 'ai', 'WikiFallbackBox', 'Wiki');
    const retiredWiki = path.join(projectPath, 'ai', 'views', 'wiki-viewer', 'Wiki');
    writeFile(path.join(machineWiki, '001-Canonical', 'PAGE.md'), '# Canonical\n');
    writeFile(path.join(retiredWiki, '001-Retired', 'PAGE.md'), '# Retired\n');

    const context = wikiTree.resolveWikiRoot(projectPath);
    expect(context.wikiRoot).toBe(machineWiki);
    const { nodes } = wikiTree.queryWiki(projectPath, { limit: 10 });
    expect(nodes.map((node) => node.label)).toContain('Canonical');
    expect(nodes.map((node) => node.label)).not.toContain('Retired');
  });

  test('wiki tree does not infer identity from a misleading folder suffix', () => {
    const projectPath = path.join(tempRoot, 'wiki-folder-is-presentation');
    process.env.FUSION_LOCAL_MACHINE = 'WikiIdentityBox';
    const machineRoot = path.join(projectPath, 'ai', 'WikiIdentityBox');
    const misleadingCapsule = path.join(machineRoot, 'System', 'Views', '001-wiki-viewer');
    writeFile(path.join(misleadingCapsule, 'manifest.md'), [
      '---',
      'metadata:',
      '  view-id: capture-viewer',
      '---',
      '',
    ].join('\n'));
    writeJson(path.join(misleadingCapsule, 'content.json'), {
      root: { type: 'workspace-relative', path: 'misleading/wiki' },
    });
    writeFile(path.join(projectPath, 'misleading', 'wiki', '001-Wrong', 'PAGE.md'), '# Wrong\n');
    writeFile(path.join(machineRoot, 'Wiki', '001-Canonical', 'PAGE.md'), '# Canonical\n');

    const context = wikiTree.resolveWikiRoot(projectPath);
    expect(context.wikiRoot).toBe(path.join(machineRoot, 'Wiki'));
    const { nodes } = wikiTree.queryWiki(projectPath, { limit: 10 });
    expect(nodes.map((node) => node.label)).toContain('Canonical');
    expect(nodes.map((node) => node.label)).not.toContain('Wrong');
  });

  test('panel config exposes content.json-resolved view roots for link consumers', async () => {
    const projectPath = path.join(tempRoot, 'panel-config-roots');
    scaffoldProject({
      projectPath,
      machineName: 'PanelRootBox',
      viewIds: ['capture-viewer'],
    });
    process.env.FUSION_LOCAL_MACHINE = 'PanelRootBox';
    const machineRoot = path.join(projectPath, 'ai', 'PanelRootBox');
    writeJson(path.join(machineRoot, 'System', 'Views', '001-capture-viewer', 'content.json'), {
      version: 1,
      dataSource: 'Captures',
      root: {
        type: 'workspace-relative',
        path: 'shared/captures',
      },
    });
    writeFile(path.join(projectPath, 'shared', 'captures', '001-Captures', 'note.md'), '# Note\n');

    const msg = await buildPanelConfig(projectPath, 'workspace-123', 'epoch-123');

    expect(msg.panelRoots['capture-viewer']).toBe(path.join(projectPath, 'shared', 'captures'));
    expect(msg).toMatchObject({ workspaceId: 'workspace-123', workspaceEpoch: 'epoch-123' });
    expect(msg.viewCapsules).toMatchObject({
      version: 1,
      workspaceId: 'workspace-123',
      machineIdentity: 'PanelRootBox',
    });

    const update = await buildViewRegistryUpdated(projectPath, 'workspace-123', { version: 2 });
    expect(update).toEqual({
      type: 'workspace:view_registry_updated',
      workspaceId: 'workspace-123',
      registry: { version: 2 },
      viewCapsules: msg.viewCapsules,
    });
  });

  test('runner and prompt builder read v2 Agents and Issues content roots', () => {
    const projectPath = path.join(tempRoot, 'runner-content-roots');
    scaffoldProject({
      projectPath,
      machineName: 'RunnerConsumerBox',
      viewIds: ['agents-viewer', 'issues-viewer'],
    });
    process.env.FUSION_LOCAL_MACHINE = 'RunnerConsumerBox';

    const machineRoot = path.join(projectPath, 'ai', 'RunnerConsumerBox');
    const agentFolder = 'Background Workers/wiki-manager';
    writeFile(path.join(machineRoot, 'Agents', agentFolder, 'PROMPT_01.md'), [
      '---',
      'bot_name: wiki-manager',
      'model: test-model',
      '---',
      'Use the v2 agent root.',
      '',
    ].join('\n'));
    writeFile(path.join(machineRoot, 'Agents', agentFolder, 'LESSONS.md'), '# Lessons\n');
    writeFile(path.join(machineRoot, 'Issues', 'RCC-0001.md'), [
      '---',
      'id: RCC-0001',
      'title: Verify V2 roots',
      'assignee: wiki-manager',
      'state: open',
      '---',
      '',
      'Ticket body.',
      '',
    ].join('\n'));

    const ticket = {
      frontmatter: {
        id: 'RCC-0001',
        title: 'Verify V2 roots',
        prompt: 'PROMPT_01.md',
      },
      body: 'Ticket body.',
      filename: 'RCC-0001.md',
    };

    const run = createRunFolder(projectPath, agentFolder, ticket);
    expect(run.runPath).toContain(path.join('ai', 'RunnerConsumerBox', 'Agents', agentFolder, 'runs'));
    expect(fs.existsSync(path.join(run.runPath, 'ticket.md'))).toBe(true);
    expect(fs.existsSync(path.join(run.runPath, 'PROMPT_01.md'))).toBe(true);
    expect(fs.existsSync(path.join(run.runPath, 'LESSONS.md'))).toBe(true);

    const context = buildContext(projectPath, agentFolder, run.runPath, ticket);
    expect(context.systemContext).toContain('Use the v2 agent root.');
    expect(context.userMessage).toContain('Path: ' + run.runPath);
  });
});
