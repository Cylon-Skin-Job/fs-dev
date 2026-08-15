'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const { createHash, webcrypto } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const test = require('node:test');

const preloadPath = path.join(__dirname, 'preload.cjs');
const preloadSandboxSmokePath = path.join(__dirname, 'preload-sandbox-smoke.cjs');
const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function validDescriptor() {
  return { markdownSha256: EMPTY_SHA, tables: [] };
}

function validExportPayload() {
  return {
    sourceType: 'document',
    sourceFormat: 'markdown',
    format: 'pdf',
    content: '',
    filename: 'example',
    presentationMode: 'office-tables',
    tablePresentation: validDescriptor(),
  };
}

function twoColumnExportPayload() {
  const content = '| A | B |\n| --- | --- |\n| one | two |';
  const hash = createHash('sha256').update(content).digest('hex');
  return {
    sourceType: 'document',
    sourceFormat: 'markdown',
    format: 'pdf',
    content,
    filename: 'two-column',
    presentationMode: 'office-tables',
    tablePresentation: {
      markdownSha256: hash,
      tables: [{
        tableIndex: 0,
        sourceSha256: hash,
        logicalWidth: 2,
        columns: [96, 96],
        overflow: 'overflow',
        titleRow: false,
        borderWidth: 1,
        borderColor: 'default',
      }],
    },
  };
}

function twoColumnOfficePayload(surface = 'export', format = 'pdf') {
  const exportPayload = twoColumnExportPayload();
  exportPayload.format = format;
  if (surface === 'export') return exportPayload;
  const common = {
    content: exportPayload.content,
    filename: exportPayload.filename,
    presentationMode: exportPayload.presentationMode,
    tablePresentation: exportPayload.tablePresentation,
  };
  if (surface === 'print') return common;
  return { format, ...common };
}

const SURFACE_CALLS = Object.freeze({
  export: { method: 'exportDocument', channel: 'export-document' },
  print: { method: 'printDocument', channel: 'print-document' },
  email: { method: 'sendDocumentEmail', channel: 'send-document-email' },
});

function invalidOfficeCase(name, mutate, surface = 'export', format = 'pdf') {
  const payload = twoColumnOfficePayload(surface, format);
  mutate(payload);
  return { name, payload, surface };
}

function officeArrayRoot(fields) {
  const value = [];
  Object.assign(value, twoColumnOfficePayload());
  if (fields === 'mode') delete value.tablePresentation;
  if (fields === 'descriptor') delete value.presentationMode;
  return value;
}

function loadPreload({ cloneFailure = false } = {}) {
  const invokes = [];
  const sideEffects = { main: 0, coordinator: 0, filesystem: 0, converter: 0, os: 0 };
  let exposed;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, value) {
        assert.equal(name, 'electronAPI');
        exposed = value;
      },
    },
    ipcRenderer: {
      async invoke(channel, payload) {
        invokes.push({ channel, payload });
        if (cloneFailure) {
          const error = new Error('mock structured clone failure');
          error.name = 'DataCloneError';
          throw error;
        }
        return { success: true };
      },
      on() {},
      removeListener() {},
      send() {},
    },
  };
  const source = fs.readFileSync(preloadPath, 'utf8');
  const hostRequire = createRequire(preloadPath);
  const localRequire = (specifier) => (specifier === 'electron' ? electron : hostRequire(specifier));
  const module = { exports: {} };
  const context = vm.createContext({
    atob,
    Buffer,
    btoa,
    console,
    module,
    exports: module.exports,
    require: localRequire,
    __dirname,
    __filename: preloadPath,
    crypto: webcrypto,
    structuredClone,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
  });
  new vm.Script(`(function (require, module, exports, __filename, __dirname) {${source}\n})`, {
    filename: preloadPath,
  }).runInContext(context)(localRequire, module, module.exports, preloadPath, __dirname);
  return { api: exposed, invokes, sideEffects };
}

