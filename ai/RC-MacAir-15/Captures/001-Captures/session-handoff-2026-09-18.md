# Session Handoff — 2026-09-18

**For:** the next session (human or agent). Read this top-to-bottom, then work the
"Suggested first actions" list. Written from the session that closed the chat
roadmap, updated Alpha, created the plugin capture suite, diagnosed the office
harness runaway, drafted SPEC-12, and triaged the Move-to-Side-Chat dogfooding gap.

**Repo / worktree:** `/Users/rccurtrightjr./projects/fs-dev`
**Branch:** `agent/exact-workspace-paths` · **HEAD:** `88637d1` (pushed)
**Remote:** `origin` = GitHub `Cylon-Skin-Job/fs-dev` (a `gitlab` remote also exists).
**Nothing staged.** Several intentional uncommitted sets exist — see §3.

---

## 0. TL;DR

- **Chat Composition Roadmap (025) is fully closed out**: CHAT-04 and CHAT-05
  owner-reviewed, accepted, recorded in `RELEASE-MANIFEST.md` §7, committed, and
  pushed. Alpha dogfood app was updated from the push and verified healthy.
- **Plugin system program was carried into fs-dev** as captures (`030-Plugin_System`,
  `032-Plugin_Backend`), committed and pushed. Next design item: classification
  (`PLUG-I001`). The Plugins-view mockup SPEC-01 is still a DRAFT in the
  `~/projects/plug-ins` archive awaiting owner approval.
- **SPEC-12 (office harness lifetime/resource bounds) was executed by another
  session** and is sitting uncommitted, `SPEC_READY_FOR_SUPERVISOR_REVIEW`.
  It needs a supervisor review + owner acceptance, then a commit.
- **Move Chat to Side Chat dogfooding finding**: the button only works from a
  view's own chat ("View Threads" dock), not the normal workspace chat. Two
  product decisions are open (discoverability fix; primary-surface flip). No
  code work started.
- A **46-hour runaway office test process** (≈99% CPU) was found and killed; the
  slow-typing complaint was machine starvation, not the app.

---

## 1. Shipped this cycle (committed + pushed)

Pushed on `agent/exact-workspace-paths`. The push range `16ccecf..88637d1`
contains 7 commits — three earlier-cycle accepted commits (`1ded59c` BRIDGE-02
docs, `5f46d1a` CHAT-01, `5073b10` CHAT-02) plus the four from this cycle:

| Commit | Contents |
|---|---|
| `554bedf` | Chat composition roadmap completion (CHAT-03/04/05): 135 files (129 product paths + 6 deletions), including `service.js` 857→391 split, lockstep guard, Secondary Chat retirement |
| `0ba0faa` | Chat roadmap reports, ledgers, wiki sync (14 files) |
| `f8fed6e` | Plugin system captures — `030-Plugin_System/` + `032-Plugin_Backend/` + Captures README (11 files) |
| `88637d1` | Office e2e fixture lifecycle fix (ownership lease + APFS CoW clone staging — stops run-to-run disk growth) |

Note on the `857→391` figure: 857 was the pre-split working-tree measurement of
the uncommitted accepted bytes (recorded at
`SPEC-05-IMPLEMENTATION-REPORT.md:31`); the last committed pre-split state
(`5073b10`) measures 762 lines, so a cold session re-deriving from git history
will see 762→391.

**Alpha dogfood updated and verified (2026-09-17):**
- Source checkout `~/Applications/Fusion-Studio-Alpha-Source` fast-forwarded
  `16ccecf → 88637d1`; `npm run electron:pack` green; installed app
  `/Applications/Fusion Studio Alpha.app` replaced (previous rotated to
  `Fusion Studio Alpha.app.previous`; an older `Fusion Studio Alpha.previous.app`
  also exists and can be deleted).
- Launched with both identity vars and verified: binary sha matches the fresh
  package; server on port 60800; 6 workspaces; all six resolve `ai/RC-Alpha/System`;
  WebSocket connections established and stable.
- Note: the shipped build changed server log verbosity — `server-live.log` now
  writes category-only lines (`request_log`, `diagnostic_log`), not the old
  verbose `Client connected` / `workspace:init` text.

**Chat roadmap acceptance receipts:** `RELEASE-MANIFEST.md` §7 (SPEC-01 through
SPEC-05, plus ROADMAP COMPLETE and final-integration records). Minor cleanup:
the candidate status line still says `SPEC-05 … READY FOR COMMIT/PUSH DECISION`
even though the push happened — update it if you touch that file.

