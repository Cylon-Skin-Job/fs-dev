'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createDelayedPathRegistry,
  createDocumentOutputCoordinator,
} = require('../export/submodules/documents/document-output-coordinator.cjs');
const { createDocumentHandlers } = require('./document-handlers.cjs');

const BODY = [
  '| A | B |',
  '| --- | --- |',
  '| one | two |',
  '',
  '| C | D | E |',
  '| --- | --- | --- |',
  '| three | four | five |',
].join('\n');
const SURFACES = ['export', 'print', 'email'];

async function boundFor(body = BODY) {
  const { bindOfficeTableSources } = await import('../shared/office-table-source-binding.mjs');
  return bindOfficeTableSources(
    body,
    async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  );
}

async function descriptorFor(body = BODY) {
  const bound = await boundFor(body);
  return {
    markdownSha256: bound.markdownSha256,
    tables: bound.tables.map((table) => ({
      tableIndex: table.tableIndex,
      sourceSha256: table.sourceSha256,
      logicalWidth: table.logicalWidth,
      columns: Array.from({ length: table.logicalWidth }, () => 96),
      overflow: 'overflow',
      titleRow: false,
      borderWidth: 1,
      borderColor: 'default',
    })),
  };
}

async function payloadFor({ surface = 'export', format = 'pdf', body = BODY } = {}) {
  const common = {
    content: body,
    filename: 'test',
    presentationMode: 'office-tables',
    tablePresentation: await descriptorFor(body),
  };
  if (surface === 'export') {
    return { sourceType: 'document', sourceFormat: 'markdown', format, ...common };
  }
  if (surface === 'email') return { format, ...common };
  return common;
}

function handlerFor(handlers, surface) {
  if (surface === 'export') return handlers.handleExportDocument;
  if (surface === 'print') return handlers.handlePrintDocument;
  return handlers.handleSendDocumentEmail;
}

function emptyLedger() {
  return { office: { export: 0, print: 0, email: 0 }, legacy: 0 };
}

function harness({ officeHandlers } = {}) {
  const ledger = emptyLedger();
  const captured = {};
  const resolvedOfficeHandlers = officeHandlers ?? Object.fromEntries(SURFACES.map((surface) => [
    surface,
    async (prepared, payload) => {
      ledger.office[surface] += 1;
      captured[surface] = { prepared, payload };
      return { buffer: Buffer.from(`office-${surface}`) };
    },
  ]));
  const coordinator = createDocumentOutputCoordinator({ officeHandlers: resolvedOfficeHandlers });
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument(input) {
        ledger.legacy += 1;
        return { buffer: Buffer.from('legacy'), filename: input.filename };
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'darwin',
    runAppleScript: async () => {},
  });
  return {
    captured,
    handlers,
    ledger,
    cleanup() {
      handlers.cleanup();
    },
  };
}

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) assertDeepFrozen(value[key], seen);
}