test('[slice 11.1] preload preserves legacy identity and canonicalizes every valid Office route once', async () => {
  const { api, invokes } = loadPreload();
  const legacyCalls = [
    ['exportDocument', 'export-document'],
    ['sendDocumentEmail', 'send-document-email'],
    ['printDocument', 'print-document'],
  ];
  for (const [method, channel] of legacyCalls) {
    const legacy = { arbitrary: { preserved: method } };
    await api[method](legacy);
    assert.equal(invokes.at(-1).channel, channel);
    assert.equal(invokes.at(-1).payload, legacy);
  }
  const legacyArray = [];
  Object.assign(legacyArray, {
    sourceType: 'document', sourceFormat: 'markdown', format: 'pdf', content: 'array', filename: 'array',
  });
  await api.exportDocument(legacyArray);
  assert.equal(invokes.at(-1).channel, 'export-document');
  assert.equal(invokes.at(-1).payload, legacyArray);

  const officeCalls = [
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
  for (const { surface, format, configure } of officeCalls) {
    const { method, channel } = SURFACE_CALLS[surface];
    const office = twoColumnOfficePayload(surface, format);
    configure?.(office);
    const expected = structuredClone(office);
    const pending = api[method](office);
    office.filename = 'mutated';
    office.tablePresentation.tables[0].borderWidth = 4;
    if (office.tablePresentation.tables[0].columns !== null) {
      office.tablePresentation.tables[0].columns[0] = 999;
    }
    await pending;
    const invoked = invokes.at(-1);
    assert.equal(invoked.channel, channel);
    assert.deepEqual(structuredClone(invoked.payload), expected);
    assert.notEqual(invoked.payload, office);
    assert.notEqual(invoked.payload.tablePresentation, office.tablePresentation);
    assert.notEqual(invoked.payload.tablePresentation.tables, office.tablePresentation.tables);
    assert.notEqual(invoked.payload.tablePresentation.tables[0], office.tablePresentation.tables[0]);
    if (invoked.payload.tablePresentation.tables[0].columns !== null) {
      assert.notEqual(
        invoked.payload.tablePresentation.tables[0].columns,
        office.tablePresentation.tables[0].columns,
      );
    }
  }
  assert.equal(invokes.length, 9);
  assert.deepEqual(
    invokes.reduce((counts, { channel }) => ({ ...counts, [channel]: (counts[channel] || 0) + 1 }), {}),
    { 'export-document': 4, 'print-document': 2, 'send-document-email': 3 },
  );
})

test('[slice 11.1] preload rejects every observable Office key, type, value, and bound violation', async () => {
  const bulk = twoColumnOfficePayload();
  bulk.tablePresentation.tables = Array.from({ length: 1_000 }, (_, tableIndex) => ({
    tableIndex,
    sourceSha256: EMPTY_SHA,
    logicalWidth: 1,
    columns: [1],
    overflow: 'overflow',
    titleRow: false,
    borderWidth: 1,
    borderColor: 'default',
  }));
  const sparseTables = twoColumnOfficePayload();
  sparseTables.tablePresentation.tables = new Array(1);
  const sparseColumns = twoColumnOfficePayload();
  sparseColumns.tablePresentation.tables[0].columns = new Array(2);
  const cases = [
    { name: 'array root mode only', payload: officeArrayRoot('mode'), surface: 'export' },
    { name: 'array root descriptor only', payload: officeArrayRoot('descriptor'), surface: 'export' },
    { name: 'array root both fields', payload: officeArrayRoot('both'), surface: 'export' },
    {
      name: 'date root whose Office fields are erased by clone',
      payload: Object.assign(new Date(0), { presentationMode: 'office-tables' }),
      surface: 'export',
    },
    invalidOfficeCase('payload unknown key', (value) => { value.extra = true; }),
    invalidOfficeCase('wrong mode', (value) => { value.presentationMode = 'wrong'; }),
    invalidOfficeCase('null mode', (value) => { value.presentationMode = null; }),
    invalidOfficeCase('undefined mode', (value) => { value.presentationMode = undefined; }),
    invalidOfficeCase('missing descriptor half-pair', (value) => { delete value.tablePresentation; }),
    invalidOfficeCase('missing mode half-pair', (value) => { delete value.presentationMode; }),
    invalidOfficeCase('null descriptor', (value) => { value.tablePresentation = null; }),
    invalidOfficeCase('array descriptor', (value) => { value.tablePresentation = []; }),
    invalidOfficeCase('descriptor unknown key', (value) => { value.tablePresentation.extra = true; }),
    invalidOfficeCase('descriptor missing key', (value) => { delete value.tablePresentation.markdownSha256; }),
    invalidOfficeCase('root hash type', (value) => { value.tablePresentation.markdownSha256 = 64; }),
    invalidOfficeCase('root hash uppercase', (value) => { value.tablePresentation.markdownSha256 = 'A'.repeat(64); }),
    invalidOfficeCase('tables type', (value) => { value.tablePresentation.tables = {}; }),
    invalidOfficeCase('table count relation', (value) => { value.tablePresentation.tables.pop(); }),
    invalidOfficeCase('tables unknown key', (value) => { value.tablePresentation.tables.extra = true; }),
    { name: 'sparse tables', payload: sparseTables, surface: 'export' },
    invalidOfficeCase('entry null', (value) => { value.tablePresentation.tables[0] = null; }),
    invalidOfficeCase('entry array', (value) => { value.tablePresentation.tables[0] = []; }),
    invalidOfficeCase('entry unknown key', (value) => { value.tablePresentation.tables[0].extra = true; }),
    invalidOfficeCase('entry missing key', (value) => { delete value.tablePresentation.tables[0].overflow; }),
    invalidOfficeCase('index type', (value) => { value.tablePresentation.tables[0].tableIndex = '0'; }),
    invalidOfficeCase('index fractional', (value) => { value.tablePresentation.tables[0].tableIndex = 0.5; }),
    invalidOfficeCase('index unsafe', (value) => {
      value.tablePresentation.tables[0].tableIndex = Number.MAX_SAFE_INTEGER + 1;
    }),
    invalidOfficeCase('index relation', (value) => { value.tablePresentation.tables[0].tableIndex = 9; }),
    invalidOfficeCase('source hash type', (value) => { value.tablePresentation.tables[0].sourceSha256 = 64; }),
    invalidOfficeCase('source hash uppercase', (value) => {
      value.tablePresentation.tables[0].sourceSha256 = 'A'.repeat(64);
    }),
    invalidOfficeCase('logical width type', (value) => { value.tablePresentation.tables[0].logicalWidth = '2'; }),
    invalidOfficeCase('logical width zero', (value) => { value.tablePresentation.tables[0].logicalWidth = 0; }),
    invalidOfficeCase('logical width fractional', (value) => { value.tablePresentation.tables[0].logicalWidth = 1.5; }),
    invalidOfficeCase('logical width unsafe', (value) => {
      value.tablePresentation.tables[0].logicalWidth = Number.MAX_SAFE_INTEGER + 1;
    }),
    invalidOfficeCase('logical width relation', (value) => {
      value.tablePresentation.tables[0].logicalWidth = 1;
      value.tablePresentation.tables[0].columns = [96];
    }),
    invalidOfficeCase('columns type', (value) => { value.tablePresentation.tables[0].columns = {}; }),
    invalidOfficeCase('columns unknown key', (value) => {
      value.tablePresentation.tables[0].columns.extra = true;
    }),
    { name: 'sparse columns', payload: sparseColumns, surface: 'export' },
    invalidOfficeCase('columns relation', (value) => { value.tablePresentation.tables[0].columns = [96]; }),
    invalidOfficeCase('column type', (value) => { value.tablePresentation.tables[0].columns[0] = '96'; }),
    invalidOfficeCase('column zero', (value) => { value.tablePresentation.tables[0].columns[0] = 0; }),
    invalidOfficeCase('column fractional', (value) => { value.tablePresentation.tables[0].columns[0] = 96.5; }),
    invalidOfficeCase('column unsafe', (value) => {
      value.tablePresentation.tables[0].columns[0] = Number.MAX_SAFE_INTEGER + 1;
    }),
    invalidOfficeCase('column nonfinite', (value) => {
      value.tablePresentation.tables[0].columns[0] = Number.POSITIVE_INFINITY;
    }),
    invalidOfficeCase('overflow enum', (value) => { value.tablePresentation.tables[0].overflow = 'wrap'; }),
    invalidOfficeCase('title type', (value) => { value.tablePresentation.tables[0].titleRow = 1; }),
    invalidOfficeCase('border width type', (value) => { value.tablePresentation.tables[0].borderWidth = '1'; }),
    invalidOfficeCase('border width value', (value) => { value.tablePresentation.tables[0].borderWidth = 5; }),
    invalidOfficeCase('border color type', (value) => { value.tablePresentation.tables[0].borderColor = 1; }),
    invalidOfficeCase('border color uppercase', (value) => {
      value.tablePresentation.tables[0].borderColor = '#ABCDEF';
    }),
    invalidOfficeCase('content type', (value) => { value.content = 1; }),
    invalidOfficeCase('filename type', (value) => { value.filename = 1; }),
    invalidOfficeCase('export source type', (value) => { value.sourceType = 'html-artifact'; }),
    invalidOfficeCase('export source format', (value) => { value.sourceFormat = 'html'; }),
    invalidOfficeCase('export format', (value) => { value.format = 'markdown'; }),
    invalidOfficeCase('email format', (value) => { value.format = 'markdown'; }, 'email'),
    invalidOfficeCase('print unknown key', (value) => { value.format = 'pdf'; }, 'print'),
    { name: 'descriptor source-derived bound', payload: bulk, surface: 'export' },
  ];
  for (const { name, payload, surface } of cases) {
    const { api, invokes } = loadPreload();
    const { method } = SURFACE_CALLS[surface];
    await assert.rejects(
      api[method](payload),
      (error) => {
        assert.equal(error?.message, 'INVALID_TABLE_PRESENTATION', name);
        return true;
      },
      name,
    );
    assert.equal(invokes.length, 0, name);
  }
})

test('[slice 11.1] preload maps one invoke clone rejection and records no downstream side effects', async () => {
  const { api, invokes, sideEffects } = loadPreload({ cloneFailure: true });
  await assert.rejects(api.exportDocument(validExportPayload()), /INVALID_TABLE_PRESENTATION/);
  assert.equal(invokes.length, 1);
  assert.deepEqual(sideEffects, { main: 0, coordinator: 0, filesystem: 0, converter: 0, os: 0 });
})

test('[slice 11.1] bundled preload exposes callable legacy and native APIs in the production sandbox', async () => {
  const bundledSource = fs.readFileSync(preloadPath, 'utf8');
  assert.doesNotMatch(bundledSource, /require\(["']\.\.?\//);
  const electronExecutable = require('electron');
  const runSandbox = (forceFailure = false) => new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    if (forceFailure) env.FUSION_OFFICE_PRELOAD_SANDBOX_FORCE_FAILURE = '1';
    else delete env.FUSION_OFFICE_PRELOAD_SANDBOX_FORCE_FAILURE;
    const child = spawn(electronExecutable, [preloadSandboxSmokePath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Sandboxed preload smoke timed out: ${stderr}`));
    }, 30_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal, stdout, stderr });
    });
  });
  const assertRemovedRoot = async (result) => {
    const rootMatch = result.stdout.match(/^OFFICE_PRELOAD_SANDBOX_ROOT_REMOVED=(.+)$/m);
    assert.ok(rootMatch, `Missing sandbox cleanup evidence: ${result.stdout}`);
    const removedRoot = rootMatch[1];
    assert.equal(
      fs.realpathSync(path.dirname(removedRoot)),
      fs.realpathSync(require('node:os').tmpdir()),
    );
    assert.match(path.basename(removedRoot), /^fusion-office-preload-sandbox-[A-Za-z0-9]{6}$/);
    for (let attempt = 0; attempt < 100 && fs.existsSync(removedRoot); attempt += 1) {
      await delay(20);
    }
    assert.equal(fs.existsSync(removedRoot), false, `Sandbox root leaked after child exit: ${removedRoot}`);
    return removedRoot;
  };
  const observedRoots = [];
  for (let execution = 0; execution < 2; execution += 1) {
    const result = await runSandbox();
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.signal, null);
    assert.match(result.stdout, /^OFFICE_PRELOAD_SANDBOX_OK$/m);
    observedRoots.push(await assertRemovedRoot(result));
  }
  const failedResult = await runSandbox(true);
  assert.equal(failedResult.code, 1, failedResult.stderr);
  assert.equal(failedResult.signal, null);
  assert.match(failedResult.stderr, /Forced sandbox smoke failure for cleanup verification/);
  assert.doesNotMatch(failedResult.stdout, /^OFFICE_PRELOAD_SANDBOX_OK$/m);
  observedRoots.push(await assertRemovedRoot(failedResult));
  assert.equal(new Set(observedRoots).size, 3);
})
