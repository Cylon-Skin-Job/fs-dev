'use strict';

const fs = require('fs');
const path = require('path');
jest.mock('../../lib/screenshot/ws-handlers', () => jest.fn());
const {
  createAgentPhaseAOwner,
  createAgentWorkspaceRootResolver,
} = require('../../lib/startup');
const {
  createAgentFactAdmissionReconciler,
} = require('../../lib/agent-provenance/fact-admission-reconciler');

describe('event registry startup integration', () => {
  test('workspace-root host adapter exposes only exact lookup and realpath capabilities', async () => {
    const getWorkspaceById = jest.fn(async (workspaceId) => (
      workspaceId === 'workspace-1' ? { repo_path: '/declared/root' } : null
    ));
    const realpath = jest.fn(async (declared) => `${declared}/real`);
    const resolveWorkspaceRoot = createAgentWorkspaceRootResolver({ getWorkspaceById, realpath });
    await expect(resolveWorkspaceRoot('workspace-1')).resolves.toBe('/declared/root/real');
    await expect(resolveWorkspaceRoot('missing')).resolves.toBeNull();
    expect(getWorkspaceById).toHaveBeenCalledTimes(2);
    expect(realpath).toHaveBeenCalledTimes(1);
    realpath.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    await expect(resolveWorkspaceRoot('workspace-1')).resolves.toBeNull();
  });

  test('initializes after migration and before handlers, subscribers, facts, watchers, or listen', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../lib/startup.js'), 'utf8');
    const dbInit = source.indexOf('await initDb();');
    const registryInit = source.indexOf('await initializeEventRegistry(getDb(), {');
    const projectionPublishers = source.indexOf('createResourceProjectionPublishers({');
    const projectionHandler = source.indexOf("'system.resource-render-projection': createResourceRenderProjectionHandler()");
    const controllerStart = source.indexOf('await subscriptionController.start();');
    const admissionSeal = source.indexOf('bootstrapFileProvenanceAdmission({');
    const announcedRecovery = source.indexOf(
      'await announcedActivityReconciler.start();',
    );
    const agentAdmissionRecovery = source.indexOf(
      'await agentFactAdmissionOwner.start();',
    );
    const agentLedgerRecovery = source.indexOf(
      'await agentLedgerOwner.start();',
    );
    const rendererProjectionRecovery = source.indexOf(
      'await rendererProjectionOwner.start();',
    );
    const reconciliation = source.indexOf('await fileSaveOwner.reconcile();');
    const routeInstall = source.indexOf('installProtocolRoutes(Object.freeze({');
    const handlers = source.indexOf('const fusionHandlers = createFusionHandlers');
    const audit = source.indexOf('startAuditSubscriber({ enableAgentExchangeBinding: true });');
    const listen = source.indexOf('server.listen(PORT');
    const enableAdmission = source.indexOf('agentFactAdmissionOwner.enableContinuations()');
    const enableLedger = source.indexOf('agentLedgerOwner.enableContinuations()');
    const enableObservation = source.indexOf('observationOwner.enableContinuations()');
    const enableRendererProjection = source.indexOf('rendererProjectionOwner.enableContinuations()');
    const watcher = source.indexOf("require('./watch/workspace-watcher')");

    expect(dbInit).toBeGreaterThan(-1);
    expect(registryInit).toBeGreaterThan(dbInit);
    expect(projectionPublishers).toBeGreaterThan(registryInit);
    expect(projectionHandler).toBeGreaterThan(projectionPublishers);
    expect(controllerStart).toBeGreaterThan(registryInit);
    expect(admissionSeal).toBeGreaterThan(controllerStart);
    expect(announcedRecovery).toBeGreaterThan(admissionSeal);
    expect(agentAdmissionRecovery).toBeGreaterThan(announcedRecovery);
    expect(agentLedgerRecovery).toBeGreaterThan(agentAdmissionRecovery);
    expect(rendererProjectionRecovery).toBeGreaterThan(agentLedgerRecovery);
    expect(reconciliation).toBeGreaterThan(admissionSeal);
    expect(routeInstall).toBeGreaterThan(reconciliation);
    expect(listen).toBeGreaterThan(routeInstall);
    expect(handlers).toBeGreaterThan(admissionSeal);
    expect(audit).toBeGreaterThan(admissionSeal);
    expect(listen).toBeGreaterThan(admissionSeal);
    const deferAnnounced = source.indexOf('announcedActivityReconciler.deferContinuations()');
    const deferAdmission = source.indexOf('agentFactAdmissionOwner.deferContinuations()');
    const deferLedger = source.indexOf('agentLedgerOwner.deferContinuations()');
    const deferObservation = source.indexOf('observationOwner.deferContinuations()');
    expect(deferAnnounced).toBeGreaterThan(admissionSeal);
    expect(deferAdmission).toBeGreaterThan(deferAnnounced);
    expect(deferLedger).toBeGreaterThan(deferAdmission);
    expect(deferObservation).toBeGreaterThan(deferLedger);
    expect(announcedRecovery).toBeGreaterThan(deferObservation);
    expect(enableAdmission).toBeGreaterThan(listen);
    expect(enableLedger).toBeGreaterThan(listen);
    expect(enableObservation).toBeGreaterThan(listen);
    expect(enableRendererProjection).toBeGreaterThan(listen);
    expect(watcher).toBeGreaterThan(listen);
    expect(source).toContain("'system.agent-provenance-ledger'");
    expect(source).not.toContain('broadcastLegacyFileChanged');
    expect(source).not.toContain("type: 'file_changed'");
  });

  test('owns one dedicated zero-wait reconciliation database and closes it in Phase A', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../lib/startup.js'), 'utf8');
    const create = source.indexOf('await createAgentReconciliationDb(getDb())');
    const authority = source.indexOf('createAgentFactAuthorityRepository(agentReconciliationDb');
    const ledger = source.indexOf('createAgentLedgerRepository(agentReconciliationDb');
    const announced = source.indexOf('db: agentReconciliationDb');
    const activeTurns = source.indexOf('shutdownActiveTurns: shutdownActiveTurnLifecycles');
    const auditSaves = source.indexOf('      drainAuditSaves,', activeTurns);
    const activityOwners = source.indexOf('shutdownActivityOwners: shutdownSharedAgentActivityOwners');
    const destroy = source.indexOf('closeReconciliationDatabase: () => agentReconciliationDb.destroy()');
    const primaryClose = source.indexOf('closeDatabase: closeDb');
    expect(create).toBeGreaterThan(-1);
    expect(authority).toBeGreaterThan(create);
    expect(ledger).toBeGreaterThan(authority);
    expect(announced).toBeGreaterThan(ledger);
    expect(activeTurns).toBeGreaterThan(announced);
    expect(auditSaves).toBeGreaterThan(activeTurns);
    expect(activityOwners).toBeGreaterThan(activeTurns);
    expect(destroy).toBeGreaterThan(activityOwners);
    expect(destroy).toBeGreaterThan(announced);
    expect(primaryClose).toBeGreaterThan(destroy);
    expect(source.match(/createAgentReconciliationDb\(getDb\(\)\)/gu)).toHaveLength(1);
    expect(source).toContain('onTerminalReserved: () => agentFactAdmissionOwner.signal()');
  });

  test('Phase A starts independent recovery concurrently but never starts dependent cleanup at equality', async () => {
    let clock = 0;
    let releaseActive;
    const active = new Promise((resolve) => { releaseActive = resolve; });
    const order = [];
    const owner = createAgentPhaseAOwner({
      shutdownActiveTurns: async () => { order.push('active-start'); await active; order.push('active-end'); },
      drainAuditSaves: async () => { order.push('audit'); },
      shutdownActivityOwners: async () => { order.push('activity'); },
      announcedOwner: { shutdown: async () => { order.push('announced'); } },
      admissionOwner: { shutdown: async () => { order.push('admission'); } },
      ledgerOwner: { shutdown: async () => { order.push('ledger'); } },
      closeReconciliationDatabase: async () => { order.push('database'); },
      monotonicNow: () => clock,
    });

    const shutdown = owner({ deadline: 5_000, timeoutMs: 5_000 });
    await Promise.resolve();
    expect(order).toEqual(['announced', 'active-start']);
    clock = 5_000;
    releaseActive();
    await shutdown;
    expect(order).toEqual(['announced', 'active-start', 'active-end']);
  });

  test('Phase A starts post-finalizer provenance drains concurrently before DB close', async () => {
    let clock = 0;
    const order = [];
    const releases = {};
    const drain = (label) => async () => {
      order.push(`${label}-start`);
      await new Promise((resolve) => { releases[label] = resolve; });
      order.push(`${label}-end`);
      clock += 1;
    };
    const owner = createAgentPhaseAOwner({
      shutdownActiveTurns: async () => { order.push('active'); clock += 1; },
      drainAuditSaves: drain('audit'),
      shutdownActivityOwners: drain('activity'),
      announcedOwner: { shutdown: async () => { order.push('announced'); clock += 1; } },
      admissionOwner: { shutdown: drain('admission') },
      ledgerOwner: { shutdown: drain('ledger') },
      closeReconciliationDatabase: async () => { order.push('database'); clock += 1; },
      monotonicNow: () => clock,
    });

    const shutdown = owner({ deadline: 5_000, timeoutMs: 5_000 });
    for (let attempt = 0; attempt < 10 && Object.keys(releases).length < 4; attempt += 1) {
      await Promise.resolve();
    }
    expect(Object.keys(releases).sort()).toEqual(['activity', 'admission', 'audit', 'ledger']);
    expect(order.indexOf('active')).toBeLessThan(order.indexOf('activity-start'));
    expect(order.indexOf('active')).toBeLessThan(order.indexOf('admission-start'));
    expect(order.indexOf('active')).toBeLessThan(order.indexOf('ledger-start'));
    expect(order.indexOf('active')).toBeLessThan(order.indexOf('audit-start'));
    releases.activity();
    releases.admission();
    releases.audit();
    releases.ledger();
    await shutdown;

    expect(order[0]).toBe('announced');
    expect(order.at(-1)).toBe('database');
  });

  test('Phase A waits for audit saves before binder shutdown while unrelated owners drain concurrently', async () => {
    const order = [];
    let releaseAudit;
    let releaseBinder;
    const owner = createAgentPhaseAOwner({
      shutdownActiveTurns: async () => { order.push('active'); return true; },
      drainAuditSaves: async () => {
        order.push('audit-start');
        await new Promise((resolve) => { releaseAudit = resolve; });
        order.push('audit-end');
        return true;
      },
      shutdownActivityOwners: async () => { order.push('activity'); return true; },
      binderOwner: { shutdown: async () => {
        order.push('binder-start');
        await new Promise((resolve) => { releaseBinder = resolve; });
        order.push('binder-end');
        return true;
      } },
      announcedOwner: { shutdown: async () => { order.push('announced'); return true; } },
      admissionOwner: { shutdown: async () => { order.push('admission'); return true; } },
      ledgerOwner: { shutdown: async () => { order.push('ledger'); return true; } },
      closeReconciliationDatabase: async () => { order.push('database'); },
      monotonicNow: () => 0,
    });
    const shutdown = owner({ deadline: 5_000, timeoutMs: 5_000 });
    for (let attempt = 0; attempt < 10 && !releaseAudit; attempt += 1) await Promise.resolve();
    expect(order).toEqual(expect.arrayContaining(['announced', 'active', 'audit-start', 'activity', 'admission', 'ledger']));
    expect(order).not.toContain('binder-start');
    releaseAudit();
    for (let attempt = 0; attempt < 10 && !releaseBinder; attempt += 1) await Promise.resolve();
    expect(order.indexOf('audit-end')).toBeLessThan(order.indexOf('binder-start'));
    releaseBinder();
    await expect(shutdown).resolves.toBe(true);
    expect(order.at(-1)).toBe('database');
  });

  test('Phase A does not sum independent provenance-owner drain budgets', async () => {
    const wait = () => new Promise((resolve) => setTimeout(resolve, 30));
    const startedAt = performance.now();
    const owner = createAgentPhaseAOwner({
      shutdownActiveTurns: wait,
      drainAuditSaves: wait,
      shutdownActivityOwners: wait,
      announcedOwner: { shutdown: wait },
      admissionOwner: { shutdown: wait },
      ledgerOwner: { shutdown: wait },
      closeReconciliationDatabase: async () => {},
      monotonicNow: () => performance.now(),
    });

    await expect(owner({ deadline: startedAt + 100, timeoutMs: 100 })).resolves.toBe(true);
  });

  test('Phase A propagates an actual admission-owner local timeout and skips causal dependents', async () => {
    let releaseSelection;
    const selection = new Promise((resolve) => { releaseSelection = resolve; });
    const authority = {
      listPending: jest.fn(() => selection),
      createPublishInput: jest.fn(),
      markConflict: jest.fn(),
    };
    const admissionOwner = createAgentFactAdmissionReconciler({
      authority,
      setTimer: (callback) => {
        callback();
        return { unref() {} };
      },
      clearTimer: () => {},
    });
    admissionOwner.installPublishers({
      publishAgentToolCompleted: jest.fn(),
      publishResourceStateObserved: jest.fn(),
    });
    const admissionStart = admissionOwner.start();
    await new Promise((resolve) => setImmediate(resolve));
    const order = [];
    const owner = createAgentPhaseAOwner({
      shutdownActiveTurns: async () => { order.push('active'); return true; },
      drainAuditSaves: async () => { order.push('audit'); return true; },
      shutdownActivityOwners: async () => { order.push('activity'); return true; },
      announcedOwner: { shutdown: async () => { order.push('announced'); return true; } },
      admissionOwner,
      ledgerOwner: { shutdown: async () => { order.push('ledger'); return true; } },
      closeReconciliationDatabase: async () => { order.push('database'); },
      monotonicNow: () => 0,
    });

    await expect(owner({ deadline: 5_000, timeoutMs: 5_000 })).resolves.toBe(false);
    expect(order).toEqual(expect.arrayContaining(['announced', 'active', 'audit', 'activity', 'ledger']));
    expect(order).not.toContain('database');
    releaseSelection([]);
    await admissionStart;
    expect(authority.createPublishInput).not.toHaveBeenCalled();
  });

  test('awaits registry infrastructure errors while row-local errors remain data diagnostics', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../lib/startup.js'), 'utf8');
    expect(source).toContain('await initializeEventRegistry(getDb(), {');
    const start = source.indexOf('await initializeEventRegistry(getDb(), {');
    const end = source.indexOf('\n  });', start) + '\n  });'.length;
    expect(source.slice(start, end)).not.toContain('.catch');
  });
});