test('[slice 11.1] handlers bind exact immutable values for every valid Office route', async (context) => {
  const { handlers, ledger, captured, cleanup } = harness();
  context.after(cleanup);
  const routes = [
    { surface: 'export', format: 'docx' },
    {
      surface: 'export',
      format: 'pdf',
      configure: (value) => {
        value.tablePresentation.tables[0].overflow = 'truncate';
        value.tablePresentation.tables[0].borderWidth = 2;
        value.tablePresentation.tables[0].borderColor = null;
      },
    },
    {
      surface: 'print',
      format: 'pdf',
      configure: (value) => {
        value.tablePresentation.tables[0].columns = null;
        value.tablePresentation.tables[0].overflow = 'newline';
        value.tablePresentation.tables[0].borderWidth = 3;
        value.tablePresentation.tables[0].borderColor = '#abcdef';
      },
    },
    {
      surface: 'email',
      format: 'docx',
      configure: (value) => { value.tablePresentation.tables[0].borderWidth = 4; },
    },
    { surface: 'email', format: 'pdf' },
  ];
  const expectedSources = (await boundFor()).tables;
  for (const { surface, format, configure } of routes) {
    const payload = await payloadFor({ surface, format });
    configure?.(payload);
    const expectedPayload = structuredClone(payload);
    const result = await handlerFor(handlers, surface)(null, payload);
    assert.equal(result.success, true);
    if (surface === 'export') {
      assert.equal(result.base64, Buffer.from('office-export').toString('base64'));
      assert.equal(result.filename, `test.${format}`);
    }
    assert.deepEqual(captured[surface].payload, expectedPayload);
    assert.deepEqual(captured[surface].prepared, {
      bodyMarkdown: BODY,
      tablePresentation: expectedPayload.tablePresentation,
      sourceTables: expectedSources,
    });
    assert.notEqual(captured[surface].payload, payload);
    assert.notEqual(captured[surface].payload.tablePresentation, payload.tablePresentation);
    assertDeepFrozen(captured[surface].payload);
    assertDeepFrozen(captured[surface].prepared);
    assert.throws(() => { captured[surface].prepared.tablePresentation.tables[0].borderColor = '#abcdef'; }, TypeError);
    assert.throws(() => { captured[surface].prepared.sourceTables.pop(); }, TypeError);
    assert.equal(
      captured[surface].prepared.tablePresentation.tables[0].borderColor,
      expectedPayload.tablePresentation.tables[0].borderColor,
    );
    assert.equal(captured[surface].prepared.sourceTables.length, 2);
  }

  const titleBody = '| Safe Title |  |  |\n| --- | --- | --- |\n| A | B | C |\n| D | E | F |';
  const titlePayload = await payloadFor({ body: titleBody });
  titlePayload.tablePresentation.tables[0].titleRow = true;
  const titleResult = await handlers.handleExportDocument(null, titlePayload);
  assert.equal(titleResult.success, true);
  assert.equal(captured.export.prepared.sourceTables[0].cellChildCounts[0][1], 0);
  assert.deepEqual(ledger, { office: { export: 3, print: 1, email: 2 }, legacy: 0 });
})

