# Composer Typing Latency / Freeze — Dedicated Investigation Brief

**Date:** 2026-09-19 (evening)
**Owner mandate:** *"We have a race condition or a bug in our actual app. It is not working the way it was three days ago. This is indisputable. We will not move forward until this is solved."*
**This brief is for a dedicated session.** It is self-contained. Do not treat the problem as machine starvation — that diagnosis was tried and rejected by the owner.

---

## 1. Problem statement

Typing in the **chat composer inside the Fusion Studio app** is slow/laggy, and on 2026-09-19 the composer hard-froze: after typing a few characters the **caret stopped blinking and input jammed**.

- Typing in Chrome on the same machine at the same time: **normal** → the problem is app-specific, not OS/input-wide.
- Owner timeline: it **was not a problem ~3 days ago** (≈2026-09-16). It is a regression, not a long-standing trait.
- Owner hypotheses to test (not yet confirmed):
  1. A race condition / bug in app code introduced in the regression window.
  2. Zustand store shape/writes per keystroke gone wrong.
  3. "Things streaming through the event bus and the input having to be redrawn rather than sitting in RAM" (i.e., per-keystroke churn in stores/event bus/re-renders).

## 2. Environment & current state

- **Dev checkout:** `/Users/rccurtrightjr./projects/fs-dev`
- **Branch / HEAD:** `agent/exact-workspace-paths` @ `88637d1` (pushed)
- **Installed Alpha app:** `/Applications/Fusion Studio Alpha.app` (profile: `~/Library/Application Support/Fusion Studio Alpha`, machine `RC-Alpha`)
- **A dev dogfood instance may be running** at profile `~/.fusion-shell-dogfood-fresh` (server port ~51538). **Do not disturb it or any profile/DB without owner approval.**

### What changed in the regression window (establish exact known-good build with owner)

| When | What | Commit |
|---|---|---|
| before 2026-09-15 | Alpha ran pre-chat-roadmap bytes (`16ccecf` era) | `16ccecf` |
| 2026-09-15 | Chat composition roadmap completion: CHAT-03 worksurface continuity, CHAT-04 Move/Side Chat, CHAT-05 Secondary Chat retirement | `554bedf` (133 files) |
| 2026-09-15 | Chat roadmap reports/wiki | `0ba0faa` |
| ~2026-09-17 | Alpha source fast-forwarded `16ccecf → 88637d1`, app rebuilt/reinstalled (owner dogfooding this build since) | `88637d1` |
| 2026-09-17/18 | Office e2e fixture lifecycle fix (ownership lease + APFS CoW clone) | `88637d1` |
| **2026-09-19 (today)** | **Uncommitted flip:** production shell chat is now the view-bound host | in working tree |
| ongoing | Provenance / event-bus program (`ai/RC-MacAir-15/Wiki/010-Events_And_Ledger`, captures 034) landed across this window | several |

The owner says typing was fine ~3 days ago. That brackets the regression around the **CHAT-02…CHAT-05 land** (`5073b10`…`554bedf`) and/or the **provenance/event-bus work**. Today's flip is a *later* change and must be tested as an additional factor, not assumed to be the cause.

### Today's uncommitted work in the tree (preserve it)

1. **View-bound production flip** (owner direction 2026-09-19): `App.tsx` `PanelContent` mounts `useViewChatHost` once per panel; `Sidebar.tsx`/`ChatArea.tsx` render projections; `useSidebar.ts` deleted; `LegacyChatHost`/`useLegacyChatHost` remain for explicit/component mounts.
   - New proof: `fusion-studio-client/e2e/view-bound-shell-smoke.mjs` (passing).
2. **Code Standards rule 6** added (`005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`): "Ship the target, don't preserve the old path."
3. **Chat data wiped** in dev/Alpha/view01 DBs (owner-approved; chat rows zeroed), chatlog mirrors cleared. **Backups exist** (see §7).
4. SPEC-12 office harness work is parked/unreviewed; unrelated.
5. Numerous uncommitted wiki edits from a concurrent documentation session (033/034 captures) — **preserve all unrelated dirty bytes**.

## 3. Evidence collected so far (with caveats)

