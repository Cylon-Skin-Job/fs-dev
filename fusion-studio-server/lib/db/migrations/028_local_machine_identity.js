/**
 * Migration 028 — Local machine identity
 *
 * Stores the filesystem-safe local machine name that owns ai/<machine>/.
 * The value lives in protected fusion.db and is cached at server startup.
 */

exports.up = async function (knex) {
  const os = require('os');

  const machineName = String(os.hostname() || 'local-machine')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'local-machine';

  await knex('system_config')
    .insert({
      key: 'local_machine_name',
      value: machineName,
      updated_at: Date.now(),
    })
    .onConflict('key')
    .ignore();
};

exports.down = async function (knex) {
  await knex('system_config').where('key', 'local_machine_name').del();
};
