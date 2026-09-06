# Agent Tool Provenance Decisions

> This ledger becomes implementation authority only when the owner approves the exact release candidate.

## Owner Decisions

### ATP-D01 — Agent-only first boundary

This SPEC captures configured harness tool activity and tool-bound workspace-file observations only. User saves, frontend control provenance, triggers, long-running scripts, package scripts, named automations, connectors, and arbitrary external filesystem changes are later contracts.

### ATP-D02 — Preserve facts without demanding a causal verdict

Record tool lifecycle, resource access candidates, snapshots, exchange identity, and timestamps independently. “State observed after tool” is valid. “Tool caused mutation” is not asserted by timing or path proximity.

### ATP-D03 — Normalize tool calls for database queries

Schema-valid tool calls must no longer be queryable only by searching exchange JSON. A durable normalized index must support them by workspace, harness, thread, turn, exchange, provider tool-call ID, tool name, status, time, resource path/folder/name, and resource access class. Malformed or over-bound provider identity is diagnosed and omitted rather than normalized under an invented identity.

### ATP-D04 — Progressive disclosure for tool details

The normalized index must not duplicate full tool arguments, commands, file content embedded in write arguments, status text, or tool output. It stores SHA-256 fingerprints, extracted resource facts, IDs, classifications, and timestamps. Existing exchange JSON remains the detailed record; after exchange commit, the index exposes a reference sufficient to retrieve that exact exchange/tool part through a later authorized detail surface.

### ATP-D05 — Capture distinct clocks now

For each tool lifecycle phase, preserve a valid harness/provider-reported timestamp when supplied and always record Fusion’s server receipt timestamp. For OpenCode terminal ToolParts, preserve `state.time.start`, `state.time.end`, and the CLI envelope `timestamp` as distinct start, terminal, and envelope-emission fields. Record snapshot observation, exchange save time, and the later Fusion binder-processing time independently. Missing or invalid provider time is omitted, never replaced while still labeled provider time.

### ATP-D06 — Reuse the bounded UTF-8 snapshot safety class

Snapshot only regular, workspace-contained, final non-symlink, NUL-free UTF-8 files whose exact bytes are at most 10 MiB. Record `absent` when the candidate path is missing. Binary, oversized, symlink, directory, unreadable, malformed, and outside-workspace candidates keep activity/edge or bounded rejected-candidate metadata plus a reason, but no content.

### ATP-D07 — Accept conservative misses

Structured native mutation/read tools and conservative literal shell candidates are sufficient for this phase. Dynamic shell paths, indirect programs, child processes, package-script internals, and unreported mutations may be missed. Future scripts should self-report through registered provenance contracts rather than turning this feature into system-wide filesystem surveillance.

### ATP-D08 — Keep permissions and interception out of scope

This is observation after the configured harness reports its activity. It does not read or enforce OpenCode tool rights, intercept terminal execution, add authorization hooks, or change which Settings paths are protected. One narrow phase correction is in scope: because the current OpenCode CLI reports only completed/error ToolParts, its synthesized arguments are terminal-derived and cannot truthfully take the existing pre-execution bounce branch. Before provenance reservation, Fusion purely evaluates the existing result-phase Settings rule and constructs the final JSON-safe exchange value without emitting UI events. It persists/hashes that value, then expands call → arguments → result; only the result stage emits the existing `system:tool_bounced`/`chat:tool_result` shapes exactly once. It does not send the pre-execution SIGTERM for that already-terminal tool. No permission decision or protected-path policy changes.

## Reconciled Source Contracts

### ATP-D09 — Use the governed UEB as the one firehose

`agent.tool_completed@1` and `resource.state_observed@1` use locked schemas, host-minted publishers, database-backed locked subscriptions, and exact capabilities on the existing admitted-fact channel. No parallel event service or direct renderer listener is permitted.

### ATP-D10 — Keep snapshots sparse and content-addressed

