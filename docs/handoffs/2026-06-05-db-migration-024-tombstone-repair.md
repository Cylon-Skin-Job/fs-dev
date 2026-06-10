# DB Slice: Restore Missing Migration 024 Tombstone

## Objective

Repair Knex migration-history validation so Fusion can start again.

Current live smoke is blocked by:

```text
The migration directory is corrupt, the following files are missing: 024_slack_liaison_foundation.js
```

The Slack runtime was intentionally removed by Slack extrication work, but deleting an already-applied migration file breaks Knex validation for databases that have `024_slack_liaison_foundation.js` recorded in migration history.

## Required Reading

- `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-05-slack-extrication-slice-1-backend-runtime-removal.md`
- `docs/handoffs/2026-06-05-opencode-slice-3-opt-in-runtime-smoke.md`
- `fusion-studio-server/lib/db/migrations/023_bookmarks.js`
- `fusion-studio-server/lib/db/migrations/025_workspace_ribbon_membership.js`

## Current Evidence

Filesystem currently has:

```text
023_bookmarks.js
025_workspace_ribbon_membership.js
```

It does not have:

```text
024_slack_liaison_foundation.js
```

`025_workspace_ribbon_membership.js` is currently untracked in the dirty worktree. Do not revert it.

## Scope

Add back exactly this file:

```text
fusion-studio-server/lib/db/migrations/024_slack_liaison_foundation.js
```

Make it a tombstone/no-op migration. It exists only to preserve Knex migration history after Slack runtime removal.

Recommended contents:

```js
/**
 * Migration 024 — Slack liaison foundation tombstone
 *
 * The Slack liaison runtime was removed after this migration had already been
 * recorded in local databases. Keep this filename so Knex migration validation
 * can reconcile existing migration history. New databases intentionally do not
 * create Slack tables.
 */

exports.up = async function () {};

exports.down = async function () {};
```

Keep the comment concise. This is one of the few acceptable “tombstone” cases because migration filenames are durable database ledger entries, not dead runtime code.

## Do Not Touch

Do not restore Slack runtime code.

Do not restore Slack tests.

Do not restore Slack package dependencies.

Do not touch Electron packaging files.

Do not edit OpenCode harness files unless rerunning the smoke exposes a separate direct OpenCode issue.

## Validation

From repo root:

```bash
node --check fusion-studio-server/lib/db/migrations/024_slack_liaison_foundation.js
git diff --check -- fusion-studio-server/lib/db/migrations/024_slack_liaison_foundation.js
```

Then confirm server startup no longer fails on missing migration.

Preferred:

```bash
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

If Electron launch still fails with packaging errors, do not repair packaging here. Confirm whether the server started and report the URL if available.

If direct server start is used, capture the startup result and specifically report whether the missing migration error is gone.

## After Repair

If the server starts, rerun OpenCode Slice 3 smoke paths A/B/C from:

```text
docs/handoffs/2026-06-05-opencode-slice-3-opt-in-runtime-smoke.md
```

If the OpenCode smoke exposes a new runtime issue, patch only the narrow files allowed by the OpenCode Slice 3 handoff.

## Acceptance Criteria

- `024_slack_liaison_foundation.js` exists again.
- It is a no-op tombstone; no Slack tables are created for fresh databases.
- Knex no longer reports a missing migration file.
- Slack runtime remains removed.
- OpenCode smoke is rerun if server startup is restored.
- No Electron packaging files changed.

## Result Report Format

Return:

- files changed
- exact migration contents summary
- startup result
- whether the missing migration error is gone
- OpenCode Slice 3 smoke result, if rerun
- tests/checks run
- `git diff --check` result
- blockers/follow-up
