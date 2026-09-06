'use strict';

const {
  createResourceProjectionPublishers,
} = require('../../lib/ws/resource-projection-publisher');
const {
  MAX_BUFFERED_REPLIES,
  beginWorkspaceBind,
  completeWorkspaceBind,
} = require('../../lib/ws/workspace-session');

const EPOCH_A1 = '123e4567-e89b-42d3-a456-426614174001';
const EPOCH_A2 = '123e4567-e89b-42d3-a456-426614174002';
const EVENT_ID = '123e4567-e89b-42d3-a456-426614174003';
const OPERATION_ID = '123e4567-e89b-42d3-a456-426614174004';
const RESOURCE_ID = '123e4567-e89b-42d3-a456-426614174005';
const EDGE_ID = '123e4567-e89b-42d3-a456-426614174006';
const SNAPSHOT_ID = '123e4567-e89b-42d3-a456-426614174007';
const CHECKPOINT_EVENT_ID = '123e4567-e89b-42d3-a456-426614174008';
const OBSERVATION_ID = '123e4567-e89b-42d3-a456-426614174009';

function activeSession(workspaceId, workspaceEpoch) {
  return {
    currentWorkspaceId: workspaceId,
    workspaceEpoch,
    workspaceBindingState: 'active',
    workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [],
    workspaceReplyBufferBytes: 0,
  };
}

function bindingSession(workspaceId, workspaceEpoch) {
  return {
    currentWorkspaceId: null,
    workspaceEpoch: null,
    workspaceBindingState: 'binding',
    workspaceReplyFlushState: 'idle',
    workspaceReplyBuffer: [],
    workspaceReplyBufferBytes: 0,
    pendingWorkspaceId: workspaceId,
    pendingWorkspaceEpoch: workspaceEpoch,
    pendingProjectRoot: '/workspace',
  };
}

function socket() {
  return {
    readyState: 1,
    sent: [],
    closes: [],
    send(payload, callback) {
      this.sent.push(payload);
      callback?.();
    },
    close(code, reason) {
      this.closes.push([code, reason]);
      this.readyState = 3;
    },
  };
}

function changed(overrides = {}) {
  return {
    type: 'resource:changed', version: 1, eventId: EVENT_ID,
    operationId: OPERATION_ID, workspaceId: 'workspace-A', resourceId: RESOURCE_ID,
    resourceKind: 'file', operation: 'modify', panel: 'file-viewer', path: 'docs/a.md',
    occurredAt: 1234, ...overrides,
  };
}

function refresh(reason, overrides = {}) {
  return {
    type: 'resource:refresh_required', version: 1, workspaceId: 'workspace-A',
    panel: 'file-viewer', path: 'docs/a.md', operationId: OPERATION_ID, reason,
    ...overrides,
  };
}

function observed(overrides = {}) {
  return {
    type: 'resource:changed', version: 2, projectionId: EDGE_ID,
    sourceActivityId: OPERATION_ID, sourceEdgeId: EDGE_ID,
    workspaceId: 'workspace-A', resourceKind: 'file', changeKind: 'state_observed',
    relation: 'changed', panel: 'file-viewer', path: 'docs/a.md', occurredAt: 1234,
    checkpointEventId: CHECKPOINT_EVENT_ID, checkpointObservationId: OBSERVATION_ID,
    snapshotId: SNAPSHOT_ID, state: 'bytes', resourceId: RESOURCE_ID,
    ...overrides,
  };
}

function publishers(sessions, overrides = {}) {
  return createResourceProjectionPublishers({
    sessions,
    registryAccess: {
      validatePayload: jest.fn(async (_reference, message) => ({
        valid: typeof message.workspaceEpoch === 'string',
      })),
    },
    ...overrides,
  });
}

