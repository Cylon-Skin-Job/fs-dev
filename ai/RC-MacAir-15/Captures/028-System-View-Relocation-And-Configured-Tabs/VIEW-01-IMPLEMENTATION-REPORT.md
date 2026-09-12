# VIEW-01 Implementation Report — System View Capsule Relocation

**Candidate:** `VIEW-PLATFORM-15c57f9457d64a13`
**Baseline:** detached HEAD `7f0d3c862845609bada9605607c506c99363fcb0` (worktree
`/Users/rccurtrightjr./.codex/worktrees/9572/fs-dev`)
**Report date:** 2026-09-09
**Status:** Implementation, independent review, Slice 5 completion, and full regression
complete. **Awaiting owner acceptance. VIEW-02 remains unauthorized.**

---

## 1. Identity and prerequisite evidence

- Planning candidate fingerprint (7 ordered bundle files, command in
  `RELEASE-MANIFEST.md`): `15c57f9457d64a13…f67e4b` — reproduced at resume.
- Candidate bytes: uncommitted dirty tree at `7f0d3c8` — 252 entries
  (157 modified + 48 deleted + 47 untracked), matching the twice-reviewed frozen candidate
  (reviewer digests, 2026-09-08 ~16:24: 305-path `c3cfc4fa…`, content/deletion
  `5f42076f…`; derivation method recorded in the review sessions).
- Prerequisites authenticated by the independent reviewers via the exact reconstruction
  commands in `RELEASE-MANIFEST.md`: trusted Fusion shell (`1baaffa`/`7f0d3c8`,
  195-path manifest `f77820d4…`), PROV-01 (`d31fc8a`, 275 paths, `b10150cd…`),
  TABS-03 (`22cc435`/`2748f03`, `59d6e036…`).

## 2. What shipped (shape)

Server: canonical path owner + strict identity (`lib/views/view-id.js`,
`relocation-identity.js`), protected-path policy, readiness coordinator/runtime/startup,
relocation inventory/journal/service/content-roots/errors, view-capsules projection,
simple YAML frontmatter parser, trusted-shell WS authority, Electron binding channel,
migrations `038_view_capsule_relocation_journal` (composite-PK journal with CHECK-constrained
statuses/identities/digest/timestamps) and `039_system_wiki_canonical_view_path`.
Electron/renderer: `view-capsule-registry.cjs` (+tests), `server-workspace-binding.cjs`
(+tests), protocol-handler tests, `src/lib/view-capsule-projection.ts`, the projection e2e
suite, and the durable public-shell smoke (rewritten 2026-09-09, §5).
Workspace content: relocated canonical live tree `ai/RC-MacAir-15/System/Views/`
(retired root absent; canonical root device/inode `16777230/223010736`), repaired
worktree-aware `restart-fusion.sh`.

## 3. Independent review

Two fresh reviewers returned **CLEAN, no material findings** (sessions
`rollout-2026-09-08T16-18-47` and `16-24-12`): full server 194/194 suites
(2,794 passed, 1 skipped), Electron 34/34 (later 76/76), renderer projection 16/16,
`git diff --check` clean, live relocation evidence verified (journal `verified`, no error,
inventory digest agreement).

## 4. Hazards and owner-byte recovery (closed 2026-09-09)

- Stray smoke Electron (PID 41224, worktree code, dev profile) and server child quit;
  path-verified, not Alpha. No quit-time sentinel changes.
- `002-file-viewer/state/state.json`: both drift incidents fully characterized and closed
  as **explained drift + owner decision (leave as-is)** — full ledger, byte-exact
  reconstruction recipe, root cause (migration-009 dev-workspace seed), and the hardened
  isolation contract are in `RECOVERY-002-CLOSURE.md` §1–§7.
- All other sentinels byte-exact throughout: `9ca40dea…` (022 CAPTURE), `64f6993d…`
  (022 DECISIONS), `c8301be2…` (028 DECISIONS), `e53c55f8…` (System state),
  `6a99fd03…`/`24cc4db2…` (themes), `20a26f99…` (001 state). Retired root absent;
  canonical root inode stable across all runs. Orphaned atomic-write `.tmp` preserved
  (byte-identical to `state.json`).

## 5. Slice 5 — durable restart/public-shell acceptance (2026-09-09)

`fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs` — **passed twice
consecutively** (`VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`). Isolation contract: isolated
profile pre-migrated with seed rows stripped (server can never bootstrap the dev
workspace), profile outside the fixture root, per-launch registry guard, `finally`
byte-assertions over the 8 sentinel files + retired-root absence + canonical inode.

