# SPEC-05 — Post-Roadmap Advisory Repairs

**Status:** `APPROVED` — owner-authorized for execution 2026-09-15 (“Hand me the file path, and I'll run it in another session.”)
**Domain owner:** carried advisory repairs from the completed Chat Composition roadmap
**Prerequisites:** owner-accepted SPEC-00 through SPEC-04 (roadmap `CHAT-COMPOSITION-2d34f8b45562f8f3`, `ROADMAP COMPLETE` 2026-09-15); owner direction 2026-09-15 to generate this repair SPEC and roll the fixes into the same uncommitted update before its first commit/push
**Blocks:** the first commit/push of the accepted SPEC-03/SPEC-04 worktree bytes
**Does not reopen:** the accepted roadmap candidate. This SPEC adds no user-visible behavior, no schema, no migration, and no transport. It changes no accepted normative packet artifact (`ROADMAP.md`, `DECISIONS.md`, `ISSUES.md`, `GUIDANCE.md`, `SPEC-00`–`SPEC-04`).

## 1. Objective

Close the carried advisories from the roadmap final-integration review (recorded in `RELEASE-MANIFEST.md` §7 and `CHAT-04-EXECUTION-LEDGER.md`) with no user-visible behavior change:

1. Make the CHAT-03 worksurface Electron smoke deterministic again (cold-start settle).
2. Complete the recorded `fusion-studio-server/lib/thread-groups/service.js` split (04D-D4 residual).
3. Enforce the server/client chat-capable-view lockstep with a test instead of convention.
4. Remove the inert `useChatArea` forbidden-import token in `chat-surface-identity.spec.ts`.
5. Pin the whole-SPEC manifest documentation-scope convention.

Explicit non-goals: portal-menu adoption (04D-D6 — remains a future menu-migration carry), the pre-existing 02A-D7 baseline-red set, Move-menu reachability in adapterless views (04B-D5 boundary), the member-link renderer sender boundary (pre-existing since 01C), and any new product behavior.

## 2. Authorities And Baseline

Read before implementation:

- bundle `GUIDANCE.md`, `DECISIONS.md` (`CHAT-RD-009`, `CHAT-RD-011`, `CHAT-RD-016`), `ISSUES.md`;
- `../../../../AGENTS.md`;
- routed Code Standards, especially `005-Universal_Event_Bus`, `007-Persistence_And_Metadata`, and `008-Testing_And_Smoke_Slices`;
- the Chat System Structure, Thread Actions, and Testing And Operations wiki pages;
- owner-accepted `SPEC-04-IMPLEMENTATION-REPORT.md` and `CHAT-04-EXECUTION-LEDGER.md` (04D-D4 split plan; final-integration advisories);
- the final-integration record in `RELEASE-MANIFEST.md` §7;
- current `fusion-studio-server/lib/thread-groups/service.js` and the extracted `move-service.js`/`member-service.js` pattern;
- `fusion-studio-server/lib/thread-groups/chat-capable-views.js` and `fusion-studio-client/src/lib/worksurface/sideChatViews.ts`;
- `fusion-studio-client/e2e/side-chat-electron-smoke.mjs` and `fusion-studio-client/e2e/thread-worksurface-electron-smoke.mjs`.

Recorded baseline: HEAD `5073b1056fce4872751ab60de0b030560929b823` plus the owner-accepted, uncommitted SPEC-03 (71 paths) and SPEC-04 (79 paths + 6 deletions) bytes. Migration head `044_thread_group_placement_outbox.js`; migrations 001–043 frozen; prefer no new migration.

## 3. Non-Negotiable Constraints

- No user-visible behavior change to Main Chat, Side Chat, Move, member access, close/reopen, or worksurface continuity.
- No schema change and no new migration (head stays `044` unless a genuine defect requires one; any migration requires an owner ruling first).
- `service.js` extractions are mechanical only: method bodies move verbatim (whitespace-normalized), only the receiver/imports adapt; `performAction`, `ThreadGroupService` exports, the group mutation lease/transaction semantics, tombstone/recovery semantics, and correlated results stay unchanged. Any non-verbatim change requires a recorded, test-backed reason.
- 05A and 05D are test-only; 05C adds an enforcement test with no runtime coupling.
- All prior hard constraints remain: never commit/amend/push; preserve unrelated worktree bytes; isolated ports/profiles only (never port 3001, `fusion-studio-server/data/fusion.db`, or the Alpha profile); no Fork; no persisted/emitted `surfaceId`; no edits to accepted external contracts (Generic Host, Provenance, Bridge).
- Fresh `spec-slice-builder` per slice; first-clean builder-owned and orchestrator-owned reviews per `GUIDANCE.md`.

## 4. Slice 05A — Worksurface smoke durability (test-only)

`e2e/thread-worksurface-electron-smoke.mjs` fails deterministically unmodified because the first create click can land before the cold-start binding after `page.reload()` (final-integration advisory 1; root cause matches the disclosed SPEC-03 sensitivity).

- Back-port the identical mitigation the SPEC-04 smoke carries (`side-chat-electron-smoke.mjs:286-288`) or an equivalent explicit readiness wait; prefer an event-based readiness wait if it is equally small and reliable. Record the choice and rationale.
- Do not modify the SPEC-04 smoke unless the same race is demonstrated there; any such change is test-only and recorded.

Proof: unmodified `node e2e/thread-worksurface-electron-smoke.mjs` returns `CHAT_03_THREAD_WORKSURFACE_SMOKE_OK` with all four markers on **three consecutive runs**; no product byte changed; throwaway profile/workspace isolation preserved.

## 5. Slice 05B — `service.js` completion split

Complete the recorded 04D-D4 plan (current file: 857 lines). Extract:

- `link-service.js` — `copyLink`, `resolveLink`, `viewMarkdown`;
- `selection-service.js` — `setHarnessSelection`;
- `delete-service.js` — `deleteGroup`, `_recoverDeletedGroupWithinLease`, `_refreshTombstoneAggregate`, `_worksurfaceCleanupState`.

Pattern: owning `ThreadGroupService` instance as first argument (identical to `move-service.js`/`member-service.js`); `service.js` keeps thin delegating methods and its unchanged `performAction` facade and exports.

Proof:

- exact before/after line counts recorded; `service.js` at or below the 400-line checklist, or a documented residual carry with a concrete rationale and next plan;
- focused public-route coverage for delete/recovery (including new-request-ID tombstone recovery), `copy_link`/exact-member resolution, and `set_harness_selection` is green — add missing focused tests, weaken none;
- full server suite, client build, all accepted lanes, and both Electron smokes green.

## 6. Slice 05C — Capability lockstep enforcement

The server set (`lib/thread-groups/chat-capable-views.js`) and the client set (`src/lib/worksurface/sideChatViews.ts`) must be identical (today: the same eight views) but are currently held in lockstep only by convention.

- Add one test that asserts set equality. Mechanism is the builder's choice under constraints: runs inside an existing documented lane command, adds no new tooling or dependency, and introduces no runtime coupling between server and client.
- Enforcement is set equality, not policy: the test proves the two sources cannot drift apart silently.

Proof: the test fails on induced one-side drift (temporary local mutation, reverted; evidence recorded) and passes on current bytes.

## 7. Slice 05D — Hygiene sweep (test-only + record)

- Remove the inert `useChatArea` forbidden-import token from `chat-surface-identity.spec.ts`.
- Record the manifest documentation-scope convention: whole-SPEC product manifests include product bytes only; routed Wiki/doc updates are tracked in the owning report's documentation list. Record it in this SPEC's final report and execution ledger; do not edit accepted packet artifacts.

## 8. Required Verification

```bash
cd fusion-studio-server && npx jest --runInBand
cd fusion-studio-client && npm run build
cd fusion-studio-client && npx playwright test e2e/move-chat-to-side-chat.spec.ts e2e/side-chat-placement-recovery.spec.ts e2e/side-chat-isolation.spec.ts e2e/side-chat-adapterless-native.spec.ts --config=playwright.chat03.config.ts
cd fusion-studio-client && npx playwright test e2e/thread-worksurface-switching.spec.ts e2e/thread-worksurface-conflict.spec.ts e2e/thread-worksurface-restart.spec.ts e2e/thread-worksurface-builtins.spec.ts --config=playwright.chat03.config.ts
cd fusion-studio-client && npx playwright test e2e/chat-surface-identity.spec.ts e2e/chat-surface-isolation.spec.ts e2e/threaded-chat-host.spec.ts e2e/chat-component-registration.spec.ts 'component-tab-' 'component-action-context-source' --config=playwright.chat-surface.config.ts
cd fusion-studio-client && npx playwright test e2e/thread-group-compatibility.spec.ts --config=playwright.thread-group.config.ts
cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts
cd fusion-studio-client && node e2e/side-chat-electron-smoke.mjs
cd fusion-studio-client && node e2e/thread-worksurface-electron-smoke.mjs   # three consecutive runs
```

Expected baselines: server 209 suites / 3038 passed / 1 skipped (equal or greater passes; zero failures); build green with only the pre-existing chunk warning; 20 / 46 / 191 / 7 / 65 passed; side-chat smoke nine markers; worksurface smoke green three consecutive runs. The 02A-D7 baseline-red set is pre-existing and unchanged.

## 9. Dependency-Ordered Slices

| Slice | Scope | Depends on |
|---|---|---|
| 05A | Worksurface smoke durability (test-only) | — |
| 05B | `service.js` completion split | — |
| 05C | Capability lockstep enforcement test | 05B (final code shape recorded) |
| 05D | Hygiene sweep (test-only + record) | 05A (final smoke bytes) |

Whole-SPEC final integration runs after all slices: full checks above, fingerprint of all changed paths, deviation accounting, supervisor review, and explicit owner acceptance. No commit/amend/push.

## 10. Expected Changed Areas

Expected, not exclusive:

- `fusion-studio-server/lib/thread-groups/`: `service.js`, new `link-service.js`, `selection-service.js`, `delete-service.js`;
- focused server tests for the extracted families;
- `fusion-studio-client/e2e/thread-worksurface-electron-smoke.mjs`;
- `fusion-studio-client/e2e/chat-surface-identity.spec.ts`;
- the lockstep test file (server test or e2e spec) and its lane registration;
- `SPEC-05` report and execution ledger.

## 11. Definition Of Done

SPEC-05 is complete only after: every slice passes a fresh builder-owned review and a separate orchestrator-owned review on current bytes; the worksurface smoke is green three consecutive unmodified runs; `service.js` is at or below 400 lines or has a documented residual; the lockstep test demonstrably catches drift; no user-visible behavior, schema, or transport changed; all required checks above pass; deviations are fully recorded and classified; the supervisor presents the result; and the owner explicitly accepts. The worktree then remains uncommitted and is ready for the owner's commit/push decision.
