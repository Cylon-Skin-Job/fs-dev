'use strict';

const express = require('express');
const fs = require('fs');

const { createRouter } = require('../../lib/http/view-config-route');
const viewReadiness = require('../../lib/views/readiness-runtime');
const views = require('../../lib/views');
const { installHistoricalReadinessFixture } = require('../views/historical-readiness-fixture');
const {
  MACHINE,
  createFixture,
  requestFor,
  serviceFor,
  writeCapsule,
} = require('../views/view-relocation-fixtures');
const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');

describe('view config readiness publication gate', () => {
  let fixture;
  let server;
  let previousMachine;

  beforeEach(() => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = MACHINE;
  });

  afterEach(async () => {
    installHistoricalReadinessFixture();
    if (server) await new Promise(resolve => server.close(resolve));
    if (fixture) await fixture.cleanup();
    fixture = null;
    server = null;
    if (previousMachine === undefined) delete process.env.FUSION_LOCAL_MACHINE;
    else process.env.FUSION_LOCAL_MACHINE = previousMachine;
    jest.restoreAllMocks();
  });

  async function startRoute() {
    const app = express();
    app.use('/api/view-config', createRouter({
      getProjectRoot: () => fixture.projectRoot,
      getWorkspaceId: () => fixture.workspaceId,
    }));
    server = await new Promise(resolve => {
      const next = app.listen(0, '127.0.0.1', () => resolve(next));
    });
    return `http://127.0.0.1:${server.address().port}/api/view-config?panel=example-viewer`;
  }

  test('ensures and leases a journal-verified workspace before returning configuration', async () => {
    fixture = await createFixture(null, 'view-config-ready');
    writeCapsule(fixture.oldRoot);
    const coordinator = createViewReadinessCoordinator({
      migrationService: serviceFor(fixture),
      machineIdentity: fixture.machineIdentity,
    });
    viewReadiness.installViewReadinessOwner(coordinator);
    const url = await startRoute();

    const response = await fetch(url);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      globalCss: '',
      viewCss: '',
      layout: { dirty: 'example-viewer-preserve' },
    });
    expect(coordinator.getStatus(requestFor(fixture))).toMatchObject({
      status: 'ready',
      verified: true,
      leases: 0,
    });
    expect(fs.existsSync(fixture.oldRoot)).toBe(false);
    expect(fs.existsSync(fixture.newRoot)).toBe(true);
  });

  test('revalidates and publishes only bounded unavailable after a canonical conflict appears', async () => {
    fixture = await createFixture(null, 'view-config-conflict');
    writeCapsule(fixture.oldRoot);
    writeCapsule(fixture.newRoot, { viewId: 'canonical-copy' });
    const coordinator = createViewReadinessCoordinator({
      migrationService: serviceFor(fixture),
      machineIdentity: fixture.machineIdentity,
    });
    viewReadiness.installViewReadinessOwner(coordinator);
    const resolveViewRoot = jest.spyOn(views, 'resolveViewRoot');
    const url = await startRoute();

    const response = await fetch(url);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'view_registry_unavailable' });
    expect(resolveViewRoot).not.toHaveBeenCalled();
    expect(fs.existsSync(fixture.oldRoot)).toBe(true);
    expect(fs.existsSync(fixture.newRoot)).toBe(true);
    await expect(fixture.db('view_capsule_relocations').where({
      workspace_id: fixture.workspaceId,
    })).resolves.toEqual([]);
  });
});
