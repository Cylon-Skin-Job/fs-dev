---
name: Tool Call Provenance Schema
description: Schema guidance for connecting canonical tool calls to chat turns, resources, ledger events, file versions, and audits.
metadata:
  source-files:
    - fusion-studio-server/lib/harness/opencode/index.js
    - fusion-studio-server/lib/harness/opencode/json-event-translator.js
    - fusion-studio-server/lib/harness/opencode/resource-extractor.js
    - fusion-studio-server/lib/wire/canonical-harness-event-bridge.js
    - fusion-studio-server/lib/wire/canonical-chat-event-applier.js
    - fusion-studio-server/lib/agent-provenance/activity-owner.js
    - fusion-studio-server/lib/agent-provenance/activity-repository.js
    - fusion-studio-server/lib/agent-provenance/candidate-fingerprints.js
    - fusion-studio-server/lib/agent-provenance/resource-observer.js
    - fusion-studio-server/lib/agent-provenance/checkpoint-repository.js
    - fusion-studio-server/lib/agent-provenance/announced-activity-reconciler.js
    - fusion-studio-server/native/secure-file-observer/index.js
    - fusion-studio-server/native/secure-file-observer/secure_file_observer.c
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. Configured OpenCode terminal activity, bounded candidates, governed facts and sparse observation checkpoints are implemented. General tool/native-reference events and captured-output contracts remain proposals. Tests are assertions inspected, not rerun; native availability and live rendering were not tested here.

## Current ingress and terminal capture

The OpenCode adapter in `harness/opencode/index.js` parses JSON lines and feeds `OpenCodeJsonEventTranslator`. `translateToolUse` accepts a bounded own `part.callID` and tool name, and only `part.state.status` of `completed` or `error`, for `tool_snapshot`. `part.id` is not the tool-call identity. Invalid/over-bound identity or other status produces fixed diagnostics and the legacy Chat fallback, without a new provenance activity. Provider status maps directly to provenance status; exit metadata, Chat `isError` and protected-Settings display transformations do not redefine it.

The canonical harness bridge carries the snapshot through the accepted turn's immutable route and lifecycle fence to `applyTerminalToolSnapshot`. The applier evaluates any result-phase Settings transformation, prepares the final JSON-safe result and asks `activity-owner.js` to reserve the normalized activity before expanding the existing Chat call → arguments → result sequence. Terminal-derived arguments do not take a pre-execution Settings stop branch. A tool terminal snapshot is an ordered event inside the turn; it does not end the turn or prevent later text/tools.

Reservation captures `activityId`, `eventId`, workspace/session/turn/harness/provider/call identity, normalized and native tool names, direct terminal status, clocks, optional complete-value fingerprints and retained candidate edges. The synchronous transaction atomically stores `agent_tool_activities`, `agent_tool_resource_edges` and the observation job when needed. Its two-second cancellation gate and at most five immediate zero-busy-wait attempts bound the wait. Failure emits a fixed diagnostic and resumes Chat delivery; late old-generation work cannot mutate the current turn. This observational failure does not undo or reclassify external tool execution.

## Clocks and interruption

Host `observedAt` is receipt time. Optional provider-reported execution start/end and terminal-envelope times remain separate; they are not independently verified execution clocks. In the terminal-only path, announcement, available arguments and terminal observation share the snapshot receipt time. Later resource observation, reconciliation, exchange save and exchange binding have their own clocks. A duration inferred from receipt times would not measure provider execution.

Storage supports `announced`, `completed`, `error`, `blocked` and `interrupted`, but current OpenCode capture normally enters as a complete terminal snapshot. Synthetic incremental capture is disabled by default in the applier; its announced/argument/blocked branches are not evidence of production incremental OpenCode coverage. A stop before any terminal snapshot can leave no new activity for that tool. Existing in-memory announced activity can be closed on interruption; startup reconciliation closes durable abandoned announced rows as interrupted, retaining stored authority and known phase times without inventing provider terminal times, results or candidates lost with memory. Full partial-turn Chat persistence remains the Chat owner's separate contract.

## Candidate extraction is bounded evidence

`extractOpenCodeCandidates` recognizes structured `read`, `write` and `edit` with exact `filePath`/`file_path` fields; disagreeing or invalid fields yield no candidates. For `bash`, the parser reads a command string as data and never runs a shell. It supports a constrained literal command/operand and redirection grammar, including selected forms of cat/head/tail/wc/stat/file, grep/rg, touch/rm/unlink/truncate/tee and cp/mv. Unknown commands, ambiguous options, dynamic expansions, substitutions, globs and unsupported segments can be missed. Result-file hints and recursive argument/path discovery are not active.