---

## 2. What "done" means per workstream

### 2.1 Chat Composition Roadmap (025) — COMPLETE, pushed
- Final identity: SPEC-04 product digest `03171a39…` (79 paths + 6 deletions),
  migration head `044`; SPEC-05 repair fingerprint reverified.
- Evidence paths: `ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/`
  (`SPEC-0x-IMPLEMENTATION-REPORT.md`, `CHAT-0x-EXECUTION-LEDGER.md`,
  `RELEASE-MANIFEST.md`, `ROADMAP.md`, `SPEC-05-ADVISORY-REPAIRS.md`).
- Carried non-blocking advisories (recorded, not scheduled): `service.js` residual
  clean (now 391 lines); portal-menu adoption for the rail member group; capability
  lockstep now enforced by test; smoke model-turn scope; pre-existing 02A-D7
  baseline-red set.

### 2.2 Plugin system program (PLUG-01) — captures created, design next
- New capture suite (committed in `f8fed6e`):
  - `ai/RC-MacAir-15/Captures/030-Plugin_System/` — `plugin-system-vision.md`
    (root), `capture-system.md` (trickle-down/roll-up + changelog/handoff rules),
    `capture-map.md` (cross-read hub), `decisions.md` (PLUG-D001–D012),
    `issues.md` (PLUG-I001–I014), `changelog.md`, `handoff.md`.
  - `ai/RC-MacAir-15/Captures/032-Plugin_Backend/` — `backend-architecture.md`
    (gates split / free-vs-blocked, 8 layers, command-surface contract,
    server-modularization playbook), `changelog.md`, `handoff.md`.
- Design source corpus stays at `~/projects/plug-ins/ai/RC-MacAir-15/Captures/`
  (`001-Plugin_System/VISION.md`, `plugin-system-kickoff.md`,
  `provenance-research.md`, `OBSERVATIONS.md`, `002-Specs/PLUGINS-VIEW-MOCKUP/`).
  Its README was updated to point at the fs-dev captures (that README edit is
  uncommitted in the plug-ins repo — that repo has no commits yet).
- **Next design item:** `PLUG-I001` classification (policy vs contribution vs
  content vs platform; preinstalled-first-party question) — it gates consent
  treatment and the manifest grammar. The mockup SPEC-01 (draft) does not depend
  on it and can be approved/dispatched independently in an isolated worktree
  (`~/projects/fs-dev-plugins`, additive-only, flag-gated).

### 2.3 SPEC-12 — Office harness lifetime & resource bounds — EXECUTED, UNREVIEWED
- Drafted this session after the incidents (§4), dispatched via a prompt to
  another session, executed by that session on 2026-09-17.
- Status in `SPEC-12-IMPLEMENTATION-REPORT.md` line 3:
  **`SPEC_READY_FOR_SUPERVISOR_REVIEW`**.
- What it delivers (all test-infrastructure, no product code): shared bounds
  module `fusion-studio-client/e2e/office/harness-bounds.mjs`; run deadline
  + parent-loss self-termination on the previously-unbounded entry points
  (`node --test` runner, Playwright lifecycle path, isolated-Electron runner);
  disk preflight + CoW physical-delta assertion; whisper asset provisioning +
  fail-closed `OFFICE_E2E_RESOURCE_MISSING` (no download/build reachable);
  janitor for empty harness-owned `/tmp` shells.
- Key results: tagged gates 6/6 + 6/6 exit 0; parent-watch 4/4; full harness run
  59 tests / 57 pass / 2 fail — the two reds are the pre-existing
  `[slice 07.4]` lane-blocker tests (`shell_bootstrap_unavailable`,
  out of scope). Baseline was 47/44/3.
- **Your review pass should:** re-verify the changed-file hashes, rerun
  `node --test --test-name-pattern='\[slice 12\.1\]' e2e/office/fixture-lifecycle.test.mjs`
  and the `12.2` equivalent plus `node --test e2e/office/parent-lifecycle-watch.test.cjs`,
  read the deviation table (12.1 D1–D7, 12.2 A–E — all `accepted`) and the six
  residuals, then either accept and commit or return it for repair.
