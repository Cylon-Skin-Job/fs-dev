# SPEC-01 — Agent Tool Activity and Resource Checkpoints

**Status:** `CANDIDATE — OWNER APPROVAL REQUIRED`  
**Mission:** Persist granular agent tool activity, attach bounded workspace-resource observations and safe post-tool checkpoints, expose progressive metadata queries, and prove an OpenCode edit refreshes File Viewer through the governed UEB.

## 1. Authority And Accepted Baseline

Authoritative packet:

- `ROADMAP.md`
- `DECISIONS.md`
- `ISSUES.md`
- `CODE-INVENTORY.md`
- `GUIDANCE.md`
- this SPEC
- exact approved `RELEASE-MANIFEST.md`

Existing provenance/versioning/ledger authority reconciled by ATP-D15 through ATP-D17:

- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/003-Provenance_Model/002-Tool_Call_Provenance_Schema/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/003-Provenance_Model/004-Ledger_Event_Provenance_Schema/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/004-Ledger_Schema/PAGE.md`
- `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/006-File_Versioning/PAGE.md`

This SPEC's approval supplies narrow overlays only for its observational activity/index/fact contract, bounded agent-checkpoint/blob store, and exact migration-029 projections of its two admitted facts. It chooses full exact eligible snapshots and no diffs only for that store. It does not activate the broader Wiki candidate for `chat.tool.started|args|result`, accepted references, provider-native references, captured-output artifacts, graph/causal ledger edges, canonical `file.version`, diffs, restore, retention machinery, or general versioning.

Prerequisite: owner-accepted implementation of `../023-MVP-Provenance-Subscriptions/SPEC-04-FILE-VIEWER-LIVE-RENDER.md`, verified against its accepted 66-path aggregate `15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590` or reconciled as an explicit baseline deviation.

Applicable Code Standards:

- Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`
- `001-Architecture_Routing/PAGE.md`
- `003-State_Management/PAGE.md`
- `004-WebSocket_Protocol/PAGE.md`
- `005-Universal_Event_Bus/PAGE.md`
- `006-Harness_Adapters/PAGE.md`
- `007-Persistence_And_Metadata/PAGE.md`
- `008-Testing_And_Smoke_Slices/PAGE.md`
- Approved supersessions: none.

## 2. Observable Outcome

After an agent tool call is observed by Fusion:

- the tool lifecycle is queryable independently from its exchange JSON;
- IDs and timestamps connect workspace, harness, thread, turn, eventual exchange, provider call, and candidate resources;
- recognized workspace file candidates have classified access edges;
- eligible candidate state is observed after terminal/error/interruption boundaries and checkpointed only when new;
- raw arguments/results and snapshot bytes stay hidden behind progressive detail boundaries;
- a relevant new agent observation reaches the already-open File Viewer through the governed UEB, existing WebSocket, and central Zustand store; and
- no menu refresh, component remount, watcher event, new event service, or execution-permission hook is required.

Example queries supported by the repository and typed public protocol:

- all agent tool calls that touched `src/app.ts`;
- write-family edges for `src/app.ts` in one thread;
- read-family edges for `src/app.ts` across every thread in the workspace;
- all resource edges below `src/components/`;
- one provider tool-call ID, Fusion activity ID, turn ID, or exchange ID;
- changed observations within a bounded time range.

## 3. Scope

In scope:

- every schema-valid current OpenCode terminal ToolPart Fusion receives; malformed or over-bound identity is diagnosed and omitted from the new provenance index without blocking chat; synthetic incremental lifecycle fixtures exercise the generic repository seam, but no other production harness lifecycle is activated;
- durable tool identity/status/timing/fingerprints even when no resource candidate is found;
- OpenCode resource extraction for structured `read`, `write`, and `edit` tools plus conservative `shell` parsing;
- an inert versioned adapter-resource-hint seam; only this candidate's exact OpenCode mappings are active, and later harness/tool/field extraction requires a separate owner-approved provenance SPEC;
- workspace-contained regular file and absent-path observations;
- normalized metadata/query indexes and exchange binding;
- governed tool-completed and resource-state-observed facts;
- shared event-ledger projections for those facts;
- File Viewer live invalidation/refetch from new observation facts;
- interrupted/error/duplicate/crash-recovery behavior;
- isolated source, unit, integration, and runtime proof.

## 4. Non-Goals

- Hooking or enforcing OpenCode permissions or tool rights.
- Preventing, approving, proxying, or executing harness tools.
- Watching the filesystem or attributing unbound external changes.
- Provenance for user buttons, typing, UI save, triggers, scripts, package tasks, workers, plugins, connectors, or system integrations.
- Recursive shell evaluation, variable expansion, command substitution, glob expansion, `sh -c` descent, child-process tracing, or package-script inspection.
- Raw-argument, command-text, tool-output, snapshot-byte, or diff search APIs.
- Full chat-message normalization, semantic search, causal confidence, authorship verdicts, or evidence booleans.
- Binary/large-file versioning, retention/pruning, restore commands, restore UI, or Git integration.
- Retrofitting historical exchanges into the new index.
- Updating the product Wiki in this SPEC.

## 5. Terminology And Truth Rules

- **Activity:** one Fusion-owned record for one provider tool-call ID within a workspace/thread/turn.
- **Reported time:** a valid integer millisecond timestamp supplied by the harness/provider.
- **Observed time:** `Date.now()` captured by the Fusion server as it receives or inspects something.
- **Candidate:** an adapter- or shell-extractor result that might identify a workspace resource.
- **Resource edge:** a durable classification connecting an activity to an accepted canonical path or to a fingerprinted rejected candidate.
- **Checkpoint:** the first or a changed eligible `bytes|absent` state observed at a tool boundary.
- **Prior observation:** the previous checkpoint in serialized workspace/path order. It is not labeled a guaranteed preimage.
- **Changed:** exact state differs from the prior checkpoint (`bytes` hash/length or `absent` state).
- **Unchanged:** exact observed state equals the latest checkpoint, so no new checkpoint/fact is created.
- **Touch:** a query term meaning a recorded resource edge, not a causal mutation claim.

No field, UI label, summary, event, or test may convert `observed after` into `caused by`.

```ts
type ExtractionBasisV1 =
  | 'structured_path'
  | 'shell_input_redirection'
  | 'shell_output_redirection'
  | 'shell_known_operand';

type ObservationSkipReasonV1 =
  | 'outside_workspace'
  | 'invalid_path'
  | 'final_symlink'
  | 'not_regular_file'
  | 'unsupported_text'
  | 'too_large'
  | 'blocked_before_execution';

type ObservationFailureReasonV1 =
  | 'workspace_unavailable'
  | 'unreadable'
  | 'secure_open_unavailable'
  | 'observation_timeout'
  | 'observation_incomplete'
  | 'unstable_during_observation'
  | 'identity_conflict';

type PreObservationRejectionReasonV1 =
  | 'outside_workspace'
  | 'invalid_path'
  | 'blocked_before_execution';
```

## 6. Timestamp Contract

Tool activity preserves these independent nullable/non-null timestamps:

```ts
type ToolLifecycleTimingV1 = {
  announcedObservedAt: number;
  announcedReportedAt?: number;
  executionStartedReportedAt?: number;
  argumentsObservedAt?: number;
  argumentsReportedAt?: number;
  terminalObservedAt?: number;
  terminalReportedAt?: number;
  terminalSnapshotReportedAt?: number;
  reconciledAt?: number;
  exchangeSavedAt?: number;
  exchangeBoundAt?: number;
};

type ToolFactTimingV1 = {
  announcedObservedAt: number;
  announcedReportedAt?: number;
  executionStartedReportedAt?: number;
  argumentsObservedAt?: number;
  argumentsReportedAt?: number;
  terminalObservedAt: number;
  terminalReportedAt?: number;
  terminalSnapshotReportedAt?: number;
  reconciledAt?: number;
};
```

Rules:

1. Every `*ObservedAt` comes from the Fusion server clock at that boundary and is a non-negative safe integer.
2. A `*ReportedAt` exists only when the exact named incoming adapter value is a non-negative safe integer. Fallback `Date.now()` values must remain host-observed values and must not be labeled provider-reported.
3. Provider clocks are not constrained to precede, follow, or equal Fusion clocks.
4. Fusion lifecycle receipt ordering is monotonic per activity: arguments cannot precede announced; terminal cannot precede announced. Equal milliseconds are valid.
5. `snapshotObservedAt` is captured during resource inspection and is not copied from the tool timestamp.
6. The exact exchange save source is the `exchangeTs` value assigned once for `exchanges.ts` inside the insertion transaction; it is copied to `exchangeSavedAt`. Metadata `savedAt` is a separate audit field and is never used. The later independently captured host `exchangeBoundAt` does not rewrite or substitute for either value; equal millisecond values are allowed.
7. Stable SQLite insertion keys provide deterministic ordering when timestamps tie; public identity remains UUID/provider IDs.
8. `announcedObservedAt` is always present. `argumentsObservedAt` appears only after complete arguments are accepted; `argumentsReportedAt` requires an independently reported argument-phase time and is not copied from a start/end/envelope time. A terminal status requires `terminalObservedAt`; `terminalReportedAt` requires it and is omitted for a Fusion-synthesized interruption without a valid provider terminal time.
9. In `agent.tool_completed@1`, `occurredAt` equals `timing.terminalObservedAt`. `exchangeSavedAt` and `exchangeBoundAt` require an `exchangeId` on the durable/query record; the former is copied only from committed `exchanges.ts` and the latter is `Date.now()` when the binder transaction applies. `reconciledAt` marks only a Fusion reconciliation boundary and never implies provider reporting.
10. For OpenCode `terminal_snapshot`, valid `state.time.start` maps only to `executionStartedReportedAt`, valid `state.time.end` maps only to `terminalReportedAt`, and valid CLI envelope `timestamp` maps only to `terminalSnapshotReportedAt`. `announcedReportedAt` and `argumentsReportedAt` are omitted because the terminal ToolPart supplies no distinct announcement or argument-phase timestamp. None substitutes for another when absent or invalid.
11. Host UUIDs, first receipt `*ObservedAt`, `createdAt`, and later bookkeeping/reconciliation/bind clocks are first-write-owned facts and are excluded from duplicate-payload comparison. A replay hydrates/returns those established values rather than comparing its fresh receipt clock. Provider-reported clocks, lifecycle state, available fingerprints, canonical tool identity, and candidate edges remain comparison inputs.

The canonical adapter contract retains legacy `timestamp` only where existing clients/tests require it, with explicit `timestampSource`; all new provenance code consumes the named reported/observed fields.

All JSON Schemas apply the section 7.1 UTF-8 byte bounds in addition to JSON character-shape validation. Application validation enforces byte length before database/event insertion. Provider-controlled oversize identity fields reject the provenance activity with a fixed redacted diagnostic; they are never truncated into a colliding identity. Oversize path hints become fingerprint-only `invalid_path` edges. No diagnostic echoes rejected content.

## 7. Persistence Contract

Migration `036_agent_tool_provenance.js` adds the seven tables and one delete trigger defined below without modifying old migration files or overloading mediated-save `file_versions`.

### 7.1 `agent_tool_activities`

One row per tool call:

- internal monotonic integer primary key;
- unique UUID `activity_id` and unique UUID `event_id`;
- `workspace_id`, `thread_id`, `turn_id`;
- private immutable `authority_root_sha256` over the prompt-captured canonical root plus nullable paired canonical-decimal `authority_root_device`/`authority_root_inode` when the platform exposes both; these fields are never returned in facts or public queries;
- nullable `exchange_id` referencing `exchanges.id ON DELETE SET NULL` plus nullable `exchange_saved_at` and `exchange_bound_at`;
- `harness_id`, `provider`, bounded provider `tool_call_id`;
- canonical `tool_name` and bounded `native_tool_name`;
- state: `announced|completed|error|blocked|interrupted`;
- nullable `arguments_sha256` and `result_sha256` only—no raw values;
- candidate count, retained count, and truncation boolean;
- announced/arguments/terminal reported and observed timestamps;
- nullable interruption/reconciliation time;
- fact admission state `not_ready|pending|admitted|conflict`; ledger state `not_ready|pending|running|stored|conflict|failed`; and private ledger scheduling fields `ledger_attempt_count` default 0, nullable `ledger_next_attempt_at`, and nullable all-or-none `ledger_claim_token|ledger_claimed_at|ledger_lease_expires_at`;
- immutable canonical fact JSON/reservation hash and created/updated times.

Unique identity is `(workspace_id, thread_id, turn_id, harness_id, tool_call_id)`, and `(activity_id, workspace_id)` is additionally unique for child-table authority. Duplicate equality is exact over the bounded producer-controlled normalized phase fields that this table/fact persists, including provider-reported times, status, tool identity, any available argument/result fingerprints, and candidate edges. Host UUIDs, first-receipt observed times, create/update bookkeeping, reconciliation, and later exchange clocks are first-write-owned and excluded; a replay uses established values instead of its new receipt time. If a fingerprint is omitted under the section 8.1 canonicalization limits, raw-value differences outside the persisted normalized record are deliberately not compared: an otherwise-identical replay is idempotent rather than labeled an unverifiable conflict. Any different comparison field for the same established phase records a conflict diagnostic and cannot overwrite truth. Fixtures replay byte-identical terminal snapshots under advancing Fusion clocks and require no conflict plus unchanged first-receipt times.

Indexes cover natural provider identity, workspace/thread/turn/time query dimensions, exchange binding, and ledger scheduling/lease lookup by `(ledger_state, ledger_next_attempt_at)` and `(ledger_state, ledger_lease_expires_at)`.

An abandoned `announced` row is closed as `interrupted` during explicit stop or startup reconciliation. Reconciliation supplies only Fusion `reconciledAt/terminalObservedAt`; it never invents `terminalReportedAt`.

Identifier bounds are UTF-8 byte bounds: workspace, thread, turn, harness, provider, canonical/native tool names, and request IDs are `1..128`; provider tool-call IDs are `1..512`; canonical paths are `1..4096`; file names are `1..255`; folder paths are `0..4096`, where only the exact empty string denotes the workspace root; all host event/activity/edge/observation/snapshot/resource IDs use the repository UUID grammar. Missing, empty, over-bound, or non-scalar OpenCode call IDs are malformed provider events: the adapter emits a fixed redacted diagnostic and does not create a normalized activity or invent a provider ID. Existing defensive chat handling may continue, but such an event cannot satisfy provenance acceptance.

### 7.2 `agent_tool_resource_edges`

One row per deduplicated candidate/access role:

- internal integer key and UUID `edge_id`;
- `workspace_id` plus `activity_id` and deterministic `candidate_ordinal`; the pair has a composite foreign key to the activity's unique `(activity_id, workspace_id)` so redundant workspace query authority cannot drift;
- optional accepted `resource_id`, `canonical_path`, `file_name`, and `folder_path`;
- `candidate_sha256` for exact candidate dedupe/audit; rejected outside-workspace values store no raw path;
- access family `read|write|execute|unknown`;
- access kind `read|write|create|delete|move_from|move_to|execute|unknown`;
- extraction basis from the exact closed v1 enum `structured_path|shell_input_redirection|shell_output_redirection|shell_known_operand`;
- observation state `pending|first_observation|changed|unchanged|skipped|failed`;
- optional observed and previous snapshot IDs;
- optional exact reason: skipped `outside_workspace|invalid_path|final_symlink|not_regular_file|unsupported_text|too_large|blocked_before_execution`; failed `workspace_unavailable|unreadable|secure_open_unavailable|observation_timeout|observation_incomplete|unstable_during_observation|identity_conflict`;
- private scheduling fields `observation_attempt_count` default 0 and nullable `next_observation_at` while pending;
- observed and updated timestamps.

Indexes cover workspace/path, file name, folder path, activity, access family/kind, observation state, and observed time. Folder matching is segment-boundary-safe, never wildcard interpolation.

The terminal reservation closes every retained pre-observation rejection atomically: `outside_workspace`, `invalid_path`, and `blocked_before_execution` edges are inserted as `skipped` with that exact reason, `observed_at = terminal_observed_at`, attempt count 0, and null next-time/resource/snapshot/previous-snapshot fields. They never enter an observation job. An activity containing both rejected and accepted candidates creates a job only for its accepted pending edges; a rejected-only activity creates none. An accepted path whose parent later becomes a symlink or non-directory uses the observation-time `invalid_path` skip branch in section 9 and retains its accepted canonical path metadata.

