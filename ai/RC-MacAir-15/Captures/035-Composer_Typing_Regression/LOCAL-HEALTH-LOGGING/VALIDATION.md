# HL-01 acceptance and evidence

These gates validate the logger, not the entire CHAT-AR roadmap. Use disposable profiles/projects and deterministic harness fixtures. No paid provider, owner content, upload, actual sleep/lock, installed Alpha or regular-profile mutation is necessary. Record baseline source/build hashes and exact commands. Do not rebuild native dependencies indiscriminately or alter the owner's running app.

## Required matrix

### V1 — content boundary and extension contract (A/B/C)

- Registry rejects unknown event names/versions/fields, arbitrary strings, nested extras, oversized bodies/batches, NaN/Infinity/negative or out-of-range values, malformed refs and invalid enums. No rejected input is echoed to diagnostics stderr/status.
- Through actual public prompt/tool/stream/error routes, inject unique canaries in prompt, response, thinking, tool name/arguments/results, title/path, arbitrary error, credential-shaped text and note/bookmark fixtures. They must appear where normally expected in the disposable chat/raw viewer but **nowhere** in the diagnostic DB/sidecars, validated queue/worker packets, new logger output or query output. Test both raw Diagnostics open and closed. Unrelated existing transcript logging is not this store and must not be imported.
- Prove producer constructs new scalar projections; downstream validation alone is not sufficient if raw content was copied into a queue first. Instrument worker/transport boundaries in tests to capture allowed schema only. Explicitly test the raw viewer's text cannot enter health collection.
- Addition test: one synthetic new code-owned numeric event version, with no primary schema change and no enabling arbitrary client fields. Unsupported version stays rejected until registered. Key, environment and raw source identity never enter telemetry rows.

### V2 — separate DB and lifecycle (A/C)

- Two disposable profiles receive distinct `health.db` and key/run identity; no reads/writes to the other profile. A standalone server and Electron profile both resolve correctly.
- Assert logger worker never opens/attaches primary DB. Logger-only start/append/query/cleanup leaves primary files/fixtures unchanged. Integrated chat may mutate primary data normally; compare logical expected chat rows, not a false byte-identical requirement during chat.
- Schema migrations on fresh/older supported stores, restart readback, disabled mode creates no health artifacts/timers, corrupt/newer/missing-key stores fail optional initialization safely. No evidence-destructive auto-reset. Explicit query on missing store fails without creating it.
- Optional init failure, worker exception, write permission denial, ENOSPC/SQLITE_FULL/busy and shutdown timeout do not change prompt/save/Stop outcomes or extend application deadlines. Graceful end and unclean-end-unknown distinguish observed facts from inferred causes.

### V3 — bounded work and failure isolation (A/B/C)

- Flood accepted observations and authenticated oversized/invalid batches. Verify serialized row/batch limits, controller+worker in-flight credit bounds, renderer queue, fixed-size counters, active surface cap and global rate ceiling. Demonstrate drop/gap reporting and recovery, including lost health records after crash.
- Slow/stall/kill worker, block query reader and disconnect/reconnect transport. No unbounded retries, IPC backlog, maps or shutdown wait. Chat remains usable and canonical results/output/order are unchanged. Malicious invalid event fields do not appear in rejection logs.
- Confirm no primary-DB `ATTACH`, no new provider request/process, no telemetry-controlled render speed or completion, no full-progress/transcript scan each sample. Repeated mount/dispose/reconnect does not leak timers/listeners or multiply production rates.

### V4 — age/count retention (A/C)

- Small injected caps exercise exact boundary, oldest-first deletion, independent age/count enforcement, 90% low-water cleanup, metadata reclamation, partial-turn coverage, no immortal gap/status rows. Inject future/old client timestamps and clock regression; writer receipt determines retention.
- Startup expiry before admission; query excludes expired rows while cleanup catches up. Flush cannot insert past configured row cap. Long-off app does not pretend continuous coverage.
- C also inserts at least 1,000,001 valid synthetic rows against the real default row cap in a disposable store and verifies bounded retained count/order with indexes. Use bounded generation memory; do not require a million real provider events.

