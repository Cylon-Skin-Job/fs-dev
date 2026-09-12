# VIEW-01 Resume Handoff — Candidate VIEW-PLATFORM-15c57f9457d64a13

**Written:** 2026-09-08 (after Codex credit exhaustion mid-Slice-5)
**Candidate:** `VIEW-PLATFORM-15c57f9457d64a13`
**SPEC:** `SPEC-01-SYSTEM-VIEW-RELOCATION.md` (this bundle)
**Status:** Implementation complete and twice independently reviewed **CLEAN**. Slice 5 (restart/public-shell acceptance) was in progress when the session died. **Owner acceptance has NOT happened. VIEW-02 remains unauthorized.**

---

## 1. Where the work lives

**All VIEW-01 implementation bytes are uncommitted in the Codex worktree:**

```
/Users/rccurtrightjr./.codex/worktrees/9572/fs-dev
```

- Detached HEAD at `7f0d3c8` (`docs: accept trusted shell authority implementation` — the accepted prerequisite baseline).
- **157 modified + 48 deleted + 47 untracked files** (205 tracked files changed; +5,326 / −7,407 lines). The deletions are part of the candidate (the "content/deletion digest" in §2 covers them). This dirty tree IS the candidate. Do not commit, revert, normalize, or "clean" it.
- Registered under the primary checkout `/Users/rccurtrightjr./projects/fs-dev` (`git worktree list` shows it). The primary checkout is on branch `agent/exact-workspace-paths` at the same `7f0d3c8` and does **not** contain the VIEW-01 work.
- The worktree's own `AGENTS.md` applies. Repo AGENTS.md rules: preserve dirty/user bytes, narrowest verification, never touch the Alpha installation.

### New (untracked) implementation modules — the shape of the work

Server (`fusion-studio-server/`):
- `lib/db/migrations/038_view_capsule_relocation_journal.js`
- `lib/db/migrations/039_system_wiki_canonical_view_path.js`
- `lib/views/`: `protected-path-policy.js`, `readiness-coordinator.js`, `readiness-runtime.js`, `readiness-startup.js`, `relocation-content-roots.js`, `relocation-errors.js`, `relocation-identity.js`, `relocation-inventory.js`, `relocation-journal.js`, `relocation-service.js`, `simple-yaml.js`, `view-capsules-projection.js`, `view-id.js`
- `lib/workspace/electron-binding-channel.js`
- `lib/ws/trusted-shell-authority.js`
- Tests: `test/views/*` (journal, preflight, recovery, fixtures, identity/projection, readiness), `test/ws/protected-view-*`, `test/ws/trusted-shell-authority.test.js`, `test/workspace/{electron-binding-channel,protected-cli-config-write,view-root-owner}.test.js`, `test/theme/protected-theme-writes.test.js`, `test/screenshot-protected-view-path.test.js`, `test/http/view-config-route.test.js`, `test/fusion/`, `test/watcher/`

Electron/renderer (`fusion-studio-client/`):
- `electron/`: `view-capsule-registry.cjs(+test)`, `server-workspace-binding.cjs(+test)`, `protocol-handler.test.cjs`
- `src/lib/view-capsule-projection.ts`
- `e2e/view-capsule-projection.spec.ts` (51 KB, green per reviewers)
- `e2e/view-capsule-public-shell-smoke.mjs` — **the flawed Slice 5 smoke, mid-redesign (see §5)**

Workspace content (untracked, in-worktree):
- `ai/RC-MacAir-15/System/Views/` — the relocated canonical live tree
- `ai/RC-MacAir-15/Captures/028-System-View-Relocation-And-Configured-Tabs/` — in-worktree copy of this bundle

`restart-fusion.sh` was **repaired during Slice 5** to be worktree-aware (`--repo`/`--machine`); the checked-in version previously hardcoded the primary checkout and would have tested the wrong bytes. That repair is part of the candidate.

---

## 2. Candidate authentication (reproduce before trusting anything)

Planning fingerprint (run in this bundle directory; see `RELEASE-MANIFEST.md` for the exact script):

```
expected aggregate: 15c57f9457d64a13c177d58fe96e3bf665fa36881b443292363261a438f67e4b
```

Frozen candidate digests (recorded by independent review at 2026-09-08 ~16:24, against the worktree dirty tree):

```
HEAD:                  7f0d3c862845609bada9605607c506c99363fcb0
planning fingerprint:  15c57f9457d64a13c177d58fe96e3bf665fa36881b443292363261a438f67e4b
305-path digest:       c3cfc4fa837e8dd7e6a70b816ccca5d3ca270c08d6656acd91adf3a27f31d3cd
content/deletion digest: 5f42076fa82d2761ca7f4acb0e7cb15835ed33592a9082d620729ae521a18170
```