### 7.3 `agent_snapshot_blobs`

Content-addressed exact bytes:

- lowercase SHA-256 primary key;
- byte length `0..10 MiB`;
- encoding fixed to `utf8`;
- exact BLOB bytes;
- first-stored timestamp.

The row is inserted idempotently. Matching hash with different length/bytes is a fatal integrity conflict. No raw bytes appear in logs, events, query results, or diagnostics.

### 7.4 `agent_resource_snapshots`

One row for each first or changed eligible observed state:

- internal integer key;
- UUID `snapshot_id`, UUID `observation_id`/operation ID, and UUID `event_id`, each unique;
- workspace/canonical path, file name, folder path, and nullable resource ID (required for `bytes`, absent for `absent`);
- state `bytes|absent`;
- nullable blob hash and exact byte length with state-shape checks;
- relation `first_observation|changed`;
- nullable prior snapshot ID for the same workspace/path;
- source activity/edge IDs;
- access family/kind and extraction basis copied as immutable observation context;
- `snapshot_observed_at`;
- immutable canonical fact JSON/hash; fact admission state `pending|admitted|conflict`; ledger state `not_ready|pending|running|stored|conflict|failed`; private `ledger_attempt_count` default 0, nullable `ledger_next_attempt_at`, and nullable all-or-none `ledger_claim_token|ledger_claimed_at|ledger_lease_expires_at`; and created/updated times.

Indexes cover workspace/path/time, resource/time, source activity, event, observation, prior snapshot, and ledger scheduling/lease lookup by `(ledger_state, ledger_next_attempt_at)` and `(ledger_state, ledger_lease_expires_at)`. A partial unique rule prevents more than one successful checkpoint for the same source edge.

### 7.5 Resource Registry Reuse

The observer uses the existing `resource_registry` through a narrow owner service:

- existing compatible active path identity is reused;
- observed regular bytes state is reserved through the existing fingerprint-aware stable-resource policy;
- observed absent state never creates or preserves a `reserved` replacement identity: under the shared path coordinator, a compatible existing live mapping is retired through the existing tombstone transition and the checkpoint stores `resource_id = NULL`;
- an incompatible live identity is retired through the existing reservation policy rather than silently rewritten;
- first observation may create a host UUID resource identity;
- skipped/rejected candidates do not create misleading live resources.

The snapshot chain remains workspace/path-scoped and may therefore link a prior snapshot across an honest resource-ID replacement. On absent→bytes, normal stable reservation creates a new live successor. On bytes→absent, the live identity is tombstoned and the absent checkpoint has no identity. If a nonterminal mediated save owns/reserves the path, the observer leaves its edge pending and retries after that save releases the shared coordinator; it never promotes or steals a foreign reservation. Crash reconciliation repeats the same guarded transition. The builder must preserve current mediated-save invariants and active-path uniqueness, use the current stable-resource repository through this exact bounded observer extension, and must not edit migration 035. Tests cover first-absent, absent→bytes, bytes→absent, concurrent save in both orders, foreign reservation conflict, and restart.

### 7.6 `agent_exchange_bind_jobs`

`HistoryFile.addExchange` performs sequence allocation, exchange insertion, and bind-job insertion in one SQLite transaction. It captures one `exchangeTs = Date.now()` immediately after entering that transaction, writes it as `exchanges.ts`, and copies exactly that value to the job's `exchange_saved_at`; `metadata.savedAt` is ignored for binding. Job columns are: `exchange_id INTEGER PRIMARY KEY` referencing `exchanges.id ON DELETE CASCADE`; non-null bounded `workspace_id`, `thread_id`, and `turn_id`; non-null `exchange_saved_at`; state `pending|applied|conflict` default `pending`; nullable fixed `conflict_code`; and non-null `created_at`/`updated_at`. Unique `(workspace_id, thread_id, turn_id, exchange_id)` prevents authority drift.

The binder reads the committed exchange JSON through this job and requires exactly one tool part for each schema-valid provider tool-call ID and at most one matching activity under the same workspace/thread/turn. A bindable OpenCode part must carry server-owned `terminalSnapshotExpansionVersion: 1` and `terminalSnapshotExpansionComplete: true`, set atomically with the final in-memory arguments/result application before result emission. The binder recomputes every available normalized activity fingerprint from the stored exchange representation and requires equality; an omitted fingerprint is not invented or compared, but the completion marker remains mandatory. Only then does it atomically set `exchange_id`, copy the job's `exchange_saved_at`, record a fresh host `exchange_bound_at = Date.now()` for the binder transaction, and mark the job applied. Duplicate tool-call IDs, missing/false/unknown completion marker, available hash mismatch, or a pre-existing different binding marks only the job conflict with fixed `duplicate_tool_part|incomplete_tool_part|detail_hash_mismatch|different_binding`; the activity remains unbound and exposes no detail reference.

One singleton binder processes jobs in `exchange_id` order with concurrency 1 and at most 100 job dispositions per yielded batch. Each read/apply/conflict database operation receives five immediate `runBoundedSqliteRetry` attempts with `setImmediate` yields. On first retryable exhaustion for an `exchange_id`, the binder stops that drain, marks that ID delayed/ineligible in memory, arms exactly one retry for it at `now+1,000 ms`, and does not let unrelated wake signals select it or count as the retry. Other eligible IDs may drain after yielding. If the delayed bounded operation also exhausts, or if either operation returns a non-retryable database error, it emits fixed value-free `agent_exchange_bind_failed`, moves that ID from delayed to suppressed in memory, leaves its row honestly `pending`, and arms no further timer for it in the current process. Binder selection excludes delayed and suppressed IDs. Suppression resets only on restart, where that row receives the same one-delayed-retry allowance. Applied/conflict rows need no retry. The pre-socket startup pass ends after 100 job dispositions or 1,000 monotonic milliseconds, whichever occurs first; remaining non-suppressed jobs stay durable and post-startup batches resume after one event-loop yield. Post-commit insertion signals the binder directly; its only timer is the earliest unused delayed retry and no polling interval is added. Shutdown cancels unstarted delayed timers, starts no new job, waits at most 2,000 monotonic milliseconds for the current bounded database operation, and otherwise leaves the row pending for restart without retaining a detached promise. The durable job closes the commit gap. A `BEFORE DELETE ON exchanges` trigger clears `agent_tool_activities.exchange_id`, `exchange_saved_at`, and `exchange_bound_at` together for `OLD.id`; the foreign key is a second integrity guard. Direct exchange deletion and cascading thread deletion execute the same trigger.

### 7.7 `agent_observation_jobs`

One durable singleton-scheduler job exists for every terminal activity with at least one accepted candidate requiring observation. `activity_id` is the primary key; `(activity_id,workspace_id)` references the activity authority pair `ON DELETE RESTRICT`; state is `pending|running|complete`; nullable UUID `claim_token` and `claimed_edge_id`, nullable integer `claimed_attempt`, plus nullable `claimed_at`/`lease_expires_at` form one all-null/all-present claim tuple. `claimed_edge_id` references the selected dominant edge `ON DELETE RESTRICT`; repository validation requires it to belong to the job's activity/workspace. Nullable `next_attempt_at` plus non-null `created_at` and `updated_at` are timestamps. There is no job-level attempt counter: attempts belong to path groups and are stored identically on every sibling edge. Pending requires no claim tuple and a `next_attempt_at` equal to the minimum `next_observation_at` among its pending edges; running requires the tuple, `claimed_attempt` in `0..3`, `lease_expires_at > claimed_at`, and preserves that same minimum; complete requires no claim tuple, null `next_attempt_at`, and no owned pending edge. A terminal reservation inserts this job in the same transaction as the activity/edges; every accepted pending edge initially receives `next_observation_at = terminal_observed_at`. Zero-observable-candidate activities create no job.

Observation-job indexes cover `(state,next_attempt_at,created_at,activity_id)` and `(state,lease_expires_at,activity_id)` for exact due and lease selection.

Exactly one host-owned `AgentObservationScheduler` claims jobs oldest-first by `(next_attempt_at, created_at, activity_id)`, only when `next_attempt_at <= now`, only when the activity/claim key is not delayed or suppressed in memory, and only by joining an owning activity whose `fact_admission_state='admitted'`; pending/conflicting/unadmitted tool facts are never inspected. It runs at most four path observations globally and at most one path for a given activity. Each claim processes exactly one grouped canonical path. It considers only pending groups whose minimum sibling `next_observation_at <= now`, chooses the ready group with the lowest dominant-edge ordinal, and therefore never lets a delayed lower ordinal block a ready higher ordinal. A claim is a compare-and-set transaction with a fresh token, the dominant `claimed_edge_id`, `claimed_attempt=0`, and a 30,000-ms lease; only that token may advance/release the job. Startup recovers eligible already-expired claims and arms the scheduler for eligible unexpired ones. Its sole timer is always the earlier of the minimum eligible pending-job due time, minimum eligible running-claim lease expiry, or earliest unused delayed-transition retry, so a lone abandoned claim is recovered at expiry without another event. The required-ack UEB handler only verifies the admitted tool fact and signals this durable scheduler; it performs no filesystem work and returns after scheduling, so controller timeout cannot detach an untracked read. The shared coordinator also owns the exact single priority save-handoff slot defined in section 9; the scheduler never occupies or consumes it.

After a path lock is acquired, the observer captures one monotonic `coordinatorDeadline = acquiredAt+2,000 ms`; lock ownership, attempt reservation, native I/O, immediate outcome writes, handle cleanup, and result disposal must all finish by that deadline. Immediately before filesystem I/O, one token-checked transaction increments `observation_attempt_count` identically for every pending sibling edge in the selected group and sets the job's `claimed_attempt` to that same value; valid reserved/executed attempts are 1 through 3. Attempt reservation receives up to five immediate retryable attempts, cut short by the coordinator deadline. If it still does not commit or returns a non-retryable error, no filesystem I/O occurs, the lock is released, and the scheduler immediately invokes only a token-checked no-attempt settlement to clear the claim and return the group pending at `transitionNow+100 ms`; failure of that settlement follows the finite running-claim rule below. The reservation transaction itself is never retried later without reacquiring the path lock. Every retry/lock/recovery transition captures one `transitionNow = Date.now()` and derives all sibling/job wall-clock fields from it. A save-priority lock miss performs no I/O and does not increment the count: it sets every sibling `next_observation_at = transitionNow+100 ms`, releases the claim, and recomputes the job minimum. Each executed path attempt uses incremental reads, at most one `10 MiB + 1` buffer, and the remaining portion of the same coordinator deadline. It closes every handle in `finally`. Timeout at attempt 1 returns every sibling edge to pending at `transitionNow+250 ms`; timeout at attempt 2 uses `transitionNow+1,000 ms`; timeout at attempt 3 records `observation_timeout` on every sibling. Stable permanent outcomes close every sibling immediately with null next time. After each grouped transition, the same token-checked transaction clears the claim and either marks the job complete with null next time when no pending edge remains or pending with the exact minimum remaining edge next time.

An observation result may be committed only while its path lock is still owned and before `coordinatorDeadline`. Immediate outcome retries stop at that deadline even if fewer than five database attempts ran. If the outcome did not commit, the observer closes handles, zeroes/releases buffered bytes, releases the path lock by the deadline, and permanently discards that filesystem result. It then attempts only a token-checked no-result settlement: reserved attempt 1 or 2 returns the group pending at `transitionNow+250 ms` or `transitionNow+1,000 ms`; reserved attempt 3 records terminal `observation_incomplete`; claimed attempt 0 returns pending at `transitionNow+100 ms`. That settlement never writes a snapshot, observed state, resource-registry mutation, or `observed_at`. If settlement is delayed or fails, the running claim remains the truthful durable state; no later callback may commit the discarded result. A later filesystem attempt occurs only after settlement/restart recovery makes the group pending, and it must reacquire the coordinator and perform a fresh descriptor-relative observation. This makes the 2,000-ms save-wait promise cover total coordinator ownership rather than filesystem reading alone.

Lease recovery uses `claimed_edge_id` to select exactly that canonical-path group and never guesses from global attempt counts. With `claimed_attempt=0`, it consumed no filesystem attempt and returns that group pending at `transitionNow+100 ms`. With claimed attempt 1 or 2, it treats the reserved attempt as consumed and returns the group pending at `transitionNow+250 ms` or `transitionNow+1,000 ms`. With claimed attempt 3, it records terminal `observation_incomplete` for every sibling at `transitionNow` without another filesystem attempt. It then clears the tuple and recomputes/finishes the job exactly as any other grouped transition. This outcome is deliberately agnostic between crash-after-reservation, shutdown interruption, and post-I/O database nonsettlement; it does not falsely assert a read result. The scheduler uses one wake-up for inserts/completions and the single due/lease timer above; it does not poll.

Every observation claim, no-attempt release, no-result settlement, outcome, and lease-recovery database transition uses up to five immediate `runBoundedSqliteRetry` attempts with `setImmediate` yields; lock-owned reservation/outcome retries are additionally cut short by the coordinator deadline. Safe delayed work never retains a path lock or filesystem result. On first retryable exhaustion, a tokenless pending claim failure is keyed as `activity:<activity_id>` and a running transition failure is keyed as `claim:<claim_token>`; the scheduler marks that key delayed/ineligible and arms exactly one in-memory transition retry at `now+1,000 ms`. While delayed, unrelated signals and ordinary due/lease selection cannot select the key. The delayed operation may retry only the same claim transition or a no-I/O release/settlement/recovery transition. It may never retry an attempt reservation without reacquiring the path lock and may never persist a prior filesystem result. If that second bounded transition attempt also exhausts, it emits fixed `agent_observation_transition_failed`, moves the exact key from delayed to suppressed in memory, and arms no further automatic timer for it in the current process. Any non-retryable database error in claim, release, settlement, outcome, or recovery emits the same diagnostic and immediately suppresses the corresponding pending-activity or running-claim key; it receives no delayed retry. Normal due/lease selection excludes delayed and suppressed keys. Suppression resets only on restart, whose bounded startup claim/recovery receives a fresh allowance. No filesystem I/O starts when claim or attempt reservation did not commit. A non-retryable primary outcome error after I/O follows the mandatory discard/no-result-settlement branch above; if that settlement succeeds, attempt 1/2 becomes pending and attempt 3 becomes `observation_incomplete`, while a retryable or non-retryable settlement failure leaves and suppresses the honest running claim. Tests cover every tokenless/token-owned transition branch, result disposal, fresh re-observation, and retained-running state without a hot loop.

Before public sockets, startup first runs the bounded shared admission reconciliation in section 10.3, then initializes the scheduler and processes only admitted-owner jobs for at most 16 claimed-path dispositions or 2,000 monotonic milliseconds, whichever occurs first. Every successfully installed path claim consumes one disposition whether it ends in a lock miss, pre-I/O release/settlement, executed observation, or terminal closure; `observation_attempt_count` remains reserved exclusively for committed filesystem-attempt reservations. A failed compare-and-set that installs no claim consumes no disposition. A later tool-fact admission signals the scheduler. Remaining backlog stays pending and drains after an event-loop yield in batches of at most 16 claimed-path dispositions with the same global/per-activity caps. Shutdown cancels the due/lease timer and every unstarted delayed-transition retry, marks delayed keys ineligible, stops claims, aborts cooperative incremental reads, closes handles, waits at most 2,000 ms for all four slots concurrently, and then leaves unfinished work pending/lease-recoverable. No observation or timer callback survives as unowned work after its slot is released.

### 7.8 `agent_renderer_projection_jobs`

Every grouped dominant-edge outcome `first_observation|changed|unchanged` creates exactly one durable renderer-projection job in the same transaction that closes the edge group. `source_edge_id TEXT PRIMARY KEY` references the dominant edge UUID `ON DELETE RESTRICT`; non-null `workspace_id`, `activity_id`, `observed_at`, and `relation` copy immutable owner facts. State is `pending|running|settled|failed`; `delivery_failure_count` defaults to 0; nullable `next_attempt_at`; nullable all-or-none UUID `claim_token` plus `claimed_at|lease_expires_at`; nullable `settled_at` and settlement `v2_sent|refresh_required_sent|no_recipient|retry_exhausted`; and non-null `created_at|updated_at`. Indexes cover `(state,next_attempt_at,observed_at,source_edge_id)` and `(state,lease_expires_at,source_edge_id)`.

