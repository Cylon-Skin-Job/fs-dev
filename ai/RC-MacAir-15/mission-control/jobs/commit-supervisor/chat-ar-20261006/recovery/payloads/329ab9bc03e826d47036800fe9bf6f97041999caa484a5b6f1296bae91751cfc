# Machine Sync & Doc Sharing Model

Status: CAPTURE — design conversation output, no implementation scheduled
Captured: 2026-07-13

## The Idea

Share workspace data between machines and coworkers, and host real-time collaborative docs, using the architecture fs-dev is already building — without inventing a parallel sync pipeline.

Three distinct features fell out of the conversation, each with a different critical path:

| Feature | Depends on | Available |
|---|---|---|
| Git namespace sharing | Nothing | Now |
| Real-time doc hosting | SPEC-01 editor step machinery accepted | After editor roadmap |
| Offline sync + fork-on-conflict | Provenance/UEB refactor + SPEC-33 versioning | After provenance roadmap |

## 1. Git Namespace Sharing (zero infrastructure)

- Each person's data lives under their own machine namespace (e.g. `ai/RC-MacAir-15/`). Un-gitignore a **shared subtree** and push to a common GitHub repo; coworkers do the same.
- Because each person writes only inside their own namespace, git merges are trivially clean by construction — partition ownership means conflicts cannot occur.
- Caution: do NOT share the whole `ai/` tree (chat threads, System state, settings). Visibility is a per-subtree choice — track a `shared/` subtree, keep the rest ignored.
- Sync latency = commit/pull cadence. Fine for "read each other's docs," wrong for anything live.

## 2. Real-Time Doc Hosting (hub model)

- One designated **always-on server** hosts a shared doc; others edit live. Laptop-as-host is explicitly a non-goal (lid closes, host vanishes).
- This is the hub/sequencer model — `prosemirror-collab` is the reference implementation: clients send steps to a central authority, authority assigns version numbers, stale clients rebase and resend.
- The invertible-step machinery from the Office table editor work (SPEC-01) is the substrate: the wire protocol is "the steps we already have, plus a version counter."
- While connected to the host there is **no offline divergence** — real-time mode never produces conflict copies. Conflicts exist only at the reconnect boundary, where the fork rule (below) takes over.
- Tailscale handles networking: device identity is established once at tailnet join, so "everyone already has a token" and future shares are instant (right-click → share → server flips a bit).
- Provenance is NOT a prerequisite for this feature — it can observe collab sessions later, but the dependency is editor-side only.

## 3. Offline Sync + Fork-on-Conflict (the Dropbox answer)

**Owner decision captured:** offline edits to a shared doc **always fork, never merge**. Merging is a future, separate feature gated on ancestor snapshots and block identity.

- Fork rule: if a reconnecting device's last-synced version of a file is behind the server's current version AND content differs → do not merge. Mutate the filename on the offline editor's machine (`... (copy)`), pull down the original. The owner/server side keeps the original name.
- This is the proven Dropbox/Syncthing/OneDrive model: mildly annoying UX, zero silent data loss.
- Single-user across own devices: offline editing is a non-issue until a doc is shared to a second person.

### Fork detection mechanics

- **Server-assigned monotonic sequence numbers per file, never wall-clock times.** Clock skew makes timestamp ordering silently wrong; a single hub server makes integer sequence numbers exact and trivial. Timestamps are display metadata only, never ordering authority.
- Fork triggers when: `device.lastSyncedSeq < server.currentSeq` AND content hashes differ.
- Detection needs only: version ID per rewrite + content hash + per-device last-synced version ID. **No diffs required.** Diffs are for humans (view/restore) and for eventual block-level merge — later, separate.
- SPEC-33's proposed first live versioning branch is intended to provide the required metadata/hash identity near the front of the versioning work, but it cannot ship until ULV-D03/D05/D10/D12 close. Resource-event hashes remain prohibited under the first resource package; whether and how file-version hashes use a separate approved policy remains an explicit owner decision in [provenance schema finding 5](../008-Provenance-Temp/provenance-schema-findings.md), as reinforced by owner direction in chat on 2026-07-15.

### Future block-level merge (explicitly deferred)

"Fork only if the same block was touched" implies auto-merging different-block edits — a real three-way merge requiring:

1. **A stored common ancestor** — the version both sides last agreed on (per-device last-synced snapshot/version ID).
2. **Stable block identity** — "same paragraph" must survive moves/splits/retypes. Same problem family as `officeTableIdentity` fingerprinting.

Ship file-level fork-on-conflict first; add block merge only if `(copy)` noise proves annoying in practice.

## Architecture Fit (why this waits, and why it's cheap later)

- The sync shipper is a **subscriber on the canonical event bus** — the seam SPEC-32/40 is building. A remote machine is architecturally just one more subscriber.
- BUT: UEB is fail-open by design (skipped listeners, omitted events are allowed). Sync needs fail-closed completeness. The shipper therefore drains a **transactional outbox** (DB write + "to ship" row commit in the same SQLite transaction), not the live bus. The bus stays observational; the outbox provides the durability the bus deliberately doesn't promise.
- Honest provenance attribution helps explain and diagnose remote changes, but it cannot be the sync-loop correctness guard because provenance may be omitted or unavailable. The transactional outbox needs a separate fail-closed, idempotent remote-operation/source identity contract before implementation; see provenance schema finding 9.
- `resource:invalidate` generalizes to remote clients staying fresh: targeted invalidation + fetch-on-demand, same contract as local renderers.
- Multi-master merge (CRDTs, cr-sqlite, LWW) is the option to avoid until forced. If ever needed, adopt cr-sqlite; do not hand-roll.

## Conflict-Handling Options Ladder (for reference)

1. **Never conflict structurally** — partition ownership per namespace (feature 1; already how the data is laid out).
2. **One sequencer** — all writes submitted to one hub that orders them; conflicts become preflight rejections at submit time (feature 2; the editor's preflight-verify pattern promoted to distributed scale).
3. **Fork on conflict** — Dropbox model at the offline boundary (feature 3).
4. **True multi-master merge** — research-grade; deferred indefinitely.

## Sequencing Summary

1. **Now:** git `shared/` subtree convention — a `.gitignore` decision, this week if wanted.
2. **After SPEC-01 accepted:** real-time hosting via prosemirror-collab-style hub on the always-on server + Tailscale.
3. **After provenance/UEB refactor + SPEC-33 hash-only slice:** offline sync with fork-on-conflict via transactional outbox.
4. **Maybe never:** block-level merge, multi-master.
