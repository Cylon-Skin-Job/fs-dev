'use strict';

const digestCheck = (column) => `
  length(${column}) = 64 AND ${column} NOT GLOB '*[^0-9a-f]*'
`;
const timeCheck = (column) => `
  typeof(${column}) = 'integer' AND ${column} BETWEEN 0 AND 9007199254740991
`;
const decimalIdentityCheck = (column) => `
  length(${column}) BETWEEN 1 AND 20
  AND ${column} NOT GLOB '*[^0-9]*'
  AND (${column} = '0' OR substr(${column}, 1, 1) <> '0')
`;

exports.up = async function up(knex) {
  await knex.raw(`
    CREATE TABLE view_capsule_relocations (
      workspace_id TEXT NOT NULL
        REFERENCES workspaces(id) ON DELETE CASCADE
        CHECK (length(CAST(workspace_id AS BLOB)) BETWEEN 1 AND 128),
      machine_identity TEXT NOT NULL CHECK (
        length(CAST(machine_identity AS BLOB)) BETWEEN 1 AND 128
        AND machine_identity NOT IN ('.', '..')
        AND machine_identity NOT GLOB '*[^A-Za-z0-9._-]*'
      ),
      source_root_identity_sha256 TEXT NOT NULL CHECK (${digestCheck('source_root_identity_sha256')}),
      destination_root_identity_sha256 TEXT NOT NULL CHECK (${digestCheck('destination_root_identity_sha256')}),
      directory_device TEXT NOT NULL CHECK (${decimalIdentityCheck('directory_device')}),
      directory_inode TEXT NOT NULL CHECK (${decimalIdentityCheck('directory_inode')}),
      inventory_sha256 TEXT NOT NULL CHECK (${digestCheck('inventory_sha256')}),
      status TEXT NOT NULL CHECK (status IN ('planned', 'moved', 'verified', 'failed')),
      error_code TEXT CHECK (
        error_code IS NULL OR (
          length(CAST(error_code AS BLOB)) BETWEEN 1 AND 64
          AND error_code NOT GLOB '*[^a-z0-9_]*'
        )
      ),
      created_at INTEGER NOT NULL CHECK (${timeCheck('created_at')}),
      updated_at INTEGER NOT NULL CHECK (${timeCheck('updated_at')}),
      completed_at INTEGER CHECK (completed_at IS NULL OR (${timeCheck('completed_at')})),
      PRIMARY KEY (workspace_id, machine_identity),
      CHECK (updated_at >= created_at),
      CHECK (completed_at IS NULL OR completed_at >= created_at),
      CHECK (
        (status IN ('planned', 'moved') AND error_code IS NULL AND completed_at IS NULL)
        OR (status = 'verified' AND error_code IS NULL AND completed_at IS NOT NULL)
        OR (status = 'failed' AND error_code IS NOT NULL AND completed_at IS NOT NULL)
      )
    )
  `);
  await knex.raw(`
    CREATE INDEX view_capsule_relocations_status_idx
    ON view_capsule_relocations (status, updated_at)
  `);
};

exports.down = async function down(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS view_capsule_relocations_status_idx');
  await knex.schema.dropTableIfExists('view_capsule_relocations');
};
