import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createEvidenceRoot, assertOwned, OWNED_MARKER, withScenarioEvidence, withProtectedStateCheck } from './guarded-proof-lifecycle.mjs';

function fixture(t) {
  const evidence = createEvidenceRoot();
  const owned = createEvidenceRoot();
  t.after(() => {
    for (const item of [evidence, owned]) {
      if (fs.existsSync(item.root)) {
        assertOwned(item.root, item.nonce);
        fs.rmSync(item.root, { recursive: true });
      }
    }
  });
  const audit = path.join(owned.root, 'app-data', 'isolated-provenance-audit.json');
  const results = path.join(owned.root, 'playwright-results', 'failure');
  fs.mkdirSync(path.dirname(audit), { recursive: true });
  fs.mkdirSync(results, { recursive: true });
  fs.writeFileSync(audit, '{"startupEffects":[],"observationGuards":{"attempts":{}}}\n');
  fs.writeFileSync(path.join(results, 'trace.zip'), 'synthetic-auth-proof-must-not-be-retained');
  fs.writeFileSync(path.join(results, 'error-context.md'), 'fixture failure context\n');
  return { evidence, owned, audit, results };
}

test('failed scenario preserves the original error/phase and safe receipts before owned cleanup', async (t) => {
  const { evidence, owned } = fixture(t);
  const original = new Error('bounded fixture failure');
  await assert.rejects(withScenarioEvidence({
    root: owned.root, nonce: owned.nonce, evidence, scenario: 'normal',
    run: async (setPhase) => { setPhase('playwright'); throw original; },
  }), (error) => error === original);
  assert.equal(fs.existsSync(owned.root), false);
  const destination = path.join(evidence.root, 'normal');
  const receipt = JSON.parse(fs.readFileSync(path.join(destination, 'scenario-receipt.json')));
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.phase, 'playwright');
  assert.equal(receipt.cleanup, 'owned-marker-verified');
  assert.equal(fs.readFileSync(path.join(destination, 'playwright-results/failure/error-context.md'), 'utf8'), 'fixture failure context\n');
  assert.equal(fs.existsSync(path.join(destination, 'app-data/isolated-provenance-audit.json')), true);
  assert.equal(fs.existsSync(path.join(destination, 'playwright-results/failure/trace.zip')), false);
  const trace = receipt.artifacts.find(({ path }) => path.endsWith('/trace.zip'));
  assert.deepEqual(trace, {
    path: 'playwright-results/failure/trace.zip', bytes: 41,
    sha256: createHash('sha256').update('synthetic-auth-proof-must-not-be-retained').digest('hex'), retained: false,
  });
});

test('successful scenario retains the audit and validates marker cleanup', async (t) => {
  const { evidence, owned } = fixture(t);
  const result = await withScenarioEvidence({
    root: owned.root, nonce: owned.nonce, evidence, scenario: 'normal',
    run: async (setPhase) => { setPhase('startup-audit'); return 7; },
  });
  assert.equal(result, 7);
  const receipt = JSON.parse(fs.readFileSync(path.join(evidence.root, 'normal/scenario-receipt.json')));
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.artifacts.length, 1);
  assert.equal(receipt.artifacts[0].retained, true);
  assert.equal(fs.existsSync(owned.root), false);
});

test('protected state is compared after failure, preserving the failure and real drift evidence', async (t) => {
  const { evidence, owned } = fixture(t);
  const protectedFile = path.join(owned.root, 'protected');
  fs.writeFileSync(protectedFile, 'before');
  const snapshot = () => ({ state: createHash('sha256').update(fs.readFileSync(protectedFile)).digest('hex') });
  const original = new Error('scenario failed');
  await assert.rejects(withProtectedStateCheck({ evidence, snapshot, run: async () => {
    fs.writeFileSync(protectedFile, 'legitimate external change');
    throw original;
  } }), (error) => error instanceof AggregateError && error.errors[0] === original && error.errors.length === 2);
  const receipt = JSON.parse(fs.readFileSync(path.join(evidence.root, 'protected-state-receipt.json')));
  assert.equal(receipt.outcome, 'failed');
  assert.equal(receipt.comparison, 'failed');
  assert.notEqual(receipt.before.state, receipt.after.state);
  assert.equal(fs.readFileSync(protectedFile, 'utf8'), 'legitimate external change');
});

test('a failed scenario with unchanged protected state still records its comparison', async (t) => {
  const { evidence } = fixture(t);
  let snapshots = 0;
  const original = new Error('scenario failed');
  await assert.rejects(withProtectedStateCheck({
    evidence, snapshot: () => { snapshots += 1; return { state: 'same' }; },
    run: async () => { throw original; },
  }), (error) => error === original);
  assert.equal(snapshots, 2);
  const receipt = JSON.parse(fs.readFileSync(path.join(evidence.root, 'protected-state-receipt.json')));
  assert.equal(receipt.outcome, 'failed');
  assert.equal(receipt.comparison, 'unchanged');
});

test('success cannot pass protected-state drift', async (t) => {
  const { evidence } = fixture(t);
  let snapshots = 0;
  await assert.rejects(withProtectedStateCheck({
    evidence, snapshot: () => ({ state: ++snapshots }), run: async () => 'passed',
  }), /protected developer/);
  const receipt = JSON.parse(fs.readFileSync(path.join(evidence.root, 'protected-state-receipt.json')));
  assert.equal(receipt.outcome, 'passed');
  assert.equal(receipt.comparison, 'failed');
});