⚠️ The reviewers' path lists and content manifests were written to `/private/tmp/view01-candidate-*` (e.g. `view01-candidate-paths-final.txt`, `view01-candidate-content-manifest-final.txt`, `view01-candidate-*-review22/23.txt`). **/tmp is ephemeral — re-derive from the worktree if these are gone; the digests above are the durable record.**

⚠️ Re-deriving the 305-path / content-deletion digests **now will not reproduce** `c3cfc4fa…` / `5f42076f…`: the worktree legitimately changed after the candidates were frozen at ~16:33 (the `restart-fusion.sh` repair and the smoke-window state drift in §5). A mismatch is expected; interpret it through §5, not as candidate corruption. The derivation method (tracked diff + untracked listing, byte-sorted, `DELETED` markers) is visible in the smoke session's tool-call trail.

---

## 3. What is verified done

Slices 1–4 complete; Slice 5 partially complete. Two fresh independent reviewers both returned **CLEAN, no material findings** (sessions `rollout-2026-09-08T16-18-47-…` and `rollout-2026-09-08T16-24-12-…` under `~/.codex/sessions/2026/09/08/`):

- fd4 once-only fail-closed ownership, revision/WS-fd4 reorder and ABA handling, serialized init, stale-authority retirement, recipient-specific fanout, canonical path ownership, verified-journal retry preservation, protected mutation boundaries, VIEW-02 exclusion.
- Tests at review time — **reviewer 2** (`16-24-12`): Electron 34/34; focused server 177/177; renderer projection 16/16; full server 194/194 suites (2,794 passed, 1 skipped); `git diff --check` clean. **Reviewer 1** (`16-18-47`) independently ran a narrower set: Electron 30/30, renderer 16/16, focused server 128/128.
- Live relocation evidence: retired root `ai/RC-MacAir-15/Views` absent; canonical `System/Views` present with device/inode `16777230/223010736`; migrations 038/039 applied; journal row `verified` with no error; inventory digest agrees.
- Known residual risk (by design, honest limitation): direct unsandboxed host filesystem writes remain outside VIEW-01's enforcement boundary.

Slice 5 progress before the cutoff (smoke subagent session `rollout-2026-09-08T16-33-04-…`):

- Restart preflight clean: six preserved sentinels matched their recorded bytes (the seventh entry was a file-substitution artifact, not drift — see §5).
- Worktree-aware rebuild/restart succeeded: Electron PID `41224`, server `http://localhost:51847`, correct worktree + machine identity (`RC-MacAir-15`), dev profile (not Alpha).
- Isolated public-shell probe passed on the real production Electron path: created a canonical workspace through the native shell, added Browser + Custom via the view rail, loaded a real `fusion-studio://` app and a secondary asset, preserved runtime generation across a reorder that changed the capsule basename.

---

## 4. ⚠️ Live hazards to secure FIRST

1. **The smoke Electron is still running.** PID `41224` (pidfile `/private/tmp/fusion-electron.pid`), up since 16:35 PDT, running **worktree** code (`9572/fs-dev`) with the **normal dev profile** (`~/Library/Application Support/Fusion Studio`), server child PID `41231` on port 51847. It has the live workspace attached and **can keep mutating owner state bytes**. Quit it before doing recovery analysis or any new smoke (confirm the process path before killing; do not touch any Alpha process).
2. **Orphaned atomic-write temp file** in the live tree:
   `ai/RC-MacAir-15/System/state/state.json.1788910686550.xot6367yyc.tmp` (790 bytes, mtime 16:38) next to `state.json` (790 bytes, mtime 16:45). **Resolved:** it is byte-identical (`e53c55f8…`) to the current `state.json` and the preflight sentinel — a leftover atomic write, not drift. Preserve it as evidence until the 002 question (§5) closes.
3. **Smoke run dir:** `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-view01-public-shell-M9iRl5/` (isolated profile only). Also present: `fusion-view01-live-db-{9WqjwX,aVrmZk}`, `fusion-view01-slice3-smoke-9DJBWO`. Ephemeral (tmp) — copy out anything needed before reboot.

---

## 5. Exactly where it stopped — the owner-byte recovery (INCOMPLETE)

The durable smoke had an **isolation flaw in the test setup, not the product**: launching a second shell against the live seeded workspace persisted layout widths into the live tree. The agent stopped that path and began recovering exact pre-smoke owner bytes. Credits died during this analysis. **Product behavior was expected; the smoke must be redesigned so its isolated profile never registers the live workspace.**

### Sentinel set (7 files, worktree-relative)

