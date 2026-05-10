/**
 * No-op stub retained for Knex migration-list validation.
 *
 * The original migration (from the retired CLI_COLOR_OVERRIDE_SPEC) created
 * the `harness_theme` table. That table is dropped by 012_drop_harness_theme.
 * Knex refuses to start if a recorded migration's file is missing on disk,
 * so this file stays as a no-op rather than being deleted outright.
 *
 * See docs/CLI_CONFIG_SPEC.md §10b for context.
 */

exports.up = async function () {
  // no-op; 012 handles cleanup for environments that ran this migration
  // when it contained the original createTable + seed logic.
};

exports.down = async function () {
  // no-op
};
