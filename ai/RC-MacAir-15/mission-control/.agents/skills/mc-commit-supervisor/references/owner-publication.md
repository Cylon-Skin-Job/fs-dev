# Owner gate and operation receipts

## Phase transitions and returns

Use [workflow.md](workflow.md) for intake, recovery, independent reviews and
holds. Checkpoint the actual state and next unfinished authorized action:

| State / return | Evidence required to advance |
|---|---|
| `intake` | Accepted integration unit, authority/bindings/writers/prerequisites, deduplication, verified complete recovery checkpoint. |
| `initial-review` → `REVIEW_COMPLETE` | Initial manager reports all five lenses with `clean`, `findings` or `insufficient-evidence`; never final readiness. |
| `repair` / `wiki-update` → `READY_FOR_HANDOFF_REVIEW` | Bounded leaf output and raw checks; Supervisor records `HANDOFF_VALIDATED` only after distinct fresh original-assignment handoff review. |
| `final-review` | New manager/reviewers independent of initial review and all writers; current whole-candidate clean review, required checks and resolved material findings. |
| `runtime-check` | Reviewed bytes rebuilt, actual checkout/profile/machine/server/renderer connection and success/failure/regression behavior verified. |
| `waiting-owner` → `COMMIT_READY_WAITING_OWNER` | Current final gate/checks/runtime plus exact candidate and proposed operation packet; save it and end the turn. |
| `waiting-dependency` | Named provider/consumer, resolver and observable release condition; resume affected work only on authorized evidenced release. |
| `needs-owner` | Indispensable intent/architecture question, checked sources and preserved independent progress. |
| `unmet-gate` | Exact missing evidence/reviewer/runtime capability, checkpoint and recovery route; readiness withheld. |
| `authorized-publication` → `OPERATIONS_RECORDED` | Actual owner instruction for current candidate and exact operation; each pre-operation check passes; separate actual receipts. |

Failed checks, findings and stale evidence are repair work. Holds never approve
features or launch prerequisite builds. A fixture/rehearsal instruction must
remain labeled and cannot authorize real Git operations.

## Precise owner packet and intentional wait

Write `owner-packet.md` with resulting behavior and consequential autonomous
corrections; exact candidate location/identity; target baseline and ordered
source IDs/dirty-input fingerprints; changed paths and deviation dispositions;
raw independent gate/check coverage, current dependencies and limits; running
app path, profile, machine, server URL/port/logs, sustained connection/behavior
evidence and owner test steps; recovery manifest/readback/limits; residual risks,
holds and exactly proposed Git operation(s) with branches/remotes/destinations.
Name which operation creates a commit and which publishes it. Readiness means
no operation occurred yet. Setup approval, build completion, MC, reviewer
recommendations, a schedule or silence supply no operation authority.

Save the current packet identity and `waiting-owner` checkpoint; return
`COMMIT_READY_WAITING_OWNER` to the assigned recipient and **end the turn**.
Do not poll, schedule, restart, re-arm MC or create a replacement task to evade
this wait. A supported authorized message route is distinct from a bulletin;
record actual delivery only when evidenced.

## Owner fix requests

An actual “fix X/Y” instruction reopens the bounded named scope under established
intent. Record its source and affected candidate/dependencies; preserve earlier
packets and unaffected accepted raw evidence. Freeze owned preimages before
repairs, assign leaf corrections and obtain fresh manager-assigned handoff gates,
then rerun affected checks plus required cumulative checks. Obtain fresh current
final review for the revised whole candidate, rebuild/recheck its actual runtime
and issue a new precise packet. Do not reuse operation approval for changed
material bytes. A new necessary product choice uses `needs-owner`.

## Immediately before each Git operation

Record the actual owner instruction/receipt, candidate identity and exact
permitted operation. “Commit” authorizes the identified commit only; push, PR
creation, PR merge, other commit-producing operations, next-SPEC acceptance and
Alpha each require their own applicable authority. A normal merge, cherry-pick
or rebase creates/revises commits and is inside this gate, including preparation.
Use an installed GitHub publishing procedure when available for authorized
publishing; supported tools receive only documented arguments.

Before **each** operation revalidate:

1. Actual owner authority and its current candidate/operation scope, not a
   parent/controller recommendation or rehearsal label.
2. Current source/target refs, candidate owned index/worktree/config/fixture
   fingerprints, non-conflicting writers and current recovery checkpoint.
3. All current required review/check/runtime claims and their dependencies.
4. Verified repository/branch/remotes, exact destination and intended staged
   path scope. Stage only owned intended changes, preserving unrelated index
   entries. Capture pre-operation index/worktree state before staging.
5. Existing refs/receipts for uncertain earlier outcomes; inspect before retry
   so a lost response does not duplicate a completed operation.

Source/target advancement or material candidate drift invalidates affected
claims. Freeze/review/check the affected current bytes and return the revised
packet for renewed candidate approval before operating; retain unaffected
evidence. A collision, stale permission or missing gate refuses the operation
with exact evidence and next safe action. Never reset/stash unrelated work or
move a shared target as a preparation shortcut.

## Separate receipts and successor recovery

Keep distinct fields/events for reviewed candidate; actual owner instruction
and operation permission; local commit IDs; remote push destination/result;
PR URL and attachment; PR merge; landed target baseline; provider release;
consumer adoption; and Alpha source/build/install/restart. Record only actual
events. After creating a PR, attach it through the supported app tool. A push
does not prove PR merge or target landing; provider completion/landing does not
prove consumer adoption. Only evidenced actual landing releases a dependency
whose contract requires landing. Preserve notification recipient/obligations;
use only an explicitly authorized delivery route.

After every successful Fusion GitHub push, ask the repository-required Alpha
follow-up. Perform no pull, build, install or restart until current owner
confirmation covers it. Alpha receipts stay separate from source publication
and both runtime isolation variables remain required by repository instructions.
Never copy or restore development/Alpha databases as candidate recovery.

A successor verifies predecessor terminal/non-conflicting writer status and
confirmed inactive schedule, reads existing job IDs/locations and pinned
procedure/source revisions, checks current source/target/candidate and approval
scope, retains valid evidence and resumes only the next unfinished authorized
step. Historical Review and Merge jobs retain their IDs/locations with an
alias-to-Commit-Supervisor record; preserve their immutable procedure in owned
job evidence if needed. Do not replay completed repairs/restarts/operations or
revive an intentional owner/dependency wait. No competing legacy entry is needed.
