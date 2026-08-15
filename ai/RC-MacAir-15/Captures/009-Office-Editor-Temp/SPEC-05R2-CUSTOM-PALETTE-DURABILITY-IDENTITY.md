# SPEC-05R2 — Identity-Bound Palette Durability Recovery

**Status:** `RETIRED — SUPERSEDED 2026-07-21`
**Recovery candidate:** `OE-009-RECOVERY-RC2`
**Supersedes on acceptance:** blocked SPEC-05R execution, not the original product contract
**Depends on:** accepted SPEC-04R

## Objective

> This recovery packet is historical evidence only. Do not execute its durability/retry design. Current authority is `GUIDANCE.md` §4 and the owner-superseded SPEC-05 packet.

Create a fresh changed candidate that binds post-rename durability debt to the exact
coordinator-owned target identity and complete trusted write context, prevents equal
bytes on a replacement identity from falsely confirming that debt, and then completes
the unchanged SPEC-05R picker and integration work.

## Composite Builder Inputs

Every orchestrator and slice builder must read these four members in full:

1. this SPEC-05R2 amendment;
2. `SPEC-05R-CUSTOM-PALETTE-RECOVERY.md`;
3. `SPEC-05-CUSTOM-COLOR-SYNC.md`; and
4. `GUIDANCE.md`.

This member controls only the identity-bound durability repair, the fresh changed-
candidate requirement, and remapped slice tags. SPEC-05R controls the existing retry
clarification and recovery completion. Original SPEC-05 and Guidance control every
unchanged product and shared engineering requirement. Preparation/history documents
are evidence, not product authority.

## Confirmed Terminal Failure

The terminal 05R.1 candidate records debt with canonical hash, registered root, root
generation, target path, and an owned signature token. It omits the coordinator-owned
renamed target device/inode and the full original ancestor/trusted-parent identities.
Its equality path can therefore fsync and verify the identity currently at the path,
then clear debt even when that identity is an external replacement.

Deterministic reproduction:

1. Fail after the coordinator's rename and before destination-parent durability.
2. Confirm one debt item and one `250 ms` retry.
3. Replace `colors.json` atomically with equal canonical bytes under a new inode;
   separately replace the trusted parent plus file under equal bytes.
4. Reconcile.
5. The rejected candidate reports success, clears debt, marks the owned token
   `verified`, and leaves no retry.

## Normative Identity-Bound Repair

### Debt record

Before the rename becomes visible, capture the complete owned write context:

- workspace ID, registered root, and root generation;
- literal target path;
- ordered canonical ancestor identities;
- trusted-parent realpath/device/inode;
- coordinator-owned renamed target device/inode from the fsynced temp handle;
- canonical SHA-256 and sync flag/signature; and
- the owned token/episode generation required by the existing classifier.

The record is bounded in-memory operational state, not history, provenance, or a
database schema.

### Same-context confirmation

Debt may clear as confirmation of the original owned write only when all are true:

1. current registry root/generation, target path, ancestor identities, trusted parent,
   and target device/inode exactly match the debt record;
2. canonical bytes and sync flag match;
3. the exact trusted parent is opened and fsynced under identity guard; and
4. a post-fsync reread still matches the complete context, target identity, and bytes.

Any mismatch before or after fsync fails confirmation. Byte equality alone never
substitutes for target or trusted-context identity.

### Superseded debt

If current bytes are equal but target, parent, ancestor, root, generation, or path
identity differs, the original owned debt is superseded and can never be marked
`verified`. Retire its owned token/debt without claiming durability, obtain a fresh
trusted read/commit plan, and establish durability through a new exclusive-temp
write/fsync/rename/parent-fsync/post-rename verification cycle. The replacement must
not inherit the original temp-file fsync guarantee.

An identity-only equal replacement remains inside the current serialized logical
failure episode: it creates no second operation, immediate parallel repair, timer,
or retry-budget reset. If the fresh write fails, the remaining `250/1000/4000 ms`
schedule continues from the current episode. A genuine external byte/flag change,
registry change, or new user intent retains SPEC-05R's explicit reset behavior.

### Shutdown and observability

Success clears the current debt/token/timer only after the exact confirmation above.
Shutdown retires all debt/tokens and cancels timers without residue. Existing state,
error, retry-count, redaction, and wire-order contracts remain unchanged; no new
client-visible message or database field is authorized.

## Preserved Baselines

- SPEC-04R product/test composite
  `2cc940163eddc66844228452b7eb815aed19cadafca48a0a76d94ff0a1bab47d`
  remains the accepted prerequisite behavior.
- Accepted original Slice 05.1 pure-model semantics are revalidated, not redesigned.
- Retain prior 05R regressions for delayed genuine watcher reset, fired retry versus
  newer intent, genuine notification during rename, matching owned notification,
  exact `250/1000/4000` exhaustion, registry/user reset, journal/missing-parent
  recovery, and shutdown cleanup.
- Restore only the single coordinator/watcher activation path already required by
  SPEC-05R; no second coordinator, watcher, feature flag, or alternate runtime path.

## Non-Goals

- Product changes to Add, Sync, Remove, picker order/count, workspace participation,
  journal/barrier semantics, wire envelopes, or retry delays.
- A generic filesystem transaction framework, persistent debt ledger, extra retries,
  jitter, or background history.
