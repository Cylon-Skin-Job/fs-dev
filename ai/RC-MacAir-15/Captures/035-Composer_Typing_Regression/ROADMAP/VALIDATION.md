# Executable validation contract

Commands are run from the repository root unless stated otherwise. Entries marked NEW are deliverables of SPEC-01, not existing tools. SPEC-01 must implement and prove the runner before later SPECs rely on it; listing a command is not evidence that it ran. Backend-feature tests added by later SPECs extend the runner manifest in their own slice.

## Standard commands

- V-BUILD: `npm --prefix fusion-studio-client run build`.
- V-BASE (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite baseline --mode characterize`.
- V-SUBMIT (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce`.
- V-ACTIONS (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite actions --mode enforce`.
- V-RENDER (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce`.
- V-BACKEND (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite backend --mode enforce`.
- V-ALL (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite all --mode enforce`.
- V-SOAK (NEW): `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite soak --duration-ms 2700000 --mode enforce`.
- V-SHELL: `node fusion-studio-client/e2e/view-bound-shell-smoke.mjs` (existing, but first brought under the runner's verified isolation/lifetime contract in SPEC-01; later SPECs invoke its owned runner entry).
- V-ISOLATION: existing `e2e/chat-surface-isolation.spec.ts`, run by the NEW fixture-only config `fusion-studio-client/playwright.chat-architecture.config.ts`, excluding its old standalone HTTP app-boot case. Command within client: `npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-isolation.spec.ts`. Replace excluded boot coverage with the real Electron V-SHELL lane, not with an untested omission.

The runner supports exactly the named suites and mode flag; unknown flags fail. It records a run ID, current source hashes, command lines, selected test names, Node/Electron versions, workload hash, viewport and foreground state, observer support, WS frame counts/types, and owned process/profile paths. Nonzero underlying test exits propagate. No `test.skip`/`fixme`, permanent expected-failure annotation or swallowed exit can satisfy enforce mode.

The runner also accepts `--cases <comma-separated-test-IDs>` for slice-owned subsets and `--suite shell --mode enforce` for V-SHELL under its owned lifecycle. IDs and exact expanded commands are recorded in SPEC-01; they select tests without weakening assertions.

## Isolation and bounded lifetime

Per run create private profile/workspace/artifact roots and reserve ephemeral ports; validate every registered workspace root resolves inside the fixture before Electron starts. Prefer deterministic sanitized fixtures. Backup copies contain only selected content into new fixture-owned sessions, never a live workspace registry. Exclude .git, node_modules, resources/release, generated runtime data and unsafe symlinks. The existing probe's unconditional user-backup dependency is removed from the required lane; optional actual-backup runs remain private evidence.

Reuse proven existing lifecycle mechanics only after checking their authorization/profile/resource behavior. Do not take a dependency on parked Office SPEC-12 bytes. Close owned Electron and server children in finally/signal paths; enforce parent-loss cleanup and a process deadline. Short-suite deadline is 15 minutes with individual interaction deadlines at 90 seconds. Soak deadline is 55 minutes. Emit bounded progress at least every 30 seconds. Use a unique log per run; do not alter owner's processes or logs. Missing native assets/dependencies fail clearly instead of downloading them. No benchmark overlaps builds, other test workloads, or another controlled timing run; record foreground status to expose background throttling.

## Fixtures

F1: fresh empty Capture view, one chat.
F2: sanitized deterministic long conversation: 30 exchanges / 60 rendered messages containing text, code, lists, tables, collapsed tool results and reply metadata. Include a separate dense two-exchange fixture matching the observed ~522 KB assistant-payload scale. Preserve structure without copying private message content into tracked fixtures.
F3: deterministic realistic workspace content: Capture, File, Wiki, Office and System action entry points; a fixed synthetic inventory of 1,000 small files, 100 Capture folders, 100 Wiki pages and 20 Office documents, totaling at least 10 MiB of deterministic text/content bytes, declared in a generated fixture inventory. These are candidate workload targets, not an assertion about an unrecorded prior fixture. Fix the inventory for matched comparisons; every referenced path stays in the fixture.
F4: same-session duplicate mounts, two sessions in different views, and a Side Chat after Move. Both visible and inactive mounted states.
F5: deterministic adapter produces 20 canonical stream frames/second, bounded 200-character text frames plus controlled thinking/tool/usage/terminal events. It supports named failure points before/after admission, ACK, dispatch, turn begin, Stop, save ACK and shutdown. Stub provider computation only; keep real shell auth, router, ownership, canonical drain and SQLite boundaries.

SPEC-01 records immutable fixture manifests and hashes. Changing a fixture requires rerunning the relevant baseline/candidate pair, not silently relaxing it. Initial hydration/focus and settled typing are distinct windows; record a fixed 45-second settle for comparison and a separate startup-responsiveness result. PerformanceObserver absence is a failure/inconclusive marker, never zero long tasks.

## Reproduction and public-route regression cases

R1 draft amplification: type into real production composer over F2/F3; count history formatter invocations, affected React commits, DOM mutations, key/input/rAF timings and wall time.
R2 no-enqueue Send: disconnect transport before click; then a separate injected enqueue exception/race. Assert editable retained draft, visible not-sent result and no acceptance spinner or transmitted prompt.
R3 lost ACK: drop acceptance response after commit; recover via real reconnect/status route and prove one receipt, one group activity, at most one Fusion provider dispatch and one user bubble.
R4 late/repeated attempts: identical texts under distinct IDs, duplicate one ID, mismatch fingerprint, old response after new draft, switch view/thread, remount, restart.
R5 production actions: actual SendToChatButton from File/Wiki/Office, text insertion, diagnostic append, and SystemViewer prompt-based new chat. Assert actual target attachment/draft/command result before success notification; no-current/no-consumer produce visible failure. Include source view versus later active-view switch.
R6 async lifetime: close/unmount/reconnect while prompt resolution and creation await; unrelated thread:opened cannot consume the request, and stale nested listeners do not remain after completion/cancellation.
R7 live/Stop/finalization: interleave two sessions, stop one, reorder/duplicate frames, delay saved-exchange ACK, restore snapshot, and prove exact partial persistence with bounded visible recovery for failure. UI timer never fabricates a saved ACK.
R8 group/backend: create, warm, Send, Move, member open, concurrent Move/Delete, busy rejection, session-capacity enforcement, mirror failure, outbox write/ACK failure, process restart and late old-generation provider frame.
R9 owner symptoms: distinguish disabled textarea from blocked renderer; distinguish pending Send wheel, finalizing wheel and assistant activity. Capture request/turn/state transitions and timings. OS/native input test on isolated candidate plus explicit owner acceptance; no assertion that one reproduced defect proves every original freeze.

SPEC-01 characterization executes R1–R9 where feasible and records observed failures separately. It succeeds when fixtures/gates are sound and the known failing scenarios are reproducibly demonstrated (or a disputed source-level hypothesis is explicitly disproved with evidence). It does not require fixing product behavior in 01. The issue map must name the later owning SPEC for each demonstrated violation. Enforce mode starts for owned scenarios in their repair SPEC; final V-ALL has no expected failures for this program's contracts.

## Performance gates

Timing hardware: same local Mac, Electron/dependencies, viewport and foreground policy for baseline/candidate. No CPU throttling. Use 68 printable ASCII characters at 25 ms configured delay for short comparisons, at least three repeated runs. Require zero lost/duplicated characters, keydown-to-input p95 <=3 ms, next-rAF p95 <=20 ms and max <=50 ms, zero measured long tasks >50 ms, and wall time <=1.5 times configured character delay budget in the settled idle fixture. Next-rAF is not presented-pixel/OS latency: retain wall time and native/owner evidence.

Five-minute idle continuous typing on F2/F3 must satisfy the same per-event thresholds and exact text retention, with no freeze and zero long tasks >50 ms. Keep draft length comparable to the observed 9,520-character run, not a tiny periodically cleared draft that hides scaling. Test emoji, autocomplete, IME/composition and paste separately for correctness; emoji-recents traffic is explicitly permitted only in its own case.

With F5 streaming into the same or another session: input p95 <=3 ms, next-rAF p95 <=32 ms, max <=100 ms, no lost characters and no long tasks >50 ms in the declared bounded frame workload. Zero history reformatting on draft edits and live-only frames; changed metadata updates the intended message. These are proposal AR-P03, not previously certified performance promises.

45-minute soak: mix typing, group/view switches, two-session streaming, Move/Side tabs and fault/recovery cycles under fixed F2–F5 inventories. Include a five-minute continuous idle typing window at start and end plus one five-minute streaming window; remaining time repeats lifecycle interactions. No hung attempt state, uncaught error, leaked owned process, or monotonic listener/cache/session-count growth across 20 repeated open/close cycles. Compare retained JS heap at equivalent settled state after warmup versus end with diagnostic GC outside measured input windows: growth <= max(32 MiB,20% of warmed baseline). Record RSS/footprint too; crossing the heap limit is a failure to investigate, not automatic cache clearing. Native input and original symptoms require owner acceptance even if synthetic numbers pass.

## Existing regression inventory

Client suites: chat-surface-identity, chat-surface-isolation, threaded-chat-host, prompt-ownership.slice-c, working-activity, move-chat-to-side-chat, side-chat-isolation, side-chat-placement-recovery. The runner maps fixture-only cases separately from boot-dependent cases and replaces their old HTTP assumptions with isolated authenticated Electron coverage where required. Retain assertions; do not make failures vanish by changing selectors without showing the behavioral replacement.

Backend focused tests include `test/ws/prompt-canonical-route.integration.test.js`, `test/ws/privileged-thread-public-route.integration.test.js`, `test/thread/thread-runtime-controller.test.js`, `test/thread/thread-activation-lifecycle.test.js`, `test/thread/thread-crud-active-turn-reconnect.test.js`, `test/thread/thread-group-lifecycle.test.js`, `test/thread/thread-group-delete-recovery.test.js`, `test/thread/thread-manager-chatlog-sync.test.js`, `test/ws/thread-group-move-side-chat.integration.test.js`, `test/ws/thread-group-worksurface-cleanup.integration.test.js`, plus new prompt-receipt/recovery cases in SPEC-02. Commands within an owned staged server fixture: `npm test -- --runInBand --runTestsByPath <listed paths>`. SPEC-05/06 additionally run full `npm test -- --runInBand` in the isolated server test environment. Preserve the package's pretest native-build requirement; provision dependencies explicitly and fail closed if unavailable.

Existing 025 reports identify historical baseline-red suites. SPEC-01 reruns and records exact current failures. Any failure touching this program's modified behavior is owned and must be repaired. Truly unrelated failures can be non-blocking only with specific evidence and explicit owner disposition; final reports name them. No blanket reuse of old baseline-red labels.