Resource inspection may hash a candidate at each terminal tool boundary, but it creates checkpoint data only for a first observation or changed `bytes|absent` state. Identical byte content shares one blob and repeated unchanged observations point to the existing checkpoint. This controls growth without silently deleting provenance and does not create a canonical file-version record.

### ATP-D11 — A read can establish a baseline

A structured or conservatively extracted read candidate may create the first checkpoint for a path. Later write observations can reference that checkpoint as the prior observed state. Repeated reads of unchanged content create tool/edge records but no duplicate snapshot or observation fact.

### ATP-D12 — Query summaries before details

The public agent-activity query returns bounded metadata and supports `tool_calls` and `resource_edges` subjects. It never returns snapshot bytes, raw arguments, or raw results. Summary results expose snapshot IDs and an exchange/tool detail reference only when available.

### ATP-D13 — Use a new renderer projection version for observation

Agent observation must not be mislabeled as `resource:changed@1` create/modify. `resource:changed@2` identifies the source edge observation and its `first_observation|changed|unchanged` relationship. An unchanged ATP checkpoint can still require a refetch because another governed writer may have changed the central store since that checkpoint. The renderer uses v2 only as an invalidation/refetch instruction; it does not infer authorship or overwrite dirty Office/Email buffers.

### ATP-D14 — Do not prune history in this SPEC

Automatic retention and deletion are deferred until an owner-approved policy can distinguish metadata, snapshots, blobs, chat records, and restore guarantees. Growth is bounded here through candidate caps, no recursive discovery, sparse snapshot rows, and blob deduplication.

### ATP-D15 — Narrow TOOL-D01/TOOL-D02 overlay only

Approval of this exact candidate supersedes the older `TOOL-D01` and `TOOL-D02` blockers only for the bounded observational contracts defined here: normalized activity/resource-edge rows; `agent.tool_completed@1`; the configured `harnessId`, provider, provider tool-call ID, tool names, lifecycle status, and reported/observed timestamps carried by those contracts; and optional SHA-256 fingerprints of the complete argument/result values already retained by the existing chat exchange path. These fingerprints are local integrity/search-discrimination metadata, not captured-output artifacts or proof that raw output was safely published.

This overlay does not register or persist `chat.tool.started|args|result`, create accepted tool/harness references, publish provider `nativeRefs`, add `toolResources`, normalize streamed/raw captured output, expose arguments/results, define external output artifacts, or settle the corresponding automation contract. All such branches of `TOOL-D01`/`TOOL-D02` remain open. Invalid or over-bound identity suppresses only the new provenance activity/fact with a fixed redacted diagnostic; existing chat rendering and tool execution remain fail-open.

For the current OpenCode terminal-snapshot input only, this overlay also settles the exact observational outcome mapping needed by this SPEC: own `part.state.status` value `completed` maps to provenance `completed`, and `error` maps to provenance `error`; every other value is invalid for the new provenance activity. `metadata.exit`, chat `isError`, status text, and protected-Settings display transformations remain outside that lifecycle mapping. This does not settle a general provider-exit or future incremental lifecycle policy.

### ATP-D16 — Narrow ULV checkpoint-storage overlay only

Approval of this exact candidate explicitly folds the SPEC's bounded agent-observation checkpoints into the current work. It supersedes `ULV-D02`, `ULV-D03`, `ULV-D05`, and `ULV-D10`, and any reading of `ULV-D12` that would block `resource.state_observed@1`, only for `agent_snapshot_blobs`, `agent_resource_snapshots`, their exact eligibility/hash/state/chain rules, and the separately named observation fact defined here. For this narrow scope, `ULV-D02` is answered as full exact snapshots of the eligible UTF-8 bytes with no stored or computed diffs. These are observation checkpoints, not canonical `file.version` records.

