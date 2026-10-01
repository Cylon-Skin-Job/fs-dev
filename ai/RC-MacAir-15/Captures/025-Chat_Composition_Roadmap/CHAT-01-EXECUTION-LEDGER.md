# CHAT-01 (SPEC-01) — Thread Group Foundation Execution Ledger

**Bundle:** `025-Chat_Composition_Roadmap` · **Candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (owner-approved 2026-09-13)
**SPEC:** `SPEC-01-THREAD-GROUP-FOUNDATION.md` (owner-approved packet; CHAT-01 dispatch authorized by `RELEASE-MANIFEST.md` §7)
**Baseline commit (dispatch):** `1ded59ce2e0947d6209d0c23e82fe273591e28b2`
**Baseline branch:** `agent/exact-workspace-paths`
**Migration head at dispatch:** `040_reported_ui_context.js` → next free migration `041`
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Gates:** SPEC-01 §12 (`npx jest --runInBand` on `fusion-studio-server`; focused Playwright `e2e/thread-group-compatibility.spec.ts` on an isolated port; client `npm run build`; Provenance regression commands; restart/readback; fingerprint)
**Hard constraints:** never commit/amend/push; preserve unrelated worktree bytes; BRIDGE-02 remains contract-only; consume `BRIDGE-02-CONFORMANCE-OVERLAY.md`; no BRIDGE-01 schema additions; no edits to accepted SPEC-00 / TABS-03 / bridge / Provenance migration or fact schema.

## Prerequisite Record (verified in ancestry at dispatch)

- SPEC-00: implemented `1baaffa`, owner-accepted `7f0d3c8`; exported trusted-shell guard consumed as-is.
- PROV-01: source `acf12dafe7499b04995617e5d9c1512775e5ba12`, integration merge `d31fc8a`, acceptance `3110bd0`.
- BRIDGE-01: owner-accepted `16ccecf`; schemas/migration 040/route paths are protected non-owned baseline.
- BRIDGE-02: owner-approved living candidate `BRIDGE-1e722a9c6d30f6b5`; docs commit `1ded59c`; contract-only.
- Tab Platform milestone: owner-released `333d49e`.
- Overlaid `025` candidate owner-approved 2026-09-13; `CHAT-I-035` gate satisfied.

## Pre-existing unrelated worktree bytes (preserve; never touch)

- `M ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json` (owner live view-state drift)
- `?? ai/RC-MacAir-15/Captures/031-Remote_Access/` (separate concurrent worker artifact)

## Slices

| Slice | Scope | Builder | Builder gate | Orchestrator gate | State |
|---|---|---|---|---|---|
| 01A | Safe one-member Thread activation | `ses_f6594fb8bffe8G3LyhEtbRsINX` | `ses_f6531db55ffenexjJTwJ3hwyFD` CLEAN + `ses_f653ff748ffeWPX6JBKEO1T6GL` CLEAN after F1 repair | `ses_f65297bbbffeelJKZeO8Kk1pWd` CLEAN (1 pass) after orchestrator-ordered R1–R5 repair | **accepted** (2026-09-13) |
| 01B | Group Rename and Delete | `ses_f651c7b7cffeERDgerB0AI1bU7` | `ses_f6503dd1bffeUGnxA51EJR17gY` CLEAN (1 pass) | `ses_f64fdd538ffebDvBRTvj3NcCfB` CLEAN (1 pass) | **accepted** (2026-09-13) |
| 01C | Activity, links, Markdown, search, integration report | `ses_f64f8064cffeBrh54ex1ttRaKd` | builder gate CLEAN (1 pass) after 01C-D7 self-repair | `ses_f64cdec9dffeuKRZbwlvfKEWGV` whole-SPEC final integration CLEAN (1 pass) | **accepted** (2026-09-13) |

## Deviations

(recorded with contract clause, actual change, reason, tests/effect, downstream impact, classification)

### Slice 01A

