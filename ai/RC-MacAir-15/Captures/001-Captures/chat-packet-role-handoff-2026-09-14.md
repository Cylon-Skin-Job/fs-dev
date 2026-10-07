# Role Handoff — Chat Packet (CHAT-04 pending) + Office Harness Follow-ups

**Written:** 2026-09-14, by the outgoing owner-side review session
**Purpose:** let a fresh session take over this session's role: independent
owner-side review and acceptance of CHAT-04 when it lands, commit/publish
decisions, and the open office-harness follow-ups. Self-contained; read this
file first, then the paths in §9 only as needed.

---

## 1. One-paragraph state

The chat packet (025 bundle) has SPEC-00–SPEC-03 owner-accepted, with SPEC-04
(Move Chat to Side Chat) **in flight in another session against the same
worktree**. The worktree now contains four layers: committed history through
`5073b10`, the accepted-but-uncommitted CHAT-03 work (whose accepted digest no
longer reproduces because CHAT-04 has edited 22 of its files — expected forward
integration), this session's office-harness change (done, uncommitted), and
CHAT-04's in-flight edits (migration `044`, side-chat modules, specs, ledger).
**Do not commit anything until CHAT-04 returns READY FOR REVIEW and is accepted.**
The successor's job: verify CHAT-04 per its SPEC and the packet contract, take
it to the owner for acceptance, then commit/push/Alpha as the owner directs.

## 2. Repo, branch, commits, publish state

- Worktree: `/Users/rccurtrightjr./projects/fs-dev` (the only git worktree of
  this repo), branch `agent/exact-workspace-paths`.
- Committed: `5073b10` (CHAT-02), `5f46d1a` (CHAT-01), `1ded59c` (bridge docs),
  `16ccecf` (BRIDGE-01).
- `origin/agent/exact-workspace-paths` is at `16ccecf` — **local is ahead by 3.**
- Alpha source checkout (`/Users/rccurtrightjr./Applications/Fusion-Studio-Alpha-Source`)
  is clean and at `16ccecf`; Alpha app not running. The dev app **is** running
  (`~/.fusion-view01-acceptance`, `RC-MacAir-15`, port in that profile's
  `server.port`) because the owner asked to look at the build.
- Double-check identity variables if relaunching Alpha: `FUSION_APP_USER_DATA`
  + `FUSION_LOCAL_MACHINE=RC-Alpha`.

## 3. Worktree layers (status)

1. **CHAT-03 accepted, uncommitted.** Recorded in
   `…/025-Chat_Composition_Roadmap/RELEASE-MANIFEST.md` (digest
   `6b1e36ce28689121857200ddbd997a618596a37c00744c305b4896e8714b793d`,
   migration head `043`). **Its digest no longer reproduces**: CHAT-04 has
   already modified 22 of its 71 files. Do not try to commit it separately;
   treat CHAT-04's report as the integrated revision.
2. **Office harness change (this session, test-only, uncommitted):**
   `fusion-studio-client/e2e/office/fixture-lifecycle.mjs`,
   `…/fixture-lifecycle.test.mjs`, `fusion-studio-client/playwright.office.config.ts`,
   plus docs `ai/RC-MacAir-15/Captures/009-Office-Editor-Temp/{SPEC-00…,ISSUES.md,ROADMAP-LEDGER.md}`.
   Complete and proven at harness level; §8 has the blockers. Owner has not
   decided whether/when to commit it, and how (separate commit vs bundled).
3. **CHAT-04 in flight** (another session): new `CHAT-04-EXECUTION-LEDGER.md`,
   `e2e/{move-chat-to-side-chat,side-chat-isolation,side-chat-placement-recovery,side-chat-adapterless-native}.spec.ts`,
   `e2e/side-chat-electron-smoke.mjs`, server
   `lib/db/migrations/044_thread_group_placement_outbox.js`,
   `lib/thread-groups/{placement-delivery,chat-capable-views,action-identity,ids}.js`,
   client `components/chat/{sideChatBridge.ts,useSideChatRailAdapter.ts,…}`,
   `types/threadGroupMember.ts`, and edits across chat/worksurface files.
   No `SPEC-04-IMPLEMENTATION-REPORT.md` yet → not finished.
4. **Unrelated/preserved:** `ai/RC-MacAir-15/System/Views/{001-capture-viewer,002-file-viewer}/state/state.json`
   (running-app drift), `ai/RC-MacAir-15/Captures/031-Remote_Access/` (concurrent
   worker artifact). Never commit these with chat work.

## 4. The role: owner-side review protocol (how this session worked)

The owner hands each SPEC to a builder session; this role independently verifies
before the owner accepts. Pattern that worked every time:

1. Read the implementation report + execution ledger the builder session leaves
   (paths in §9).
