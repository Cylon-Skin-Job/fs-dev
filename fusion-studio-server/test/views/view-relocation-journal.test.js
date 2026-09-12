'use strict';

const migration = require('../../lib/db/migrations/038_view_capsule_relocation_journal');
const { createDb, createFixture } = require('./view-relocation-fixtures');

describe('view capsule relocation journal migration', () => {
  async function expectConstraint(query) {
    let error = null;
    try {
      await query;
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/constraint/i);
  }

  test('enforces one bounded state row per workspace and machine in the current schema', async () => {
    const fixture = await createFixture();
    try {
      const completed = await fixture.db('knex_migrations').orderBy('id').pluck('name');
      expect(completed.at(-1)).toBe('039_system_wiki_canonical_view_path.js');
      const base = {
        workspace_id: fixture.workspaceId,
        machine_identity: fixture.machineIdentity,
        source_root_identity_sha256: 'a'.repeat(64),
        destination_root_identity_sha256: 'b'.repeat(64),
        directory_device: '1',
        directory_inode: '2',
        inventory_sha256: 'c'.repeat(64),
        status: 'planned',
        error_code: null,
        created_at: 10,
        updated_at: 10,
        completed_at: null,
      };
      await fixture.db('view_capsule_relocations').insert(base);
      await expectConstraint(fixture.db('view_capsule_relocations').insert(base));
      await expectConstraint(fixture.db('view_capsule_relocations').insert({
        ...base,
        machine_identity: 'Other-Machine',
        status: 'verified',
        completed_at: null,
      }));
      await expectConstraint(fixture.db('view_capsule_relocations').insert({
        ...base,
        machine_identity: 'Third-Machine',
        status: 'failed',
        error_code: 'PATH:/private/secret',
        completed_at: 11,
      }));
    } finally {
      await fixture.cleanup();
    }
  });

  test('round-trips down and up without touching workspace rows', async () => {
    const db = createDb();
    try {
      await db.migrate.latest();
      const before = await db('workspaces').count({ count: '*' }).first();
      await migration.down(db);
      await expect(db.schema.hasTable('view_capsule_relocations')).resolves.toBe(false);
      await migration.up(db);
      await expect(db.schema.hasTable('view_capsule_relocations')).resolves.toBe(true);
      await expect(db('workspaces').count({ count: '*' }).first()).resolves.toEqual(before);
    } finally {
      await db.destroy();
    }
  });
});
