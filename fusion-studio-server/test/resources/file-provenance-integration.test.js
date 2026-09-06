'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createInitializedEventRegistry } = require('../../lib/event-registry');
const { createPathAuthority } = require('../../lib/file-mutations/path-authority');
const { createFileSaveOwner } = require('../../lib/file-mutations/save-owner');
const { createResourceProvenanceRepository } = require('../../lib/ledger/resource-provenance-repository');
const { createProvenanceLedgerHandler } = require('../../lib/ledger/provenance-ledger-handler');
const { createProvenanceQueryPathNormalizer } = require('../../lib/ledger/provenance-query-paths');
const {
  createResourceRenderProjectionHandler,
} = require('../../lib/subscriptions/handlers/resource-render-projection');
const {
  createHandlerCatalog,
  createScopedCapabilityFactory,
  createSubscriptionController,
} = require('../../lib/subscriptions');
const { bootstrapFileProvenanceAdmission } = require('../../lib/subscriptions/file-provenance-bootstrap');
const { createFileSaveRoute } = require('../../lib/ws/file-save-route');
const { createResourceProvenanceRoute } = require('../../lib/ws/resource-provenance-route');
const { createResourceProjectionPublishers } = require('../../lib/ws/resource-projection-publisher');
const { createDb, migrate } = require('./test-db');

const WORKSPACE_EPOCH = '123e4567-e89b-42d3-a456-426614174000';

describe('atomic mediated save to governed ledger to public query', () => {
  let db;
  let root;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-file-provenance-integration-'));
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), 'before', 'utf8');
    fs.symlinkSync('docs', path.join(root, 'alias'));
    db = await migrate(createDb());
  });

  afterEach(async () => {
    await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('an in-root symlink-parent save is queryable by physical exact and folder selectors', async () => {
    const registry = await createInitializedEventRegistry(db, {
      now: () => 1_000,
      installedHandlers: ['system.provenance-ledger', 'system.resource-render-projection'],
    });
    const provenance = createResourceProvenanceRepository(db);
    const pathAuthority = createPathAuthority({
      getWorkspaceById: async () => ({ repoPath: root }),
      resolvePanelRoot: () => root,
    });
    const session = {
      connectionId: 'connection-1', workspaceBindingState: 'active', workspaceReplyFlushState: 'idle',
      currentWorkspaceId: 'workspace-1', workspaceEpoch: WORKSPACE_EPOCH,
      workspaceReplyBuffer: [], workspaceReplyBufferBytes: 0,
    };
    const ws = { readyState: 1, send: jest.fn(), close: jest.fn() };
    const sessions = new Map([[ws, session]]);
    const projectionPublishers = createResourceProjectionPublishers({
      sessions,
      registryAccess: registry.access,
    });
    const owner = createFileSaveOwner({
      db,
      publishResourceRefreshRequired: projectionPublishers.publishControllerRefreshRequired,
      controllerOptions: {
        pathAuthority,
        checkpoint: { afterSave: async () => 'not_requested' },
      },
      reconcilerOptions: { pathAuthority },
    });
    let deliver;
    const controller = createSubscriptionController({
      registryAccess: registry.access,
      handlerCatalog: createHandlerCatalog({
        'system.provenance-ledger': createProvenanceLedgerHandler(),
        'system.resource-render-projection': createResourceRenderProjectionHandler(),
      }),
      createScopedContext: createScopedCapabilityFactory({
        appendResourceFact: provenance.appendResourceFact,
        publishResourceChanged: projectionPublishers.publishResourceChanged,
        publishResourceRefreshRequired: projectionPublishers.publishSubscriberRefreshRequired,
        writeDiagnostic: jest.fn(),
      }),
      installAdmittedFactDelivery(value) { deliver = value; },
      writeDiagnostic: jest.fn(),
    });
    await controller.start();
    bootstrapFileProvenanceAdmission({
      registryAccess: registry.access,
      deliverAdmittedFact: deliver,
      writeDiagnostic: jest.fn(),
      fileSaveOwner: owner,
    });
    await owner.reconcile();

    const saveReplies = [];
    const saveRoute = createFileSaveRoute({
      registryAccess: registry.access,
      fileSaveOwner: owner,
      sendReply: async (_ws, _session, message) => { saveReplies.push(message); return true; },
    });
    await saveRoute.handleFileSave({
      ws,
      session,
      message: {
        type: 'file_save', version: 1, requestId: 'request-1',
        workspaceId: 'workspace-1', workspaceEpoch: WORKSPACE_EPOCH,
        panel: 'file-viewer', path: 'alias/note.md', content: 'after', reason: 'manual',
      },
    });

    expect(fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8')).toBe('after');
    expect(saveReplies).toHaveLength(1);
    expect(saveReplies[0]).toMatchObject({
      success: true, outcome: 'succeeded', commandFactState: 'admitted',
      resourceFactState: 'admitted', ledgerState: 'stored', provenanceState: 'complete',
    });
    await new Promise((resolve) => setImmediate(resolve));
    const projections = ws.send.mock.calls.map(([payload]) => JSON.parse(payload));
    expect(projections).toEqual([expect.objectContaining({
      type: 'resource:changed', version: 1, workspaceId: 'workspace-1',
      workspaceEpoch: WORKSPACE_EPOCH, eventId: saveReplies[0].resourceEventId,
      operationId: saveReplies[0].operationId, resourceId: saveReplies[0].resourceId,
      panel: 'file-viewer', path: 'docs/note.md', operation: 'modify',
    })]);
    expect(JSON.stringify(projections)).not.toContain('file_changed');
    const version = await db('file_versions').first();
    expect(Buffer.from(version.snapshot_bytes).toString('utf8')).toBe('before');
    await expect(db('event_log').where({ event_type: 'resource.mutated' })).resolves.toHaveLength(1);

    const queryReplies = [];
    const queryRoute = createResourceProvenanceRoute({
      registryAccess: registry.access,
      repository: provenance,
      pathNormalizer: createProvenanceQueryPathNormalizer({
        getWorkspaceById: async () => ({ repoPath: root }),
        resolvePanelRoot: () => root,
      }),
      sendReply: async (_ws, _session, message) => { queryReplies.push(message); return true; },
    });
    await queryRoute.handleQuery({
      ws,
      session,
      message: {
        type: 'resource:provenance:query', version: 1, requestId: 'query-1',
        workspaceId: 'workspace-1', workspaceEpoch: WORKSPACE_EPOCH,
        panel: 'file-viewer', path: 'alias/note.md', fileName: 'note.md', limit: 50,
      },
    });
    await queryRoute.handleQuery({
      ws,
      session,
      message: {
        type: 'resource:provenance:query', version: 1, requestId: 'query-2',
        workspaceId: 'workspace-1', workspaceEpoch: WORKSPACE_EPOCH,
        panel: 'file-viewer', folderPrefix: 'alias', limit: 50,
      },
    });
    expect(queryReplies).toHaveLength(2);
    expect(queryReplies[0]).toMatchObject({
      type: 'resource:provenance:result', workspaceId: 'workspace-1',
      workspaceEpoch: WORKSPACE_EPOCH,
      items: [{ canonicalPath: 'docs/note.md', snapshot: { kind: 'bytes', byteLength: 6 } }],
    });
    expect(queryReplies[1]).toMatchObject({
      type: 'resource:provenance:result', requestId: 'query-2',
      items: [{ canonicalPath: 'docs/note.md' }],
    });
    expect(JSON.stringify(queryReplies)).not.toContain('before');
    expect(JSON.stringify(queryReplies)).not.toContain('after');
    await controller.stop();
  });
});
