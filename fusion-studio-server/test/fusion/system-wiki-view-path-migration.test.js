'use strict';

const path = require('path');
const knex = require('knex');
const initialMigration = require('../../lib/db/migrations/001_initial');
const systemPanelMigration = require('../../lib/db/migrations/002_system_panel');
const workspaceThemesMigration = require('../../lib/db/migrations/003_workspace_themes');
const wikiUpdateMigration = require('../../lib/db/migrations/004_secrets_wiki_update');
const migration = require('../../lib/db/migrations/039_system_wiki_canonical_view_path');
const { getWikiPage } = require('../../lib/fusion/queries');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');

function createDb({ migrations = false } = {}) {
  return knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate(connection, done) {
        connection.pragma('foreign_keys = ON');
        done(null, connection);
      },
    },
    ...(migrations ? { migrations: { directory: MIGRATIONS_DIRECTORY } } : {}),
  });
}

describe('system wiki canonical view path migration', () => {
  let db;

  afterEach(async () => {
    if (db) {
      await db.destroy();
      db = null;
    }
  });

  test('repairs only the exact active customization context from a pre-039 database', async () => {
    db = createDb();
    await initialMigration.up(db);
    await systemPanelMigration.up(db);
    await workspaceThemesMigration.up(db);
    await wikiUpdateMigration.up(db);

    const unrelatedBefore = await db('system_wiki')
      .whereNot('slug', 'customization')
      .orderBy('slug');
    const seeded = await getWikiPage(db, 'customization');
    expect(seeded.context).toContain(migration.RETIRED_VIEW_THEME_PATH);
    expect(seeded.context).not.toContain(migration.CANONICAL_VIEW_THEME_PATH);

    await migration.up(db);

    const repaired = await getWikiPage(db, 'customization');
    expect(repaired.context).not.toContain(migration.RETIRED_VIEW_THEME_PATH);
    expect(repaired.context.match(new RegExp(migration.CANONICAL_VIEW_THEME_PATH.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'gu'))).toHaveLength(2);
    await expect(db('system_wiki').whereNot('slug', 'customization').orderBy('slug'))
      .resolves.toEqual(unrelatedBefore);

    const firstRepair = repaired;
    await migration.up(db);
    await expect(getWikiPage(db, 'customization')).resolves.toEqual(firstRepair);
  });

  test('fresh databases expose only the canonical path through the active Fusion query', async () => {
    db = createDb({ migrations: true });
    const [, completed] = await db.migrate.latest();

    expect(completed.at(-1)).toMatch(/039_system_wiki_canonical_view_path\.js$/u);
    const page = await getWikiPage(db, 'customization');
    expect(page.context).toContain(migration.CANONICAL_VIEW_THEME_PATH);
    expect(page.context).not.toContain(migration.RETIRED_VIEW_THEME_PATH);
  });
});
