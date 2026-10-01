# SPEC HL-01 — Local content-free health history

Status: proposed executable candidate, pending owner approval. Normative companions: `INDEX.md`, `DECISIONS.md`, `SLICES.md`, `VALIDATION.md`. Read their exact standards/source paths before implementation.

## 1. Objective

Make current Fusion Studio dogfooding diagnosable after the fact through a small separate SQLite store of behavior measurements. Answer where latency accumulated, how far reveal lagged behind received output, whether the composer remained disabled after a turn, and whether sleep/reconnect/restart interrupted observation—without storing conversation or tool content.

The developer/assistant queries this local store manually. No AI analysis or aggregation runs automatically. The store is a replaceable platform module with an explicit typed input boundary; future plugin integration is possible but not implemented or assumed.

## 2. Non-goals and preserved contracts

No uploads, network destinations, export or pre-update snapshots, recurring schedules, server go/skip checks, shared-folder feature, plugin manifest/installation/permission UI, dashboards, new bookmark UI, alerts, remote SQL service, or general-purpose logging API. No user-data migration, retention cleanup of `fusion.db`, logging of raw native Diagnostics text, importer for old test logs, application-speed changes, reveal/collapse policy changes, provider flags or new provider requests.

Existing notes/bookmarks stay under primary metadata owners. Existing content-bearing harness reports and RD-02 native viewer retain their own contracts. Opening or closing Diagnostics must neither enable nor disable content-free collection. No hidden renderer or provider process is spawned for telemetry. No regular-profile/Alpha restart is implied by this SPEC. All automated evidence uses disposable fixtures.

## 3. Runtime and storage owner

### 3.1 Location, enablement and lifecycle

Resolve the active primary DB location using its existing owner without opening the primary DB from the logger. Place the new store at:

- Development default: `fusion-studio-server/data/diagnostics/health.db`.
- Configured profile: `${FUSION_APP_USER_DATA}/server-data/diagnostics/health.db`.

Do not derive this path from workspace names, project folders, machine labels, imported files or renderer requests. Different profiles remain isolated. The dedicated directory and key are private to the current OS user where supported (directory 0700, files 0600). This is not a claim that arbitrary same-user code is sandboxed.

Server bootstrap owns a single diagnostics controller/writer worker. Worker-owned migrations are separate from `lib/db/migrations/`; no `fusion.db` tables are added or changed. The worker opens only the diagnostics DB; services do not receive a primary DB handle. Existing primary migration/required startup results remain authoritative. Diagnostics initialization is optional and asynchronous: a failure reports a fixed status code without delaying shell readiness or denying chat.

Default locally enabled; host startup `FUSION_HEALTH_LOGGING=0` disables all producers, timers, DB opening/creation and transports for this module, leaving existing independent Diagnostics behavior intact. No renderer request, content file or plugin can enable/disable/configure it. Invalid startup configuration disables the logger with a fixed code, never silently changes primary policy. Record schema, collector and sampling versions when enabled. Do not forward the logger setting/key/path to harness children.

Graceful shutdown attempts a final bounded flush within 500 ms and within the existing server shutdown deadline, then closes the worker. Failure/timeout cannot extend shutdown or change application success/failure. Abrupt termination may lose buffered observations. On next start, mark a previous run without its clean end as `unclean_end_unknown`, not proof of crash. If initialization never succeeded, do not invent a durable prior run.

Unreadable/corrupt/newer-version stores disable diagnostics without touching `fusion.db`, moving files into growing automatic backups, or silently overwriting evidence. Expose actionable fixed status through manual `status`; repair/clear remains an explicit future owner action. No retry spin: after a worker failure at most one automatic restart per app run; report the observation gap. Resource-pressure admission can recover after capacity returns without restarting chat.

### 3.2 Minimal schema

Platform migrations own these logical tables (exact SQL may be normalized if all observables survive):

