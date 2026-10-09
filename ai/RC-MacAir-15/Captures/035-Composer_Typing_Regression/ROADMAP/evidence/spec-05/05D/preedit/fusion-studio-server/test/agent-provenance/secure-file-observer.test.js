'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const observer = require('../../native/secure-file-observer');
const nativeObserver = require('../../native/secure-file-observer/build/Release/secure_file_observer.node');
const { runSecureObserverRuntimeSmoke } = require('../../native/secure-file-observer/runtime-smoke');
const { MAX_SNAPSHOT_BYTES } = require('../../lib/db/migrations/036_agent_tool_provenance');
const { verifyUtf8Bytes } = require('../../lib/agent-provenance/checkpoint-repository');

describe('bundled descriptor-relative secure file observer', () => {
  let root;
  let identity;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-secure-observer-'));
    const stat = fs.statSync(root, { bigint: true });
    identity = { expectedRootDevice: String(stat.dev), expectedRootInode: String(stat.ino) };
  });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  function inspect(relativePath, overrides = {}) {
    return observer.observeSecureFile({
      rootPath: root,
      relativePath,
      byteLimit: MAX_SNAPSHOT_BYTES,
      ...identity,
      ...overrides,
    });
  }

  test('the checked-in N-API artifact loads and returns only bounded bytes/stat data', async () => {
    expect(process.platform).toBe('darwin');
    expect(observer.available).toBe(true);
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'a.txt'), 'hello');
    const result = await inspect('docs/a.txt');
    expect(result).toMatchObject({
      status: 'bytes', bytes: Buffer.from('hello'),
      fingerprint: { size: 5 },
    });
    expect(verifyUtf8Bytes(result.bytes, { takeOwnership: true })).toBe(result.bytes);
    const splitScalar = Buffer.concat([Buffer.alloc(64 * 1024 - 1, 97), Buffer.from('🚀')]);
    expect(verifyUtf8Bytes(splitScalar, { takeOwnership: true })).toBe(splitScalar);
  });

  test('classifies stable absent, final symlink, parent symlink, directory, and oversize without following', async () => {
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'target.txt'), 'secret');
    fs.symlinkSync(path.join(root, 'target.txt'), path.join(root, 'docs', 'link.txt'));
    fs.symlinkSync(path.join(root, 'docs'), path.join(root, 'parent-link'));
    fs.mkdirSync(path.join(root, 'docs', 'folder'));
    fs.writeFileSync(path.join(root, 'docs', 'large.txt'), Buffer.alloc(33));
    await expect(inspect('docs/missing.txt')).resolves.toEqual({ status: 'absent' });
    await expect(inspect('docs/link.txt')).resolves.toMatchObject({ status: 'skipped', reason: 'final_symlink' });
    await expect(inspect('parent-link/a.txt')).resolves.toMatchObject({ status: 'skipped', reason: 'invalid_path' });
    await expect(inspect('docs/folder')).resolves.toMatchObject({ status: 'skipped', reason: 'not_regular_file' });
    await expect(inspect('docs/large.txt', { byteLimit: 32 })).resolves.toMatchObject({ status: 'skipped', reason: 'too_large' });
  });

  test('fails closed for authority mismatch, cancellation, and malformed native-bound paths', async () => {
    await expect(inspect('missing.txt', { expectedRootInode: '999999999' }))
      .resolves.toMatchObject({ status: 'failed', reason: 'workspace_unavailable' });
    const cancellation = observer.createCancellationHandle();
    cancellation.cancel();
    await expect(inspect('missing.txt', { cancellation }))
      .resolves.toMatchObject({ status: 'failed', reason: 'observation_timeout' });
    await expect(inspect('../escape')).rejects.toThrow(/relative path/u);
    await expect(inspect('/absolute')).rejects.toThrow(/relative path/u);
    await expect(inspect('a//b')).rejects.toThrow(/relative path/u);
    await expect(inspect('a\0b')).rejects.toThrow(/relative path/u);
  });

  test('the C boundary independently rejects embedded-NUL and noncanonical scalar inputs', () => {
    const deadlineNs = String(nativeObserver.monotonicNowNs() + 2_000_000_000n);
    const input = {
      rootPath: root,
      relativePath: 'file.txt',
      byteLimit: MAX_SNAPSHOT_BYTES,
      deadlineNs,
      ...identity,
      cancelView: null,
    };
    expect(() => nativeObserver.observe({ ...input, rootPath: `${root}\0suffix` }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, relativePath: 'a\0b' }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, relativePath: 'a\\b' }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, expectedRootDevice: `${identity.expectedRootDevice}\0x` }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, deadlineNs: `${deadlineNs}\0x` }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, byteLimit: '1' }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, expectedRootDevice: 1, expectedRootInode: 2 }))
      .toThrow(/input is invalid/u);
    expect(() => nativeObserver.observe({ ...input, cancelView: new Uint8Array(4) }))
      .toThrow(/cancellation handle is invalid/u);
  });

  test('every native file-byte disposal and external-buffer finalizer uses secure zeroing', () => {
    const source = fs.readFileSync(path.join(
      __dirname, '..', '..', 'native', 'secure-file-observer', 'secure_file_observer.c',
    ), 'utf8');
    expect(source).not.toMatch(/\bfree\([^;\n]*bytes[^;\n]*\)/u);
    expect(source).toMatch(/finalize_external_bytes[\s\S]*secure_zero_free\(data, \(size_t\)\(uintptr_t\)hint\)/u);
    expect(source.match(/secure_zero_free\(/gu).length).toBeGreaterThanOrEqual(12);
  });

  test('native-clock expired and future deadlines have exact closed outcomes', async () => {
    const input = {
      rootPath: root,
      relativePath: 'missing.txt',
      byteLimit: MAX_SNAPSHOT_BYTES,
      ...identity,
      cancelView: null,
    };
    await expect(nativeObserver.observe({
      ...input,
      deadlineNs: String(nativeObserver.monotonicNowNs() - 1n),
    })).resolves.toMatchObject({ status: 'failed', reason: 'observation_timeout' });
    await expect(nativeObserver.observe({
      ...input,
      deadlineNs: String(nativeObserver.monotonicNowNs() + 2_000_000_000n),
    })).resolves.toEqual({ status: 'absent' });
  });

  test('pins the opened parent descriptor across a pathname replacement race', async () => {
    const pinned = path.join(root, 'pinned');
    const replacement = path.join(root, 'replacement');
    fs.mkdirSync(pinned);
    fs.mkdirSync(replacement);
    fs.writeFileSync(path.join(pinned, 'value.txt'), Buffer.alloc(8 * 1024 * 1024, 65));
    fs.writeFileSync(path.join(replacement, 'value.txt'), Buffer.alloc(8 * 1024 * 1024, 66));
    const pending = inspect('pinned/value.txt');
    const displaced = path.join(root, 'displaced');
    fs.renameSync(pinned, displaced);
    fs.renameSync(replacement, pinned);
    const result = await pending;
    // This legacy unbarriered probe may complete both descriptor-relative
    // absence confirmations in the short rename gap. The deterministic
    // barrier fixture below proves the pinned-descriptor branch itself.
    expect(['bytes', 'absent', 'failed']).toContain(result.status);
    if (result.status === 'bytes') {
      expect(new Set(result.bytes).size).toBe(1);
      expect([65, 66]).toContain(result.bytes[0]);
    } else {
      expect(result.reason).toBe('unstable_during_observation');
    }
  });

  test('deterministically pins parent swaps and rejects final symlink swaps through the runtime smoke', async () => {
    const nonce = 'direct-native-observer-smoke';
    fs.writeFileSync(path.join(root, '.fusion-provenance-test-owned'), `${nonce}\n`);
    process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS = '1';
    try {
      await expect(runSecureObserverRuntimeSmoke({ root, nonce }))
        .resolves.toEqual({ fixture: 'descriptor-swap-v1' });
    } finally {
      delete process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS;
    }
  });

  test('a transient workspace identity failure transfers successful retry bytes exactly once', async () => {
    const displaced = `${root}-expected`;
    const transient = `${root}-transient`;
    fs.renameSync(root, displaced);
    fs.mkdirSync(root);
    const barrier = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
    process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS = '1';
    try {
      const pending = inspect('retry.txt', { testParentBarrier: barrier });
      const expires = Date.now() + 2_000;
      while (Atomics.load(barrier, 0) < 1) {
        if (Date.now() >= expires) throw new Error('workspace retry barrier timed out');
        await new Promise((resolve) => setImmediate(resolve));
      }
      fs.renameSync(root, transient);
      fs.renameSync(displaced, root);
      fs.writeFileSync(path.join(root, 'retry.txt'), 'retry-owned');
      Atomics.store(barrier, 1, 1);
      Atomics.notify(barrier, 1);
      while (Atomics.load(barrier, 0) < 2) {
        if (Date.now() >= expires) throw new Error('workspace retry parent barrier timed out');
        await new Promise((resolve) => setImmediate(resolve));
      }
      Atomics.store(barrier, 1, 2);
      Atomics.notify(barrier, 1);
      await expect(pending).resolves.toMatchObject({
        status: 'bytes',
        bytes: Buffer.from('retry-owned'),
      });
    } finally {
      delete process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS;
      if (fs.existsSync(displaced)) fs.rmSync(displaced, { recursive: true, force: true });
      if (fs.existsSync(transient)) fs.rmSync(transient, { recursive: true, force: true });
    }
  });

  test('a transient root failure cannot promote a single retry absence to durable truth', async () => {
    const displaced = `${root}-expected`;
    const transient = `${root}-transient`;
    fs.renameSync(root, displaced);
    fs.mkdirSync(root);
    const barrier = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2));
    process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS = '1';
    try {
      const pending = inspect('still-missing.txt', { testParentBarrier: barrier });
      const expires = Date.now() + 2_000;
      while (Atomics.load(barrier, 0) < 1) {
        if (Date.now() >= expires) throw new Error('workspace retry barrier timed out');
        await new Promise((resolve) => setImmediate(resolve));
      }
      fs.renameSync(root, transient);
      fs.renameSync(displaced, root);
      Atomics.store(barrier, 1, 1);
      Atomics.notify(barrier, 1);
      while (Atomics.load(barrier, 0) < 2) {
        if (Date.now() >= expires) throw new Error('workspace retry absence barrier timed out');
        await new Promise((resolve) => setImmediate(resolve));
      }
      Atomics.store(barrier, 1, 2);
      Atomics.notify(barrier, 1);
      await expect(pending).resolves.toMatchObject({
        status: 'failed',
        reason: 'unstable_during_observation',
      });
    } finally {
      delete process.env.FUSION_SECURE_OBSERVER_SMOKE_HOOKS;
      if (fs.existsSync(displaced)) fs.rmSync(displaced, { recursive: true, force: true });
      if (fs.existsSync(transient)) fs.rmSync(transient, { recursive: true, force: true });
    }
  });
});
