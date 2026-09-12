'use strict';

const fs = require('fs');
const path = require('path');

const { CRASH_POINTS } = require('../../lib/views/relocation-service');
const { collectInventory } = require('../../lib/views/relocation-inventory');
const {
  createFixture,
  requestFor,
  serviceFor,
  writeCapsule,
  writeJson,
} = require('./view-relocation-fixtures');

describe('view capsule whole-tree relocation and recovery', () => {
  test('moves an old-only tree atomically and preserves unknown and dirty bytes', async () => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      const unknown = path.join(capsule, 'unknown.bin');
      const dirtyState = path.join(capsule, 'state', 'state.json');
      fs.writeFileSync(unknown, Buffer.from([0, 255, 10, 20, 30]));
      fs.chmodSync(unknown, 0o640);
      fs.symlinkSync('unknown.bin', path.join(capsule, 'unknown-link'));
      const stateBefore = fs.readFileSync(dirtyState);
      const before = await collectInventory({
        sourceRoot: fixture.oldRoot,
        destinationRoot: fixture.newRoot,
      });

      const result = await serviceFor(fixture).ensureReady(requestFor(fixture));

      expect(result.status).toBe('verified');
      expect(fs.existsSync(fixture.oldRoot)).toBe(false);
      expect(fs.readFileSync(path.join(fixture.newRoot, '001-example-viewer', 'unknown.bin')))
        .toEqual(Buffer.from([0, 255, 10, 20, 30]));
      expect(fs.readFileSync(path.join(fixture.newRoot, '001-example-viewer', 'state', 'state.json')))
        .toEqual(stateBefore);
      expect(fs.readlinkSync(path.join(fixture.newRoot, '001-example-viewer', 'unknown-link')))
        .toBe('unknown.bin');
      const after = await collectInventory({
        sourceRoot: fixture.newRoot,
        destinationRoot: fixture.newRoot,
      });
      expect(after.digest).toBe(before.digest);
      expect(after.directoryDevice).toBe(before.directoryDevice);
      expect(after.directoryInode).toBe(before.directoryInode);
      await expect(fixture.db('view_capsule_relocations').where({
        workspace_id: fixture.workspaceId,
      }).first()).resolves.toMatchObject({ status: 'verified', inventory_sha256: before.digest });
    } finally {
      await fixture.cleanup();
    }
  });

  test.each(CRASH_POINTS)('recovers exactly after durable crash boundary %s', async (crashPoint) => {
    const fixture = await createFixture(null, `crash-${crashPoint}`);
    try {
      writeCapsule(fixture.oldRoot);
      await expect(serviceFor(fixture, crashPoint).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ name: 'ViewRelocationCrashError', point: crashPoint });

      const crashState = {
        after_destination_parent: { status: null, source: true, destination: false },
        after_planned: { status: 'planned', source: true, destination: false },
        after_rename_before_moved: { status: 'planned', source: false, destination: true },
        after_moved: { status: 'moved', source: false, destination: true },
        after_verified: { status: 'verified', source: false, destination: true },
      }[crashPoint];
      const rowAtCrash = await fixture.db('view_capsule_relocations')
        .where({ workspace_id: fixture.workspaceId }).first();
      expect(rowAtCrash?.status || null).toBe(crashState.status);
      expect(fs.existsSync(fixture.oldRoot)).toBe(crashState.source);
      expect(fs.existsSync(fixture.newRoot)).toBe(crashState.destination);

      const recovered = await serviceFor(fixture).ensureReady(requestFor(fixture));
      expect(recovered.status).toBe('verified');
      expect(fs.existsSync(fixture.oldRoot)).toBe(false);
      expect(fs.existsSync(fixture.newRoot)).toBe(true);
      const rows = await fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('verified');
    } finally {
      await fixture.cleanup();
    }
  });

  test('source-only planned recovery recreates and revalidates a lost destination parent', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      await expect(serviceFor(fixture, 'after_planned').ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ name: 'ViewRelocationCrashError', point: 'after_planned' });
      fs.rmSync(path.dirname(fixture.newRoot), { recursive: true, force: true });

      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .resolves.toMatchObject({ status: 'verified' });
      expect(fs.existsSync(fixture.oldRoot)).toBe(false);
      expect(fs.existsSync(fixture.newRoot)).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  test('adopts a new-only tree without moving it', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.newRoot);
      const before = fs.statSync(fixture.newRoot);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture))).resolves.toMatchObject({
        status: 'verified',
      });
      const after = fs.statSync(fixture.newRoot);
      expect([after.dev, after.ino]).toEqual([before.dev, before.ino]);
      expect(fs.existsSync(fixture.oldRoot)).toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects an invalid new-only tree without adopting or moving it', async () => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.newRoot);
      fs.writeFileSync(path.join(capsule, 'manifest.md'), '---\nmetadata:\n  view-id: Invalid_ID\n---\n');
      const before = fs.statSync(fixture.newRoot);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_id_invalid' });
      const after = fs.statSync(fixture.newRoot);
      expect([after.dev, after.ino]).toEqual([before.dev, before.ino]);
      expect(fs.existsSync(fixture.oldRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects duplicate manifest keys in a new-only tree before adoption', async () => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.newRoot);
      fs.writeFileSync(
        path.join(capsule, 'manifest.md'),
        '---\nmetadata:\n  view-id: capture-viewer\n  view-id: file-viewer\n---\n',
      );
      const before = fs.statSync(fixture.newRoot);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_id_invalid' });
      const after = fs.statSync(fixture.newRoot);
      expect([after.dev, after.ino]).toEqual([before.dev, before.ino]);
      expect(fs.existsSync(fixture.oldRoot)).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('never chooses or merges when both roots exist', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot, { viewId: 'old-viewer' });
      writeCapsule(fixture.newRoot, { viewId: 'new-viewer' });
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'root_conflict' });
      expect(fs.existsSync(path.join(fixture.oldRoot, '001-example-viewer', 'manifest.md'))).toBe(true);
      expect(fs.existsSync(path.join(fixture.newRoot, '001-example-viewer', 'manifest.md'))).toBe(true);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('rejects neither by default and creates a verified empty canonical root only for explicit viewless policy', async () => {
    const rejected = await createFixture(null, 'neither-rejected');
    try {
      await expect(serviceFor(rejected).ensureReady(requestFor(rejected)))
        .rejects.toMatchObject({ code: 'viewless_not_allowed' });
      expect(fs.existsSync(rejected.newRoot)).toBe(false);
    } finally {
      await rejected.cleanup();
    }

    const accepted = await createFixture(null, 'neither-accepted');
    try {
      await expect(serviceFor(accepted).ensureReady(requestFor(accepted, { allowViewless: true })))
        .resolves.toMatchObject({ status: 'verified' });
      expect(fs.readdirSync(accepted.newRoot)).toEqual([]);
    } finally {
      await accepted.cleanup();
    }
  });

  test('viewless adoption rejects unsafe existing ancestry before creating external bytes', async () => {
    const fixture = await createFixture(null, 'neither-unsafe-ancestry');
    try {
      const externalAi = path.join(fixture.tempRoot, 'external-ai');
      fs.rmSync(path.join(fixture.projectRoot, 'ai'), { recursive: true, force: true });
      fs.mkdirSync(externalAi);
      fs.symlinkSync(externalAi, path.join(fixture.projectRoot, 'ai'));

      await expect(serviceFor(fixture).ensureReady(requestFor(fixture, { allowViewless: true })))
        .rejects.toMatchObject({ code: 'root_ancestor_invalid' });
      expect(fs.existsSync(path.join(externalAi, fixture.machineIdentity))).toBe(false);
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }))
        .resolves.toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('verified restart accepts legitimate state bytes and registry folder drift', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      const service = serviceFor(fixture);
      await service.ensureReady(requestFor(fixture));
      const original = path.join(fixture.newRoot, '001-example-viewer');
      const reordered = path.join(fixture.newRoot, '009-example-viewer');
      fs.renameSync(original, reordered);
      writeJson(path.join(reordered, 'state', 'state.json'), { changedAfterVerification: true });
      writeCapsule(fixture.newRoot, {
        folderName: '010-another-viewer',
        viewId: 'another-viewer',
      });

      await expect(service.ensureReady(requestFor(fixture))).resolves.toMatchObject({ status: 'verified' });
      const row = await fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }).first();
      expect(row.status).toBe('verified');
    } finally {
      await fixture.cleanup();
    }
  });

  test('marks nonterminal digest drift failed without deleting the source', async () => {
    const fixture = await createFixture();
    try {
      const capsule = writeCapsule(fixture.oldRoot);
      await expect(serviceFor(fixture, 'after_planned').ensureReady(requestFor(fixture))).rejects.toBeDefined();
      fs.writeFileSync(path.join(capsule, 'dirty-after-plan.txt'), 'host edit survives', 'utf8');
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'inventory_mismatch' });
      expect(fs.readFileSync(path.join(capsule, 'dirty-after-plan.txt'), 'utf8')).toBe('host edit survives');
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }).first())
        .resolves.toMatchObject({ status: 'failed', error_code: 'inventory_mismatch' });
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['both', (fixture) => fs.mkdirSync(fixture.newRoot, { recursive: true }), 'root_conflict'],
    ['neither', (fixture) => fs.renameSync(fixture.oldRoot, `${fixture.oldRoot}-preserved`), 'recovery_root_mismatch'],
  ])('fails planned recovery for %s without deleting either plausible copy', async (_name, mutate, code) => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      await expect(serviceFor(fixture, 'after_planned').ensureReady(requestFor(fixture))).rejects.toBeDefined();
      mutate(fixture);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture))).rejects.toMatchObject({ code });
      const row = await fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }).first();
      expect(row.status).toBe('failed');
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['journal root identity', 'after_planned', async (fixture) => {
      await fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId })
        .update({ destination_root_identity_sha256: 'e'.repeat(64) });
    }, 'root_identity_mismatch'],
    ['source directory inode', 'after_planned', async (fixture) => {
      fs.renameSync(fixture.oldRoot, `${fixture.oldRoot}-only-copy`);
      writeCapsule(fixture.oldRoot);
    }, 'directory_identity_mismatch'],
    ['destination digest', 'after_moved', async (fixture) => {
      fs.writeFileSync(path.join(fixture.newRoot, '001-example-viewer', 'after-move.txt'), 'drift', 'utf8');
    }, 'inventory_mismatch'],
    ['destination directory inode', 'after_rename_before_moved', async (fixture) => {
      fs.renameSync(fixture.newRoot, `${fixture.newRoot}-only-copy`);
      writeCapsule(fixture.newRoot);
    }, 'directory_identity_mismatch'],
  ])('marks nonterminal recovery failed for wrong %s without deleting the only copy', async (
    _name,
    crashPoint,
    mutate,
    code,
  ) => {
    const fixture = await createFixture(null, `wrong-${crashPoint}-${code}`);
    try {
      writeCapsule(fixture.oldRoot);
      await expect(serviceFor(fixture, crashPoint).ensureReady(requestFor(fixture))).rejects.toBeDefined();
      await mutate(fixture);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture))).rejects.toMatchObject({ code });
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }).first())
        .resolves.toMatchObject({ status: 'failed', error_code: code });
      expect(
        fs.existsSync(fixture.oldRoot)
        || fs.existsSync(fixture.newRoot)
        || fs.existsSync(`${fixture.oldRoot}-only-copy`)
        || fs.existsSync(`${fixture.newRoot}-only-copy`),
      ).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  test.each([
    ['root identity', async (fixture) => {
      await fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId })
        .update({ source_root_identity_sha256: 'f'.repeat(64) });
    }, 'root_identity_mismatch'],
    ['directory inode', async (fixture) => {
      const preserved = `${fixture.newRoot}-preserved`;
      fs.renameSync(fixture.newRoot, preserved);
      fs.mkdirSync(fixture.newRoot);
      writeCapsule(fixture.newRoot);
    }, 'directory_identity_mismatch'],
  ])('verified restart fails closed on wrong %s', async (_name, mutate, code) => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      await serviceFor(fixture).ensureReady(requestFor(fixture));
      await mutate(fixture);
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture))).rejects.toMatchObject({ code });
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }).first())
        .resolves.toMatchObject({ status: 'verified', error_code: null });
    } finally {
      await fixture.cleanup();
    }
  });

  test('verified restart rejects a reappearing retired root without merging or deleting either tree', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      await serviceFor(fixture).ensureReady(requestFor(fixture));
      writeCapsule(fixture.oldRoot, { viewId: 'retired-copy' });
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'root_conflict' });
      await expect(fixture.db('view_capsule_relocations').where({ workspace_id: fixture.workspaceId }).first())
        .resolves.toMatchObject({ status: 'verified', error_code: null });
      expect(fs.existsSync(fixture.oldRoot)).toBe(true);
      expect(fs.existsSync(fixture.newRoot)).toBe(true);
      fs.rmSync(fixture.oldRoot, { recursive: true, force: true });
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .resolves.toMatchObject({ status: 'verified' });
    } finally {
      await fixture.cleanup();
    }
  });

  test('verified restart validates the current canonical manifest identities', async () => {
    const fixture = await createFixture();
    try {
      writeCapsule(fixture.oldRoot);
      await serviceFor(fixture).ensureReady(requestFor(fixture));
      fs.writeFileSync(
        path.join(fixture.newRoot, '001-example-viewer', 'manifest.md'),
        '---\nmetadata:\n  view-id: INVALID\n---\n',
      );
      await expect(serviceFor(fixture).ensureReady(requestFor(fixture)))
        .rejects.toMatchObject({ code: 'view_id_invalid' });
    } finally {
      await fixture.cleanup();
    }
  });
});
