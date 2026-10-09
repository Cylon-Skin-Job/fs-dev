# Commit Supervisor workflow

## Intake and ownership

Use this procedure only for an assigned accepted integration unit. Resolve the
absolute controller home, memory CWD and separate implementation checkout;
read their applicable instructions and current source revisions. Record the
actual task/child identity and host, manager, report destination and effective
permissions. A profile, shared CWD, TODO or registry completion label grants
neither assignment nor acceptance. Keep central MC dispatch/monitor records
with their owning controller.

Create the useful records from [job-template.md](job-template.md) in the assigned
`jobs/commit-supervisor/<job-id>/` folder. Verify authority, original scope,
source work/SPEC IDs, accepted prerequisites and their exact release conditions,
target/source full commit IDs, integration grouping, dirty input ownership,
standards and decision revisions, preparation/repair/runtime permission,
allowed follow-ups and history pointers (or explicit unavailable limits).
When assigned by MC, verify the entire MC cycle is paused before preparation.
Reconcile any previous task and schedule before replacement. Deduplicate using
source work IDs, input fingerprint and target commit; inspect uncertain prior
operation receipts before retrying.

Identify every active writer and its paths. Pause or obtain acknowledged handoff
from overlapping writers; uncertain overlap is a hold. One writer owns a path
at a time. Never infer acceptance from a reported completion label, nor launch
a missing prerequisite build. A missing requirement returns its exact question,
checked authority sources, affected provider/consumer, resolver, bounded
investigation route and observable release condition.

## Isolated candidate preparation

Use an independent disposable local clone based on existing local commits.
Record the target baseline, ordered accepted source commits and reproduction
recipe. Replay only assigned owned bytes. No new commits, commit-producing
merges/cherry-picks/rebases, shared target movement, stash/reset, remote
fetch/pull/push, PR or Alpha operation is preparation authority. Do not obtain
cleanliness by overwriting another writer. Preserve the source working tree,
source index and shared target refs, with readback sentinels.

The helper rejects the source/shared checkout, a nested checkout, a linked
worktree sharing its Git common directory, and any restore destination other
than its recorded disposable clone. This keeps recovery writes on an independent
index/ref namespace. Candidate assembly from multiple sources remains the
assigned supervisor's bounded preparation work; the helper captures/replays
owned preimages, rather than inventing a merge strategy.

## Recovery checkpoint

Before candidate mutation, prepare an `owned-paths.json` object outside its
checkout. The required fields are `owner`, `conflicting_writers: []`,
`source_repo` (absolute verified Git root) and `paths` (repository-relative
leaf strings, or objects with `path` and `job_created`). Add `shared_repos`,
ordered `source_refs` objects (`repo`, `ref`), `target_ref`, `authority_paths`,
`preparation` and `runtime` to record actual job evidence. The manager verifies
the inactive-writer assertion; the helper cannot discover agent ownership.
Mark an initially absent owned leaf `job_created: true` only if this job may
create it and later remove it. List owned ignored inputs separately in
`ignored_runtime_paths`, with explicit runtime recovery boundaries.

```sh
python3 <skill>/scripts/job_snapshot.py capture --repo <isolated-repo> --job <job> --paths-file <owned-paths.json>
python3 <skill>/scripts/job_snapshot.py verify --job <job>
```

Capture writes immutable `recovery/manifest.json`, its SHA-256 sidecar and
content-addressed raw payloads. Schema 1 records real root/Git directory/common
directory, HEAD/branch and refs, target/source IDs, ownership, NUL-safe status,
authority/config hashes, complete owned base/index/worktree preimages, unrelated
entry fingerprints, reproduction method and separate runtime limits. It checks
before/after worktree/index/ref fingerprints, payload readback and input
consistency. A concurrent change leaves no completed checkpoint; coordinate
the writer and retry. Never replace an existing checkpoint.

Each owned index stage retains mode, blob ID and raw bytes separately from the
working tree. Every owned working-tree leaf retains absence, raw binary/text
bytes, regular permissions/executable mode, or exact symlink target. Rename
scope includes both old and new leaf paths. All unresolved merge stages are
captured, even when working-tree conflict markers differ. NUL-safe Git records
and argument arrays handle quotes, tabs, newlines and shell characters.
Owned directories, submodules and special files require a separately approved
recovery method; intent-to-add must be explicitly staged before capture.
Nothing is approximated as a net patch. Parent symlinks/traversal are refused.

