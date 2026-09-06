'use strict';

const {
  normalizeCapabilityScope,
  normalizeRequestedCapabilities,
  requestSetIsNarrowerOrEqual,
} = require('../../lib/event-registry/capability-catalog');
const {
  filterIsNarrowerOrEqual,
  matchesFilter,
  normalizeFilter,
} = require('../../lib/event-registry/filter');
const { createScopedCapabilityFactory } = require('../../lib/subscriptions/capability-factory');

const EVENT_TYPES = [{ eventType: 'resource.mutated', schemaVersion: 1 }];

describe('closed MVP registry filter grammar', () => {
  test('canonicalizes arrays and matches all present predicates with AND semantics', () => {
    const normalized = normalizeFilter({
      eventTypes: EVENT_TYPES,
      resource: {
        operations: ['modify', 'create'],
        kinds: ['file'],
        ingressPanels: ['office', 'file-viewer'],
      },
    });
    expect(normalized.resource.operations).toEqual(['create', 'modify']);
    expect(normalized.resource.ingressPanels).toEqual(['file-viewer', 'office']);

    const fact = {
      eventType: 'resource.mutated',
      schemaVersion: 1,
      mutation: { kind: 'modify' },
      resource: { kind: 'file', access: { panel: 'file-viewer', path: 'note.md' } },
    };
    expect(matchesFilter(normalized, fact)).toBe(true);
    expect(matchesFilter(normalized, { ...fact, mutation: { kind: 'delete' } })).toBe(false);
    expect(matchesFilter(normalized, {
      ...fact,
      resource: { ...fact.resource, access: { panel: 'wiki', path: 'note.md' } },
    })).toBe(false);
    expect(matchesFilter(normalized, { ...fact, eventType: 'file.changed' })).toBe(false);
  });

  test.each([
    [{ eventTypes: [] }, /non-empty/],
    [{ eventTypes: [...EVENT_TYPES, ...EVENT_TYPES] }, /duplicate/],
    [{ eventTypes: EVENT_TYPES, unknown: true }, /unknown key/],
    [{ eventTypes: EVENT_TYPES, resource: { operations: ['modify', 'modify'] } }, /duplicate/],
    [{ eventTypes: EVENT_TYPES, resource: { kinds: [] } }, /non-empty/],
    [{ eventTypes: EVENT_TYPES, resource: { ingressPanels: [] } }, /1 through 16|non-empty/],
    [{ eventTypes: EVENT_TYPES, resource: { ingressPanels: Array(17).fill(0).map((_, i) => `p${i}`) } }, /1 through 16/],
    [{ eventTypes: EVENT_TYPES, resource: { ingressPanels: ['x'.repeat(129)] } }, /invalid panel/],
    [{ eventTypes: EVENT_TYPES, resource: { regex: '.*' } }, /unknown key/],
  ])('rejects non-closed filter input %#', (filter, message) => {
    expect(() => normalizeFilter(filter)).toThrow(message);
  });

  test('distinguishes narrowing from widening', () => {
    const broad = { eventTypes: EVENT_TYPES, resource: { operations: ['create', 'modify'] } };
    const narrow = {
      eventTypes: EVENT_TYPES,
      resource: { operations: ['modify'], ingressPanels: ['file-viewer'] },
    };
    expect(filterIsNarrowerOrEqual(narrow, broad)).toBe(true);
    expect(filterIsNarrowerOrEqual(broad, narrow)).toBe(false);
  });

  test('normalizes and narrows the two final agent fact types without admitting unknown facts', () => {
    const both = { eventTypes: [
      { eventType: 'resource.state_observed', schemaVersion: 1 },
      { eventType: 'agent.tool_completed', schemaVersion: 1 },
    ] };
    expect(normalizeFilter(both).eventTypes).toEqual([
      { eventType: 'agent.tool_completed', schemaVersion: 1 },
      { eventType: 'resource.state_observed', schemaVersion: 1 },
    ]);
    expect(filterIsNarrowerOrEqual({ eventTypes: [both.eventTypes[1]] }, both)).toBe(true);
    expect(filterIsNarrowerOrEqual(both, { eventTypes: [both.eventTypes[1]] })).toBe(false);
    expect(() => normalizeFilter({
      eventTypes: [{ eventType: 'agent.tool_started', schemaVersion: 1 }],
    })).toThrow(/unsupported/);
  });
});