Creation is pending with failure count 0, no claim/settlement, and `next_attempt_at=observed_at`. Pending requires count `0..2`, next time, and no claim/settlement. Running requires count `0..2`, null next/settlement, and a 30,000-ms claim lease. Settled requires count `0..2`, no next/claim, non-null settled time, and settlement other than `retry_exhausted`. Failed requires count 3, no next/claim, non-null settled time, and exact `retry_exhausted`. Source relation/path/state/snapshot/fact references are re-read from the immutable successful edge/checkpoint rows rather than duplicated beyond the named job columns.

One host-owned concurrency-one `AgentRendererProjectionScheduler` claims eligible pending jobs in `(next_attempt_at, observed_at, source edge internal id, source_edge_id)` order and processes at most 100 dispositions per yielded batch. It never reads file bytes. For unchanged it derives v2 under the admitted owning tool fact. For first/changed it derives v2 only if the checkpoint fact is admitted; if that fact remains pending or is conflict, it derives only refresh-required `fact_publish_failed`. Each claimed delivery has a 2,000-monotonic-ms deadline; the existing bind-buffer/socket call is immediate/non-blocking, and any injected async boundary must accept cancellation, remain in the scheduler's tracked cleanup set, and be token-guarded so a late return cannot settle another claim. Deadline expiry follows the ordinary failed-delivery transition; a late socket acceptance may only duplicate the same stable projection ID. A successful v2 buffer/send settles `v2_sent`; successful fallback settles `refresh_required_sent`. An authority-validated lookup with zero matching live File Viewer recipients settles `no_recipient`, because reconnect hydration is authoritative. “Sent” means accepted by the existing workspace bind buffer/socket publisher, not client acknowledgement.

If v2 derivation/send rejects, the same claimed delivery may attempt exactly one strict refresh-required fallback with `projection_failed`; if the v2 capability/session binding is unavailable, it may attempt exactly one fallback with `projection_unavailable`. If the selected payload and allowed fallback both fail, a token-checked transition increments `delivery_failure_count`: failure 1 returns pending at `transitionNow+250 ms`, failure 2 at `transitionNow+1,000 ms`, and failure 3 records failed `retry_exhausted`. A crash or lease expiry does not claim whether a socket send occurred: it clears the claim to pending at `transitionNow+100 ms` without incrementing failure count. Re-delivery uses the stable dominant-edge projection ID and is client-idempotent, closing the send-before-settle crash gap without inventing exactly-once delivery.

Every claim, settle, failure-reschedule, and lease-recovery transition uses five immediate retryable database attempts, then one delayed retry at `now+1,000 ms` while the exact pending-edge or running-claim key is ineligible to other wakes. Second exhaustion suppresses the key until restart and emits fixed `agent_renderer_projection_transition_failed`; a non-retryable transition error does so immediately. No send begins without a committed claim. The sole timer covers eligible due jobs, eligible lease expiry, and unused delayed-transition retries. Startup recovers expired claims, arms unexpired leases, and processes at most 100 dispositions or 1,000 monotonic milliseconds before sockets; because there are then no renderer recipients, those jobs may truthfully settle `no_recipient`. After sockets, remaining work drains in yielded 100-item batches. Shutdown cancels due/lease/delayed timers, starts no claim, waits at most 2,000 ms for the current send/transition, and leaves any unsettled claim for restart recovery; no callback survives database close.

Required fixtures cover unchanged commit then crash before claim/send; first/changed fact admission then crash before projection wake; crash before send and send-before-settle; no recipient; v2 success; pending/conflicting checkpoint fallback; v2 rejection plus fallback; both sends failing through counts 1/2/3; lease recovery duplicate; retryable/non-retryable transition suppression; 100-item and 1,000-ms startup/yield boundaries; and bounded shutdown/restart.

### 7.9 Exact relational shape and transactions

All time columns are `INTEGER`; all booleans are `INTEGER NOT NULL CHECK(value IN (0,1))`; all public IDs/digests/paths/enums/JSON are `TEXT`; snapshot bytes are `BLOB`. Apart from the nullable columns explicitly named below, every column is `NOT NULL`. Defaults exist only where stated.

| Table | Exact primary key and column groups |
|---|---|
| `agent_tool_activities` | `id INTEGER PRIMARY KEY AUTOINCREMENT`; UUID `activity_id,event_id`; bounded identity `workspace_id,thread_id,turn_id,harness_id,provider,tool_call_id,tool_name,native_tool_name`; private digest `authority_root_sha256` and nullable paired canonical-decimal text `authority_root_device,authority_root_inode`; nullable all-or-none triple `exchange_id,exchange_saved_at,exchange_bound_at`; `status`; nullable digests `arguments_sha256,result_sha256`; candidate integers `candidate_reported_count,candidate_retained_count` default 0 and `candidates_truncated` default 0; times `announced_observed_at` plus nullable `announced_reported_at,execution_started_reported_at,arguments_observed_at,arguments_reported_at,terminal_observed_at,terminal_reported_at,terminal_snapshot_reported_at,reconciled_at`; `fact_admission_state` and `ledger_state` default `not_ready`; `ledger_attempt_count` default 0; nullable `ledger_next_attempt_at,ledger_claim_token,ledger_claimed_at,ledger_lease_expires_at,fact_json,fact_sha256`; non-null `created_at,updated_at` |
| `agent_tool_resource_edges` | `id INTEGER PRIMARY KEY AUTOINCREMENT`; UUID `edge_id`; `workspace_id,activity_id`; `candidate_ordinal`; digest `candidate_sha256`; nullable `resource_id,canonical_path,file_name,folder_path`; `access_family,access_kind,extraction_basis`; `observation_state` default `pending`; `observation_attempt_count` default 0; nullable `next_observation_at,observation_reason,observed_at,snapshot_id,previous_snapshot_id`; non-null `created_at,updated_at` |
| `agent_snapshot_blobs` | no surrogate ID; `sha256 TEXT PRIMARY KEY`; `byte_length`; `encoding` fixed `utf8`; `bytes`; `first_stored_at` |
| `agent_resource_snapshots` | `id INTEGER PRIMARY KEY AUTOINCREMENT`; UUID `snapshot_id,observation_id,event_id`; `workspace_id`; nullable `resource_id`; `canonical_path,file_name,folder_path`; `state,byte_length,relation`; nullable `blob_sha256,previous_snapshot_id`; `source_activity_id,source_edge_id,access_family,access_kind,extraction_basis,snapshot_observed_at`; `fact_admission_state` default `pending`; `ledger_state` default `not_ready`; `ledger_attempt_count` default 0; nullable `ledger_next_attempt_at,ledger_claim_token,ledger_claimed_at,ledger_lease_expires_at`; non-null `fact_json,fact_sha256,created_at,updated_at` |
| `agent_exchange_bind_jobs` | exact columns and default in section 7.6; no surrogate `id` |
| `agent_observation_jobs` | exact columns/defaults in section 7.7; no surrogate `id` |
| `agent_renderer_projection_jobs` | exact columns/defaults in section 7.8; no surrogate `id` |

Required uniqueness/foreign keys are exact: activity UUID/event UUID and natural provider identity are unique; `(activity_id,workspace_id)` is unique; edge UUID and `(activity_id,candidate_sha256,access_family,access_kind,extraction_basis)` are unique; edge `(activity_id,workspace_id)` references the activity pair `ON DELETE RESTRICT`; nullable edge/snapshot resource IDs reference `resource_registry.resource_id ON DELETE RESTRICT`; snapshot/observation/event UUIDs and `source_edge_id` are unique; snapshot source activity/edge and previous snapshot reference their owners `ON DELETE RESTRICT`; bytes `blob_sha256` references the blob `ON DELETE RESTRICT`; observation-job authority references the activity pair and nullable `claimed_edge_id` references its edge, both `ON DELETE RESTRICT`, with same-owner validation in the claim transaction; renderer-projection job references its unique dominant source edge `ON DELETE RESTRICT` and validates copied workspace/activity/relation/time against that edge when created/claimed; bind-job exchange cascades as section 7.6 states. `exchange_id` on activity references exchanges `ON DELETE SET NULL` behind the triple-clearing trigger. Migration down drops trigger, bind jobs, renderer-projection jobs, observation jobs, snapshots, blobs, edges, then activities.

CHECK and semantic-validator truth matrices are exact:

- every UUID/digest/bounded identity/path/enum satisfies sections 5–8 before insertion; digest columns are lowercase 64-hex; root device/inode are either both null or both canonical unsigned decimal strings of `1..20` ASCII digits with no sign or leading zero except exact `0`;
- every time is a non-negative safe integer; `arguments_reported_at -> arguments_observed_at`; execution-start/terminal/provider-snapshot reported times require `terminal_observed_at`; `exchange_id`, `exchange_saved_at`, and `exchange_bound_at` are all null or all non-null, and bound time is the independent host binder time rather than a copy of saved time;
- `announced` requires null terminal/reconciled/fact body, admission `not_ready`, ledger `not_ready`, ledger attempts 0, null ledger-next, and no ledger claim; terminal statuses require terminal time plus fact body/hash and admission `pending|admitted|conflict`; `reconciled_at` requires `interrupted`; admission `pending|conflict` requires ledger `not_ready`, attempt 0, null next, and no claim; admission `admitted` permits ledger `pending|running|stored|conflict|failed`; ledger pending requires attempts `0..2`, non-null next, and no claim; running requires attempts `1..3`, null next, and a UUID token plus non-negative safe-integer claimed/lease times with lease greater than claimed; stored, conflict, and failed each require attempts `1..3`, null next, and no claim; every non-`not_ready` ledger state requires admitted fact identity;
- candidate counts are `0..65`, retained is `0..64` and no greater than reported, and reported `65` is the saturating “at least 65” value requiring `candidates_truncated=1`; every smaller reported count requires truncation 0;
- edge pending has no reason/observed time/snapshot, requires non-null `next_observation_at`, and has attempt count `0..2`; a reserved attempt 3 remains pending only while its owning job is running with the same `claimed_edge_id`, `claimed_attempt=3`, and claim token, after which outcome commit or lease recovery must close it; skipped/failed has the matching closed reason plus observed time, null next-at, no snapshot IDs, and attempt count `0..3`; first/changed/unchanged has observed time/snapshot, null next-at, no reason, and attempt count `1..3`; first has no previous snapshot, changed has one, and unchanged copies the referenced checkpoint's own previous ID (nullable only when that checkpoint was first);
- a pre-observation rejected edge with `outside_workspace|invalid_path` has no raw path/name/folder/resource; an observation-time `invalid_path` edge originated from an accepted path and retains canonical path/name/folder together but has no resource/snapshot; every other accepted path likewise keeps canonical path/name/folder together; accepted `folder_path` is exact `''` for a root-level canonical path and otherwise its normalized slash-separated parent with no trailing slash; `blocked_before_execution` may keep accepted path metadata but has no resource/snapshot;
- blob length is `0..10 MiB`, equals SQLite `length(bytes)`, and encoding is exactly `utf8`;
- snapshot bytes requires resource ID, blob hash, length equal to its blob, and no inline bytes; snapshot absent requires null resource/blob and length 0; first relation requires null previous, changed requires non-null previous for the same workspace/path; source activity/edge/workspace and copied access/basis must agree;
- observation-fact body/hash is created in the checkpoint transaction and can only move `pending/not_ready -> admitted/pending -> admitted/running|stored|conflict|failed`, or `pending/not_ready -> conflict/not_ready`; conflict/failed never overwrites body or snapshot truth; and
- bind-job conflict code is null unless state is conflict; applied/conflict are terminal and replay-idempotent; observation-job claim/state/edge-completion shapes satisfy section 7.7; renderer-projection job state/count/claim/settlement shapes satisfy section 7.8; repository transactions plus migration CHECKs enforce every expressible row-local rule.

Transaction ownership is exact: OpenCode terminal-snapshot reservation writes the terminal activity, all candidate edges, optional observation job, immutable tool fact body/hash, and pending admission state in one transaction; private pre-dispatch admission commit is one transaction; scheduler claim/attempt-reservation/release is one transaction each; path observation under the shared coordinator writes registry retirement/reservation, blob, checkpoint, every grouped edge outcome, immutable observation fact body/hash, renderer-projection job, and observation-job advancement in one transaction; ledger cycle claim/recovery is one transaction each, while each claimed ledger projection appends/verifies `event_log` plus edges and advances only its token-matched source row in one transaction; renderer-projection claim/settlement is one transaction each with socket delivery between them; exchange insertion plus bind-job insertion is one transaction; binder application is one transaction. No filesystem read, socket send, or UEB callback occurs inside a database transaction.

## 8. Tool Capture And Extraction Contract

### 8.0 Immutable turn authority

At server-owned prompt acceptance, Fusion creates a private frozen `AgentTurnAuthorityRef` containing the coordinator-derived workspace ID and verified canonical root identity, persistent thread ID, Fusion turn ID, configured harness ID, and provider. The root identity includes the canonical root path plus its device/inode identity when the platform exposes both. SHA-256 of the canonical root's UTF-8 bytes and the paired canonical-decimal device/inode strings are persisted immutably on every first activity reservation and must match every duplicate phase. They are private recovery authority: they are excluded from governed facts, query summaries, logs, and diagnostics. This ref is passed through the harness session, foreground/headless drain, bridge, applier, activity owner, observer, terminalizer, and exchange-bind job; none may re-read mutable renderer/session navigation to determine provenance authority.

At observation time—including startup reconciliation after the in-memory ref is gone—the owner resolves the captured workspace ID from the server registry, recomputes the canonical-root digest, and requires it plus available device/inode identity to match the immutable activity fields. Missing/replaced/mismatched authority records `workspace_unavailable` and no candidate bytes are read. Switching A→B→A, closing a panel, rebinding a socket, crashing, or replacing a root at the same path never retargets A's turn. Fixtures run simultaneous A/B turns, a delayed A terminal snapshot across A→B→A, and crash/root-replacement recovery, proving rows, roots, facts, observation, and binding remain attached to the original turn.

### 8.1 Canonical lifecycle

The OpenCode adapter creates canonical events containing:

- server receipt time captured as close to raw-event parsing as possible;
- valid provider-reported timestamp separately;
- adapter/harness/provider identity;
- provider call ID, native and canonical tool names;
- arguments chunk/value and result for existing chat rendering;
- the complete parsed `state.input` value already used by chat rendering as the only structured/shell extraction input; no provider result-file hint is activated.

OpenCode provenance accepts only the own data property `part.callID` as provider tool-call identity. It must be a nonempty string used verbatim without trimming or coercion and satisfy the section 7.1 `1..512` UTF-8-byte bound. `part.id` is a distinct OpenCode part identity and is ignored: it is not compared with `callID`, used as fallback, persisted, or promoted to `nativeRefs`. Missing/invalid `callID` takes the fixed redacted malformed-identity diagnostic branch and creates no provenance activity. No other call-ID alias is read. `part.tool` must be an own nonempty string within `1..128` UTF-8 bytes; an invalid tool name takes the same provenance-only fail-open branch.

The provenance canonical-name map is closed to current OpenCode native names: `bash -> shell`, `read -> read`, `write -> write`, `edit -> edit`, `grep -> grep`, `glob -> glob`, `webfetch -> fetch`, `websearch -> search`, `todowrite -> todo`, and `task -> subagent`, after ASCII case-folding only. A schema-valid unlisted native tool is indexed with canonical name `unknown` and receives no resource extraction; legacy chat display mapping may remain unchanged outside the new provenance record. Only native `read|write|edit|bash` enter this SPEC's extractors. Generic terminal `files`, result/output strings, every other OpenCode field, and every other harness remain inert.