2. Recompute identity: the product manifest's per-file SHA-256 values and its
   own digest; the union path list; the deletions list. Reconcile the full
   `git status` against them and account for every byte.
3. Inspect the actual bytes for the SPEC's contract yourself (spot-check the
   riskiest clauses).
4. Reproduce the gates on current bytes (command cheat sheet in §10).
5. Spawn **one fresh read-only reviewer** (agent `clean-room-reviewer`) with the
   neutral task, authorities, and evidence paths — never your findings. Repeat
   after any correction.
6. If CLEAN: record the acceptance in the bundle's `RELEASE-MANIFEST.md`
   (evidence file, excluded from the candidate fingerprint, so the accepted
   bytes stay frozen). Then ask the owner for acceptance wording; do not
   self-accept.
7. Only commit when the owner asks; then offer push, and per the repo AGENTS.md
   ask about Alpha sync/rebuild after a push.

Known hard rules: never commit/amend/push unless asked; preserve unrelated
worktree bytes; one SPEC at a time; migrations use the next free number; do not
edit accepted migrations or accepted SPEC bytes.

## 5. CHAT-04 review checklist (SPEC-04 = Move Chat to Side Chat)

Authorities: `SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md` (§11 slices 04A–04D, §12
required verification, §10 Secondary retirement), `BRIDGE-02-CONFORMANCE-OVERLAY.md`,
`DECISIONS.md`, `GUIDANCE.md`, `ROADMAP.md` §6.

- Identity: product manifest digest + per-file hashes; deletions; reconciliation
  against `git status`; baseline commit recorded at its dispatch; migration head
  (expected `044`; `043` was CHAT-03).
- Contract: Move places the current Main Chat in a durable Side Chat tab via the
  committed descriptor + SPEC-03 managed-placement lane (never the empty-launcher
  lifecycle); creates a cold empty Main Chat peer; copies only the
  server-validated portable model/variant; `sideChatPlacementId` distinct from
  `projectionId`/`surfaceId`/`threadId`/`threadGroupId`; repeated Move; close →
  placement only, no resurrection; `thread:members`; exact-member link
  reopen/focus without promotion or MRU; legacy singleton Secondary Chat removed
  only after replacement passes; no `surfaceId` persisted anywhere; `threadId`
  stays routing/Provenance identity.
- Gates (§12): server `move_chat_to_side` integration + recovery; the four
  focused e2e specs (§3 layer 3 list); client build; server
  `npx jest --runInBand`; the Electron smoke named in §12; plus regression lanes
  (§10 cheat sheet).
- Expect the report to reconcile CHAT-03's superseded digest (its 22 modified
  files) as forward integration, and to carry the whole integrated changed set.
- After acceptance: the 025 `ROADMAP.md` §6 completion gate (all five SPECs
  accepted in order; no Fork/Secondary paths; concurrent Main/Side isolation;
  worksurface restore; Provenance retention). Then commit per owner direction.

## 6. Outstanding owner decisions (carry these forward)

1. **Commit plan:** CHAT-03 was accepted but never committed (owner's word was
   never given, and CHAT-04 has since moved those bytes). Decide granularity and
   whether the office-harness change rides along or lands separately.
2. **Baseline-red re-baseline:** these fail identically at clean baseline
   `5f46d1a` and are carried: `chat-foreground-chrome`, `chat-context-meter`,
   `chat-message-layout` (test 1), `chat-composer-model-menu`,
   `thread-bootstrap-order`; `prompt-ownership.slice-c` (1 case); 56/59
   `working-activity` cases. Repair later or formally re-baseline.
3. **Office lane blockers (ISSUES.md 2026-09-14):** browser lane dies at
   `shell_bootstrap_unavailable` (packaged mode now requires the trusted-shell
   bootstrap); Electron lane times out waiting for the renderer page. Options in
   that issue: (a) make the palette user-data root overridable so the browser
   lane runs standalone; (b) build a real browser shell-auth adapter; (c)
   diagnose the Electron lane and possibly retire the browser lane.
4. **Publish:** push `agent/exact-workspace-paths` and whether to sync/rebuild
   Alpha once the chat work is committed.

## 7. Office harness change — what was delivered (uncommitted)

- Real APFS clone staging for files ≥4 MiB (`COPYFILE_FICLONE_FORCE` →
  `/bin/cp -c` → copy; `FICLONE_FORCE` is `ENOSYS` on this machine, so `cp -c`
  is load-bearing). Measured: all 52 large staged files (3.24 GB incl. the
  1.55 GB whisper model) cost **0 MB**; staging ≈817 MB vs ≈3.9 GB before.
