# Slack Extrication Orchestration

## Objective

Remove the Slack Liaison experiment surgically without reverting unrelated branch work.

Default scope:

- Remove Slack backend/runtime modules, tests, migration, setup CLI, docs, and handoffs.
- Remove the Fusion Liaison mock UI from the client.
- Preserve unrelated branch changes.
- Preserve the System Viewer Secrets Manager tab for now unless a later decision says otherwise.

## Critical Constraints

- Do not run `git reset`, `git checkout --`, or broad revert commands.
- Do not modify unrelated dirty files except for exact Slack/Liaison line removal.
- Do not commit.
- `server.js` should not be touched for Slack cleanup; current `server.js` diffs are unrelated.
- Preserve unrelated package changes, especially `@huggingface/transformers`.
- Treat `package-lock.json` carefully; remove only Slack dependency effects.
- Do not treat untracked `fusion-studio-client/release/` packaged copies as source cleanup targets. Exclude release artifacts from final source searches unless we explicitly decide to regenerate/remove the whole release artifact separately.

## Active Slice Queue

Run one handoff at a time, then review before continuing.

### Slice 0: Preflight Inventory

Handoff:

```text
docs/handoffs/2026-06-05-slack-extrication-slice-0-preflight-inventory.md
```

Purpose:

- Produce an exact removal manifest before deleting anything.
- Confirm which dirty files are unrelated and must be preserved.
- Confirm no Slack changes exist in `server.js`.

Review result:

- Accepted as report-only preflight.
- Confirmed `fusion-studio-client/release/` is untracked and contains packaged copies with Slack references; this is not isolated Slack source work and should be excluded from source cleanup searches unless handled as a separate release-artifact task.
- Confirmed package cleanup must preserve unrelated dependency changes in `fusion-studio-server/package.json` and `package-lock.json`.
- Confirmed `server.js` should remain out of Slack cleanup scope.

Status: ACCEPTED

### Slice 1: Backend Runtime Removal

Handoff:

```text
docs/handoffs/2026-06-05-slack-extrication-slice-1-backend-runtime-removal.md
```

Purpose:

- Delete isolated Slack backend files.
- Remove the Slack startup hook from `lib/startup.js` only.
- Leave package dependency cleanup for Slice 3.

Review result:

- Accepted. Worker reported Slice 1 was already effectively implemented in the working tree.
- Confirmed isolated backend Slack targets were absent.
- Confirmed `fusion-studio-server/lib/startup.js` has no `startSlackLiaison` import or call.
- Confirmed `fusion-studio-server/server.js` and package files were not touched.
- Validation passed: `node --check fusion-studio-server/lib/startup.js`, targeted `git diff --check`, backend Slack searches.
- Remaining Slack references are only coordination/search instructions in extrication handoff docs.

Status: ACCEPTED

### Slice 2: Frontend Liaison Mock Removal

Handoff:

```text
docs/handoffs/2026-06-05-slack-extrication-slice-2-frontend-liaison-removal.md
```

Purpose:

- Delete the static Liaison mock UI.
- Remove only Liaison import/state/buttons/rendering from `App.tsx`.

Review result:

- Accepted. Worker deleted `fusion-studio-client/src/components/Liaison/`.
- Removed Liaison import, state, three header buttons, and three overlay renders from `App.tsx`.
- Removed orphaned `.rv-liaison-icon-btn` styles from `App.css`.
- Validation passed: targeted `git diff --check` and source search for `LiaisonOverlay`, `Fusion Liaison`, and `rv-liaison`.
- Client build was skipped because `fusion-studio-client/node_modules` is not installed.
- Remaining references are coordination documentation only.

Status: ACCEPTED

### Slice 3: Package Dependency Cleanup

Handoff:

```text
docs/handoffs/2026-06-05-slack-extrication-slice-3-package-cleanup.md
```

Purpose:

- Remove `@slack/bolt` from package files.
- Preserve unrelated dependency changes.

Review result:

- Accepted. Worker removed `@slack/bolt` from `fusion-studio-server/package.json` and `package-lock.json`.
- Confirmed `@huggingface/transformers` was preserved in both package files.
- Confirmed no remaining `@slack/bolt` or `@slack/` package references.
- Validation passed: package JSON parse check and targeted `git diff --check`.
- `npm uninstall @slack/bolt --package-lock-only --ignore-scripts` reported existing audit findings; no `npm audit fix` was run.

Status: ACCEPTED

### Slice 4: Final Search And Validation

Handoff:

```text
docs/handoffs/2026-06-05-slack-extrication-slice-4-final-validation.md
```

Purpose:

- Search for Slack/Liaison leftovers.
- Run targeted checks/builds.
- Report any remaining intentional references, such as System Viewer Secrets Manager planning content.

Review result:

- Accepted. Final validation reports the repo is Slack-runtime-clean, excluding `fusion-studio-client/release/` as required.
- Confirmed no `NEEDS_REMOVAL` Slack/Liaison matches remain in runtime source, client source, server tests, rebuilt client `dist`, or package dependencies.
- Remaining intentional references are coordination/planning docs, System Viewer Secrets Manager planning content, System Source Files wiki planning content, and the migration 024 tombstone repair documentation.
- Remaining unrelated references include clipboard token-detection examples, generic Gemini MCP parser tests, and miscellaneous planning handoff context.
- `npm test -- --runInBand` in `fusion-studio-server` passed: 34 suites, 445 tests passed, 1 skipped.
- `npm run build` in `fusion-studio-client` passed.
- Repo-wide `git diff --check` failed only on unrelated trailing whitespace in `fusion-studio-server/lib/transcription/index.js:287`.
- Rebuilt `fusion-studio-client/dist` has no Slack/Liaison references.

Status: ACCEPTED / COMPLETE

## Final Status

Slack runtime/code extrication is complete.

Known follow-ups outside this cleanup scope:

- Optional: fix unrelated trailing whitespace in `fusion-studio-server/lib/transcription/index.js:287`.
- Optional: keep the no-op `024_slack_liaison_foundation.js` tombstone migration because local databases may already have recorded that filename in the Knex ledger.

## Review Checklist

After each worker slice:

- Inspect `git status --short`.
- Inspect `git diff --name-only` for scope creep.
- Inspect touched files only.
- Confirm unrelated dirty files were not reverted.
- Confirm validation commands passed or failures are explained.
- Update the next slice if the previous result changes the plan.
