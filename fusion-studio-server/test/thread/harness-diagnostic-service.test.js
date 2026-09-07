'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validCandidate(overrides = {}) {
  return {
    version: 1,
    harnessId: 'opencode',
    category: 'process_exit',
    exitCode: 1,
    hadRenderableOutput: true,
    hadToolCalls: false,
    truncatedFields: [],
    ...overrides,
  };
}

function binding(overrides = {}) {
  return {
    workspaceId: 'ws-1',
    projectRoot: '/tmp/ws-1-root',
    workspaceEpoch: 'epoch-ws-1',
    threadId: 'thread-1',
    turnId: 'turn-1',
    ...overrides,
  };
}

describe('harness diagnostic service (SPEC-03 Slice C)', () => {
  let tempRoot;
  let modules;
  let previousUserData;

  beforeEach(async () => {
    jest.resetModules();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-harness-diag-'));
    previousUserData = process.env.FUSION_APP_USER_DATA;
    process.env.FUSION_APP_USER_DATA = path.join(tempRoot, 'user-data');
    modules = {
      db: require('../../lib/db'),
      service: require('../../lib/thread/harness-diagnostic-service'),
    };
    await modules.db.initDb();
  });

  afterEach(async () => {
    await modules?.db.closeDb();
    if (previousUserData === undefined) {
      delete process.env.FUSION_APP_USER_DATA;
    } else {
      process.env.FUSION_APP_USER_DATA = previousUserData;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
    jest.resetModules();
    jest.restoreAllMocks();
  });

  function db() {
    return modules.db.getDb();
  }

  async function seedRows(rows) {
    await db().transaction(async (trx) => {
      for (const row of rows) {
        await trx('harness_error_diagnostics').insert(row);
      }
    });
  }

  function seedRow(overrides = {}) {
    const candidate = overrides.report || validCandidate();
    return {
      diagnostic_id: overrides.diagnostic_id || `seed-${Math.random().toString(36).slice(2)}`,
      workspace_id: overrides.workspace_id || 'ws-1',
      project_root: overrides.project_root || '/tmp/ws-1-root',
      workspace_epoch: overrides.workspace_epoch || 'epoch-ws-1',
      thread_id: overrides.thread_id || 'thread-1',
      turn_id: overrides.turn_id || 'turn-1',
      report_json: JSON.stringify(candidate),
      created_at: overrides.created_at ?? Date.now(),
      expires_at: overrides.expires_at ?? (Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  test('migration 034 creates the dedicated diagnostics table with the binding, report, and cleanup columns', async () => {
    expect(await db().schema.hasTable('harness_error_diagnostics')).toBe(true);
    const columns = await db().raw("PRAGMA table_info('harness_error_diagnostics')");
    expect(columns.map((column) => column.name).sort()).toEqual([
      'created_at',
      'diagnostic_id',
      'expires_at',
      'project_root',
      'report_json',
      'thread_id',
      'turn_id',
      'workspace_epoch',
      'workspace_id',
    ]);
  });

  test('persists a fully-bound validated report and returns a server-generated UUID', async () => {
    const before = Date.now();
    const candidate = validCandidate({ modelId: 'k3', message: 'redacted summary' });
    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), candidate);

    expect(diagnosticId).toMatch(UUID_PATTERN);
    const row = await db()('harness_error_diagnostics').where('diagnostic_id', diagnosticId).first();
    expect(row).toMatchObject({
      workspace_id: 'ws-1',
      project_root: '/tmp/ws-1-root',
      workspace_epoch: 'epoch-ws-1',
      thread_id: 'thread-1',
      turn_id: 'turn-1',
    });
    expect(JSON.parse(row.report_json)).toEqual(candidate);
    expect(row.created_at).toBeGreaterThanOrEqual(before);
    // 30-day retention bound.
    expect(row.expires_at - row.created_at).toBe(30 * 24 * 60 * 60 * 1000);
  });

  test('re-enforces short-identifier/message/stderr bounds with allowlisted truncation markers', async () => {
    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), validCandidate({
      harnessId: 'é'.repeat(200), // 400 UTF-8 bytes — byte-bound truncation
      message: 'a'.repeat(5000),
      stderrExcerpt: `HEAD-MARKER${'b'.repeat(20000)}`,
      truncatedFields: ['modelId', 'notARealField', 'stack'],
    }));

    expect(diagnosticId).toMatch(UUID_PATTERN);
    const row = await db()('harness_error_diagnostics').where('diagnostic_id', diagnosticId).first();
    const report = JSON.parse(row.report_json);
    // 128 UTF-8 bytes per short identifier (byte-bound, never char-bound).
    expect(Buffer.byteLength(report.harnessId, 'utf8')).toBeLessThanOrEqual(128);
    // 4 KiB message prefix.
    expect(report.message).toBe('a'.repeat(4096));
    // 16 KiB stderr TAIL — the head is dropped, not the tail.
    expect(Buffer.byteLength(report.stderrExcerpt, 'utf8')).toBe(16384);
    expect(report.stderrExcerpt).not.toContain('HEAD-MARKER');
    // Markers: truncation recorded; non-allowlisted names discarded.
    expect(report.truncatedFields).toEqual(
      expect.arrayContaining(['harnessId', 'message', 'stderrExcerpt', 'modelId']),
    );
    expect(report.truncatedFields).not.toContain('notARealField');
    expect(report.truncatedFields).not.toContain('stack');
  });

  test('truncation markers are capped at 16 allowlisted names', async () => {
    const report = modules.service.revalidateCandidate(validCandidate({
      truncatedFields: Array.from({ length: 40 }, (_, i) => (i % 2 ? 'message' : 'stderrExcerpt')),
    }));
    expect(report.truncatedFields.length).toBeLessThanOrEqual(16);
    for (const name of report.truncatedFields) {
      expect(['message', 'stderrExcerpt', 'harnessId', 'modelId', 'providerCode', 'errorName', 'signal', 'lastCanonicalEventType']).toContain(name);
    }
  });

  test('the final serialized report never exceeds 24 KiB', async () => {
    // Per-field bounds (6×128B identifiers + 4KiB message + 16KiB tail)
    // sum below 24 KiB, so the cap is a defense-in-depth backstop the
    // bounded path can never exceed; assert the guarantee on a max input.
    const maxed = validCandidate({
      modelId: 'm'.repeat(200),
      providerCode: 'p'.repeat(200),
      errorName: 'e'.repeat(200),
      signal: 's'.repeat(200),
      lastCanonicalEventType: 'l'.repeat(200),
      message: 'a'.repeat(8000),
      stderrExcerpt: 'b'.repeat(40000),
    });
    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), maxed);
    expect(diagnosticId).toMatch(UUID_PATTERN);
    const row = await db()('harness_error_diagnostics').where('diagnostic_id', diagnosticId).first();
    expect(Buffer.byteLength(row.report_json, 'utf8')).toBeLessThanOrEqual(24576);
  });

  test('unknown keys are discarded; structurally invalid drafts are rejected whole with no row written', async () => {
    const hostile = validCandidate({
      stack: 'HOSTILE-STACK-TEXT',
      env: { SECRET: 'HOSTILE-ENV' },
      rawError: { message: 'HOSTILE-RAW' },
      prompt: 'HOSTILE-PROMPT',
    });
    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), hostile);
    expect(diagnosticId).toMatch(UUID_PATTERN);
    const row = await db()('harness_error_diagnostics').where('diagnostic_id', diagnosticId).first();
    const stored = JSON.parse(row.report_json);
    expect(Object.keys(stored).sort()).toEqual([
      'category', 'exitCode', 'hadRenderableOutput', 'hadToolCalls', 'harnessId', 'truncatedFields', 'version',
    ]);
    expect(row.report_json).not.toContain('HOSTILE');

    for (const invalid of [
      null,
      'string',
      validCandidate({ version: 2 }),
      { ...validCandidate(), harnessId: '' },
      { ...validCandidate(), category: 'unknown' },
      { ...validCandidate(), hadToolCalls: 'yes' },
      { ...validCandidate(), truncatedFields: 'message' },
    ]) {
      expect(await modules.service.persistDiagnosticReport(binding(), invalid)).toBeNull();
    }
    expect(await db()('harness_error_diagnostics').count('* as c').first()).toEqual({ c: 1 });
    // Invalid binding is rejected without touching the table.
    expect(await modules.service.persistDiagnosticReport({ workspaceId: '', threadId: 't', turnId: 'u' }, validCandidate())).toBeNull();
  });

  test('insertion purges expired rows in the same transaction (30-day retention)', async () => {
    const now = Date.now();
    await seedRows([
      seedRow({ diagnostic_id: 'expired-row', created_at: now - 40 * 24 * 60 * 60 * 1000, expires_at: now - 1000 }),
      seedRow({ diagnostic_id: 'live-row', created_at: now - 1000, expires_at: now + 100000 }),
    ]);

    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), validCandidate());
    expect(diagnosticId).toMatch(UUID_PATTERN);

    const ids = (await db()('harness_error_diagnostics').select('diagnostic_id')).map((row) => row.diagnostic_id);
    expect(ids).toEqual(expect.arrayContaining(['live-row', diagnosticId]));
    expect(ids).not.toContain('expired-row');
  });

  test('per-workspace cap: oldest rows evict so 500 rows remain AFTER insertion', async () => {
    const base = Date.now() - 1000000;
    await seedRows(Array.from({ length: 500 }, (_, i) => seedRow({
      diagnostic_id: `ws1-${String(i).padStart(4, '0')}`,
      workspace_id: 'ws-1',
      created_at: base + i,
    })));

    const diagnosticId = await modules.service.persistDiagnosticReport(
      binding({ workspaceId: 'ws-1' }),
      validCandidate(),
    );
    expect(diagnosticId).toMatch(UUID_PATTERN);

    const rows = await db()('harness_error_diagnostics').where('workspace_id', 'ws-1').select('diagnostic_id');
    expect(rows).toHaveLength(500);
    const ids = rows.map((row) => row.diagnostic_id);
    expect(ids).not.toContain('ws1-0000'); // oldest evicted
    expect(ids).toContain('ws1-0001');
    expect(ids).toContain(diagnosticId);
  });

  test('global cap: oldest rows evict so 5000 rows remain AFTER insertion', async () => {
    const base = Date.now() - 1000000;
    const seeds = [];
    for (let ws = 0; ws < 10; ws += 1) {
      for (let i = 0; i < 500; i += 1) {
        const n = ws * 500 + i;
        seeds.push(seedRow({
          diagnostic_id: `g-${String(n).padStart(5, '0')}`,
          workspace_id: `ws-other-${ws}`,
          created_at: base + n,
        }));
      }
    }
    await seedRows(seeds);

    const diagnosticId = await modules.service.persistDiagnosticReport(
      binding({ workspaceId: 'ws-new' }),
      validCandidate(),
    );
    expect(diagnosticId).toMatch(UUID_PATTERN);

    expect(await db()('harness_error_diagnostics').count('* as c').first()).toEqual({ c: 5000 });
    const oldest = await db()('harness_error_diagnostics').where('diagnostic_id', 'g-00000').first();
    expect(oldest).toBeUndefined();
  });

  test('cleanup/migration/insertion failure resolves to null and never throws', async () => {
    const canary = 'CANARY_SECRET_DIAGNOSTIC_PERSISTENCE';
    await db().schema.dropTable('harness_error_diagnostics'); // migration unavailable
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(modules.service.persistDiagnosticReport(
      binding(),
      validCandidate({ message: canary })
    ))
      .resolves.toBeNull();
    expect(warn.mock.calls).toEqual([[
      '[HarnessDiagnostics] Persist failed',
      {
        workspaceId: 'ws-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
        marker: 'HARNESS_DIAGNOSTIC_PERSIST_FAILED',
      },
    ]]);
    // Failure logs fixed identifiers only — never report or caught database
    // contents.
    expect(JSON.stringify(warn.mock.calls)).not.toContain(canary);

    // Give cleanup its own deterministic database-failure boundary. A
    // dropped-table oracle is not stable in the aggregate suite because an
    // independently loaded migration owner can recreate that schema.
    jest.resetModules();
    jest.doMock('../../lib/db', () => ({
      getDb: () => ({
        transaction: async () => { throw new Error('cleanup transaction unavailable'); },
      }),
    }));
    const failureService = require('../../lib/thread/harness-diagnostic-service');
    await expect(failureService.cleanupHarnessDiagnostics())
      .rejects.toThrow('cleanup transaction unavailable');
    await expect(failureService.runStartupDiagnosticCleanup()).resolves.toBe(false);
    expect(warn.mock.calls.at(-1)).toEqual([
      '[HarnessDiagnostics] Startup cleanup failed',
      { marker: 'HARNESS_DIAGNOSTIC_STARTUP_CLEANUP_FAILED' },
    ]);
    jest.dontMock('../../lib/db');
  });

  test('startup cleanup runs the same purge + evict to both caps', async () => {
    const now = Date.now();
    const seeds = [
      seedRow({ diagnostic_id: 'expired-boot', created_at: now - 40 * 24 * 60 * 60 * 1000, expires_at: now - 1000 }),
    ];
    for (let i = 0; i < 501; i += 1) {
      seeds.push(seedRow({
        diagnostic_id: `boot-${String(i).padStart(4, '0')}`,
        workspace_id: 'ws-boot',
        created_at: now - 1000000 + i,
        expires_at: now + 100000,
      }));
    }
    await seedRows(seeds);

    await modules.service.cleanupHarnessDiagnostics();

    const ids = (await db()('harness_error_diagnostics').select('diagnostic_id')).map((row) => row.diagnostic_id);
    expect(ids).not.toContain('expired-boot');
    expect(ids.filter((id) => id.startsWith('boot-'))).toHaveLength(500);
    expect(ids).not.toContain('boot-0000');
  });

  test('retrieval returns the stored validated report only on an exact four-part match', async () => {
    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), validCandidate({ message: 'stored report body' }));

    const result = await modules.service.getDiagnosticReport({ ...binding(), diagnosticId });
    expect(result.status).toBe('available');
    expect(result.report).toEqual(validCandidate({ message: 'stored report body' }));
    expect(Buffer.byteLength(result.reportJson, 'utf8')).toBeLessThanOrEqual(24576);
  });

  test('missing/expired/mismatched/malformed all yield the ONE fixed value-free unavailable outcome', async () => {
    const now = Date.now();
    const diagnosticId = await modules.service.persistDiagnosticReport(binding(), validCandidate());
    await seedRows([seedRow({
      diagnostic_id: 'expired-read',
      workspace_id: 'ws-1',
      thread_id: 'thread-1',
      turn_id: 'turn-1',
      created_at: now - 40 * 24 * 60 * 60 * 1000,
      expires_at: now - 1000,
    })]);

    const unavailable = Object.freeze({ status: 'unavailable' });
    const outcomes = await Promise.all([
      modules.service.getDiagnosticReport({ ...binding(), diagnosticId: 'does-not-exist' }),
      modules.service.getDiagnosticReport({ workspaceId: 'ws-2', threadId: 'thread-1', turnId: 'turn-1', diagnosticId }),
      modules.service.getDiagnosticReport({ workspaceId: 'ws-1', threadId: 'thread-2', turnId: 'turn-1', diagnosticId }),
      modules.service.getDiagnosticReport({ workspaceId: 'ws-1', threadId: 'thread-1', turnId: 'turn-2', diagnosticId }),
      modules.service.getDiagnosticReport({ ...binding(), diagnosticId: 'expired-read' }),
      modules.service.getDiagnosticReport({ workspaceId: 'ws-1' }),
      modules.service.getDiagnosticReport(null),
    ]);
    for (const outcome of outcomes) {
      expect(outcome).toEqual(unavailable);
      expect(Object.keys(outcome)).toEqual(['status']); // value-free: no details
    }
  });

  test('retrieval failure (e.g. table missing) also yields the fixed unavailable outcome without throwing', async () => {
    await db().schema.dropTable('harness_error_diagnostics');
    await expect(modules.service.getDiagnosticReport({ ...binding(), diagnosticId: 'x' }))
      .resolves.toEqual({ status: 'unavailable' });
  });

  test('structural: dedicated table only — no event_log, exchange metadata, assistant parts, or event-bus publication', () => {
    const serviceSource = fs.readFileSync(
      path.join(__dirname, '../../lib/thread/harness-diagnostic-service.js'), 'utf8',
    );
    const migrationSource = fs.readFileSync(
      path.join(__dirname, '../../lib/db/migrations/034_harness_error_diagnostics.js'), 'utf8',
    );
    for (const source of [serviceSource, migrationSource]) {
      // Strip comments so documented prohibitions in prose do not trip the sweep.
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(codeOnly).not.toContain('event_log');
      expect(codeOnly).not.toContain('event-bus');
      expect(codeOnly).not.toContain("require('../event-bus')");
      expect(codeOnly).not.toContain('exchanges');
      expect(codeOnly).not.toContain('emit(');
    }
    expect(modules.service.TABLE).toBe('harness_error_diagnostics');
    // No accepted-only/UEB relationship: the module exposes no emitter surface.
    expect(Object.keys(modules.service).sort()).toEqual([
      'DIAGNOSTIC_UNAVAILABLE',
      'MAX_ROWS_PER_WORKSPACE',
      'MAX_ROWS_TOTAL',
      'RETENTION_MS',
      'TABLE',
      'cleanupHarnessDiagnostics',
      'getDiagnosticReport',
      'persistDiagnosticReport',
      'revalidateCandidate',
      'runStartupDiagnosticCleanup',
    ]);
  });
});
