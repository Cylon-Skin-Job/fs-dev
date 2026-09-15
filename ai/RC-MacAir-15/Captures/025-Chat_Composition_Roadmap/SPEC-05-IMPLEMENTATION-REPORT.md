# SPEC-05 Implementation Report — Post-Roadmap Advisory Repairs

**Status:** `READY_FOR_INDEPENDENT_OWNER-SIDE_REVIEW` — all slice gates and whole-SPEC final integration clean; **not owner-accepted** (owner acceptance pending)
**Approved candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (`ROADMAP COMPLETE` 2026-09-15)
**SPEC:** `SPEC-05-ADVISORY-REPAIRS.md` (`APPROVED`; owner-authorized for execution 2026-09-15)
**Implementation baseline (dispatch):** `5073b1056fce4872751ab60de0b030560929b823` plus the owner-accepted, still-uncommitted SPEC-03 (71 paths) and SPEC-04 (79 paths + 6 deletions) bytes
**Baseline branch:** `agent/exact-workspace-paths`
**Migration head at completion:** `044_thread_group_placement_outbox.js` (001–043 frozen; **no new migration**, no schema change)
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)
**Execution ledger:** `CHAT-05-EXECUTION-LEDGER.md` (slice gates, deviations, lifecycle, raw evidence)

## Accepted prerequisites and authority

- Owner-accepted SPEC-00 through SPEC-04; roadmap final integration `ROADMAP_COMPLETE` 2026-09-15 (`RELEASE-MANIFEST.md` §7). Owner direction 2026-09-15 to generate this repair SPEC and roll the fixes into the same uncommitted update before its first commit/push; this SPEC blocks that commit/push.
- Carried advisories closed: (1) CHAT-03 worksurface Electron smoke cold-start settle; (2) manifest documentation-scope convention; (3) `service.js` 857-line residual split plan (04D-D4), capability lockstep by convention, inert `useChatArea` token.
- Hard constraints honored: no user-visible behavior change; no schema/migration/transport; mechanical-only extractions; no accepted external contract edits; never commit/amend/push; unrelated worktree bytes preserved; isolated ports/profiles only.
- Every slice used a fresh `spec-slice-builder`; every builder-owned gate used a fresh read-only `spec-gate-reviewer` stopping at the first materially clean pass; every slice passed a separate orchestrator-owned acceptance review on current bytes.

## Slice ledger

| Slice | Scope | Accepted revision | State |
|---|---|---|---|
| 05A | Worksurface smoke durability (test-only) | smoke sha256 `27886f57…` | **accepted** |
| 05B | `service.js` completion split (04D-D4) | service `3b1ea999…`, link `cf622eff…`, selection `14eb23a5…`, delete `3854f65e…` | **accepted** |
| 05C | Capability lockstep enforcement test | lockstep test sha256 `00334824…` | **accepted** |
| 05D | Hygiene sweep (test-only + record) | spec sha256 `71e448e6…` | **accepted** |

## Delivered outcome (no user-visible behavior change)