- **01A-D1 — migration-head oracle updates (040→041)** — clause: SPEC-01 §12 required checks + §13 expected areas; actual: `test/event-registry/migration.test.js`, `test/fusion/system-wiki-view-path-migration.test.js`, `test/views/view-relocation-journal.test.js` update the last-migration oracle (the last is a BRIDGE-01 test path). Reason: new mandated head; minimal oracle-only edit. Tests/effect: full suite green; no schema/behavior change. Classification: **accepted**.
- **01A-D2 — retained SPEC-00 `thread:fork` bounded denial** — clause: SPEC-01 §10 "remove thread:fork/thread:forked protocol/types/handlers". Actual: the `thread:fork` handler remains solely as SPEC-00's `denyThreadFork` bounded `THREAD_FORK_UNAVAILABLE` response; every capability (service, hook, config, provider `--fork`, types, capability tests) is removed. Reason: SPEC-00 acceptance requires the bounded denial and its public-route test; the guard is consume-only and unmodified. Tests/effect: fork capability test-sweep clean; public denial retained. Classification: **accepted**; downstream: none (permanent unless the owner retires the SPEC-00 guard).
- **01A-D3 — Fork deletion set** — clause: SPEC-01 §10; actual: `thread-fork-service.js`, client `useComposerForkAction.ts`, `pendingFork`/`forkProvenance`, OpenCode `--fork` construction/consumption, and three Fork test/smoke files removed; client types and handlers updated. Tests/effect: full suite green; no provider Fork path. Classification: **accepted**.
- **01A-D4 — view-ID preflight identity handling** — clause: SPEC-01 §6 first rule vs §12 proof bullet + CHAT-RD-013 + CHAT-I-004; actual: after orchestrator repair R1, absent `metadata.view-id` is assigned once; **present-but-invalid IDs stop with `view_id_preflight_repair_required` and are never rewritten**; parse/duplicate/write failures stop. Reason: the §12/RD-013/CHAT-I-004 stop-list governs the invalid case and prevents silent identity rewrite/downgrade. Tests/effect: preflight probes + lifecycle/restart tests. Classification: **accepted** (repaired).
- **01A-D5 — prompt-accepted activity/group MRU deferred to 01C** — clause: SPEC-01 §5.4 MRU causes/§11 01C. Actual: 01A advances group MRU at creation only. Tests/effect: deterministic ordering at creation; prompt MRU added in 01C. Classification: **downstream_impact**.
- **01A-D6 — `resolveVisibleTarget` mock-manager fallback** — clause: SPEC-01 §7/§8.1; actual: a test-only fallback in `thread-crud.js` keeps direct handler fixtures working; production managers always own the Thread Group service and verify membership. Classification: **accepted** (test adapter; removal criterion: fixtures supply `threadGroups`).
- **01A-D7 — redaction map unchanged** — clause: WS standard redaction checks; actual: no new credential-bearing fields. Classification: **accepted**.
- **01A-D8 — `startup.js` isolated PROV fixture mints an independent group id** — clause: SPEC-01 §4 non-interchangeable identities; actual: fixture creation passes `groupId = mintThreadGroupId()`. Classification: **accepted**.
- **01A-D9 — `_internal` migration exports** — clause: §12 testing; actual: focused tests call the same `up` steps; production `up` is identical. Classification: **accepted**.
- **01A-D10 — `ThreadIndex.create` retained but unreachable** — clause: §7 ThreadManager ownership; actual: no production caller; latent repository method. Classification: **accepted advisory**.
- **01A-D11 — group-projection test adaptation + explicit Legacy query** — clause: §8.1 group projections/explicit null view; actual: `test/ws/privileged-thread-persistence.integration.test.js` list assertion reads `currentPrimaryThreadId`; the Legacy rail sends `{type:'thread:list', viewId:null}`. Classification: **accepted**.
- **01A-D12 — forward CHECK enum values in migration 041** — clause: §5.3/§5.4 (SPEC-04 extends). Actual: `reason` admits `move-to-side-chat`; activity `kind` admits `move-chat-to-side`; no 01A writer. Reason: SQLite CHECK extension requires a table rebuild; vocabulary is fixed by CHAT-I-028. Classification: **accepted** (no behavior activated).
- **01A-D13 — flow-style `metadata: {…}` parent stops** — clause: §6 write safety; actual: `replaceNestedFrontmatterField` refuses a non-block parent, surfacing a repair-required diagnostic instead of duplicating a key. Classification: **accepted**; residual risk: no current capsule uses flow style.

