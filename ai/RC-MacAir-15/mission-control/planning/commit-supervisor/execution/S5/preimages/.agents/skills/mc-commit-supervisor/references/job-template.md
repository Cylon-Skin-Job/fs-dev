# Integration job records

Create each record when it contains useful evidence. Supervisor-owned reports
live in the assigned job folder; each child has its own unique report path.
The helper owns immutable `recovery/` payloads, not central registry state.
Use [workflow.md](workflow.md) for intake and recovery mechanics.

## Assignment fields

Record job/work/SPEC IDs; actual verified task or runtime-child identity and host
(separate from a persistent UUID); manager and report recipient; original owner
authority and accepted scope; absolute controller home, memory folder and
implementation checkout; actual CWD, branch, HEAD and effective permissions;
target/source refs and full IDs; source work acceptance/review evidence;
integration-unit grouping; dirty path ownership and index/worktree fingerprints;
SPEC/checklist/decision/standards paths, revisions and hashes; prerequisite
provider/consumer, resolver and exact release conditions; preparation, repair
and runtime scope; active writer identities and disjoint/held paths; history
thread/host/checkpoint pointers or explicit unavailable limit; stopped MC cycle
evidence when MC assigned; report destination and allowed follow-ups. Record
deduplication key and any prior dispatch/operation reconciliation.

## Checkpoint fields

`checkpoint.json` tracks mutable workflow progress separately from immutable
`recovery/manifest.json`. Record schema version, job/owner/manager identities,
current phase, accepted progress, next unfinished authorized action, holds and
release conditions, candidate location/identity, target baseline and ordered
source commits, owned inventory/index/worktree hashes/modes/deletions, authority
and relevant configuration/fixture hashes, reproduction recipe, recovery manifest
hash/location, original preimage payloads, runtime profile/database ownership
and recovery limits, current versus covered gate identities, child lifecycle,
last-check versus last-progress UTC times and report paths.

Use the phase appropriate to actual progress: `intake`, `initial-review`,
`repair`, `wiki-update`, `final-review`, `runtime-check`, `waiting-owner`,
`waiting-dependency`, `needs-owner`, `unmet-gate` or `authorized-publication`.
`waiting-owner` is an intentional terminal turn, never a stalled action to retry.
Record actual permission scope before any operation; preparation is not Git
publication, per-SPEC acceptance, adoption or Alpha permission.

## Evidence and report fields

`findings.md` retains raw unique child reports, violated authority, affected path,
severity/confidence, reproducible impact, stable disposition, repair/review
ownership and exact current coverage. Each deviation states original criterion,
actual correction, reason/authority, files, observable effect, checks, risk,
downstream consumer/impact and owning classification (`accepted`,
`repair_required`, `owner_ruling_required`, `downstream_impact`).

`verification.md` records candidate identity, source revisions, exact commands,
results/log paths, required coverage, skipped checks and reasons, raw independent
review identities/lifecycle, invalidated versus unaffected evidence, and recovery
readbacks including source/shared/index/unrelated/profile sentinels. Record actual
runtime paths/profile/machine/server/log/connection evidence when that phase runs;
absence is a limit, not readiness.

`owner-packet.md` presents behavior/consequential corrections, exact candidate
location/identity, source/target, changed files, independent gate/check coverage
and limits, actual app/profile/machine/server/logs, owner test steps, recovery
point, residual risks and exact proposed Git operation(s)/destinations. It remains
`waiting-owner` until an actual owner instruction addresses that candidate.

`receipt.md` keeps distinct reviewed candidate, owner instruction and exact
operation permission, local commit IDs, remote push, PR URL/attachment, PR merge,
landed baseline and consumer adoption evidence. Record each only after it occurs.
`resume.md` records predecessor terminal/non-conflicting status and paused schedule,
freshness/authority checks, retained valid evidence, unfinished authorized action
and exact hold release. Do not replay completed work or revive an intentional wait.

## Wiki assignment and disposition fields

Keep the integration's Wiki evidence in this job, separate from durable articles
and the manual workflow's `.wiki-runs/`. Follow [wiki-handoff.md](wiki-handoff.md).
Supervisor-owned coverage names the original source change/current-state scope,
settled code acceptance, actual source checkout/revision and dirty inputs, Wiki
home and procedure revisions, exact source/page hashes (including absence),
changed/added/renamed/deleted sources and relevant unchanged callers/consumers.
Each subject/claim has a canonical article or explicit missing-article finding,
statement/evidence/current-versus-future status, and disposition: repair, retain
unchanged, consolidate, retire or unresolved. Preserve why it was searched and
the limits; `source-files` alone cannot close coverage.

The bounded leaf editor packet names manager, actual CWD, exact writable pages
and generated blocks, finding IDs, settled source evidence, non-conflicting
writers, unique report path and stopping conditions. Its report records complete
preimage path/hash and resulting page hash, actual quoted UTC edit time (or
retained timestamp), exact metadata/source/link checks, relocations and all fact
destinations for consolidation/retirement, staged generation command/log/hash and
block import map, excluded operational state and unaffected pages, deviations,
source drift/rechecks and recovery limits. A missing new page has an explicit
absent preimage; no historical bytes/time are invented.

The manager assigns a distinct fresh read-only documentation gate using original
coverage and current sources/pages, including retained/missing pages and links.
Record actual identity/root inheritance/terminal/closure evidence, immutable raw
audit report, independently derived coverage, status (complete/partial/stale),
assessment (clean/findings/insufficient-evidence), stable finding dispositions,
exact reviewed source/page dependencies and final hash readback. Only current
clean review plus required checks yields `HANDOFF_VALIDATED`; editor self-check
returns `READY_FOR_HANDOFF_REVIEW`. Preserve affected invalidation and unaffected
evidence separately. No documentation report certifies app runtime or landing.
