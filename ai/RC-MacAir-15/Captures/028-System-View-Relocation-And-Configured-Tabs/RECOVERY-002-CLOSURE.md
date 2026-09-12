# 002 File-Viewer State — Recovery Analysis Closure

**Written:** 2026-09-09
**Resolves:** the single unresolved item of `VIEW-01-RESUME-HANDOFF.md` §5 (owner-byte recovery)
**Outcome:** **EXPLAINED DRIFT + OWNER DECISION (leave as-is)** — no bytes were modified

---

## 1. What was open

`ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json` was the only sentinel file
whose content drifted during the flawed durable smoke (Sep 8, 16:33–16:45 PDT). Current hash
`1d35e2bc…` vs recorded preflight sentinel `f2af19fc…`. No preserved byte copy was known.

## 2. Root cause (fully characterized)

The smoke's second shell hydration rewrote the file's six `activity.tabs[].openedAt` values
to its own hydration time. **Nothing structural changed**: tabs (ids, paths, titles, kind,
extension, tabIndex, order), widths, collapsed, popup, tints, and `activeTabId` are the
owner's authentic content, byte-identical to the owner's live primary-checkout file apart
from the stamp.

Cryptographic proof: substituting the owner's Sep 8 00:20 PDT stamp `1788852044572` into the
drifted file yields hash `b4a1f7de3cbc6b8414cf28387424539420ede4ed8ec59bb912333b563c427a4e` —
byte-identical (`diff` clean) to `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Views/002-file-viewer/state/state.json`.

## 3. Byte-exact reconstruction of the sentinel (verified)

The pre-smoke seed's stamp is `1788819891921` (owner's app write, Sep 7 15:18 PDT).
Substituting it into the current file reproduces **exactly**:

```
f2af19fc0b299925bde592a13befaa6aad6fcf226c7d53b7c78c670fedc79dd4
```

Full lineage (each step hash-verified or session-corroborated):

| Version | openedAt stamp | Meaning | Hash |
|---|---|---|---|
| HEAD `7f0d3c8` | `1788347929753` (Sep 2) | committed baseline, 5 tabs | `46d7b881…` |
| Sep 6 15:09 PDT | `1788732579522` | owner app write (git diff seen in session `rollout-2026-09-06T12-42-58`) | — |
| **Sep 7 15:18 PDT** | **`1788819891921`** | **owner's last pre-delegation write — the pre-smoke sentinel** | **`f2af19fc…`** |
| Sep 8 00:20 PDT | `1788852044572` | owner write to the primary checkout (live tree; primary current) | `b4a1f7de…` |
| Sep 8 16:45 PDT | `1788911106848` | smoke hydration re-stamp (current worktree bytes) | `1d35e2bc…` |

Corroboration of `1788819891921` as the live worktree stamp: sessions
`rollout-2026-09-07T16-05-45`, `rollout-2026-09-08T06-26-48`, and
`rollout-2026-09-08T09-20-32` (last sighting 16:23:51Z = 09:23 PDT Sep 8, ~13 minutes before
the smoke launched) all show it as the 002 stamp in the worktree tree.

## 4. Search record (why no byte copy exists)

- Session logs (Sep 1–8, all rollouts): contain the 002 *hash* ≥57 times; the file's
  *content* was catted only post-drift (smoke session L451, 23:46Z Sep 8). No pre-smoke
  content capture exists.
- Worktrees (2512/2b4e/3659/77ae/9572), primary checkout, `/var/folders` tmp: exhaustive
  hash search (smoke session L444–445) found no `f2af19fc` copy; re-confirmed today.
- Shared Electron dev profile `~/Library/Application Support/Fusion Studio`: `Local Storage`
  leveldb was recreated at 16:35–16:36 Sep 8 by the smoke launch (49-byte fresh journal) —
  renderer-persisted history destroyed before analysis began.
- APFS snapshots: only `com.apple.os.update-*` snapshots exist (no hourly/Time Machine
  destinations configured); none fall in the Sep 7 23:49 → Sep 8 16:33 window.
