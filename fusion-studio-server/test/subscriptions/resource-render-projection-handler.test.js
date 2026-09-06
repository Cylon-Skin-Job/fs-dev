'use strict';

const {
  createResourceRenderProjectionHandler,
} = require('../../lib/subscriptions/handlers/resource-render-projection');

const id = (suffix) => `123e4567-e89b-42d3-a456-${String(suffix).padStart(12, '0')}`;

function fact(overrides = {}) {
  return {
    eventId: id(1), eventType: 'resource.mutated', schemaVersion: 1, occurredAt: 1000,
    workspaceId: 'workspace-1', operationId: id(2), commandId: id(3),
    commandAcceptedEventId: id(4), fileVersionId: id(5),
    origin: { kind: 'local_client', connectionId: 'connection-1', assurance: 'transport_only' },
    resource: {
      resourceId: id(6), kind: 'file', path: 'Office/shared.md',
      access: { panel: 'office-viewer', path: 'shared.md' },
    },
    mutation: { kind: 'modify', saveReason: 'manual' },
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    publishResourceChanged: jest.fn(async () => ({ matched: 1, delivered: 1 })),
    publishResourceRefreshRequired: jest.fn(async () => ({ matched: 1, delivered: 1 })),
    writeDiagnostic: jest.fn(),
    ...overrides,
  };
}

describe('resource render projection governed handler', () => {
  test('builds only the canonical File Viewer projection from the admitted fact', async () => {
    const capabilities = context();
    const handler = createResourceRenderProjectionHandler();
    await expect(handler(fact(), capabilities)).resolves.toEqual({ status: 'published' });
    expect(capabilities.publishResourceChanged).toHaveBeenCalledWith({
      type: 'resource:changed', version: 1, eventId: id(1), operationId: id(2),
      workspaceId: 'workspace-1', resourceId: id(6), resourceKind: 'file',
      operation: 'modify', panel: 'file-viewer', path: 'Office/shared.md', occurredAt: 1000,
    });
    expect(capabilities.publishResourceChanged.mock.calls[0][0].workspaceEpoch).toBeUndefined();
    expect(capabilities.publishResourceRefreshRequired).not.toHaveBeenCalled();
    expect(capabilities.writeDiagnostic).not.toHaveBeenCalled();
  });

  test('suppresses an exact duplicate and diagnoses a conflicting event identity', async () => {
    const capabilities = context();
    const handler = createResourceRenderProjectionHandler();
    await handler(fact(), capabilities);
    await expect(handler(fact(), capabilities)).resolves.toEqual({ status: 'duplicate' });
    expect(capabilities.publishResourceChanged).toHaveBeenCalledTimes(1);

    const conflict = fact({
      resource: {
        resourceId: id(6), kind: 'file', path: 'Office/other.md',
        access: { panel: 'office-viewer', path: 'other.md' },
      },
    });
    await expect(handler(conflict, capabilities)).rejects.toThrow(/conflicts/);
    expect(capabilities.writeDiagnostic).toHaveBeenCalledWith(
      'render_projection_duplicate_conflict',
    );
    expect(capabilities.writeDiagnostic).not.toHaveBeenCalledWith('render_projection_failed');
    expect(capabilities.publishResourceRefreshRequired).toHaveBeenCalledWith({
      type: 'resource:refresh_required', version: 1, workspaceId: 'workspace-1',
      panel: 'file-viewer', path: 'Office/other.md', operationId: id(2),
      reason: 'projection_failed',
    });
  });

  test('atomically joins a concurrent duplicate and rejects a concurrent conflict before publish', async () => {
    let releasePublish;
    const capabilities = context({
      publishResourceChanged: jest.fn(() => new Promise((resolve) => {
        releasePublish = resolve;
      })),
    });
    const handler = createResourceRenderProjectionHandler();
    const first = handler(fact(), capabilities);
    const duplicate = handler(fact(), capabilities);
    const conflict = handler(fact({
      resource: {
        resourceId: id(6), kind: 'file', path: 'Office/conflict.md',
        access: { panel: 'office-viewer', path: 'conflict.md' },
      },
    }), capabilities);

    await expect(conflict).rejects.toThrow(/conflicts/);
    expect(capabilities.publishResourceChanged).toHaveBeenCalledTimes(1);
    expect(capabilities.writeDiagnostic).toHaveBeenCalledWith(
      'render_projection_duplicate_conflict',
    );
    expect(capabilities.publishResourceRefreshRequired).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'projection_failed', path: 'Office/conflict.md' }),
    );

    releasePublish();
    await expect(first).resolves.toEqual({ status: 'published' });
    await expect(duplicate).resolves.toEqual({ status: 'duplicate' });
    expect(capabilities.publishResourceChanged).toHaveBeenCalledTimes(1);
  });

  test('keeps in-flight dedupe bounded and permits retry after capacity is released', async () => {
    let releasePublish;
    const capabilities = context({
      publishResourceChanged: jest.fn()
        .mockImplementationOnce(() => new Promise((resolve) => { releasePublish = resolve; }))
        .mockResolvedValue({ matched: 1, delivered: 1 }),
    });
    const handler = createResourceRenderProjectionHandler({ dedupeLimit: 1 });
    const first = handler(fact(), capabilities);
    const secondFact = fact({ eventId: id(20), operationId: id(21) });

    await expect(handler(secondFact, capabilities)).rejects.toThrow(/capacity/);
    expect(capabilities.publishResourceChanged).toHaveBeenCalledTimes(1);
    expect(capabilities.publishResourceRefreshRequired).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'projection_failed', operationId: id(21) }),
    );

    releasePublish();
    await expect(first).resolves.toEqual({ status: 'published' });
    await expect(handler(secondFact, capabilities)).resolves.toEqual({ status: 'published' });
    expect(capabilities.publishResourceChanged).toHaveBeenCalledTimes(2);
  });

  test('projection construction or publication failure emits only subscriber-owned recovery', async () => {
    const capabilities = context({
      publishResourceChanged: jest.fn(async () => { throw new Error('publish failed'); }),
    });
    const handler = createResourceRenderProjectionHandler();
    await expect(handler(fact(), capabilities)).rejects.toThrow('publish failed');
    expect(capabilities.writeDiagnostic).toHaveBeenCalledWith('render_projection_failed');
    expect(capabilities.publishResourceRefreshRequired).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'projection_failed', panel: 'file-viewer', path: 'Office/shared.md',
    }));

    capabilities.publishResourceChanged.mockResolvedValueOnce({ matched: 1, delivered: 1 });
    await expect(handler(fact(), capabilities)).resolves.toEqual({ status: 'published' });
    expect(capabilities.publishResourceChanged).toHaveBeenCalledTimes(2);
  });

  test('requires exactly the narrow governed capability surface it uses', async () => {
    const handler = createResourceRenderProjectionHandler();
    await expect(handler(fact(), {
      publishResourceChanged: async () => {},
      publishResourceRefreshRequired: async () => {},
    })).rejects.toThrow(/capabilities are unavailable/);
  });
});