`verify` is read-only. `payloads_valid: true` validates saved bytes;
`matches_checkpoint: true` additionally proves current index/worktree/ref/status
semantics match the checkpoint. A successful payload check with
`matches_checkpoint: false` is drift evidence, not permission to prepare or a
readiness claim. Record the full response and covered manifest hash.

## Guarded restore and readback

Preserve current candidate evidence first. Confirm the current writer owns
exactly the captured paths and all conflicting writers are inactive. Write a
fresh ownership receipt outside the candidate with `owner`, exact `paths` and
`conflicting_writers: []`, then freeze the expected current bytes:

```sh
python3 <skill>/scripts/job_snapshot.py guard --repo <recorded-isolated-repo> --job <job> --ownership-file <receipt.json>
python3 <skill>/scripts/job_snapshot.py restore --job <job> --repo <recorded-isolated-repo>
python3 <skill>/scripts/job_snapshot.py verify --job <job>
```

Guard refuses changed unrelated entries or source/shared refs/index. Restore
validates payloads, exact checkout binding, receipt, expected current state,
unrelated entries and removal declarations before any candidate mutation. An
owned/unrelated/ref collision, parent-link collision or active Git index lock
returns `REFUSED` without restoring files or index. Do not force it: investigate
ownership and preserve the unexpected bytes before recording a new legitimate
guard. A changed unrelated baseline requires a new separately preserved
checkpoint/assignment, rather than laundering that drift through guard.

Restore reconstructs owned entries in a private copy of the **current isolated
index**, then atomically installs it under the Git index lock; it never restores
a saved whole source/shared index. Unrelated entries remain current and equal.
Working-tree bytes/modes/symlinks and index stages are restored independently;
only declared job-created absent leaves are removed. Index timestamps/extensions
can change; stage/mode/blob/flag and worktree/status semantics must match exactly.
Readback verifies both semantic fingerprints and NUL-safe status. Successful
restore writes `restore-readback.json` and consumes its mutable guard. An I/O
failure after replacements attempts rollback to the guarded pre-restore state;
immutable original payloads remain available after interruption.

Code recovery does not undo database migrations, external actions, cache/session
deletion or profile writes. Record disposable runtime/profile recovery before
effects, never copy or restore development/Alpha databases, and retain evidence
through replacements. Abandoning an isolated preview is valid after preserving
its evidence and proving source/index/shared refs and runtime sentinels unchanged.
This recovery procedure makes no independent-review or app-readiness claim.

## Independent review assignment

The Commit Supervisor assigns initial and final review to
[mc-code-review-orchestrator](../../mc-code-review-orchestrator/SKILL.md).
Both use the maintained [review gate](../../mc-spec-review-gate/SKILL.md).
The orchestrator inspects/synthesizes; it never changes candidate bytes or
assigns repair workers. A fresh final orchestrator and fresh reviewers must be
independent of the initial orchestrator/reviewers, all writers and prior gates.
Use exact skill paths as an explicit fallback if a profile is unavailable;
record the fallback and actual runtime identity. Definitions do not set CWD,
permissions or identity, and task APIs accept only documented arguments.

Review packets carry original owner intent/SPEC/decisions and routed standards,
accepted input/prerequisite evidence, current target/source/owned/config/fixture
identity and preparation recipe, exact raw check commands/logs/results/skips,
known consumer plans, allowed report writes and unique report destination.
Supply raw evidence without earlier verdicts/diagnoses or desired answers.
Clean-room sessions have no author/manager conversation, underlying author or
research work, or prior reviewer history (`fork_turns=none` where supported).
Record actual child identities, parent/mode, inherited root model/effort,
terminal results and best-effort closure; never use a profile-selected override.
Before replacement confirm predecessors terminal or non-conflicting. Missing
closure alone is lifecycle evidence; missing independent runtime is an unmet gate.

## Lenses and raw findings

Every initial and final review accounts for all five lenses. One combined
reviewer can cover a small candidate; split concrete risks when needed, with
explicit coverage and no fixed number of profiles or reviewers.