1. **Worksurface smoke determinism (05A).** `e2e/thread-worksurface-electron-smoke.mjs` back-ports the exact SPEC-04 cold-start settle (comment + `waitForTimeout(1500)` between the dock mount and the first create intent, lines 321–325), mirroring `side-chat-electron-smoke.mjs:286-288`. The SPEC-04 smoke is untouched. Pre-fix the smoke failed deterministically (`server never recorded 1 thread groups`); post-fix it is green across every run by builder, reviewers, and orchestrator, including the required three consecutive runs.
2. **`service.js` completion split (05B).** `lib/thread-groups/service.js` 857 → **391 lines** (≤400 checklist) with three new focused modules following the accepted `move-service.js`/`member-service.js` pattern (owning `ThreadGroupService` instance as first argument): `link-service.js` (245; `copyLink`, `resolveLink`, `viewMarkdown`), `selection-service.js` (100; `setHarnessSelection`), `delete-service.js` (251; `deleteGroup`, `_recoverDeletedGroupWithinLease` → `recoverDeletedGroupWithinLease`, `_refreshTombstoneAggregate` → `refreshTombstoneAggregate`, `_worksurfaceCleanupState` → `worksurfaceCleanupState`). Bodies moved verbatim (receiver/imports only); `performAction`, exports (`DELETE_TOMBSTONE_TTL_MS`, `ThreadGroupService`, `createThreadGroupService`), the group mutation lease/transaction semantics, tombstone/recovery semantics, and correlated result shapes are unchanged. No cycles (`delete-service` never requires `service`; the TTL is defined there and re-exported). `service.js` is at 391 lines: the 400-line checklist is satisfied with no residual carry.
3. **Capability lockstep enforcement (05C).** New `test/thread/thread-group-chat-capable-view-lockstep.test.js` asserts exact set equality between the server `CHAT_CAPABLE_VIEW_IDS` and the client `SIDE_CHAT_CAPABLE_VIEW_IDS` by reading the client TS as text (no runtime coupling, no new tooling). It fails loudly on induced one-side drift (independently demonstrated by builder, builder-reviewer, and orchestrator with byte-exact reverts, plus rename/empty-parse cases) and passes on current bytes. The guard runs inside the existing documented server Jest lane.
4. **Hygiene (05D).** The inert `'useChatArea'` forbidden-import token is removed from `e2e/chat-surface-identity.spec.ts` (exact one-line deletion; no live assertion weakened — no import specifier could ever match it, and the module is deleted per SPEC-04). The remaining 12 tokens and all surrounding structure are intact.

## Required verification results (frozen integrated bytes)

| Command | Result |
|---|---|
| `cd fusion-studio-server && npx jest --runInBand` | **210 suites passed; 3042 passed, 1 skipped, 3043 total** (zero failures; §8 baseline 209/3038/1 equal-or-greater) |
| `cd fusion-studio-client && npm run build` | passed (only the pre-existing >500 kB chunk warning) |
| chat03 lane A (`move-chat-to-side-chat`, `side-chat-placement-recovery`, `side-chat-isolation`, `side-chat-adapterless-native`; port 3317) | **20 passed** |
| chat03 lane B (`thread-worksurface-switching`, `-conflict`, `-restart`, `-builtins`; port 3317) | **46 passed** |
| chat-surface lane (identity, isolation, threaded host, component registration, `component-tab-`, `component-action-context-source`; port 3316) | **191 passed** |
| thread-group lane (`thread-group-compatibility`; port 3315) | **7 passed** |
| source lane (`playwright.source.config.ts`) | **65 passed** |
| `node e2e/side-chat-electron-smoke.mjs` | all nine markers incl. `CHAT_04D_SECONDARY_ABSENT=true` |
| `node e2e/thread-worksurface-electron-smoke.mjs` (three consecutive runs) | 3/3 `CHAT_03_THREAD_WORKSURFACE_SMOKE_OK` with all four markers |

Focused public-route coverage for the extracted families: `thread-group-delete-recovery` (delete/recovery incl. new-request-ID tombstone recovery), `thread-group-protocol.integration` (`copy_link`/`resolve_link`/`view_markdown`/`set_harness_selection`), `thread-group-member-access.integration` (exact-member resolution incl. non-primary links), `thread-group-lifecycle` — 4 suites / 57 passed, unchanged before/after the split. No test was weakened, skipped, or deleted.

**Final-integration review:** fresh read-only `spec-gate-reviewer` `ses_f5b8aab6dffejMdDX7LGq4MjyF` returned **CLEAN_WITH_ADVISORIES** — no material findings; hashes, DoD mapping, cross-slice contracts (no cycles, unchanged `performAction`/exports/helpers, sole `ThreadManager` consumer), footprint (exactly the 7 SPEC-05 paths amid 145 pre-existing worktree entries), migration head, and an independent lockstep drift demonstration all verified. Downstream impact assessment: **`none`**.

## Deviation ledger (summary)

Full records with clause/actual/reason/files/tests/effect/risk/downstream/classification live in `CHAT-05-EXECUTION-LEDGER.md`. All classified; none needed an owner ruling.