test('[slice 11.1] main rejects every observable malformed Office key, type, value, and bound', async () => {
  for (const fields of ['mode', 'descriptor', 'both']) {
    const valid = await payloadFor();
    const payload = [];
    Object.assign(payload, valid);
    if (fields === 'mode') delete payload.tablePresentation;
    if (fields === 'descriptor') delete payload.presentationMode;
    const { handlers, ledger } = harness();
    assert.deepEqual(
      await handlers.handleExportDocument(null, payload),
      { success: false, error: 'INVALID_TABLE_PRESENTATION' },
      `array root ${fields}`,
    );
    assert.deepEqual(ledger, emptyLedger(), `array root ${fields}`);
  }

  const specs = [
    ['payload unknown key', (value) => { value.extra = true; }],
    ['wrong mode', (value) => { value.presentationMode = 'wrong'; }],
    ['null mode', (value) => { value.presentationMode = null; }],
    ['undefined mode', (value) => { value.presentationMode = undefined; }],
    ['missing descriptor half-pair', (value) => { delete value.tablePresentation; }],
    ['missing mode half-pair', (value) => { delete value.presentationMode; }],
    ['null descriptor', (value) => { value.tablePresentation = null; }],
    ['array descriptor', (value) => { value.tablePresentation = []; }],
    ['descriptor unknown key', (value) => { value.tablePresentation.extra = true; }],
    ['descriptor missing key', (value) => { delete value.tablePresentation.markdownSha256; }],
    ['root hash type', (value) => { value.tablePresentation.markdownSha256 = 64; }],
    ['root hash uppercase', (value) => { value.tablePresentation.markdownSha256 = 'A'.repeat(64); }],
    ['tables type', (value) => { value.tablePresentation.tables = {}; }],
    ['tables unknown key', (value) => { value.tablePresentation.tables.extra = true; }],
    ['sparse tables', (value) => { value.tablePresentation.tables = new Array(2); }],
    ['entry null', (value) => { value.tablePresentation.tables[0] = null; }],
    ['entry array', (value) => { value.tablePresentation.tables[0] = []; }],
    ['entry unknown key', (value) => { value.tablePresentation.tables[0].extra = true; }],
    ['entry missing key', (value) => { delete value.tablePresentation.tables[0].overflow; }],
    ['index type', (value) => { value.tablePresentation.tables[0].tableIndex = '0'; }],
    ['index fractional', (value) => { value.tablePresentation.tables[0].tableIndex = 0.5; }],
    ['index unsafe', (value) => {
      value.tablePresentation.tables[0].tableIndex = Number.MAX_SAFE_INTEGER + 1;
    }],
    ['source hash type', (value) => { value.tablePresentation.tables[0].sourceSha256 = 64; }],
    ['source hash uppercase', (value) => { value.tablePresentation.tables[0].sourceSha256 = 'A'.repeat(64); }],
    ['logical width type', (value) => { value.tablePresentation.tables[0].logicalWidth = '2'; }],
    ['logical width zero', (value) => { value.tablePresentation.tables[0].logicalWidth = 0; }],
    ['logical width fractional', (value) => { value.tablePresentation.tables[0].logicalWidth = 1.5; }],
    ['logical width unsafe', (value) => {
      value.tablePresentation.tables[0].logicalWidth = Number.MAX_SAFE_INTEGER + 1;
    }],
    ['columns type', (value) => { value.tablePresentation.tables[0].columns = {}; }],
    ['columns unknown key', (value) => { value.tablePresentation.tables[0].columns.extra = true; }],
    ['sparse columns', (value) => { value.tablePresentation.tables[0].columns = new Array(2); }],
    ['column type', (value) => { value.tablePresentation.tables[0].columns[0] = '96'; }],
    ['column zero', (value) => { value.tablePresentation.tables[0].columns[0] = 0; }],
    ['column fractional', (value) => { value.tablePresentation.tables[0].columns[0] = 96.5; }],
    ['column unsafe', (value) => {
      value.tablePresentation.tables[0].columns[0] = Number.MAX_SAFE_INTEGER + 1;
    }],
    ['column nonfinite', (value) => {
      value.tablePresentation.tables[0].columns[0] = Number.POSITIVE_INFINITY;
    }],
    ['overflow enum', (value) => { value.tablePresentation.tables[0].overflow = 'wrap'; }],
    ['title type', (value) => { value.tablePresentation.tables[0].titleRow = 1; }],
    ['border width type', (value) => { value.tablePresentation.tables[0].borderWidth = '1'; }],
    ['border width value', (value) => { value.tablePresentation.tables[0].borderWidth = 5; }],
    ['border color type', (value) => { value.tablePresentation.tables[0].borderColor = 1; }],
    ['border color uppercase', (value) => { value.tablePresentation.tables[0].borderColor = '#ABCDEF'; }],
    ['content type', (value) => { value.content = 1; }],
    ['filename type', (value) => { value.filename = 1; }],
    ['export source type', (value) => { value.sourceType = 'html-artifact'; }],
    ['export source format', (value) => { value.sourceFormat = 'html'; }],
    ['export format', (value) => { value.format = 'markdown'; }],
    ['descriptor source-derived bound', (value) => {
      const entry = value.tablePresentation.tables[0];
      value.tablePresentation.tables = Array.from({ length: 1_000 }, (_, tableIndex) => ({
        ...structuredClone(entry),
        tableIndex,
      }));
    }],
    ['email format', (value) => { value.format = 'markdown'; }, 'email'],
    ['print unknown key', (value) => { value.format = 'pdf'; }, 'print'],
  ];

  for (const [name, mutate, surface = 'export'] of specs) {
    const payload = await payloadFor({ surface });
    mutate(payload);
    const { handlers, ledger } = harness();
    const result = await handlerFor(handlers, surface)(null, payload);
    assert.deepEqual(result, { success: false, error: 'INVALID_TABLE_PRESENTATION' }, name);
    assert.deepEqual(ledger, emptyLedger(), name);
  }
})