| Lens | Evidence and consequence to examine |
|---|---|
| Behavior & Verification | Original behavior, realistic success/failure/regression paths, public routes, persistence/readback and raw checks; identify unsupported claims. |
| Standards Compliance | Full standards hub plus applicable routes, ownership/reuse and hard rules; optional preferences remain advisory. |
| Integrations & Dependencies | Accepted provider inputs, cross-source seams, exact consumer/release contracts, config/runtime/migration boundaries; completion labels are insufficient. |
| Forward Compatibility | Actual approved/known plans and consumer contracts; identify compounded debt or obstructed fixes with evidence, avoid invented future scope. |
| Wiki Impact | Changed/renamed/deleted sources plus relevant unchanged/missing article claims, source truth versus planned behavior, documentation obligations and limits; settled edits/audit belong to their separate handoff. |

Add security, migration, performance or packaging specialists only for a
concrete affected boundary/risk. Record the trigger, bounded question and
sources or why the base coverage suffices; specialist titles do not replace
lens coverage. Generic fresh reviewers may carry these questions.

Preserve each raw report unchanged under a unique path. A finding has stable
ID, originating report/reviewer and covered identity, lens, violated authority
(or precise necessary missing intent), affected artifact/path, realistic impact,
direct evidence/reproduction, severity and **separate** confidence/unknowns.
Validate all four materiality dimensions independently before routing repairs.
Severity is `critical`, `high`, `material` or `advisory` per the maintained gate;
confidence does not upgrade severity or make unsupported speculation material.
Record evidence-backed rejection/reclassification without deleting the raw claim.

Supervisor-owned `findings.md` keeps an append-only disposition history keyed
by the same ID: `open`, `repair-assigned`, `repair-reported`,
`handoff-validated`, `resolved`, `advisory`, `not-supported` or `deferred`.
Each event records actual actor/time, candidate identity, reason/evidence and
next action. A repair report proposes a disposition; only the manager's fresh
handoff acceptance can advance it to `handoff-validated`, and final current-byte
confirmation resolves it. Deferred material findings remain unresolved, with
provider/consumer, resolver, explicit impact/risk and exact release condition.
Duplicate reports of one root cause retain links to the original ID; regressions
reopen its history rather than erasing prior acceptance.

## Coherent repairs and independent handoff

The Supervisor validates/consolidates findings by root cause and assigns
[mc-commit-repair-worker](../../mc-commit-repair-worker/SKILL.md) a bounded packet:
original authority and finding IDs/raw evidence, exact files/responsibility,
actual CWD/checkouts, manager/report path, accepted candidate and verified
preimages, inactive overlapping writers, required checks and success/failure
oracles, allowed mechanical integration and stop/hold conditions. Explicitly
tell the writer it is not alone, to preserve others and adapt. One path has one
active writer; parallel repairs require proven disjoint ownership. Dependent
Wiki work follows settled code. Leaf writers spawn no agents/external reviewers.

Technical correction under established intent proceeds autonomously. Advisory
polish is optional; necessary behavior/architecture choices are not guessed.
The expected-file list cannot excuse an incomplete correction: bounded omitted
mechanics are allowed with every deviation recorded as original criterion,
actual change, reason/authority, files, effect/checks, risk, downstream consumer
and proposed classification. Supervisor classification is `accepted`,
`repair_required`, `owner_ruling_required` or `downstream_impact`, propagated
through later gates and the owner packet.

The writer self-reviews, reruns invalidated checks plus required cumulative
checks and returns `READY_FOR_HANDOFF_REVIEW` with current hashes/raw logs,
finding dispositions, deviations, skips and recovery limits. The Supervisor
assigns a **different fresh** read-only handoff reviewer against the original
assignment and repaired current bytes. It records `HANDOFF_VALIDATED` only after
clean review and required checks; self-checks or initial review cannot substitute.
Material findings return coherent repairs and another fresh gate. Stop at first
materially clean pass, with no arbitrary ceiling or ordinary-loop budget.

## Current-byte evidence and invalidation