- Residual highlights: two `[slice 07.4]` reds remain (lane blocker, separate
  packet); `run-isolated-electron.mjs` parent-loss path exits 1 without the SPEC
  marker (cleanup verified); CoW probe covers the ≥4 MiB clone inventory, not the
  full-staging call site; provisioning depends on `~/.whisper` or a buildable
  source (fails closed with hint).

### 2.4 Move Chat to Side Chat dogfooding — finding recorded, no work started
- The enable gate (`useLegacyChatHost.ts:721-730`) requires a **view-bound**
  Main Chat (`viewId` non-null) plus idle conditions; `ChatAreaHeader.tsx:173-176`
  renders it disabled with tooltip *"Move is available for the current Main Chat
  in a view."*
- Two chat surfaces exist in the shipped build:
  1. **Normal workspace chat = Legacy host** (`viewId: null`): chats started here
     are NOT view-bound; Move is permanently disabled. `useViewChatHost.ts` header:
     *"the PRODUCTION workspace chat remains the Legacy host (`viewId: null`)."*
  2. **View's own chat = "View Threads" dock** (collapsed by default) inside
     Capture, File, Wiki, Office, and Email views (`ViewWorksurfaceDock` mounted by
     `CaptureTiles.tsx`, `FileExplorer.tsx`, `WikiExplorer.tsx`, `OfficeGrid.tsx`,
     `EmailGrid.tsx`; the server capability file groups `email-viewer` with the
     dock-backed views, `chat-capable-views.js:16-19`).
     Chats created there bind to that view (`useViewChatHost.ts:174-177`:
     `thread:open-assistant { viewId }`). Move works here.
- Reproduce the working path: open Capture/File/Wiki/Office/Email → click
  **View Threads** → start/select a chat in the dock → ⋮ → **Move Chat to Side
  Chat** (idle). The Electron smoke (`e2e/side-chat-electron-smoke.mjs`) proves
  this flow in a packaged build.
- **Open product decisions** (owner): (a) discoverability fix — hint in the
  disabled item, auto-open the dock when a view has bound chats, or label the
  legacy chat as unbound; (b) the bigger flip — make the view-bound chat the
  primary production surface (new scope; was deliberately not part of the
  five-SPEC roadmap). Optionally (c) adapterless views (Issues/Agents/Browser)
  have no production in-view Move menu yet (recorded 04B-D5).

---

## 3. Uncommitted state (exact)

**Office SPEC-12 (from the executor session):**
- Modified: `fusion-studio-client/e2e/office/{fixture-lifecycle.mjs,
  fixture-lifecycle.test.mjs, global-setup.mjs, global-teardown.mjs,
  parent-lifecycle-watch.cjs, parent-lifecycle-watch.test.cjs,
  run-isolated-electron.mjs}`, `fusion-studio-client/playwright.office.config.ts`
- New: `fusion-studio-client/e2e/office/harness-bounds.mjs`,
  `ai/RC-MacAir-15/Captures/009-Office-Editor-Temp/SPEC-12-IMPLEMENTATION-REPORT.md`

**Docs from this session:**
- New: `ai/RC-MacAir-15/Captures/009-Office-Editor-Temp/SPEC-12-HARNESS-LIFETIME-AND-RESOURCE-BOUNDS.md`
- New: `ai/RC-MacAir-15/Captures/001-Captures/session-handoff-2026-09-18.md` (this handoff document — itself untracked; it rides the next commit)
- Modified: `…/009-Office-Editor-Temp/ISSUES.md` (2026-09-16 incident entry),
  `…/009-Office-Editor-Temp/ROADMAP-LEDGER.md` (draft + execution entries)

**Unrelated — preserve, never touch:**
- `M ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json`
- `M ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json`
- `?? ai/RC-MacAir-15/Captures/031-Remote_Access/`
- `?? ai/RC-MacAir-15/Captures/001-Captures/chat-packet-role-handoff-2026-09-14.md`

**Not in this repo:** `~/projects/plug-ins/README.md` pointer edit (uncommitted;
that repo has no commits).

---

## 4. Incidents and environment notes

- **46-hour runaway (2026-09-15/16):** orphaned
  `node --test e2e/office/fixture-lifecycle.test.mjs` (parent dead, PID 1) spun
  ≈99% CPU until killed 2026-09-16 ~21:55. Root cause: no parent watch on the
  `node --test` path, no run deadline. SPEC-12 closes this.