test('[slice 11.1] main classifies every exact source relation failure as mismatch before output', async () => {
  const staleTitleBody = '| Two Row Marked Title |  |  |\n| --- | --- | --- |\n| only-r1c0 | only-r1c1 | only-r1c2 |';
  const specs = [
    ['body hash relation', (value) => { value.content = `${BODY}x`; }],
    ['whole hash relation', (value) => { value.tablePresentation.markdownSha256 = '0'.repeat(64); }],
    ['table count relation', (value) => { value.tablePresentation.tables.pop(); }],
    ['table source hash relation', (value) => { value.tablePresentation.tables[0].sourceSha256 = '0'.repeat(64); }],
    ['table order relation', (value) => {
      [value.tablePresentation.tables[0].sourceSha256, value.tablePresentation.tables[1].sourceSha256]
        = [value.tablePresentation.tables[1].sourceSha256, value.tablePresentation.tables[0].sourceSha256];
    }],
    ['index relation', (value) => { value.tablePresentation.tables[0].tableIndex = 9; }],
    ['logical width relation', (value) => {
      value.tablePresentation.tables[0].logicalWidth = 1;
      value.tablePresentation.tables[0].columns = [96];
    }],
    ['column length relation', (value) => { value.tablePresentation.tables[0].columns = [96]; }],
  ];
  for (const [name, mutate] of specs) {
    const payload = await payloadFor();
    mutate(payload);
    const { handlers, ledger } = harness();
    assert.deepEqual(
      await handlers.handleExportDocument(null, payload),
      { success: false, error: 'TABLE_PRESENTATION_MISMATCH' },
      name,
    );
    assert.deepEqual(ledger, emptyLedger(), name);
  }

  const staleTitle = await payloadFor({ body: staleTitleBody });
  staleTitle.tablePresentation.tables[0].titleRow = true;
  const { handlers, ledger } = harness();
  assert.deepEqual(
    await handlers.handleExportDocument(null, staleTitle),
    { success: false, error: 'TABLE_PRESENTATION_MISMATCH' },
  );
  assert.deepEqual(ledger, emptyLedger());
})

test('[slice 11.1] legacy export remains byte/value-identical and bypasses Office preparation', async () => {
  const { handlers, ledger } = harness();
  const payload = {
    sourceType: 'document',
    sourceFormat: 'markdown',
    format: 'pdf',
    content: '| legacy | table |',
    filename: 'legacy',
  };
  const result = await handlers.handleExportDocument(null, payload);
  assert.deepEqual(result, {
    success: true,
    base64: Buffer.from('legacy').toString('base64'),
    filename: 'legacy.pdf',
  });
  const legacyArray = [];
  Object.assign(legacyArray, { ...payload, content: 'array', filename: 'array' });
  assert.deepEqual(await handlers.handleExportDocument(null, legacyArray), {
    success: true,
    base64: Buffer.from('legacy').toString('base64'),
    filename: 'array.pdf',
  });
  assert.deepEqual(ledger, { office: { export: 0, print: 0, email: 0 }, legacy: 2 });
})

test('[slice 11.1] falsy Office route results never fall through to legacy output', async (context) => {
  const officeCalls = { export: 0, print: 0, email: 0 };
  const officeHandlers = Object.fromEntries(SURFACES.map((surface) => [surface, async () => {
    officeCalls[surface] += 1;
    return false;
  }]));
  const { handlers, ledger, cleanup } = harness({ officeHandlers });
  context.after(cleanup);
  const routes = [
    { surface: 'export', format: 'docx' },
    { surface: 'export', format: 'pdf' },
    { surface: 'print', format: 'pdf' },
    { surface: 'email', format: 'docx' },
    { surface: 'email', format: 'pdf' },
  ];
  for (const route of routes) {
    assert.deepEqual(
      await handlerFor(handlers, route.surface)(null, await payloadFor(route)),
      { success: false, error: 'Document output failed' },
    );
  }
  assert.deepEqual(officeCalls, { export: 2, print: 1, email: 2 });
  assert.equal(ledger.legacy, 0);
})