- **Isolated fresh instance, empty workspace, synthetic (CDP) typing** — tool `fusion-studio-client/e2e/composer-latency-probe.mjs`:
  `68 chars @25ms delay, total 1931 ms; keydown→input p50 0.4 ms, p95 0.5 ms, max 1.2 ms; long tasks: 0` at system load ~3.1.
  **Caveats:** synthetic events bypass the OS input path; empty workspace; fresh process; does NOT reproduce the owner's condition.
- **Owner's live instance after ~2h14m:** renderer CPU 0% at rest; renderer CPU-time deltas ~0 while idle; RSS ~392 MB, physical footprint 765 MB, **peak footprint 2.6 GB** (from `sample` header). Renderer was not spinning at the sampling moments.
- **During the hard freeze (~19:06–19:07):** renderer main thread sampled parked in `mach_msg2_trap` (blocked/waiting), CPU-time flat over minutes.
  **Caveat:** `sample` output symbolication was unreliable; AND OS-level `sample` (1 ms) was running on the live window at that moment, which can itself freeze a GUI. Sampling may have contributed to the hard freeze; it **cannot** explain the 3-day-old slow typing.
- **E2E process scan (19:00):** no Fusion test/E2E processes (no `node --test`, `fixture-lifecycle`, Playwright, office harness). Only an unrelated `node --watch src/server.js` from the solobooks project at 0% CPU.
- **Opencode host process:** burns 50–68% only during active turns, drops to 1–2% idle (verified with CPU-time deltas). Not a lingering runaway.
- **Per-keystroke code path is currently RAM-only:** `handleComposerDraftChange` (`useLegacyChatHost.ts:300-304`) writes only to the in-RAM Zustand store `state/chatComposerDraftStore.ts` (single narrow subscriber). No WebSocket frame, no event-bus publish, no server call per keystroke.
- **App relaunch gotcha (ops, not product):** relaunching into a previously-used profile dir aborts with `SingletonLock ... No such file or directory` / "second instance blocked" when stale `SingletonLock`/`SingletonCookie`/`SingletonSocket` artifacts remain from a killed instance. Fix: `rm -f <profile>/Singleton*` or use a fresh profile with copied `server-data`.

## 4. Weakened / rejected explanations

- **Machine starvation alone** (the 2026-09-16/17 E2E-runaway explanation). Current scans show no runaway; Chrome typing is normal; app renderer is idle at rest. Do not re-litigate this as the whole answer.
- **Per-keystroke event-bus traffic** — the composer draft path is a pure in-RAM store write today. Still check provenance/ledger writers for *other* per-keystroke or per-render triggers.
- **OS-level sampling as whole explanation** — it coincides with one hard freeze only, not with the multi-day slow typing.

## 5. Hypotheses to test (ranked)

1. **Render amplification per keystroke introduced by the CHAT-03/04/05 land.**
   - Keystroke → draft-store write → connected host re-render → `ChatSurface` subtree (not memoized) → header/footer/MessageList/TodoDrawer re-render.
   - Check with React render counts / commit timings (React DevTools Profiler or temporary render counters), with a realistic workspace and a long transcript.
2. **Provenance / event-bus hot path.** Grep client and server for writers on typing/render paths:
   `event_log`, `publish`, `ledger`, UI-action provenance, `canonical-chat-event-applier`.
   Measure DB write/WS fan-out volume during a typing session (isolated profile).