No runtime retention, pruning, deletion, export, restore, diff, or snapshot-byte query surface is authorized. Checkpoint/blob rows persist until a separately owner-approved lifecycle contract; exchange deletion only clears the activity's nullable exchange binding and does not delete checkpoints. Migration-down cleanup is limited to isolated development/test rollback. This overlay does not register an `eventFamily: 'file.version'`, create file-version IDs, implement general versioning, approve binary/large-file capture, or settle broader `ULV-D02/D03/D05/D10/D12` branches.

### ATP-D17 — Narrow LED-D04 overlay for two admitted facts

Approval of this exact candidate supersedes `LED-D04` only for idempotently projecting admitted `agent.tool_completed@1` and `resource.state_observed@1` facts into the existing migration-029 `event_log` and `event_resource_edges` tables under the exact mappings, transactions, retries, diagnostics, and reconciliation rules in SPEC section 10.4. It authorizes no causal/graph edge, tag, accepted-reference, native-reference, ledger-internal event, new general ledger schema, or other event type.

Both projections store the already-frozen canonical fact JSON exactly. The tool event uses the admitted activity as its correlation and only accepted canonical paths create resource edges; the observation event uses the admitted source activity as correlation and creates one observed-file edge. `causation_id` remains null because temporal/source linkage is not a causal verdict. The producer-owned activity/snapshot row is the only retry marker. Wider `LED-D04`, `LED-D01/D02/D03`, proof-capability, retention, graph, and general event-ledger work remains open.

## Implementation Choices Fixed By This Candidate