```
ai/RC-MacAir-15/Captures/022-Vision_Roadmap/CAPTURE.md
ai/RC-MacAir-15/Captures/028-System-View-Relocation-And-Configured-Tabs/DECISIONS.md
ai/RC-MacAir-15/System/state/state.json
ai/RC-MacAir-15/System/styles/themes.css
ai/RC-MacAir-15/System/styles/themes.json
ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json
ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json
```

(The agent hashed these with `shasum -a 256`; rerun that loop to get current values.)

### Sentinel hashes recorded at Slice 5 preflight (~16:33, before the flawed smoke)

```text
9ca40dea1b931cd23d1c46a9efe8a2488561a3439c991ca692a29b6848d20636  ai/RC-MacAir-15/Captures/022-Vision_Roadmap/CAPTURE.md
c8301be2a931ad8689c0e96f1b38943b30e8b778292ed7800a85d3cc8423484c  ai/RC-MacAir-15/Captures/028-System-View-Relocation-And-Configured-Tabs/DECISIONS.md
e53c55f811496431efd4c521e7c9851fbf8a947e792e3bc33925f1f9f882170e  ai/RC-MacAir-15/System/state/state.json
6a99fd03f9b5bf4ad4d4b2d93f428680ace15e2817c9e62738816bab7edcf92f  ai/RC-MacAir-15/System/styles/themes.css
24cc4db29ea2a036914931dcf0b919659efe90117b75285aec9a089271cd458f  ai/RC-MacAir-15/System/styles/themes.json
20a26f991940386ac16aa6c3c6c2a02469faa669f9c23a3081493da49be1f98d  ai/RC-MacAir-15/System/Views/001-capture-viewer/state/state.json
f2af19fc0b299925bde592a13befaa6aad6fcf226c7d53b7c78c670fedc79dd4  ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json
```

Also recorded at preflight: `retired-root: absent`; canonical root `device=16777230 inode=223010736`; `fusion-studio-server/data/fusion.db` hash `0d079f1d5a6a08feb356b6f507b2ca6654424571e367bfd8263c60676155be6b`.

