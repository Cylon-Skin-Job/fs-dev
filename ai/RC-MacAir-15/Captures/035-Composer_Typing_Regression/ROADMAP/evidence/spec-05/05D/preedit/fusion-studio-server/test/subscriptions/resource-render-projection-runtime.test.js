'use strict';

const { createInitializedEventRegistry } = require('../../lib/event-registry');
const {
  RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_ID,
} = require('../../lib/event-registry/subscription-seed-catalog');
const {
  createHandlerCatalog,
  createScopedCapabilityFactory,
  createSubscriptionController,
} = require('../../lib/subscriptions');
const {
  createResourceRenderProjectionHandler,
} = require('../../lib/subscriptions/handlers/resource-render-projection');
const { createDb, migrate } = require('../resources/test-db');

describe('resource render projection generation activation', () => {
  let db;

  beforeEach(async () => {
    db = await migrate(createDb());
  });

  afterEach(async () => {
    if (db) await db.destroy();
  });

  test('activates both locked handlers and atomically removes/restores projection authority on reload', async () => {
    const registry = await createInitializedEventRegistry(db, {
      installedHandlers: ['system.provenance-ledger', 'system.resource-render-projection'],
      now: () => 1000,
    });
    let deliver;
    const recoveries = [];
    const diagnostics = [];
    const controller = createSubscriptionController({
      registryAccess: registry.access,
      handlerCatalog: createHandlerCatalog({
        'system.provenance-ledger': async () => {},
        'system.resource-render-projection': createResourceRenderProjectionHandler(),
      }),
      createScopedContext: createScopedCapabilityFactory({
        appendResourceFact: async () => {},
        publishResourceChanged: async () => { throw new Error('projection unavailable'); },
        publishResourceRefreshRequired: async (message) => { recoveries.push(message); },
        writeDiagnostic: (code) => { diagnostics.push(code); },
      }),
      installAdmittedFactDelivery(value) { deliver = value; },
    });

    await controller.start();
    expect(typeof deliver).toBe('function');
    expect(controller.inspectGeneration()).toMatchObject({
      lifecycle: 'started', generationId: 1, descriptorCount: 2,
      subscriptions: [
        { handlerKey: 'system.provenance-ledger', deliveryPolicy: 'required_ack' },
        { handlerKey: 'system.resource-render-projection', deliveryPolicy: 'best_effort' },
      ],
    });
    await expect(deliver({
      eventId: '123e4567-e89b-42d3-a456-426614174001',
      eventType: 'resource.mutated', schemaVersion: 1, occurredAt: 1000,
      workspaceId: 'workspace-1',
      operationId: '123e4567-e89b-42d3-a456-426614174002',
      mutation: { kind: 'modify' },
      resource: {
        resourceId: '123e4567-e89b-42d3-a456-426614174003',
        kind: 'file', path: 'docs/a.md',
        access: { panel: 'office-viewer', path: 'a.md' },
      },
    })).resolves.toEqual([
      expect.objectContaining({ handlerKey: 'system.provenance-ledger', status: 'completed' }),
      expect.objectContaining({ handlerKey: 'system.resource-render-projection', status: 'invoked' }),
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(diagnostics).toContain('render_projection_failed');
    expect(recoveries).toEqual([expect.objectContaining({
      reason: 'projection_failed', panel: 'file-viewer', path: 'docs/a.md',
    })]);

    await db('event_subscription_registry')
      .where({ subscription_id: RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_ID })
      .update({ status: 'disabled', updated_at: 2000 });
    await expect(controller.reload()).resolves.toMatchObject({
      applied: true, mode: 'complete', generationId: 2, descriptorCount: 1,
    });
    expect(controller.inspectGeneration().subscriptions)
      .toEqual([expect.objectContaining({ handlerKey: 'system.provenance-ledger' })]);

    await db('event_subscription_registry')
      .where({ subscription_id: RESOURCE_RENDER_PROJECTION_SUBSCRIPTION_ID })
      .update({ status: 'enabled', updated_at: 3000 });
    await expect(controller.reload()).resolves.toMatchObject({
      applied: true, mode: 'complete', generationId: 3, descriptorCount: 2,
    });
    await controller.stop();
  });
});
