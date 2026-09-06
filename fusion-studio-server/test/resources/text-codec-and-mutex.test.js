'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createPathCoordinator,
  createSaveMutex,
  SaveBusyError,
} = require('../../lib/file-mutations/save-mutex');
const {
  encodeIntendedText,
  validatePreimageBytes,
} = require('../../lib/file-mutations/text-codec');
const { createCheckpointAdapter } = require('../../lib/file-mutations/checkpoint-adapter');
const { commitIfChanged } = require('../../lib/versioning');

describe('file-save text codec', () => {
  test.each([
    ['ASCII', 'hello', Buffer.from('hello')],
    ['empty', '', Buffer.alloc(0)],
    ['BOM', '\ufeffhello', Buffer.from('\ufeffhello')],
    ['emoji', 'a😀z', Buffer.from('a😀z')],
  ])('round-trips %s byte-exactly', (_label, text, expected) => {
    const encoded = encodeIntendedText(text);
    expect(encoded.bytes.equals(expected)).toBe(true);
    expect(validatePreimageBytes(encoded.bytes).bytes.equals(expected)).toBe(true);
  });

  test.each(['\ud800', '\udc00', 'x\0y'])('rejects invalid intended scalar text %#', (text) => {
    expect(() => encodeIntendedText(text)).toThrow();
  });

  test('rejects oversized intended and preimage bytes', () => {
    const oversized = Buffer.alloc((10 * 1024 * 1024) + 1, 0x61);
    expect(() => encodeIntendedText(oversized.toString())).toThrow(/10 MiB/u);
    expect(() => validatePreimageBytes(oversized)).toThrow(/10 MiB/u);
  });

  test.each([
    Buffer.from([0xc3, 0x28]),
    Buffer.from([0x61, 0x00, 0x62]),
    Buffer.from([0xef, 0xbf, 0xbd, 0x80]),
  ])('rejects invalid, NUL, or non-round-tripping preimages', (bytes) => {
    expect(() => validatePreimageBytes(bytes)).toThrow();
  });
});

describe('bounded per-resource save mutex', () => {
  test('runs waiters FIFO and allows different resources concurrently', async () => {
    const mutex = createSaveMutex();
    const order = [];
    let release;
    const held = mutex.runExclusive('a', async () => {
      order.push('a1');
      await new Promise((resolve) => { release = resolve; });
    });
    await Promise.resolve();
    const second = mutex.runExclusive('a', async () => order.push('a2'));
    const third = mutex.runExclusive('a', async () => order.push('a3'));
    await mutex.runExclusive('b', async () => order.push('b1'));
    release();
    await Promise.all([held, second, third]);
    expect(order).toEqual(['a1', 'b1', 'a2', 'a3']);
  });

  test('rejects overflow before entering work', async () => {
    const mutex = createSaveMutex({ maxWaiters: 1 });
    let release;
    const held = mutex.runExclusive('a', () => new Promise((resolve) => { release = resolve; }));
    await Promise.resolve();
    const waiting = mutex.runExclusive('a', async () => {});
    await expect(mutex.runExclusive('a', async () => {})).rejects.toBeInstanceOf(SaveBusyError);
    release();
    await Promise.all([held, waiting]);
  });

  test('gives saves one priority handoff during observation without expanding capacity', async () => {
    const mutex = createSaveMutex({ maxWaiters: 2 });
    const observation = mutex.tryAcquireObservation('workspace\0a.txt');
    expect(observation).not.toBeNull();
    const order = [];
    let releaseFirst;
    const first = mutex.runExclusive('workspace\0a.txt', () => new Promise((resolve) => {
      order.push('save-1'); releaseFirst = resolve;
    }));
    const second = mutex.runExclusive('workspace\0a.txt', async () => order.push('save-2'));
    const third = mutex.runExclusive('workspace\0a.txt', async () => order.push('save-3'));
    await expect(mutex.runExclusive('workspace\0a.txt', async () => {})).rejects.toBeInstanceOf(SaveBusyError);
    expect(order).toEqual([]);
    expect(observation.release()).toBe(true);
    await new Promise(setImmediate);
    expect(order).toEqual(['save-1']);
    releaseFirst();
    await Promise.all([first, second, third]);
    expect(order).toEqual(['save-1', 'save-2', 'save-3']);
    expect(observation.release()).toBe(false);
  });

  test('an active save prevents a non-queuing observation lease', async () => {
    const mutex = createSaveMutex();
    let release;
    const save = mutex.runExclusive('workspace\0a.txt', () => new Promise((resolve) => { release = resolve; }));
    await Promise.resolve();
    expect(mutex.tryAcquireObservation('workspace\0a.txt')).toBeNull();
    release();
    await save;
    const observation = mutex.tryAcquireObservation('workspace\0a.txt');
    expect(observation).not.toBeNull();
    observation.release();
  });
});

