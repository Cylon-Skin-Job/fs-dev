'use strict';

const runtime = require('../../lib/views/readiness-runtime');
const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
const { startWorkspacePipelineWhenReady } = require('../../lib/views/readiness-startup');
const { installHistoricalReadinessFixture } = require('./historical-readiness-fixture');
const { createFixture, requestFor, serviceFor, writeCapsule } = require('./view-relocation-fixtures');

test.each([false, true])('startup wrapper awaits asynchronous initialization and releases on rejection=%s', async reject => {
  const fixture = await createFixture();
  let finish;
  let entered;
  const pending = new Promise(resolve => { finish = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  let starting;
  try {
    writeCapsule(fixture.oldRoot);
    const owner = createViewReadinessCoordinator({
      machineIdentity: fixture.machineIdentity, migrationService: serviceFor(fixture),
    });
    runtime.installViewReadinessOwner(owner);
    let settled = false;
    starting = startWorkspacePipelineWhenReady({
      sessions: new Map(), getProjectRoot: () => fixture.projectRoot,
      getWorkspaceId: () => fixture.workspaceId,
      async startPipeline() {
        entered();
        await pending;
        if (reject) throw new Error('scratch asynchronous initialization failure');
      },
    });
    starting.then(() => { settled = true; }, () => { settled = true; });
    await started;
    expect(owner.getStatus(requestFor(fixture))).toMatchObject({ verified: true, leases: 1 });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    if (reject) await expect(starting).rejects.toThrow('scratch asynchronous initialization failure');
    else await expect(starting).resolves.toEqual({ started: true, reason: null });
    expect(owner.getStatus(requestFor(fixture))).toMatchObject({ verified: true, leases: 0 });
  } finally {
    finish();
    await starting?.catch(() => {});
    installHistoricalReadinessFixture();
    await fixture.cleanup();
  }
});
