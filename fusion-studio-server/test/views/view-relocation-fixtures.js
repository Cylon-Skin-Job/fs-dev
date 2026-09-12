'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const knex = require('knex');

const { ViewRelocationCrashError } = require('../../lib/views/relocation-errors');
const { createViewRelocationService } = require('../../lib/views/relocation-service');

const MIGRATIONS_DIRECTORY = path.join(__dirname, '../../lib/db/migrations');
const MACHINE = 'Fixture-Machine';

function createDb() {
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
    migrations: { directory: MIGRATIONS_DIRECTORY },
  });
}

async function createFixture(t, name = 'workspace') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-view-relocation-'));
  const declaredProjectRoot = path.join(tempRoot, name);
  fs.mkdirSync(path.join(declaredProjectRoot, 'ai', MACHINE, 'System'), { recursive: true });
  const projectRoot = fs.realpathSync(declaredProjectRoot);
  const workspaceId = name.toLowerCase().replace(/[^a-z0-9]+/gu, '-') || 'workspace';
  const db = createDb();
  await db.migrate.latest();
  await db('workspaces').insert({
    id: workspaceId,
    label: name,
    icon: 'folder',
    description: null,
    repo_path: projectRoot,
    sort_order: 10,
    type: 'code',
    ribbon_visible: 1,
    ribbon_sort_order: 10,
  });
  return {
    db,
    machineIdentity: MACHINE,
    newRoot: path.join(projectRoot, 'ai', MACHINE, 'System', 'Views'),
    oldRoot: path.join(projectRoot, 'ai', MACHINE, 'Views'),
    projectRoot,
    tempRoot,
    workspaceId,
    async cleanup() {
      await db.destroy();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeCapsule(root, {
  folderName = '001-example-viewer',
  viewId = 'example-viewer',
  rootDeclaration = { type: 'none' },
  dataSource = 'none',
} = {}) {
  const capsule = path.join(root, folderName);
  fs.mkdirSync(path.join(capsule, 'state'), { recursive: true });
  fs.writeFileSync(path.join(capsule, 'manifest.md'), [
    '---',
    `name: ${JSON.stringify(viewId)}`,
    'metadata:',
    `  view-id: ${JSON.stringify(viewId)}`,
    `  data-source: ${JSON.stringify(dataSource)}`,
    '---',
    '',
  ].join('\n'), 'utf8');
  writeJson(path.join(capsule, 'content.json'), {
    version: 1,
    dataSource,
    root: rootDeclaration,
  });
  writeJson(path.join(capsule, 'state', 'state.json'), { dirty: `${viewId}-preserve` });
  return capsule;
}

function serviceFor(fixture, crashPoint = null) {
  return createViewRelocationService({
    db: fixture.db,
    crashInjector: async (point) => {
      if (point === crashPoint) throw new ViewRelocationCrashError(point);
    },
  });
}

function requestFor(fixture, overrides = {}) {
  return {
    workspaceId: fixture.workspaceId,
    machineIdentity: fixture.machineIdentity,
    projectRoot: fixture.projectRoot,
    ...overrides,
  };
}

module.exports = {
  MACHINE,
  createDb,
  createFixture,
  requestFor,
  serviceFor,
  writeCapsule,
  writeJson,
};
