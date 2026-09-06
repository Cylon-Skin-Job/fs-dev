'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAtomicWriter, AtomicWriteError } = require('../../lib/file-mutations/atomic-writer');
const { createDurableReservationAuthority } = require('../../lib/file-mutations/durable-reservations');
const { createFileOperationRepository } = require('../../lib/file-mutations/file-operation-repository');
const { createPathAuthority } = require('../../lib/file-mutations/path-authority');
const { createFileSaveController } = require('../../lib/file-mutations/save-controller');
const { SaveBusyError } = require('../../lib/file-mutations/save-mutex');
const { createDb, migrate } = require('./test-db');

const EPOCH = '123e4567-e89b-42d3-a456-000000000999';
const REBOUND_EPOCH = '123e4567-e89b-42d3-a456-000000000998';

describe('mediated file-save controller', () => {
  let db;
  let root;
  let operations;
  let reservations;
  let now;

  beforeEach(async () => {
    db = await migrate(createDb());
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-save-controller-'));
    fs.mkdirSync(path.join(root, 'Office'));
    operations = createFileOperationRepository(db);
    reservations = createDurableReservationAuthority(db);
    now = 1000;
  });

  afterEach(async () => {
    if (db) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const clock = () => { now += 1; return now; };
  const session = () => ({
    connectionId: 'connection-1', currentWorkspaceId: 'workspace-1', workspaceEpoch: EPOCH,
    projectRoot: '/tmp/untrusted-session-root',
  });
  const intent = (overrides = {}) => ({
    requestId: `request-${now}`,
    expectedWorkspaceId: 'workspace-1', expectedWorkspaceEpoch: EPOCH,
    panel: 'file-viewer', path: 'doc.md', content: 'new text', saveReason: 'manual',
    ...overrides,
  });
  const pathAuthority = () => createPathAuthority({
    getWorkspaceById: async () => ({ id: 'workspace-1', repoPath: root }),
    resolvePanelRoot: (workspaceRoot, panel) => panel === 'office-viewer'
      ? path.join(workspaceRoot, 'Office') : workspaceRoot,
  });

  function publishers({
    commandAdmitted = true,
    resourceAdmitted = true,
    resourceDeliveries = [],
    onResource,
  } = {}) {
    return {
      async publishFileCommandAccepted({ body }) {
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: commandAdmitted, eventId: commandAdmitted ? row.command_accepted_event_id : null, deliveries: [] };
      },
      async publishResourceMutated({ body }) {
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        if (onResource) await onResource(row);
        return {
          admitted: resourceAdmitted,
          eventId: resourceAdmitted ? row.resource_event_id : null,
          deliveries: resourceDeliveries,
        };
      },
    };
  }

  function controller(overrides = {}) {
    return createFileSaveController({
      operations, reservations, publishers: publishers(), pathAuthority: pathAuthority(), clock,
      ...overrides,
    });
  }

  test('creates with an absent snapshot and reports independently pending ledger truth', async () => {
    const result = await controller().save({ session: session(), intent: intent() });
    expect(result).toMatchObject({
      success: true, outcome: 'succeeded', commandFactState: 'admitted',
      resourceFactState: 'admitted', ledgerState: 'pending',
      provenanceState: 'pending_reconciliation', warningCodes: ['provenance_pending'],
    });
    expect(fs.readFileSync(path.join(root, 'doc.md'), 'utf8')).toBe('new text');
    await expect(operations.versions.getMetadata(result.fileVersionId)).resolves.toMatchObject({
      kind: 'absent', byteLength: 0,
    });
  });

  test('captures exact old bytes and aliases reuse canonical resource identity', async () => {
    fs.writeFileSync(path.join(root, 'Office', 'doc.md'), 'old bytes');
    const office = await controller().save({
      session: session(), intent: intent({ requestId: 'office-1', panel: 'office-viewer', path: 'doc.md' }),
    });
    expect(await operations.versions.readSnapshotBytes(office.fileVersionId)).toEqual(Buffer.from('old bytes'));
    const file = await controller().save({
      session: session(), intent: intent({ requestId: 'file-2', path: 'Office/doc.md', content: 'third' }),
    });
    expect(file.canonicalPath).toBe('Office/doc.md');
    expect(file.resourceId).toBe(office.resourceId);
    expect(await operations.versions.readSnapshotBytes(file.fileVersionId)).toEqual(Buffer.from('new text'));
  });

  test('concurrent panel aliases serialize on the canonical resource mutex', async () => {
    fs.writeFileSync(path.join(root, 'Office', 'doc.md'), 'old');
    const realWriter = createAtomicWriter();
    const entered = [];
    let releaseFirst;
    const held = new Promise((resolve) => { releaseFirst = resolve; });
    const atomicWriter = {
      cleanup: realWriter.cleanup,
      async replace(input) {
        entered.push(input.operationId);
        if (entered.length === 1) await held;
        return realWriter.replace(input);
      },
    };
    const c = controller({ atomicWriter });
    const firstPromise = c.save({
      session: session(),
      intent: intent({ requestId: 'alias-office', panel: 'office-viewer', path: 'doc.md', content: 'first' }),
    });
    while (entered.length === 0) await new Promise((resolve) => setImmediate(resolve));
    const secondPromise = c.save({
      session: session(),
      intent: intent({ requestId: 'alias-file', path: 'Office/doc.md', content: 'second' }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(entered).toHaveLength(1);
    releaseFirst();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(entered).toHaveLength(2);
    expect(first.resourceId).toBe(second.resourceId);
    expect(fs.readFileSync(path.join(root, 'Office', 'doc.md'), 'utf8')).toBe('second');
  });

  test('concurrent case aliases serialize as one physical resource on case-insensitive volumes', async () => {
    const exactPath = path.join(root, 'CaseFile.md');
    const aliasPath = path.join(root, 'casefile.md');
    fs.writeFileSync(exactPath, 'old');
    if (!fs.existsSync(aliasPath)) return;
    const realWriter = createAtomicWriter();
    const entered = [];
    let releaseFirst;
    const held = new Promise((resolve) => { releaseFirst = resolve; });
    const atomicWriter = {
      cleanup: realWriter.cleanup,
      async replace(input) {
        entered.push(input.operationId);
        if (entered.length === 1) await held;
        return realWriter.replace(input);
      },
    };
    const c = controller({ atomicWriter });
    const firstPromise = c.save({
      session: session(),
      intent: intent({ requestId: 'case-exact', path: 'CaseFile.md', content: 'first' }),
    });
    while (entered.length === 0) await new Promise((resolve) => setImmediate(resolve));
    const secondPromise = c.save({
      session: session(),
      intent: intent({ requestId: 'case-alias', path: 'casefile.md', content: 'second' }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(entered).toHaveLength(1);
    releaseFirst();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.canonicalPath).toBe('CaseFile.md');
    expect(second.canonicalPath).toBe(first.canonicalPath);
    expect(second.resourceId).toBe(first.resourceId);
    expect(fs.readFileSync(exactPath, 'utf8')).toBe('second');
  });

  test('concurrent absent case aliases serialize behind the winning physical spelling', async () => {
    const probePath = path.join(root, 'CaseProbe.md');
    fs.writeFileSync(probePath, 'probe');
    const caseInsensitive = fs.existsSync(path.join(root, 'caseprobe.md'));
    fs.unlinkSync(probePath);
    if (!caseInsensitive) return;
    const realWriter = createAtomicWriter();
    const entered = [];
    let releaseFirst;
    const held = new Promise((resolve) => { releaseFirst = resolve; });
    const atomicWriter = {
      cleanup: realWriter.cleanup,
      async replace(input) {
        entered.push(input.operationId);
        if (entered.length === 1) await held;
        return realWriter.replace(input);
      },
    };
    const c = controller({ atomicWriter });
    const firstPromise = c.save({
      session: session(),
      intent: intent({ requestId: 'absent-case-first', path: 'New.md', content: 'first' }),
    });
    while (entered.length === 0) await new Promise((resolve) => setImmediate(resolve));
    const secondPromise = c.save({
      session: session(),
      intent: intent({ requestId: 'absent-case-second', path: 'new.md', content: 'second' }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(entered).toHaveLength(1);
    releaseFirst();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.outcome).toBe('succeeded');
    expect(second.outcome).toBe('succeeded');
    expect(first.canonicalPath).toBe('New.md');
    expect(second.canonicalPath).toBe(first.canonicalPath);
    expect(second.resourceId).toBe(first.resourceId);
    expect(fs.readFileSync(path.join(root, 'New.md'), 'utf8')).toBe('second');
  });

  test.each([
    ['NFC/NFD', 'Unicode/Caf\u00e9.md', 'Unicode/Cafe\u0301.md'],
    ['sigma/final-sigma', 'Sigma/\u03a3.md', 'Sigma/\u03c2.md'],
    ['sharp-s/case', 'Sharp/Stra\u00dfe.md', 'Sharp/STRASSE.md'],
  ])('serializes absent %s aliases conservatively and follows host filesystem equivalence', async (_label, firstPath, aliasPath) => {
    const parentName = path.dirname(firstPath);
    fs.mkdirSync(path.join(root, parentName));
    const toggledParent = `${parentName[0].toLowerCase() === parentName[0]
      ? parentName[0].toUpperCase()
      : parentName[0].toLowerCase()}${parentName.slice(1)}`;
    const caseInsensitiveParent = fs.existsSync(path.join(root, toggledParent));
    const realWriter = createAtomicWriter();
    const entered = [];
    let releaseFirst;
    const held = new Promise((resolve) => { releaseFirst = resolve; });
    const atomicWriter = {
      cleanup: realWriter.cleanup,
      async replace(input) {
        entered.push(input.operationId);
        if (entered.length === 1) await held;
        return realWriter.replace(input);
      },
    };
    const c = controller({ atomicWriter });
    const firstPromise = c.save({
      session: session(),
      intent: intent({ requestId: `unicode-first-${_label}`, path: firstPath, content: 'first' }),
    });
    while (entered.length === 0) await new Promise((resolve) => setImmediate(resolve));
    const aliasPromise = c.save({
      session: session(),
      intent: intent({ requestId: `unicode-alias-${_label}`, path: aliasPath, content: 'second' }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(entered).toHaveLength(caseInsensitiveParent ? 1 : 2);
    releaseFirst();
    const [first, alias] = await Promise.all([firstPromise, aliasPromise]);
    expect(first.outcome).toBe('succeeded');
    expect(alias.outcome).toBe('succeeded');
    const firstStat = fs.statSync(path.join(root, firstPath));
    const aliasStat = fs.statSync(path.join(root, aliasPath));
    const filesystemEquivalent = String(firstStat.dev) === String(aliasStat.dev)
      && String(firstStat.ino) === String(aliasStat.ino);
    if (filesystemEquivalent) {
      expect(alias.canonicalPath).toBe(first.canonicalPath);
      expect(alias.resourceId).toBe(first.resourceId);
    } else {
      expect(alias.resourceId).not.toBe(first.resourceId);
    }
  });

  test('same-connection successful acknowledgement replay returns the stored response without side effects', async () => {
    const calls = { command: 0, resource: 0, write: 0, checkpoint: 0 };
    const realWriter = createAtomicWriter();
    const replayPublishers = {
      async publishFileCommandAccepted({ body }) {
        calls.command += 1;
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: true, eventId: row.command_accepted_event_id, deliveries: [] };
      },
      async publishResourceMutated({ body }) {
        calls.resource += 1;
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: true, eventId: row.resource_event_id, deliveries: [] };
      },
    };
    const c = controller({
      publishers: replayPublishers,
      atomicWriter: {
        cleanup: realWriter.cleanup,
        async replace(input) { calls.write += 1; return realWriter.replace(input); },
      },
      checkpoint: {
        async afterSave() { calls.checkpoint += 1; return 'committed'; },
      },
    });
    const replayIntent = intent({ requestId: 'success-ack-replay', saveReason: 'checkpoint' });
    const first = await c.save({ session: session(), intent: replayIntent });
    const replayed = await c.save({ session: session(), intent: replayIntent });
    expect(replayed).toEqual(first);
    expect(calls).toEqual({ command: 1, resource: 1, write: 1, checkpoint: 1 });
    await expect(operations.getById(first.operationId)).resolves.toMatchObject({ terminalResponse: first });
  });

  test('same-connection terminal failure replay returns stored IDs without a second attempt', async () => {
    const calls = { command: 0, write: 0, cleanup: 0 };
    const failurePublishers = publishers();
    const countedPublishers = {
      async publishFileCommandAccepted(input) {
        calls.command += 1;
        return failurePublishers.publishFileCommandAccepted(input);
      },
      publishResourceMutated: failurePublishers.publishResourceMutated,
    };
    const c = controller({
      publishers: countedPublishers,
      atomicWriter: {
        async replace() {
          calls.write += 1;
          throw new AtomicWriteError('replace failed', { code: 'replace_failed' });
        },
        async cleanup() { calls.cleanup += 1; return true; },
      },
    });
    const replayIntent = intent({ requestId: 'failure-ack-replay' });
    const first = await c.save({ session: session(), intent: replayIntent });
    const replayed = await c.save({ session: session(), intent: replayIntent });
    expect(replayed).toEqual(first);
    expect(replayed).toMatchObject({ outcome: 'failed_before_replace', errorCode: 'replace_failed' });
    expect(calls).toEqual({ command: 1, write: 1, cleanup: 1 });
  });

  test.each(['transient', 'persistent'])('successful replay reconstructs exact checkpoint truth after %s terminal JSON failure', async (mode) => {
    let stores = 0;
    const wrappedOperations = {
      ...operations,
      async storeTerminalResponse(...args) {
        stores += 1;
        if (mode === 'persistent' || stores === 1) throw new Error('terminal JSON unavailable');
        return operations.storeTerminalResponse(...args);
      },
    };
    const calls = { write: 0, checkpoint: 0 };
    const realWriter = createAtomicWriter();
    const c = controller({
      operations: wrappedOperations,
      atomicWriter: {
        cleanup: realWriter.cleanup,
        async replace(input) { calls.write += 1; return realWriter.replace(input); },
      },
      checkpoint: { async afterSave() { calls.checkpoint += 1; return 'committed'; } },
    });
    const replayIntent = intent({ requestId: `success-json-${mode}`, saveReason: 'checkpoint' });
    const first = await c.save({ session: session(), intent: replayIntent });
    const replaySession = mode === 'persistent'
      ? { ...session(), workspaceEpoch: REBOUND_EPOCH }
      : session();
    const repeatedIntent = mode === 'persistent'
      ? { ...replayIntent, expectedWorkspaceEpoch: REBOUND_EPOCH }
      : replayIntent;
    const replayed = await c.save({ session: replaySession, intent: repeatedIntent });
    expect(first).toMatchObject({ outcome: 'succeeded', checkpointState: 'committed' });
    expect(replayed).toEqual(first);
    expect(calls).toEqual({ write: 1, checkpoint: 1 });
    const durable = await operations.getById(first.operationId);
    expect(durable.responseSnapshot).toMatchObject({ checkpointState: 'committed' });
    if (mode === 'persistent') expect(durable.terminalResponse).toBeNull();
    else expect(durable.terminalResponse).toEqual(first);
  });

  test.each(['transient', 'persistent'])('terminal failure replay survives %s terminal JSON failure without another attempt', async (mode) => {
    let stores = 0;
    const wrappedOperations = {
      ...operations,
      async storeTerminalResponse(...args) {
        stores += 1;
        if (mode === 'persistent' || stores === 1) throw new Error('terminal JSON unavailable');
        return operations.storeTerminalResponse(...args);
      },
    };
    let writes = 0;
    const c = controller({
      operations: wrappedOperations,
      atomicWriter: {
        async replace() {
          writes += 1;
          throw new AtomicWriteError('replace failed', { code: 'replace_failed' });
        },
        async cleanup() { return true; },
      },
    });
    const replayIntent = intent({ requestId: `failure-json-${mode}` });
    const first = await c.save({ session: session(), intent: replayIntent });
    const replaySession = mode === 'persistent'
      ? { ...session(), workspaceEpoch: REBOUND_EPOCH }
      : session();
    const repeatedIntent = mode === 'persistent'
      ? { ...replayIntent, expectedWorkspaceEpoch: REBOUND_EPOCH }
      : replayIntent;
    const replayed = await c.save({ session: replaySession, intent: repeatedIntent });
    expect(replayed).toEqual(first);
    expect(writes).toBe(1);
    expect((await operations.getById(first.operationId)).responseSnapshot)
      .toMatchObject({ resourceFactState: 'not_emitted', ledgerState: 'not_applicable' });
  });

  test.each([
    ['ASCII case', 'Replay/lower.md', 'Replay/Lower.md'],
    ['NFC/NFD', 'ReplayNfc/Caf\u00e9.md', 'ReplayNfc/Cafe\u0301.md'],
    ['sigma/final-sigma', 'ReplaySigma/\u03a3.md', 'ReplaySigma/\u03c2.md'],
    ['sharp-s/case', 'ReplaySharp/Stra\u00dfe.md', 'ReplaySharp/STRASSE.md'],
  ])('terminal replay remains stable after mediated %s alias winner creation', async (_label, originalPath, winnerPath) => {
    fs.mkdirSync(path.join(root, path.dirname(originalPath)));
    const realWriter = createAtomicWriter();
    let failReplacement = true;
    let writes = 0;
    const c = controller({
      atomicWriter: {
        cleanup: realWriter.cleanup,
        async replace(input) {
          writes += 1;
          if (failReplacement) throw new AtomicWriteError('replace failed', { code: 'replace_failed' });
          return realWriter.replace(input);
        },
      },
    });
    const originalIntent = intent({ requestId: `original-${_label}`, path: originalPath });
    const first = await c.save({ session: session(), intent: originalIntent });
    expect(first).toMatchObject({ outcome: 'failed_before_replace', errorCode: 'replace_failed' });
    failReplacement = false;
    const secondSession = { ...session(), connectionId: 'connection-2' };
    const winner = await c.save({
      session: secondSession,
      intent: intent({ requestId: `winner-${_label}`, path: winnerPath, content: 'winner' }),
    });
    expect(winner.outcome).toBe('succeeded');
    const replayed = await c.save({ session: session(), intent: originalIntent });
    expect(replayed).toEqual(first);
    expect(writes).toBe(2);
  });

  test('rejects envelope, stale pair, semantic text, and untrusted path before reservation', async () => {
    const c = controller();
    await expect(c.save({ session: session(), intent: intent({ requestId: '' }) }))
      .resolves.toMatchObject({ errorCode: 'invalid_request' });
    await expect(c.save({ session: session(), intent: intent({ expectedWorkspaceEpoch: '123e4567-e89b-42d3-a456-000000000998' }) }))
      .resolves.toMatchObject({ errorCode: 'stale_workspace' });
    await expect(c.save({ session: session(), intent: intent({ content: '\ud800' }) }))
      .resolves.toMatchObject({ errorCode: 'unsupported_text' });
    await expect(c.save({ session: session(), intent: intent({ path: '../escape.md' }) }))
      .resolves.toMatchObject({ errorCode: 'invalid_request' });
    await expect(c.save({ session: session(), intent: intent({ saveReason: 'milestone' }) }))
      .resolves.toMatchObject({ outcome: 'rejected', errorCode: 'invalid_request' });
    expect(await db('file_operations').count({ count: '*' }).first()).toMatchObject({ count: 0 });
  });

  test('valid milestone metadata is bound into both replayable fact bodies', async () => {
    const bodies = [];
    const milestonePublishers = {
      async publishFileCommandAccepted({ body }) {
        bodies.push(['command', body]);
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: true, eventId: row.command_accepted_event_id, deliveries: [] };
      },
      async publishResourceMutated({ body }) {
        bodies.push(['resource', body]);
        const row = await db('file_operations').where({ command_id: body.commandId }).first();
        return { admitted: true, eventId: row.resource_event_id, deliveries: [] };
      },
    };
    const result = await controller({ publishers: milestonePublishers }).save({
      session: session(),
      intent: intent({ requestId: 'milestone-valid', saveReason: 'milestone', milestone: '' }),
    });
    expect(result.outcome).toBe('succeeded');
    expect(bodies).toHaveLength(2);
    expect(bodies[0][1].intent).toMatchObject({ saveReason: 'milestone', milestone: '' });
    expect(bodies[1][1].mutation).toMatchObject({ saveReason: 'milestone', milestone: '' });
  });

  test('command admission failure does not block the write and remains pending', async () => {
    const result = await controller({ publishers: publishers({ commandAdmitted: false }) })
      .save({ session: session(), intent: intent() });
    expect(result).toMatchObject({ success: true, commandFactState: 'pending' });
    expect(fs.readFileSync(path.join(root, 'doc.md'), 'utf8')).toBe('new text');
  });

  test('resource admission failure leaves successful filesystem truth pending', async () => {
    const recoveries = [];
    const result = await controller({
      publishers: publishers({ resourceAdmitted: false }),
      publishResourceRefreshRequired: async (message) => { recoveries.push(message); },
    })
      .save({ session: session(), intent: intent() });
    expect(result).toMatchObject({
      success: true, resourceFactState: 'pending', ledgerState: 'pending',
      provenanceState: 'pending_reconciliation',
    });
    expect(fs.readFileSync(path.join(root, 'doc.md'), 'utf8')).toBe('new text');
    expect(recoveries).toEqual([expect.objectContaining({
      reason: 'fact_publish_failed', workspaceId: 'workspace-1', panel: 'file-viewer',
      path: 'doc.md', operationId: result.operationId,
    })]);
  });

  test('missing render subscriber delivery recovers, while an invoked delivery does not', async () => {
    const unavailable = [];
    const first = await controller({
      publishers: publishers(),
      publishResourceRefreshRequired: async (message) => { unavailable.push(message); },
    }).save({ session: session(), intent: intent({ requestId: 'projection-unavailable' }) });
    expect(first.success).toBe(true);
    expect(unavailable).toEqual([expect.objectContaining({
      reason: 'projection_unavailable', path: 'doc.md', operationId: first.operationId,
    })]);

    const noRecovery = jest.fn(async () => {});
    const second = await controller({
      publishers: publishers({
        resourceDeliveries: [{
          subscriptionId: 'projection-subscription',
          handlerKey: 'system.resource-render-projection',
          status: 'invoked',
        }],
      }),
      publishResourceRefreshRequired: noRecovery,
    }).save({
      session: session(),
      intent: intent({ requestId: 'projection-invoked', content: 'second text' }),
    });
    expect(second.success).toBe(true);
    expect(noRecovery).not.toHaveBeenCalled();
  });

  test('validation and pre-rename failure never emit recovery', async () => {
    const recover = jest.fn(async () => {});
    const c = controller({
      publishResourceRefreshRequired: recover,
      atomicWriter: {
        replace: async () => { throw new AtomicWriteError('failed', { code: 'replace_failed' }); },
        cleanup: async () => true,
      },
    });
    await c.save({ session: session(), intent: intent({ requestId: '', path: '../escape.md' }) });
    await c.save({ session: session(), intent: intent({ requestId: 'pre-rename-failure' }) });
    expect(recover).not.toHaveBeenCalled();
  });

  test('queue overflow returns save_busy before reserving identities', async () => {
    const busyMutex = { runExclusive: async () => { throw new SaveBusyError(); } };
    const result = await controller({ mutex: busyMutex }).save({ session: session(), intent: intent() });
    expect(result).toMatchObject({ success: false, outcome: 'rejected', errorCode: 'save_busy' });
    expect(result.operationId).toBeUndefined();
    expect(await db('file_operations').count({ count: '*' }).first()).toMatchObject({ count: 0 });
  });

  test('unsupported preimage is a durable pre-replace failure with no resource fact', async () => {
    fs.writeFileSync(path.join(root, 'doc.md'), Buffer.from([0xc3, 0x28]));
    const result = await controller().save({ session: session(), intent: intent() });
    expect(result).toMatchObject({
      success: false, outcome: 'failed_before_replace', errorCode: 'unsupported_preimage',
      resourceFactState: 'not_emitted', ledgerState: 'not_applicable',
    });
    expect(fs.readFileSync(path.join(root, 'doc.md'))).toEqual(Buffer.from([0xc3, 0x28]));
    await expect(operations.getById(result.operationId)).resolves.toMatchObject({ state: 'failed' });
  });

  test('rejects an oversized preimage from opened-file stat without reading its bytes', async () => {
    const oversizedPath = path.join(root, 'oversized.md');
    fs.writeFileSync(oversizedPath, 'small fixture');
    let readCalled = false;
    const wrappedFs = Object.create(fs.promises);
    wrappedFs.open = async (...args) => {
      const handle = await fs.promises.open(...args);
      return {
        stat: async () => {
          const stat = await handle.stat();
          return {
            isFile: () => true,
            dev: stat.dev,
            ino: stat.ino,
            birthtimeMs: stat.birthtimeMs,
            size: (10 * 1024 * 1024) + 1,
          };
        },
        readFile: async () => { readCalled = true; return handle.readFile(); },
        close: () => handle.close(),
      };
    };
    const result = await controller({ fsPromises: wrappedFs }).save({
      session: session(), intent: intent({ requestId: 'oversized-preimage', path: 'oversized.md' }),
    });
    expect(result).toMatchObject({ outcome: 'failed_before_replace', errorCode: 'preimage_too_large' });
    expect(readCalled).toBe(false);
  });

  test('bounds the opened preimage read when the file grows after its small stat', async () => {
    const growingPath = path.join(root, 'growing.md');
    fs.writeFileSync(growingPath, 'small');
    const actual = fs.statSync(growingPath);
    let totalRead = 0;
    const wrappedFs = Object.create(fs.promises);
    wrappedFs.open = async () => ({
      stat: async () => ({
        isFile: () => true,
        dev: actual.dev,
        ino: actual.ino,
        birthtimeMs: actual.birthtimeMs,
        size: 5,
      }),
      read: async (buffer, offset, length) => {
        const remaining = ((10 * 1024 * 1024) + 1) - totalRead;
        const bytesRead = Math.min(length, remaining);
        if (bytesRead <= 0) return { bytesRead: 0, buffer };
        buffer.fill(0x61, offset, offset + bytesRead);
        totalRead += bytesRead;
        return { bytesRead, buffer };
      },
      close: async () => {},
    });
    const result = await controller({ fsPromises: wrappedFs }).save({
      session: session(), intent: intent({ requestId: 'growing-preimage', path: 'growing.md' }),
    });
    expect(result).toMatchObject({ outcome: 'failed_before_replace', errorCode: 'preimage_too_large' });
    expect(totalRead).toBe((10 * 1024 * 1024) + 1);
  });

  test('pre-rename and post-rename failures produce truthful retry domains', async () => {
    const before = {
      replace: async () => { throw new AtomicWriteError('failed', { code: 'replace_failed' }); },
      cleanup: async () => true,
    };
    const failed = await controller({ atomicWriter: before }).save({
      session: session(), intent: intent({ requestId: 'before' }),
    });
    expect(failed).toMatchObject({ outcome: 'failed_before_replace', retrySafe: true, errorCode: 'replace_failed' });

    const after = {
      replace: async ({ target, bytes }) => {
        fs.writeFileSync(target.targetPath, bytes);
        throw new AtomicWriteError('unknown', { code: 'mutation_outcome_unknown', renamed: true });
      },
      cleanup: async () => true,
    };
    const recoveries = [];
    const unknown = await controller({
      atomicWriter: after,
      publishResourceRefreshRequired: async (message) => { recoveries.push(message); },
    }).save({
      session: session(), intent: intent({ requestId: 'after', path: 'unknown.md' }),
    });
    expect(unknown).toMatchObject({ outcome: 'outcome_unknown', retrySafe: false });
    expect(recoveries).toEqual([expect.objectContaining({
      reason: 'mutation_outcome_unknown', path: 'unknown.md', operationId: unknown.operationId,
    })]);
    await expect(operations.getById(unknown.operationId)).resolves.toMatchObject({ state: 'outcome_unknown' });
  });

  test('post-write DB failure stays a successful file save pending reconciliation', async () => {
    const failingOperations = { ...operations, markSucceeded: async () => { throw new Error('db unavailable'); } };
    const realWriter = createAtomicWriter();
    const calls = { write: 0, checkpoint: 0 };
    const c = controller({
      operations: failingOperations,
      atomicWriter: {
        cleanup: realWriter.cleanup,
        async replace(input) { calls.write += 1; return realWriter.replace(input); },
      },
      checkpoint: { async afterSave() { calls.checkpoint += 1; return 'not_requested'; } },
    });
    const replayIntent = intent({ requestId: 'post-write-db-failure' });
    const result = await c.save({ session: session(), intent: replayIntent });
    const replayed = await c.save({ session: session(), intent: replayIntent });
    expect(result).toMatchObject({ success: true, outcome: 'succeeded', provenanceState: 'pending_reconciliation' });
    expect(replayed).toEqual(result);
    expect(calls).toEqual({ write: 1, checkpoint: 1 });
    expect(fs.readFileSync(path.join(root, 'doc.md'), 'utf8')).toBe('new text');
    await expect(operations.getById(result.operationId)).resolves.toMatchObject({ state: 'prepared' });
    const restarted = await controller({ operations: failingOperations }).save({
      session: session(), intent: replayIntent,
    });
    expect(restarted).toMatchObject({ outcome: 'outcome_unknown', retrySafe: false });
  });

  test('success transition acknowledgement loss is read back without duplicate work', async () => {
    let acknowledgements = 0;
    const acknowledgementLoss = {
      ...operations,
      async markSucceeded(input) {
        acknowledgements += 1;
        const committed = await operations.markSucceeded(input);
        if (acknowledgements === 1) throw new Error('success acknowledgement lost');
        return committed;
      },
    };
    let writes = 0;
    const realWriter = createAtomicWriter();
    const c = controller({
      operations: acknowledgementLoss,
      atomicWriter: {
        cleanup: realWriter.cleanup,
        async replace(input) { writes += 1; return realWriter.replace(input); },
      },
    });
    const replayIntent = intent({ requestId: 'success-transition-ack-loss' });
    const first = await c.save({ session: session(), intent: replayIntent });
    const replayed = await c.save({ session: session(), intent: replayIntent });
    expect(replayed).toEqual(first);
    expect(writes).toBe(1);
    expect(acknowledgements).toBe(1);
    await expect(operations.getById(first.operationId)).resolves.toMatchObject({ state: 'succeeded' });
  });

  test('persistent post-write storage outage can never demote a completed replacement to retry-safe rejection', async () => {
    let postReplaceOutage = false;
    let reservationsAttempted = 0;
    const failingOperations = {
      ...operations,
      async reserve(input) {
        reservationsAttempted += 1;
        if (postReplaceOutage) throw new Error('db unavailable');
        return operations.reserve(input);
      },
      markSucceeded: async () => {
        postReplaceOutage = true;
        throw new Error('db unavailable');
      },
      getResourceFactBody: async () => { throw new Error('db unavailable'); },
      getById: async () => { throw new Error('db unavailable'); },
      storeResponseSnapshot: async () => { throw new Error('db unavailable'); },
      storeTerminalResponse: async () => { throw new Error('db unavailable'); },
    };
    const c = controller({ operations: failingOperations });
    const replayIntent = intent({ requestId: 'persistent-post-write-outage' });
    const result = await c.save({
      session: session(), intent: replayIntent,
    });
    const replayed = await c.save({ session: session(), intent: replayIntent });
    expect(fs.readFileSync(path.join(root, 'doc.md'), 'utf8')).toBe('new text');
    expect(result).toMatchObject({
      success: true, outcome: 'succeeded', provenanceState: 'pending_reconciliation',
      resourceFactState: 'pending', ledgerState: 'pending',
    });
    expect(result.retrySafe).toBeUndefined();
    expect(result.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(replayed).toEqual(result);
    expect(reservationsAttempted).toBe(1);
  });

  test('an identical waiter rechecks the stable response cache after post-write storage loss', async () => {
    let outage = false;
    let reservationsAttempted = 0;
    const failingOperations = {
      ...operations,
      async reserve(input) {
        reservationsAttempted += 1;
        if (outage) throw new Error('db unavailable');
        return operations.reserve(input);
      },
      async markSucceeded() { outage = true; throw new Error('db unavailable'); },
      async getResourceFactBody() { throw new Error('db unavailable'); },
      async getById() { throw new Error('db unavailable'); },
      async storeResponseSnapshot() { throw new Error('db unavailable'); },
      async storeTerminalResponse() { throw new Error('db unavailable'); },
    };
    const realWriter = createAtomicWriter();
    let releaseWrite;
    let entered = false;
    let writes = 0;
    const held = new Promise((resolve) => { releaseWrite = resolve; });
    const c = controller({
      operations: failingOperations,
      atomicWriter: {
        cleanup: realWriter.cleanup,
        async replace(input) {
          writes += 1;
          entered = true;
          await held;
          return realWriter.replace(input);
        },
      },
    });
    const replayIntent = intent({ requestId: 'queued-post-write-outage' });
    const firstPromise = c.save({ session: session(), intent: replayIntent });
    while (!entered) await new Promise((resolve) => setImmediate(resolve));
    const waitingPromise = c.save({ session: session(), intent: replayIntent });
    await new Promise((resolve) => setImmediate(resolve));
    releaseWrite();
    const [first, waiting] = await Promise.all([firstPromise, waitingPromise]);
    expect(waiting).toEqual(first);
    expect(first.outcome).toBe('succeeded');
    expect(writes).toBe(1);
    expect(reservationsAttempted).toBe(1);
  });

  test('persistent pre-write storage outage retains accepted IDs and never becomes rejected', async () => {
    const failingOperations = {
      ...operations,
      prepare: async () => { throw new Error('db unavailable'); },
      markFailed: async () => { throw new Error('db unavailable'); },
      getById: async () => { throw new Error('db unavailable'); },
    };
    const result = await controller({ operations: failingOperations }).save({
      session: session(), intent: intent({ requestId: 'persistent-pre-write-outage' }),
    });
    expect(result).toMatchObject({
      success: false, outcome: 'failed_before_replace', errorCode: 'snapshot_failed',
      retrySafe: true, resourceFactState: 'not_emitted',
    });
    expect(result.operationId).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(operations.getById(result.operationId)).resolves.toMatchObject({ state: 'accepted' });
    expect(fs.existsSync(path.join(root, 'doc.md'))).toBe(false);
  });

  test('attempt-registration failure becomes durable failed and never restart ambiguity', async () => {
    const failingOperations = {
      ...operations,
      markAttempted: async () => { throw new Error('attempt registration failed'); },
    };
    const result = await controller({ operations: failingOperations }).save({
      session: session(), intent: intent({ requestId: 'attempt-registration-failed' }),
    });
    expect(result).toMatchObject({
      outcome: 'failed_before_replace', errorCode: 'write_prepare_failed', retrySafe: true,
    });
    await expect(operations.getById(result.operationId)).resolves.toMatchObject({
      state: 'failed', attemptedAt: null, failureCode: 'write_prepare_failed',
    });
    await expect(operations.resources.getById(result.resourceId)).resolves.toMatchObject({
      lifecycleState: 'tombstoned', tombstoneReason: 'create_failed_before_replace',
    });
    expect((await operations.listForReconciliation()).map((item) => item.operationId))
      .not.toContain(result.operationId);
    expect(fs.existsSync(path.join(root, 'doc.md'))).toBe(false);
  });

  test('prepare commit followed by acknowledgement loss terminalizes before any writer invocation', async () => {
    let writes = 0;
    const acknowledgementLoss = {
      ...operations,
      prepare: async (input) => {
        await operations.prepare(input);
        throw new Error('prepare acknowledgement lost');
      },
    };
    const result = await controller({
      operations: acknowledgementLoss,
      atomicWriter: {
        replace: async () => { writes += 1; throw new Error('must not write'); },
        cleanup: async () => false,
      },
    }).save({
      session: session(), intent: intent({ requestId: 'prepare-acknowledgement-loss' }),
    });
    expect(result).toMatchObject({
      outcome: 'failed_before_replace', errorCode: 'write_prepare_failed', retrySafe: true,
    });
    expect(writes).toBe(0);
    await expect(operations.getById(result.operationId)).resolves.toMatchObject({
      state: 'failed', attemptedAt: null, failureCode: 'write_prepare_failed', tempCleanupState: 'complete',
    });
    expect((await operations.listForReconciliation()).map((item) => item.operationId))
      .not.toContain(result.operationId);
    expect(fs.existsSync(path.join(root, 'doc.md'))).toBe(false);
  });

  test('attempt commit followed by acknowledgement loss terminalizes before any writer invocation', async () => {
    let writes = 0;
    const acknowledgementLoss = {
      ...operations,
      markAttempted: async (...args) => {
        await operations.markAttempted(...args);
        throw new Error('attempt acknowledgement lost');
      },
    };
    const result = await controller({
      operations: acknowledgementLoss,
      atomicWriter: {
        replace: async () => { writes += 1; throw new Error('must not write'); },
        cleanup: async () => false,
      },
    }).save({
      session: session(), intent: intent({ requestId: 'attempt-acknowledgement-loss' }),
    });
    expect(result).toMatchObject({
      outcome: 'failed_before_replace', errorCode: 'write_prepare_failed', retrySafe: true,
    });
    expect(writes).toBe(0);
    await expect(operations.getById(result.operationId)).resolves.toMatchObject({
      state: 'failed', failureCode: 'write_prepare_failed', tempCleanupState: 'complete',
    });
    expect((await operations.listForReconciliation()).map((item) => item.operationId))
      .not.toContain(result.operationId);
    expect(fs.existsSync(path.join(root, 'doc.md'))).toBe(false);
  });

  test('checkpoint failure remains a warning after the projection cutover', async () => {
    const result = await controller({
      checkpoint: { afterSave: async () => 'failed' },
    }).save({
      session: session(), intent: intent({ saveReason: 'checkpoint' }),
    });
    expect(result).toMatchObject({ success: true, checkpointState: 'failed' });
    expect(result.warningCodes).toEqual(['checkpoint_failed', 'provenance_pending']);
  });

  test('ledger stored and conflict states remain distinct from fact admission', async () => {
    const stored = await controller({
      publishers: publishers({
        onResource: async (row) => operations.markLedgerStored(row.operation_id, clock()),
      }),
    }).save({ session: session(), intent: intent({ requestId: 'stored' }) });
    expect(stored).toMatchObject({ ledgerState: 'stored', provenanceState: 'complete' });

    const conflict = await controller({
      publishers: publishers({
        onResource: async (row) => operations.markLedgerConflict(row.operation_id, clock()),
      }),
    }).save({ session: session(), intent: intent({ requestId: 'conflict', content: 'next' }) });
    expect(conflict).toMatchObject({ ledgerState: 'conflict', provenanceState: 'pending_reconciliation' });
  });

  test('real atomic writer performs one filesystem replacement', async () => {
    let renames = 0;
    const wrapped = Object.create(fs.promises);
    wrapped.rename = async (...args) => { renames += 1; return fs.promises.rename(...args); };
    const result = await controller({ atomicWriter: createAtomicWriter({ fsPromises: wrapped }) })
      .save({ session: session(), intent: intent() });
    expect(result.success).toBe(true);
    expect(renames).toBe(1);
  });
});
