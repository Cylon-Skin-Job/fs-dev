/**
 * Migration 024 — Slack liaison foundation tombstone
 *
 * Slack liaison runtime was removed after this migration had already been
 * recorded in local databases. Keep this filename so Knex migration validation
 * can reconcile existing migration history. New databases intentionally do not
 * create Slack tables.
 */

exports.up = async function () {};
exports.down = async function () {};