describe('workspace-scoped resource projection publisher', () => {
  test('routes only to matching open sessions and injects each recipient epoch', async () => {
    const first = socket();
    const second = socket();
    const other = socket();
    const closed = socket();
    closed.readyState = 3;
    const value = publishers(new Map([
      [first, activeSession('workspace-A', EPOCH_A1)],
      [second, activeSession('workspace-A', EPOCH_A2)],
      [other, activeSession('workspace-B', EPOCH_A1)],
      [closed, activeSession('workspace-A', EPOCH_A1)],
    ]));

    await expect(value.publishResourceChanged(changed()))
      .resolves.toEqual({ matched: 2, delivered: 2 });
    expect(JSON.parse(first.sent[0])).toMatchObject({
      type: 'resource:changed', workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1,
      panel: 'file-viewer', path: 'docs/a.md',
    });
    expect(JSON.parse(second.sent[0]).workspaceEpoch).toBe(EPOCH_A2);
    expect(other.sent).toEqual([]);
    expect(closed.sent).toEqual([]);
  });

  test('publishes strict v2 observation unions with the stable dominant-edge identity', async () => {
    const ws = socket();
    const value = publishers(new Map([[ws, activeSession('workspace-A', EPOCH_A1)]]));
    await expect(value.publishResourceObservedV2(observed()))
      .resolves.toEqual({ matched: 1, delivered: 1 });
    expect(JSON.parse(ws.sent[0])).toMatchObject({
      version: 2, projectionId: EDGE_ID, sourceEdgeId: EDGE_ID,
      workspaceEpoch: EPOCH_A1, checkpointEventId: CHECKPOINT_EVENT_ID,
    });
    await expect(value.publishResourceObservedV2(observed({ projectionId: EVENT_ID })))
      .rejects.toThrow(/identity/u);
    const unchanged = observed({
      relation: 'unchanged', state: 'absent', resourceId: undefined,
      checkpointEventId: undefined, checkpointObservationId: undefined,
    });
    delete unchanged.resourceId;
    delete unchanged.checkpointEventId;
    delete unchanged.checkpointObservationId;
    await expect(value.publishResourceObservedV2(unchanged)).resolves.toMatchObject({ matched: 1 });
  });

  test('uses the existing bind queue so the bind frame precedes projection and recovery', async () => {
    const ws = socket();
    const session = bindingSession('workspace-A', EPOCH_A1);
    const value = publishers(new Map([[ws, session]]));

    await value.publishResourceChanged(changed());
    await value.publishControllerRefreshRequired(refresh('projection_unavailable'));
    expect(ws.sent).toEqual([]);
    expect(session.workspaceReplyBuffer).toHaveLength(2);

    await expect(completeWorkspaceBind(
      ws,
      session,
      { type: 'workspace:switched' },
      { workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1 },
    )).resolves.toBe(true);
    expect(ws.sent.map((item) => JSON.parse(item).type)).toEqual([
      'workspace:switched', 'resource:changed', 'resource:refresh_required',
    ]);
  });

  test('superseding a bind during async flush closes before a new-epoch projection can escape', async () => {
    const ws = socket();
    const session = bindingSession('workspace-A', EPOCH_A1);
    const value = publishers(new Map([[ws, session]]));
    let releaseProjection;
    ws.send = function controlledSend(payload, callback) {
      this.sent.push(payload);
      if (this.sent.length === 2) {
        releaseProjection = () => callback?.();
      } else {
        callback?.();
      }
    };

    await value.publishResourceChanged(changed());
    const completingA = completeWorkspaceBind(
      ws,
      session,
      { type: 'workspace:init' },
      { workspaceId: 'workspace-A', workspaceEpoch: EPOCH_A1 },
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(typeof releaseProjection).toBe('function');

    beginWorkspaceBind(session, {
      workspaceId: 'workspace-B', repoPath: '/workspace-B', randomUuid: () => EPOCH_A2,
    });
    await value.publishResourceChanged(changed({ workspaceId: 'workspace-B' }));
    releaseProjection();

    await expect(completingA).resolves.toBe(false);
    expect(ws.sent.map((item) => JSON.parse(item).type)).toEqual([
      'workspace:init', 'resource:changed',
    ]);
    expect(session.workspaceReplyBuffer).toEqual([
      expect.objectContaining({ workspaceId: 'workspace-B', workspaceEpoch: EPOCH_A2 }),
    ]);
    expect(ws.closes.at(-1)[0]).toBe(1011);
  });

  test('a projection for the previous workspace is not admitted to a new bind queue', async () => {
    const ws = socket();
    const session = activeSession('workspace-A', EPOCH_A1);
    beginWorkspaceBind(session, {
      workspaceId: 'workspace-B', repoPath: '/workspace-B', randomUuid: () => EPOCH_A2,
    });
    const value = publishers(new Map([[ws, session]]));
    await expect(value.publishResourceChanged(changed()))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    expect(session.workspaceReplyBuffer).toEqual([]);
  });

  test('schema rejection and send failure reject the provider; send failure closes for reconnect', async () => {
    const invalidWs = socket();
    const invalidSession = activeSession('workspace-A', EPOCH_A1);
    const invalid = publishers(new Map([[invalidWs, invalidSession]]), {
      registryAccess: { validatePayload: async () => ({ valid: false }) },
    });
    await expect(invalid.publishResourceChanged(changed())).rejects.toThrow(/delivery failed/);
    expect(invalidWs.sent).toEqual([]);
    expect(invalidWs.closes.at(-1)[0]).toBe(1011);

    const ws = socket();
    const session = activeSession('workspace-A', EPOCH_A1);
    ws.send = function fail(_payload, callback) { callback(new Error('send failed')); };
    const valid = publishers(new Map([[ws, session]]));
    await expect(valid.publishResourceChanged(changed())).rejects.toThrow(/delivery failed/);
    expect(ws.closes.at(-1)[0]).toBe(1011);
  });

  test('schema infrastructure failure closes only matching recipients and no-recipient publish stays inert', async () => {
    const matching = socket();
    const other = socket();
    const registryAccess = {
      validatePayload: jest.fn(async () => { throw new Error('registry unavailable'); }),
    };
    const value = publishers(new Map([
      [matching, activeSession('workspace-A', EPOCH_A1)],
      [other, activeSession('workspace-B', EPOCH_A2)],
    ]), { registryAccess });

    await expect(value.publishResourceChanged(changed())).rejects.toThrow(/delivery failed/);
    expect(matching.sent).toEqual([]);
    expect(matching.closes.at(-1)[0]).toBe(1011);
    expect(other.sent).toEqual([]);
    expect(other.closes).toEqual([]);

    await expect(value.publishSubscriberRefreshRequired(refresh('projection_failed')))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    expect(registryAccess.validatePayload).toHaveBeenCalledTimes(1);
    expect(other.closes).toEqual([]);
  });

  test('deferred validation cannot deliver a captured projection after its pair is superseded', async () => {
    const ws = socket();
    const session = activeSession('workspace-A', EPOCH_A1);
    let releaseValidation;
    let validationStarted;
    const started = new Promise((resolve) => { validationStarted = resolve; });
    const value = publishers(new Map([[ws, session]]), {
      registryAccess: {
        validatePayload: async () => {
          validationStarted();
          await new Promise((resolve) => { releaseValidation = resolve; });
          return { valid: true };
        },
      },
    });

    const publishing = value.publishResourceChanged(changed());
    await started;
    const pairB = beginWorkspaceBind(session, {
      workspaceId: 'workspace-B', repoPath: '/workspace-B', randomUuid: () => EPOCH_A2,
    });
    await expect(completeWorkspaceBind(
      ws,
      session,
      { type: 'workspace:switched' },
      pairB,
    )).resolves.toBe(true);
    releaseValidation();

    await expect(publishing).rejects.toThrow(/delivery failed/);
    expect(ws.sent.map((item) => JSON.parse(item).type)).toEqual(['workspace:switched']);
    expect(ws.closes.at(-1)[0]).toBe(1011);
  });

  test('projection overflow uses the sole bind queue and closes for reconnect', async () => {
    const ws = socket();
    const session = bindingSession('workspace-A', EPOCH_A1);
    session.workspaceReplyBuffer = Array.from({ length: MAX_BUFFERED_REPLIES }, () => ({
      serialized: '{}', byteLength: 2,
    }));
    session.workspaceReplyBufferBytes = MAX_BUFFERED_REPLIES * 2;
    const value = publishers(new Map([[ws, session]]));
    await expect(value.publishResourceChanged(changed())).rejects.toThrow(/delivery failed/);
    expect(session.workspaceReplyBuffer).toHaveLength(MAX_BUFFERED_REPLIES);
    expect(ws.closes.at(-1)[0]).toBe(1011);
  });

  test('controller and subscriber recovery closures enforce disjoint exact reason sets', async () => {
    const value = publishers(new Map());
    await expect(value.publishSubscriberRefreshRequired(refresh('projection_failed')))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    await expect(value.publishControllerRefreshRequired(refresh('fact_publish_failed')))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    await expect(value.publishControllerRefreshRequired(refresh('projection_unavailable')))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    await expect(value.publishControllerRefreshRequired(refresh('mutation_outcome_unknown')))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    await expect(value.publishSubscriberRefreshRequired(refresh('fact_publish_failed')))
      .rejects.toThrow(/exceeds publisher scope/);
    await expect(value.publishControllerRefreshRequired(refresh('projection_failed')))
      .rejects.toThrow(/exceeds publisher scope/);
    await expect(value.publishAgentObservationRefreshRequired(refresh('projection_failed')))
      .resolves.toEqual({ matched: 0, delivered: 0 });
    await expect(value.publishAgentObservationRefreshRequired(refresh('mutation_outcome_unknown')))
      .rejects.toThrow(/exceeds publisher scope/);
    expect(Object.keys(value).sort()).toEqual([
      'publishAgentObservationRefreshRequired',
      'publishControllerRefreshRequired',
      'publishResourceChanged',
      'publishResourceObservedV2',
      'publishSubscriberRefreshRequired',
    ]);
    expect(value.sessions).toBeUndefined();
  });

  test('rejects malformed bases before session routing', async () => {
    const value = publishers(new Map());
    await expect(value.publishResourceChanged(changed({ workspaceEpoch: EPOCH_A1 })))
      .rejects.toThrow(/unknown fields/);
    await expect(value.publishResourceChanged(changed({ path: '../escape.md' })))
      .rejects.toThrow(/normalized/);
    await expect(value.publishControllerRefreshRequired({
      ...refresh('fact_publish_failed'), arbitrary: true,
    })).rejects.toThrow(/unknown fields/);
  });
});