### Slice 01B

- **01B-D1 — migration 042 group delete tombstones** — clause: SPEC-01 §5.5/§9/CHAT-I-030/032 + §13 next-free migration; actual: `042_thread_group_action_recovery.js` adds `thread_group_delete_tombstones` (group-keyed, no group FK, bounded `expires_at`, CHECK-bounded JSON) and updates the 041→042 oracle expectations; 041 untouched. Classification: **accepted**.
- **01B-D2 — group-mutation lease + runtime fence primitive** — clause: SPEC-01 §9/CHAT-I-021; actual: `lib/thread-groups/group-mutation-lease.js` (per-group in-process serialization) and `threadRuntimeManager.fenceResource()` (removes every runtime generation for a resource). Reuses existing runtime owners; no parallel runtime model. Classification: **accepted**.
- **01B-D3 — warm READY provider is fenceable, not `group_busy`** — clause: SPEC-01 §9 busy list; actual: busy = accepting/warming, in-flight turn, finalizing/draining, stopping; a warm-idle READY provider is fenced/retired by Delete. Reason: a READY provider is in no §9 busy state, and treating it as busy would make the currently-open thread undeletable. Both gate levels validated. Classification: **accepted** (residual race documented: prompt accepted between busy scan and fence is drained; post-commit accepts fail fast at FK/activity write).
- **01B-D4 — no optional UEB fact emitted** — clause: SPEC-01 §8.3 optional facts; actual: direct per-window delivery only; commands are not events; nothing gates on facts. Classification: **accepted**.
- **01B-D5 — `getWorkspaceRecipients` per-connection provider** — clause: §8.3 fan-out; actual: `client-message-router.js` supplies workspace/root/epoch-qualified recipients (requester excluded), each send independently failure-isolated. Classification: **accepted** (integration).
- **01B-D6 — raw multi-member session deletion rejected** — clause: §5.6; actual: raw `deleteThread` refuses a member of a multi-member group; single-member raw delete retires its group with no orphan. Classification: **accepted**.
- **01B-D7 — isolated Playwright moved to port 3314/temp profile** — clause: GUIDANCE §6; actual: test-only config/profile change. Classification: **accepted**.
- **01B-D8 — client `thread:renamed`/`thread:deleted` replaced by `thread:action:completed|error`** — clause: §8.2 remove superseded routes; actual: ack-driven rename/delete with requestId and bounded error toasts. Classification: **accepted**.
- Wiki updates to Chat WebSocket Protocol and Thread Actions pages: packet-mandated source-of-truth updates; validated to match implementation. Classification: **accepted**.
- Post-commit action-result write: a crash between the delete commit and the result write converges through tombstone recovery under the same/new request ID (reviewer-validated; no material finding).

### Slice 01C