Each evidence record names ID/type/producer, raw report/log path, exact command
and result, covered identity, dependencies, coverage/skips and lifecycle. Use
the S1 candidate identity: target baseline, ordered sources, owned index/worktree
hashes/modes/deletions, relevant configuration/fixture/authority hashes and recipe.
Dependencies identify the actual subset supporting a claim, including paths and
fixture/oracle/config/authority inputs, not only a final manifest hash.

On source/target/code/Wiki generation/fixture/oracle/runtime config drift, compare
current dependencies, mark affected claims invalid with reason and rerun the
affected checks/reviews; retain explicitly unaffected raw evidence. Missing
dependencies are incomplete evidence. A changed hash is provenance, not a defect
or misconduct. Never renew a gate by editing its old identity or relabel a stale
report clean. Coordinate any active writer, freeze current bytes, run required
cumulative checks and obtain fresh current-byte review. Whole-candidate final
claims cover all identity components; narrower accepted handoffs can survive
unrelated drift when their documented dependencies prove it.

Final review evaluates the whole candidate, seams, all lenses and accepted
handoffs; unresolved material findings, deferred requirements, failed checks,
missing raw evidence or missing fresh reviewers prevent `clean`. It returns
`REVIEW_COMPLETE` with `clean`, `findings` or `insufficient-evidence`, explicit
coverage, deviations/classifications, current identity and lifecycle. Runtime
and owner readiness are later distinct steps. A test harness is never an actual
independent reviewer or runtime-app gate.

The read-only packet harness can rehearse these decisions:

```sh
python3 <skill>/scripts/review_packet.py --packet <packet.json>
python3 -m unittest discover -s <skill>/tests -p 'test_review_packet.py' -v
```

Its JSON protocol uses `phase` (`initial`, `worker-handoff`, `final`), complete
`candidate`, raw `reviews`, `evidence`, `required_checks`, `participants`,
`findings`/`dispositions` and optional `issue`. Evidence dependencies are
component keys from candidate (`target`, `sources`, `owned`, `configuration`,
`fixtures`, `authority`, `preparation`); use owned path entries for narrower
coverage. Worker-handoff packets also name `assigned_paths`; the current review
must cover each original assigned path. Findings and accepted handoff evidence
name the original `assigned_paths`; worker gates derive coverage from those
original finding assignments even if a later packet supplies fewer paths.
Final review requires current owned-path dependencies covering that entire
assignment and affected path. A historical rejection applies only to its covered
current identity and finding evidence; an evidenced advisory reclassification
uses the same binding and can remain clean while preserving the original claim.
Fresh supported same-ID material claims reopen every prior terminal disposition.
Resolved/handoff-validated claims still require their current independent
handoff evidence. Narrow handoffs
may omit unrelated paths. Holds preserve raw reviews, stable findings and
independent repair packets while withholding acceptance; the manager verifies
which corrections are independent of the held question before assigning them.
Reports attest clean-room/read-only/root-inheritance/terminal status
and unique identities; the harness checks those attestations, not agent reality.
Outputs name state/return/result, invalidated/unaffected claims, repair/hold
packet and no dispatch actions. Malformed packets refuse; synthetic test IDs
and reports cannot prove S6's actual agent gates.

## Intent and prerequisite holds

For necessary missing intent, contradictory authority, missing prerequisite or
an obstructive deferred fix, return a compact issue/investigation packet: exact
question; checked decisions/proposals/history and source revisions; affected
behavior/provider/consumer; raw evidence and unknowns; resolver; recommended
bounded investigation/planning route; observable release condition; preserved
independent progress and next safe action. Investigate original history through
the controller's conversation-evidence procedure when needed; unavailable
history is explicit. A substantive requirement-defining investigation requires
independent planning worker-handoff review before it becomes accepted intent.

Use `needs-owner` for indispensable intent/architecture choice,
`waiting-dependency` for a named provider's accepted evidenced release, and
`unmet-gate` for missing evidence/reviewer/runtime capability. Resume only the
affected step on an authorized evidenced release; a completion label or landing
alone does not prove consumer adoption. Do not fabricate/dispatch an unapproved
feature, SPEC or prerequisite build. Continue every independent authorized task.
Test failures/stale evidence/findings remain repair work. Investigate repeated
no-progress root facts rather than oscillating guesses; preserve checkpoint,
exact hold and recovery route without declaring the candidate ready.