Current OpenCode CLI output supplies one completed/error `tool_use` ToolPart rather than an authoritative pre-execution call stream. The translator therefore accepts only exact `part.state.status === 'completed'|'error'` and maps it directly to the corresponding provenance status. It does not derive provenance status from `metadata.exit`, normalized chat `isError`, status text, or a Settings-bounce outcome; any other/missing state status takes a fixed redacted provenance-only diagnostic branch. The translator emits one internal canonical `tool_snapshot` event for an accepted raw envelope, with origin fixed to `terminal_snapshot`, the complete input/result values, terminal status, separately validated `state.time.start`, `state.time.end`, and CLI envelope `timestamp`, plus one Fusion receipt time. This internal adapter event is not a governed `chat.tool.*` fact.

Before terminal reservation, the applier purely evaluates the existing protected-Settings rule exactly once against the complete terminal-derived input, using only the verified canonical root in that tool's immutable `AgentTurnAuthorityRef`; mutable `session.projectRoot`, renderer navigation, and the currently bound socket workspace are forbidden inputs. It emits no UI/chat/enforcement event during this evaluation. When the rule matches, the tool is already terminal: Fusion precomputes the existing result-phase bounce transformation, does not issue the pre-execution SIGTERM, and produces the final JSON-safe result that will be stored in the exchange. Otherwise it produces the ordinary final JSON-safe exchange result. The bridge/applier then atomically reserves activity terminal truth, the original complete-argument fingerprint, that final persisted-result fingerprint, and candidate edges. Only after that transaction succeeds or fails open does it expand the snapshot into the existing call → arguments → result stages for chat rendering, carrying a private resolved-bounce marker and value. The result stage applies the precomputed value to the already-created tool part and emits `system:tool_bounced` plus `chat:tool_result` exactly once; no stage re-evaluates enforcement. For a present complete input, announced/arguments/terminal observed times all equal that one receipt boundary; absent input omits arguments observed time. Reported fields follow section 6's exact start/end/envelope mapping and never borrow from one another.

All expanded OpenCode chat stages carry non-persisted origin `terminal_snapshot` and the private resolved-bounce disposition. Terminal-derived arguments skip the pre-execution branch, and the result stage applies/emits the precomputed final exchange value only after the call/arguments stages exist, without performing the protected-path check again. In the same synchronous in-memory mutation that applies the final arguments/result and before emitting that result, the server writes safe tool-part fields `terminalSnapshotExpansionVersion: 1` and `terminalSnapshotExpansionComplete: true`; no earlier/default part carries them. These fields may persist in the existing exchange detail JSON and contain no raw data. The provenance status remains the provider's exact completed/error state even when the displayed result is the existing result-phase enforcement value. A crash or exception after terminal reservation cannot demote the durable activity to `announced|blocked|interrupted`; startup reconciliation resumes only its pending fact/observation/ledger work. Completed/error Settings-path fixtures assert call → args → exactly-one bounced result order, completion-marker timing, absence of pre-execution SIGTERM, final persisted result/hash equality, and eligible post-terminal observation; failure injection after each expanded chat stage proves terminal truth and file observation remain intact while partial parts remain unbindable.

The bridge preserves the remaining fields. The applier accepts an injected activity owner and all foreground/headless drain callers await canonical application in stream order. Any future genuinely incremental production-adapter lifecycle remains inert until a separately owner-approved provenance SPEC defines its phase-origin and transition contract.

For OpenCode the activity owner receives the atomic terminal snapshot. Synthetic fixture paths exercise announced, complete arguments, terminal result, bounce, explicit stop interruption, unexpected harness-stream/process failure, and startup interruption without activating another production adapter. Every foreground and headless harness drain wraps its awaited loop in a terminalizer: if the iterator rejects or ends without closing a fixture-established active tool call, it durably closes that call as `interrupted`, creates/retains its observation job in the same transaction, attempts bounded tool-fact admission/scheduling, and then reports the harness failure/turn outcome without waiting for filesystem observation. The admitted-owner scheduler performs actual inspection/retries later. A real OpenCode failure before any terminal ToolPart provides no tool-call identity and therefore creates no invented activity. Provenance errors are diagnosed and do not rewrite or suppress existing assistant parts/legacy chat delivery.

`argumentsSha256` is lowercase SHA-256 over the UTF-8 bytes of the first complete parsed argument value using the exact ordering/primitive/string rules of the accepted `lib/event-registry/canonical-json.js` canonicalizer. `resultSha256` applies the same algorithm to the exact persisted JSON result representation. The applier creates that representation once by applying the existing exchange JSON serialization boundary to the host-owned result object and parsing the resulting JSON text; omitted `undefined` properties are absent from both the value inserted into the assistant tool part and the fingerprint input. The same JSON-safe value—not the pre-serialization object—is used for chat persistence and hashing. The fingerprint input is not redacted or otherwise rewritten; approval of ATP-D15 approves only this local digest of an already-retained value, never its raw publication.

Fingerprinting runs through a bounded incremental equivalent of that canonicalizer: maximum depth 32, maximum 10,000 visited values/object properties/array elements, and maximum 1,048,576 canonical UTF-8 bytes, with cap-plus-one detection and no complete canonical string retained. It preserves the existing canonicalizer's lexicographic object-key order, negative-zero normalization, and rejection of non-finite numbers, unpaired surrogates, unsupported values, cycles, accessors, symbols, non-plain objects, and sparse/decorated arrays. Invalid/incomplete argument chunks, absent results, failure to produce/parse the shared JSON-safe persisted result, canonicalization rejection, or any exceeded cap omit only that digest and emit one fixed value-free diagnostic; tool activity, rendering, and resource extraction continue. Hash computation may inspect the in-flight values but must not copy raw or canonicalized arguments/results into the normalized repository, facts, diagnostics, or logs. Fixtures prove ordinary success/error/bounce results with omitted undefined fields, equality to the eventual exchange representation, key-order equivalence, Unicode/number behavior, exact cap-minus/equal/plus boundaries, structural caps, and fail-open omission.

### 8.2 Structured OpenCode extraction

An explicit allowlisted extractor table owns native tool mappings:

| Native/canonical tool | Exact fields considered | Access |
|---|---|---|
| `read` | `filePath`, compatibility alias `file_path` | `read/read` |
| `write` | `filePath`, compatibility alias `file_path` | `write/write` (observer determines first/changed/unchanged state, not causal create) |
| `edit` | `filePath`, compatibility alias `file_path` | `write/write` |
| native `bash` / canonical `shell` | `command` only, under section 8.3 | roles classified by the exact shell grammar |

For `filePath`/`file_path`, exactly one valid string may be present, or both may be present only when byte-identical; conflicting aliases yield no candidate and one fixed value-free diagnostic. A single path exceeding section 8.4's pre-normalization UTF-16 or UTF-8 cap produces one fingerprint-only `invalid_path` edge and no raw path/checkpoint; over-bound tool/call identity still produces no activity. The extractor does not recursively scan arbitrary JSON string fields. The seam is inert beyond the exact mappings above. A future harness, tool name, field, or provider result-file hint requires a separately owner-approved provenance SPEC, a versioned table entry, and tests. Positive fixtures include a full current OpenCode envelope with distinct `part.id` and `part.callID`. Negative fixtures cover missing/wrong-type `callID`, absent/wrong-type/conflicting path aliases, unlisted tool/field/harness inputs, and nonempty terminal `files`; none may produce an edge/checkpoint, echo rejected data, or block existing chat behavior. Separate over-bound-path fixtures require the fingerprint-only rejected edge.

### 8.3 Conservative shell extraction

Only the own string `args.command` is considered for native `bash`/canonical `shell`. Commands over 65,536 UTF-8 bytes or containing NUL/unpaired surrogates produce no candidates, store candidate counts `reported=0`, `retained=0`, `truncated=false`, and emit one fixed value-free diagnostic; the activity and any independently valid argument fingerprint remain. The parser treats the command only as data and contains no shell/evaluator/process API. `candidatesTruncated=true` is reserved exclusively for an actually detected 65th unique candidate.

The v1 tokenizer is deliberately small. Outside quotes, ASCII space/tab delimit words and `;`, LF, `&&`, `||`, and `|` delimit simple-command segments. A word is either one maximal unquoted token or one whole single- or double-quoted token; adjacent quote/unquoted concatenation, CR/control characters, backslash escapes, unmatched quotes, parentheses, lone `&`, and every other shell operator reject the whole segment. Redirections are only `[0-9]?(<|>|>>|<>)TARGET`, with target either adjacent or the next word. `<<`, `<<<`, `>&`, `<&`, missing targets, and multiple redirections sharing one lexical token reject the whole segment. Quotes are removed only after successful tokenization.

Executable names must be bare ASCII names in the table below. Assignments, `env|sudo|command` prefixes, executable paths, `sh|bash|zsh -c`, `npm`, `node`, `python*`, and unlisted commands reject the whole segment and yield no candidates, including redirections. Candidate path words containing `$`, backtick, `*`, `?`, `[`, `]`, `{`, `}`, or leading `~` are dynamic and reject that segment's operand/redirection extraction. No filesystem lookup is used to reinterpret an unknown word.

After removing valid redirections, the remaining tokens must match exactly one row. `--` is accepted only where shown; an otherwise option-looking token rejects the segment unless it occurs after `--` as a path operand.

| Command | Exact accepted operands/options | Operand-derived edges |
|---|---|---|
| `cat`, `head`, `tail`, `wc`, `stat`, `file` | optional `--`, then 1+ paths; no other option | every path `read/read` |
| `grep`, `rg` | optional `--`, then one ignored literal pattern and 1+ paths; no other option | file paths only `read/read` |
| `touch` | optional `--`, then 1+ paths | every path `write/write` |
| `truncate` | exact `-s SIZE` or `--size SIZE`, optional following `--`, then 1+ paths; `SIZE` is ASCII decimal digits | every path `write/write` |
| `rm` | optional `--`, then 1+ paths | every path `write/delete` |
| `unlink` | optional `--`, then exactly 1 path | path `write/delete` |
| `tee` | optional `-a`, optional following `--`, then 1+ paths | every path `write/write` |
| `cp` | optional `--`, then exactly 2 paths | source `read/read`; destination `write/write` |
| `mv` | optional `--`, then exactly 2 paths | source `write/move_from`; destination `write/move_to` |

Valid redirection edges are added before table operands in lexical order: `<` is `read/read` with `shell_input_redirection`; `>` and `>>` are `write/write` with `shell_output_redirection`; `<>` produces read then write edges for the same target with the respective bases. Numeric file-descriptor prefixes do not become operands. Table operands use `shell_known_operand`.

Deduplication uses section 9's exact key and earliest ordinal. Counting stops after detecting the 65th unique candidate: stored `candidate_reported_count=65` means “at least 65,” exactly 64 are retained, and truncation is true without scanning remaining segments. Required fixtures cover every table row; optional `--`; option-looking paths after `--`; adjacent/separate redirections; spaces/Unicode inside whole quotes; source/destination roles; duplicates; cap 63/64/65; malformed/unsupported operators; unknown options/commands; executable paths; nested shells; substitutions/variables/globs; dynamic redirection targets; and BSD/GNU forms deliberately excluded such as `head -n`, `grep -e`, `cp -R`, and `sed -i`. Excluded forms must produce no candidate rather than guess.

### 8.4 Path admission

Path admission is a pure lexical operation bound exclusively to the immutable prompt-captured canonical workspace root/harness cwd from section 8.0; in this MVP the OpenCode cwd and workspace root are the same captured directory. It never consults the renderer's active workspace, a later session root, `realpath`, `stat`, `lstat`, or any other filesystem state. Therefore a missing ancestor, missing final name, parent symlink, or final symlink can be accepted lexically and decided only by the descriptor-relative observer.

The component algorithm is exact. Require a scalar string with no NUL or backslash. Before splitting or scanning components, read JavaScript `.length` once: more than 4,096 UTF-16 code units takes the bounded fingerprint-only `invalid_path` branch immediately; otherwise validate scalar form and encode with a 4,097-byte cap, rejecting `invalid_path` if raw UTF-8 exceeds 4,096 bytes even when later lexical normalization could shorten it. Interpret `/` only as a separator; preserve Unicode scalar values exactly and perform no percent decoding, case folding, or normalization. Split the bounded candidate and process left-to-right: empty components caused by repeated/leading/trailing slash and `.` are discarded; `..` pops one accumulated component, and a relative candidate that would pop an empty stack is `outside_workspace`. For a relative candidate, the resulting stack is relative to the captured root. For an absolute candidate, first apply the same stack normalization to both the candidate and captured canonical root and require the root's complete component sequence as an exact prefix; strip that prefix to obtain the workspace-relative stack, otherwise reject `outside_workspace`. The stripped/result stack must contain at least one component and its `/`-joined UTF-8 form must be at most 4,096 bytes; unpaired surrogates, an empty/root-only target, or any other bound failure is `invalid_path`. No symlink or missing-target interpretation occurs in admission. The canonical joined relative path is the sole input later passed to the native observer, whose boundary independently rejects noncanonical components.

Accepted paths are stored workspace-relative with `/` separators. `file_name` is the final path segment. `folder_path` is the canonical workspace-relative parent without a trailing slash; for a root-level file such as `README.md`, it is exactly the empty string `''`. The alternatives `'.'` and `'/'` are invalid folder representations. Outside paths retain only candidate SHA-256 and `outside_workspace`; raw outside values never enter the normalized edge, event, logs, or diagnostics. Required fixtures cover relative and absolute A→B→A navigation, root-prefix boundary (`/root-a` versus `/root-ab`), repeated separators/dot components, escaping traversal, root-only input, missing ancestors/final names, and parent/final symlinks reaching the native phase matrix rather than being pre-rejected.

`candidateSha256` is lowercase SHA-256 over one of two exact domain-separated byte sequences:

- accepted candidate: ASCII bytes `fusion-agent-candidate-v1`, one NUL byte, ASCII `accepted`, one NUL byte, then the accepted canonical workspace-relative path's exact UTF-8 bytes;
- rejected string candidate: ASCII bytes `fusion-agent-candidate-v1`, NUL, ASCII `rejected`, NUL, the exact ASCII rejection reason, NUL, canonical unsigned-decimal JavaScript UTF-16 code-unit length, NUL, then at most the first 4,097 UTF-16 code units encoded little-endian exactly as their 16-bit values.

Accepted canonical paths are already bounded to 4,096 UTF-8 bytes. Their Unicode scalar sequence is preserved exactly: no NFC/NFD normalization, locale case-folding, or percent decoding is added. The rejected branch is deliberately bounded even for an arbitrarily large parsed string: `.length` is read once, `slice(0, 4097)` is the only charged prefix, and no suffix scan/UTF-8 conversion occurs. This also gives a deterministic fingerprint for unpaired-surrogate input without replacement encoding. Rejected fingerprints are privacy-preserving bounded correlation hints, not full-content hashes or accepted identities; two rejected values with the same reason, code-unit length, and charged prefix may intentionally collapse.

Candidate admission and this fingerprinting occur before candidate deduplication. The exact dedupe key is `(candidateSha256, accessFamily, accessKind, extractionBasis)`; for accepted paths this makes lexical aliases that resolve to the same canonical path collapse while preserving distinct access roles/bases. The earliest extractor position wins. After dedupe, retained candidates receive `candidate_ordinal` values exactly `0..63` in retained emission order; a dual-role token such as `cp x x` emits the read edge before the write edge. The reported/retained cap is applied to these dedupe keys: detection of the 65th unique key stores the saturating reported count 65, retains the first 64, sets truncation true, and performs no further path work. Wrong-type/missing structured fields and ignored dynamic shell forms never become candidates and receive no candidate hash.

### 8.5 Serialized turn finalization

Each turn owner has one FIFO canonical-application queue and one monotonic ingress ordinal. A `tool_snapshot` is an ordinary queued event that terminalizes only its named activity; it never closes turn ingress and never emits `turn_end`. Later assistant text, additional tool snapshots, and nonterminal `step_finish(reason='tool-calls')` remain admissible in order. Only a true provider turn-terminal signal, stop request, iterator end/error, process close/error, or shutdown enters the private turn finalizer; no caller emits `turn_end` independently. The first turn-finalization request atomically closes ingress and appends a barrier after every event already accepted into that queue. Events arriving after that barrier are late and ignored with a fixed value-free diagnostic.

