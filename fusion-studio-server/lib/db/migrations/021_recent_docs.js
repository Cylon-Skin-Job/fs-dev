/**
 * Migration 021 — Deprecated recent-docs compatibility marker
 *
 * The old DB-backed Office recents feature was replaced by per-view activity
 * state. Keep this migration file so existing databases with migration 021 in
 * knex_migrations do not fail migration validation.
 */

exports.up = async function () {};

exports.down = async function () {};