describe('closed MVP capability catalog', () => {
  const ledgerRequests = [
    { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
    { capabilityKey: 'ledger.append_resource_fact', scope: { workspaceScope: 'event' } },
    {
      capabilityKey: 'diagnostic.write_fixed',
      scope: { codes: ['ledger_write_failed', 'ledger_duplicate_conflict'] },
    },
  ];
  const rendererRequests = [
    { capabilityKey: 'fact.consume', scope: { eventTypes: EVENT_TYPES } },
    {
      capabilityKey: 'renderer.publish_resource_changed',
      scope: {
        workspaceScope: 'event', messageType: 'resource:changed', messageVersion: 1,
        panel: 'file-viewer',
      },
    },
    {
      capabilityKey: 'renderer.publish_resource_refresh_required',
      scope: {
        workspaceScope: 'event', messageType: 'resource:refresh_required', messageVersion: 1,
        panel: 'file-viewer', reasons: ['projection_failed'],
      },
    },
    {
      capabilityKey: 'diagnostic.write_fixed',
      scope: { codes: ['render_projection_failed', 'render_projection_duplicate_conflict'] },
    },
  ];

  test('accepts the exact later ledger and renderer fixtures', () => {
    expect(normalizeRequestedCapabilities(
      ledgerRequests,
      { handlerKey: 'system.provenance-ledger' },
    )).toHaveLength(3);
    expect(normalizeRequestedCapabilities(
      rendererRequests,
      { handlerKey: 'system.resource-render-projection' },
    )).toHaveLength(4);
  });

  test.each([
    ['unknown.method', {}],
    ['fact.consume', { eventTypes: [{ eventType: 'resource.mutated', schemaVersion: 2 }] }],
    ['ledger.append_resource_fact', { workspaceScope: 'all' }],
    ['renderer.publish_resource_changed', {
      workspaceScope: 'event', messageType: 'resource:changed', messageVersion: 1,
      panel: 'office',
    }],
    ['renderer.publish_resource_refresh_required', {
      workspaceScope: 'event', messageType: 'resource:refresh_required', messageVersion: 1,
      panel: 'file-viewer', reasons: ['projection_failed', 'fact_publish_failed'],
    }],
    ['diagnostic.write_fixed', { codes: ['ledger_write_failed', 'arbitrary'] }],
  ])('rejects widening or unknown capability scope %#', (key, scope) => {
    expect(() => normalizeCapabilityScope(
      key,
      scope,
      { handlerKey: 'system.provenance-ledger' },
    )).toThrow();
  });

  test('allows only subtractive diagnostic-code request changes', () => {
    const narrowed = ledgerRequests.map((request) => (
      request.capabilityKey === 'diagnostic.write_fixed'
        ? { ...request, scope: { codes: ['ledger_write_failed'] } }
        : request
    ));
    expect(requestSetIsNarrowerOrEqual(
      narrowed,
      ledgerRequests,
      { handlerKey: 'system.provenance-ledger' },
    )).toBe(true);
    expect(requestSetIsNarrowerOrEqual(
      ledgerRequests,
      narrowed,
      { handlerKey: 'system.provenance-ledger' },
    )).toBe(false);
  });

  test('does not let one built-in handler acquire another handler\'s methods', () => {
    expect(() => normalizeCapabilityScope(
      'ledger.append_resource_fact',
      { workspaceScope: 'event' },
      { handlerKey: 'system.resource-render-projection' },
    )).toThrow(/not owned/);
    expect(() => normalizeCapabilityScope(
      'renderer.publish_resource_changed',
      {
        workspaceScope: 'event', messageType: 'resource:changed', messageVersion: 1,
        panel: 'file-viewer',
      },
      { handlerKey: 'system.provenance-ledger' },
    )).toThrow(/not owned/);
    expect(() => normalizeCapabilityScope(
      'ledger.append_agent_fact',
      { workspaceScope: 'event' },
      { handlerKey: 'system.provenance-ledger' },
    )).toThrow(/not owned/);
  });

  test('agent ledger capability exposes only exact same-fact append and fixed diagnostics', async () => {
    const fact = Object.freeze({ eventType: 'agent.tool_completed', schemaVersion: 1, eventId: 'event-1' });
    const appended = [];
    const factory = createScopedCapabilityFactory({
      appendAgentFact: async (value) => appended.push(value),
      writeDiagnostic: () => {},
    });
    const grants = [
      { capabilityKey: 'fact.consume', scope: { eventTypes: [
        { eventType: 'agent.tool_completed', schemaVersion: 1 },
        { eventType: 'resource.state_observed', schemaVersion: 1 },
      ] } },
      { capabilityKey: 'ledger.append_agent_fact', scope: { workspaceScope: 'event' } },
      { capabilityKey: 'diagnostic.write_fixed', scope: { codes: [
        'agent_ledger_conflict', 'agent_ledger_source_missing', 'agent_ledger_write_failed',
      ] } },
    ];
    const context = factory({ handlerKey: 'system.agent-provenance-ledger', grants, fact });
    expect(Object.keys(context).sort()).toEqual(['appendAgentFact', 'writeDiagnostic']);
    await context.appendAgentFact(fact);
    expect(appended).toEqual([fact]);
    expect(() => context.appendAgentFact({ ...fact, eventId: 'escape' })).toThrow(/scoped/);
    expect(() => context.writeDiagnostic('path=/private/value')).toThrow(/exceeds/);
    const missing = createScopedCapabilityFactory({ writeDiagnostic: () => {} });
    expect(() => missing.assertAvailable({ handlerKey: 'system.agent-provenance-ledger', grants }))
      .toThrow(/appendAgentFact provider is unavailable/);
  });
});