test('changed ownership or unsafe linked artifacts retain the root without deleting foreign bytes', async (t) => {
  const { evidence, owned, results } = fixture(t);
  fs.symlinkSync(path.join(owned.root, 'app-data/isolated-provenance-audit.json'), path.join(results, 'foreign-link'));
  const original = new Error('scenario failed');
  await assert.rejects(withScenarioEvidence({
    root: owned.root, nonce: owned.nonce, evidence, scenario: 'normal', run: async () => { throw original; },
  }), (error) => error instanceof AggregateError && error.errors[0] === original);
  assert.equal(fs.existsSync(owned.root), true);
  const receipt = JSON.parse(fs.readFileSync(path.join(evidence.root, 'normal/scenario-receipt.json')));
  assert.equal(receipt.cleanup, 'root-retained');
  fs.writeFileSync(path.join(owned.root, OWNED_MARKER), 'foreign nonce\n');
  await assert.rejects(withScenarioEvidence({
    root: owned.root, nonce: owned.nonce, evidence, scenario: 'second', run: async () => {},
  }), /unowned provenance/);
  assert.equal(fs.existsSync(owned.root), true);
  fs.writeFileSync(path.join(owned.root, OWNED_MARKER), `${owned.nonce}\n`);
});

test('trace metadata and failure phase are persisted before scenario deletion', async (t) => {
  const { evidence, owned } = fixture(t);
  const original = new Error('scenario failed');
  const remove = fs.rmSync;
  let checked = false;
  fs.rmSync = (directory, options) => {
    if (directory === owned.root) {
      const receipt = JSON.parse(fs.readFileSync(path.join(evidence.root, 'normal/scenario-receipt.json')));
      assert.equal(receipt.phase, 'playwright');
      assert.equal(receipt.status, 'failed');
      assert.equal(receipt.cleanup, 'pending');
      assert.equal(receipt.artifacts.find(a => a.path.endsWith('/trace.zip')).retained, false);
      checked = true;
    }
    return remove(directory, options);
  };
  try {
    await assert.rejects(withScenarioEvidence({
      root: owned.root, nonce: owned.nonce, evidence, scenario: 'normal',
      run: async phase => { phase('playwright'); throw original; },
    }), error => error === original);
  } finally { fs.rmSync = remove; }
  assert.equal(checked, true);
});

test('pre-cleanup receipt failure retains the original root and failure boundary', async (t) => {
  const { evidence, owned } = fixture(t);
  const original = new Error('scenario failed');
  const write = fs.writeFileSync;
  const receiptPath = path.join(evidence.root, 'normal/scenario-receipt.json');
  let failed = false;
  fs.writeFileSync = (destination, ...args) => {
    if (destination === receiptPath && !failed) { failed = true; throw new Error('receipt unavailable'); }
    return write(destination, ...args);
  };
  try {
    await assert.rejects(withScenarioEvidence({
      root: owned.root, nonce: owned.nonce, evidence, scenario: 'normal',
      run: async () => { throw original; },
    }), error => error instanceof AggregateError && error.errors[0] === original);
  } finally { fs.writeFileSync = write; }
  assert.equal(fs.existsSync(owned.root), true);
  assert.equal(JSON.parse(fs.readFileSync(receiptPath)).cleanup, 'root-retained');
});

test('failed final receipt update preserves pending metadata and the original scenario failure', async (t) => {
  const { evidence, owned } = fixture(t);
  const original = new Error('scenario failed');
  const rename = fs.renameSync;
  const receiptPath = path.join(evidence.root, 'normal/scenario-receipt.json');
  fs.renameSync = (source, destination) => {
    if (destination === receiptPath) throw new Error('receipt update unavailable');
    return rename(source, destination);
  };
  try {
    await assert.rejects(withScenarioEvidence({
      root: owned.root, nonce: owned.nonce, evidence, scenario: 'normal',
      run: async phase => { phase('playwright'); throw original; },
    }), error => error instanceof AggregateError && error.errors[0] === original);
  } finally { fs.renameSync = rename; }
  assert.equal(fs.existsSync(owned.root), false);
  const receipt = JSON.parse(fs.readFileSync(receiptPath));
  assert.equal(receipt.cleanup, 'pending');
  assert.equal(receipt.phase, 'playwright');
  assert.equal(receipt.artifacts.some(a => a.path.endsWith('/trace.zip')), true);
});

test('protected comparison receipt failure never masks the original scenario failure', async (t) => {
  const { evidence } = fixture(t);
  const original = new Error('scenario failed');
  const write = fs.writeFileSync;
  let snapshots = 0;
  fs.writeFileSync = (destination, ...args) => {
    if (destination === path.join(evidence.root, 'protected-state-receipt.json')) throw new Error('receipt unavailable');
    return write(destination, ...args);
  };
  try {
    await assert.rejects(withProtectedStateCheck({
      evidence, snapshot: () => { snapshots += 1; return { state: 'same' }; },
      run: async () => { throw original; },
    }), error => error instanceof AggregateError && error.errors[0] === original);
  } finally { fs.writeFileSync = write; }
  assert.equal(snapshots, 2);
});