- **01C-D1 — versioned application link URI** — clause: §8.2/§9 "versioned application URI", CHAT-I-029; actual: `lib/thread-groups/application-link.js` (`fusion-thread-group:v1?…`), unknown versions/keys (including `surfaceId`), duplicates, and malformed/oversized values rejected. Classification: **accepted**; downstream: SPEC-04 keeps version 1 and durable-identity-only shape.
- **01C-D2 — `copy_link` always carries the validated sole/current member** — clause: §8.2; actual: one-member SPEC emits the authoritative current primary; a supplied non-current member returns `not_found`. Classification: **accepted**; downstream: SPEC-04 adds group-only/non-primary production without placement authority.
- **01C-D3 — `set_harness_selection` requires the server model catalog** — clause: §8.2/CHAT-I-031; actual: `resolveCliPolicy` model/variant validation; missing catalog/unknown model/unknown variant → `invalid_selection`; policy read failure → `selection_unavailable`; prior value untouched. Classification: **accepted**.
- **01C-D4 — prompt activity fail-closed on the group owner** — clause: §5.4/§7; actual: `turnId` minted before `message:sent`; `recordPromptAccepted` failure rejects through the existing acceptance-failure path and releases the reserved runtime. Classification: **accepted**.
- **01C-D5 — `resolve_link` opens Main Chat via the canonical open path; no client entry point** — clause: §8.2/§9; actual: committed invocation calls `handleThreadOpen`; no URL-scheme handler/UI added. Classification: **accepted / downstream_impact**.
- **01C-D6 — `thread:action` handler recognizes the 01C durable actions** — clause: §8.2; actual: `DURABLE_THREAD_ACTIONS` adds `copy_link`/`resolve_link`/`view_markdown`/`set_harness_selection`; completed frames echo link/resolved/markdownPath/harnessId/model/variant; `compact` unchanged. Classification: **accepted**.
- **01C-D7 — client ack side-effects requester-only** — clause: §8.3 fan-out; actual: clipboard/File Viewer side effects apply only to non-`fanOut` acknowledgements; repaired in builder self-review. Classification: **repair_required → resolved**.
- **01C-D8 — strictly monotonic group clock** — clause: §5.4 "monotonically advance"; actual: `recordActivityAndAdvance` writes `max(occurredAt, updated_at+1)`. Classification: **accepted**.
- **01C-D9 — isolated Playwright port/profile (3315 / 01c profile)** — clause: GUIDANCE §6. Classification: **accepted** (test-only).
- **01C-D10 — dead `thread-link-intent.ts` removed** — clause: §8.2/§11 no aliases. Classification: **accepted**.
- **01C-D11 — routed Chat wiki updates + smoke export list** — clause: packet docs requirement; six pages updated. Classification: **accepted**.
- **01C-D12 — implementation report artifact** — workflow artifact; excluded from the product fingerprint.

### Slice 01C acceptance record

- Accepted current revision: SPEC-01 product manifest `/tmp/chat01/01c/manifest-product.txt`, SHA-256 `2a4ba090c7d82dc9411057a3495f23b7c10201db3bddf0beb0014b633bae2ce0` (61 paths; 6 deletions).
- Independent checks on accepted bytes: `npx jest --runInBand` 203 suites / 2975 passed / 1 skipped; client build passed; isolated thread-group Playwright 7 passed (port 3315); accepted Provenance source suite 65 passed; `AGENT_TOOL_LIVE_PROVENANCE_OK` and `FILE_VIEWER_LIVE_PROVENANCE_OK` passed on dynamic non-3001 ports.
- Builder-owned gate CLEAN after 01C-D7; whole-SPEC final integration reviewer `ses_f64cdec9dffeuKRZbwlvfKEWGV` CLEAN with no material finding; no missed deviations; advisories recorded in the report.

### Slice 01B acceptance record

- Accepted current revision: manifest `/tmp/chat01/01b/manifest.txt`, SHA-256 `3891410d794d0bd989dbba92079f3e783ce6112e0ee8772f73766e04a39a0b74` (49 paths + 5 deletions).
- Independent checks on accepted bytes: `npx jest --runInBand` 201 suites / 2952 passed / 1 skipped; client build passed; isolated Playwright 6 passed on port 3314.
- Fresh orchestrator reviewer `ses_f64fdd538ffebDvBRTvj3NcCfB` returned CLEAN; all 01B-D1…D8 validated; advisories recorded (check-then-fence race bounded; threadId-only tombstone lookup by design; tombstone GC not required; duplicated TTL constant; `deleteThreadSession` retained library owner).

### Slice 01A acceptance record

- Accepted current revision: manifest `/tmp/chat01/01a/manifest-r2.txt`, SHA-256 `2d95589df207eecb41abf6469844e9f2f8ec2c2c820706025a66130904119164` (34 paths; plus the 5 recorded deletions).
- Independent checks on accepted bytes: `npx jest --runInBand` 200 suites / 2932 passed / 1 skipped; `npm run build` passed; isolated Playwright 4 passed on port 3313.
- Orchestrator-ordered repairs before acceptance: R1 invalid-present stop (material), R2 explicit Legacy `viewId:null`, R3 unwritable-capsule proof, R4 redundant `init()` removal, R5 ledger/flow-style corrections.

## Lifecycle Log

