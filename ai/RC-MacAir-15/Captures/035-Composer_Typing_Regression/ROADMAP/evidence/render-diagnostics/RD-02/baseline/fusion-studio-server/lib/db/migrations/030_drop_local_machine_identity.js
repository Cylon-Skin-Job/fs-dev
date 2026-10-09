/**
 * Migration 030 — Drop obsolete local machine fingerprint identity
 *
 * The active machine namespace is the folder-safe local_machine_name. The
 * prototype local_machine_identity JSON blob tried to preserve a stable
 * machine fingerprint, but folder renames are explicit user intent and should
 * not be overridden by a hidden identity record.
 */

exports.up = async function (knex) {
  await knex('system_config').where('key', 'local_machine_identity').del();
};

exports.down = async function () {
  // Intentionally no-op. The retired fingerprint payload cannot be rebuilt.
};
