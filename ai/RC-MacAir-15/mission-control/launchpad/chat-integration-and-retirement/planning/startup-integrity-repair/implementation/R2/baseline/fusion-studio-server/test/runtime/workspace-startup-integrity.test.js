'use strict';

const fs = require('fs');
const path = require('path');
const { createStartupEntryFixture } = require('./fixtures/startup-entry-fixture');

// Deliberately independent of the implementation's exported expected array.
const STARTUP_EFFECTS = [
  'calendar-adapters', 'calendar-broadcaster', 'cli-config-bootstrap',
  'harness-broadcaster', 'harness-status-revalidation', 'theme-css-bootstrap',
  'workspace-automation-pipeline',
];

test('actual normal startup/listen invokes preserved automation consumers once', async () => {
  const fixture = await createStartupEntryFixture({ preimageRoot: process.env.STARTUP_INTEGRITY_PREIMAGE_ROOT });
  try {
    await fixture.start();
    // Do not accept a healthy listen/returned handler as automation evidence.
    if (process.env.STARTUP_INTEGRITY_PREIMAGE_ROOT) {
      const rejection = fixture.errors.find(args => args[0] === '[Server] Pipeline init error:');
      process.stderr.write(`Audited startup registry rejection: ${rejection?.[1]?.message}\n`);
    }
    expect(fixture.componentLoad).toHaveBeenCalledTimes(1);
    expect(fixture.errors.filter(args => args[0] === '[Server] Pipeline init error:')).toEqual([]);
    expect(fixture.componentLoad).toHaveBeenCalledWith(path.join(fixture.workspaces[0].repoPath, 'ai/components'));
    expect(fixture.components.getModalDefinition('scratch')).toMatchObject({ config: { name: 'scratch-modal' } });
    expect(fixture.actionWiring).toHaveBeenCalledTimes(1);
    expect(fixture.heartbeatStart).toHaveBeenCalledTimes(1);
    const bus = require('../../lib/event-bus');
    for (const type of ['chat', 'ticket', 'agent', 'system']) {
      const topic = `${type}:startup-canary`;
      expect(bus.bus.listenerCount(topic)).toBe(1);
      bus.emit(topic);
    }
    expect(fixture.messages.filter(item => item.type === 'system_message').map(item => item.content))
      .toEqual(['scratch-chat', 'scratch-ticket', 'scratch-agent', 'scratch-system']);
    expect(fixture.cronFactory).toHaveBeenCalledTimes(1);
    expect(fixture.cronSchedulers[0].getJobs()).toHaveLength(1);
    const cron = fixture.cronIntervals;
    expect(cron).toHaveLength(1);
    cron[0].callback();
    cron[0].callback();
    expect(fs.readFileSync(fixture.workspace.ticketReceipts, 'utf8').trim().split('\n').map(JSON.parse))
      .toEqual([{ kind: 'script-loaded' }, expect.objectContaining({ kind: 'ticket', title: 'scratch-cron', assignee: 'scratch' })]);
    expect(fixture.intervals.filter(item => item.delay === 300_000)).toHaveLength(1);
  } finally {
    await fixture.cleanup();
  }
}, 30_000);

test('failed actual isolated startup restores guards, timers, listeners and owned database', async () => {
  const fixture = await createStartupEntryFixture({ isolated: true, failAfterDbInit: true });
  try {
    await expect(fixture.start()).rejects.toThrow('scratch startup database failure');
    expect(fixture.componentLoad).not.toHaveBeenCalled();
  } finally {
    await fixture.cleanup();
  }
  expect(fs.existsSync(fixture.root)).toBe(false);
  expect(() => fixture.db.getDb()).toThrow('DB not initialized');
}, 30_000);

test('actual isolated startup registers seven effects once and blocks every factory under guards', async () => {
  const fixture = await createStartupEntryFixture({ isolated: true });
  try {
    await fixture.start();
    const audit = JSON.parse(fs.readFileSync(path.join(fixture.appData, 'isolated-provenance-audit.json')));
    expect(audit.port).toBe(fixture.port);
    expect(audit.port).not.toBe(3001);
    expect(audit.dbExists).toBe(true);
    expect(audit.registeredWorkspaces).toEqual(fixture.workspaces.map(({ id, repoPath }) => ({ id, repoPath })));
    expect(audit.startupEffects).toEqual(STARTUP_EFFECTS.map(name => ({
      name, startRequests: 1, blockedRequests: 1, prohibitedAttempts: 0, factoryInvocations: 0,
    })));
    expect(audit.observationGuards).toEqual({ installed: true, attempts: { childProcess: 0, filesystemWatch: 0 } });
    expect(fixture.componentLoad).not.toHaveBeenCalled();
    expect(fixture.actionWiring).not.toHaveBeenCalled();
    expect(fixture.heartbeatStart).not.toHaveBeenCalled();
    expect(fs.existsSync(fixture.workspace.ticketReceipts)).toBe(false);
    expect(audit.registryAuthority.schemas.length).toBeGreaterThan(0);
  } finally {
    await fixture.cleanup();
  }
}, 30_000);