Candidate identity is lexical against the prompt-captured canonical root. Paths that escape the workspace or are invalid become fingerprint/reason-only durable edges without retaining the raw rejected path in this index. This is not a guarantee about what the full Chat arguments retain. Path aliases and access/extraction tuples are deduplicated; at most 64 unique candidates are retained and detection of the 65th sets `reported=65`, `retained=64`, `truncated=true`. It does not count all remaining paths. Invalid or over-65,536-byte shell input yields no candidates and no truncation flag. Neither zero candidates nor `truncated=false` proves exhaustive file coverage or no mutation.

Access family/kind is an extracted report of intended access, not proof of a read or write. Pre-observation invalid/outside/blocked candidates close as skipped at attempt zero. Accepted canonical paths proceed to observation only after their owning tool fact is admitted.

## Governed fact, observer and checkpoints

`activity-repository.js` constructs `agent.tool_completed@1` with top-level fact/workspace/operation/time fields, `origin` (`agent_harness`, `adapter_observed`), `thread`, `tool`, `timing`, bounded `resources` and `candidatesTruncated`. Optional argument/result hashes fingerprint complete values already retained by Chat, with bounded hashing that can omit a fingerprint. They do not expose raw values or approve a general output artifact schema. The host-owned publisher verifies durable reservation and the locked schema; admission is distinct from ledger storage, observation completion and renderer receipt.

The observer uses a durable queue and the same workspace/path coordinator as mediated saves, without intercepting external tool execution. It permits at most four paths globally and one per activity, with a 16-disposition batch and bounded startup pass. Save-priority lock misses consume no filesystem attempt. Each claimed path group has at most three timeout attempts; lease recovery consumes an already reserved attempt. Work that cannot settle remains explicitly pending/failed/conflicting under bounded retries rather than an unbounded polling loop.

Safe observation requires the bundled asynchronous Darwin Node-API addon and required descriptor-relative flags. The native implementation pins/verifies the root and traverses with `openat`/`fstatat`, rejecting unsafe symlink/nonregular/racing outcomes. If the addon is unavailable, the job records `secure_open_unavailable` before workspace pathname lookup; there is no JavaScript pathname fallback and no registry/checkpoint mutation. Missing/replaced workspace authority, observation timeouts, permission/I/O failures, parent/final symlinks, nonregular files, files over 10 MiB and unsupported text are explicit failed/skipped outcomes, not successful empty observations. A safely established absent path is a separate successful `absent` state.

Eligible bytes must be exact, NUL-free UTF-8 up to 10 MiB. `checkpoint-repository.js` stores deduplicated exact bytes in `agent_snapshot_blobs` and sparse path-scoped checkpoints in `agent_resource_snapshots`. A read can establish the first checkpoint. First observation has no invented prior state; a changed bytes/absent state references the prior observed checkpoint and reserves `resource.state_observed@1`. Unchanged state reuses the existing snapshot and emits no new observation fact, while retaining the new activity/edge. The prior checkpoint may be much older than this tool and is not a pre-tool image. Concurrent external writes remain possible between execution and observation, so change does not prove authorship. Absent state has no live resource identity; a later file can acquire a successor identity while the path checkpoint chain remains continuous.

Same-activity edges stay queryable, but one observation per path uses write-over-read-over-execute-over-unknown dominance. Every successful observation, including unchanged, creates a durable renderer projection job. [Resource Events And Render Sync](../../005-Resource_Events_And_Render_Sync/PAGE.md) traces its v2 invalidation and central File Viewer consumer. [Assistant Query And Review Loops](../../009-Assistant_Query_And_Review_Loops/PAGE.md) traces ledger, query and restart behavior; [Chat Metadata Provenance](../001-Chat_Metadata_Provenance_Schema/PAGE.md) covers exchange binding.

## Approved scope and open work

The accepted overlay covers normalized activity and optional fingerprints, eligible exact observation checkpoints and the two named admitted facts. It does not register broad `chat.tool.*` events, provider-native reference publication, canonical file-version events, causal graph edges, general diffs/restore, snapshot-byte queries, captured-output storage or arbitrary plugin producers. Preserve historical evidence by default; broader lifecycle, disclosure and automation contracts need feature-specific decisions. No new interception, retention policy or complete tool/file census follows from the current implementation.