3. **Store subscription breadth.** `useViewChatHost` subscribes to whole maps (`threadMembersByGroup`), `worksurfaceSlice` selectors, `entries`; today the hook runs per panel (7×). Look for selectors returning new references per store write, causing cross-panel re-renders on every keystroke.
4. **Long-session growth / GC pressure.** Peak renderer footprint 2.6 GB; measure memory growth and long-task frequency over a 30–60 min typing session in an isolated instance.
5. **Composer-adjacent per-keystroke work:** `useFileAutocomplete` candidates, ghost-overlay geometry re-measurement, attachment pills, context/token meters.
6. **Race conditions** (owner's word): `thread:list`/`thread:open` storms, harness-selection pending loops, reconnect sweeps, or store writes from stream handlers landing mid-keystroke. Watch renderer console + WS frames while typing.

## 6. Measurement plan & tooling

Use **isolated instances only** (temp `FUSION_APP_USER_DATA`, temp workspace, `FUSION_LOCAL_MACHINE=RC-MacAir-15`). Never sample/trace the owner's live window; never overwrite a running app's log (use timestamped log files per run).

1. **Extend `e2e/composer-latency-probe.mjs`**:
   - add keydown→rAF (painted frame) latency and DOM mutation counts;
   - add a "realistic workspace" mode: rsync the owner's workspace (e.g. `rsync -a --exclude node_modules --exclude .git --exclude release`) to /tmp and register it in the temp DB;
   - optionally restore a chat backup into the temp profile for realistic history (see §7);
   - repeated runs over 30–60 min to catch growth;
   - report JSON markers for before/after comparison.
2. **OS-input path control:** drive real keystrokes with AppleScript `System Events keystroke` into the isolated app while measuring app-side observers; also try with Wispr Flow quit as a control (Chrome was already a negative control).
3. **A/B builds (same machine, same harness):**
   - `git worktree add /tmp/fs-pre -b probe-pre <commit>` for `16ccecf`, `5073b10`, `554bedf`, `88637d1`; symlink `fusion-studio-client/node_modules` from the main checkout so builds work; `npm run build` in each worktree and launch its `electron/main.cjs`.
   - working-tree flip build (current checkout).
   - Installed Alpha as an additional packaged control if `_electron.launch({ executablePath })` works, else CDP `--remote-debugging-port` + `chromium.connectOverCDP`; use a **copy** of the Alpha profile, never the live one.
4. **Live recurrence capture (owner window), non-invasive:** if it recurs, relaunch the owner's window with `--remote-debugging-port=9333` and inspect via CDP (JS-level: `PerformanceObserver` longtasks, `Performance` traces, React commit timings). Do NOT use `sample`/`fs_usage` on the live window.

## 7. Backups & isolation facts

- Dev DB backup (pre-wipe, 105 groups / 113 exchanges): `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/data/backups/fusion.db.20260919-074207`
- Alpha DB backup: `~/Library/Application Support/Fusion Studio Alpha/backups/fusion.db.20260919-074207`
- view01 profile DB backup: `~/.fusion-view01-acceptance/backups/fusion.db.20260919-074207`
- Never touch: port 3001, the live Alpha profile, the dev DB while a dev server is attached, unrelated dirty bytes.
- Launch command shape:
  `env FUSION_APP_USER_DATA=<temp-profile> FUSION_LOCAL_MACHINE='RC-MacAir-15' <electron-bin> <checkout>/fusion-studio-client/electron/main.cjs`
  Pre-clean `<temp-profile>/Singleton*` on relaunches.

## 8. Acceptance criteria (owner will verify)

1. A reproducible measurement showing the regression (before vs after builds, same harness, same machine).
2. Root cause identified concretely (not "machine load") and fixed.
3. With a realistic workspace + long transcript: composer keydown→input **p95 in the low single-digit ms**, keydown→paint imperceptible, **zero long tasks >50 ms during typing**, no caret freeze in a 5-minute continuous typing test.
4. Fix verified in the dev checkout; Alpha verification only after explicit owner request (AGENTS.md).

## 9. Constraints & repo rules

- No commit/amend/push without explicit owner request.
- Preserve unrelated dirty/untracked bytes exactly (concurrent wiki session's edits, SPEC-12 work, `state.json` files).
- Product changes go through the established SPEC/orchestrator discipline; this investigation may proceed directly, but a fix that changes product behavior needs the owner's acceptance.
- New Code Standards rule 6 applies to any fix: ship the target; do not preserve the old path.
- Report evidence-first; owner acceptance is explicit.

## 10. Open questions for the owner

1. Which exact Alpha build/day was the last one where typing was fast? (to pin the known-good commit)
2. Does it lag in a brand-new empty chat, or only in chats with history?
3. Does it get worse the longer the app runs?
4. Does it lag while an assistant turn is streaming, during idle, or both?
5. Which views/threads were open when it froze (2026-09-19 ~19:06)?

## 11. Quick-start checklist for the dedicated session

1. Read this brief, then `ai/RC-MacAir-15/Captures/001-Captures/session-handoff-2026-09-18.md` for repo context.
2. Read `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` before touching chat code.
3. Run `e2e/composer-latency-probe.mjs` on the current flip build (sanity numbers).
4. Build the `88637d1` worktree (pre-flip) and the `554bedf`-parent worktree (pre-roadmap); run the same probe; compare.
5. With a realistic workspace copy + restored backup DB, repeat and profile renders/events.
6. Report findings with raw numbers and the delta attribution before proposing the fix.
