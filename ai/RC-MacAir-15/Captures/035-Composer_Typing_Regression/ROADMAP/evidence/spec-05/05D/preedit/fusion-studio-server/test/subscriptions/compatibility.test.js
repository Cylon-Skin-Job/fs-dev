'use strict';

const fs = require('fs');
const path = require('path');
const {
  createHandlerCatalog,
  createScopedCapabilityFactory,
  createSubscriptionController,
} = require('../../lib/subscriptions');
const eventBus = require('../../lib/event-bus');

const EVENT_TYPES = [{ eventType: 'resource.mutated', schemaVersion: 1 }];
const FACT = {
  eventId: 'event-1',
  eventType: 'resource.mutated',
  schemaVersion: 1,
  occurredAt: 1_000,
  workspaceId: 'workspace-1',
  operationId: 'operation-1',
  mutation: { kind: 'modify' },
  resource: {
    resourceId: 'resource-1',
    kind: 'file',
    path: 'notes/a.md',
    access: { panel: 'file-viewer', path: 'notes/a.md' },
  },
};

function effectiveState() {
  return {
    schemas: [{
      effective: true,
      row: {
        schema_key: 'resource.mutated', schema_version: 1, definition_kind: 'event',
        definition_sha256: 'resource-mutated-hash',
      },
    }],
    subscriptions: [],
    diagnostics: [],
    effectiveSubscriptions: [{
      subscriptionId: 'sub-ledger',
      handlerKey: 'system.provenance-ledger',
      priority: 0,
      filter: { eventTypes: EVENT_TYPES },
      deliveryPolicy: 'best_effort',
      grants: [
        { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
        { capabilityKey: 'ledger.append_resource_fact', scope: { workspaceScope: 'event' } },
        {
          capabilityKey: 'diagnostic.write_fixed',
          scope: { codes: ['ledger_duplicate_conflict', 'ledger_write_failed'] },
        },
      ],
    }],
  };
}

describe('governed and legacy event compatibility boundary', () => {
  afterEach(() => {
    eventBus.bus.removeAllListeners('resource.mutated');
    eventBus.bus.removeAllListeners('legacy:follow_up');
  });

  test('legacy raw/follow-up emission never enters governed delivery or loops recursively', async () => {
    let deliverAdmittedFact;
    const governedHandler = jest.fn((fact) => {
      eventBus.emit('legacy:follow_up', {
        eventId: fact.eventId,
        workspaceId: fact.workspaceId,
      });
    });
    const legacyRaw = jest.fn();
    const legacyFollowUp = jest.fn((event) => {
      eventBus.emit('legacy:follow_up', event);
    });
    eventBus.on('resource.mutated', legacyRaw);
    eventBus.on('legacy:follow_up', legacyFollowUp);

    const controller = createSubscriptionController({
      registryAccess: { getEffectiveState: async () => effectiveState() },
      handlerCatalog: createHandlerCatalog({ 'system.provenance-ledger': governedHandler }),
      createScopedContext: createScopedCapabilityFactory({
        appendResourceFact: async () => {},
        writeDiagnostic: () => {},
      }),
      installAdmittedFactDelivery(value) { deliverAdmittedFact = value; },
    });
    await controller.start();

    eventBus.emit('resource.mutated', FACT);
    expect(legacyRaw).toHaveBeenCalledTimes(1);
    expect(governedHandler).not.toHaveBeenCalled();

    await expect(deliverAdmittedFact(FACT)).resolves.toEqual([{
      subscriptionId: 'sub-ledger', handlerKey: 'system.provenance-ledger', status: 'invoked',
    }]);
    expect(governedHandler).toHaveBeenCalledTimes(1);
    expect(legacyFollowUp).toHaveBeenCalledTimes(1);

    await deliverAdmittedFact(FACT);
    expect(governedHandler).toHaveBeenCalledTimes(2);
    expect(legacyFollowUp).toHaveBeenCalledTimes(2);
    await controller.stop();
  });
});

describe('resource projection compatibility cutover', () => {
  test('removes only the mediated-save file_changed path and preserves non-migrated routes', () => {
    const saveController = fs.readFileSync(
      path.join(__dirname, '../../lib/file-mutations/save-controller.js'),
      'utf8',
    );
    const startup = fs.readFileSync(path.join(__dirname, '../../lib/startup.js'), 'utf8');
    const workspaceMutations = fs.readFileSync(
      path.join(__dirname, '../../lib/ws/workspace-request-handlers.js'),
      'utf8',
    );
    const watcherActions = fs.readFileSync(
      path.join(__dirname, '../../lib/watcher/actions.js'),
      'utf8',
    );

    expect(saveController).not.toContain('broadcastLegacyFileChanged');
    expect(saveController).not.toContain('legacy_file_changed_broadcast_failed');
    expect(startup).not.toContain("type: 'file_changed'");
    expect(workspaceMutations).toContain("type: 'file_changed'");
    expect(watcherActions).toContain("type: 'file_changed'");
  });
});
