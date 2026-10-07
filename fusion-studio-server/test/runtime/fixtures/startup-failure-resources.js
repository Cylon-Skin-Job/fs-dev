'use strict';

const path = require('path');
const { performance } = require('perf_hooks');

// Observe real constructors solely to retain cleanup capabilities when startup
// fails before it publishes the real shutdown handler. No owner is substituted.
function observeStartupResources(serverRoot) {
  const owners = [];
  const databases = [];
  const spies = [];
  for (const [relative, name] of [
    ['agent-provenance/announced-activity-reconciler', 'createAnnouncedActivityReconciler'],
    ['agent-provenance/exchange-binder', 'createAgentExchangeBinder'],
    ['agent-provenance/fact-admission-reconciler', 'createAgentFactAdmissionReconciler'],
    ['agent-provenance/agent-ledger-reconciler', 'createAgentLedgerReconciler'],
    ['agent-provenance/resource-observer', 'createAgentResourceObserver'],
    ['agent-provenance/renderer-projection-scheduler', 'createAgentRendererProjectionOwner'],
    ['subscriptions', 'createSubscriptionController'],
  ]) {
    const module = require(path.join(serverRoot, 'lib', relative));
    const factory = module[name];
    spies.push(jest.spyOn(module, name).mockImplementation((...args) => {
      const owner = factory(...args);
      owners.push(owner);
      return owner;
    }));
  }
  const reconciliation = require(path.join(serverRoot, 'lib/agent-provenance/reconciliation-db'));
  const createDb = reconciliation.createAgentReconciliationDb;
  spies.push(jest.spyOn(reconciliation, 'createAgentReconciliationDb').mockImplementation(async (...args) => {
    const db = await createDb(...args);
    databases.push(db);
    return db;
  }));

  return {
    async cleanupBeforeShutdownPublication() {
      await require(path.join(serverRoot, 'lib/thread/thread-manager-registry')).shutdownThreadManagers();
      await require(path.join(serverRoot, 'lib/audit/audit-subscriber')).drainAuditSaves();
      const options = { deadline: performance.now() + 5_000, timeoutMs: 5_000 };
      for (const owner of owners) owner.quiesce?.();
      await Promise.all(owners.filter(owner => owner.shutdown).map(owner => owner.shutdown(options)));
      await Promise.all(owners.filter(owner => owner.stop).map(owner => owner.stop()));
      await Promise.all(databases.map(db => db.destroy()));
    },
    restore() { for (const spy of spies) spy.mockRestore(); },
  };
}

module.exports = { observeStartupResources };
