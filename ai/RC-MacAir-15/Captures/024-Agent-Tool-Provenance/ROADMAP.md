# Agent Tool Provenance Continuation Roadmap

**Roadmap status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Execution model:** One dependency-ordered SPEC executed through the normal supervisor/orchestrator review loop

## 1. Milestone

Make every schema-valid current OpenCode terminal tool call observed by Fusion durable and granularly queryable, connect allowlisted workspace-file candidates to timestamped post-tool checkpoints, and prove that an OpenCode file edit refreshes an already-open File Viewer through the governed UEB firehose. The normalized model remains extensible, but no other production harness lifecycle or extractor is activated by this candidate.

This is a bounded continuation of `../023-MVP-Provenance-Subscriptions/`. It adds agent observation; it does not reopen permissions, external filesystem watching, general script execution, or complete chat provenance.

## 2. Ordered SPEC

| Order | SPEC | Delivers | Prerequisite |
|---:|---|---|---|
| 01 | [Agent Tool Activity and Resource Checkpoints](SPEC-01-AGENT-TOOL-PROVENANCE.md) | Normalized tool lifecycle rows, resource-access edges, safe deduplicated checkpoints, governed tool/observation facts, progressive query surfaces, and OpenCode-to-File-Viewer live proof | Owner-accepted 023 SPEC-04 implementation baseline |

## 3. Dependency Graph

```text
accepted 023 governed UEB + save provenance + File Viewer projection
  -> 01a normalized activity/checkpoint persistence
    -> 01b timestamped canonical harness capture + OpenCode extraction
      -> 01c final fact authority + two-fact event-ledger projection
        -> 01d resource observer + checkpoint fact + durable server projection
          -> 01e progressive query + exchange binding
            -> 01f File Viewer client integration + runtime proof
```

## 4. Authority And Standards

The exact owner decisions are in [DECISIONS.md](DECISIONS.md). The current implementation constraints are in [CODE-INVENTORY.md](CODE-INVENTORY.md). The execution and review rules are in [GUIDANCE.md](GUIDANCE.md).

Existing provenance-schema authority reconciled by this candidate:

- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/003-Provenance_Model/002-Tool_Call_Provenance_Schema/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/004-Ledger_Schema/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md`

Approval of this exact candidate provides only the narrow `TOOL-D01`/`TOOL-D02` overlay in ATP-D15, the bounded agent-checkpoint ULV overlay in ATP-D16, and the two-fact migration-029 `LED-D04` overlay in ATP-D17. The broader `chat.tool.started|args|result`, accepted-reference, provider-native-reference, captured-output, automation, graph/causal ledger, `file.version`, diff, restore, retention, and general versioning contracts remain open.

Applicable Code Standards authority:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- `001-Architecture_Routing/PAGE.md`
- `003-State_Management/PAGE.md`
- `004-WebSocket_Protocol/PAGE.md`
- `005-Universal_Event_Bus/PAGE.md`
- `006-Harness_Adapters/PAGE.md`
- `007-Persistence_And_Metadata/PAGE.md`
- `008-Testing_And_Smoke_Slices/PAGE.md`

No Code Standards supersession is approved. This continuation uses the trusted, locked built-in publisher/subscriber model already established by the predecessor roadmap.

## 5. Accepted Baseline

The owner accepted the completed 023 implementation in the controlling conversation. Before implementation begins, the supervisor must verify the predecessor product manifest remains the accepted 66-path aggregate:

`15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590`

The predecessor implementation is currently present as uncommitted work on `main`. That dirty state is not permission to rewrite or discard it. Any mismatch is a deviation to reconcile against the accepted implementation report, not a reason to reset the worktree.

## 6. Cross-SPEC Contracts

1. The normalized activity index records facts Fusion directly observes from the configured harness. It does not claim that a tool caused a later file state.
2. Every tool activity receives a host UUID plus the provider tool-call ID. Workspace, harness, thread, turn, and later exchange identity remain independently queryable.
3. Provider-reported start/end/envelope-emission time, Fusion receipt time, snapshot observation time, and exchange-save/bind time remain distinct.
4. Full arguments and results remain in the existing exchange record. The new index stores fingerprints, selected safe metadata, canonical resource edges, and a detail reference after exchange commit.
5. Resource checkpoints are post-tool observations. A prior checkpoint is a prior observed state, not a guaranteed preimage of the next tool.
6. Only regular, workspace-contained, NUL-free UTF-8 files at or below 10 MiB receive byte snapshots. Absent files receive an absent checkpoint. Other candidates receive bounded status/skip metadata without bytes.
7. Exact bytes are content-addressed and deduplicated. A new snapshot row is created only for the first observed state or when state differs from the latest checkpoint for that workspace path.
8. No filesystem watcher, polling service, directory scan, shell execution, glob expansion, or recursive discovery is introduced. Observation is bounded to candidates extracted at a tool boundary.
9. Structured tool extraction is field-specific. Shell extraction is conservative and literal-only. Variables, substitutions, dynamic expressions, glob expansion, and unrecognized script internals are not evaluated.
10. Only the exact OpenCode tool/field mappings in this candidate are activated for resource extraction. The lifecycle/index types provide an inert extension seam, but any new harness, tool name, or argument/result field mapping requires a separately owner-approved provenance SPEC and its own fixtures before activation, even if persistence/query schemas need no change.
11. Tool completion and new resource checkpoints become separately registered facts on the existing governed UEB. Observation jobs are claimable only after their tool fact is admitted. The observer receives only exact host capabilities to inspect persisted candidates, publish a durably reserved checkpoint fact, and create the dominant-edge projection job. The separate committed-job-bound renderer scheduler may emit strict v2 under admitted authority or identity-safe fallback; neither owner receives ambient database, filesystem, socket, session-map, generic-send, or generic-publisher access.
12. The existing File Viewer central Zustand store remains the rendering owner. Every successful eligible observation—including ATP-unchanged—atomically creates a durable stable-ID renderer-projection job that delivers a versioned invalidation/refetch or identity-safe fallback through the existing WebSocket under bounded at-least-once recovery. This prevents an intervening mediated save from making an ATP-unchanged state stale relative to the store, and it does not depend on whether a concurrent read or write established the checkpoint first.
13. Provenance is observational and fail-open for chat continuity. A persistence or delivery failure must be diagnosed and left in a truthful durable pending or terminal failure state under the SPEC's bounded retry policy; it must not retroactively claim the already-executed tool failed. Turn finalization persists/schedules provenance within its deadline but never waits for asynchronous file-observation retries.
14. Workspace isolation, exact schema validation, immutable locked seeds, scoped capabilities, stale epoch rejection, and isolated runtime testing remain mandatory.
15. Agent checkpoint work and the existing File Save Controller share one host-owned workspace/path serialization coordinator. This does not intercept agent execution; it prevents two Fusion-side provenance writers from racing their identity/checkpoint transactions.
16. Server-owned workspace/thread/turn/harness/root authority is frozen when the prompt is accepted and follows the harness turn through navigation changes, observation, finalization, exchange binding, and crash recovery. A private root digest plus paired device/inode identity when available is persisted on each activity and never exposed by public facts or queries.
17. Agent observation is drained from durable jobs with exact four-global/one-per-activity concurrency, one path per claim, a 16-installed-claim disposition batch cap, total two-second coordinator ownership, stale-result disposal, bounded retry/suppression/startup/shutdown, and save-priority non-queuing path acquisition. A single save-only priority handoff slot during active observation preserves the current one-active-plus-32-waiting save admission invariant without increasing capacity. Exchange binding likewise uses a singleton bounded batch drain with finite failure behavior. Backpressure leaves durable work truthfully pending or claimed/running for bounded recovery; it does not consume mediated-save waiter capacity or spawn detached filesystem work.
18. On supported macOS builds, decisive observation is descriptor-relative through one bundled asynchronous Node-API addon. It pins and verifies the captured root and each parent, uses no JavaScript pathname fallback, is included in the packaged server, and fails closed without checkpoint or registry mutation if unavailable.
19. Pending tool and observation facts share one deterministic bounded admission replay owner. It caps startup and yielded work, applies one delayed retry before exact-key suppression, recovers on restart, and never changes tool truth or republishes an already-admitted fact.
20. Workspace-root files use exact empty-string folder identity in storage and query responses; `.` and `/` are not aliases.
21. Candidate path admission is purely lexical against prompt-captured root authority. Active navigation and filesystem resolution never participate; missing and symlink states are decided by the secure observer.
22. Mid-turn terminal reservation has a two-second cancellation gate, five immediate zero-busy-wait attempts, no late mutation after cancellation, and a fixed fail-open continuation into legacy chat rendering.
23. Shutdown has one composable eight-second force envelope: turn/provenance/watcher owners quiesce concurrently, then subscriptions stop, then SQLite closes, with every timer cancelled before database close.
24. Locked runtime definitions are installed only in final form: both fact schemas and the two-fact ledger subscription in 01c; v2 server authority and the observer subscription together in 01d; client-only v2 integration in 01f.

## 7. First Confirmed Agent Test Case

1. Start an isolated server/profile and temporary workspace with OpenCode replaced by a deterministic canonical-event fixture at the adapter boundary; do not launch a real external harness.
2. Open a small UTF-8 file in the File Viewer and establish its initial central-store content.
3. Feed one OpenCode-shaped `edit` terminal snapshot with a provider tool-call ID, distinct valid `state.time.start`, `state.time.end`, and envelope `timestamp`, structured `filePath`, terminal result, and an actual fixture file change performed by the test harness fixture.
4. Verify one durable tool activity, one write-family resource edge, one post-tool snapshot, one admitted `agent.tool_completed@1` fact, and one admitted `resource.state_observed@1` fact.
5. Verify the File Viewer receives `resource:changed@2`, invalidates/refetches the canonical key, and displays the new text without menu refresh, remount, workspace switch, watcher delivery, or direct DOM mutation.
6. Query by path and confirm the activity is returned; constrain by thread and write family and confirm it remains; query read family and confirm it is excluded.
7. Commit the exchange and verify the activity is backfilled with `exchangeId`, the committed `exchangeSavedAt`, and a distinct later host `exchangeBoundAt` while all original lifecycle timestamps remain unchanged.
8. Run a second identical-state observation and verify the activity/edge is retained, the existing snapshot/blob is reused, no duplicate observation fact is emitted, and one idempotent `unchanged` renderer invalidation/refetch is emitted using the dominant edge identity.
9. Exercise bytes A → mediated save B → agent observation A with watchers disabled and verify the final `unchanged` ATP observation still refetches A into the File Viewer.

Negative acceptance includes out-of-workspace, symlink, parent swap-and-restore, unavailable secure observer, binary, oversized, malformed, dynamic-shell, duplicate-terminal, failed-tool-with-partial-change, interruption, stale workspace, bounded DB contention exhaustion, startup reconciliation, and simultaneous same-path activities.

## 8. Completion Gate

The continuation is complete only when SPEC-01 is owner-accepted after:

- all six slices complete their required builder and orchestrator clean-room cycles;
- server tests and client source/build tests pass;
- isolated OpenCode agent-edit-to-visible-File-Viewer proof passes;
- query examples for file/thread/read/write filters pass;
- the predecessor mediated-save proof still passes;
- no developer database, application profile, real workspace file, watcher, or real harness process participates in acceptance; and
- all deviations and effects on the next roadmap families are reported.
