'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { ViewRelocationError } = require('../../lib/views/relocation-errors');
const { createViewReadinessCoordinator } = require('../../lib/views/readiness-coordinator');
const { createPreCutoverViewReadinessAdapter } = require('./fixtures/precutover-readiness-adapter');
const { installHistoricalReadinessFixture } = require('./historical-readiness-fixture');
const readinessRuntime = require('../../lib/views/readiness-runtime');
const views = require('../../lib/views');
const { buildPanelConfig } = require('../../lib/ws/connection-init');
const { startWorkspacePipelineWhenReady } = require('../../lib/views/readiness-startup');
const bootstrapService = require('../../lib/workspace/bootstrap-service');
const {
  createFixture,
  requestFor,
  serviceFor,
  writeCapsule,
} = require('./view-relocation-fixtures');

describe('view readiness coordinator and publication gate', () => {
  afterEach(() => {
    installHistoricalReadinessFixture();
  });

  test('serializes one migration by workspace and machine and holds operation leases', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      const migration = serviceFor(fixture);
      const ensureReady = jest.fn((request) => migration.ensureReady(request));
      const coordinator = createViewReadinessCoordinator({
        migrationService: { ensureReady },
        machineIdentity: fixture.machineIdentity,
      });
      const request = requestFor(fixture);
      const [left, right] = await Promise.all([
        coordinator.ensureReady(request),
        coordinator.ensureReady(request),
      ]);
      expect(ensureReady).toHaveBeenCalledTimes(1);
      expect(left).toBe(right);
      expect(left).toMatchObject({ phase: 'journal_verified', verified: true });

      const lease = coordinator.acquireLease({ projectRoot: fixture.projectRoot });
      expect(lease).toMatchObject({
        phase: 'journal_verified',
        verified: true,
        viewsRoot: fixture.newRoot,
      });
      expect(coordinator.getStatus(request)).toMatchObject({ status: 'ready', leases: 1 });
      lease.release();
      lease.release();
      expect(coordinator.getStatus(request)).toMatchObject({ status: 'ready', leases: 0 });
    } finally {
      await fixture.cleanup();
    }
  });

  test('retirement blocks new leases, drains admitted work, and clears cached readiness', async () => {
    const root = path.resolve('/tmp/fusion-readiness-retirement');
    const migrationService = {
      ensureReady: jest.fn(async (request) => ({
        ...request,
        status: 'verified',
        destinationRoot: path.join(root, 'ai', request.machineIdentity, 'System', 'Views'),
      })),
    };
    const coordinator = createViewReadinessCoordinator({ migrationService, machineIdentity: 'Machine' });
    const request = { workspaceId: 'workspace', projectRoot: root };
    await coordinator.ensureReady(request);
    const lease = coordinator.acquireLease(request);

    let retired = false;
    const retiring = coordinator.retireWorkspace(request).then((value) => {
      retired = value;
    });
    await Promise.resolve();
    expect(retired).toBe(false);
    expect(coordinator.getStatus(request)).toMatchObject({
      status: 'unavailable',
      verified: false,
      leases: 1,
    });
    expect(() => coordinator.acquireLease(request))
      .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));

    lease.release();
    await retiring;
    expect(retired).toBe(true);
    expect(coordinator.getStatus(request)).toMatchObject({ status: 'unavailable', verified: false });
    await coordinator.ensureReady(request);
    expect(migrationService.ensureReady).toHaveBeenCalledTimes(2);
  });

  test('retirement keeps an unavailable tombstone through the registry deletion effect', async () => {
    const root = path.resolve('/tmp/fusion-readiness-retirement-effect');
    const migrationService = {
      ensureReady: jest.fn(async (request) => ({
        ...request,
        status: 'verified',
        destinationRoot: path.join(root, 'ai', request.machineIdentity, 'System', 'Views'),
      })),
    };
    const coordinator = createViewReadinessCoordinator({ migrationService, machineIdentity: 'Machine' });
    const request = { workspaceId: 'workspace', projectRoot: root };
    await coordinator.ensureReady(request);
    let signalDeletion;
    let finishDeletion;
    const deletionStarted = new Promise(resolve => { signalDeletion = resolve; });
    const deletionPending = new Promise(resolve => { finishDeletion = resolve; });
    const retiring = coordinator.retireWorkspace(request, async () => {
      signalDeletion();
      await deletionPending;
      return true;
    });

    await deletionStarted;
    await expect(coordinator.ensureReady(request))
      .rejects.toMatchObject({ code: 'view_registry_unavailable' });
    expect(() => coordinator.acquireLease(request))
      .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
    finishDeletion();
    await expect(retiring).resolves.toBe(true);
    await coordinator.ensureReady(request);
    expect(migrationService.ensureReady).toHaveBeenCalledTimes(2);
  });

  test('duplicate coordinator retirement shares one deletion effect and one tombstone lifetime', async () => {
    const root = path.resolve('/tmp/fusion-readiness-duplicate-retirement');
    const coordinator = createViewReadinessCoordinator({
      migrationService: {
        ensureReady: async (request) => ({
          ...request,
          status: 'verified',
          destinationRoot: path.join(root, 'ai', request.machineIdentity, 'System', 'Views'),
        }),
      },
      machineIdentity: 'Machine',
    });
    const request = { workspaceId: 'workspace', projectRoot: root };
    await coordinator.ensureReady(request);
    let signalDeletion;
    let finishDeletion;
    const deletionStarted = new Promise(resolve => { signalDeletion = resolve; });
    const deletionPending = new Promise(resolve => { finishDeletion = resolve; });
    const firstEffect = jest.fn(async () => {
      signalDeletion();
      await deletionPending;
      return 'deleted';
    });
    const secondEffect = jest.fn(async () => 'must-not-run');

    const first = coordinator.retireWorkspace(request, firstEffect);
    await deletionStarted;
    const second = coordinator.retireWorkspace(request, secondEffect);
    await expect(coordinator.ensureReady(request))
      .rejects.toMatchObject({ code: 'view_registry_unavailable' });
    expect(firstEffect).toHaveBeenCalledTimes(1);
    expect(secondEffect).not.toHaveBeenCalled();

    finishDeletion();
    await expect(Promise.all([first, second])).resolves.toEqual(['deleted', 'deleted']);
    expect(firstEffect).toHaveBeenCalledTimes(1);
    expect(secondEffect).not.toHaveBeenCalled();
  });

  test('no-record retirement blocks migration until deletion completes, then reattachment adopts freshly', async () => {
    const fixture = await createFixture(null, 'no-record-retirement');
    try {
      writeCapsule(fixture.oldRoot);
      const migration = serviceFor(fixture);
      const ensureReady = jest.fn(request => migration.ensureReady(request));
      const coordinator = createViewReadinessCoordinator({
        migrationService: { ensureReady },
        machineIdentity: fixture.machineIdentity,
      });
      const request = requestFor(fixture);
      let signalDeletion;
      let finishDeletion;
      const deletionStarted = new Promise(resolve => { signalDeletion = resolve; });
      const deletionPending = new Promise(resolve => { finishDeletion = resolve; });
      const retiring = coordinator.retireWorkspace(request, async () => {
        signalDeletion();
        await deletionPending;
        return fixture.db('workspaces').where({ id: fixture.workspaceId }).del();
      });

      await deletionStarted;
      await expect(coordinator.ensureReady(request))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
      expect(ensureReady).not.toHaveBeenCalled();
      finishDeletion();
      await retiring;
      await fixture.db('workspaces').insert({
        id: fixture.workspaceId,
        label: 'Reattached',
        icon: 'folder',
        description: null,
        repo_path: fixture.projectRoot,
        sort_order: 10,
        type: 'code',
        ribbon_visible: 1,
        ribbon_sort_order: 10,
      });

      await expect(coordinator.ensureReady(request)).resolves.toMatchObject({
        status: 'verified',
        phase: 'journal_verified',
      });
      expect(ensureReady).toHaveBeenCalledTimes(1);
      expect(require('fs').existsSync(fixture.oldRoot)).toBe(false);
      expect(require('fs').existsSync(fixture.newRoot)).toBe(true);
      await expect(fixture.db('view_capsule_relocations')).resolves.toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  test('retirement prevents an in-flight coordinator preparation from promoting', async () => {
    const root = path.resolve('/tmp/fusion-readiness-preparing-retirement');
    let signalPreparing;
    let finishPreparing;
    const preparationStarted = new Promise(resolve => { signalPreparing = resolve; });
    const preparationPending = new Promise(resolve => { finishPreparing = resolve; });
    const migrationService = {
      ensureReady: jest.fn(async (request) => {
        signalPreparing();
        await preparationPending;
        return {
          ...request,
          status: 'verified',
          destinationRoot: path.join(root, 'ai', request.machineIdentity, 'System', 'Views'),
        };
      }),
    };
    const coordinator = createViewReadinessCoordinator({ migrationService, machineIdentity: 'Machine' });
    const request = { workspaceId: 'workspace', projectRoot: root };
    const preparing = coordinator.ensureReady(request);
    await preparationStarted;
    const retiring = coordinator.retireWorkspace(request);
    finishPreparing();

    await expect(preparing).rejects.toMatchObject({ code: 'view_registry_unavailable' });
    await expect(retiring).resolves.toBe(true);
    expect(coordinator.getStatus(request)).toMatchObject({ status: 'unavailable', verified: false });
    await coordinator.ensureReady(request);
    expect(migrationService.ensureReady).toHaveBeenCalledTimes(2);
  });

  test('remove cascade and same-process reattach rerun migration instead of reusing stale verification', async () => {
    const fixture = await createFixture(null, 'remove-reattach');
    try {
      writeCapsule(fixture.oldRoot);
      const migration = serviceFor(fixture);
      const ensureReady = jest.fn((request) => migration.ensureReady(request));
      const coordinator = createViewReadinessCoordinator({
        migrationService: { ensureReady },
        machineIdentity: fixture.machineIdentity,
      });
      const request = requestFor(fixture);
      await coordinator.ensureReady(request);
      await coordinator.retireWorkspace(
        request,
        () => fixture.db('workspaces').where({ id: fixture.workspaceId }).del(),
      );
      await expect(fixture.db('view_capsule_relocations')).resolves.toEqual([]);

      writeCapsule(fixture.oldRoot, { viewId: 'retired-copy' });
      await fixture.db('workspaces').insert({
        id: fixture.workspaceId,
        label: 'Reattached',
        icon: 'folder',
        description: null,
        repo_path: fixture.projectRoot,
        sort_order: 10,
        type: 'code',
        ribbon_visible: 1,
        ribbon_sort_order: 10,
      });

      await expect(coordinator.ensureReady(request)).rejects.toMatchObject({ code: 'root_conflict' });
      expect(ensureReady).toHaveBeenCalledTimes(2);
      expect(require('fs').existsSync(fixture.oldRoot)).toBe(true);
      expect(require('fs').existsSync(fixture.newRoot)).toBe(true);
      await expect(fixture.db('view_capsule_relocations')).resolves.toEqual([]);
      expect(() => coordinator.acquireLease(request))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
    } finally {
      await fixture.cleanup();
    }
  });

  test('retains a bounded unavailable state after migration conflict', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot, { viewId: 'old-viewer' });
      writeCapsule(fixture.newRoot, { viewId: 'new-viewer' });
      const coordinator = createViewReadinessCoordinator({
        migrationService: serviceFor(fixture),
        machineIdentity: fixture.machineIdentity,
      });
      await expect(coordinator.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'root_conflict' });
      expect(coordinator.getStatus(requestFor(fixture))).toMatchObject({
        status: 'unavailable',
        verified: false,
        errorCode: 'root_conflict',
      });
      expect(() => coordinator.acquireLease(requestFor(fixture)))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      await expect(coordinator.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
    } finally {
      await fixture.cleanup();
    }
  });

  test('never promotes a migration result that does not prove exact canonical readiness', async () => {
    const projectRoot = path.resolve('/tmp/fusion-invalid-readiness-result');
    const coordinator = createViewReadinessCoordinator({
      migrationService: {
        ensureReady: async () => ({
          status: 'verified',
          workspaceId: 'workspace',
          machineIdentity: 'Machine',
          projectRoot,
          destinationRoot: path.join(projectRoot, 'ai', 'Machine', 'Views'),
        }),
      },
      machineIdentity: 'Machine',
    });
    await expect(coordinator.ensureReady({ workspaceId: 'workspace', projectRoot }))
      .rejects.toMatchObject({ code: 'view_registry_unavailable' });
    expect(coordinator.getStatus({ workspaceId: 'workspace' })).toMatchObject({
      status: 'unavailable',
      verified: false,
    });
  });

  test('viewless scaffold lease is narrow, explicit, and replaced by journal verification before publication', async () => {
    const fixture = await createFixture(null, 'viewless-scaffold-boundary');
    try {
      const migration = serviceFor(fixture);
      const ensureReady = jest.fn(request => migration.ensureReady(request));
      const coordinator = createViewReadinessCoordinator({
        migrationService: { ensureReady },
        machineIdentity: fixture.machineIdentity,
      });
      readinessRuntime.installViewReadinessOwner(coordinator);

      expect(() => coordinator.acquireViewlessScaffoldLease({
        projectRoot: fixture.projectRoot,
        machineIdentity: 'Other-Machine',
      })).toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));

      const lease = readinessRuntime.acquireViewlessScaffoldLease({
        projectRoot: fixture.projectRoot,
        machineIdentity: fixture.machineIdentity,
      });
      expect(lease).toMatchObject({
        phase: 'viewless_scaffold',
        verified: false,
        projectRoot: fixture.projectRoot,
        viewsRoot: fixture.newRoot,
      });
      expect(() => readinessRuntime.assertActiveViewReadinessLease(
        requestFor(fixture),
        lease,
      )).toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      expect(() => coordinator.acquireLease(requestFor(fixture)))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      await expect(coordinator.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'workspace_identity_mismatch' });

      fs.mkdirSync(fixture.newRoot, { recursive: true });
      expect(lease.complete()).toBe(true);
      await expect(coordinator.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'workspace_identity_mismatch' });
      lease.release();

      await expect(coordinator.ensureReady(requestFor(fixture))).resolves.toMatchObject({
        status: 'verified',
        phase: 'journal_verified',
        verified: true,
      });
      expect(ensureReady).toHaveBeenCalledTimes(1);
      const ordinary = readinessRuntime.acquireViewReadinessLease(requestFor(fixture));
      expect(ordinary).toMatchObject({ phase: 'journal_verified', verified: true });
      ordinary.release();
    } finally {
      await fixture.cleanup();
    }
  });

  test('abandoned viewless scaffold cannot promote or publish an empty workspace', async () => {
    const fixture = await createFixture(null, 'viewless-scaffold-abandoned');
    try {
      const coordinator = createViewReadinessCoordinator({
        migrationService: serviceFor(fixture),
        machineIdentity: fixture.machineIdentity,
      });
      const lease = coordinator.acquireViewlessScaffoldLease({
        projectRoot: fixture.projectRoot,
        machineIdentity: fixture.machineIdentity,
      });
      lease.release();
      await expect(coordinator.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'viewless_not_allowed' });
      expect(() => coordinator.acquireLease(requestFor(fixture)))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects workspace/root rebinding and root reuse by another workspace identity', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const migrationService = {
      ensureReady: jest.fn(async (request) => {
        await pending;
        return {
          ...request,
          status: 'verified',
          destinationRoot: path.join(
            request.projectRoot,
            'ai',
            request.machineIdentity,
            'System',
            'Views',
          ),
        };
      }),
    };
    const coordinator = createViewReadinessCoordinator({ migrationService, machineIdentity: 'Machine' });
    const root = path.resolve('/tmp/fusion-readiness-owner');
    const first = coordinator.ensureReady({ workspaceId: 'first', projectRoot: root });
    await expect(coordinator.ensureReady({ workspaceId: 'second', projectRoot: root }))
      .rejects.toMatchObject({ code: 'workspace_identity_mismatch' });
    release();
    await first;
    await expect(coordinator.ensureReady({ workspaceId: 'first', projectRoot: `${root}-other` }))
      .rejects.toMatchObject({ code: 'workspace_identity_mismatch' });
  });

  test('pre-cutover both-absent readiness requires explicit viewless scaffold policy', async () => {
    const fixture = await createFixture();
    try {
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      readinessRuntime.installViewReadinessOwner(adapter);
      await expect(buildPanelConfig(fixture.projectRoot, fixture.workspaceId)).resolves.toEqual({
        type: 'panel_config',
        projectRoot: fixture.projectRoot,
        projectName: path.basename(fixture.projectRoot),
        viewRegistryUnavailable: { code: 'view_registry_unavailable' },
      });
      await expect(adapter.ensureReady({
        ...requestFor(fixture),
        allowViewless: true,
      })).resolves.toMatchObject({
        status: 'staged',
        phase: 'precutover_staged',
        verified: false,
      });
      const lease = adapter.acquireLease({
        ...requestFor(fixture),
        allowViewless: true,
      });
      expect(lease).toMatchObject({ phase: 'precutover_staged', verified: false });
      expect(lease.viewsRoot).toContain(`${path.sep}Views`);
      expect(lease.viewsRoot).not.toContain(`${path.sep}System${path.sep}Views`);
      lease.release();

      const scaffoldAdapter = createPreCutoverViewReadinessAdapter({
        machineIdentity: fixture.machineIdentity,
      });
      expect(() => scaffoldAdapter.acquireLease({ projectRoot: fixture.projectRoot }))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      const scaffoldLease = scaffoldAdapter.acquireLease({
        projectRoot: fixture.projectRoot,
        allowViewless: true,
      });
      expect(scaffoldLease).toMatchObject({ phase: 'precutover_staged', verified: false });
      fs.mkdirSync(scaffoldLease.viewsRoot, { recursive: true });
      scaffoldLease.release();
      expect(() => scaffoldLease.completeViewlessScaffold(scaffoldLease.viewsRoot))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      expect(() => scaffoldAdapter.acquireLease({ projectRoot: fixture.projectRoot }))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      await expect(scaffoldAdapter.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
      await expect(scaffoldAdapter.ensureReady({
        ...requestFor(fixture),
        allowViewless: true,
      })).resolves.toMatchObject({ status: 'staged', verified: false });
      expect(() => scaffoldAdapter.acquireLease(requestFor(fixture)))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));

      const completingLease = scaffoldAdapter.acquireLease({
        ...requestFor(fixture),
        allowViewless: true,
      });
      const wrongMachineRoot = path.join(fixture.projectRoot, 'ai', 'Other-Machine', 'Views');
      fs.mkdirSync(wrongMachineRoot, { recursive: true });
      expect(() => completingLease.completeViewlessScaffold(wrongMachineRoot))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      expect(() => scaffoldAdapter.acquireLease({ projectRoot: fixture.projectRoot }))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      completingLease.completeViewlessScaffold(completingLease.viewsRoot);
      completingLease.release();
      const ordinaryAfterScaffold = scaffoldAdapter.acquireLease({
        projectRoot: fixture.projectRoot,
      });
      ordinaryAfterScaffold.release();
    } finally {
      await fixture.cleanup();
    }
  });

  test('normal staged leases cannot enter canonical bootstrap after cutover', async () => {
    const fixture = await createFixture(null, 'existing-bootstrap');
    const oldMachine = process.env.FUSION_LOCAL_MACHINE;
    try {
      process.env.FUSION_LOCAL_MACHINE = fixture.machineIdentity;
      writeCapsule(fixture.oldRoot);
      const adapter = createPreCutoverViewReadinessAdapter({
        machineIdentity: fixture.machineIdentity,
      });
      readinessRuntime.installViewReadinessOwner(adapter);
      await adapter.ensureReady(requestFor(fixture));
      const lease = adapter.acquireLease(requestFor(fixture));
      expect(lease.completeViewlessScaffold).toBeUndefined();
      lease.release();
      expect(() => bootstrapService.bootstrap(fixture.projectRoot))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
    } finally {
      if (oldMachine == null) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = oldMachine;
      await fixture.cleanup();
    }
  });

  test('bootstrap rejects a machine-root mismatch before creating partial directories', async () => {
    const fixture = await createFixture(null, 'bootstrap-machine-mismatch');
    const oldMachine = process.env.FUSION_LOCAL_MACHINE;
    try {
      process.env.FUSION_LOCAL_MACHINE = 'Other-Machine';
      installHistoricalReadinessFixture('Lease-Machine');
      const wrongMachineRoot = path.join(fixture.projectRoot, 'ai', 'Other-Machine');
      const leaseMachineRoot = path.join(fixture.projectRoot, 'ai', 'Lease-Machine');

      expect(() => bootstrapService.bootstrap(fixture.projectRoot))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      expect(fs.existsSync(wrongMachineRoot)).toBe(false);
      expect(fs.existsSync(leaseMachineRoot)).toBe(false);
    } finally {
      if (oldMachine == null) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = oldMachine;
      await fixture.cleanup();
    }
  });

  test('concurrent both-absent readiness cannot borrow or suppress explicit viewless policy', async () => {
    const fixture = await createFixture(null, 'concurrent-viewless-policy');
    try {
      const request = requestFor(fixture);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      const ordinary = adapter.ensureReady(request);
      const authorized = adapter.ensureReady({ ...request, allowViewless: true });
      await expect(ordinary).rejects.toMatchObject({ code: 'view_registry_unavailable' });
      await expect(authorized).resolves.toMatchObject({
        status: 'staged', phase: 'precutover_staged', verified: false,
      });
      expect(adapter.getStatus(request)).toMatchObject({ status: 'staged', verified: false });
      expect(() => adapter.acquireLease(request))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      const authorizedLease = adapter.acquireLease({ ...request, allowViewless: true });
      authorizedLease.release();

      const inverse = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      const authorizedFirst = inverse.ensureReady({ ...request, allowViewless: true });
      const ordinarySecond = inverse.ensureReady(request);
      const ordinarySecondRejection = expect(ordinarySecond).rejects.toMatchObject({
        code: 'view_registry_unavailable',
      });
      await expect(authorizedFirst).resolves.toMatchObject({
        status: 'staged', phase: 'precutover_staged', verified: false,
      });
      await ordinarySecondRejection;
      expect(inverse.getStatus(request)).toMatchObject({ status: 'staged', verified: false });
      expect(() => inverse.acquireLease(request))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      const inverseLease = inverse.acquireLease({ ...request, allowViewless: true });
      inverseLease.release();
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['authorized-first', true],
    ['ordinary-first', false],
  ])('concrete coordinator isolates concurrent viewless policy: %s', async (_name, authorizedFirst) => {
    const fixture = await createFixture(null, `concrete-viewless-${authorizedFirst ? 'authorized' : 'ordinary'}`);
    try {
      const coordinator = createViewReadinessCoordinator({
        migrationService: serviceFor(fixture),
        machineIdentity: fixture.machineIdentity,
      });
      const request = requestFor(fixture);
      let authorized;
      let ordinary;
      if (authorizedFirst) {
        authorized = coordinator.ensureReady({ ...request, allowViewless: true });
        ordinary = coordinator.ensureReady(request);
      } else {
        ordinary = coordinator.ensureReady(request);
        authorized = coordinator.ensureReady({ ...request, allowViewless: true });
      }

      await expect(ordinary).rejects.toMatchObject({
        code: authorizedFirst ? 'view_registry_unavailable' : 'viewless_not_allowed',
      });
      await expect(authorized).resolves.toMatchObject({
        status: 'verified', phase: 'journal_verified', verified: true,
      });
      expect(coordinator.getStatus(request)).toMatchObject({ status: 'ready', verified: true });
      const lease = coordinator.acquireLease(request);
      lease.release();
    } finally {
      await fixture.cleanup();
    }
  });

  test('pre-cutover retirement drains leases and revalidates a reattached workspace', async () => {
    const fixture = await createFixture(null, 'staged-retirement');
    try {
      writeCapsule(fixture.oldRoot);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      const request = requestFor(fixture);
      await adapter.ensureReady(request);
      const lease = adapter.acquireLease(request);
      let retired = false;
      const retiring = adapter.retireWorkspace(request).then(() => { retired = true; });
      await Promise.resolve();
      expect(retired).toBe(false);
      expect(adapter.getStatus(request)).toMatchObject({ status: 'unavailable', verified: false });
      expect(() => adapter.acquireLease(request))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));

      lease.release();
      await retiring;
      writeCapsule(fixture.newRoot, { viewId: 'canonical-copy' });
      await expect(adapter.ensureReady(request))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
    } finally {
      await fixture.cleanup();
    }
  });

  test('pre-cutover revalidation waits for admitted leases without invalidating nested resolvers', async () => {
    const fixture = await createFixture(null, 'staged-revalidation-drain');
    try {
      writeCapsule(fixture.oldRoot);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      const request = requestFor(fixture);
      await adapter.ensureReady(request);
      const admitted = adapter.acquireLease(request);
      let revalidated = false;
      const revalidation = adapter.ensureReady(request).then((result) => {
        revalidated = true;
        return result;
      });
      await Promise.resolve();
      expect(revalidated).toBe(false);
      expect(adapter.getStatus(request)).toMatchObject({ status: 'staged', leases: 1 });

      const nested = adapter.acquireLease(request);
      expect(adapter.getStatus(request)).toMatchObject({ status: 'staged', leases: 2 });
      nested.release();
      await Promise.resolve();
      expect(revalidated).toBe(false);

      admitted.release();
      await expect(revalidation).resolves.toMatchObject({
        status: 'staged',
        phase: 'precutover_staged',
        verified: false,
      });
      expect(adapter.getStatus(request)).toMatchObject({ status: 'staged', leases: 0 });
    } finally {
      await fixture.cleanup();
    }
  });

  test('pre-cutover retirement blocks no-record and in-flight preparation races', async () => {
    const fixture = await createFixture(null, 'staged-preparation-retirement');
    try {
      writeCapsule(fixture.oldRoot);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      const request = requestFor(fixture);
      let signalDeletion;
      let finishDeletion;
      const deletionStarted = new Promise(resolve => { signalDeletion = resolve; });
      const deletionPending = new Promise(resolve => { finishDeletion = resolve; });
      const noRecordRetirement = adapter.retireWorkspace(request, async () => {
        signalDeletion();
        await deletionPending;
        return true;
      });

      await deletionStarted;
      await expect(adapter.ensureReady(request))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
      finishDeletion();
      await noRecordRetirement;

      const preparing = adapter.ensureReady(request);
      const preparingRetirement = adapter.retireWorkspace(request);
      await expect(preparing).rejects.toMatchObject({ code: 'view_registry_unavailable' });
      await expect(preparingRetirement).resolves.toBe(true);
      await expect(adapter.ensureReady(request)).resolves.toMatchObject({
        status: 'staged',
        phase: 'precutover_staged',
        verified: false,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  test('duplicate pre-cutover retirement shares one deletion effect and tombstone lifetime', async () => {
    const fixture = await createFixture(null, 'staged-duplicate-retirement');
    try {
      writeCapsule(fixture.oldRoot);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      const request = requestFor(fixture);
      await adapter.ensureReady(request);
      let signalDeletion;
      let finishDeletion;
      const deletionStarted = new Promise(resolve => { signalDeletion = resolve; });
      const deletionPending = new Promise(resolve => { finishDeletion = resolve; });
      const firstEffect = jest.fn(async () => {
        signalDeletion();
        await deletionPending;
        return 'deleted';
      });
      const secondEffect = jest.fn(async () => 'must-not-run');

      const first = adapter.retireWorkspace(request, firstEffect);
      await deletionStarted;
      const second = adapter.retireWorkspace(request, secondEffect);
      await expect(adapter.ensureReady(request))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
      expect(firstEffect).toHaveBeenCalledTimes(1);
      expect(secondEffect).not.toHaveBeenCalled();

      finishDeletion();
      await expect(Promise.all([first, second])).resolves.toEqual(['deleted', 'deleted']);
      expect(firstEffect).toHaveBeenCalledTimes(1);
      expect(secondEffect).not.toHaveBeenCalled();
    } finally {
      await fixture.cleanup();
    }
  });

  test('pre-cutover adapter fails closed when canonical bytes already exist', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.newRoot);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      await expect(adapter.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
      expect(adapter.getStatus(requestFor(fixture))).toMatchObject({
        status: 'unavailable',
        verified: false,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['noncanonical', '---\nmetadata:\n  view-id: INVALID\n---\n'],
    ['nested', '---\nmetadata:\n  nested:\n    view-id: nested-identity\n---\n'],
    ['prototype-key nested', '---\nmetadata:\n  __proto__:\n    view-id: nested-identity\n---\n'],
  ])('pre-cutover adapter does not publish a %s retired-tree identity', async (_name, manifest) => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      require('fs').writeFileSync(
        path.join(capsule, 'manifest.md'),
        manifest,
      );
      installHistoricalReadinessFixture(fixture.machineIdentity);
      await expect(buildPanelConfig(fixture.projectRoot, fixture.workspaceId)).resolves.toEqual({
        type: 'panel_config',
        projectRoot: fixture.projectRoot,
        projectName: path.basename(fixture.projectRoot),
        viewRegistryUnavailable: { code: 'view_registry_unavailable' },
      });
      expect(require('fs').existsSync(fixture.oldRoot)).toBe(true);
      expect(require('fs').existsSync(fixture.newRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({
        workspace_id: fixture.workspaceId,
      })).resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['broken relative', (fixture, capsule) => require('fs').symlinkSync(
      'missing.txt', path.join(capsule, 'invalid-link'),
    )],
    ['escaping relative', (fixture, capsule) => require('fs').symlinkSync(
      '../../../../outside.txt', path.join(capsule, 'invalid-link'),
    )],
    ['absolute external', (fixture, capsule) => {
      const external = path.join(fixture.tempRoot, 'external.txt');
      require('fs').writeFileSync(external, 'external', 'utf8');
      require('fs').symlinkSync(external, path.join(capsule, 'invalid-link'));
    }],
  ])(
    'pre-cutover adapter rejects %s symlink before panel publication',
    async (_name, installLink) => {
      const fixture = await createFixture();
      try {
        const capsule = writeCapsule(fixture.oldRoot);
        installLink(fixture, capsule);
        installHistoricalReadinessFixture(fixture.machineIdentity);

        await expect(buildPanelConfig(fixture.projectRoot, fixture.workspaceId)).resolves.toEqual({
          type: 'panel_config',
          projectRoot: fixture.projectRoot,
          projectName: path.basename(fixture.projectRoot),
          viewRegistryUnavailable: { code: 'view_registry_unavailable' },
        });
        expect(require('fs').existsSync(fixture.oldRoot)).toBe(true);
        expect(require('fs').existsSync(fixture.newRoot)).toBe(false);
        await expect(fixture.db('view_capsule_relocations').where({
          workspace_id: fixture.workspaceId,
        })).resolves.toEqual([]);
      } finally {
        await fixture.cleanup();
      }
    },
  );

  test('pre-cutover adapter rejects special files before panel publication', async () => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      expect(spawnSync('mkfifo', [path.join(capsule, 'special.fifo')]).status).toBe(0);
      installHistoricalReadinessFixture(fixture.machineIdentity);

      await expect(buildPanelConfig(fixture.projectRoot, fixture.workspaceId)).resolves.toEqual({
        type: 'panel_config',
        projectRoot: fixture.projectRoot,
        projectName: path.basename(fixture.projectRoot),
        viewRegistryUnavailable: { code: 'view_registry_unavailable' },
      });
    } finally {
      await fixture.cleanup();
    }
  });

  test('synthetic scaffold leases cannot bypass validation of an existing source tree', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      expect(() => adapter.acquireLease({ projectRoot: fixture.projectRoot }))
        .toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
    } finally {
      await fixture.cleanup();
    }
  });

  test('both-absent staged readiness rejects unsafe ancestry before scaffold can write', async () => {
    const fixture = await createFixture();
    try {
      const fs = require('fs');
      const externalAi = path.join(fixture.tempRoot, 'external-ai');
      fs.rmSync(path.join(fixture.projectRoot, 'ai'), { recursive: true, force: true });
      fs.mkdirSync(externalAi);
      fs.symlinkSync(externalAi, path.join(fixture.projectRoot, 'ai'));
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });

      await expect(adapter.ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_registry_unavailable' });
      expect(() => {
        readinessRuntime.installViewReadinessOwner(adapter);
        require('../../lib/workspace/bootstrap-service').bootstrap(fixture.projectRoot);
      }).toThrow(expect.objectContaining({ code: 'view_registry_unavailable' }));
      expect(fs.existsSync(path.join(externalAi, fixture.machineIdentity))).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });

  test('pre-cutover adapter keeps a missing registered workspace unavailable', async () => {
    const fixture = await createFixture();
    try {
      const adapter = createPreCutoverViewReadinessAdapter({ machineIdentity: fixture.machineIdentity });
      await expect(adapter.ensureReady({
        workspaceId: 'missing-workspace',
        projectRoot: path.join(fixture.tempRoot, 'missing-workspace'),
      })).rejects.toMatchObject({ code: 'view_registry_unavailable' });
    } finally {
      await fixture.cleanup();
    }
  });

  test('existing-workspace bootstrap holds the shared readiness lease while scaffolding', async () => {
    const fixture = await createFixture();
    const oldMachine = process.env.FUSION_LOCAL_MACHINE;
    const release = jest.fn();
    const acquireLease = jest.fn(() => ({
      phase: 'journal_verified',
      verified: true,
      projectRoot: fixture.projectRoot,
      release,
      viewsRoot: fixture.newRoot,
    }));
    process.env.FUSION_LOCAL_MACHINE = fixture.machineIdentity;
    readinessRuntime.installViewReadinessOwner({
      ensureReady: async () => ({ status: 'verified' }),
      acquireLease,
      getStatus: () => ({ status: 'ready', verified: true }),
    });
    try {
      require('../../lib/workspace/bootstrap-service').bootstrap(fixture.projectRoot);
      expect(acquireLease).toHaveBeenCalledWith({ projectRoot: fixture.projectRoot });
      expect(release).toHaveBeenCalledTimes(1);
    } finally {
      if (oldMachine == null) delete process.env.FUSION_LOCAL_MACHINE;
      else process.env.FUSION_LOCAL_MACHINE = oldMachine;
      await fixture.cleanup();
    }
  });

  test('staged panel publication is unavailable and omits the canonical capsule projection', async () => {
    const fixture = await createFixture();
    writeCapsule(fixture.oldRoot);
    const listSpy = jest.spyOn(views, 'listViews').mockReturnValue([]);
    const projectionSpy = jest.spyOn(views, 'buildViewCapsulesProjection');
    installHistoricalReadinessFixture(fixture.machineIdentity);
    try {
      await expect(buildPanelConfig(fixture.projectRoot, fixture.workspaceId)).resolves.toEqual({
        type: 'panel_config',
        projectRoot: fixture.projectRoot,
        projectName: path.basename(fixture.projectRoot),
        viewRegistryUnavailable: { code: 'view_registry_unavailable' },
      });
      expect(projectionSpy).toHaveBeenCalledTimes(1);
    } finally {
      listSpy.mockRestore();
      projectionSpy.mockRestore();
      await fixture.cleanup();
    }
  });

  test('panel publication returns only bounded unavailable instead of an empty legacy registry', async () => {
    readinessRuntime.installViewReadinessOwner({
      phase: 'journal_verified',
      ensureReady: async () => { throw new ViewRelocationError('root_conflict'); },
      acquireLease: () => { throw new ViewRelocationError('view_registry_unavailable'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    await expect(buildPanelConfig('/tmp/conflicted-workspace', 'workspace')).resolves.toEqual({
      type: 'panel_config',
      projectRoot: '/tmp/conflicted-workspace',
      projectName: 'conflicted-workspace',
      viewRegistryUnavailable: { code: 'view_registry_unavailable' },
    });
  });

  test('panel publication performs no discovery until readiness completes', async () => {
    const fixture = await createFixture();
    let signalEntered;
    let release;
    const entered = new Promise(resolve => { signalEntered = resolve; });
    const ready = new Promise(resolve => { release = resolve; });
    const listSpy = jest.spyOn(views, 'listViews').mockReturnValue([]);
    const projectionSpy = jest.spyOn(views, 'buildViewCapsulesProjection').mockReturnValue({
      version: 1,
      workspaceId: fixture.workspaceId,
      machineIdentity: fixture.machineIdentity,
      entries: [],
    });
    readinessRuntime.installViewReadinessOwner({
      phase: 'journal_verified',
      async ensureReady() {
        signalEntered();
        await ready;
        return { status: 'verified' };
      },
      acquireLease: () => ({
        phase: 'journal_verified',
        verified: true,
        release: jest.fn(),
      }),
      getStatus: () => ({ status: 'ready', verified: true }),
    });
    try {
      const publication = buildPanelConfig(fixture.projectRoot, fixture.workspaceId);
      await entered;
      expect(listSpy).not.toHaveBeenCalled();
      expect(projectionSpy).not.toHaveBeenCalled();
      release();
      await expect(publication).resolves.toMatchObject({
        type: 'panel_config',
        projectRoot: fixture.projectRoot,
        panelRoots: {},
      });
      expect(listSpy).toHaveBeenCalledTimes(1);
      expect(projectionSpy).toHaveBeenCalledTimes(1);
    } finally {
      listSpy.mockRestore();
      projectionSpy.mockRestore();
      await fixture.cleanup();
    }
  });

  test('view-owned startup pipeline remains inactive when readiness is unavailable', async () => {
    const startPipeline = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    readinessRuntime.installViewReadinessOwner({
      ensureReady: async () => { throw new ViewRelocationError('view_registry_unavailable'); },
      acquireLease: () => { throw new ViewRelocationError('view_registry_unavailable'); },
      getStatus: () => ({ status: 'unavailable', verified: false }),
    });
    try {
      await expect(startWorkspacePipelineWhenReady({
        sessions: new Map(),
        getProjectRoot: () => '/tmp/unavailable-view-pipeline',
        getWorkspaceId: () => 'unavailable-workspace',
        startPipeline,
      })).resolves.toEqual({ started: false, reason: 'view_registry_unavailable' });
      expect(startPipeline).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
