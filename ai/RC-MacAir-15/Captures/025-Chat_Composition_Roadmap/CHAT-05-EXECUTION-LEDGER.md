# CHAT-05 (SPEC-05) — Post-Roadmap Advisory Repairs Execution Ledger

**Bundle:** `025-Chat_Composition_Roadmap` · **Candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (`ROADMAP COMPLETE` 2026-09-15)
**SPEC:** `SPEC-05-ADVISORY-REPAIRS.md` (`APPROVED`; owner-authorized for execution 2026-09-15)
**Baseline commit (dispatch):** `5073b1056fce4872751ab60de0b030560929b823` (commit `5073b10 feat: composable chat surfaces (CHAT-02/SPEC-02)`) plus the owner-accepted, still-uncommitted SPEC-03 (71 paths) and SPEC-04 (79 paths + 6 deletions) bytes
**Baseline branch:** `agent/exact-workspace-paths`
**Migration head at dispatch and completion:** `044_thread_group_placement_outbox.js` (001–043 frozen; **no new migration**; no schema change)
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Gates:** SPEC-05 §4/§5/§6/§7 slice proofs, §8 whole-SPEC matrix, §9 final integration
**Hard constraints:** never commit/amend/push; preserve unrelated worktree bytes; isolated ports/profiles only (never port 3001, `fusion-studio-server/data/fusion.db`, or the Alpha profile); no user-visible behavior change; no schema/migration; `service.js` extractions mechanical only; no edits to accepted external contracts (Generic Host, Provenance, Bridge).

## Prerequisite Record (verified at dispatch)

- SPEC-00 through SPEC-04 owner-accepted; roadmap final integration declared `ROADMAP_COMPLETE` 2026-09-15 (`RELEASE-MANIFEST.md` §7). Owner direction 2026-09-15: generate this repair SPEC and roll the fixes into the same uncommitted update before its first commit/push. This SPEC blocks that first commit/push.
- Advisories closed by this SPEC (RELEASE-MANIFEST §7): (1) CHAT-03 worksurface Electron smoke deterministic cold-start settle; (2) manifest documentation-scope convention pin; (3) carried advisories — `service.js` 857-line residual split plan (04D-D4), capability lockstep by convention, inert `useChatArea` forbidden-import token.
- Explicit non-goals (remain carries): portal-menu adoption (04D-D6), the pre-existing 02A-D7 baseline-red set, Move-menu reachability in adapterless views (04B-D5 boundary), the member-link renderer sender boundary (pre-existing since 01C), and any new product behavior.
- Focused public-route coverage for the extracted families pre-existed and was verified before editing: `test/thread/thread-group-delete-recovery.test.js`, `test/ws/thread-group-protocol.integration.test.js`, `test/ws/thread-group-member-access.integration.test.js`, `test/thread/thread-group-lifecycle.test.js` (4 suites / 57 tests).

## Pre-existing unrelated worktree bytes (preserved; never touched)