- **Disk-fill redownload (2026-09-14/15):** per-run runtime staging duplicated
  large files (1.55 GB whisper model) because `COPYFILE_FICLONE` silently falls
  back to byte copies; fixed by the user's CoW + lease + sweep change
  (committed `88637d1`; tested at `[slice 00.2]`).
- **Runtime download/build fallback:** `fusion-studio-server/lib/transcription/index.js:109-136`
  downloads via `npx nodejs-whisper download` and can cmake-build whisper-cli
  when a staged runtime lacks assets (a GGML/clang compile was observed during
  triage). SPEC-12 makes the harness fail closed with asset provisioning instead.
- **Slow typing** was machine starvation (the runaway plus several long-running
  `opencode` sessions), not an app defect; Alpha app itself idles at ~0.6% CPU.
- **Lane blocker (still open, out of scope for SPEC-12):** the office Playwright
  browser lane cannot boot its isolated server under Trusted Fusion Shell
  Authority (`shell_bootstrap_unavailable`), and the Electron lane times out on
  the renderer. Options (a)/(b)/(c) enumerated in
  `009-Office-Editor-Temp/ISSUES.md` (2026-09-14). A separate packet would fix it.
- **Concurrent sessions:** the dev Electron instance (profile
  `~/.fusion-view01-acceptance`) may be running — leave it alone. Check
  `pgrep -fl 'fixture-lifecycle'` before running office tests; nothing was active
  as of this handoff.

---

## 5. Environment facts you'll need

| Thing | Value |
|---|---|
| Dev checkout | `/Users/rccurtrightjr./projects/fs-dev` (branch above) |
| Alpha source checkout | `~/Applications/Fusion-Studio-Alpha-Source` |
| Installed Alpha app | `/Applications/Fusion Studio Alpha.app` (+ `.previous` backups) |
| Alpha profile / machine | `~/Library/Application Support/Fusion Studio Alpha` / `RC-Alpha` |
| Alpha launch | `env FUSION_APP_USER_DATA='…/Fusion Studio Alpha' FUSION_LOCAL_MACHINE='RC-Alpha' open -n '/Applications/Fusion Studio Alpha.app'` |
| Alpha server log | `…/Fusion Studio Alpha/server-live.log` (category-style lines) |
| Office test config | `playwright.office.config.ts` (port 3311 default, isolated `/tmp` roots) |
| Chat test lanes | `playwright.chat03.config.ts` (3317), `playwright.chat-surface.config.ts` (3316), `playwright.thread-group.config.ts` (3315) |
| Never touch | port 3001, `fusion-studio-server/data/fusion.db`, the Alpha profile, unrelated dirty bytes |
| Plugin design archive | `~/projects/plug-ins/ai/RC-MacAir-15/Captures/` |

---

## 6. Working constraints (carry forward)

- **No commit/amend/push without an explicit owner request.** Preserve unrelated
  dirty/untracked bytes.
- Owner acceptance is explicit; questions/silence are not acceptance. Reports and
  ledgers stay frozen once accepted; receipts go in the owning `RELEASE-MANIFEST`.
- Office work follows `009-Office-Editor-Temp/GUIDANCE.md`: dispatch through
  `$orchestrator`, builders get only SPEC + GUIDANCE, deviations recorded and
  classified, terminal report format per §8.
- The plugin capture system follows `030-Plugin_System/capture-system.md`
  (trickle-down, roll-up, changelog + handoff per capture, capture-map hub).
- Alpha flow per `AGENTS.md`: ask before pull/rebuild/install; pull and install
  are separate operations; verify identity vars and health after restart.

---

## 7. Suggested first actions (in order)

1. **Supervise SPEC-12**: verify hashes + rerun the tagged gates; if clean,
   present the acceptance checkpoint to the owner. On acceptance, commit the
   office bounds change with its own commit (mirror the `88637d1` style) and
   include the SPEC-12 report/ledger/docs — do not sweep in the unrelated bytes.
2. **Decide the Move dogfooding path** (§2.4): discoverability fix, the
   primary-surface flip, or both as separate packets.
3. **Plugin classification session** (`PLUG-I001`) — then manifest/permission
   grammar, then mockup SPEC-01 approval/dispatch.
4. Optional: frame the office lane-blocker packet from the three options in
   `ISSUES.md` 2026-09-14.
5. Housekeeping: update the stale `RELEASE-MANIFEST.md` status line post-push;
   delete `Fusion Studio Alpha.previous.app` when satisfied with the current build.