Precedence is exact: every tool snapshot reserved before the barrier keeps its `completed|error` truth; stop/process/shutdown cannot overwrite it. If the barrier finds a fixture-established announced activity without terminal truth, it closes it once as `interrupted`, durably creates/retains its observation job, attempts bounded fact admission/scheduler signaling, and then emits exactly one turn end without waiting for filesystem inspection or retry backoff. Duplicate finalization requests join the same bounded result. No terminal activity may transition to another status. Required ordering fixtures include tool→assistant-text→true-final-step, two tools separated by text, nonterminal `step_finish(reason='tool-calls')`, a terminal snapshot already queued when stop closes ingress, and a three-timeout observation proving turn end precedes asynchronous observation completion.

Stop sends SIGTERM immediately after closing ingress, then drains the pre-barrier application queue for at most 2,000 monotonic milliseconds. It waits at most 2,000 ms for process close, sends SIGKILL if still live, and waits at most 1,000 additional ms. Provenance/database finalization also has a 2,000 ms deadline; expiry records a durable pending state when already reserved or a fixed diagnostic otherwise, then releases the turn. Shutdown admits no new turns and waits at most 5,000 ms total per active turn while applying the same deadlines concurrently; a nonsettling child or provenance task cannot block server shutdown. Timer minus/equal/plus boundaries, already-queued terminal snapshot, SIGTERM-close, SIGTERM-ignore/SIGKILL, close/error/stop races, late result, duplicate terminal, exactly-one-turn-end, and foreground/headless parity are required fixtures.

### 8.6 Bounded terminal reservation

Every ordinary OpenCode terminal snapshot gets a private `TerminalReservationGate` with an absolute 2,000-monotonic-ms deadline. The activity owner performs at most five immediate retryable attempts with `setImmediate` yields and no delayed retry. Each attempt must check the gate immediately before entering the transaction. The transaction callback atomically changes `open -> committing`; a deadline/shutdown callback may atomically change only `open -> cancelled`. A cancelled callback performs no SQL. Startup verifies the shared better-sqlite3 connection reports zero busy timeout for this path and fails only the new provenance feature closed with a fixed diagnostic if not; it never silently changes global database policy. Once `committing`, the production repository uses only the synchronous better-sqlite3 transaction body, so it either commits/rolls back and changes the gate to `settled` before returning control to the event loop. No arbitrary async callback or provider-controlled promise is permitted inside the transaction.

Success means the complete activity/edges/job/fact reservation committed and its post-commit admission wake is scheduler-owned. Retry exhaustion, deadline cancellation before `committing`, or any non-retryable database error emits fixed value-free `agent_tool_reservation_failed`, creates no partial provenance row, and returns the fail-open result to the canonical applier. The applier then performs the existing call → arguments → result expansion and continues later chat events. A callback that resumes after cancellation observes `cancelled`, performs no SQL or chat mutation, and is retained only in the activity owner's tracked cleanup set until it settles; it cannot create late provenance. Shutdown cancels every still-open gate and drains that cleanup set under section 13 before database close. A transaction that already reached `committing` is synchronous and cannot cross the event-loop deadline callback.

Interrupted fixture lifecycle reservations use the same gate but the smaller remaining turn-finalizer deadline; they never extend the section 8.5 bound. Required busy-attempt minus/equal/plus, non-retryable, cancellation immediately before transaction, never-settling pre-transaction callback, late-resume, and shutdown tests prove no partial/late row, no unhandled rejection, and bounded delivery of the legacy result plus later assistant text/turn end.

## 9. Observation And Checkpoint Contract

For every accepted candidate at a terminal boundary:

1. Serialize Fusion-side identity/checkpoint work through the same host-owned workspace/canonical-path coordinator injected into the existing File Save Controller. Mediated saves retain the coordinator's existing 32-entry bounded waiter queue and always have priority over observations. An observer uses only non-queuing `tryAcquireObservation`: if the path is held or any mediated-save waiter exists for that path, it consumes no waiter slot and no observation attempt, leaves the edge/job pending with the job eligible at `now+100 ms`, and releases its scheduler slot. Every installed observation claim still counts toward the 16-disposition batch cap. Once acquired, the observer owns the coordinator for at most 2,000 monotonic milliseconds total, including attempt reservation, native I/O, immediate checkpoint/outcome transaction attempts, cleanup, and result disposal. It never retains the coordinator during a 1,000-ms delayed database retry. If the checkpoint/outcome cannot commit before release, the bytes/result are permanently discarded and only the no-result settlement in section 7.7 may run; any later attempt must reacquire the coordinator and read fresh state.

   To preserve the existing per-path admission invariant of one active save plus 32 waiting saves, the coordinator exposes exactly one save-only priority handoff slot while an observation is the active owner. The first save arriving during that observation atomically occupies the handoff slot rather than the 32-entry waiter queue; later saves enter the existing FIFO queue. On observation release, the handoff save becomes active before queued saves or another observation, and the slot disappears with that ownership transition. If all 32 waiter entries plus the handoff are occupied, the next save returns the existing `save_busy`, exactly as the 34th simultaneous save would without an observer; the slot cannot be used by observers, cannot exist when a save is active, and cannot increase save capacity above the existing total of 33. Required minus/equal/plus fixtures prove 32/33/34 simultaneous saves with and without an active observer, FIFO order, observation release, and no duplicate ownership. Therefore an observation does not change which bounded save in the same arrival pattern first receives `save_busy`; a save arriving during an already-running observation waits behind at most that one total 2,000-ms ownership window. The lock begins after the already-executed agent tool reports; it does not pretend to serialize or authorize external tool execution itself.
2. Resolve the captured workspace authority again; never trust a mutable session/client root and never substitute the renderer's currently active workspace.
3. Use the required bundled asynchronous Darwin Node-API secure observer at `fusion-studio-server/native/secure-file-observer/`; JavaScript path-based `lstat/open` is not a safety fallback. Its exact input is the captured canonical root path, expected root device/inode, one canonical workspace-relative path, byte limit, monotonic deadline, and cancellation handle. The native boundary independently rejects a non-absolute/NUL-bearing root, an absolute/NUL-bearing relative path, empty/`.`/`..` components, slash-bearing decoded components, and bound violations before opening anything; it never performs percent decoding or Unicode normalization. The native operation opens the captured canonical root with `O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`, verifies its `dev/ino` against immutable turn authority, and traverses each validated canonical relative parent component from that descriptor with `openat(..., O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC)`. It retains the descriptor chain through the decisive final branch. All filesystem work runs off the Node event loop and returns only bounded status/stat/bytes data. The addon uses only the stable C Node-API ABI, has a checked-in `binding.gyp` and JavaScript loader in that directory, and builds through a pinned server development dependency/script before tests or packaging—never by downloading or compiling at runtime. Electron `extraResources` includes `fusion-studio-server/native/**/*`, and `electron:prepare` runs the native build before packaging. Direct-server smoke and packaged smoke must both load the artifact on the supported macOS architecture. The packaged smoke launches through the actual `electron/server-spawn.cjs` `spawnServer` path, uses the Node executable that production resolution selects, and verifies the child server loads the copied `.node` artifact from packaged resources; an Electron run-as-Node substitute does not satisfy acceptance. If the addon cannot load or the platform lacks the required descriptor-relative primitives/flags, record `secure_open_unavailable` and perform no path lookup, registry mutation, checkpoint, or projection. The supported macOS development and packaged builds must compile, package, load, and smoke-test this addon; absence is a tested fail-closed runtime branch, not an acceptable release configuration.
4. Inspect the final name relative to the pinned parent descriptor with `fstatat(parentFd, name, AT_SYMLINK_NOFOLLOW)`. For `ENOENT`, repeat that descriptor-relative lookup and accept absence only when both return `ENOENT` while root/parent descriptor identities remain stable. For a final symlink or non-regular file, repeat `fstatat` and require the same `dev/ino/type` before recording the skip. Never re-resolve the parent or final component through a process-global absolute path. A parent swap-and-restore can therefore change the pathname visible elsewhere but cannot retarget this operation away from the pinned descriptor chain.
5. For a regular file, call `openat(parentFd, name, O_RDONLY|O_NOFOLLOW|O_CLOEXEC)`, then require `fstat` regular type and `dev|ino|size` equality with the descriptor-relative `fstatat`. Read incrementally up to `10 MiB + 1` while enforcing the section 7.7 deadline. After reading, require handle `dev|ino|size|mtime|ctime` stability and repeat `fstatat(parentFd, name, AT_SYMLINK_NOFOLLOW)` with the same `dev|ino` and regular type. Reverify every retained directory descriptor's `dev/ino` before accepting. Only then may bytes be decoded, hashed, or persisted. Retry the complete descriptor-relative sequence once on identity/time change; otherwise record `unstable_during_observation`. Every descriptor is closed in the native operation's guaranteed cleanup path, and bytes from any unstable/swap branch are discarded before hashing or persistence.
6. Reject over 10 MiB before allocation where possible and after a guarded `limit + 1` read.
7. Fatal-decode UTF-8, reject NUL, re-encode, and require byte-for-byte equality.
8. Group same-activity candidates by canonical workspace path. Preserve distinct access edges for queries, but inspect once using the dominant edge: write-family before read, read before execute, execute before unknown, then lowest candidate ordinal. Exact duplicate edges use `(candidateSha256, accessFamily, accessKind, extractionBasis)` and retain the earliest ordinal. The tool fact's `resources` array is always sorted by ascending `candidate_ordinal`; this ordering is part of its canonical JSON/hash and the ledger edge order.
9. Compare state/hash/length with the latest checkpoint inside the serialized transaction and apply the one result to every sibling edge in the group with the same observed time/snapshot reference. The same transaction inserts the dominant edge's pending renderer-projection job from section 7.8.
10. For unchanged state, update all grouped edges to `unchanged`, point them to the current snapshot, emit no new snapshot or observation fact, commit the projection job, and signal its scheduler after commit.
11. For first/changed state, insert/reuse the blob, insert a checkpoint and durable fact reservation using the dominant edge, mark all grouped edges, and commit the projection job. After commit, submit `resource.state_observed@1` for governed admission first and then signal the projection scheduler. The checkpoint and projection job remain durable when admission is pending or either signal is lost.
12. The projection scheduler applies the exact gate/fallback/retry state machine in sections 7.8 and 12. First/changed v2 is forbidden until the checkpoint row reaches `fact_admission_state='admitted'`; pending/conflict can emit only the identity-safe refresh-required shape. Projection failure never alters checkpoint/fact truth, and crash/restart never requires an unbounded historical edge rescan because unsettled work is selected only from the durable job table.

The native observer's phase/outcome matrix is closed. “Retry once” below means discard all data, close every descriptor, and start one complete descriptor-relative sequence from the immutable root; if the same retry-class condition prevents a stable result again, return `unstable_during_observation`. `EINTR` is retried within the same bounded syscall phase until success or the monotonic deadline; deadline exhaustion is `observation_timeout`. No listed or unlisted branch permits a pathname fallback.

| Phase | Exact branch | Outcome |
|---|---|---|
| addon load / required flag availability | addon missing, wrong architecture/ABI, or required descriptor-relative/no-follow flag unavailable | failed `secure_open_unavailable`; no lookup or mutation |
| captured-root open/verify | persistent `ENOENT|ENOTDIR|ELOOP`, access denial, or persistent root `dev/ino` mismatch after one complete retry | failed `workspace_unavailable` |
| parent-component `openat` | first `ENOENT` | repeat the complete sequence; the same component ordinal returning `ENOENT` again under the verified root accepts target state `absent` |
| parent-component `openat` | `ELOOP|ENOTDIR` | inspect that component with descriptor-relative no-follow `fstatat`; repeat the complete sequence and require the same `dev/ino/type`; then skipped `invalid_path`; any change is retry-class and second instability fails `unstable_during_observation` |
| parent-component `openat` | `EACCES|EPERM` or other stable I/O error | failed `unreadable` |
| final `fstatat` | `ENOENT` | repeat the complete sequence and require final `ENOENT` again under the verified descriptor chain; then accept target state `absent` |
| final `fstatat` | stable symlink | skipped `final_symlink` after the second complete sequence confirms the same `dev/ino/type` |
| final `fstatat` | stable non-regular type | skipped `not_regular_file` after the second complete sequence confirms the same `dev/ino/type` |
| final `fstatat` | `EACCES|EPERM` or other stable I/O error | failed `unreadable` |
| final regular `openat` / initial `fstat` | `EINVAL|ENOTSUP` attributable to required no-follow operation | failed `secure_open_unavailable` |
| final regular `openat` / initial `fstat` | `EACCES|EPERM` or stable resource/I/O error | failed `unreadable` |
| final regular `openat` / initial `fstat` | `ENOENT|ELOOP|ENOTDIR`, type change, or `dev/ino/size` mismatch from the preceding final `fstatat` | retry-class; a second unstable sequence fails `unstable_during_observation` |
| bounded read | read error | failed `unreadable`; timeout and size limit retain their exact `observation_timeout`/`too_large` branches |
| post-read final/descriptor revalidation | disappearance, symlink/type/identity/time change, or descriptor-chain mismatch | retry-class; a second unstable sequence fails `unstable_during_observation` |
| cooperative shutdown cancellation | close every descriptor, persist no filesystem conclusion, and leave the running claim for exact lease recovery by `claimed_attempt` |

For any errno not explicitly named, the addon classifies it only as: timeout when the deadline expired; retry-class when a previously observed identity or lookup state changed; otherwise stable I/O failure `unreadable`. A decisive branch captures one `edgeObservedAt = Date.now()` after the final secure result and before its database transaction; all grouped edges use that exact value as `observed_at`. For a successful first/changed checkpoint, `snapshotObservedAt` is exactly that same value; for unchanged, the new edge observation clock remains distinct from the reused checkpoint's older clock. Skipped/failed outcomes use `edgeObservedAt` but create no snapshot. The pre-observation rejections above are the sole exception and use the already persisted terminal observation clock.

Read candidates may seed a first checkpoint. Every successful eligible observation triggers File Viewer invalidation regardless of access family, because the cache may not contain the observed state without claiming why; ATP-unchanged is relative only to the latest ATP checkpoint. Error/result-phase-bounce/interrupted fixture tools are inspected because work may have partially occurred. A verified genuinely pre-execution fixture bounce is recorded `blocked` and its edges are marked skipped without claiming execution.

Infrastructure failure leaves `pending` or `failed` state with a fixed diagnostic. Startup reconciliation processes durable pending work in activity/edge order. A delayed/reconciled snapshot carries its actual later `snapshotObservedAt`; it is never backdated to tool completion.

## 10. Governed Fact Contracts

### 10.1 `agent.tool_completed@1`

Published once a terminal/interrupted activity row and resource edges are durably reserved. It contains no raw arguments/results:

```ts
type AgentToolCompletedV1 = {
  eventId: string;
  eventType: 'agent.tool_completed';
  schemaVersion: 1;
  occurredAt: number;             // terminalObservedAt
  workspaceId: string;
  operationId: string;            // activityId
  origin: {
    kind: 'agent_harness';
    harnessId: string;
    provider: string;
    assurance: 'adapter_observed';
  };
  thread: { threadId: string; turnId: string };
  tool: {
    toolCallId: string;
    name: string;
    nativeName: string;
    status: 'completed' | 'error' | 'blocked' | 'interrupted';
    argumentsSha256?: string;
    resultSha256?: string;
  };
  timing: ToolFactTimingV1;
  resources: Array<{
    edgeId: string;
    path?: string;
    candidateSha256: string;
    accessFamily: 'read' | 'write' | 'execute' | 'unknown';
    accessKind: 'read' | 'write' | 'create' | 'delete' | 'move_from' | 'move_to' | 'execute' | 'unknown';
    extractionBasis: ExtractionBasisV1;
    rejectionReason?: PreObservationRejectionReasonV1;
  }>;
  candidatesTruncated: boolean;
};
```

The terminal reservation transaction stores the exact canonical `agent.tool_completed@1` JSON body and its lowercase SHA-256 before publication. Its `resources` array is in ascending `candidate_ordinal`, including read before write for the dual-role `cp x x` fixture. The body never contains `exchangeId`, `exchangeSavedAt`, `exchangeBoundAt`, resource identity assigned by later observation, or any later edge state. Observation and exchange binding may update normalized rows but never reconstruct or mutate the reserved tool fact. Admission verification and every startup replay use only the stored immutable body/hash; body/hash mismatch marks conflict and publishes nothing.