Legs vs SPEC §9: (A) new-only adoption, five adds, restart readback, every-view walk,
custom app through `fusion-studio://` with rename/map refresh/next-asset without
reconnect, state save, reorder with stable runtime generation, hide/restore with restart
readback; (B) duplicate shell window **denied** trusted authority (single committed frame
by design) with in-shell fanout proven; (C) forged view-id and encoded traversal
unavailable (postMessage availability probe with positive control); (D) workspace switch
clears the custom-app map and switching back rebuilds it; (E) old-only workspace migrated
through the public shell (custom-app fixture built pre-relocation, loads from canonical
after) with restart readback; (F) destination-only `planned` journal (digest recomputed
with the product inventory module) resumes `planned→moved→verified` on restart;
(G) old+new conflict stays bounded — zero view buttons, protocol unavailable, workspace
still switchable; (H) live-shaped byte copy adopts `verified`, renders the live view set,
restarts, and final journal statuses remain `verified` for all fixtures (legitimate
post-verification mutations never rejected by the historical cutover digest).

### Deviations (compatible, with justification)

1. Multi-client fanout is asserted as duplicate-shell **denial** + in-shell no-reconnect
   refresh; the multi-client projection matrix is the green `view-capsule-projection`
   suite. The public shell commits exactly one frame (`runtime-ipc.cjs`), so a second
   authorized public window is not a supported configuration.
2. "Custom app before relocation" is exercised as a pre-relocation-built fixture loading
   from the canonical root after migration — the product has no old-root serving state by
   design.
3. The recovered-restart leg simulates the post-rename crash point by rewriting the
   fixture journal row to `planned` with a product-computed current-tree digest (crash
   boundaries are additionally covered deterministically by the Slice 3 crash-injection
   fixtures).
4. Two environmental incidents during smoke bring-up (real-tree hydration via the
   migration-009 seed; unexplained external deletion of the fixture root) — both
   mitigated by construction; 002 impact recorded in the closure ledger.

## 6. Full regression (2026-09-09, this machine)

| Command | Result |
|---|---|
| `npx jest --maxWorkers=2` (server, full) | **194/194 suites, 2,794 passed, 1 skipped** |
| `npm test` (server, default workers) | 1–2 load-sensitive timing flakes (`event-registry/startup-integration`, `resources/file-provenance-integration`) — each passes 10/10 and 1/1 in isolation; environmental, not candidate defects |
| `npm run build` (client) | pass, 12.13 s |
| `node e2e/view-capsule-public-shell-smoke.mjs` | `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK` ×2 |
| Stale-path scan (`'Views'` construction across server/client) | clean — only the canonical owner, migration-only resolver, protected-path policy, and immutable historical migration text (superseded by 039) |
| Sentinel byte assertions | all pass (§4) |

## 7. Post-implementation fingerprint (reproduce)

From the bundle directory: run the `RELEASE-MANIFEST.md` fingerprint command — expect
`15c57f9457d64a13…f67e4b`. From the worktree root: `git rev-parse HEAD` → `7f0d3c8…`;
`git status --porcelain | wc -l` → 252 plus this session's bundle additions
(`RECOVERY-002-CLOSURE.md`, this report, the rewritten smoke, and the in-worktree bundle
copy). Frozen review digests remain the candidate authority; post-review session artifacts
are coordination evidence, not candidate bytes.

## 8. Residual risks and scope statements

- Direct unsandboxed host filesystem writes remain outside VIEW-01's enforcement boundary
  (by design; honest limitation).
- Migration `009` unconditionally seeds the development workspace into every fresh
  profile database — a test-isolation and multi-checkout hazard documented in
  `RECOVERY-002-CLOSURE.md` §7; any gating change is an owner decision outside this SPEC.
- The ~16:44 PDT 2026-09-09 external deletion of the smoke fixture root is unexplained;
  the smoke is now immune by construction. No product path deletes user data.
- Server timing suites can flake under full parallel worker load on this machine.

## 9. Acceptance

**ACCEPTED — 2026-09-09 (PDT).** Owner statement: "We're looking good." following the
visual walk (live Electron window on the worktree, real relocated workspace attached via
fresh-profile launch; rail/Views verified from `System/Views`; owner exercised add/reorder
— nine capsules at acceptance; clean restart with byte-exact readback: identical folder
order, `System/state/state.json` unchanged (`8504523d…`), retired root absent; server
HTTP 200 both sessions). VIEW-02 is now authorized for dispatch through a fresh
orchestrator per `RELEASE-MANIFEST.md` gate 4. BRIDGE-01 remains blocked until VIEW-02
acceptance and explicit owner release of the view-platform milestone.

Plain-English launch recipe used (reproducible): from the worktree client directory —
`env FUSION_APP_USER_DATA=<fresh dir> FUSION_LOCAL_MACHINE=RC-MacAir-15
./node_modules/.bin/electron electron/main.cjs`; browser mirror of the shell at
`http://localhost:<server.port>/` (profile `server.port` file; degraded without the
trusted Electron bridge).
