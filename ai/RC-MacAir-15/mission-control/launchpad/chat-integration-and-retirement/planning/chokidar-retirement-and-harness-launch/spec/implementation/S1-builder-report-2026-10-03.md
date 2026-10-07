# S1 Builder Report — Stop `file:changed` Ledger Recording

- **Handoff:** `READY_FOR_ORCHESTRATOR_REVIEW`
- **Assigned work:** `CHAT-AR-SPEC-01`, slice S1 only
- **Builder task:** `/root/slice_s1` (subtask of orchestrator `/root`)
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory CWD:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Implementation checkout:** `/Users/rccurtrightjr./projects/fs-dev`
- **Branch / refreshed HEAD:** `agent/exact-workspace-paths` / `d15792920731f85e45b743519d4af2b807d95a9c`
- **Normative SPEC SHA-256:** `bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3` (matches approved artifact)
- **Approved candidate:** `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`

## Changed files

- `fusion-studio-server/lib/ledger/event-ledger.js`
- `fusion-studio-server/test/ledger/event-ledger.test.js`

The ledger whitelist now contains only `workspace:switched` and `thread:state_changed`. Removed file-change-specific actor fallback, source, summary, tag, and resource-edge mappings after an S1 ledger/test source sweep found no separate ledger writer depending on those mappings. The public event bus remains unchanged. `event-ledger-subscriber.js` remains unchanged, including wildcard subscription and its in-flight drain lifecycle.

## Acceptance mapping and checks

- Direct `recordEvent` of `file:changed` returns `null`; test asserts zero `event_log`, `event_resource_edges`, and `event_tags` rows.
- Subscriber test emits `workspace:switched`, `thread:state_changed`, `file:changed`, and an unrelated settings event. It verifies exactly the workspace and thread rows persist, with their two expected tags and no resource edges.
- Direct thread persistence and existing direct workspace persistence are asserted.
- The existing held-write shutdown-drain test is preserved and passes.
- Required command from `fusion-studio-server/`: `npx jest --runInBand --runTestsByPath test/ledger/event-ledger.test.js` — **PASS**, 1 suite / 5 tests.
- `git diff --check -- fusion-studio-server/lib/ledger/event-ledger.js fusion-studio-server/test/ledger/event-ledger.test.js` — **PASS**, no output.
- Residual `file:changed` ledger/test references are limited to the negative assertions in tests; no ledger mapping branch or whitelist entry remains.
- Test runner emitted Node warning: `--localstorage-file` was provided without a valid path. The suite passed; this warning was not investigated because it is unrelated to S1.

S1 requires no app startup, server smoke, Electron runtime, schema migration, or public chat run; those checks are not applicable to this slice and remain for later assigned gates.

## Self-review, review gate, and lifecycle

Self-review confirmed the guard in `recordEvent` and the wildcard subscriber use the same whitelist, so ignored events cannot query identity or write the event row, resource edges, or tags. The shared bus and drain code are untouched. `git diff --check` passed.

One fresh read-only clean-room reviewer, `/root/slice_s1/s1_review`, returned **CLEAN**, with no material findings or advisories. It independently checked current diff, S1 criteria, focused test evidence, wildcard lifecycle, and held-write drain. Reviewer is terminal (`completed`). No `close_agent` tool is available in this runtime; terminal status is recorded here.

## Deviations and downstream impact

- **SPEC deviation:** none.
- **Out-of-scope touches:** none. Only the two S1 expected files were changed.
- **Proposed classification:** no deviations to classify.
- **Downstream:** future S3 removal of the Chokidar producer does not change this S1 whitelist behavior. S4 Wiki updates must align legacy-ledger documentation with this implementation; no Wiki source was edited during S1.

## Residual risks / skipped checks

S1 proves ledger behavior, not Chokidar retirement or chat success. S2–S4 remain necessary for their assigned behavior, integration, documentation and runtime acceptance. No Git publication, Alpha operation, database edit, or unrelated verification was performed.