### V5 — physical storage and query contention (A/C)

- Measure the actual sum of DB/index allocation and SQLite sidecar file sizes, not only row payload. Demonstrate page reuse/reclamation and no unbounded WAL/read pinning. Smaller byte-budget fixtures must scale the exact production headroom algorithm, not a mock size counter.
- C qualifies the production 2,000,000,000-byte budget: record configured main-page/journal/transaction headroom limits and exercise a near-cap real-file fixture with a held reader and writes. Admission pauses before exceeding the budget; oldest cleanup/recovery is bounded; no foreground VACUUM, backup accumulation or primary file cleanup. A fixture seeded above budget cannot accept more writes. If disk capacity makes this test impossible, report a blocking qualification gap rather than claim the full-size bound was tested.
- Five-second query deadline releases its reader, allowing maintenance. Idle/no-work renderer/server loop remains responsive during deletion/checkpoint. Application-level logging failure may lose observations but not chat data.

### V6 — real collection routes and ordering (B/C)

- Authenticated public renderer prompt → deterministic harness → existing canonical acceptance gate → sampled/reveal/composer metrics → separate DB query. It must work without opening Diagnostics. Run the same flow with the raw viewer open and closed; exact existing viewer behavior and output unchanged.
- Cover two chats, two mounts of one chat, workspace switch, duplicate/stale/out-of-order wire input, late old-turn events, process reload, snapshot hydration, long thinking/tool output, normal completion, Stop, failure, tool lifecycle, delayed save and renderer reveal lag. Server traffic is not double-counted by mounts and existing completion/save ownership remains intact.
- Inject accepted content fast enough to reach max reveal speed and build a queue. Query proves sampled backlog and terminal-to-composer delay without any content. Surface unmount/hidden/resume states are unavailable/gapped appropriately, not fabricated continuity.
- Unknown/formatted tool source mapping reports unknown. UTF16/bytes/HTML-visible/token units never collapse into one count. Reset/cumulative rate calculations and actual delayed intervals are correct.

### V7 — transport authority and native lifecycle (B/C)

- Unauthenticated renderer rejected; wrong workspace/epoch/thread rejected; renderer cannot impersonate main process or server facts. Bounded numeric message stays within existing authenticated dispatch and privacy maps. No general privileged IPC/raw JSON/remote SQL endpoint.
- Actual owned Electron main/child channel integration test exercises lifecycle framing, init ordering, disconnect, oversized/invalid input and shutdown without touching the secret-auth fd or existing readiness/workspace channels. A public renderer cannot invoke the main-only source.
- Test supported native suspend/resume/lock/unlock callbacks and renderer-gone reason mapping; unsupported/headless has explicit capability status. No human click or machine-wide power action needed. Runtime smoke exercises real startup/close; injected callbacks are not claimed as an actual lid-close test.

### V8 — determinism and sampling (B/C)

- Fake monotonic/wall clocks verify 250 ms, 5 s and 30 s policies, no burst replay after stalls/sleep, no repeated inactive chat sampling, final sample, clean disposal, count/measurement distinction.
- No individual key code/value/timestamp trace retained. At most one input-to-next-frame measurement per active interval. Query p95 clearly describes sampled measurements, not every keystroke.
- Same trace and query parameters yield the same counters/results. No LLM invocation, automatic summary, embedding, tokenizer pass, or transcript reconstruction. Query order handles either save-before-reveal or reveal-before-save and missing stages.

### V9 — manual query usefulness (A/C)