test('[slice 11.4] Office handler adapters return downloads and contain delayed Mail/Preview/Markdown temps', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-cutover-handler-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const calls = { export: 0, email: 0, print: 0, scripts: [] };
  const officeHandlers = Object.fromEntries(SURFACES.map((surface) => [surface, async () => {
    calls[surface] += 1;
    return { buffer: Buffer.from(`artifact-${surface}`) };
  }]));
  const coordinator = createDocumentOutputCoordinator({ officeHandlers });
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() {
        assert.fail('Office requests must not reach the legacy export controller');
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'darwin',
    temporaryRoot,
    runAppleScript: async (script) => { calls.scripts.push(script); },
  });

  assert.deepEqual(
    await handlers.handleExportDocument(null, await payloadFor({ surface: 'export', format: 'pdf' })),
    {
      success: true,
      base64: Buffer.from('artifact-export').toString('base64'),
      filename: 'test.pdf',
    },
  );
  assert.deepEqual(
    await handlers.handleSendDocumentEmail(null, await payloadFor({ surface: 'email', format: 'docx' })),
    { success: true },
  );
  assert.deepEqual(
    await handlers.handlePrintDocument(null, await payloadFor({ surface: 'print' })),
    { success: true },
  );
  const fullMarkdown = '---\nname: Exact Markdown\n---\n\n# exact markdown\n';
  assert.deepEqual(
    await handlers.handleSendDocumentEmail(null, {
      format: 'markdown',
      content: fullMarkdown,
      filename: 'Exact Markdown',
    }),
    { success: true },
  );
  assert.deepEqual(calls.export, 1);
  assert.deepEqual(calls.email, 1);
  assert.deepEqual(calls.print, 1);
  assert.equal(calls.scripts.length, 3);
  assert.equal(coordinator.pendingCleanupPaths().length, 3);
  let markdownAttachment = null;
  for (const candidate of coordinator.pendingCleanupPaths()) {
    const relative = path.relative(temporaryRoot, candidate);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.equal(fs.lstatSync(candidate).isDirectory(), true);
    assert.equal(fs.readdirSync(candidate).length, 1);
    const [filename] = fs.readdirSync(candidate);
    if (filename.endsWith('.md')) markdownAttachment = path.join(candidate, filename);
  }
  assert.ok(markdownAttachment);
  assert.equal(fs.statSync(markdownAttachment).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(markdownAttachment, 'utf8'), fullMarkdown);
  handlers.cleanup();
  handlers.cleanup();
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
})

test('[slice 11.4] Markdown Mail handoff failure removes its contained temp immediately', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-markdown-failure-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const coordinator = createDocumentOutputCoordinator({ officeHandlers: {} });
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() {
        assert.fail('Markdown must not reach the legacy export controller');
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'darwin',
    temporaryRoot,
    runAppleScript: async () => { throw new Error('Mail handoff failed'); },
  });

  assert.deepEqual(
    await handlers.handleSendDocumentEmail(null, {
      format: 'markdown',
      content: '# exact markdown\n',
      filename: 'failure',
    }),
    { success: false, error: 'Mail handoff failed' },
  );
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  handlers.cleanup();
  handlers.cleanup();
})

test('[slice 11.4] shutdown removes tracked temps while Mail and Preview handoffs are in flight', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-inflight-shutdown-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const officeHandlers = {
    print: async () => ({ buffer: Buffer.from('%PDF-in-flight') }),
  };
  const coordinator = createDocumentOutputCoordinator({ officeHandlers });
  const releaseHandoffs = [];
  let startedCount = 0;
  let startedResolve;
  const bothStarted = new Promise((resolve) => { startedResolve = resolve; });
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() {
        assert.fail('These requests must not reach the legacy export controller');
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'darwin',
    temporaryRoot,
    runAppleScript: async () => {
      startedCount += 1;
      if (startedCount === 2) startedResolve();
      await new Promise((resolve) => { releaseHandoffs.push(resolve); });
    },
  });

  const mailResult = handlers.handleSendDocumentEmail(null, {
    format: 'markdown',
    content: '# exact markdown\n',
    filename: 'in-flight-mail',
  });
  const previewResult = (async () => (
    handlers.handlePrintDocument(null, await payloadFor({ surface: 'print' }))
  ))();
  await bothStarted;
  assert.equal(coordinator.pendingCleanupPaths().length, 2);
  assert.equal(fs.readdirSync(temporaryRoot).length, 2);
  handlers.cleanup();
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  for (const release of releaseHandoffs) release();
  assert.deepEqual(await mailResult, { success: false, error: 'Cleanup registry is closed' });
  assert.deepEqual(await previewResult, { success: false, error: 'Cleanup registry is closed' });
  handlers.cleanup();
})