- **05B-D1** condensed stale `service.js` module header (comment-only) — **accepted**.
- **05B-D2** inert `= {}` default on moved `deleteGroup(service, {…} = {})` (sibling-pattern conformance; behavior-identical; no caller affected) — **accepted**.
- **05B-D3** `DELETE_TOMBSTONE_TTL_MS` defined in `delete-service.js` and re-exported by `service.js` (avoids require cycle; export name/value identical) — **accepted**.
- **05C-D1** server suite count 209 → 210 from the new standalone test file (SPEC §8 allows equal-or-greater) — **accepted**.
- **05A-A1 (advisory)** one orchestrator-observed flake at `createProject`/`waitForWorkspaceTitle` (pre-reload workspace-creation stage; different from the fixed race; under load 8.50; recovered; ≥8 consecutive passes on fixed bytes) — **advisory carry**; candidate future test-only load hardening.
- **05D-A1 (accepted advisory)** removal drops a future-proofing sentinel token per SPEC §7's own directive; no live assertion weakened — **accepted**.

## Convention recorded (SPEC §7)

**Whole-SPEC product manifests include product bytes only; routed Wiki/doc updates are tracked in the owning report's documentation list.**

Basis: SPEC-03's product manifest included 3 Wiki `PAGE.md` entries; SPEC-04's included 0 and listed Wiki updates under its report's documentation list. The SPEC-04 convention is adopted as standing. SPEC-05 routed no Wiki updates.

## Documentation updated

- `CHAT-05-EXECUTION-LEDGER.md` — slice gates, per-slice orchestrator evidence, deviations, final matrix, fingerprints, recorded convention.
- `SPEC-05-IMPLEMENTATION-REPORT.md` — this report.
- No accepted packet artifact (`ROADMAP.md`, `DECISIONS.md`, `ISSUES.md`, `GUIDANCE.md`, `RELEASE-MANIFEST.md`, `SPEC-00`–`SPEC-04`, `CHAT-0x` ledgers) was edited. No Wiki `PAGE.md` update was routed by this SPEC.

## File fingerprint

| Path | sha256 |
|---|---|
| `fusion-studio-client/e2e/thread-worksurface-electron-smoke.mjs` | `27886f57e270429b55b6f28b389048926f12ea6dbcc48b6e51c4102add21e9c1` |
| `fusion-studio-server/lib/thread-groups/service.js` | `3b1ea999e4431ec0f3a52d90573588f5ea666fe6fb5fdc14ad13119a3f9a927a` |
| `fusion-studio-server/lib/thread-groups/link-service.js` (new) | `cf622effb98978feba19467404f912754d96cc77d9790f7f3c7718e6982e0bc4` |
| `fusion-studio-server/lib/thread-groups/selection-service.js` (new) | `14eb23a52b50dc3c65663a12bf00c3c01d6f491db662ebed3e5129b23da41dfd` |
| `fusion-studio-server/lib/thread-groups/delete-service.js` (new) | `3854f65e5068f789b4e41440a4360161d249ea63bdd66cff5fd7731b9fb3b6af` |
| `fusion-studio-server/test/thread/thread-group-chat-capable-view-lockstep.test.js` (new) | `003348248063f5e60a11dc207ea76616edf30fd2b80476ad0e0703fbcd9b440c` |
| `fusion-studio-client/e2e/chat-surface-identity.spec.ts` | `71e448e6c99879509928145f00cea921c7e062494e05c329ff1a50ab51788e26` |

## Residual risks and carries

- **05A-A1** load-stage flake sensitivity in the shared launch/create scaffolding (pre-existing; outside SPEC-05's targeted race).
- **05D-A1** removed sentinel token (SPEC-directed; future-proofing only).
- Carried non-goals unchanged: portal-menu adoption (04D-D6), 02A-D7 baseline-red set, Move-menu reachability in adapterless views (04B-D5), member-link renderer sender boundary (pre-existing since 01C).
- Playwright runs rebuilt the gitignored `fusion-studio-client/dist/` only; no candidate byte is affected.

## Commit state

HEAD remains `5073b1056fce4872751ab60de0b030560929b823`; nothing staged; no commit/amend/push performed. The worktree remains uncommitted and is ready for the owner's commit/push decision. **Owner acceptance is required before that decision.**