describe('save and observation path coordinator', () => {
  test('case-insensitive parent keys conflict with exact child aliases in both ownership orders', async () => {
    const coordinator = createPathCoordinator();
    const observation = coordinator.tryAcquireObservation('workspace\0Docs/a.txt');
    expect(observation).not.toBeNull();
    let saveStarted = false;
    const save = coordinator.runExclusive(
      'workspace\0docs\0case-insensitive-parent',
      async () => { saveStarted = true; },
    );
    await Promise.resolve();
    expect(saveStarted).toBe(false);
    expect(coordinator.tryAcquireObservation('workspace\0DOCS/b.txt')).toBeNull();
    const otherWorkspace = coordinator.tryAcquireObservation('other-workspace\0docs/b.txt');
    expect(otherWorkspace).not.toBeNull();
    otherWorkspace.release();
    observation.release();
    await save;
    expect(saveStarted).toBe(true);

    let releaseSave;
    const activeSave = coordinator.runExclusive(
      'workspace\0DOCS\0case-insensitive-parent',
      () => new Promise((resolve) => { releaseSave = resolve; }),
    );
    await Promise.resolve();
    expect(coordinator.tryAcquireObservation('workspace\0docs/c.txt')).toBeNull();
    releaseSave();
    await activeSave;
  });

  test('a case-insensitive parent save waits for every active child observation', async () => {
    const coordinator = createPathCoordinator();
    const first = coordinator.tryAcquireObservation('workspace\0docs/a.txt');
    const second = coordinator.tryAcquireObservation('workspace\0docs/b.txt');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const order = [];
    const save = coordinator.runExclusive(
      'workspace\0docs\0case-insensitive-parent',
      async () => order.push('save'),
    );
    await Promise.resolve();
    expect(coordinator.tryAcquireObservation('workspace\0docs/c.txt')).toBeNull();
    await coordinator.runExclusive('workspace\0other/a.txt', async () => order.push('other'));
    first.release();
    await new Promise(setImmediate);
    expect(order).toEqual(['other']);
    second.release();
    await save;
    expect(order).toEqual(['other', 'save']);
  });

  test('an observation preserves the exact 33-save capacity and FIFO handoff', async () => {
    const coordinator = createPathCoordinator({ maxWaiters: 32 });
    const observation = coordinator.tryAcquireObservation('workspace\0docs/a.txt');
    const order = [];
    let releaseFirst;
    const saves = Array.from({ length: 33 }, (_, index) => coordinator.runExclusive(
      'workspace\0docs\0case-insensitive-parent',
      () => {
        order.push(index);
        if (index === 0) return new Promise((resolve) => { releaseFirst = resolve; });
        return undefined;
      },
    ));
    await expect(coordinator.runExclusive(
      'workspace\0docs\0case-insensitive-parent',
      async () => {},
    )).rejects.toBeInstanceOf(SaveBusyError);
    expect(order).toEqual([]);
    observation.release();
    await new Promise(setImmediate);
    expect(order).toEqual([0]);
    releaseFirst();
    await Promise.all(saves);
    expect(order).toEqual(Array.from({ length: 33 }, (_, index) => index));
  });
});

describe('save checkpoint adapter', () => {
  test('preserves reason-specific commit behavior and truthful outcomes', async () => {
    const calls = [];
    const adapter = createCheckpointAdapter({
      clock: () => new Date('2026-01-02T03:04:05.000Z'),
      commit: async (...args) => { calls.push(args); return { changed: false }; },
    });
    await expect(adapter.afterSave({
      contentRoot: '/workspace', relativePath: 'doc.md', saveReason: 'manual',
    })).resolves.toBe('not_requested');
    await expect(adapter.afterSave({
      contentRoot: '/workspace', relativePath: 'doc.md', saveReason: 'checkpoint',
    })).resolves.toBe('no_change');
    expect(calls).toEqual([['/workspace', 'doc.md', 'checkpoint: doc.md @ 2026-01-02T03:04:05.000Z']]);

    const failed = createCheckpointAdapter({ commit: async () => { throw new Error('git failed'); } });
    await expect(failed.afterSave({
      contentRoot: '/workspace', relativePath: 'doc.md', saveReason: 'milestone', milestone: 'M1',
    })).resolves.toBe('failed');
  });

  test('the established Git primitive distinguishes committed from no-change', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-checkpoint-'));
    try {
      fs.writeFileSync(path.join(root, 'doc.md'), 'one');
      await expect(commitIfChanged(root, 'doc.md', 'first')).resolves.toBe(true);
      await expect(commitIfChanged(root, 'doc.md', 'same')).resolves.toBe(false);
      fs.writeFileSync(path.join(root, 'doc.md'), 'two');
      await expect(commitIfChanged(root, 'doc.md', 'second')).resolves.toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('checkpoint metadata is passed to Git without shell interpretation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-checkpoint-injection-'));
    const marker = path.join(root, 'CHECKPOINT_INJECTED');
    try {
      fs.writeFileSync(path.join(root, 'doc.md'), 'content');
      const adapter = createCheckpointAdapter();
      await expect(adapter.afterSave({
        contentRoot: root,
        relativePath: 'doc.md',
        saveReason: 'milestone',
        milestone: `$(touch ${marker}) \`touch ${marker}.backtick\``,
      })).resolves.toBe('committed');
      expect(fs.existsSync(marker)).toBe(false);
      expect(fs.existsSync(`${marker}.backtick`)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
