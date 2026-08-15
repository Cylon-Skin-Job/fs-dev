'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const createService = require('../../lib/workspace/create-service');
const wikiTree = require('../../lib/wiki/wiki-tree');
const { createRunFolder } = require('../../lib/runner/run-folder');
const { buildContext } = require('../../lib/runner/prompt-builder');
const { buildPanelConfig } = require('../../lib/ws/connection-init');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('content root consumers', () => {
  let tempRoot;
  let oldFusionLocalMachine;

  beforeEach(() => {
    oldFusionLocalMachine = process.env.FUSION_LOCAL_MACHINE;
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-content-consumers-'));
  });

  afterEach(() => {
    if (oldFusionLocalMachine == null) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = oldFusionLocalMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('wiki tree resolves an edited v2 wiki content root', () => {
    const projectPath = path.join(tempRoot, 'wiki-shared-root');
    createService.scaffoldProject({
      projectPath,
      machineName: 'WikiConsumerBox',
      viewIds: ['wiki-viewer'],
    });
    process.env.FUSION_LOCAL_MACHINE = 'WikiConsumerBox';

    const machineRoot = path.join(projectPath, 'ai', 'WikiConsumerBox');
    writeJson(path.join(machineRoot, 'Views', '001-wiki-viewer', 'content.json'), {
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

  test('wiki tree discovers a machine-scoped v2 wiki root without local machine env', () => {
    const projectPath = path.join(tempRoot, 'wiki-discovered-root');
    createService.scaffoldProject({
      projectPath,
      machineName: 'DiscoveredWikiBox',
      viewIds: ['wiki-viewer'],
    });
    delete process.env.FUSION_LOCAL_MACHINE;

    const machineRoot = path.join(projectPath, 'ai', 'DiscoveredWikiBox');
    writeJson(path.join(machineRoot, 'Views', '001-wiki-viewer', 'content.json'), {
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

  test('panel config exposes content.json-resolved view roots for link consumers', () => {
    const projectPath = path.join(tempRoot, 'panel-config-roots');
    createService.scaffoldProject({
      projectPath,
      machineName: 'PanelRootBox',
      viewIds: ['capture-viewer'],
    });
    process.env.FUSION_LOCAL_MACHINE = 'PanelRootBox';

    const machineRoot = path.join(projectPath, 'ai', 'PanelRootBox');
    writeJson(path.join(machineRoot, 'Views', '001-capture-viewer', 'content.json'), {
      version: 1,
      dataSource: 'Captures',
      root: {
        type: 'workspace-relative',
        path: 'shared/captures',
      },
    });
    writeFile(path.join(projectPath, 'shared', 'captures', '001-Captures', 'note.md'), '# Note\n');

    const msg = buildPanelConfig(projectPath);

    expect(msg.panelRoots['capture-viewer']).toBe(path.join(projectPath, 'shared', 'captures'));
  });

  test('runner and prompt builder read v2 Agents and Issues content roots', () => {
    const projectPath = path.join(tempRoot, 'runner-content-roots');
    createService.scaffoldProject({
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