**Important — there is NO pre-existing DECISIONS.md drift.** The smoke agent's message 4 claimed "the bundle DECISIONS.md already differs from the earlier sentinel" — that was a **file-substitution artifact**, not drift. The earlier sentinel (recorded repeatedly by the Sep 7–8 parent orchestrator session, `rollout-2026-09-07T23-49-03-01a07fc7-…`) tracked `ai/RC-MacAir-15/Captures/022-Vision_Roadmap/DECISIONS.md` at `64f6993d69a101fa834d60183a0bef672ce3339a7965e3e2173bf7a1e9600bac` — a different file, still unchanged. The smoke preflight swapped in the 028 bundle's DECISIONS.md (`c8301be2…`, which matches the authenticated 305-path baseline) and compared across the two different files. Both files are intact; preserve both sets of current bytes. (The earlier 022 sentinel set, for the record: `022-Vision_Roadmap/CAPTURE.md`, **022** `DECISIONS.md`, `System/state/state.json`, `themes.css`, `themes.json`, and the 001/002 view state files — the latter two recorded at the old retired `ai/RC-MacAir-15/Views/…` paths, pre-relocation, with the same hashes as the smoke preflight's canonical-path entries. The smoke preflight simply re-pointed the Views entries at the new `System/Views/…` paths and swapped DECISIONS.md to the 028 bundle copy.)

**Re-verified 2026-09-08 ~18:30:** every sentinel file **except** `002-file-viewer/state/state.json` still matches its recorded preflight hash exactly — including `System/state/state.json` (`e53c55f8…`, unchanged despite its 16:45 mtime). The only genuine content drift in the sentinel set is the 002 file.

### Known drift facts at cutoff

- Files in the live tree touched after 16:20 PDT (smoke window): `System/config/cli.json`, `System/state/state.json` (+ the orphaned `.tmp`), `System/styles/themes.css`, `System/Views/002-file-viewer/state/state.json`. Of these, only the 002 file actually drifted in content — `state.json` and `themes.css` were rewritten with unchanged bytes (hashes still match preflight); verify `cli.json` separately when resuming.
- `002-file-viewer/state/state.json`: current hash `1d35e2bca77d4dc87977e4adf5b37f910e93bddfeb22ced4b27393c1a567925c` (2,727 bytes). Expected/sentinel hash was `f2af19fc0b299925bde592a13befaa6aad6fcf226c7d53b7c78c670fedc79dd4` — **no preserved copy with that hash was found** in the worktrees, primary checkout, or tmp before the cutoff.
- The agent tested a timestamp-only-drift theory: substituting `openedAt` `1788911106848`→`1788911005577` (6 occurrences) yields hash `e2d60b06402c9722abec2d1ddca88da5ccfa67dd98f5e77083cbe1442b870e05` ≠ expected. **So the drift is more than timestamps and was still unresolved.** The current file's tab list (visible in session logs) includes `restart-fusion.sh`, `fusion-studio-server/AGENTS.md`, a Wiki PAGE.md, `background-services.log`, `MESSAGE_ID_AUDIT_SPEC.md` with `openedAt: 1788911106848`.
- The orphaned `.tmp` is now explained: it is byte-identical (`e53c55f8…`) to both current `System/state/state.json` and the preflight sentinel — a leftover atomic write with no content change. Keep it as evidence until the 002 question closes, but it is not drift.

### Recovery leads not yet exhausted

- The sentinel provenance record: parent orchestrator session `~/.codex/sessions/2026/09/07/rollout-2026-09-07T23-49-03-01a07fc7-009c-7781-b429-3067f63eb4f7.jsonl` — it recorded the pre-Slice-5 sentinel hashes at least five times (Sep 7 23:49 start; re-verified through Sep 8) and is the authority for what "matched" meant.
- `state.json.bak` in `System/state/` (600 bytes, Sep 7 — predates the smoke; likely the owner's own backup, not the sentinel copy).
- Full session logs of the smoke agent (`rollout-2026-09-08T16-33-04-…`) contain the complete command/output trail, including every hash it computed. No session captured the pre-smoke 002 `state.json` bytes — the exhaustive search across worktrees, primary checkout, and tmp found no copy matching `f2af19fc…`.

---

## 6. Remaining work to finish VIEW-01 (in order)

1. **Secure hazards** (§4): quit smoke Electron 41224; preserve the `.tmp` and smoke run dirs.
2. **Complete the owner-byte recovery analysis** (§5): restore or account for every sentinel byte; document the outcome honestly in the report (restored / explained drift / owner decision).
3. **Redesign the durable restart/readback smoke** so the isolated profile never registers the live workspace (current flawed draft: `fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs`, mtime 16:45). The passing interactive probe sequence is assistant message 7 of session `16-33-04` (messages 5–6 cover the restart and identity/journal verification that precede it) — that is the behavioral template.
4. **Finish the SPEC §9 Slice 5 matrix:**
   - Restart against old-only, new-only, recovered, conflict, and live workspaces.
   - Open every built-in view; save view state; reorder/hide/restore/add; verify restart readback from the canonical root.
   - Custom `app/index.html` fixture through `fusion-studio://` before/after relocation, restart, and workspace switch; stale maps, forged IDs/folders, symlinks, traversal stay unavailable.
   - Reorder/add the custom-app fixture through the public shell and load its next asset immediately without reconnecting; all bound clients receive and Electron installs the new basename mapping before refreshed interaction.
   - Post-verification legitimate mutations (state save, add/reorder/rename/hide/restore + restart each) must not be rejected by the historical cutover digest.
5. **Full regression:** server `npm test`, client `npm run build`, stale-path scan, Electron smoke (last green full matrix is recorded in §3 — re-run after smoke redesign).
6. **Write the durable VIEW-01 implementation/orchestrator report into this bundle**, including: exact commits/fingerprint, migrations, tests, recovery evidence, dirty-byte preservation, deviations, risks, and plain-English visual/smoke checks for the owner.
7. **Hand the report to RC for explicit acceptance.** Do not accept on the owner's behalf. Do not start VIEW-02, BRIDGE-01/02, Chat, Side Chat, prompts, collections, plug-ins, or dynamic component registration.

---

## 7. Key session references (Codex rollouts, `~/.codex/sessions/2026/09/08/`)

| File prefix | Role |
|---|---|
| `rollout-2026-09-07T23-49-03-01a07fc7-…` (Sep 7, in `…/09/07/`) | Parent orchestrator — the run's root thread; recorded the pre-Slice-5 sentinel hashes (sentinel provenance for §5) |
| `rollout-2026-09-08T16-18-47-01a08351-…` | Independent review #1 — CLEAN |
| `rollout-2026-09-08T16-24-12-01a08356-…` | Independent review #2 — CLEAN (digests in §2) |
| `rollout-2026-09-08T16-33-04-01a0835e-…` | Slice 5 smoke agent — full command/output trail, 8 status messages |
| `rollout-2026-09-08T16-46-51-01a0836a-…` | "Continue please" retry — zero output, credit exhaustion point |

The original delegation prompt (VIEW-01 implementation contract, constraints, and stop conditions) is embedded in these sessions; the normative contract is `SPEC-01` + `DECISIONS.md` + `GUIDANCE.md` + `CODE-INVENTORY.md` in this bundle.