- `M ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json` and `M …/002-file-viewer/state/state.json` (owner live view-state drift)
- `M ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/RELEASE-MANIFEST.md` (owner acceptance record; pre-dates SPEC-05 execution — mtime 01:28 vs SPEC-05 authorization 01:51)
- Concurrent `009-Office-Editor-Temp` SPEC-00 chain bytes (`e2e/office/fixture-lifecycle.mjs`, `fixture-lifecycle.test.mjs`, `playwright.office.config.ts`, `ISSUES.md`, `ROADMAP-LEDGER.md`, `SPEC-00-OFFICE-EDITOR-TEST-HARNESS.md`)
- `?? ai/RC-MacAir-15/Captures/031-Remote_Access/` (separate concurrent worker artifact)
- Accepted SPEC-03/SPEC-04 product and evidence bytes (the worktree itself is the accepted baseline)
- Unrelated client/theme/other-spec modifications visible in `git status --porcelain` (145 entries at completion; SPEC-05's own footprint is exactly the 7 paths below + this ledger + the implementation report)

## Slice ledger

| Slice | Scope | Builder | Builder-owned gate | Orchestrator acceptance | Accepted revision | State |
|---|---|---|---|---|---|---|
| 05A | Worksurface smoke durability (test-only cold-start settle back-port) | `ses_f5bbb21b8ffeGtKqE1y2uM4WS2` | pass 1 `ses_f5bb8f24affeoMqc0SxKkfuH5Y` **CLEAN** (1 advisory: time-based settle; SPEC-sanctioned) | `ses_f5bb5d615ffe0vXZwhGGQUyO77` **CLEAN_WITH_ADVISORIES** | `thread-worksurface-electron-smoke.mjs` sha256 `27886f57e270429b55b6f28b389048926f12ea6dbcc48b6e51c4102add21e9c1` | **accepted** |
| 05B | `service.js` completion split (04D-D4) | `ses_f5bb3edbdffe3pEAoCmQR3Mayi` | pass 1 `ses_f5ba9090affeQvK4BTcclMBNB9` **CLEAN** (2 advisories: D2 `= {}` default; comment note) | `ses_f5ba5a1b8ffe1LxhAD7DK3K0bA` **CLEAN_WITH_ADVISORIES** | `service.js` `3b1ea999…`; `link-service.js` `cf622eff…`; `selection-service.js` `14eb23a5…`; `delete-service.js` `3854f65e…` | **accepted** |
| 05C | Capability lockstep enforcement test | `ses_f5ba1aab0fferlIxG5HBNwOWLC` | pass 1 **CLEAN** (fresh `spec-gate-reviewer`; session id not captured in handoff — recorded as reported) | `ses_f5b9a1b42ffeGyL41qJbtzrSxX` **CLEAN** | `test/thread/thread-group-chat-capable-view-lockstep.test.js` sha256 `003348248063f5e60a11dc207ea76616edf30fd2b80476ad0e0703fbcd9b440c` | **accepted** |
| 05D | Hygiene sweep (test-only + record) | `ses_f5b96ccffffe4A6d2Ck9xYPkqT` | pass 1 `ses_f5b947df3ffeDdERq2bfOr13FB` **CLEAN** (1 future-proofing advisory) | `ses_f5b917e09ffe42xwXHf1tBPxWy` **CLEAN** | `e2e/chat-surface-identity.spec.ts` sha256 `71e448e6c99879509928145f00cea921c7e062494e05c329ff1a50ab51788e26` | **accepted** |

Every slice used a fresh `spec-slice-builder`; every builder-owned gate used a fresh read-only `spec-gate-reviewer` that stopped at the first materially clean pass on current bytes. The orchestrator independently inspected bytes and reran checks at every level (see per-slice evidence below), then used a separate fresh read-only `spec-gate-reviewer` for acceptance per slice, and one more for final integration.

## Per-slice orchestrator evidence (independent)

- **05A.** Change read at bytes: `selectCaptureView()` → comment (verbatim SPEC-04 wording) → `await page.waitForTimeout(1500);` → first `.rv-new-chat-btn` click (lines 321–325). `side-chat-electron-smoke.mjs` untouched (mtime Sep 14 23:02; sha `b5cd00ba…`). Orchestrator ran the smoke 7 times on frozen bytes: batch A pass/pass/**fail** at `createProject`/`waitForWorkspaceTitle` under load 8.50 (different stage than the fixed post-reload race; see advisory 05A-A1), batch B 3/3 green; builder 3/3 green + pre-fix deterministic repro; builder-gate reviewer 1 green; acceptance reviewer 2/2 green. SPEC §4 proof satisfied.
- **05B.** Line counts: `service.js` 857 → 391 (≤400 checklist); `link-service.js` 245; `selection-service.js` 100; `delete-service.js` 251. Export probe: exactly `{DELETE_TOMBSTONE_TTL_MS, ThreadGroupService, createThreadGroupService}`, TTL `604800000`. Orchestrator mechanical verification vs `git show 5073b10:…/service.js`: `viewMarkdown` and `setHarnessSelection` bodies byte-identical after `this.` → `service.` normalization; `copyLink`/`resolveLink` diffs are exactly the accepted SPEC-03/04 additions (non-primary member links; placement materialization); `deleteGroup` diffs only at the 3 sibling-call adaptation lines; `_recoverDeletedGroupWithinLease`/`_refreshTombstoneAggregate` differences are the documented SPEC-03/04 blocks; `_worksurfaceCleanupState` is a genuine SPEC-03/04 addition (absent at HEAD). Focused suites independently rerun by orchestrator: 4 suites / 57 passed. Acceptance reviewer independently reran the full server suite (209 → **210 suites / 3042 passed / 1 skipped / 0 failures** after 05C) and the mechanical characterization.
- **05C.** Orchestrator induced client drift (`+ 'drift-viewer'`) via an atomic scripted experiment with guaranteed restore: test **failed** with `symmetric difference (1): [drift-viewer]`; restore byte-exact (`75c75967…` before/after). Targeted test green on current bytes. Acceptance reviewer independently reproduced both-side drift failure, rename/empty-parse loud failures, no-runtime-coupling, and the full suite counts.
- **05D.** `git diff` is exactly one deletion (`-    'useChatArea',`; blob `4dc2f5d..853bb5c`). Inertness verified: no `ChatSurface.tsx` import specifier contains the token; the module `src/components/chat/useChatArea.ts` is deleted (pre-existing SPEC-04 byte). Orchestrator independently reran the full chat-surface lane: **191 passed** (count unchanged).

## Deviations (all classified; full records)

- **05B-D1 — Condensed stale module-header docblock in `service.js`.** *Clause:* SPEC §3/§5 mechanical-only; ≤400 lines. *Actual:* 18-line 01B/01C header summary replaced by a 10-line summary pointing to the three new modules. *Reason:* the described operations no longer live there; removed stale duplication. *Effect:* comment-only. *Risk:* none. *Classification:* **accepted**.
- **05B-D2 — Inert `= {}` default on the moved `deleteGroup(service, { … } = {})` function.** *Clause:* SPEC §3 bodies move verbatim; only receiver/imports adapt. *Actual:* added parameter default matching the sibling pattern (`move-service.js:92`, `member-service.js:142`). *Reason:* pattern conformance; the only caller always passes an object, so behavior-identical (a no-arg direct call would previously throw and now yields `not_found`; no such call exists — grep-verified by two independent reviewers). *Tests:* focused 57 + full suite. *Effect:* none. *Risk:* none. *Classification:* **accepted**.
- **05B-D3 — `DELETE_TOMBSTONE_TTL_MS` ownership moved to `delete-service.js`, re-exported by `service.js`.** *Clause:* SPEC §3 export shape unchanged; choose non-circular mechanism. *Actual:* constant defined in `delete-service.js` (consumed by `deleteGroup`) and bound in `service.js` (`const { DELETE_TOMBSTONE_TTL_MS } = deleteService;`) then exported under the same name/value. *Reason:* avoids a require cycle (`delete-service` never requires `service`). *Effect:* export identical (`604800000`). *Risk:* none. *Classification:* **accepted**.
- **05C-D1 — Server suite count 209 → 210 (new standalone lockstep test file).** *Clause:* SPEC §6 "add one test"; SPEC §8 baseline "equal or greater passes". *Actual:* new file `test/thread/thread-group-chat-capable-view-lockstep.test.js`; counts become 210 suites / 3042 passed / 1 skipped. *Reason:* independently discoverable guard; no lane-command or config change. *Effect:* +1 suite / +1 test, no runtime behavior. *Risk:* negligible. *Classification:* **accepted**.
- **05A-A1 (advisory, carried) — Load-stage flake observed once by the orchestrator** at `createProject`/`waitForWorkspaceTitle` (pre-reload workspace creation) under system load 8.50 with an unrelated resident Electron acceptance session. Different stage than the SPEC §4 targeted race; recovered; 8+ consecutive documented passes on the fixed bytes. *Classification:* **advisory** (residual: the launch/create scaffolding retains a pre-existing 30s load sensitivity shared with the SPEC-04 smoke; candidate future test-only hardening).
- **05D-A1 (advisory, accepted) — Removing the `useChatArea` sentinel drops a future-proofing token** (if the deleted module were ever re-created and imported via a specifier matching no other token, this guard would not flag it). No live assertion weakened today (the token could never fire); SPEC §7 explicitly directs the removal. *Classification:* **accepted**.
- **Recorded side effect (not a candidate byte):** Playwright lane runs rebuilt the gitignored `fusion-studio-client/dist/`.

No other deviations; no out-of-scope product touches; no owner ruling was required at any point.

## Whole-SPEC final integration (2026-09-15, frozen integrated bytes)

All commands run on the frozen SPEC-05 bytes; chats composite results below were freshly captured by the orchestrator and independently spot-verified by the final-integration reviewer.

| Command | Result |
|---|---|
| `cd fusion-studio-server && npx jest --runInBand` | **210 suites passed; 3042 passed, 1 skipped, 3043 total** (149s; baseline §8: 209/3038/1 equal-or-greater; zero failures) |
| `cd fusion-studio-client && npm run build` | green (8.55s; only the pre-existing >500 kB chunk warning) |
| `npx playwright test e2e/move-chat-to-side-chat.spec.ts e2e/side-chat-placement-recovery.spec.ts e2e/side-chat-isolation.spec.ts e2e/side-chat-adapterless-native.spec.ts --config=playwright.chat03.config.ts` | **20 passed** (25.6s) |
| `npx playwright test e2e/thread-worksurface-switching.spec.ts e2e/thread-worksurface-conflict.spec.ts e2e/thread-worksurface-restart.spec.ts e2e/thread-worksurface-builtins.spec.ts --config=playwright.chat03.config.ts` | **46 passed** (37.2s) |
| `npx playwright test e2e/chat-surface-identity.spec.ts e2e/chat-surface-isolation.spec.ts e2e/threaded-chat-host.spec.ts e2e/chat-component-registration.spec.ts 'component-tab-' 'component-action-context-source' --config=playwright.chat-surface.config.ts` | **191 passed** (54.0s) |
| `npx playwright test e2e/thread-group-compatibility.spec.ts --config=playwright.thread-group.config.ts` | **7 passed** (4.6s) |
| `npx playwright test --config=playwright.source.config.ts` | **65 passed** (2.2s) |
| `node e2e/side-chat-electron-smoke.mjs` | all nine markers incl. `CHAT_04D_SECONDARY_ABSENT=true` |
| `node e2e/thread-worksurface-electron-smoke.mjs` ×3 consecutive | 3/3 exit 0 with `CHAT_03_THREAD_WORKSURFACE_SMOKE_OK` + `GROUPS=2` + `DELETE_ISOLATED=true` + `RELAUNCH_RESTORED=true` |

**Final-integration review:** fresh read-only `spec-gate-reviewer` `ses_f5b8aab6dffejMdDX7LGq4MjyF` returned **CLEAN_WITH_ADVISORIES** (no material findings; hashes, DoD mapping, footprint, cycles, dispatch, migration head, and drift demonstration independently verified) with **downstream impact: `none`**. Its advisory A1 (write this report + ledger with the §7 convention and deviation records) is discharged by this document and `SPEC-05-IMPLEMENTATION-REPORT.md`.

## SPEC-05 product fingerprint (all changed paths)

| Path | sha256 |
|---|---|
| `fusion-studio-client/e2e/thread-worksurface-electron-smoke.mjs` | `27886f57e270429b55b6f28b389048926f12ea6dbcc48b6e51c4102add21e9c1` |
| `fusion-studio-server/lib/thread-groups/service.js` | `3b1ea999e4431ec0f3a52d90573588f5ea666fe6fb5fdc14ad13119a3f9a927a` |
| `fusion-studio-server/lib/thread-groups/link-service.js` (new) | `cf622effb98978feba19467404f912754d96cc77d9790f7f3c7718e6982e0bc4` |
| `fusion-studio-server/lib/thread-groups/selection-service.js` (new) | `14eb23a52b50dc3c65663a12bf00c3c01d6f491db662ebed3e5129b23da41dfd` |
| `fusion-studio-server/lib/thread-groups/delete-service.js` (new) | `3854f65e5068f789b4e41440a4360161d249ea63bdd66cff5fd7731b9fb3b6af` |
| `fusion-studio-server/test/thread/thread-group-chat-capable-view-lockstep.test.js` (new) | `003348248063f5e60a11dc207ea76616edf30fd2b80476ad0e0703fbcd9b440c` |
| `fusion-studio-client/e2e/chat-surface-identity.spec.ts` | `71e448e6c99879509928145f00cea921c7e062494e05c329ff1a50ab51788e26` |

Unchanged anchors: `side-chat-electron-smoke.mjs` `b5cd00ba…`; server capability set `5d93d88880f5af481eb848795eb6a956654ab92ca524a8542ad2d4c0fdedd7f1`; client capability set `75c759674fb42e5b1878c580d4bc3e8ae4fd3b3c28e7a844c5260fcac3db52b2`.

HEAD remains `5073b1056fce4872751ab60de0b030560929b823`; nothing staged; no commit/amend/push performed. The worktree remains uncommitted and is ready for the owner's commit/push decision.

## Recorded convention (SPEC §7)

**Whole-SPEC product manifests include product bytes only; routed Wiki/doc updates are tracked in the owning report's documentation list.**

Basis: SPEC-03's product manifest included 3 Wiki `PAGE.md` entries; SPEC-04's included 0, listing its Wiki updates under its report's documentation list. The SPEC-04 convention is adopted as standing. SPEC-05 routed no Wiki/doc updates; its documentation artifacts are this ledger and `SPEC-05-IMPLEMENTATION-REPORT.md` (tracked outside the product manifest).
