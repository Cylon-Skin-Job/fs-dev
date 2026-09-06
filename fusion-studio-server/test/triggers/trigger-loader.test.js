'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function writeTriggers(root, content) {
  const agentsRoot = path.join(root, 'agents');
  const botRoot = path.join(agentsRoot, 'bot');
  fs.mkdirSync(botRoot, { recursive: true });
  fs.writeFileSync(path.join(botRoot, 'TRIGGERS.md'), content, 'utf8');
  return agentsRoot;
}

describe('TRIGGERS.md direct compatibility paths', () => {
  let projectRoot;
  let consoleLog;
  let consoleWarn;

  beforeEach(() => {
    jest.resetModules();
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-trigger-loader-test-'));
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleWarn.mockRestore();
    fs.rmSync(projectRoot, { recursive: true, force: true });
    jest.dontMock('../../lib/triggers/script-runner');
  });

  test('editable bus definitions retain legacy emit/on behavior without governed capabilities', () => {
    const agentsRoot = writeTriggers(projectRoot, `# Triggers

---
name: ready-turn
type: chat
event: turn_end
workspace: workspace-1
condition: status === "ready"
action: create-ticket
message: "Turn ready"
---
`);
    const action = jest.fn();
    const { loadTriggers } = require('../../lib/triggers/trigger-loader');
    const eventBus = require('../../lib/event-bus');

    const result = loadTriggers(
      projectRoot,
      agentsRoot,
      { agents: { helper: { folder: 'bot' } } },
      { 'create-ticket': action },
    );

    expect(result).toEqual({ filters: [], cronTriggers: [] });
    eventBus.emit('chat:turn_end', {
      workspace: 'workspace-2', status: 'ready', threadId: 'thread-1',
    });
    eventBus.emit('chat:turn_end', {
      workspace: 'workspace-1', status: 'waiting', threadId: 'thread-1',
    });
    eventBus.emit('chat:turn_end', {
      workspace: 'workspace-1', status: 'ready', threadId: 'thread-1',
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]).toHaveLength(2);
    const [definition, variables] = action.mock.calls[0];
    expect(definition).toMatchObject({
      name: 'ready-turn', action: 'create-ticket', _autoHold: true,
      ticket: { assignee: 'helper', title: 'Turn ready', body: 'Turn ready' },
    });
    expect(variables).toMatchObject({
      workspace: 'workspace-1', status: 'ready', threadId: 'thread-1', assignee: 'helper',
    });
    for (const value of [definition, variables]) {
      expect(value.appendResourceFact).toBeUndefined();
      expect(value.publishResourceChanged).toBeUndefined();
      expect(value.publishResourceRefreshRequired).toBeUndefined();
      expect(value.writeDiagnostic).toBeUndefined();
      expect(value.emit).toBeUndefined();
      expect(value.db).toBeUndefined();
    }
  });

  test('editable file definitions retain watcher filtering and script action topology', () => {
    const runScript = jest.fn(() => ({ summary: 'checked' }));
    jest.doMock('../../lib/triggers/script-runner', () => ({ runScript }));
    const agentsRoot = writeTriggers(projectRoot, `# Triggers

---
name: markdown-check
type: file-change
events: [modify]
match: "*.md"
exclude: ["ignored.md"]
action: create-ticket
script: "scripts/check.js"
function: inspect
message: "Changed {{filePath}}"
---
`);
    const action = jest.fn();
    const { loadTriggers } = require('../../lib/triggers/trigger-loader');

    const { filters, cronTriggers } = loadTriggers(
      projectRoot,
      agentsRoot,
      { agents: { helper: { folder: 'bot' } } },
      { 'create-ticket': action },
    );

    expect(cronTriggers).toEqual([]);
    expect(filters).toHaveLength(1);
    expect(filters[0].shouldWatch('notes/readme.md', {})).toBe(true);
    expect(filters[0].shouldWatch('ignored.md', {})).toBe(false);
    expect(filters[0].shouldWatch('notes/readme.txt', {})).toBe(false);

    filters[0].onCreate('notes/readme.md', {});
    expect(action).not.toHaveBeenCalled();
    filters[0].onModify('notes/readme.md', { basename: 'readme.md' });

    expect(runScript).toHaveBeenCalledWith(
      'scripts/check.js', 'inspect', expect.objectContaining({
        event: 'modify', filePath: 'notes/readme.md', basename: 'readme.md',
      }), projectRoot,
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]).toHaveLength(2);
    const [definition, variables] = action.mock.calls[0];
    expect(definition.ticket).toEqual({
      assignee: 'helper',
      title: 'Changed notes/readme.md',
      body: 'Changed notes/readme.md',
    });
    expect(variables.result).toEqual({ summary: 'checked' });
    expect(variables.appendResourceFact).toBeUndefined();
    expect(definition.grants).toBeUndefined();
    expect(definition.capabilities).toBeUndefined();
  });

  test('cron definitions remain inert data returned to the established scheduler owner', () => {
    const agentsRoot = writeTriggers(projectRoot, `# Triggers

---
name: daily-check
type: cron
schedule: "daily 09:00"
retry: "5m"
action: create-ticket
message: "Daily check"
---
`);
    const action = jest.fn();
    const { loadTriggers } = require('../../lib/triggers/trigger-loader');

    const result = loadTriggers(
      projectRoot,
      agentsRoot,
      { agents: { helper: { folder: 'bot' } } },
      { 'create-ticket': action },
    );

    expect(result.filters).toEqual([]);
    expect(result.cronTriggers).toEqual([{
      assignee: 'helper',
      trigger: expect.objectContaining({
        name: 'daily-check', type: 'cron', schedule: 'daily 09:00', retry: '5m',
      }),
    }]);
    expect(action).not.toHaveBeenCalled();
    expect(result.cronTriggers[0].trigger.grants).toBeUndefined();
    expect(result.cronTriggers[0].trigger.capabilities).toBeUndefined();
  });
});