- 2026-09-13 — Preflight complete: owner approval verified; prerequisites in ancestry; baseline `1ded59c`; migration head `040`; dirty paths enumerated and preserved. Ledger opened. Slice 01A builder `ses_f6594fb8bffe8G3LyhEtbRsINX` dispatched.
- 2026-09-13 — 01A builder handoff (manifest `536ba1d6…`); orchestrator inspection found material R1 (invalid-present view-ID replacement) + R2–R5; repair routed to the same builder; repaired bytes independently rerun green (200 suites / 2932 passed; build; Playwright 4/4) and reviewed CLEAN by fresh `ses_f6531db55ffenexjJTwJ3hwyFD`. Fresh orchestrator acceptance reviewer `ses_f65297bbbffeelJKZeO8Kk1pWd` returned CLEAN on manifest `2d95589d…`. **Slice 01A accepted.** Slice 01B builder dispatched.
- 2026-09-13 — 01B builder handoff (manifest `3891410d…`, `thread:action` rename/delete, migration 042 tombstones, leases/fences, fan-out). Orchestrator inspection passed without repairs; independent reruns green (201 suites / 2952 passed; build; Playwright 6/6); fresh orchestrator reviewer `ses_f64fdd538ffebDvBRTvj3NcCfB` returned CLEAN with all deviations validated. **Slice 01B accepted.** Slice 01C builder dispatched.
- 2026-09-13 — 01C builder handoff (prompt activity/MRU, `thread:touch` removal, link/model/search actions, integration report draft; 01C-D7 self-repair). Orchestrator inspection passed; independent reruns green (203 suites / 2975 passed; build; thread-group Playwright 7/7; PROV source 65/65; both live PROV launchers OK). Fresh whole-SPEC integration reviewer `ses_f64cdec9dffeuKRZbwlvfKEWGV` returned **CLEAN** with no material finding, no missed deviations, and an impact assessment of `none` for SPEC-02 (recorded plan) and `compatible deviation` for SPEC-04 (link versioning, current-primary member, pre-admitted CHECK vocabularies, reusable lease/fence). **Slice 01C accepted; final integration complete.**
- 2026-09-13 — Report finalized: `SPEC-01-IMPLEMENTATION-REPORT.md` set to `READY_FOR_INDEPENDENT_OWNER-SIDE_REVIEW` (not owner-accepted). No product, test, migration, or documentation byte changed during finalization except the report itself. HEAD remains `1ded59c`; no commit/amend/push.

## Final Identity (post-finalization)

- Baseline: `1ded59ce2e0947d6209d0c23e82fe273591e28b2` · Migration head: `042_thread_group_action_recovery.js` (dispatch head `040`).
- SPEC-01 product fingerprint (61 paths, excludes the report, ledger, and unrelated paths): `2a4ba090c7d82dc9411057a3495f23b7c10201db3bddf0beb0014b633bae2ce0` (`/tmp/chat01/01c/manifest-product.txt`; 61/61 re-verified).
- Union path list: `/tmp/chat01/01c/spec-union-paths.txt` SHA-256 `b178762b05adcefb00d25cf978827f22963776607ea6c95621fc7153f35ea313`.
- Full changed-set manifest (61 product paths + finalized report): `/tmp/chat01/01c/manifest-final.txt` SHA-256 `ea279fff908e4da8c278952e7e47573b869faefe00e381fba54074b8e4f41edc` (62 paths).
- Finalized report SHA-256: `bdc4a73f5d572f271f9db120372ba5ff16de17c43309dbd7f3bbffe8b19d7cdc`.
- Deletions (6): `useComposerForkAction.ts`, `thread-link-intent.ts`, `thread-fork-service.js`, `compat-pending-fork-smoke.test.js`, `thread-fork-service.test.js`, `thread-fork-handler.test.js`.
- Unrelated bytes preserved: `M ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json`, `?? ai/RC-MacAir-15/Captures/031-Remote_Access/`.
- **Status: READY FOR INDEPENDENT OWNER-SIDE REVIEW. Not owner-accepted; SPEC-02 remains blocked pending explicit owner acceptance.**
