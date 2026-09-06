'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const observer = require('./index');

const MARKER = '.fusion-provenance-test-owned';

function assertOwnedRoot(root, nonce) {
  const resolved = fs.realpathSync(root);
  if (!resolved.startsWith(`${fs.realpathSync(os.tmpdir())}${path.sep}`)) {
    throw new Error('native observer smoke root is not temporary');
  }
  if (fs.readFileSync(path.join(resolved, MARKER), 'utf8') !== `${nonce}\n`) {
    throw new Error('native observer smoke ownership marker is invalid');
  }
  return resolved;
}

async function waitForStage(barrier, stage) {
  const expires = Date.now() + 2_000;
  while (Atomics.load(barrier, 0) < stage) {
    if (Date.now() >= expires) throw new Error(`native observer smoke stage ${stage} timed out`);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function releaseStage(barrier, stage) {
  Atomics.store(barrier, 1, stage);
  Atomics.notify(barrier, 1);
}

function identity(root) {
  const stat = fs.statSync(root, { bigint: true });
  return {
    expectedRootDevice: String(stat.dev),
    expectedRootInode: String(stat.ino),
  };
}

function input(root, relativePath, extras = {}) {
  return {
    rootPath: root,
    relativePath,
    byteLimit: 10 * 1024 * 1024,
    ...identity(root),
    ...extras,
  };
}

async function runSecureObserverRuntimeSmoke({ root, nonce }) {
  if (!observer.available) throw new Error('secure observer is unavailable');
  const ownedRoot = assertOwnedRoot(root, nonce);
  const fixture = path.join(ownedRoot, 'native-observer-smoke');
  fs.mkdirSync(fixture, { mode: 0o700 });

  const parent = path.join(fixture, 'parent');
  const replacement = path.join(fixture, 'replacement');
  const displaced = path.join(fixture, 'displaced');
  fs.mkdirSync(parent);
  fs.mkdirSync(replacement);
  fs.writeFileSync(path.join(parent, 'value.txt'), 'A');
  fs.writeFileSync(path.join(replacement, 'value.txt'), 'B');
  const parentBarrier = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
  const parentRead = observer.observeSecureFile(input(fixture, 'parent/value.txt', {
    testParentBarrier: parentBarrier,
  }));
  await waitForStage(parentBarrier, 1);
  fs.renameSync(parent, displaced);
  fs.renameSync(replacement, parent);
  fs.renameSync(parent, replacement);
  fs.renameSync(displaced, parent);
  releaseStage(parentBarrier, 1);
  const parentResult = await parentRead;
  if (parentResult.status !== 'bytes' || parentResult.bytes.toString('utf8') !== 'A') {
    throw new Error('descriptor-pinned parent swap produced foreign bytes');
  }

  const docs = path.join(fixture, 'docs');
  fs.mkdirSync(docs);
  fs.writeFileSync(path.join(docs, 'target.txt'), 'secret');
  fs.writeFileSync(path.join(docs, 'final.txt'), 'safe');
  const finalBarrier = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
  const finalRead = observer.observeSecureFile(input(fixture, 'docs/final.txt', {
    testParentBarrier: finalBarrier,
  }));
  await waitForStage(finalBarrier, 1);
  fs.renameSync(path.join(docs, 'final.txt'), path.join(docs, 'original.txt'));
  fs.symlinkSync(path.join(docs, 'target.txt'), path.join(docs, 'final.txt'));
  releaseStage(finalBarrier, 1);
  await waitForStage(finalBarrier, 2);
  releaseStage(finalBarrier, 2);
  await waitForStage(finalBarrier, 3);
  releaseStage(finalBarrier, 3);
  const finalResult = await finalRead;
  if (finalResult.status !== 'skipped' || finalResult.reason !== 'final_symlink') {
    throw new Error('descriptor-relative final symlink was not rejected');
  }

  const absentParent = path.join(fixture, 'absent-parent');
  const absentReplacement = path.join(fixture, 'absent-replacement');
  const absentDisplaced = path.join(fixture, 'absent-displaced');
  fs.mkdirSync(absentParent);
  fs.mkdirSync(absentReplacement);
  const absentBarrier = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
  const absentRead = observer.observeSecureFile(input(fixture, 'absent-parent/missing.txt', {
    testParentBarrier: absentBarrier,
  }));
  await waitForStage(absentBarrier, 1);
  releaseStage(absentBarrier, 1);
  await waitForStage(absentBarrier, 2);
  fs.renameSync(absentParent, absentDisplaced);
  fs.renameSync(absentReplacement, absentParent);
  releaseStage(absentBarrier, 2);
  await waitForStage(absentBarrier, 3);
  releaseStage(absentBarrier, 3);
  const absentResult = await absentRead;
  if (absentResult.status !== 'failed' || absentResult.reason !== 'unstable_during_observation') {
    throw new Error('replacement parent was accepted as stable absence');
  }

  const skippedParent = path.join(fixture, 'skipped-parent');
  const skippedReplacement = path.join(fixture, 'skipped-replacement');
  const skippedDisplaced = path.join(fixture, 'skipped-displaced');
  const sharedOversize = path.join(fixture, 'shared-oversize.txt');
  fs.mkdirSync(skippedParent);
  fs.mkdirSync(skippedReplacement);
  fs.writeFileSync(sharedOversize, 'xx');
  fs.linkSync(sharedOversize, path.join(skippedParent, 'large.txt'));
  fs.linkSync(sharedOversize, path.join(skippedReplacement, 'large.txt'));
  const skippedBarrier = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
  const skippedRead = observer.observeSecureFile(input(fixture, 'skipped-parent/large.txt', {
    byteLimit: 1,
    testParentBarrier: skippedBarrier,
  }));
  await waitForStage(skippedBarrier, 1);
  releaseStage(skippedBarrier, 1);
  await waitForStage(skippedBarrier, 2);
  fs.renameSync(skippedParent, skippedDisplaced);
  fs.renameSync(skippedReplacement, skippedParent);
  releaseStage(skippedBarrier, 2);
  await waitForStage(skippedBarrier, 3);
  releaseStage(skippedBarrier, 3);
  const skippedResult = await skippedRead;
  if (skippedResult.status !== 'failed' || skippedResult.reason !== 'unstable_during_observation') {
    throw new Error('replacement parent was accepted as a stable skip');
  }

  const expired = await observer.observeSecureFile(input(fixture, 'missing.txt', {
    deadlineNs: observer.deadlineAfterMilliseconds(0),
  }));
  if (expired.status !== 'failed' || expired.reason !== 'observation_timeout') {
    throw new Error('native monotonic deadline was not enforced');
  }
  const cancellation = observer.createCancellationHandle();
  cancellation.cancel();
  const cancelled = await observer.observeSecureFile(input(fixture, 'missing.txt', { cancellation }));
  if (cancelled.status !== 'failed' || cancelled.reason !== 'observation_timeout') {
    throw new Error('native cancellation was not enforced');
  }
  return Object.freeze({ fixture: 'descriptor-swap-v1' });
}

module.exports = { runSecureObserverRuntimeSmoke };