test('[slice 11.4] shutdown prevents a deferred Office transform from creating a late temp root', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pre-root-shutdown-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  let markTransformStarted;
  const transformStarted = new Promise((resolve) => { markTransformStarted = resolve; });
  let releaseTransform;
  const officeHandlers = {
    email: async () => {
      markTransformStarted();
      await new Promise((resolve) => { releaseTransform = resolve; });
      return { buffer: Buffer.from('%PDF-deferred') };
    },
  };
  const coordinator = createDocumentOutputCoordinator({ officeHandlers });
  let handoffCalls = 0;
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() {
        assert.fail('Office email must not reach the legacy export controller');
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'darwin',
    temporaryRoot,
    runAppleScript: async () => { handoffCalls += 1; },
  });

  const resultPromise = handlers.handleSendDocumentEmail(
    null,
    await payloadFor({ surface: 'email', format: 'pdf' }),
  );
  await transformStarted;
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  handlers.cleanup();
  releaseTransform();
  assert.deepEqual(await resultPromise, { success: false, error: 'Cleanup registry is closed' });
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  assert.equal(handoffCalls, 0);
})

test('[slice 11.4] tracked temp rescheduling preserves bytes until timer or shutdown cleanup', () => {
  const removed = [];
  const cleared = [];
  const timers = [];
  const registry = createDelayedPathRegistry({
    removePath: (candidate) => { removed.push(candidate); },
    setTimer: (callback, delayMs) => {
      const timer = { callback, delayMs, unref() {} };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => { cleared.push(timer); },
  });

  registry.track('/owned/mail');
  registry.schedule('/owned/mail', 30_000);
  registry.schedule('/owned/mail', 45_000);
  assert.deepEqual(registry.paths(), ['/owned/mail']);
  assert.deepEqual(removed, []);
  assert.equal(timers[0].delayMs, 30_000);
  assert.equal(timers[1].delayMs, 45_000);
  assert.deepEqual(cleared, [timers[0]]);
  timers[1].callback();
  assert.deepEqual(registry.paths(), []);
  assert.deepEqual(removed, ['/owned/mail']);
  assert.deepEqual(cleared, [timers[0]]);

  registry.track('/owned/preview');
  registry.cleanup();
  registry.cleanup();
  assert.deepEqual(registry.paths(), []);
  assert.deepEqual(removed, ['/owned/mail', '/owned/preview']);
  assert.throws(
    () => registry.schedule('/owned/preview', 1),
    /Cleanup registry is closed/,
  );
  assert.throws(() => registry.track('/owned/late'), /Cleanup registry is closed/);
  assert.deepEqual(removed, ['/owned/mail', '/owned/preview', '/owned/late']);
})

test('[slice 11.4] transient removal failures retain records for explicit timer and shutdown retry', () => {
  {
    let calls = 0;
    const registry = createDelayedPathRegistry({
      removePath: () => {
        calls += 1;
        if (calls === 1) throw new Error('transient explicit removal');
      },
    });
    registry.track('/owned/explicit');
    assert.throws(() => registry.remove('/owned/explicit'), /transient explicit removal/);
    assert.deepEqual(registry.paths(), ['/owned/explicit']);
    registry.remove('/owned/explicit');
    assert.equal(calls, 2);
    assert.deepEqual(registry.paths(), []);
  }

  {
    let calls = 0;
    let timerCallback;
    const registry = createDelayedPathRegistry({
      removePath: () => {
        calls += 1;
        if (calls === 1) throw new Error('transient timer removal');
      },
      setTimer: (callback) => {
        timerCallback = callback;
        return { unref() {} };
      },
    });
    registry.track('/owned/timer');
    registry.schedule('/owned/timer', 1);
    timerCallback();
    assert.equal(calls, 1);
    assert.deepEqual(registry.paths(), ['/owned/timer']);
    registry.cleanup();
    assert.equal(calls, 2);
    assert.deepEqual(registry.paths(), []);
  }

  {
    let calls = 0;
    const registry = createDelayedPathRegistry({
      removePath: () => {
        calls += 1;
        if (calls === 1) throw new Error('transient shutdown removal');
      },
    });
    registry.track('/owned/shutdown');
    assert.throws(() => registry.cleanup(), /transient shutdown removal/);
    assert.deepEqual(registry.paths(), ['/owned/shutdown']);
    registry.cleanup();
    registry.cleanup();
    assert.equal(calls, 2);
    assert.deepEqual(registry.paths(), []);
  }

  {
    let calls = 0;
    const registry = createDelayedPathRegistry({
      removePath: () => {
        calls += 1;
        if (calls === 1) throw new Error('transient closed late removal');
      },
    });
    registry.cleanup();
    assert.throws(
      () => registry.track('/owned/closed-late'),
      (error) => error instanceof AggregateError
        && error.message === 'Post-shutdown output cleanup failed'
        && error.errors.some(({ message }) => message === 'Cleanup registry is closed')
        && error.errors.some(({ message }) => message === 'transient closed late removal'),
    );
    assert.deepEqual(registry.paths(), ['/owned/closed-late']);
    registry.cleanup();
    registry.cleanup();
    assert.equal(calls, 2);
    assert.deepEqual(registry.paths(), []);
  }
})

test('[slice 11.4] legacy Print uses contained 0600 temps with timer and shutdown cleanup', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-legacy-print-success-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const timers = [];
  const registry = createDelayedPathRegistry({
    setTimer: (callback, delayMs) => {
      const timer = { callback, delayMs, unref() {} };
      timers.push(timer);
      return timer;
    },
  });
  const coordinator = createDocumentOutputCoordinator({ delayedPathRegistry: registry });
  const opened = [];
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() { return { buffer: Buffer.from('%PDF-legacy-print') }; },
    },
    documentOutputCoordinator: coordinator,
    platform: 'linux',
    temporaryRoot,
    runAppleScript: async () => { assert.fail('Non-Darwin Print must not launch AppleScript'); },
    openExternalPath: async (candidate) => {
      const relative = path.relative(temporaryRoot, candidate);
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
      assert.equal(fs.statSync(candidate).mode & 0o777, 0o600);
      assert.equal(fs.readFileSync(candidate, 'utf8'), '%PDF-legacy-print');
      opened.push(candidate);
      return '';
    },
  });

  assert.deepEqual(
    await handlers.handlePrintDocument(null, { content: '# legacy', filename: 'Legacy Print' }),
    { success: true },
  );
  assert.equal(opened.length, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delayMs, 5 * 60 * 1000);
  assert.equal(coordinator.pendingCleanupPaths().length, 1);
  timers[0].callback();
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);

  assert.deepEqual(
    await handlers.handlePrintDocument(null, { content: '# legacy two', filename: 'Legacy Print Two' }),
    { success: true },
  );
  assert.equal(coordinator.pendingCleanupPaths().length, 1);
  handlers.cleanup();
  handlers.cleanup();
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
})