- Live workspace/database use, SPEC-06 behavior, cloud sync, versioning, provenance,
  or unrelated dirty-worktree cleanup.

## Vertical Slices

### Slice 05R2.1 — Identity-bound debt repair

Repair the coordinator and focused tests on a candidate whose production and test
identities differ from terminal composite `8f92619d02efa63e830b8d5dc50d25c669faa697bc053813940638e2ac9a32c2`.
Restore/revalidate the one coordinator startup path and every preserved 05R.1 retry
regression.

Required tests use `[slice 05R2.1]` and cover:

- same original target/parent/ancestor context confirms only after parent fsync and
  post-fsync reread;
- equal-byte target-inode replacement cannot verify old debt and requires a fresh
  owned write context;
- equal-byte trusted-parent plus target replacement cannot verify old debt;
- ancestor/root-generation/path replacement cannot verify old debt;
- identity change during the confirmation fsync/reread window fails closed;
- replacement handling does not reset/multiply the current retry episode;
- a fresh replacement write failure consumes only the remaining exact delays and has
  no fourth retry;
- genuine external byte/flag, registry, and user-intent resets remain exact; and
- success/shutdown leave no debt, owned token, timer, watcher, temp, root, or child.

**Slice gate:** the two terminal replacement probes now pass through production
coordinator/watcher wiring, every retained 05R.1 regression passes, exact identities
differ from the terminal candidate, and a fresh builder-owned adaptive review is
materially clean.

### Slice 05R2.2 — Mutation protocol and atomic picker cutover

Execute unchanged SPEC-05R Slice 05R.2/original Slice 05.3. Land the complete
file-backed None/Google/Custom picker, always-visible Sync row, exact `+`, acknowledged
Add/apply, and one-action right-click Remove atomically with live server mutations.

**Slice gate:** original 05.3 pointer/keyboard/count/idempotence/divergence tests pass
together with all `[slice 05R2.1]` identity/retry regressions and accepted SPEC-04R
rehydration tests.

### Slice 05R2.3 — Three-workspace integration and recovery smoke

Execute unchanged SPEC-05R Slice 05R.3/original Slice 05.4, including A/B/C cyclic
and rapid workspace checks in healthy, degraded, and recovered states. Update only
the already authorized Wiki pages after runtime acceptance.

**Slice gate:** all exact cumulative commands, all eight original Electron variants,
complete-array/config/journal hashes, retry timelines, wire ordering, restart
recovery, Wiki checks, and cleanup pass on one integrated candidate.

## Exact Incremental Validation

Slice 05R2.1 from `fusion-studio-server/`:

```bash
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js --testNamePattern='\[slice 05R2\.1\]'
```

This tagged gate must include an isolated production-watcher/filesystem process
assertion. Zero matches fail. Also run sorted `node --check` for every changed server
file, the exact unfiltered five-file Jest gate, tagged `--detectOpenHandles`, scoped
diff/whitespace checks, and residue scans.

Slice 05R2.2 uses the SPEC-05R 05R.2 server and Playwright commands with tags renamed
to `[slice 05R2.2]`. Slice 05R2.3 uses the SPEC-05R 05R.3 lifecycle and Playwright
commands with tags renamed to `[slice 05R2.3]`. At every slice, apply Guidance's
build/lint/syntax and zero-match rules.

The final slice runs every unfiltered server/client command and all eight isolated
Electron commands in SPEC-05R without substitution. The cumulative Playwright suite
must include SPEC-04R rehydration. Retain at most one Electron clone at a time and
prove exact cleanup before advancing.

## Review and Lifecycle Contract

Each slice is owned by a fresh `spec-slice-builder`. It self-reviews, runs its exact
checks, and uses only fresh read-only `clean-room-reviewer` agents for the adaptive
builder gate: at most three discovery passes, stop after first clean, with the single
reserved confirmation rule from `spec-review-gate` when applicable. A builder never
spawns another builder and never marks its own slice accepted.

The fresh SPEC orchestrator independently inspects each handoff and owns a separate
adaptive acceptance gate under the same pass policy. Material acceptance repair
returns through the responsible builder and fresh lower/higher review. A fresh final
SPEC reviewer inspects the integrated candidate. All descendants inherit the root
model/reasoning effort; closure disposition is recorded for every child.

## Acceptance Criteria

- Both terminal replacement-identity probes pass because old debt cannot be verified
  against a new target or trusted context.
- Same-context debt clears only after identity-guarded parent fsync and stable reread.
- Superseded equal-byte identity requires a fresh fully durable owned write without a
  retry reset, parallel repair, or fourth attempt.
- Every prior SPEC-05R retry regression and every original SPEC-05 acceptance
  criterion passes.
- Picker cutover is atomic and performs no legacy migration/access/clear.
- SPEC-04R rehydration remains green through all healthy/degraded/restart cycles.
- All builder, orchestrator acceptance, final SPEC, Electron, persistence, and
  cleanup gates pass before supervisor acceptance.

## Worker Handoff

Return old/new candidate identities, full debt-token fields, exact confirmation and
supersession timelines, target/parent/ancestor replacement proofs, retry counters,
wire/config/journal/UI evidence, all commands/durations, eight Electron results,
cleanup, and residuals. Do not mark original SPEC-05 accepted.