- `health_meta`: schema/collector versions and a random store UUID; no host label or credentials.
- `health_runs`: random run UUID, code/build identity, collector config version, start/end wall time, clean/unknown outcome. Child process/source epochs distinguish reconnect from process restart. Bound run/schema metadata under the same byte/age policy; no immortal per-run history.
- `health_events`: increasing ingest ID; run/source UUID and source sequence; event-name/version from the closed registry; observed wall time and source monotonic elapsed time; server receipt time; nullable pseudonymous workspace/chat/turn/surface references; severity/code enums; validated numeric/boolean/enum body.

Indexes: receipt-time/ingest ordering, `(run_id, ingest_id)`, `(thread_ref, turn_ref, ingest_id)`, `(event_name, received_at, ingest_id)`. Add an index only with a concrete supported query. No full-text search index, raw `message`, arbitrary JSON metadata, stacktrace, free-form tag, SQL text or URL field. A typed JSON body is allowed only after full closed-schema validation; reject unknown keys. Defaults are finite, nonnegative, range-checked numbers; availability is explicit, not a fabricated zero. Maximum persisted event serialization 4 KiB. Embedded arrays are prohibited in v1 bodies; multiple observations are multiple bounded rows.

Store build identity once per run (events reference the run): release version plus actual build identifier; for development use a reproducible digest of relevant shipped source/build bytes, computed once outside the interaction path. A dirty checkout must not be represented as a clean commit. Do not store branch names, checkout paths or environment dumps. A code/build identifier is not a content digest of user work.

### 3.3 Correlation without personal identifiers

Use a 256-bit random profile-local correlation key stored outside `health.db`, not in a log row, primary table or provider environment. Derive refs with domain-separated HMAC over exact owner-qualified IDs (workspace ownership/root qualification, chat, turn, surface). Never hash prompt/response/tool/file content. The key is protected local configuration; its path/value is never reported as telemetry. Its presence does not imply plugin permissions are enforced today.

Qualify IDs before hashing so identical IDs from different workspaces cannot collide semantically. Pass source IDs only through trusted route resolution, then project to refs before logger queue/worker/diagnostic persistence. No raw provider session ID, path, local thread timestamp ID, machine name, hardware identifier or primary exchange content in rows. A local manual resolver may accept explicit known IDs and use this key to derive matching refs; it never enumerates or reads `fusion.db`. Key loss produces an explicit unresolvable-reference condition, not an automatic overwrite/remap of existing records. Logger initialization with an existing nonempty store and missing/mismatched key fails safely; a clean new installation creates both. Reference lifetime is profile-local; reinstall/clone and cross-instance identity are deferred.

Correlation is for diagnosis, not authentication. Multiple renderer mounts of the same chat have distinct surface/source refs; count server turns once and analyze per-surface reveal separately. Retain run/source/sequence identifiers even when thread correlation is unavailable. Never borrow the currently selected chat to label a delayed event.

## 4. Content-free collection boundary

### 4.1 Closed event registry and safe extension

Every event has a code-owned name/version, field schema, units, producer owner, sampling/transition policy and test. Add future families through that registry and tests, with migration only if SQL structure changes. Unknown names/versions/fields fail closed at collection and again at persistence; rejected values are never echoed into logs. New fields must be explicitly content-free; no catch-all attributes bag, console interceptor or generic provider/UEB forwarding. Observation code constructs a fresh scalar projection; it must not spread/serialize raw messages, arguments, diagnostics buffers, DOM, store snapshots or Error objects.

No key values, key names/codes, composing text, clipboard text, input length history that could reconstruct individual key edits, prompt text, assistant text, thinking text, tool names supplied by harnesses, tool arguments/results, titles, filenames, paths, URLs, usernames, credentials or arbitrary errors. Latency and aggregate input-event count are allowed; typed content and individual key timing trails are not. Counts of received/revealed output are allowed by owner direction. Token count is nullable and only included when explicitly provided by an established normalized usage owner; no tokenizer or inference from character count in this SPEC.

Throwing/rejecting telemetry must never change canonical acceptance, reveal completion, provider drain, tool result, Stop, save or recovery. Existing runtime decisions do not read health history. This store is not the event/provenance ledger and never participates in mandatory acknowledgement.