- The smoke run dir `/var/folders/…/fusion-view01-public-shell-M9iRl5/` contains only the
  isolated Electron profile; no sentinel byte stash.

## 5. Owner decision

On 2026-09-09 RC chose **leave as-is (explained drift)**: the current worktree bytes
(`1d35e2bc…`) stand; the drift is documented here; no restoration write is performed.

**Standing consequence for verification:** future sentinel checks must expect
`1d35e2bc…` for this file (pre-smoke `f2af19fc…` remains reconstructable via the
6-value substitution documented in §3 if ever needed).

## 6. Related hazard dispositions (from handoff §4)

- Smoke Electron PID 41224 + server child 41231: quit 2026-09-09 (path-verified worktree dev
  instance, not Alpha). No quit-time state flush changed any sentinel (all re-hashed
  post-quit).
- Orphaned `state.json.1788910686550.xot6367yyc.tmp`: preserved; byte-identical (`e53c55f8…`)
  to `System/state/state.json`; a leftover atomic write, not drift. The 002 closure removes
  the reason it was held as evidence; it may be cleaned up with the smoke run dirs at
  owner's convenience (recommend keeping until VIEW-01 acceptance).
- All other sentinels re-verified post-quit 2026-09-09: all match preflight exactly
  (`9ca40dea…`, `c8301be2…`, `e53c55f8…`, `6a99fd03…`, `24cc4db2…`, `20a26f99…`,
  022 `DECISIONS.md` `64f6993d…`).

---

## 7. Addendum (2026-09-09, later): second drift incident + root cause

During the redesigned durable smoke's first iterations, the file drifted **again**, same
shape: all six `openedAt` bulk-stamped `1788997507994` (Sep 9 16:45:07 PDT), everything else
byte-identical (substituting back reproduces `1d35e2bc…` exactly). Current hash:
`b2acb1ab97499bb78dff5be0ae2119fa107eb132520ed77d9e86a4861d812898`. All other sentinels
unchanged. Standing owner decision (leave as-is, explained drift) applies.

### Root cause (explains BOTH incidents)

Server migration `009_workspace_registry` **unconditionally seeds a development workspace**
(`id: fs-dev`) whose `repo_path` is resolved from the server's own location, plus
`system_config.last_active_workspace_id = 'fs-dev'`, whenever it applies to a fresh
database. Consequence: **any fresh-profile launch of a checkout's server registers,
auto-activates, and hydrates that checkout's live tree.** The Sep 8 "isolation flaw" and
today's incident are the same mechanism — isolated Electron profiles were never actually
isolating the live tree, because the registry bootstrap re-attached it on first run.

Secondary trigger today: the smoke fixture root was deleted mid-run by an unexplained
external actor (~16:44 PDT; not the smoke, not product code — no product path deletes user
data; evidence: whole-root deletion while the app was closed, then Electron recreated the
userData). The profile loss re-ran the migration bootstrap on a fresh DB, re-attaching the
real tree. The deletion itself remains unexplained; the smoke is now immune to it by
construction.

### Hardened smoke isolation contract

`fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs` now:

1. Pre-applies all server migrations against the isolated profile DB **before any launch**,
   then deletes the `fs-dev` row and the `last_active_workspace_id` seed — the server can
   never perform the dev-workspace bootstrap.
2. Keeps the profile in `os.tmpdir()` (outside the fixture root) so fixture loss cannot take
   the registry with it.
3. Before every launch asserts the registry DB exists and contains **no** workspace whose
   `repo_path` resolves to the repository root (abort-before-launch if violated).
4. In `finally`, byte-asserts the 8 sentinel files, retired-root absence, and canonical
   root inode identity — the backstop that caught both incidents.

### Discovered product risk (owner decision, no code changed)

The migration-009 dev-workspace seed is a test-isolation and multi-checkout hazard for any
fresh-profile run of worktree code. Recorded for the owner; possible future follow-up (e.g.
gating the seed) is out of VIEW-01 scope.
