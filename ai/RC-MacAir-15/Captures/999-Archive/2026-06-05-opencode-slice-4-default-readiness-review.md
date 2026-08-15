# OpenCode Slice 4: Default Readiness Review

## Objective

Review the OpenCode opt-in harness implementation before we decide whether to make OpenCode the default harness for newly created threads.

This is a review-only handoff. Do not edit files.

## Context

OpenCode is currently registered and working as an opt-in harness via:

```json
{ "harnessId": "opencode" }
```

Live Fusion runtime smoke passed:

- Plain text prompt streamed and persisted.
- Tool call normalized to canonical `shell` and persisted.
- Stop produced an interrupted terminal turn.
- Follow-up prompt after stop worked.
- Kimi/default behavior remained unchanged.

We are considering accepting the current per-prompt `opencode run --format json` implementation as the temporary default runtime, with OpenCode ACP/server mode deferred as a later optimization.

## Required Reading

- `ai/<machine>/Wiki/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-05-opencode-slice-1-json-run-translator-preflight.md`
- `docs/handoffs/2026-06-05-opencode-slice-2-json-run-harness-skeleton.md`
- `docs/handoffs/2026-06-05-opencode-slice-3-opt-in-runtime-smoke.md`

## Review Scope

Review only:

```text
fusion-studio-server/lib/harness/opencode/
fusion-studio-server/test/harness/opencode/
fusion-studio-server/lib/harness/registry.js
```

Do not review unrelated dirty worktree files unless they directly affect OpenCode harness selection.

## Hard Boundaries

Do not edit files.

Do not touch:

- Electron packaging
- client UI
- Kimi harness
- Slack removal
- thread runtime architecture
- server.js refactors
- package files

Do not make OpenCode default in this review.

## Review Questions

Prioritize findings that would block making OpenCode the default for newly created threads.

Look for:

- async generator lifecycle bugs
- process stop/exit races
- parser brittleness
- malformed NDJSON behavior
- command argument issues
- config/env handling issues
- default model/provider assumptions
- `--dangerously-skip-permissions` risk
- canonical event shape mismatches
- persistence/turn-end risks
- tests that are misleading, hollow, or insufficient
- code standards violations
- brittleness introduced by per-prompt `opencode run`

## Known Non-Blocking Notes

The current implementation is intentionally per-prompt JSON-run, not OpenCode ACP/server mode.

Do not mark “not ACP” as a blocker unless you find a concrete user-visible failure or architectural incompatibility.

The current default is still Kimi. That is expected.

## Suggested Commands

From repo root:

```bash
sed -n '1,260p' fusion-studio-server/lib/harness/opencode/index.js
sed -n '1,220p' fusion-studio-server/lib/harness/opencode/json-event-translator.js
sed -n '1,180p' fusion-studio-server/lib/harness/opencode/json-line-parser.js
sed -n '1,340p' fusion-studio-server/test/harness/opencode/harness-send-message.test.js
sed -n '1,280p' fusion-studio-server/test/harness/opencode/json-event-translator.test.js
git diff -- fusion-studio-server/lib/harness/registry.js
```

Optional validation, if you want to confirm the reported baseline:

```bash
cd fusion-studio-server
npm test -- --runInBand lib/harness/opencode test/harness/opencode
npm test -- --runInBand test/thread/thread-runtime-controller.test.js test/wire/canonical-harness-event-bridge.test.js
```

## Output Format

Return findings first, ordered by severity.

Use this format:

```text
Findings
1. [Severity] file:line — title
   Explanation and concrete risk.
   Suggested fix, if any.

Open Questions
- ...

Default Switch Recommendation
- BLOCK / PROCEED / PROCEED WITH SMALL CLEANUP
- Short rationale.

Validation Run
- Commands run and results, or "not run".

Scope Notes
- Confirm no files were edited.
```

If no issues are found, say that clearly and identify any residual risk from using per-prompt JSON-run as the temporary default.

## Acceptance Criteria

- Review is limited to OpenCode harness/default-readiness scope.
- Findings include file/line references.
- Recommendation explicitly says whether a default-switch slice should proceed.
- No files are edited.
