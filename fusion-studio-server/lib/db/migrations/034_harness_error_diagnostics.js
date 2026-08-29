/**
 * Migration 034 - Harness error diagnostics
 *
 * Dedicated table for redacted harness failure diagnostic reports
 * (RCC-0108 SPEC-03 Slice C; parent §4.13.1; owner decisions R5/R5A/R8).
 *
 * This is a fresh createTable: no existing-table rebuild, so no FK pragma
 * handling is needed (unlike some older SQLite rebuild migrations).
 *
 * The table is deliberately standalone — it does NOT reference event_log,
 * exchanges, or any assistant-part structure (R8: focused operational
 * service, not a canonical ledger write). Rows are bound to the
 * authoritative workspace/thread/turn identity as plain text columns so
 * diagnostic retention/cleanup never cascades into chat history.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('harness_error_diagnostics', (t) => {
    // Server-generated UUID lookup reference (opaque to clients).
    t.text('diagnostic_id').primary();
    // Authoritative prompt-bound identity — exact-match retrieval ownership.
    t.text('workspace_id').notNullable();
    t.text('thread_id').notNullable();
    t.text('turn_id').notNullable();
    // Serialized validated HarnessDiagnosticCandidateV1 report (≤24 KiB).
    t.text('report_json').notNullable();
    // Creation timestamp (ms epoch) — oldest-first eviction ordering.
    t.integer('created_at').notNullable();
    // Expiry timestamp (ms epoch) — 30-day retention purge boundary.
    t.integer('expires_at').notNullable();

    t.index(['workspace_id', 'created_at']); // per-workspace cap eviction
    t.index(['created_at']); // global cap eviction (oldest-first)
    t.index(['expires_at']); // expiry purge
    t.index(['workspace_id', 'thread_id', 'turn_id', 'diagnostic_id']); // exact retrieval
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('harness_error_diagnostics');
};