- Public activity IDs, observation IDs, event IDs, snapshot IDs, and new resource IDs are host-generated UUIDs. SQLite integer keys may provide internal deterministic order but are not cross-process identity.
- `operationId` in governed admission identifies the producer-owned durable activity or observation operation. The query surface presents the tool operation as `activityId`.
- Tool status is one of `announced`, `completed`, `error`, `blocked`, or `interrupted`; startup reconciliation may close an abandoned announced row as interrupted without inventing a provider terminal timestamp.
- Resource access family is `read`, `write`, `execute`, or `unknown`. Detailed kinds include `read`, `write`, `create`, `delete`, `move_from`, `move_to`, `execute`, and `unknown`.
- Extraction basis is the closed v1 enum `structured_path|shell_input_redirection|shell_output_redirection|shell_known_operand`. Generic provider result-file hints and unknown-command operand inference are not activated.
- OpenCode structured extraction reads only the exact allowlisted tool/field mappings in this candidate. It does not recursively treat every argument string as a path. The extension seam is inert for every other harness, tool name, and field until a separately owner-approved provenance SPEC activates it.
- OpenCode `part.callID` is the sole provider tool-call identity. `part.id` is a distinct provider part identity and is ignored rather than compared, persisted, or promoted to a native reference.
- OpenCode provenance accepts only `part.state.status === 'completed'|'error'` and maps it directly to the same provenance status. It never derives provenance status from `metadata.exit`, chat `isError`, status text, or a Settings-bounce outcome.
- OpenCode's completed/error ToolPart is ingested as one terminal-snapshot batch. Any protected-Settings result-phase transformation is purely evaluated exactly once first; the final JSON-safe exchange result is fingerprinted and reserved without emitting. Synthetic call/arguments/result stages then expand in order, and only the result stage applies/emits the precomputed bounce once. Terminal-derived arguments never take a pre-execution Settings-bounce branch.
- A terminal tool snapshot closes only its own activity and remains an ordinary ordered event within the live turn. It does not close turn ingress or emit `turn_end`; later assistant text and additional tools remain valid until a true turn-terminal, stop, process/iterator failure, or shutdown boundary.
- Shell parsing tokenizes data without invoking a shell. It supports literal words, quotes, separators, selected redirections, and a small documented command/operand catalog. Variables, command/process substitutions, here-doc bodies, globs, and ambiguous option values are ignored.
- Candidate processing is capped at 64 unique candidates per tool call after deterministic normalization. Truncation is durable metadata.
- An invalid or oversized shell command yields no candidates, `0/0/false` candidate counts, and one fixed value-free diagnostic. `candidatesTruncated=true` is reserved exclusively for detection of a 65th unique candidate.
- Workspace-relative canonical paths are derived by a pure component-level lexical algorithm against the immutable prompt-captured root; admission never uses active navigation or filesystem resolution. Missing names and parent/final symlinks reach the secure native observer. Rejected outside-workspace candidates retain only a candidate fingerprint and skip reason, not the raw outside path.
- Pre-observation `outside_workspace|invalid_path|blocked_before_execution` candidates close at terminal reservation as attempt-zero skipped edges using the tool's terminal-observed clock and never enter an observation job.
- One host-owned per-workspace/path serialization coordinator is injected into both the existing File Save Controller and the agent observer. It establishes one Fusion-side identity/checkpoint order under concurrent tool activity and mediated saves without intercepting the agent's external execution.
- Agent provenance authority is captured once from server-owned prompt acceptance and remains immutable for the turn. Its canonical-root digest and paired device/inode identity, when available, are persisted privately on every activity so startup reconciliation can enforce the same authority after memory loss. Later renderer navigation, workspace switching, restart, or root replacement cannot retarget a tool, observer, terminalizer, or exchange binder.
- Safe observation on supported macOS builds uses one bundled asynchronous Darwin Node-API addon and descriptor-relative `openat`/`fstatat` traversal from a pinned, verified root. JavaScript pathname lookup is not a security fallback. Missing addon or required platform flags produces `secure_open_unavailable` with no registry or checkpoint mutation; development and packaged acceptance both require the addon to load.
- Packaged native acceptance exercises Fusion's actual packaged `spawnServer` path and the system Node binary it resolves in production; Electron run-as-Node is not a substitute.
- The current `resource_registry` and stable-resource reservation policy are reused rather than creating a second resource registry. Compatible identities are reused; incompatible fingerprint/absence transitions follow the existing reserve/tombstone rules. The observation checkpoint chain is path-scoped and therefore can link across an honest resource-identity replacement.
- An absent observation has no live resource identity. It retires an incompatible live path mapping without creating a reserved replacement; a later bytes state receives the normal successor identity.
- Every successful eligible observation drives a File Viewer invalidation, including `unchanged`, regardless of which access role won the observation race. The dominant edge UUID is the stable projection identity. Same-activity edges remain separately queryable but one path observation uses write-over-read-over-execute-over-unknown dominance.
- Observation work is a durable singleton-scheduled queue: at most four paths globally and one path per activity, one path per claim, and three bounded timeout attempts recorded on every sibling edge in a canonical-path group. Each claim records its dominant edge and whether an attempt was durably reserved. Job due time is always the minimum pending edge due time; only ready groups compete by dominant ordinal, lock misses do not consume filesystem attempts, and lease recovery consumes an already-reserved attempt without repeating I/O. Every installed claim—including a lock miss or pre-I/O closure—does consume the 16-disposition batch budget. Coordinator ownership is capped at 2,000 ms total; an uncommitted post-I/O result is discarded before release, and any later attempt reacquires and observes fresh state. Attempt-three lease/settlement recovery closes truthfully as `observation_incomplete`. Retryable transitions receive one delayed retry; every non-retryable transition suppresses the exact pending-source/claim key immediately until restart. The sole timer covers non-suppressed pending due times, running lease expiry, and unused delayed retries. Startup/shutdown passes remain bounded. The UEB required-ack handler only validates and signals this queue; it never leaves detached filesystem work after controller timeout.
- Database transitions in the observation and ledger schedulers receive one five-attempt immediate cycle plus one delayed bounded retry. A second exhaustion suppresses that exact source/claim until restart and arms no further timer, preventing persistent SQLite failure from becoming a polling loop while preserving the durable pending/running truth.
- Mediated saves have priority in the shared path coordinator. Observers use non-queuing try-acquire and never consume the existing 32-entry save waiter budget. While an observation is active, one save-only priority handoff slot preserves today's total admission of one active plus 32 waiting saves; it cannot raise capacity above 33 or serve an observer. Saturation leaves observation jobs durable and pending.
- Exchange binding is a singleton concurrency-one drain with 100-job yielded batches and a one-second/100-job pre-socket startup budget. Retryable binding database failure receives one delayed bounded retry; second exhaustion or non-retryable failure suppresses the still-pending exchange ID until restart with no hot loop. Observation startup is bounded to 16 claimed-path dispositions or two seconds before remaining durable backlog continues after yielding.
- Observation jobs are claimable only after their owning `agent.tool_completed@1` fact is admitted. Every successful dominant edge atomically creates a durable renderer-projection job. Unchanged may project v2 under the admitted tool fact; first/changed projects v2 only when its checkpoint fact is admitted and otherwise uses identity-safe refresh-required fallback. Claim/lease recovery provides stable-ID at-least-once delivery, bounded failures, exact no-recipient settlement, and restart recovery without historical rescans.
- Duplicate/conflict comparison is exact over the bounded normalized phase record. If an optional arguments/result fingerprint is unavailable, raw values outside that record are deliberately not compared; otherwise-identical replays collapse idempotently rather than claiming an unverifiable conflict.
- Activity fact publication, resource observation, ledger projection, and renderer projection are idempotent by durable host IDs. Their durable pending states are reconciled on startup. Renderer projection uses a durable send job but remains best effort rather than claiming client acknowledgement: accepted buffer/send, identity-safe fallback, or no current recipient settles the job; bounded exhaustion relies on reconnect hydration.
- For the two new facts only, a private pre-dispatch UEB admission commit changes the verified producer row to admitted before any subscriber runs; delivery failure does not revoke admission, and existing file-save publisher behavior is unchanged. One shared deterministic admission reconciler covers pending tool and observation facts with a 100-source/one-second startup cap, yielded continuation, one delayed retry, exact-key suppression until restart, and bounded shutdown. Migration-029 projection keeps `event_log.created_at` as a first-write-owned clock excluded from exact replay comparison. Each admitted source owns a bounded durable ledger schedule: every cycle is claimed and charged before projection, at most three five-attempt cycles run, and crash/lease recovery consumes rather than repeats a charged cycle. The first two failures schedule +250 ms and +1,000 ms; the third becomes terminal `failed`; semantic mismatch remains terminal `conflict`. Retryable ledger transitions receive one delayed retry and non-retryable transitions suppress the exact key immediately. No automatic fourth cycle or polling loop is allowed.
- Canonical folder identity uses exact `''` for workspace-root files and normalized no-trailing-slash workspace-relative parents elsewhere; `'.'` and `'/'` are never alternate root sentinels.
- Ordinary mid-turn terminal reservation uses an exact two-second cancellation gate and five immediate zero-busy-wait transaction attempts. Cancellation before commit prevents every later SQL/chat mutation; failure emits a fixed diagnostic and immediately resumes legacy call/arguments/result plus later chat flow.
- Shutdown uses one 8,000-ms outer force deadline: all turn/provenance/watcher owners quiesce concurrently by 5,000 ms, subscriptions stop by 6,500 ms, and SQLite closes by 7,000 ms. All unstarted timers are cancelled before database close.
- Locked installation is dependency-ordered without mutation: Slice 01c installs both final fact schemas/publishers and the final two-fact ledger subscription; Slice 01d adds the final v2 server schema/capability and observer subscription atomically before compiler activation; Slice 01f changes only the client side of v2.
- Retained candidates receive contiguous ordinals in emission order, and tool-fact resources are ordered by those ordinals. Public tool summaries count distinct accepted canonical paths; `changedCount` counts only distinct path groups whose outcome is exactly `changed`. File Viewer v2 projection always reuses the dominant edge's stored observation clock.
- Provenance failures are visible and retryable but do not rewrite an executed tool result as failed or terminate an otherwise continuing chat turn.