### 4.2 Version 1 observation catalog

Each row below defines a required family; exact suffix/version names must be frozen in the implementation registry and documented in the query guide. All reasons/phases/categories are closed product enums, not provider text.

| Family | Required fields / meaning | Cadence and source |
| --- | --- | --- |
| `runtime.lifecycle` | start/clean-stop, source kind, supported/unsupported native capabilities; prior unclean-end-unknown | Source lifecycle; one run/source boundary record |
| `turn.lifecycle` | prompt accepted, first canonical output, provider/canonical terminal reason, Stop request/settlement, save outcome; exact correlation refs | Existing server owners; transitions once, never replay acceptance to produce a record |
| `stream.sample` | cumulative accepted UTF16 units and event counts separately for content/thinking/args; tool-event counts; last accepted output age | Server/renderer accepted canonical boundary; 250 ms while active, final sample at terminal. Object tool output has unknown prose length; do not stringify it. |
| `reveal.sample` | current phase, queued segments, ready chunks, current chunk total/progress, source committed cursor if known, visible units with their type, actual pacing batch/delay, max-speed-policy-active, wait age, availability | Mounted active/finalizing surface, at most 250 ms; active-frontier bounded projection only |
| `composer.state` | enabled/disabled transition and reasons: disconnected, submitting, streaming, stopping, waiting-for-save, waiting-for-reveal, no-target, other-known | Existing connected owner; changes only, no inferred extra disable logic |
| `input.sample` | interval input count, one sampled input-to-next-frame delay and measured flag; composition-active boolean | At most one latency measurement per 250 ms per focused composer; no keyboard/clipboard content; skip when no input |
| `tool.lifecycle` | started/finished/interrupted/unknown, duration where same clock/owner provides it, success/failure/unknown, pseudonymous call ref | Canonical tool owner; no tool name/arguments/result or second tool invocation |
| `connection.lifecycle` | open/close/reconnect attempts/ready, gap/duplicate/stale/rejected-frame counts and stable reason codes | Existing transport/sequence gates; failures in telemetry do not change gates |
| `process.sample` | own-process memory bytes and CPU deltas with units, event-loop delay sample where supported; active source count | 5 seconds; only Fusion-owned processes, no system process inventory or command lines |
| `host.lifecycle` | observed suspend/resume, lock/unlock if supported, renderer-gone reason code, native window visibility/close | Electron main owner; absence/unsupported explicitly recorded. No screen capture/native-input testing requirement. |
| `logger.health` | queue pressure, rejected/dropped counts, worker status, gap bounds, retention counters/oldest-retained watermark, cap reason and schema version | On changes and bounded liveness; counters must not recursively log their own writes |

Finite v1 reason enum may include `unknown`; it may not interpolate raw values. Record unsupported observations honestly. Native Electron suspend/resume and renderer-gone integration is required on supported macOS; headless server operation remains supported with host observations explicitly unavailable.

### 4.3 Measurement semantics and cost

Retain each selected measurement. No destructive averaging, percentile rollup or AI summarization. Interval counters are exact counts, not retained individual keystroke traces. Queries derive rates from actual sample intervals. Do not sum cumulative counts across samples or sum duplicated surfaces into server traffic. A sampled maximum is labelled sampled, not a guaranteed maximum between ticks. Optional producer-maintained high-water counters are allowed only as additional explicitly labelled deterministic observations, not replacements for selected samples.

Source UTF16, UTF8 bytes, provider tokens and HTML-visible units are distinct. A source cursor can be compared with received source only within the same category/unit and known mapping. Formatted tool bodies report mapping unavailable rather than inventing source progress. Numeric progress must reuse the actual reveal policy, not a second estimate of speed. A bounded active-frontier accessor may be added to `RevealProgress`/`SurfaceRevealProgress`; never scan/copy all prior segments or transcript strings every 250 ms. No additional React rerender per sample.