### 10.2 `resource.state_observed@1`

Published only for a new checkpoint:

```ts
type ResourceStateObservedV1 = {
  eventId: string;
  eventType: 'resource.state_observed';
  schemaVersion: 1;
  occurredAt: number;             // snapshotObservedAt
  workspaceId: string;
  operationId: string;            // observationId
  source: {
    activityId: string;
    edgeId: string;
    threadId: string;
    turnId: string;
    toolCallId: string;
    harnessId: string;
    accessFamily: 'read' | 'write' | 'execute' | 'unknown';
    accessKind: 'read' | 'write' | 'create' | 'delete' | 'move_from' | 'move_to' | 'execute' | 'unknown';
    extractionBasis: ExtractionBasisV1;
  };
} & (
  | {
      resource: { resourceId: string; kind: 'file'; path: string };
      observation: {
        snapshotId: string;
        state: 'bytes';
        relation: 'first_observation' | 'changed';
        sha256: string;
        byteLength: number;
        previousSnapshotId?: string;
      };
    }
  | {
      resource: { kind: 'file'; path: string };
      observation: {
        snapshotId: string;
        state: 'absent';
        relation: 'first_observation' | 'changed';
        byteLength: 0;
        previousSnapshotId?: string;
      };
    }
);
```

The checkpoint transaction likewise stores the exact canonical `resource.state_observed@1` JSON body and hash with the snapshot. Admission verification/replay uses that frozen body rather than rebuilding it from mutable resource/edge rows.

### 10.3 Publisher and subscriber topology

The sealed publisher catalog adds only:

- `system.agent-tool-activity-controller -> agent.tool_completed@1`;
- `system.agent-resource-observer -> resource.state_observed@1`.

Reservation verification routes by exact producer/schema to the owning durable repository. Publisher installers are one-shot and sealed before public sockets, watchers, triggers, or dynamic definitions start.

For only these two new producer/schema pairs, governed admission adds one private host-injected `commitVerifiedAgentAdmission` step after canonical body/hash and JSON-Schema validation but before `deliverAdmittedFact`. It is not exported or placed in a handler capability. The step re-verifies the exact durable source identity/body hash and atomically performs `fact_admission_state pending -> admitted` plus `ledger_state not_ready -> pending`, ledger attempt 0, and ledger-next equal to one captured host time. An already-admitted row with the same identity/body is idempotent and retains its current ledger state; a missing, conflicting, or differently bound row rejects publication before any subscriber runs. Existing file-save publishers and their post-return state flow are byte-behavior unchanged. For the two new facts, `publishFact` reports `admitted: true` only after this commit, and delivery timeout/failure does not revoke admission; durable observer/ledger states own recovery. Thus every new required-ack handler sees an admitted source row, and no observation job can race a pending fact.

One host-owned `AgentFactAdmissionReconciler` owns pending admission replay for both source tables. It selects only non-suppressed `fact_admission_state='pending'` rows in total order `(source_occurred_at, source_kind_rank, internal_id, event_id)`: tool time is `terminal_observed_at`, observation time is `snapshot_observed_at`, the explicit rank is `tool=0` and `observation=1`, and the table-local integer key plus event UUID break ties. It processes with concurrency 1 and at most 100 selected-source dispositions per yielded batch. Before public sockets its pass stops after 100 dispositions or 1,000 monotonic milliseconds, whichever comes first. After sockets, every batch that leaves another eligible pending source schedules exactly one continuation after an event-loop yield; only one continuation may be outstanding, and the same rule repeats until eligible backlog is empty. Terminal activity/checkpoint reservation signals it after commit. It has no polling interval.

For each selected source, the reconciler submits the already-frozen canonical body through the exact sealed publisher, so schema/semantic validation, owner/body-hash verification, pre-dispatch admission commit, and normal UEB delivery are identical to the live path. A canonical parse/schema/semantic/body-hash/owner mismatch atomically moves only that still-pending source to `fact_admission_state='conflict'`, retains ledger `not_ready`, emits fixed value-free `agent_fact_admission_conflict`, and never delivers it. Admission commit success removes the source from this queue even when later subscriber delivery times out or fails. Immediately after any live or replay admission commit, private wake-only continuations signal the ledger scheduler and, as applicable, the admitted tool's observation scheduler or the renderer-projection scheduler; they do not perform filesystem work, append ledger rows, send renderer messages, or bypass fact verification, and they make handler delivery failure recoverable without republishing an admitted fact.

Each admission read/commit/conflict transition receives five immediate `runBoundedSqliteRetry` attempts with `setImmediate` yields. First retryable exhaustion for the exact key `tool:<event_id>` or `observation:<event_id>` stops the drain, marks that key delayed/ineligible, and arms exactly one in-memory retry at `now+1,000 ms`; unrelated signals cannot select it early. If that bounded retry also exhausts, it emits fixed `agent_fact_admission_failed`, moves the key from delayed to suppressed for the current process, and arms no further timer for it. A non-retryable operational database error emits the same diagnostic and suppresses immediately; a non-retryable semantic mismatch uses the conflict transition above, and failure to persist that conflict follows the same five-plus-one transition rule before suppression. Selection and yielded continuation exclude delayed and suppressed keys. Restart clears both sets and grants the same one-delayed-retry allowance. Shutdown cancels unstarted delayed timers, starts no new source, waits at most 2,000 monotonic milliseconds for the current bounded operation, and otherwise leaves the source honestly pending for restart with no detached promise.

Locked subscriptions:

| Priority | Handler | Consumes | Exact effective capabilities |
|---:|---|---|---|
| -100 | `system.agent-provenance-ledger` | both new facts | `required_ack`, fixed 2,000 ms existing controller deadline; consume exact types; claim/append the exact admitted fact to agent/event ledger under section 10.4; fixed diagnostics |
| -50 | `system.agent-resource-observer` | tool-completed only | `required_ack`, fixed 2,000 ms existing controller deadline; consume exact type and signal only admitted-owner durable observation jobs; later observer work may publish only durably reserved observation facts and creates renderer-projection jobs under sections 7.8–9; fixed diagnostics |

The agent ledger verifies facts against already-admitted durable rows before appending `event_log` and `event_resource_edges`. Duplicate event IDs are idempotent only for an identical canonical hash/owner binding; conflicts are diagnosed and retained. The observer handler may signal an admitted tool's job during the same delivery, but claims remain governed by the durable admitted row rather than caller timing.

`required_ack` is allowed only for an exact allowlist of locked, system-owned durable ledger/observer handlers. This SPEC retains the controller's fixed 2,000 ms deadline rather than adding database-configurable timing. Timeout reports failure without cancelling an already-running handler; this observer handler performs no filesystem work, and durable pending state remains eligible for the bounded admission/scheduler reconciliation above. The renderer-projection scheduler's authority is a narrow host-injected capability: it verifies the committed job, admitted owning tool fact, persisted dominant-edge outcome, and—when relation is first/changed and v2 is selected—the admitted checkpoint fact before deriving the current session epoch and emitting the exact v2 or fallback message. It exposes no socket, session map, generic send, or publisher. A pending/conflicting checkpoint fact can produce only the strict refresh-required fallback and never exposes its unpublished IDs. Projection delivery remains bounded best effort with durable job recovery, and startup projection-job reconciliation invokes the same exact gates.

No handler receives raw Knex, `fs`, session maps, sockets, generic `emit`, generic `publishFact`, or arbitrary commands.

### 10.4 Exact migration-029 ledger projection

ATP-D17 authorizes only the following two projections. The handler first verifies the admitted fact against its producer-owned immutable body/hash. On a first insert, `projectedAt` is a fresh host timestamp used for `event_log.created_at` and source-row bookkeeping; it never replaces `occurred_at`. Once inserted, `event_log.created_at` is first-write-owned: duplicate replay excludes it from comparison and preserves the stored value rather than comparing a fresh clock.

| `event_log` column | `agent.tool_completed@1` | `resource.state_observed@1` |
|---|---|---|
| `event_id` | `fact.eventId` | `fact.eventId` |
| `event_type` | exact `agent.tool_completed` | exact `resource.state_observed` |
| `workspace_id` | `fact.workspaceId` | `fact.workspaceId` |
| `machine_id`, `machine_name` | null, null | null, null |
| `actor_type` | exact `agent_harness` | exact `agent_harness` |
| `actor_id` | `fact.origin.harnessId` | `fact.source.harnessId` |
| `occurred_at` | `fact.occurredAt` | `fact.occurredAt` |
| `summary` | exact ``Agent tool ${fact.tool.status}: ${fact.tool.name}`` | exact ``Observed file state: ${fact.observation.state}`` |
| `payload_json` | exact immutable canonical fact JSON | exact immutable canonical fact JSON |
| `source_module` | exact `agent-tool-activity-controller` | exact `agent-resource-observer` |
| `correlation_id` | `fact.operationId` (activity ID) | `fact.source.activityId` |
| `causation_id` | null | null |
| `created_at` | `projectedAt` | `projectedAt` |

The tool projection inserts one `event_resource_edges` row for each fact resource that has an accepted `path`, in fact-array order: `resource_type='file'`, `resource_id=NULL`, fact workspace, `machine_id=NULL`, exact canonical path, and role `agent_read|agent_write|agent_execute|agent_unknown` mapped only from `accessFamily`. Fingerprint-only rejected candidates create no migration-029 resource edge. The observation projection inserts exactly one edge: file type, bytes resource ID or null for absent, fact workspace, null machine, exact fact path, role `observed`. Neither projection inserts `event_tags` or an event-to-event/causal graph edge.

Before any ledger lookup/write cycle, a compare-and-set transaction claims one admitted due source row by moving `pending -> running`, incrementing `ledger_attempt_count`, clearing ledger-next, and installing a fresh UUID claim token with one captured `claimedAt` and `leaseExpiresAt = claimedAt+30,000 ms`. Only the matching token may store, conflict, fail, or reschedule that row. This durable pre-charge means a process crash cannot repeat an uncounted cycle. Attempt values 1, 2, and 3 identify the first, second, and final cycle.

Each claimed append is one bounded transaction containing token/source-row verification, event lookup/insert, all resource-edge inserts, and the source row's `running -> stored` transition with claim clearing. Existing `event_id` is idempotent only when every producer-controlled mapped `event_log` field except first-write-owned `created_at`, exact `payload_json`, owner operation ID/body hash, and ordered resource-edge sequence match; then the running source becomes stored without reinsertion or timestamp change. Resource-edge replay comparison orders stored rows by `event_resource_edges.id` and compares them positionally with the fact-array order. Any mismatch moves the claimed source to `conflict`, clears the claim, emits fixed `agent_ledger_conflict`, and overwrites nothing. Missing/wrong source emits fixed `agent_ledger_source_missing` and writes no event. No diagnostic includes payload, path, argument/result hash input, or bytes.

One claimed projection cycle uses exactly the accepted `runBoundedSqliteRetry` policy: five transaction attempts, one `setImmediate` yield between retryable attempts, and no inline sleep or new event ID. If claimed cycle 1 exhausts, a token-checked transition captures one `transitionNow`, clears the claim, and records pending with next `transitionNow+250 ms`; cycle 2 exhaustion uses `transitionNow+1,000 ms`; cycle 3 exhaustion clears the claim and records terminal failed with null next plus `agent_tool_ledger_contention` or `agent_observation_ledger_contention`. A non-retryable projection error token-conditionally records terminal failed immediately, clears the claim, and emits fixed `agent_ledger_write_failed`; it never changes tool/checkpoint truth. Conflict remains the separate semantic terminal state.

Running-claim recovery never reruns the charged cycle. At startup and at the claim's 30-second expiry, a token-checked recovery captures `transitionNow`: charged attempt 1 becomes pending at `transitionNow+250 ms`; attempt 2 becomes pending at `transitionNow+1,000 ms`; attempt 3 becomes terminal failed. Every claim/outcome/recovery transition first receives the accepted five-attempt database retry. On its first retryable exhaustion, a tokenless pending transition is keyed `tool:<event_id>` or `observation:<event_id>` and a running transition is keyed `claim:<ledger_claim_token>`; the singleton marks that key delayed/ineligible and arms exactly one in-memory retry at `now+1,000 ms` without immediate self-signaling. Unrelated signals and ordinary due/lease selection cannot select a delayed key. If that second bounded transition attempt also exhausts, it emits fixed `agent_ledger_transition_failed`, moves the exact key from delayed to suppressed in memory, and arms no further automatic timer for it in the current process. Any non-retryable database error in a claim, reschedule, terminal-outcome, or lease-recovery transition emits the same diagnostic and immediately suppresses the corresponding source/claim key without a delayed retry. A terminal transition attempted in response to a non-retryable projection error is itself governed by these rules; failure to write it leaves the charged row honestly running and suppressed rather than pretending it failed durably. The row otherwise remains honestly pending or running, including a charged claim whose terminal transition could not be written. Suppression resets only on restart, where bounded startup claim/recovery receives a fresh single-delayed-retry allowance. No projection cycle begins without a durable running claim, and a failed transition retry never executes another projection cycle.

A singleton concurrency-one ledger reconciler claims only admitted sources not present in the delayed or suppressed sets, with `ledger_state='pending'` and `ledger_next_attempt_at <= now`, at most 100 rows per yielded batch. Its unified deterministic order is `(ledger_next_attempt_at, source_occurred_at, source_kind_rank, internal_id, event_id)`, where activity `source_occurred_at = terminal_observed_at`, snapshot `source_occurred_at = snapshot_observed_at`, and the explicit rank is `tool=0` and `observation=1`; `internal_id` is then compared only within its source-kind table, and UUID `event_id` is the final total-order guard. Its pre-socket pass recovers expired claims not suppressed/delayed, arms eligible unexpired leases, and stops after 100 source rows or 1,000 monotonic milliseconds; remaining due rows continue in event-driven yielded batches. Its one timer is the earlier of the minimum eligible pending-source due time, minimum eligible running-claim lease expiry, or earliest unused 1,000-ms transition retry; there is no polling or self-hot-loop. Shutdown cancels unstarted delayed timers, starts no new claim, waits at most the controller's existing 2,000-ms deadline for the current bounded append, and leaves a running claim for restart recovery rather than undoing its charged cycle. Tests advance clocks across both fact types, prove `created_at` remains unchanged on exact replay, inject crashes before/after claim reservation and before outcome scheduling, cover first and second transition-write exhaustion with proof that no third timer is armed, mixed-source equal-time ordering across a 100-row batch boundary, all three charged cycles, lease recovery, terminal failed state, and prove no fourth projection cycle occurs.

This mapping is factual storage only. Correlation groups the observation with its source activity but is not `causation_id`, causal confidence, accepted-reference proof, or authorship inference.

## 11. Progressive Query Contract

Register strict `agent:activity@1` query/result/error schemas and route them through the current workspace-session/epoch guard.

```ts
type AgentActivityQueryV1 = {
  type: 'agent:activity:query';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  subject: 'tool_calls' | 'resource_edges';
  panel?: string;
  path?: string;
  fileName?: string;
  folderPrefix?: string;
  activityId?: string;
  threadId?: string;
  turnId?: string;
  exchangeId?: number;
  toolCallId?: string;
  harnessId?: string;
  toolNames?: string[];            // 1..16 unique
  statuses?: Array<'announced' | 'completed' | 'error' | 'blocked' | 'interrupted'>;
  accessFamilies?: Array<'read' | 'write' | 'execute' | 'unknown'>;
  accessKinds?: Array<'read' | 'write' | 'create' | 'delete' | 'move_from' | 'move_to' | 'execute' | 'unknown'>;
  changedOnly?: boolean;
  since?: number;
  until?: number;
  cursor?: string;                 // decimal internal key from prior page
  limit?: number;                  // default 50, max 100
};
```

`tool_calls` returns one activity summary per tool call. Path/access filters use indexed `EXISTS` edges. `resource_edges` returns one edge per item. Both sort by internal insertion key descending and return an optional next cursor strictly below the final returned key. Cursor/request combinations are validated; data remains workspace-scoped.

Tool summary includes activity/provider/tool IDs, status, all timing fields, argument/result hashes, candidate counts/truncation, resource/changed counts, fact state, and optional `{exchangeId, toolCallId}` detail reference.