- Invoke CLI from a separate process with explicit store/profile. Read-only schema identity verification refuses `fusion.db`, unrelated SQLite, incompatible versions and missing stores. No migrate/create/ATTACH/load-extension functionality.
- Verify time/run/build/event/ref filters, keyset pagination under concurrent appends/retention, 200 default/1,000 max rows, deadline cancellation, deterministic supported trends and explicit partial coverage. Key resolver cross-checks known fixture IDs without accessing primary DB; wrong/lost key is visible.
- Demonstrate five recipes from SPEC §7 and save resulting content-free output as evidence. `status` reports store availability, last observation/freshness and recorded run end, with current enablement/liveness unknown. Verify fresh disabled and never-started profiles are both reported missing/unknown, and stopped versus disabled previously used profiles are not guessed from identical files. An existing file is not proof the app is running. Document malformed/corrupt/unavailable outcomes and raw SQL schema/units for owner-written scripts.

### V10 — regression and packaging (B/C)

Required current commands (run in the indicated directory; add actual new suites to the report):

- Server: `npx jest test/ws/live-diagnostic-route.integration.test.js test/thread/live-diagnostic-dispatch.test.js test/harness/opencode/turn-outcome.test.js --runInBand` plus new `test/health-logging/` and any touched startup/shutdown/route suites.
- Client: `npx playwright test --config=playwright.chat-architecture.config.ts e2e/stream-diagnostics.spec.ts e2e/visible-wait.spec.ts e2e/instant-collapse.spec.ts` (fixture-only, no shared server). Add new health-logging route/sampling tests and existing affected chat lifecycle/composer regression tests. Never fall back to the default Playwright configuration: it reuses a localhost server and can hit owner data. Real-server/Electron tests require their own fresh profile/owned port and existing isolated boot driver.
- Client: `npm run build`; focused lint on changed client files; Node checks/tests for changed Electron lifecycle/spawn modules using their existing test runner.
- Inspect packaging include patterns for runtime worker/migrations and optional manual script; no dependency/ABI reinstall or Alpha deployment merely to test packaging. Development query script may stay developer tooling, but document how owner queries a configured-profile DB from the development checkout.

Record pre-existing warnings/failures with control evidence; do not reclassify new regressions as unrelated without proof.

### V11 — measured overhead and isolated smoke (C)

Performance is a measured release gate, not a claim of zero cost. Same integrated build, deterministic provider trace, fixed pacing/workload and disposable profile. At least three paired 120-second logging-OFF/ON trials, alternate order. Each includes rapid thinking/content, tools, input, terminal reveal drain and save; record environment and workload seed. Test one surface and four simultaneously active surfaces. Invalid fixture/environment runs are recorded, not silently discarded until green.

Candidate engineering budgets (not existing measured results): median paired increase in sampled input→frame p95 ≤2 ms; no new instrumentation-attributable main/renderer task ≥50 ms; normal-load diagnostic pipeline memory overhead ≤64 MiB across owned processes, plus queues within their stricter byte caps; median CPU increase ≤2 percentage points of one logical core averaged over the trace. Record absolute baseline/ON values, units, peak memory, event count, actual disk bytes, throughput/drops and collection duty cycle. Normal fixture workload must have zero reported diagnostic drops; stress overflow separately must remain safe and visibly lossy. These budgets must not be met by disabling required observations or hiding test samples. If unmet, optimize within scope and rerun affected gates, or return a measured proposal rather than silently relax them.

Run actual isolated Electron smoke after current build: one deterministic turn, tool, Stop/recovery, window close and normal restart; manually query the same separate store and verify source/build identity, privacy, correlation and coverage. No owned runtime remains accidentally active after automated test cleanup. Preserve evidence before cleaning only exact fixture resources. Full actual power-cycle and long-duration soak are explicitly not claimed.

## Evidence and final report

Keep evidence under this bundle's `evidence/` with candidate/build hashes. Include command outputs, schema/event registry, privacy canary results, retention/file-size measurements, queue/IPC fault tests, on/off results and read-only query examples. Summarize deviations, which authority permits each, whether scope/shared contracts changed, and affected downstream evidence. Mark unsupported/unmeasured claims explicitly. All required gates and both builder/orchestrator CLEAN reviews precede presenting the SPEC as completed; owner acceptance follows the report.