Measure duration on one monotonic clock and source epoch. Wall time allows approximate incident lookup, not causal latency across processes. Record actual sample timestamp/duration; delayed timers do not replay missing ticks. Sleep, hidden/unmounted surface, clock jumps and process reload create gap/unavailable observations, not simulated backlog or catch-up samples. For the key diagnostic timeline, renderer-local receipts of terminal/saved plus reveal-complete/composer state provide same-clock durations; server-side save/Stop timing is reported separately. Do not claim exact provider-finish-to-client latency by subtracting unrelated clocks.

Stop active sampling when a surface is unmounted or fully settled; observe terminal-to-reveal and save-to-enabled delay until actual settlement. Idle app liveness is one 30-second record per source, not per chat. Default active sampling cap is 32 surfaces total per renderer; excess surfaces report omitted count. No hidden renderer mount for telemetry. Collection must have explicit disposal on workspace changes, source reload, disconnection and shutdown; old-turn observations cannot populate a new turn.

## 5. Transport, buffering and failure isolation

Use existing authenticated renderer WebSocket dispatch and named chat-turn diagnostic domain for `chat-turn:health:batch`. Unlike the raw viewer, this is a numeric upload to the local logger, not a subscription or persisted user action. Authenticate via existing trusted-shell authority; resolve current connection workspace/root/epoch and exact thread membership; scope source/turn/surface references. Server stamps receipt time and validates allowed fields/ranges again. Client claims do not become authoritative server facts. Forged workspace/thread/source, invalid keys, unauthenticated messages and oversized batches produce fixed rejection counters without echoing data or throwing into chat.

Application-wide renderer connection observations may have no thread, but use server-owned connection identity. Electron host facts originate only from a main-process collector via a private main→child channel or equally restricted existing host transport. Renderer messages cannot claim `source_kind=electron-main`. Reuse server-spawn ownership, readiness/auth and workspace-binding contracts; do not repurpose secret fd 3, parse stdout or expose a generic privileged IPC proxy. If adding a dedicated child pipe is necessary, document lifecycle/framing and test spawn/close/failure; no remote HTTP diagnostics-ingestion endpoint.

Renderer batching: flush at most once per second or when bounded batch is full; maximum 128 rows/256 KiB. Total renderer queue ≤1 MiB. Server controller plus worker in-flight queue combined ≤4 MiB and ≤4,096 events; each limit independently enforced. Global accepted ingress rate ≤1,000 events/second, excess counted/dropped. Reserve bounded capacity for health/transition records; overflow discards periodic samples before transitions where possible, but is explicitly lossy, not guaranteed delivery. Worker IPC needs acknowledgments/credits; `postMessage` without bounded in-flight accounting is insufficient. Account for serialization copies in performance evidence.

No synchronous SQLite or filesystem operation in renderer/canonical drain. Scalar construction must be bounded. Flush batches in worker transactions, normally once per second or 128 rows. Writer holds no `fusion.db` connection, foreign keys or attached database. No fallback to text logs containing rejected input. Keep dropped/rejected counters in fixed-size memory and report them on recovery; if even that report is lost on crash, next run says possible gap. No unbounded retry queues or indefinite shutdown waits.

## 6. Retention and physical budget

Defaults: 30 days; 1,000,000 event rows; 2,000,000,000 bytes for the diagnostics DB and its SQLite sidecars including indexes. First limit wins; purge oldest receipt/ingest order. Use writer-assigned receipt time, not untrusted client clock, for age. Expired rows may remain while the app is off, but startup cleanup runs before accepting new records and queries exclude expired rows even before cleanup. Never evict personal notes/bookmarks/history. Parent metadata with no retained references is reclaimed; row caps cannot leave unbounded metadata/key maps.

Retention runs in bounded worker batches (≤1,000 deleted rows per transaction), at startup and at least once per minute while active; row/byte admission checks also run before each insertion batch. Evict below a low-water target of 90% of the binding count/size cap to avoid per-row churn. Retention must report coverage watermarks and number/reason of removed events. No requirement to preserve a whole turn if a cap cuts through it; query output flags partial coverage.