Resource-edge summary additionally includes canonical path/name/folder when accepted, access family/kind/basis, observation state/reason/time, resource ID, snapshot ID, previous observed snapshot ID, and snapshot metadata (`bytes|absent`, hash/length/relation) without bytes.

The registered JSON Schema must make these response shapes exact:

```ts
type ToolActivitySummaryV1 = {
  kind: 'tool_call';
  activityId: string;
  eventId: string;
  workspaceId: string;
  threadId: string;
  turnId: string;
  exchangeId?: number;
  harnessId: string;
  provider: string;
  toolCallId: string;
  toolName: string;
  nativeToolName: string;
  status: 'announced' | 'completed' | 'error' | 'blocked' | 'interrupted';
  timing: ToolLifecycleTimingV1;
  fingerprints: { argumentsSha256?: string; resultSha256?: string };
  candidates: { reported: number; retained: number; truncated: boolean };
  resources: { count: number; changedCount: number };
  fact: {
    admissionState: 'not_ready' | 'pending' | 'admitted' | 'conflict';
    ledgerState: 'not_ready' | 'pending' | 'running' | 'stored' | 'conflict' | 'failed';
  };
  detailRef?: {
    kind: 'exchange_tool_part';
    exchangeId: number;
    toolCallId: string;
  };
};

type ResourceEdgeSummaryV1 = {
  kind: 'resource_edge';
  edgeId: string;
  activityId: string;
  workspaceId: string;
  threadId: string;
  turnId: string;
  exchangeId?: number;
  harnessId: string;
  toolCallId: string;
  toolName: string;
  status: 'announced' | 'completed' | 'error' | 'blocked' | 'interrupted';
  candidateSha256: string;
  resource?: {
    resourceId?: string;
    path: string;
    fileName: string;
    folderPath: string;
  };
  access: {
    family: 'read' | 'write' | 'execute' | 'unknown';
    kind: 'read' | 'write' | 'create' | 'delete' | 'move_from' | 'move_to' | 'execute' | 'unknown';
    extractionBasis: ExtractionBasisV1;
  };
  observation:
    | { state: 'pending' }
    | { state: 'skipped'; reason: ObservationSkipReasonV1; observedAt: number }
    | { state: 'failed'; reason: ObservationFailureReasonV1; observedAt: number }
    | {
        state: 'first_observation' | 'changed' | 'unchanged';
        observedAt: number;
        snapshotId: string;
        previousSnapshotId?: string;
        snapshot:
          | {
              state: 'bytes';
              sha256: string;
              byteLength: number;
              relation: 'first_observation' | 'changed';
            }
          | {
              state: 'absent';
              byteLength: 0;
              relation: 'first_observation' | 'changed';
            };
      };
  detailRef?: {
    kind: 'exchange_tool_part';
    exchangeId: number;
    toolCallId: string;
  };
};

type AgentActivityResultV1 =
  | {
      type: 'agent:activity:result'; version: 1; requestId: string;
      workspaceId: string; workspaceEpoch: string; subject: 'tool_calls';
      items: ToolActivitySummaryV1[]; nextCursor?: string;
    }
  | {
      type: 'agent:activity:result'; version: 1; requestId: string;
      workspaceId: string; workspaceEpoch: string; subject: 'resource_edges';
      items: ResourceEdgeSummaryV1[]; nextCursor?: string;
    };

type AgentActivityErrorV1 = {
  type: 'agent:activity:error';
  version: 1;
  code: 'invalid_request';
  requestId?: string;
} | {
  type: 'agent:activity:error';
  version: 1;
  code: 'workspace_unavailable';
  requestId: string;
} | {
  type: 'agent:activity:error';
  version: 1;
  code: 'invalid_request' | 'stale_workspace' | 'query_failed';
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
};
```

For an unchanged edge, `snapshot.relation` describes the referenced checkpoint’s original creation relation while `observation.state = 'unchanged'` describes this edge. `resource.folderPath` is required whenever the accepted resource object is present and is exactly `''` for a root-level file. `resource.resourceId` is omitted when an accepted canonical path was ineligible to receive a registry identity; the entire `resource` object is omitted for rejected candidates such as outside-workspace values. The first error variant applies only when the envelope/request ID itself is invalid, the second only before a workspace pair exists, and the third after a current pair exists. No response shape may arbitrarily omit pair fields.

Tool-summary aggregates are exact and path-grouped. `resources.count` is the number of distinct accepted canonical paths among retained edges, regardless of observation state. `resources.changedCount` is the number of those distinct paths whose grouped edge outcome is exactly `changed`; `first_observation`, `unchanged`, pending, skipped, failed, and rejected candidates do not count. A path carrying multiple access edges counts once in each applicable aggregate: for example, retained `cp x x` read/write edges produce `count=1` and produce `changedCount=1` only when their shared grouped outcome is changed. Required query and fact fixtures assert this behavior and the fact's ascending-candidate-ordinal read-before-write order.

Exact filter semantics:

- `path` is normalized through server panel/path rules and matches exact canonical path;
- `fileName` is a normalized basename exact match;
- `folderPrefix` matches exact folder or descendant on `/` boundary;
- arrays are OR within a field and AND across fields;
- `changedOnly` means observation relation `changed`, not first observation or write classification;
- `since/until` apply to terminal-observed time for tools and edge-observed time for edges, inclusively;
- absent optional fields are omitted, never returned as invented empty strings/nulls;
- malformed, inactive-schema, query failure, stale workspace, and unavailable workspace branches match established strict v1 route patterns.

Validation order is fixed: validate type/version/request ID/expected workspace pair first; derive and capture the current server session `{workspaceId, workspaceEpoch}` second; require the request pair to match third; validate and normalize selectors fourth; query the captured workspace fifth; and send a response carrying that captured pair only if the route has not already taken its stale/error branch. The request pair is an equality precondition, never authority to select a workspace or root. A delayed response is accepted by the client only when request ID, workspace ID, and epoch still match its pending request and current bind.

String and numeric bounds are exact: request/workspace/thread/turn/harness/tool-name selectors use the section 7.1 `1..128` UTF-8-byte bound; tool-call ID uses `1..512`; panel uses the existing recognized-panel `1..128` bound; path uses `1..4096`; folder uses `0..4096`, with exact `''` selecting only root-level files and `'.'|'/'` rejected; file name uses `1..255`; host activity ID is a lowercase UUID; `exchangeId` is a positive safe integer; `since`/`until` are non-negative safe integer epoch milliseconds with `since <= until`; cursor is the canonical positive decimal representation of a previously returned internal key with no sign, leading zero, or more than 20 digits; and limit defaults to 50 with range `1..100`. Each array contains `1..16` unique exact enum/name values. With `panel`, path/folder selectors are validated under that recognized panel and converted to canonical workspace-relative paths; without it they are already canonical workspace-relative paths. Unknown fields, duplicate array members, empty arrays, null optionals, unsafe integers, unrecognized panels, or invalid normalization return the exact `invalid_request` branch without querying.

The route never exposes raw arguments/results, commands, file content, snapshot bytes, absolute workspace roots, or rejected outside paths.

### Exchange binding

Inside the same transaction that allocates sequence and inserts the exchange, `HistoryFile.addExchange` invokes the injected bind-job writer with immutable turn authority, new exchange ID, and that row's single `exchangeTs`. Job insertion failure rolls back the transaction rather than committing an exchange that cannot be reconciled; it is database-local bookkeeping and performs no UEB/filesystem/provider work. After commit, the bounded binder drains the job under section 7.6. It updates only exact unbound activity matches, never modifies lifecycle timestamps/hashes/edges, and is idempotent for the same exchange. A different binding, duplicate matching tool part, or incomplete/mismatched detail part follows the fixed conflict contract below. `chat-turn:saved` may schedule a drain for compatibility but is not the durability mechanism.

Historical rows are not synthesized from existing exchange JSON.

## 12. File Viewer Projection Contract

Register `resource:changed@2` without altering v1:

```ts
type ResourceChangedV2 = {
  type: 'resource:changed';
  version: 2;
  projectionId: string;            // dominant source edge UUID; stable retry/dedupe key
  sourceActivityId: string;
  sourceEdgeId: string;
  workspaceId: string;
  resourceKind: 'file';
  changeKind: 'state_observed';
  relation: 'first_observation' | 'changed' | 'unchanged';
  panel: 'file-viewer';
  path: string;
  occurredAt: number;
  workspaceEpoch: string;
} & (
  | {
      relation: 'first_observation' | 'changed';
      checkpointEventId: string;
      checkpointObservationId: string;
      snapshotId: string;
    }
  | {
      relation: 'unchanged';
      snapshotId: string;           // existing checkpoint observed again
    }
) & (
  | { state: 'bytes'; resourceId: string }
  | { state: 'absent' }
);
```

Projection policy:

- create one durable job for every successful dominant-edge outcome `first_observation|changed|unchanged`, independent of access family; delivery is at-least-once across the send/settle crash window, and the edge UUID is the stable `projectionId` and retry/dedupe identity;
- `occurredAt` is always the persisted dominant edge's `observed_at` for first, changed, and unchanged outcomes; retry reuses that exact clock and never substitutes send time, checkpoint creation time, or reconnection time;
- first/changed publishes v2 only after its new checkpoint fact is admitted and then carries those admitted identities; unchanged references the reused snapshot and is authorized by the already-admitted owning tool fact, with no invented checkpoint fact identity;
- projection contains no bytes and performs no file read;
- the renderer-projection scheduler's exact scoped capability derives sessions/epoch and uses the existing bind buffer/socket only under a committed durable job claim;
- client validates exact v2 shape, workspace/epoch, projection/source identity, then calls the same canonical File Viewer invalidation/refetch path;
- duplicate exact projection identity is idempotent; a conflicting reuse closes or recovers according to existing central-store policy;
- Office/Email dirty drafts are untouched.

An `absent` observation refetches and adopts the authoritative not-found behavior already defined for File Viewer. It does not silently leave stale content visible.

`unchanged` describes equality with the latest ATP checkpoint, not equality with the current renderer cache. It must still invalidate/refetch because an intervening mediated save or another governed source may have changed the store since that checkpoint. Required watcher-disabled fixtures cover bytes A → mediated save B → agent-observed A and the analogous absent-state interleaving.

Every fallback reuses the existing strict `resource:refresh_required@1` schema unchanged:

```ts
type AgentObservationRefreshRequiredV1 = {
  type: 'resource:refresh_required';
  version: 1;
  workspaceId: string;
  panel: 'file-viewer';
  path: string;
  operationId: string;             // admitted owning activityId only
  workspaceEpoch: string;
  reason: 'fact_publish_failed' | 'projection_failed' | 'projection_unavailable';
};
```

The exact reason mapping is: checkpoint fact still pending or terminally conflicting → `fact_publish_failed`; v2 send/buffer operation rejects after authority validation → `projection_failed`; required projection capability/session binding is unavailable → `projection_unavailable`. `operationId` is always the already-admitted owning activity ID, including for first/changed; it is never the pending/conflicting checkpoint event ID, observation ID, or snapshot ID. Workspace, canonical path, and current server-issued epoch are required. The exact capability may emit only this shape or v2, and neither message echoes diagnostics or unpublished identity.

## 13. Failure, Idempotency, And Recovery

Shutdown uses one global monotonic phase graph and changes the active `createShutdownHandler` force default from 2,500 ms to 8,000 ms. At T0 it arms that force timer, synchronously closes HTTP acceptance and renderer sessions, rejects new prompts/provenance reservations, and puts the governed controller into quiescing mode: no new external publication starts, but already-owned internal admission/delivery may finish while subscriptions and SQLite remain open. Phase A runs active-turn finalizers, binder, fact-admission, observation, ledger, renderer-projection, terminal-reservation cleanup, and watcher close concurrently under one absolute T0+5,000-ms deadline; the provenance owners retain their stricter 2,000-ms local limits. Every owner cancels unstarted due/lease/delayed timers on entry, and observation also cancels native reads/handles. At the phase deadline every owner has either settled or left only durable pending/running/lease-recoverable truth with no callback capable of new SQL, UEB, filesystem, or socket work.

Phase B then stops the governed subscription/controller runtime under an absolute T0+6,500-ms deadline. Phase C closes SQLite under an absolute T0+7,000-ms deadline. The remaining 1,000 ms is force-exit margin; at T0+8,000 ms the existing injected `exit(1)` path fires if cleanup has not completed, while success clears the timer and exits normally. Phases never await sequential per-owner 2-second budgets. Tests use an injected monotonic clock/exit and assert every outer and phase minus/equal/plus boundary, concurrent rather than summed Phase-A waits, SIGTERM-resistant child escalation, delayed observation cancellation, no callback after Phase A, subscription-before-database order, and no access to closed SQLite.

- Duplicate announced/args/terminal events with identical bounded normalized phase records are no-ops. When an optional raw-value fingerprint is unavailable, otherwise-identical normalized replays intentionally collapse; the system does not claim it compared omitted raw values.
- A duplicate with any different persisted normalized phase field cannot overwrite an activity, edge, snapshot, or event and records a conflict diagnostic.
- Terminal `error` still triggers bounded observation because partial writes are possible.
- Explicit stop, iterator rejection, process close/error, and shutdown use the exclusive bounded finalizer in section 8.5; a pre-barrier terminal snapshot wins, otherwise a fixture-established active row closes interrupted and durably schedules retained candidates without awaiting filesystem observation. Startup reconciles only durable work left pending by a crash.
- Pre-execution bounce does not claim execution; result-phase enforcement is treated as possibly executed.
- Snapshot eligibility failures are edge-local and do not discard the tool activity or other candidates.
- Database/admission failure never changes tool result truth. If a durable reservation exists, the bounded admission owner in section 10.3 either admits it, records semantic conflict, or leaves it honestly pending and suppressed until restart after finite failure; otherwise a fixed diagnostic is emitted.
- Same-path Fusion-side observation/save work is serialized across threads through one shared coordinator. Mediated saves keep priority and the existing waiter budget; observations never enter that waiter queue. Different paths use the exact four-global/one-per-activity scheduler caps in section 7.7; external agent execution remains outside this lock.
- Startup completes migrations/registry integrity, composes all publishers/subscriptions, runs the exact bounded shared admission pass in section 10.3, initializes the controller/schedulers, and runs the exact bounded binder and observation passes in sections 7.6–7.7 before public sockets, watchers, or triggers. Remaining non-suppressed durable backlog drains through yielded continuations/signals and exact due timers; finitely suppressed work remains truthfully pending/running until restart rather than hot-looping or being silently rewritten.
- Shutdown follows the exact concurrent-owner phase graph above; unfinished claimed work remains durable for restart recovery, and every unstarted timer is cancelled before the subscription runtime and database stop in order.
- No raw tool or snapshot content appears in errors, diagnostics, logs, registry definitions, or test failure snapshots.

## 14. Migration And Compatibility

- Never hand-edit `fusion.db`.
- Do not edit migrations 001–035; add migration 036 and reversible down logic in dependency order.
- Existing exchanges, chat rendering, tool parts, settings bounce, thread routing, `resource.mutated@1`, `resource:changed@1`, mediated save/query/read routes, watcher behavior, and TRIGGERS compatibility remain operational.
- New schemas and subscriptions are locked system seeds reconciled idempotently into SQLite. User/extension rows cannot claim their IDs/handler keys or broaden their grants.
- Registry reconciliation preserves prior valid rows and detects semantic/ID/checksum collisions.
- No historical backfill is performed. The feature begins recording after migration/startup.
- New query/projection messages use versioned strict validators. Unknown fields and null optionals are rejected.
- No second WebSocket, EventEmitter, polling timer, worker daemon, or file watcher is added.

## 15. Dependency-Ordered Slices

### Slice 01a — Persistence And Repository Foundation

**Ownership:** migration 036, new agent-provenance value validators/repositories/resource identity/checkpoint primitives, and their tests. Do not change harness, UEB startup, WS, or client wiring in this slice.

Deliver:

