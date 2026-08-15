'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const {
  createDocumentOutputCoordinator,
  createOfficePdfHandlers,
} = require('./document-output-coordinator.cjs');
const {
  createOfficePdfBuilder,
  parseOfficeTablePresentation,
  transformOfficeTablePresentation,
} = require('./table-presentation.cjs');
const {
  verifyProductionTableInkOwnership,
} = require('./presentation-raster-ownership.cjs');

const BODY = [
  '| Safe Title |  |  |',
  '| --- | --- | --- |',
  '| Label | Break | Long |',
  '| row | Alpha<br>Beta | abcdefghijklmnopqrstuvwxyz |',
  '',
  '| Stale Title | KEEP ME |  |',
  '| --- | --- | --- |',
  '| Label | Break | Long |',
  '| stale | Gamma<br>Delta | 0123456789 |',
].join('\n');

const BASE_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<table><thead><tr><th>Safe Title</th><th></th><th></th></tr></thead><tbody>
<tr><td>Label</td><td>Break</td><td>Long</td></tr>
<tr><td>row</td><td>Alpha<br>Beta</td><td>abcdefghijklmnopqrstuvwxyz</td></tr>
</tbody></table>
<table><thead><tr><th>Stale Title</th><th>KEEP ME</th><th></th></tr></thead><tbody>
<tr><td>Label</td><td>Break</td><td>Long</td></tr>
<tr><td>stale</td><td>Gamma<br>Delta</td><td>0123456789</td></tr>
</tbody></table></body></html>`;

async function preparedFor({ secondMode = 'newline', secondColor = null } = {}) {
  const { bindOfficeTableSources } = await import('../../../shared/office-table-source-binding.mjs');
  const binding = await bindOfficeTableSources(
    BODY,
    async (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  );
  return Object.freeze({
    bodyMarkdown: BODY,
    sourceTables: binding.tables,
    tablePresentation: {
      markdownSha256: binding.markdownSha256,
      tables: binding.tables.map((source, index) => ({
        tableIndex: index,
        sourceSha256: source.sourceSha256,
        logicalWidth: source.logicalWidth,
        columns: index === 0 ? [96, 96, 96] : null,
        overflow: index === 0 ? 'truncate' : secondMode,
        titleRow: index === 0,
        borderWidth: index === 0 ? 4 : 2,
        borderColor: index === 0 ? '#004e89' : secondColor,
      })),
    },
  });
}

function payloadFor(surface, descriptor) {
  const common = {
    content: BODY,
    filename: 'presentation',
    presentationMode: 'office-tables',
    tablePresentation: descriptor,
  };
  if (surface === 'export') {
    return { sourceType: 'document', sourceFormat: 'markdown', format: 'pdf', ...common };
  }
  if (surface === 'email') return { format: 'pdf', ...common };
  return common;
}

async function assertRunnerReapsDetachedConverter(initiator) {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { waitForChildTree } = await import(pathToFileURL(runnerPath).href);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `fusion-office-runner-${initiator}-test-`));
  const registryDirectory = path.join(root, 'converter-groups');
  fs.mkdirSync(registryDirectory, { mode: 0o700 });
  const pendingToken = crypto.randomBytes(16).toString('hex');
  const pendingFilename = path.join(registryDirectory, `${pendingToken}.pending`);
  const converterCode = [
    'process.on("SIGTERM", () => {});',
    'if (process.send) process.send("ready");',
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const leaderCode = [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const { spawn } = require("node:child_process");',
    initiator === 'boundary'
      ? `fs.writeFileSync(${JSON.stringify(pendingFilename)}, ${JSON.stringify(pendingToken + String.fromCharCode(10))}, { mode: 0o600 });`
      : '',
    `const converter = spawn(process.execPath, ['-e', ${JSON.stringify(converterCode)}], { detached: true, ${initiator === 'boundary' ? `env: { ...process.env, FUSION_OFFICE_CONVERTER_TOKEN: ${JSON.stringify(pendingToken)} }, ` : ''}stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });`,
    'converter.once("message", () => {',
    initiator === 'boundary'
      ? ''
      : `  fs.writeFileSync(path.join(${JSON.stringify(registryDirectory)}, String(converter.pid) + '.pgid'), String(converter.pid) + '\\n', { mode: 0o600 });`,
    '  process.stdout.write(String(converter.pid) + "\\n");',
    initiator === 'abnormal' ? '  setTimeout(() => process.exit(7), 100);' : '',
    initiator === 'boundary' ? '  process.kill(process.pid, "SIGSTOP");' : '',
    '});',
    initiator === 'abnormal' ? '' : 'setInterval(() => {}, 1000);',
  ].filter(Boolean).join('\n');
  const leader = spawn(process.execPath, ['-e', leaderCode], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const signalTarget = new EventEmitter();
  const completion = waitForChildTree(leader, 1_000, {
    registryDirectory,
    signalTarget,
    converterKillGraceMs: 50,
  });
  completion.catch(() => {});
  let converterPid;
  try {
    converterPid = await new Promise((resolve, reject) => {
      let output = '';
      leader.stdout.on('data', (bytes) => {
        output += bytes.toString();
        if (output.includes('\n')) resolve(Number(output.trim()));
      });
      leader.once('error', reject);
    });
    if (initiator === 'signal') signalTarget.emit('SIGTERM');
    const expected = initiator === 'timeout' || initiator === 'boundary'
      ? /timed out after 1000ms/
      : initiator === 'signal'
        ? /interrupted by SIGTERM/
        : /failed: code=7 signal=null/;
    await assert.rejects(completion, expected);
    assert.throws(() => process.kill(converterPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(fs.readdirSync(registryDirectory), []);
  } finally {
    if (converterPid && process.platform !== 'win32') {
      try { process.kill(-converterPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else if (converterPid) {
      try { process.kill(converterPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    if (process.platform !== 'win32' && leader.pid) {
      try { process.kill(-leader.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else if (!leader.killed) leader.kill('SIGKILL');
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function assertRunnerSignalCleansFullLifecycle(checkpoint, interruptSignal, {
  cleanupFailures = 0,
  retain = false,
} = {}) {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const runner = spawn(process.execPath, [runnerPath, ...(retain ? ['--retain-artifacts'] : [])], {
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      OFFICE_PRESENTATION_SIGNAL_CHECKPOINT: checkpoint,
      ...(cleanupFailures
        ? { OFFICE_PRESENTATION_INJECT_CLEANUP_FAILURES: String(cleanupFailures) }
        : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  runner.stdout.on('data', (bytes) => { stdout += bytes.toString(); });
  runner.stderr.on('data', (bytes) => { stderr += bytes.toString(); });
  let ownedRoot;
  try {
    ownedRoot = await new Promise((resolve, reject) => {
      const prefix = `OFFICE_E2E_SIGNAL_CHECKPOINT=${checkpoint}:`;
      const timeout = setTimeout(
        () => reject(new Error(`Runner did not reach ${checkpoint}: ${stdout}\n${stderr}`)),
        180_000,
      );
      const inspect = () => {
        const line = stdout.split('\n').find((entry) => entry.startsWith(prefix));
        if (!line) return;
        clearTimeout(timeout);
        resolve(line.slice(prefix.length));
      };
      runner.stdout.on('data', inspect);
      runner.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      runner.once('close', (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`Runner exited before ${checkpoint}: code=${code} signal=${signal}\n${stderr}`));
      });
    });
    assert.equal(
      ownedRoot.startsWith(path.join(os.tmpdir(), 'fusion-office-presentation-output-')),
      true,
    );
    assert.equal(fs.existsSync(ownedRoot), true);
    if (checkpoint === 'retention-partial') {
      const retainedParent = path.join(os.tmpdir(), 'fusion-office-presentation-output-retained');
      const partials = fs.readdirSync(retainedParent).filter((name) => name.startsWith('.partial-'));
      assert.equal(partials.length, 1);
      const partial = path.join(retainedParent, partials[0]);
      assert.equal(fs.lstatSync(partial).isDirectory(), true);
      assert.equal(
        fs.readFileSync(path.join(partial, '.fusion-office-presentation-output-retained'), 'utf8'),
        'fusion-office-presentation-output\n',
      );
    }
    const closed = new Promise((resolve, reject) => {
      runner.once('error', reject);
      runner.once('close', (code, signal) => resolve({ code, signal }));
    });
    process.kill(runner.pid, interruptSignal);
    const result = await closed;
    assert.deepEqual(result, { code: 1, signal: null });
    assert.match(stderr, new RegExp(`Presentation output Electron interrupted by ${interruptSignal}`));
    for (let index = 1; index <= cleanupFailures; index += 1) {
      assert.match(stderr, new RegExp(`Injected presentation cleanup failure ${index}`));
    }
    if (cleanupFailures) {
      assert.match(stderr, /Presentation output cleanup failed after a primary failure/);
    }
    if (retain) {
      assert.doesNotMatch(stdout, /OFFICE_E2E_RETAINED_ARTIFACTS=/);
      assert.deepEqual(fs.readdirSync(path.join(os.tmpdir(), 'fusion-office-presentation-output-retained')), []);
    }
    assert.equal(fs.existsSync(ownedRoot), false);
    assert.throws(() => process.kill(runner.pid, 0), (error) => error?.code === 'ESRCH');
    const processes = spawnSync('/bin/ps', ['eww', '-axo', 'command='], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
    if (processes.error) throw processes.error;
    assert.equal(processes.status, 0);
    assert.equal(processes.stdout.includes(ownedRoot), false);
  } finally {
    if (runner.pid && process.platform !== 'win32') {
      try { process.kill(-runner.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else if (runner.pid) {
      try { process.kill(runner.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    if (ownedRoot?.startsWith(path.join(os.tmpdir(), 'fusion-office-presentation-output-'))) {
      fs.rmSync(ownedRoot, { recursive: true, force: true });
    }
  }
}

function assertMarkerWriteFailureCleansAndAllowsNextRun() {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const retainedParent = path.join(os.tmpdir(), 'fusion-office-presentation-output-retained');
  const ownedRoots = () => fs.readdirSync(os.tmpdir())
    .filter((name) => /^fusion-office-presentation-output-[^.]{6}$/.test(name))
    .sort();
  const rootsBefore = ownedRoots();
  const failed = spawnSync(process.execPath, [runnerPath, '--retain-artifacts'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      OFFICE_PRESENTATION_INJECT_MARKER_WRITE_FAILURE: '1',
    },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 180_000,
  });
  if (failed.error) throw failed.error;
  assert.equal(failed.status, 1);
  assert.equal(failed.signal, null);
  assert.match(failed.stderr, /Injected retained marker write failure/);
  assert.doesNotMatch(failed.stdout, /OFFICE_E2E_RETAINED_ARTIFACTS=/);
  assert.deepEqual(fs.readdirSync(retainedParent), []);
  assert.deepEqual(ownedRoots(), rootsBefore);

  const following = spawnSync(process.execPath, [runnerPath], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 180_000,
  });
  if (following.error) throw following.error;
  assert.equal(following.status, 0);
  assert.equal(following.signal, null);
  assert.deepEqual(fs.readdirSync(retainedParent), []);
  assert.deepEqual(ownedRoots(), rootsBefore);
}

function assertCleanupFailureRemovesProvisionalRetention() {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const retainedParent = path.join(os.tmpdir(), 'fusion-office-presentation-output-retained');
  const result = spawnSync(process.execPath, [runnerPath, '--retain-artifacts'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      OFFICE_PRESENTATION_INJECT_CLEANUP_FAILURES: '1',
    },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 1);
  assert.equal(result.signal, null);
  assert.match(result.stderr, /Injected presentation cleanup failure 1/);
  assert.doesNotMatch(result.stdout, /OFFICE_E2E_RETAINED_ARTIFACTS=/);
  assert.deepEqual(fs.readdirSync(retainedParent), []);
}

function collectErrorDetails(error, details = { codes: [], messages: [] }) {
  details.messages.push(error?.message ?? String(error));
  if (error?.code) details.codes.push(error.code);
  if (error instanceof AggregateError) {
    for (const member of error.errors) collectErrorDetails(member, details);
  }
  return details;
}

test('[slice 11.2] structural HTML transform binds matrices before title, border, overflow, and break mutation', async () => {
  const prepared = await preparedFor();
  const output = await transformOfficeTablePresentation(BASE_HTML, prepared);
  const parsed = await parseOfficeTablePresentation(output);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].rows[0].length, 1);
  assert.equal(parsed[0].rows[0][0].colspan, '3');
  assert.equal(parsed[0].rows[0][0].text, 'Safe Title');
  assert.equal(parsed[0].rows.flat().every((cell) => cell.wrapped), true);
  assert.equal(parsed[1].rows[0].length, 3);
  assert.equal(parsed[1].rows[0][1].text, 'KEEP ME');
  assert.match(output, /<colgroup><col style="width:96px"><col style="width:96px"><col style="width:96px"><\/colgroup>/);
  assert.match(output, /border:4px solid #004e89/);
  assert.match(output, /box-shadow:inset 0 0\.333333px 0 0 #004e89,inset 0\.333333px 0 0 0 #004e89/);
  assert.match(output, /border:none/);
  assert.match(output, /\{display:table;width:288px;border:0;border-collapse:collapse/);
  assert.match(output, />tbody\{border:0/);
  assert.match(output, /text-overflow:ellipsis/);
  assert.match(output, /white-space:normal;overflow:visible/);
  assert.doesNotMatch(output, /Alpha<br>/);
  assert.match(output, /Alpha Beta/);
  assert.match(output, /Gamma<br>Delta/);

  const second = prepared.tablePresentation.tables[1];
  const realDefault = await preparedFor({ secondMode: 'overflow', secondColor: 'default' });
  const defaultOutput = await transformOfficeTablePresentation(BASE_HTML, realDefault);
  assert.match(defaultOutput, /border:2px solid #d2d1cf/);
  assert.match(defaultOutput, /text-overflow:clip/);
  assert.equal(second.titleRow, false);
});

test('[slice 11.2] structural transform rejects count, width, row, and semantic drift without source disclosure', async () => {
  const prepared = await preparedFor();
  const cases = [
    BASE_HTML.replace('</body>', '<table></table></body>'),
    BASE_HTML.replace('<th></th><th></th>', '<th></th>'),
    BASE_HTML.replace('<td>Gamma<br>Delta</td>', '<td>changed</td>'),
    BASE_HTML.replace('<tr><td>stale</td><td>Gamma<br>Delta</td><td>0123456789</td></tr>', ''),
  ];
  for (const html of cases) {
    await assert.rejects(
      transformOfficeTablePresentation(html, prepared),
      (error) => error.code === 'TABLE_PRESENTATION_MISMATCH'
        && error.message === 'TABLE_PRESENTATION_MISMATCH'
        && !error.message.includes('Gamma'),
    );
  }
});

test('[slice 11.2] one dormant PDF builder serves future export, email, and Print adapters with no fallback', async () => {
  const prepared = await preparedFor();
  const pandoc = path.join(
    __dirname,
    '..', '..', '..',
    'resources', 'pandoc', process.platform, process.platform === 'win32' ? 'pandoc.exe' : 'pandoc',
  );
  const rendered = [];
  const pdfBuilder = createOfficePdfBuilder({
    getPandocPath: () => pandoc,
    async htmlToPdf(html, options) {
      rendered.push({ html, options });
      return Buffer.from('%PDF-test');
    },
  });
  let buildCalls = 0;
  const countingBuilder = {
    async build(value) {
      buildCalls += 1;
      assert.equal(value.bodyMarkdown, BODY);
      return pdfBuilder.build(value, { includeHtml: true });
    },
  };
  let legacyCalls = 0;
  const coordinator = createDocumentOutputCoordinator({
    officeHandlers: createOfficePdfHandlers(countingBuilder),
  });
  for (const surface of ['export', 'email', 'print']) {
    const result = await coordinator.run(
      surface,
      payloadFor(surface, prepared.tablePresentation),
      async () => { legacyCalls += 1; },
    );
    assert.equal(result.buffer.subarray(0, 5).toString(), '%PDF-');
    assert.equal(result.transformedHtml.includes('data-rv-office-output-table="0"'), true);
  }
  assert.equal(buildCalls, 3);
  assert.equal(rendered.length, 3);
  assert.equal(legacyCalls, 0);

  const brokenBuilder = { async build() { throw new Error('transform failed'); } };
  const failClosed = createDocumentOutputCoordinator({
    officeHandlers: createOfficePdfHandlers(brokenBuilder),
  });
  await assert.rejects(
    failClosed.run('export', payloadFor('export', prepared.tablePresentation), async () => {
      legacyCalls += 1;
    }),
    /transform failed/,
  );
  assert.equal(legacyCalls, 0);
});

test('[slice 11.2] a stalled Pandoc tree is terminated, reaped, and leaves no converter temp root', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-timeout-test-'));
  const fakePandoc = path.join(root, 'pandoc');
  fs.writeFileSync(
    fakePandoc,
    [
      '#!/usr/bin/env node',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'const { spawn } = require("node:child_process");',
      'fs.writeFileSync(path.join(__dirname, "leader.pid"), String(process.pid));',
      'const childCode = "process.on(\\"SIGTERM\\", () => {}); if (process.send) process.send(\\"ready\\"); setInterval(() => {}, 1000);";',
      'const child = spawn(process.execPath, ["-e", childCode], { stdio: ["ignore", "ignore", "ignore", "ipc"] });',
      'child.once("message", () => fs.writeFileSync(path.join(__dirname, "descendant.pid"), String(child.pid)));',
      'process.on("SIGTERM", () => {});',
      'setInterval(() => {}, 1000);',
      '',
    ].join('\n'),
    { mode: 0o700 },
  );
  const prepared = await preparedFor();
  let leaderPid;
  let descendantPid;
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      pandocTimeoutMs: 1_000,
      pandocKillGraceMs: 100,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after Pandoc timeout'),
    });
    await assert.rejects(builder.build(prepared), /Pandoc timed out after 1000ms/);
    leaderPid = Number(fs.readFileSync(path.join(root, 'leader.pid'), 'utf8'));
    descendantPid = Number(fs.readFileSync(path.join(root, 'descendant.pid'), 'utf8'));
    assert.throws(() => process.kill(leaderPid, 0), (error) => error?.code === 'ESRCH');
    assert.throws(() => process.kill(descendantPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(fs.readdirSync(root).sort(), ['descendant.pid', 'leader.pid', 'pandoc']);
  } finally {
    if (process.platform !== 'win32' && leaderPid) {
      try { process.kill(-leaderPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else for (const pid of [descendantPid, leaderPid]) if (pid) {
      try { process.kill(pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] ordinary Pandoc failure drains capped stderr and cleans its temp root', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-failure-test-'));
  const fakePandoc = path.join(root, 'pandoc');
  fs.writeFileSync(
    fakePandoc,
    '#!/usr/bin/env node\nprocess.stderr.write("x".repeat(100000), () => process.exit(7));\n',
    { mode: 0o700 },
  );
  const prepared = await preparedFor();
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after Pandoc failure'),
    });
    await assert.rejects(builder.build(prepared), (error) => (
      error.message.length === 65_536 && /^x+$/.test(error.message)
    ));
    assert.deepEqual(fs.readdirSync(root), ['pandoc']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] abnormal Pandoc close reaps its TERM-ignoring descendant before rejecting', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-abnormal-test-'));
  const fakePandoc = path.join(root, 'pandoc');
  fs.writeFileSync(
    fakePandoc,
    [
      '#!/usr/bin/env node',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'const { spawn } = require("node:child_process");',
      'fs.writeFileSync(path.join(__dirname, "leader.pid"), String(process.pid));',
      'const childCode = "process.on(\\"SIGTERM\\", () => {}); if (process.send) process.send(\\"ready\\"); setInterval(() => {}, 1000);";',
      'const child = spawn(process.execPath, ["-e", childCode], { stdio: ["ignore", "ignore", "ignore", "ipc"] });',
      'child.once("message", () => {',
      '  fs.writeFileSync(path.join(__dirname, "descendant.pid"), String(child.pid));',
      '  process.stderr.write("converter failed", () => process.exit(7));',
      '});',
      '',
    ].join('\n'),
    { mode: 0o700 },
  );
  const prepared = await preparedFor();
  let leaderPid;
  let descendantPid;
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      pandocKillGraceMs: 100,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after Pandoc failure'),
    });
    await assert.rejects(builder.build(prepared), /converter failed/);
    leaderPid = Number(fs.readFileSync(path.join(root, 'leader.pid'), 'utf8'));
    descendantPid = Number(fs.readFileSync(path.join(root, 'descendant.pid'), 'utf8'));
    assert.throws(() => process.kill(leaderPid, 0), (error) => error?.code === 'ESRCH');
    assert.throws(() => process.kill(descendantPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(fs.readdirSync(root).sort(), ['descendant.pid', 'leader.pid', 'pandoc']);
  } finally {
    if (process.platform !== 'win32' && leaderPid) {
      try { process.kill(-leaderPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else for (const pid of [descendantPid, leaderPid]) if (pid) {
      try { process.kill(pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] converter registry cleanup fault rejects without uncaught or temp leak', {
  skip: process.platform === 'win32',
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-registry-fault-test-'));
  const registry = path.join(root, 'converter-groups');
  const fakePandoc = path.join(root, 'pandoc');
  fs.mkdirSync(registry, { mode: 0o700 });
  fs.writeFileSync(
    fakePandoc,
    [
      '#!/usr/bin/env node',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'fs.writeFileSync(path.join(__dirname, "leader.pid"), String(process.pid));',
      `fs.chmodSync(${JSON.stringify(registry)}, 0o500);`,
      'process.stderr.write("converter primary failure", () => process.exit(7));',
      '',
    ].join('\n'),
    { mode: 0o700 },
  );
  const prepared = await preparedFor();
  let leaderPid;
  let hangTimer;
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      processGroupRegistry: registry,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after converter failure'),
    });
    const result = await Promise.race([
      builder.build(prepared).then(
        () => ({ value: null }),
        (error) => ({ error }),
      ),
      new Promise((resolve) => {
        hangTimer = setTimeout(() => resolve({ hung: true }), 5_000);
      }),
    ]);
    clearTimeout(hangTimer);
    assert.equal(result.hung, undefined);
    assert.ok(result.error instanceof AggregateError);
    const details = collectErrorDetails(result.error);
    assert.equal(details.messages.includes('converter primary failure'), true);
    assert.equal(details.codes.some((code) => code === 'EACCES' || code === 'EPERM'), true);
    leaderPid = Number(fs.readFileSync(path.join(root, 'leader.pid'), 'utf8'));
    assert.throws(() => process.kill(leaderPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('fusion-office-pdf-')),
      [],
    );
  } finally {
    clearTimeout(hangTimer);
    fs.chmodSync(registry, 0o700);
    if (leaderPid) {
      try { process.kill(-leaderPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] successful converter still rejects when registry cleanup fails', {
  skip: process.platform === 'win32',
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-success-cleanup-fault-test-'));
  const registry = path.join(root, 'converter-groups');
  const fakePandoc = path.join(root, 'pandoc');
  fs.mkdirSync(registry, { mode: 0o700 });
  fs.writeFileSync(
    fakePandoc,
    [
      '#!/usr/bin/env node',
      'const fs = require("node:fs");',
      'const output = process.argv[process.argv.indexOf("-o") + 1];',
      'fs.writeFileSync(output, "<!doctype html><html><body></body></html>");',
      `fs.chmodSync(${JSON.stringify(registry)}, 0o500);`,
      '',
    ].join('\n'),
    { mode: 0o700 },
  );
  const prepared = await preparedFor();
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      processGroupRegistry: registry,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after registry cleanup failure'),
    });
    await assert.rejects(builder.build(prepared), (error) => (
      error?.code === 'EACCES' || error?.code === 'EPERM' || error instanceof AggregateError
    ));
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('fusion-office-pdf-')),
      [],
    );
  } finally {
    fs.chmodSync(registry, 0o700);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] post-create pending reservation fault removes the exact record', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-reservation-fault-test-'));
  const registry = path.join(root, 'converter-groups');
  const fakePandoc = path.join(root, 'pandoc');
  fs.mkdirSync(registry, { mode: 0o700 });
  fs.writeFileSync(fakePandoc, '#!/bin/sh\nexit 99\n', { mode: 0o700 });
  const prepared = await preparedFor();
  const writeFileSync = fs.writeFileSync;
  let injected = false;
  fs.writeFileSync = function injectedPendingWrite(filename, ...args) {
    const result = writeFileSync.call(this, filename, ...args);
    if (!injected && path.dirname(filename) === registry && filename.endsWith('.pending')) {
      injected = true;
      const error = new Error('injected post-create pending reservation failure');
      error.code = 'EIO';
      throw error;
    }
    return result;
  };
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      processGroupRegistry: registry,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after reservation failure'),
    });
    await assert.rejects(builder.build(prepared), (error) => (
      error?.code === 'EIO'
      && error.message === 'injected post-create pending reservation failure'
    ));
    assert.equal(injected, true);
    assert.deepEqual(fs.readdirSync(registry), []);
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('fusion-office-pdf-')),
      [],
    );
  } finally {
    fs.writeFileSync = writeFileSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] exclusive PGID collision preserves the pre-existing sentinel', {
  skip: process.platform === 'win32',
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-pgid-collision-test-'));
  const registry = path.join(root, 'converter-groups');
  const fakePandoc = path.join(root, 'pandoc');
  fs.mkdirSync(registry, { mode: 0o700 });
  fs.writeFileSync(fakePandoc, '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n', { mode: 0o700 });
  const prepared = await preparedFor();
  const writeFileSync = fs.writeFileSync;
  let collidedPath;
  let converterPid;
  fs.writeFileSync = function injectPgidCollision(filename, ...args) {
    if (!collidedPath && path.dirname(filename) === registry && filename.endsWith('.pgid')) {
      collidedPath = filename;
      writeFileSync.call(this, filename, 'PREEXISTING\n', {
        encoding: 'ascii', flag: 'wx', mode: 0o600,
      });
    }
    return writeFileSync.call(this, filename, ...args);
  };
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      processGroupRegistry: registry,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after PGID collision'),
    });
    await assert.rejects(builder.build(prepared), (error) => error?.code === 'EEXIST');
    assert.ok(collidedPath);
    assert.equal(fs.readFileSync(collidedPath, 'ascii'), 'PREEXISTING\n');
    assert.deepEqual(fs.readdirSync(registry), [path.basename(collidedPath)]);
    converterPid = Number(path.basename(collidedPath, '.pgid'));
    assert.throws(() => process.kill(converterPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('fusion-office-pdf-')),
      [],
    );
  } finally {
    fs.writeFileSync = writeFileSync;
    if (converterPid) {
      try { process.kill(-converterPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] post-create PGID publication fault removes every owned record', {
  skip: process.platform === 'win32',
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-pgid-write-fault-test-'));
  const registry = path.join(root, 'converter-groups');
  const fakePandoc = path.join(root, 'pandoc');
  fs.mkdirSync(registry, { mode: 0o700 });
  fs.writeFileSync(fakePandoc, '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n', { mode: 0o700 });
  const prepared = await preparedFor();
  const writeFileSync = fs.writeFileSync;
  let converterPid;
  fs.writeFileSync = function injectPostCreatePgidFailure(filename, ...args) {
    const result = writeFileSync.call(this, filename, ...args);
    if (!converterPid && path.dirname(filename) === registry && filename.endsWith('.pgid')) {
      converterPid = Number(path.basename(filename, '.pgid'));
      const error = new Error('injected post-create PGID publication failure');
      error.code = 'EIO';
      throw error;
    }
    return result;
  };
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      processGroupRegistry: registry,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after PGID write failure'),
    });
    await assert.rejects(builder.build(prepared), (error) => (
      error?.code === 'EIO'
      && error.message === 'injected post-create PGID publication failure'
    ));
    assert.ok(converterPid);
    assert.throws(() => process.kill(converterPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(fs.readdirSync(registry), []);
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('fusion-office-pdf-')),
      [],
    );
  } finally {
    fs.writeFileSync = writeFileSync;
    if (converterPid) {
      try { process.kill(-converterPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] pending removal fault clears both records before rejection', {
  skip: process.platform === 'win32',
}, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-pandoc-pending-remove-fault-test-'));
  const registry = path.join(root, 'converter-groups');
  const fakePandoc = path.join(root, 'pandoc');
  fs.mkdirSync(registry, { mode: 0o700 });
  fs.writeFileSync(fakePandoc, '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n', { mode: 0o700 });
  const prepared = await preparedFor();
  const writeFileSync = fs.writeFileSync;
  const rmSync = fs.rmSync;
  let converterPid;
  let injected = false;
  fs.writeFileSync = function capturePublishedPgid(filename, ...args) {
    const result = writeFileSync.call(this, filename, ...args);
    if (path.dirname(filename) === registry && filename.endsWith('.pgid')) {
      converterPid = Number(path.basename(filename, '.pgid'));
    }
    return result;
  };
  fs.rmSync = function injectPendingRemovalFailure(filename, ...args) {
    if (!injected && path.dirname(filename) === registry && filename.endsWith('.pending')) {
      injected = true;
      const error = new Error('injected pending removal failure');
      error.code = 'EIO';
      throw error;
    }
    return rmSync.call(this, filename, ...args);
  };
  try {
    const builder = createOfficePdfBuilder({
      getPandocPath: () => fakePandoc,
      temporaryRoot: root,
      processGroupRegistry: registry,
      htmlToPdf: async () => assert.fail('PDF rendering must not run after pending removal failure'),
    });
    await assert.rejects(builder.build(prepared), (error) => (
      error?.code === 'EIO' && error.message === 'injected pending removal failure'
    ));
    assert.equal(injected, true);
    assert.ok(converterPid);
    assert.throws(() => process.kill(converterPid, 0), (error) => error?.code === 'ESRCH');
    assert.deepEqual(fs.readdirSync(registry), []);
    assert.deepEqual(
      fs.readdirSync(root).filter((name) => name.startsWith('fusion-office-pdf-')),
      [],
    );
  } finally {
    fs.writeFileSync = writeFileSync;
    fs.rmSync = rmSync;
    if (converterPid) {
      try { process.kill(-converterPid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('[slice 11.2] full-page raster ownership rejects gutter and cross-table paint escape', () => {
  const width = 64;
  const height = 64;
  const whitePage = () => new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (data, x, y) => {
    const offset = (y * width + x) * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
  };
  const oracleData = whitePage();
  const clean = whitePage();
  for (let y = 10; y <= 20; y += 1) paint(clean, 12, y);
  for (let y = 34; y <= 44; y += 1) paint(clean, 12, y);
  for (let x = 28; x <= 31; x += 1) {
    paint(clean, x, 27);
    paint(oracleData, x, 27);
  }
  const options = {
    oracleData,
    width,
    height,
    tableRects: [
      { index: 0, pageNumber: 1, left: 10, top: 10, right: 20, bottom: 20 },
      { index: 1, pageNumber: 1, left: 10, top: 34, right: 20, bottom: 44 },
    ],
    nonTableRects: [{ left: 26, top: 25, right: 33, bottom: 29 }],
    printable: { left: 0, top: 0, right: width - 1, bottom: height - 1 },
    tolerance: 3,
    glyphDilation: 1,
  };
  const cleanBounds = verifyProductionTableInkOwnership({ ...options, data: clean });
  assert.deepEqual(cleanBounds.map(({ left, top, right, bottom }) => ({ left, top, right, bottom })), [
    { left: 12, top: 10, right: 12, bottom: 20 },
    { left: 12, top: 34, right: 12, bottom: 44 },
  ]);

  const escaped = clean.slice();
  for (let y = 21; y <= 33; y += 1) paint(escaped, 12, y);
  assert.throws(
    () => verifyProductionTableInkOwnership({ ...options, data: escaped }),
    /production table ink has 0 owners/,
  );
  assert.throws(
    () => verifyProductionTableInkOwnership({
      ...options,
      data: clean,
      tableRects: [
        options.tableRects[0],
        { ...options.tableRects[1], top: 18 },
      ],
    }),
    /independent table rectangles overlap 0\/1/,
  );
});

test('[slice 11.2] runner waits for a TERM-ignoring descendant after its leader exits', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { waitForChild } = await import(pathToFileURL(runnerPath).href);
  const descendantCode = 'process.on("SIGTERM", () => {}); process.stdout.write("ready\\n"); setInterval(() => {}, 1000);';
  const leaderCode = [
    'const { spawn } = require("node:child_process");',
    `const descendant = spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], { stdio: ['ignore', 'pipe', 'ignore'] });`,
    'descendant.stdout.once("data", () => process.stdout.write(String(descendant.pid) + "\\n"));',
    'process.on("SIGTERM", () => process.exit(0));',
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const leader = spawn(process.execPath, ['-e', leaderCode], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const descendantPid = await new Promise((resolve, reject) => {
    let output = '';
    leader.stdout.on('data', (bytes) => {
      output += bytes.toString();
      if (output.includes('\n')) resolve(Number(output.trim()));
    });
    leader.once('error', reject);
  });
  try {
    await assert.rejects(waitForChild(leader, 50), /timed out after 50ms/);
    assert.throws(() => process.kill(descendantPid, 0), (error) => error?.code === 'ESRCH');
  } finally {
    if (process.platform !== 'win32' && leader.pid) {
      try { process.kill(-leader.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else if (!leader.killed) leader.kill('SIGKILL');
  }
});

test('[slice 11.2] abnormal leader close reaps its TERM-ignoring descendant', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { waitForChild } = await import(pathToFileURL(runnerPath).href);
  const descendantCode = 'process.on("SIGTERM", () => {}); process.stdout.write("ready\\n"); setInterval(() => {}, 1000);';
  const leaderCode = [
    'const { spawn } = require("node:child_process");',
    `const descendant = spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], { stdio: ['ignore', 'pipe', 'ignore'] });`,
    'descendant.stdout.once("data", () => process.stdout.write(String(descendant.pid) + "\\n"));',
    'setTimeout(() => process.exit(7), 200);',
  ].join('\n');
  const leader = spawn(process.execPath, ['-e', leaderCode], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const descendantPid = await new Promise((resolve, reject) => {
    let output = '';
    leader.stdout.on('data', (bytes) => {
      output += bytes.toString();
      if (output.includes('\n')) resolve(Number(output.trim()));
    });
    leader.once('error', reject);
  });
  try {
    await assert.rejects(waitForChild(leader, 10_000), /failed: code=7 signal=null/);
    assert.throws(() => process.kill(descendantPid, 0), (error) => error?.code === 'ESRCH');
  } finally {
    if (process.platform !== 'win32' && leader.pid) {
      try { process.kill(-leader.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else if (!leader.killed) leader.kill('SIGKILL');
  }
});

test('[slice 11.2] parent signal reaps a TERM-ignoring descendant before rejecting', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { waitForChild } = await import(pathToFileURL(runnerPath).href);
  const descendantCode = 'process.on("SIGTERM", () => {}); process.stdout.write("ready\\n"); setInterval(() => {}, 1000);';
  const leaderCode = [
    'const { spawn } = require("node:child_process");',
    `const descendant = spawn(process.execPath, ['-e', ${JSON.stringify(descendantCode)}], { stdio: ['ignore', 'pipe', 'ignore'] });`,
    'descendant.stdout.once("data", () => process.stdout.write(String(descendant.pid) + "\\n"));',
    'process.on("SIGTERM", () => process.exit(0));',
    'setInterval(() => {}, 1000);',
  ].join('\n');
  const leader = spawn(process.execPath, ['-e', leaderCode], {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const descendantPid = await new Promise((resolve, reject) => {
    let output = '';
    leader.stdout.on('data', (bytes) => {
      output += bytes.toString();
      if (output.includes('\n')) resolve(Number(output.trim()));
    });
    leader.once('error', reject);
  });
  const signalTarget = new EventEmitter();
  try {
    const completion = waitForChild(leader, 10_000, signalTarget);
    signalTarget.emit('SIGTERM');
    await assert.rejects(completion, /interrupted by SIGTERM/);
    assert.throws(() => process.kill(descendantPid, 0), (error) => error?.code === 'ESRCH');
  } finally {
    if (process.platform !== 'win32' && leader.pid) {
      try { process.kill(-leader.pid, 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    } else if (!leader.killed) leader.kill('SIGKILL');
  }
});

test('[slice 11.2] runner timeout reaps a registered detached converter group', {
  skip: process.platform === 'win32',
}, async () => assertRunnerReapsDetachedConverter('timeout'));

test('[slice 11.2] runner signal reaps a registered detached converter group', {
  skip: process.platform === 'win32',
}, async () => assertRunnerReapsDetachedConverter('signal'));

test('[slice 11.2] runner abnormal close reaps a registered detached converter group', {
  skip: process.platform === 'win32',
}, async () => assertRunnerReapsDetachedConverter('abnormal'));

test('[slice 11.2] pre-spawn token closes the detached spawn-to-PGID registration race', {
  skip: process.platform === 'win32',
}, async () => assertRunnerReapsDetachedConverter('boundary'));

test('[slice 11.2] runner SIGINT before child spawn removes its full owned root', {
  skip: process.platform === 'win32',
}, async () => assertRunnerSignalCleansFullLifecycle('pre-child', 'SIGINT'));

test('[slice 11.2] runner SIGTERM after child settlement removes its full owned root', {
  skip: process.platform === 'win32',
}, async () => assertRunnerSignalCleansFullLifecycle('post-child', 'SIGTERM'));

test('[slice 11.2] runner SIGTERM during final cleanup is reported after root removal', {
  skip: process.platform === 'win32',
}, async () => assertRunnerSignalCleansFullLifecycle('final-cleanup', 'SIGTERM'));

test('[slice 11.2] interrupted partial retention is removed before nonzero exit', {
  skip: process.platform === 'win32',
}, async () => assertRunnerSignalCleansFullLifecycle(
  'retention-partial',
  'SIGTERM',
  { retain: true },
));

test('[slice 11.2] final-cleanup signal removes provisional retention without success marker', {
  skip: process.platform === 'win32',
}, async () => assertRunnerSignalCleansFullLifecycle(
  'final-cleanup',
  'SIGTERM',
  { retain: true },
));

test('[slice 11.2] final cleanup failure removes provisional retention without success marker', {
  skip: process.platform === 'win32',
}, assertCleanupFailureRemovesProvisionalRetention);

test('[slice 11.2] marker-write failure removes its unmarked partial and the next run succeeds', {
  skip: process.platform === 'win32',
}, assertMarkerWriteFailureCleansAndAllowsNextRun);

test('[slice 11.2] CLI renders the primary and every cleanup failure', {
  skip: process.platform === 'win32',
}, async () => {
  await assertRunnerSignalCleansFullLifecycle(
    'pre-child',
    'SIGTERM',
    { cleanupFailures: 1 },
  );
  await assertRunnerSignalCleansFullLifecycle(
    'pre-child',
    'SIGTERM',
    { cleanupFailures: 2 },
  );
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { formatError } = await import(pathToFileURL(runnerPath).href);
  const cyclic = new AggregateError([], 'cyclic diagnostic');
  cyclic.errors.push(cyclic);
  assert.match(formatError(cyclic), /\[Circular AggregateError: cyclic diagnostic\]/);
});

test('[slice 11.2] child wait preserves the first signal in both interruption orders', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { waitForChild } = await import(pathToFileURL(runnerPath).href);
  for (const [first, second] of [['SIGINT', 'SIGTERM'], ['SIGTERM', 'SIGINT']]) {
    const leader = spawn(process.execPath, ['-e', [
      'process.on("SIGINT", () => {});',
      'process.on("SIGTERM", () => process.exit(0));',
      'process.stdout.write("ready\\n");',
      'setInterval(() => {}, 1000);',
    ].join('\n')], {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      leader.stdout.once('data', resolve);
      leader.once('error', reject);
    });
    const signalTarget = new EventEmitter();
    try {
      const completion = waitForChild(leader, 10_000, signalTarget);
      signalTarget.emit(first);
      signalTarget.emit(second);
      await assert.rejects(completion, new RegExp(`interrupted by ${first}`));
      assert.throws(() => process.kill(leader.pid, 0), (error) => error?.code === 'ESRCH');
    } finally {
      if (leader.pid && process.platform !== 'win32') {
        try { process.kill(-leader.pid, 'SIGKILL'); } catch (error) {
          if (error?.code !== 'ESRCH') throw error;
        }
      } else if (leader.pid) {
        try { process.kill(leader.pid, 'SIGKILL'); } catch (error) {
          if (error?.code !== 'ESRCH') throw error;
        }
      }
    }
  }
});

test('[slice 11.2] runner spawn failure preserves the original ENOENT diagnostic', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { waitForChild } = await import(pathToFileURL(runnerPath).href);
  const child = spawn('/definitely/not/a/presentation-output-program', [], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  await assert.rejects(
    waitForChild(child, 1_000),
    (error) => error?.code === 'ENOENT',
  );
});

test('[slice 11.2] converter registry rejects unsafe and out-of-platform PID records', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { reapRegisteredConverterGroups } = await import(pathToFileURL(runnerPath).href);
  for (const pidText of ['2147483648', '9007199254740991']) {
    const registry = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-office-invalid-pgid-test-'));
    try {
      fs.writeFileSync(path.join(registry, `${pidText}.pgid`), `${pidText}\n`, { mode: 0o600 });
      await assert.rejects(
        reapRegisteredConverterGroups(registry, 10),
        /Invalid converter registry entry/,
      );
    } finally {
      fs.rmSync(registry, { recursive: true, force: true });
    }
  }
});

test('[slice 11.2] pending discovery requires canonical safe platform PGIDs', async () => {
  const runnerPath = path.join(
    __dirname, '..', '..', '..', '..',
    'e2e', 'office', 'run-presentation-output-electron.mjs',
  );
  const { discoverPendingConverterGroups } = await import(pathToFileURL(runnerPath).href);
  const token = '0123456789abcdef0123456789abcdef';
  const line = (pgidText) => `123 ${pgidText} command FUSION_OFFICE_CONVERTER_TOKEN=${token}`;
  const platformMaximum = process.platform === 'win32' ? 0xffff_ffff : 0x7fff_ffff;
  for (const pgidText of ['00042', String(platformMaximum + 1), '9007199254740991']) {
    assert.throws(
      () => discoverPendingConverterGroups(line(pgidText), token),
      /Invalid pending converter group/,
    );
  }
  assert.deepEqual(discoverPendingConverterGroups(line('42'), token), [42]);
});
