import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const OWNED_MARKER = '.fusion-provenance-test-owned';

export function assertOwned(directory, nonce) {
  if (fs.readFileSync(path.join(directory, OWNED_MARKER), 'utf8') !== `${nonce}\n`) {
    throw new Error('Refusing to use an unowned provenance directory.');
  }
}

export function createEvidenceRoot() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fusion-provenance-evidence-'));
  fs.chmodSync(root, 0o700);
  const nonce = randomUUID();
  fs.writeFileSync(path.join(root, OWNED_MARKER), `${nonce}\n`, { flag: 'wx', mode: 0o600 });
  return { root, nonce };
}

function writeReceipt(destination, receipt) {
  fs.writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

function updateReceipt(destination, receipt) {
  const temporary = `${destination}.${randomUUID()}.pending`;
  writeReceipt(temporary, receipt);
  // A failed update leaves the previous pending receipt intact.
  fs.renameSync(temporary, destination);
}

function retainArtifacts(root, destination, failed) {
  const artifacts = [];
  function visit(source, relative) {
    if (!fs.existsSync(source)) return;
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error('Refusing linked provenance artifacts.');
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(source).sort()) visit(path.join(source, entry), `${relative}/${entry}`);
      return;
    }
    if (!stat.isFile()) throw new Error('Refusing non-file provenance artifacts.');
    const bytes = fs.readFileSync(source);
    // Raw traces can contain the browser fixture's synthetic auth frames.
    // Keep their receipt, never their payload. Only fixture failure images and
    // Markdown context plus the isolated content-free audit are copied.
    const retained = relative === 'app-data/isolated-provenance-audit.json'
      || (failed && (relative.endsWith('/error-context.md') || /\/test-failed[^/]*\.png$/.test(relative)));
    const receipt = {
      path: relative, bytes: stat.size,
      sha256: createHash('sha256').update(bytes).digest('hex'), retained,
    };
    artifacts.push(receipt);
    if (retained) {
      const target = path.join(destination, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    }
  }
  visit(path.join(root, 'app-data', 'isolated-provenance-audit.json'), 'app-data/isolated-provenance-audit.json');
  if (failed) visit(path.join(root, 'playwright-results'), 'playwright-results');
  return artifacts;
}

export async function withScenarioEvidence({ root, nonce, evidence, scenario, run }) {
  assertOwned(root, nonce);
  assertOwned(evidence.root, evidence.nonce);
  const destination = path.join(evidence.root, scenario);
  fs.mkdirSync(destination, { mode: 0o700 });
  fs.writeFileSync(path.join(destination, OWNED_MARKER), `${nonce}\n`, { flag: 'wx', mode: 0o600 });
  let phase = 'preparation';
  let failure;
  let result;
  try {
    result = await run((nextPhase) => { phase = nextPhase; });
  } catch (error) {
    failure = error;
  }
  const receipt = { scenario, sourceRoot: root, status: failure ? 'failed' : 'passed', phase, cleanup: 'pending' };
  const receiptPath = path.join(destination, 'scenario-receipt.json');
  try {
    // If evidence retention itself fails, retain the original owned root.
    receipt.artifacts = retainArtifacts(root, destination, Boolean(failure));
    // Persist trace/hash receipts as well as copied bytes before cleanup.
    writeReceipt(receiptPath, receipt);
    assertOwned(root, nonce);
    fs.rmSync(root, { recursive: true, force: false });
    receipt.cleanup = 'owned-marker-verified';
    updateReceipt(receiptPath, receipt);
  } catch (error) {
    receipt.cleanup = fs.existsSync(root) ? 'root-retained' : 'owned-marker-verified';
    const errors = failure ? [failure, error] : [error];
    try {
      if (fs.existsSync(receiptPath)) updateReceipt(receiptPath, receipt);
      else writeReceipt(receiptPath, receipt);
    } catch (receiptError) { errors.push(receiptError); }
    if (errors.length > 1) throw new AggregateError(errors, 'Scenario evidence finalization failed.');
    throw errors[0];
  }
  if (failure) throw failure;
  return result;
}

export async function withProtectedStateCheck({ evidence, snapshot, run }) {
  assertOwned(evidence.root, evidence.nonce);
  const before = snapshot();
  let result;
  let failure;
  try {
    result = await run();
  } catch (error) {
    failure = error;
  }
  let after;
  let comparisonError;
  try {
    after = snapshot();
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      comparisonError = new Error('A protected developer database, profile, workspace, or repository test output changed during the live proof.');
    }
  } catch (error) {
    comparisonError = error;
  }
  try {
    writeReceipt(path.join(evidence.root, 'protected-state-receipt.json'), {
      outcome: failure ? 'failed' : 'passed', before, after,
      comparison: comparisonError ? 'failed' : 'unchanged',
    });
  } catch (receiptError) {
    const errors = [failure, comparisonError, receiptError].filter(Boolean);
    if (errors.length > 1) throw new AggregateError(errors, 'Protected state receipt finalization failed.');
    throw receiptError;
  }
  if (failure && comparisonError) throw new AggregateError([failure, comparisonError], 'Live proof failed and protected state verification failed.');
  if (comparisonError) throw comparisonError;
  if (failure) throw failure;
  return result;
}
