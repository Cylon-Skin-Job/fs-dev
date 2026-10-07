'use strict';

const fs = require('fs');
const path = require('path');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Observe real readiness and consumer owners. Gates delay real migration or
// retirement; no fixture manufactures a verified result or an admitted lease.
function observeStartupReadiness({ serverRoot, workspaces, machine, options, consumers }) {
  const runtime = require(path.join(serverRoot, 'lib/views/readiness-runtime'));
  const context = { projectRoot: workspaces[0].repoPath, workspaceId: workspaces[0].id };
  const events = [];
  const stages = [];
  const spies = [];
  const preparationEntered = deferred();
  const operationEntered = deferred();
  const preparationGate = deferred();
  const retirementGate = deferred();
  const previousScriptObserver = global.__startupScratchScript;
  let owner;
  let registeredStatus;
  let preparation;
  let retirement;
  let retirementCompleted = false;
  let lateAdmission;
  let leaseDenial;

  const install = runtime.installViewReadinessOwner;
  spies.push(jest.spyOn(runtime, 'installViewReadinessOwner').mockImplementation(nextOwner => {
    owner = nextOwner;
    return install({
      ...nextOwner,
      async ensureReady(input) {
        events.push({ kind: 'ensure', input: { ...input } });
        const result = await nextOwner.ensureReady(input);
        events.push({ kind: 'verified', input: { ...input }, result });
        return result;
      },
      acquireLease(input) {
        events.push({ kind: 'acquire', input: { ...input } });
        const lease = nextOwner.acquireLease(input);
        events.push({ kind: 'acquired', input: { ...input }, status: nextOwner.getStatus(input), lease });
        return {
          ...lease,
          release() {
            lease.release();
            events.push({ kind: 'released', status: nextOwner.getStatus(input) });
          },
        };
      },
    });
  }));

  function beginRetirement() {
    retirement = runtime.retireWorkspaceViewReadiness(context, async () => {
      events.push({ kind: 'retirement-effect', status: owner.getStatus(context) });
      if (options.holdRetirement) await retirementGate.promise;
      retirementCompleted = true;
      return true;
    });
    lateAdmission = runtime.ensureWorkspaceViewReadiness(context).then(
      () => ({ unexpectedlyAdmitted: true }), error => ({ code: error.code }),
    );
    try { runtime.acquireViewReadinessLease(context); }
    catch (error) { leaseDenial = error.code; }
  }

  const ensureOperation = runtime.ensureWorkspaceViewReadiness;
  spies.push(jest.spyOn(runtime, 'ensureWorkspaceViewReadiness').mockImplementation(async input => {
    events.push({ kind: 'operation-ensure', input: { ...input } });
    operationEntered.resolve();
    const result = await ensureOperation(input);
    if (options.retireBeforeAcquire) beginRetirement();
    return result;
  }));

  function observeStage(name, details = {}) {
    stages.push({ name, details, status: runtime.getViewReadinessStatus(context), retirementCompleted });
    if (name === 'script' && options.retireDuringScript) beginRetirement();
  }
  global.__startupScratchScript = scriptRoot => observeStage('script', { scriptRoot });
  const views = require(path.join(serverRoot, 'lib/views'));
  for (const name of ['resolveViewRoot', 'resolveOperationalViewRoot']) {
    const original = views[name];
    spies.push(jest.spyOn(views, name).mockImplementation((...args) => {
      observeStage(name, { projectRoot: args[0], viewId: args[1] });
      return original(...args);
    }));
  }
  for (const [module, name, stage] of [
    [consumers.components, 'loadComponents', 'components'],
    [consumers.actions, 'createActionHandlers', 'actions'],
    [consumers.runner, 'checkHeartbeats', 'runner'],
    [require(path.join(serverRoot, 'lib/triggers/trigger-loader')), 'loadTriggers', 'triggers'],
  ]) {
    // Existing fixture spies retain the original implementation in consumers.
    const call = consumers.originals?.[name] || module[name];
    const spy = jest.isMockFunction(module[name]) ? module[name] : jest.spyOn(module, name);
    spy.mockImplementation((...args) => {
      observeStage(stage, { projectRoot: stage === 'actions' ? args[0].projectRoot : args[0] });
      if (stage === 'components' && options.failPipeline) throw new Error('scratch downstream initialization failure');
      return call(...args);
    });
    if (!consumers.originals?.[name]) spies.push(spy);
  }

  const controller = require(path.join(serverRoot, 'lib/workspace/workspace-controller'));
  const originalStart = controller.start;
  spies.push(jest.spyOn(controller, 'start').mockImplementation(async (...args) => {
    const result = await originalStart(...args);
    registeredStatus = runtime.getViewReadinessStatus(context);
    events.push({ kind: 'registered-pass', status: registeredStatus });
    // View discovery during controller initialization is not pipeline work.
    stages.length = 0;
    if (options.missingId) {
      spies.push(jest.spyOn(controller, 'getActiveWorkspaceId').mockReturnValue(null));
    }
    if (options.preparing) {
      const { createViewReadinessCoordinator } = require(path.join(serverRoot, 'lib/views/readiness-coordinator'));
      const { createViewRelocationService } = require(path.join(serverRoot, 'lib/views/relocation-service'));
      const migration = createViewRelocationService({ db: require(path.join(serverRoot, 'lib/db')).getDb() });
      runtime.installViewReadinessOwner(createViewReadinessCoordinator({
        machineIdentity: machine,
        migrationService: {
          async ensureReady(input) {
            preparationEntered.resolve();
            await preparationGate.promise;
            return migration.ensureReady(input);
          },
        },
      }));
      preparation = owner.ensureReady(context);
      // Attach a handler immediately; cleanup still awaits the real operation.
      preparation.catch(() => {});
    }
    if (options.retiring) beginRetirement();
    return result;
  }));

  return {
    runtime, context, events, stages, observeStage,
    get registeredStatus() { return registeredStatus; },
    get retirementCompleted() { return retirementCompleted; },
    get retirement() { return retirement; },
    get lateAdmission() { return lateAdmission; },
    get leaseDenial() { return leaseDenial; },
    preparationEntered: preparationEntered.promise,
    operationEntered: operationEntered.promise,
    releasePreparation: preparationGate.resolve,
    releaseRetirement: retirementGate.resolve,
    async finish() {
      preparationGate.resolve();
      retirementGate.resolve();
      await preparation?.catch(() => {});
      await retirement;
      await lateAdmission;
    },
    restore() {
      for (const spy of spies.reverse()) spy.mockRestore();
      if (previousScriptObserver === undefined) delete global.__startupScratchScript;
      else global.__startupScratchScript = previousScriptObserver;
    },
  };
}

function configureStartupViews(workspace, machine, options) {
  const oldRoot = path.join(path.dirname(path.dirname(workspace.viewsRoot)), 'Views');
  if (options.conflict) fs.mkdirSync(oldRoot, { recursive: true });
  if (options.relocate) fs.renameSync(workspace.viewsRoot, oldRoot);
  return { oldRoot, machine };
}

module.exports = { observeStartupReadiness, configureStartupViews };