test('[slice 11.4] legacy Print removes failed and in-flight non-Darwin handoffs', async (context) => {
  const failedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-legacy-print-failure-'));
  context.after(() => fs.rmSync(failedRoot, { recursive: true, force: true }));
  const failedCoordinator = createDocumentOutputCoordinator();
  const failedHandlers = createDocumentHandlers({
    exportController: {
      async exportDocument() { return { buffer: Buffer.from('%PDF-failure') }; },
    },
    documentOutputCoordinator: failedCoordinator,
    platform: 'linux',
    temporaryRoot: failedRoot,
    openExternalPath: async () => { throw new Error('injected open failure'); },
  });
  assert.deepEqual(
    await failedHandlers.handlePrintDocument(null, { content: '# failure', filename: 'failure' }),
    { success: false, error: 'injected open failure' },
  );
  assert.deepEqual(failedCoordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(failedRoot), []);
  failedHandlers.cleanup();

  const resolvedFailureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fusion-legacy-print-resolved-failure-'),
  );
  context.after(() => fs.rmSync(resolvedFailureRoot, { recursive: true, force: true }));
  const resolvedFailureCoordinator = createDocumentOutputCoordinator();
  const resolvedFailureHandlers = createDocumentHandlers({
    exportController: {
      async exportDocument() { return { buffer: Buffer.from('%PDF-resolved-failure') }; },
    },
    documentOutputCoordinator: resolvedFailureCoordinator,
    platform: 'linux',
    temporaryRoot: resolvedFailureRoot,
    openExternalPath: async () => 'injected shell.openPath failure',
  });
  assert.deepEqual(
    await resolvedFailureHandlers.handlePrintDocument(
      null,
      { content: '# resolved failure', filename: 'resolved failure' },
    ),
    { success: false, error: 'injected shell.openPath failure' },
  );
  assert.deepEqual(resolvedFailureCoordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(resolvedFailureRoot), []);
  resolvedFailureHandlers.cleanup();

  const inflightRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-legacy-print-inflight-'));
  context.after(() => fs.rmSync(inflightRoot, { recursive: true, force: true }));
  const inflightCoordinator = createDocumentOutputCoordinator();
  let markOpened;
  const opened = new Promise((resolve) => { markOpened = resolve; });
  let releaseOpen;
  const inflightHandlers = createDocumentHandlers({
    exportController: {
      async exportDocument() { return { buffer: Buffer.from('%PDF-inflight') }; },
    },
    documentOutputCoordinator: inflightCoordinator,
    platform: 'linux',
    temporaryRoot: inflightRoot,
    openExternalPath: async () => {
      markOpened();
      await new Promise((resolve) => { releaseOpen = resolve; });
      return '';
    },
  });
  const resultPromise = inflightHandlers.handlePrintDocument(
    null,
    { content: '# in-flight', filename: 'in-flight' },
  );
  await opened;
  assert.equal(inflightCoordinator.pendingCleanupPaths().length, 1);
  assert.equal(fs.readdirSync(inflightRoot).length, 1);
  inflightHandlers.cleanup();
  assert.deepEqual(inflightCoordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(inflightRoot), []);
  releaseOpen();
  assert.deepEqual(await resultPromise, { success: false, error: 'Cleanup registry is closed' });
})

