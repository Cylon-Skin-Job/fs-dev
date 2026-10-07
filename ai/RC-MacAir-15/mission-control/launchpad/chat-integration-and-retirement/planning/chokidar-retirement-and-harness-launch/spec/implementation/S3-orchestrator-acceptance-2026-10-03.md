# S3 Orchestrator Acceptance — shared Chokidar and watcher retirement

- **Gate:** S3 slice acceptance, CHAT-AR-SPEC-01
- **Result:** `CLEAN`
- **Builder:** `/root/slice_s3`, terminal. [Builder report](S3-builder-report-2026-10-03.md).
- **Builder reviewers:** `/root/slice_s3/s3_clean_room` (pre-repair, superseded); `/root/slice_s3/s3_repair_review` CLEAN; `/root/slice_s3/s3_final_repair_review` CLEAN.
- **Orchestrator reviewer:** `/root/s3_acceptance_review`, terminal `CLEAN`.
- **Persistent UUID/host metadata:** unavailable; agent paths are the identities exposed in this runtime. No `close_agent` capability was available.

## Independent inspection and verification

The shared Chokidar core and broad workspace watcher are deleted, along with direct dependency/lock entries, screenshot-folder and Apple Calendar watcher modules, static watcher filter directory/loader APIs, watcher startup/readiness/registration plumbing and shutdown close/abandon hook. Production source sweep shows no retired imports or registrations. No replacement scan, poller, or readiness gate was introduced. File-change trigger blocks register no action; tests emit `file:changed` and prove this. `chat`, `ticket`, `agent`, and `system` bus subscriptions and cron triggers remain active through the existing pipeline.

Preserved paths inspected: startup/listen ordering; component and action loading; protected `drop-file`; shared template/condition helpers; cron scheduler; runner heartbeat; boot-time theme CSS generation; event bus; S1 ledger exclusion; metadata collector; mediated save/versioning; agent tool observations; accepted S2 screenshot capture, Calendar UI/routes/broadcaster and Google poller.

Orchestrator reruns on current repaired bytes:

- S3-focused server Jest suites — **PASS**, 7 suites / 53 tests.
- Static production-source sweep for Chokidar, watcher modules, retired screenshot/Calendar listeners, watcher lifecycle, filter APIs and static watcher filters — **PASS**, no matches.
- Direct package/lock metadata check — **PASS**, no Chokidar direct entry.
- `git diff --check` over changed S3 paths — **PASS**.

Jest emitted the existing Node `--localstorage-file` warning; all tests passed. No S3 deviation or out-of-scope touch was found. The first builder review preceded the orchestrator-requested cleanup and is retained as history; two fresh reviews of repaired bytes were clean. S3 is accepted at current bytes.

## Advisory and downstream effect

Independent reviewer advisory: `fusion-studio-server/lib/frontmatter/catalog.js` still labels the `filter` frontmatter type as an active watcher filter. The reviewed runtime has no watcher activation, so this is stale catalog wording with no S3 material impact. Record as advisory for the S4 source-map/documentation sweep; it is not a SPEC deviation and does not block S3.

S4 may proceed. It must document the loss of automatic file-change trigger input and external-file observation, plus the accepted screenshot and Apple Calendar retirement limitations, while proving actual public OpenCode chat after removal.