The byte cap is physical, not `SUM(length(body))`. Implementation must allocate within-budget headroom for page/index growth and the largest permitted transaction/journal/checkpoint before accepting writes. Choose and document SQLite journal/reclamation settings plus actual main/sidecar maximums whose sum fits the budget. Deleted pages may be reused; shrinking/reclamation happens only on the worker and cannot block chat. No foreground full `VACUUM`. Read queries have deadlines so pinned readers cannot cause unlimited WAL growth. If cleanup/checkpoint cannot recover space without exceeding the budget, stop diagnostics admission and report `storage_pressure`; preserve normal chat. A store already oversized at startup receives no new writes until within budget. Do not silently create archive copies or increase limits.

Age uses UTC epoch receipt times; detect wall-clock regression and report it. Do not let a future-dated client timestamp prevent expiry. Startup/clock anomalies must not turn into a claim of 30 full days of continuous coverage.

Limits are code-owned defaults with smaller injectable limits for tests; no arbitrary renderer-configurable retention. Candidate deviations may tune N/sample cadence based on measured volume without changing owner privacy/isolation/2 GB/30-day ceilings; record exact configuration in reports and obtain affected review.

## 7. Manual query workflow

Provide local `fusion-studio-server/scripts/health-query.js` (or an equivalent documented existing script owner), plus reusable read-only query module. Require explicit `--db <health.db>` or explicit `--profile <profile>`; never pick the most recent profile, scan personal data, initialize a missing database, import transcript logs or start a server to answer a query. Refuse a file without this schema's application/schema identity. Normal query mode opens SQLite read-only and query-only; no write/migrate/ATTACH/load-extension path. No remote arbitrary SQL or UI endpoint.

Supported commands/presets: `status`, `events`, `turn`, `gaps`, `trends`, `resolve`. Filters: time range, run/build, event family, pseudonymous chat/turn/surface ref; bounded keyset pagination, default 200/max 1,000 rows. `resolve` consumes explicitly supplied owner-qualified IDs and the local key, never queries primary history. Offline `status` reports store availability (missing/readable/incompatible/unavailable), last recorded run/end, last observation time, observation age and coverage. Current host enablement and liveness are `unknown`: absent or stale files cannot distinguish disabled logging from a stopped app. A startup switch supplied to the query process describes that invocation only, not the running host. No new runtime status service or disabled-state artifact is required.

Provide deterministic example queries for: terminal-received→reveal-complete→save-received→composer-enabled; sampled backlog at maximum speed; maximum/p95 sampled input latency; reconnect/gap periods; build-to-build comparisons. Support independent save/reveal ordering, absent stages and mid-turn retention cuts. Queries return counts/coverage/units alongside metrics. No default transcripts, notes, shell-output text or provider payload joins.

Run aggregation in a separate query process; bound each operation to 5 seconds and ≤1,000 output rows, cancel cleanly on expiry. Large analysis can use explicit smaller time windows. Never keep an open interactive read transaction that prevents writer maintenance. Document a SQLite read-only workflow and table/schema/unit reference so later owner scripts can ask different questions; direct custom SQL is an owner action, not part of a remotely exposed API.

## 8. Integration and release criteria

All A/B/C criteria in `VALIDATION.md` pass on an identified integrated candidate with fresh builder and orchestrator reviews. Every change/deviation, skipped check, supported/unsupported metric and performance result is in the final report. Small instrumentation integration is permitted; unrelated refactors, worker infrastructure frameworks, plugin/server work or new UI require separate authority. Package inclusion of runtime worker/migration files is checked without installing Alpha.

Demonstrate an isolated actual Electron session with deterministic provider fixture, content-free observations arriving in the intended profile store, continuing after Diagnostics closes, manually queryable after normal shutdown/restart, and no primary-data corruption. No paid provider, human typing, two-hour wait or personal-data upload is necessary to satisfy this SPEC. Native sleep/lock event wiring can use test-injected supported event callbacks; any actual lid/sleep validation requires a separate coordinated action and must not block the entire store release if the supported route tests and declared limitations are accurate.

This is readiness of the new logger, not acceptance of prior native typing/soak or overall Fusion roadmap completion.
