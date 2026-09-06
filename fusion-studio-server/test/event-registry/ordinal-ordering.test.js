'use strict';

const { normalizeRequestedCapabilities } = require('../../lib/event-registry/capability-catalog');
const { normalizeFilter } = require('../../lib/event-registry/filter');
const { normalizeSchemaReferences } = require('../../lib/event-registry/policy');

const EVENT_TYPES = [{ eventType: 'resource.mutated', schemaVersion: 1 }];

describe('event registry locale-independent ordinal ordering', () => {
  test('normalizes Unicode panels and schema references identically when host collations disagree', () => {
    const input = ['ä-panel', 'z-panel'];
    const enUs = [...input].sort(new Intl.Collator('en-US').compare);
    const svSe = [...input].sort(new Intl.Collator('sv-SE').compare);
    expect(enUs).not.toEqual(svSe);

    const originalLocaleCompare = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error('Registry normalization must not use host locale collation');
    };
    try {
      expect(normalizeFilter({
        eventTypes: EVENT_TYPES,
        resource: { ingressPanels: input },
      }).resource.ingressPanels).toEqual(['z-panel', 'ä-panel']);

      expect(normalizeSchemaReferences([
        { schemaKey: 'ä.event', schemaVersion: 1, definitionKind: 'event' },
        { schemaKey: 'z.event', schemaVersion: 1, definitionKind: 'event' },
      ]).map((reference) => reference.schemaKey)).toEqual(['z.event', 'ä.event']);
    } finally {
      String.prototype.localeCompare = originalLocaleCompare;
    }
  });

  test('uses the same ordinal comparator for the closed requested-capability ordering', () => {
    const requests = normalizeRequestedCapabilities([
      {
        capabilityKey: 'ledger.append_resource_fact',
        scope: { workspaceScope: 'event' },
      },
      {
        capabilityKey: 'fact.consume',
        scope: { eventTypes: EVENT_TYPES },
      },
    ], { handlerKey: 'system.provenance-ledger' });

    expect(requests.map((request) => request.capabilityKey)).toEqual([
      'fact.consume',
      'ledger.append_resource_fact',
    ]);
  });
});