test('[slice 11.4] legacy Print cannot create a temp after shutdown during export', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-legacy-print-pre-root-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  let markExportStarted;
  const exportStarted = new Promise((resolve) => { markExportStarted = resolve; });
  let releaseExport;
  const coordinator = createDocumentOutputCoordinator();
  let openCalls = 0;
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() {
        markExportStarted();
        await new Promise((resolve) => { releaseExport = resolve; });
        return { buffer: Buffer.from('%PDF-late') };
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'linux',
    temporaryRoot,
    openExternalPath: async () => { openCalls += 1; },
  });

  const resultPromise = handlers.handlePrintDocument(
    null,
    { content: '# late', filename: 'late' },
  );
  await exportStarted;
  handlers.cleanup();
  releaseExport();
  assert.deepEqual(await resultPromise, { success: false, error: 'Cleanup registry is closed' });
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
  assert.equal(openCalls, 0);
})

test('[slice 11.4] legacy Print late-track removal failure remains retryable after shutdown', async (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-legacy-print-late-retry-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  let removeCalls = 0;
  const registry = createDelayedPathRegistry({
    removePath: (candidate) => {
      removeCalls += 1;
      if (removeCalls === 1) throw new Error('transient closed late removal');
      fs.rmSync(candidate, { recursive: true, force: true });
    },
  });
  const coordinator = createDocumentOutputCoordinator({ delayedPathRegistry: registry });
  let markExportStarted;
  const exportStarted = new Promise((resolve) => { markExportStarted = resolve; });
  let releaseExport;
  let openCalls = 0;
  const handlers = createDocumentHandlers({
    exportController: {
      async exportDocument() {
        markExportStarted();
        await new Promise((resolve) => { releaseExport = resolve; });
        return { buffer: Buffer.from('%PDF-late-retry') };
      },
    },
    documentOutputCoordinator: coordinator,
    platform: 'linux',
    temporaryRoot,
    openExternalPath: async () => { openCalls += 1; return ''; },
  });

  const resultPromise = handlers.handlePrintDocument(
    null,
    { content: '# late retry', filename: 'late retry' },
  );
  await exportStarted;
  handlers.cleanup();
  releaseExport();
  assert.deepEqual(
    await resultPromise,
    { success: false, error: 'Post-shutdown output cleanup failed' },
  );
  assert.equal(removeCalls, 1);
  assert.equal(coordinator.pendingCleanupPaths().length, 1);
  assert.equal(fs.readdirSync(temporaryRoot).length, 1);
  assert.equal(openCalls, 0);
  handlers.cleanup();
  handlers.cleanup();
  assert.equal(removeCalls, 2);
  assert.deepEqual(coordinator.pendingCleanupPaths(), []);
  assert.deepEqual(fs.readdirSync(temporaryRoot), []);
})