- exact tables/checks/indexes from section 7;
- private immutable root-authority digest/device/inode fields and restart verification;
- activity phase reservation/idempotency/conflict methods;
- candidate/edge insertion with exact domain-separated fingerprints, caps, and raw-data minimization;
- content-addressed blobs and sparse checkpoint transaction;
- per-workspace/path serialization;
- query repository methods for both subjects and keyset pagination;
- exchange bind-job repository, triple-clearing delete trigger, and binder method;
- durable observation-job and renderer-projection-job claims/leases/retry scheduling plus exact binder/observer/projection batch limits;
- safe resource-registry reuse;
- migration up/down tests against fresh and migration-035 databases.

Required checks:

- targeted migration/repository tests covering every column default/null rule, CHECK/semantic matrix, FK/delete action, index query shape, collision, transaction rollback, concurrency, UTF-8/binary/size/symlink/absent state, no raw outside path, accepted-alias and bounded-rejected candidate fingerprints, sparse dedupe, immutable fact replay, blob conflict, bind-job crash gap, incomplete/detail-hash-mismatch binding, observation and renderer-projection claim/expiry/token conflicts, projection-job atomic creation for all three successful relations, batch cap minus/equal/plus, direct/cascading exchange deletion, and pagination;
- test-source scan proving no live/default DB path;
- relevant existing migration/file-provenance tests.

Exit: builder lifecycle in `GUIDANCE.md` is complete and slice returns `READY_FOR_ORCHESTRATOR_REVIEW` with deviations.

### Slice 01b — Canonical Timing, Activity Capture, And OpenCode Extraction

**Ownership:** canonical harness types/bridge/applier, OpenCode translator/extractor, foreground/headless drain integration, thread harness identity binding, and targeted tests. Use Slice 01a repository ports; do not wire governed subscriptions or renderer yet.

Deliver:

- reported/observed timestamp preservation;
- immutable prompt-accepted turn authority across workspace navigation;
- atomic OpenCode terminal-snapshot reservation before legacy chat-stage expansion;
- async ordered canonical application at every caller;
- server-resolved harness identity on interactive and headless sessions;
- activity owner calls for announced/args/terminal/bounce/interruption;
- argument/result hashing without new raw storage;
- structured OpenCode extraction and conservative shell parser contract;
- exact duplicate/conflict and provenance-fail-open chat behavior;
- exclusive bounded turn finalization with terminal/stop/process/shutdown precedence;
- no change to actual tool execution or permissions.

Required checks:

- OpenCode translator/parser unit matrices, including candidate fingerprint/cap ordering, identical and raw-different over-cap replays that share the same bounded normalized record, and exact replay under an advancing Fusion clock;
- bridge/applier foreground/headless/stop/error/bounce/timestamp tests, including distinct OpenCode start/end/envelope times; exact `state.status` mapping with completed/exit-1 and error/exit-0-or-absent; Settings-path terminal snapshots with result-phase enforcement, no pre-execution SIGTERM, final result/hash equality, and a symlinked protected path during A→B→A navigation proving the captured root is used; relative/absolute path admission across A→B→A, lexical root-prefix/traversal/dot/separator boundaries, and missing/parent-symlink/final-symlink candidates retained for native observation; failure after each expansion stage; tool→text→final and two-tool continuation; A→B→A/simultaneous workspace turns; queued terminal versus stop; stubborn process escalation; late/duplicate terminals; and exactly one turn end;
- terminal-reservation gate tests for five-attempt minus/equal/plus contention, the two-second deadline, non-retryable failure, cancel-before-transaction, never-settling pre-transaction callback, late resume, and shutdown cleanup, proving no partial/late row and immediate continuation of legacy result, later text, and turn end;
- existing harness, wire, thread-runtime, and chat rendering tests;
- source assertions that no shell execution API exists in the parser and raw args/results are absent from new tables/logging.

Exit: required builder/reviewer lifecycle complete.

### Slice 01c — Governed Fact Authority And Agent Event Ledger

**Ownership:** final tool and observation fact schemas/publishers/admission authority, locked seed/filter/capability/compiler/catalog changes, the final two-fact ledger subscription/handler/repository integration, shared fact-admission reconciler, startup composition, and tests. Observation rows are exercised through repository fixtures only; do not add resource byte observation, the observer subscription, v2 server projection, or client rendering yet.

Deliver:

- strict `agent.tool_completed@1` and `resource.state_observed@1` schemas and semantic validation;
- sealed activity and checkpoint publishers backed by their durable reservation verifiers;
- final locked `system.agent-provenance-ledger` contract consuming both fact types;
- exact ATP-D17 tool and observation event-log/resource-edge mappings, idempotency, retry bounds, diagnostics, and projection verified against fixture-owned activity/checkpoint rows;
- allowed required-ack restriction generalized only to exact locked durable handlers;
- shared two-fact admission reconciliation plus final two-fact ledger reconciliation and shutdown drain;
- global 8,000-ms shutdown phase graph with concurrent owner registration and ordered subscription/database close;
- proof that pending/conflicting tool-fact admission cannot make its observation job claimable;
- preservation of file-save publishers and prior subscriptions.

Required checks:

- seed checksum/collision/reconciliation tests;
- filter narrowing and invalid-event rejection tests;
- publisher authority/body mutation/reservation mismatch tests;
- private pre-dispatch admission-commit ordering for both fact types, including idempotent replay, missing/conflicting source, delivery timeout/failure after admission, handler-visible admitted state, deterministic cross-table ordering, bounded 100-item/one-second startup and yielded replay, retryable/non-retryable suppression branches, shutdown ownership, and byte-behavior preservation for existing file-save publishers;
- capability escape and unknown handler/provider tests;
- duplicate/conflict/timeout/startup-order tests;
- shutdown phase/outer-force minus/equal/plus tests with concurrent owner delays and proof no timer/callback reaches stopped subscriptions or closed SQLite;
- all predecessor registry/subscription/save tests.

Exit: required builder/reviewer lifecycle complete.

### Slice 01d — Resource Observer, Checkpoints, And Observation Fact

**Ownership:** observer service/handler, final v2 server schema/publisher/committed-job-bound projection capability, durable renderer-projection scheduler, checkpoint/admission/ledger integration, final observer subscription installation, and tests. Do not add WS query or client rendering yet.

Deliver:

- exact bounded file inspection algorithm from section 9;
- bundled C Node-API secure observer plus deterministic server build, Electron packaging inclusion, fail-closed loader, and direct/packaged runtime smoke coverage;
- locked observer subscription consuming tool facts;
- fact-bound capability that can inspect only persisted candidates for the admitted activity;
- durable `resource.state_observed@1` reservation/publication;
- use of the already-final shared admission reconciler and two-fact ledger handler from Slice 01c;
- strict `resource:changed@2` server schema/publisher and exact committed-job-bound projection capability installed before the final observer subscription compiles;
- durable renderer-projection jobs and bounded scheduler from section 7.8;
- exact ATP-D17 observation mapping regression through real checkpoint facts;
- first/changed/unchanged/skip/failure outcomes;
- error/result-bounce/interruption and startup reconciliation;
- same-path serialization under cross-thread concurrency.
- descriptor-relative native root/parent traversal, final lookup/open identity revalidation, packaged-addon availability, and absent-without-live-identity transitions;
- persisted root-authority verification during startup reconciliation;
- singleton bounded scheduling with four-global/one-per-activity caps, three-attempt timeout policy, lease recovery, save-priority try-lock behavior, and bounded startup/shutdown ownership;
- same-activity path grouping with deterministic access dominance.

Required checks:

- real temporary-workspace tests for eligible text, absent→bytes, bytes→absent, crash plus same-path root replacement, foreign/nonterminal save reservation, final/parent symlink swaps and parent swap-and-restore inserted during decisive descriptor-relative lookup across bytes/absent/symlink/non-regular outcomes, missing ancestor, parent `ENOTDIR|EACCES`, final-open `ENOENT|ELOOP|EACCES`, read/revalidation failure, unavailable native addon/required flag, directory, binary, oversized, outside, rejected-only, blocked-before-execution, mixed rejected/accepted, unstable, unreadable, unchanged, changed, first-read, first-write, dual-role grouping, both read/write lock orders, error, interruption, 64-cap, concurrency, and retry;
- cap-minus/equal/plus tests for global/per-activity slots and claimed-path-disposition startup batches, including all-lock-miss and pre-I/O-closure backlogs; timed-out required-ack proves no detached read; active-observer 32/33/34-save fixtures prove the save-only handoff preserves existing admission/FIFO/`save_busy` behavior and observation saturation cannot consume save waiter capacity; restart backlog yields within its budget and continues; unexpired lease arms a future wake; crash immediately before and after attempt reservation—including attempt 3—uses the exact `claimed_attempt` recovery outcome without extra I/O; claim/release/settlement/outcome/recovery transition failures cover retryable delayed suppression and immediate non-retryable suppression for tokenless pending and token-owned running keys; a failed post-I/O outcome releases the coordinator within the total 2-second window, discards stale bytes, and only a fresh reacquired observation may later commit; shutdown closes/abandons every owned handle/job within 2 seconds;
- interrupted-turn fixture with three observation timeouts proves durable job creation and turn end occur within finalizer bounds while retries remain scheduler-owned;
- fact authority/capability/idempotency integration tests proving real checkpoints use the already-installed observation publisher/admission/ledger branch from 01c without locked-row mutation;
- renderer-projection job tests from section 7.8, including both crash gaps, at-least-once stable-ID replay, admission gates, fallback, no-recipient settlement, retry exhaustion, transition suppression, startup/yield, and shutdown;
- ledger exact-row/edge/duplicate/conflict/missing-source/contention/restart-batch/shutdown tests for both facts, including query during running claim, crash before/after durable cycle charge, schedule-transition contention, lease expiry, three-cycle terminal failure, and proof of no fourth projection cycle or tags/causal/event graph edges;
- same-database Slice-01c→01d startup/reconciliation proves new v2 schema/capability and final observer subscription install without modifying any earlier locked checksum or referencing an inactive schema;
- proof that no watcher/global scan and no raw bytes/path leakage participate.

Exit: required builder/reviewer lifecycle complete.

### Slice 01e — Progressive Activity Query And Exchange Binding

**Ownership:** strict query schema/route/router/startup wiring, exchange binder integration, server-side query tests, and protocol source tests. No new UI panel is required.

Deliver:

- `agent:activity@1` registered query family;
- exact tool/resource subject filtering, path normalization, pagination, timestamps, and response summaries;
- workspace/epoch/stale-pair enforcement;
- detail references without raw detail;
- transactional bind-job insertion plus post-commit/startup drain with replay/conflict behavior;
- server feature advertisement consistent with existing route conventions;
- no historical backfill.

Required checks:

- public WS route tests for every filter combination needed by the examples, pagination without duplicates, folder boundaries including exact empty-string root folders, root-level fact/query fixtures, invalid/null/unknown fields, inactive schema, stale A→B→A, workspace isolation, max limits, and query failures;
- exchange save/bind crash-boundary, distinct metadata-saved/row-exchange/binder clocks, duplicate/incomplete/hash-mismatch part, direct-delete, cascading-thread-delete, retryable first/delayed exhaustion, non-retryable suppression, restart recovery, 100-job batch boundary, and bounded shutdown tests;
- redaction/source scans proving responses/logs exclude raw arguments/results/snapshot bytes/outside paths;
- predecessor provenance query remains byte-contract compatible.

Exit: required builder/reviewer lifecycle complete.

### Slice 01f — File Viewer Client Integration And Full Proof

**Ownership:** client protocol/types/central store/file handler, guarded live fixture, full cross-slice regression checks, and implementation report. The final server v2 schema/publisher/capability/subscription installed in 01d is immutable here.

Deliver:

- strict client `resource:changed@2` validator against the already-active server schema;
- regression proof that the locked observer integration and renderer scheduler retain their exact separate capabilities and no ambient socket/session access;
- projection policy from section 12;
- admitted-fact projection gates: first/changed checkpoint IDs appear only after checkpoint-fact admission; pending/conflict emits only identity-free refresh-required; unchanged projects under the admitted tool fact;
- exact refresh-required v1 fixtures for pending/conflict/projection failure/unavailability, always using the admitted activity ID and fixed reason;
- v2 routing through existing workspace bind buffer/socket;
- central-store invalidation/refetch with dominant-edge projection dedupe;
- isolated OpenCode-shaped tool edit/read/error/interruption proof;
- same-database 01c→01d→01e→01f startup/reconciliation proof with no locked seed/subscription checksum drift;
- complete implementation report with deviations and downstream impact.

Required checks:

```bash
cd fusion-studio-server && npm test
cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts
cd fusion-studio-client && npm run build
cd fusion-studio-client && npm run electron:pack
cd fusion-studio-client && node e2e/provenance/run-packaged-native-observer.mjs
cd fusion-studio-client && node e2e/provenance/run-agent-tool-live.mjs
```

The new guarded launchers must refuse port 3001, require marker-owned temporary output/profile/workspace roots, disable unrelated runtime effects/watchers, use dynamic ports, and clean only their marker-owned directories. The packaged-native launcher must invoke the built app's actual `spawnServer` resolution path and wait for an explicit child-server addon-loaded health assertion. The agent live launcher uses a deterministic adapter fixture rather than a real OpenCode process.

Runtime assertions cover the section 2 examples, the section 12 live update including bytes A → mediated-save B → agent-observed A and absent-state interleavings, snapshot dedupe, timestamp preservation, exchange binding, and absence of watcher delivery. Re-run the accepted mediated-save live proof to prove v1 regression safety.

Exit: builder returns clean; orchestrator independently reviews all six slices together, repairs through the required lifecycle, verifies the exact final manifest, and returns `READY_FOR_SUPERVISOR_REVIEW`.

## 16. Expected Changed Areas

Expected—not exclusive—areas:

- `fusion-studio-server/lib/db/migrations/036_agent_tool_provenance.js`
- new `fusion-studio-server/lib/agent-provenance/`
- new bundled Darwin Node-API observer under `fusion-studio-server/native/secure-file-observer/` plus its server build/package wiring
- OpenCode adapter and canonical harness/wire/thread runtime files listed in `CODE-INVENTORY.md`
- event registry schemas/catalog/filter/policy/capability/admission/compiler/handlers
- event ledger/startup/shutdown/testing isolation
- new WS activity query and v2 projection wiring
- File Viewer protocol/type/central-store handler files
- targeted server/client/live tests and fixture launcher
- this folder's implementation ledger/report/manifest only as authorized by the supervisor workflow

Any additional path required for mechanically necessary integration is allowed when documented. Unrelated cleanup/refactoring is not.

## 17. Final Acceptance Matrix

| Contract | Pass evidence |
|---|---|
| Every schema-valid canonical tool call indexed | tools with/without resources and all terminal states query successfully; malformed/over-bound identity takes the fixed fail-open diagnostic branch |
| Thread/turn/exchange/tool identity | exact filters and post-save binding pass without timestamp mutation |
| Timestamps honest | OpenCode start/end/envelope-emission plus Fusion receipt, snapshot, and save/bind clocks retain distinct source and missing-provider branches |
| Reads/writes queryable | required path/thread/read/write examples pass across multiple threads |
| Progressive disclosure | no new raw args/results/content; exact exchange/tool reference returned only after bind |
| Safe sparse checkpoints | UTF-8/10 MiB/symlink/outside rules, first/changed/unchanged, blob dedupe pass |
| Conservative shell | literal cases captured; dynamic cases ignored; parser never executes/evaluates |
| UEB topology | both facts admitted through sealed publishers and exact locked subscribers/capabilities |
| Event ledger | durable fact verification, resource edges, duplicate/conflict behavior pass |
| Live File Viewer | OpenCode-shaped edit becomes visible through durable stable-ID v2 projection and central refetch only |
| Recovery | reservation cancellation, error/interruption, all durable-owner startup/crash windows, shutdown graph, and same-path concurrency pass honestly |
| Regression | full server, client source/build, cross-slice same-database startup, and prior v1 save/live proof pass |
| Isolation | no live DB/profile/workspace/watcher/real harness process touched |

## 18. Orchestrator And Supervisor Gate

The orchestrator must follow `GUIDANCE.md`, account for every deviation, identify any altered downstream contract, and obtain the first clean independent final review on the integrated bytes. It may not declare owner acceptance.

The Roadmap Implementation Supervisor independently checks evidence and presents the completed SPEC to the owner. This SPEC is complete only after explicit owner acceptance.