- Stale-root sweep at config load (direct children only, never symlinks,
  live-owner skip via `.office-e2e-owner.json`, default 6 h, env overrides
  `FUSION_OFFICE_E2E_SWEEP_MAX_AGE_MS` / `FUSION_OFFICE_E2E_SWEEP=0`, logs
  `OFFICE_E2E_SWEPT_STALE_ROOT=`).
- Tests: new coverage in `fixture-lifecycle.test.mjs`; full harness suite
  47 tests / 44 pass / 3 fail, and **all 3 failures reproduce at clean baseline**
  (two browser-lane probes + one packaged-runtime identity test).
- Acceptance substitutes achieved: zero roots after orderly runs; hard-killed run
  leaves a root and the next sweep removes it. Full Playwright acceptance is
  blocked by the §6-3 lane failures, which are pre-existing.

## 8. Environment notes

- Smoke flakiness: Electron smokes occasionally fail on cold launch then pass on
  retry (chat-surface and thread-worksurface both observed). Failures are loud
  and non-destructive.
- The dev app the owner is viewing writes `state.json` under `ai/RC-MacAir-15/System/Views/*`
  continuously; those files are runtime drift, not work.
- Logging is sanitized; to see a packaged server's real startup error, preload a
  module that no-ops `installLogTee` before requiring `server.js` (used to find
  `shell_bootstrap_unavailable`).
- `/tmp/chat03/final/manifest-product.txt` (CHAT-03 evidence) and
  `/tmp/chat02/*` still exist; use `/tmp/chat03` only as historical evidence,
  since CHAT-04 has superseded those bytes.

## 9. Read-first paths

- `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/RELEASE-MANIFEST.md`
  (approval + acceptance ledger; SPEC-00..03 accepted)
- `…/SPEC-04-MOVE-CHAT-TO-SIDE-CHAT.md`, `…/BRIDGE-02-CONFORMANCE-OVERLAY.md`,
  `…/DECISIONS.md`, `…/GUIDANCE.md`, `…/ROADMAP.md`, `…/ISSUES.md`
- `…/SPEC-01/02/03-IMPLEMENTATION-REPORT.md` and their ledgers
  (`CHAT-01/02/03-EXECUTION-LEDGER.md`), plus `CHAT-04-EXECUTION-LEDGER.md`
  when present
- `ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/{APPROVAL.md,DECISIONS.md,SPEC-01,SPEC-02}`
- `ai/RC-MacAir-15/Captures/009-Office-Editor-Temp/{SPEC-00-OFFICE-EDITOR-TEST-HARNESS.md,ISSUES.md,ROADMAP-LEDGER.md}`
- repo `AGENTS.md`

## 10. Verification cheat sheet

```bash
# server suite (bounded parallelism; runInBand is the SPEC convention)
cd fusion-studio-server && npx jest --runInBand
# client build
cd fusion-studio-client && npm run build
# chat regression lanes
cd fusion-studio-client && npx playwright test e2e/thread-group-compatibility.spec.ts --config=playwright.thread-group.config.ts          # 7
cd fusion-studio-client && npx playwright test e2e/chat-surface-identity.spec.ts e2e/chat-surface-isolation.spec.ts e2e/threaded-chat-host.spec.ts e2e/chat-component-registration.spec.ts --config=playwright.chat-surface.config.ts   # 49
cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts                                                       # 65
cd fusion-studio-client && npx playwright test component-tab component-action-context-source --config=playwright.chat-surface.config.ts   # 142
cd fusion-studio-client && npx playwright test e2e/thread-hover-peek.spec.ts e2e/chat-composer-mode-menu.spec.ts --config=playwright.chat-surface.config.ts  # 2
# SPEC-03 lane (regression for SPEC-04)
cd fusion-studio-client && npx playwright test e2e/thread-worksurface-switching.spec.ts e2e/thread-worksurface-conflict.spec.ts e2e/thread-worksurface-restart.spec.ts e2e/thread-worksurface-builtins.spec.ts --config=playwright.chat03.config.ts  # 46
# office harness tests (see §7; 3 pre-existing failures)
cd fusion-studio-client && node --test e2e/office/fixture-lifecycle.test.mjs
```

Fingerprint convention: ordered `<sha256><two spaces><path>` lines, then the
SHA-256 of that manifest is the product digest; the manifest file's own SHA-256
equals the digest (bridge/chat bundles). Bundle `RELEASE-MANIFEST.md` and review
evidence are excluded from candidate identity.

## 11. Resume prompt for the successor

> Read `ai/RC-MacAir-15/Captures/001-Captures/chat-packet-role-handoff-2026-09-14.md`.
> You are taking over the owner-side review role for the chat packet. CHAT-04
> (025 SPEC-04) is in flight in the same worktree — do not commit anything until
> it returns READY FOR REVIEW and is accepted. Then verify it per §5, run the
> §10 gates, spawn a fresh independent reviewer, and bring the result to me for
> acceptance.
