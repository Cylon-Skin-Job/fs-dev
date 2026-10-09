# SPEC-COMMIT-SUPERVISOR-01 — Commit Supervisor setup and rehearsal

> Executable planning candidate; not implementation authorization, installation evidence or a live integration assignment. Sole normative artifact: this SPEC.md. Coordination, reviewer reports, CANDIDATE.json and eventual approval receipt are non-normative records outside its identity set.

## Objective and authority

Install one assignable Commit Supervisor workflow that autonomously prepares, independently evaluates, repairs and documents an accepted integration unit, then presents the reviewed development app and a precise commit-ready owner packet. Demonstrate it through an isolated agent/recovery rehearsal. **Commit-ready means `waiting-owner` with current required gates/checks and the candidate app ready for owner testing; no commit has occurred.**

Planning intake explicitly accepts the current settled owner packet directly, bypassing First Draft under D-018 and the shared planning contract. D-024 supplies the top-level name and single-SPEC request. Original history UUID/turn locators were not supplied; the manager's raw owner packet and current durable decisions are the bounded authority, without an invented history identity. The author is runtime child `/root/commit_spec_stage/spec_author`, accountable to `/root/commit_spec_stage`; this is not a persistent-task UUID.

Absolute bindings:

- `controller_home` (`C` below): `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
- Source/development checkout (`R`): `/Users/rccurtrightjr./projects/fs-dev`; verified Git root, planning branch `agent/exact-workspace-paths`.
- Active Wiki (`W`): `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Wiki`.
- Planning bundle: `C/planning/commit-supervisor`; runtime jobs are separate `C/jobs/commit-supervisor/<job-id>/` created only on actual assignment.

| Classification | Governing contract |
|---|---|
| `owner_decision` | D-021: same-memory-folder MC handoff and owner gate before every commit-producing operation/push. D-022: distinct independent planning gates. D-023: confirmed MC cycle pause before action, no automatic re-arm. D-024: Commit Supervisor naming and one integrated SPEC. Raw owner packet: autonomous technical corrections, Wiki updates, independently evaluated result and verified dev-app handoff before commit/fix decision. |
| `source_of_truth_contract` | Current controller/session/planning contracts, User Preferences, standards router, Wiki manual procedures/article rules and repository Git/Alpha boundaries listed in Source revisions. |
| `active_code_constraint` | Legacy `mc-review-and-merge` skill/profile/config are installed; proposed subordinate roles are absent. `restart-fusion.sh` currently uses shared default profile, global process patterns, unsets `FUSION_APP_USER_DATA` and checks a listening port; its skill overstates isolation/renderer verification. Bounded correction is S4, not existing evidence. |
| `implementation_choice` | Three narrow local roles, one shared workflow reference, one snapshot/restore helper plus focused tests; generic reviewers carry multiple explicit lenses where proportionate. File splitting remains responsibility-driven. |
| `proposal` | This candidate's detailed executable setup remains subject to independent planning release and exact-candidate owner approval. No unresolved new product choice is silently approved. |

The maintained design/hierarchy handoffs explain intent; this SPEC turns that intent into future acceptance criteria. Existing implementation-supervisor final-roadmap review and per-SPEC owner acceptance remain necessary in their own chains; neither they nor planning release certify a future combined integration candidate.

## Scope, prerequisites and exclusions

Implement local workflow definitions, profiles/callers, recovery helper, job templates, runtime restart seam and isolated rehearsal. Preserve user/concurrent work. No live completed build is selected now. No product feature, chat/harness protocol, database/schema/event framework, global model/limits change, full Wiki Update run, factual hash scanner, Wiki CLI relocation, persistent chat or automation is created by implementing this SPEC. No commit/push/PR/merge/Alpha operation is authorized by setup or rehearsal.

Before execution: record exact approved CANDIDATE.json ID, actual owner assignment/approval receipt, current source revisions and effective permissions; check predecessor/writer ownership, current branch/dirty tree and supported runtime capacity. An owner assignment to implement the current reviewed package is sufficient approval when recorded; do not ask again for missing bookkeeping. Source drift requires assessing changed contracts and affected validation rather than rejecting hashes alone. Read both repository and controller instructions. Use installed Skill Creator for local skills and Memory Maintenance for static-index/record edits.

Required standards: `W/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` fully, then `001-Architecture_Routing`, `007-Persistence_And_Metadata`, `008-Testing_And_Smoke_Slices` PAGE.md fully. Their applicability here is reuse/ownership, preimage-before-replacement and route/readback verification; no Fusion persistence mutation is added. Frontend/state/WebSocket/UEB/harness detailed routes are not applicable to this local package. Governed product capability work stays excluded; do not invent a schema/event dependency for Markdown/Python workflow records. If necessary implementation grows into another surface, read its routed standards before work and record the exact deviation/authority. Read User Preferences fully: avoid deferred debt that obstructs known work, reuse existing procedures, keep purposeful file responsibility and attended publication. No standard is superseded by this SPEC.

## Installed and target hierarchy

Current installed top-level identifier is `mc-review-and-merge`; “Review and Merge” is its historical role alias. After S5 migration the sole active top-level entry/profile is `mc-commit-supervisor`:

```text
Owner / designated Mission Control (cycle paused before dispatch)
└── Commit Supervisor — mc-commit-supervisor
    ├── Initial Code Review Orchestrator — mc-code-review-orchestrator
    │   └── Fresh generic clean-room-reviewer sessions; all required lenses
    ├── Bounded repair worker — mc-commit-repair-worker
    │   └── Separate manager-assigned fresh worker-handoff review
    ├── Bounded Wiki editor under existing article procedures
    │   └── Separate fresh documentation-handoff audit
    ├── Fresh final Code Review Orchestrator
    │   └── Fresh reviewers; whole candidate, all lenses and seams
    ├── Candidate dev-app rebuild/restart and verified behavior
    ├── waiting-owner — intentional end of turn
    └── Precisely authorized Git operations and separate receipts only
```

Review orchestrators inspect/synthesize, never repair their reviewed candidate. Repair and Wiki editors are bounded leaf writers in this integration workflow; use an existing generic worker with explicit instructions for Wiki editing rather than a profile for every lens. Reuse existing Wiki research/repair/audit methods at bounded scope; do not claim the full manual supervisor ran. Runtime role fallback must load the exact local skill contract and record it. A profile does not establish CWD, identity or permission. Supported task APIs must receive only their actual documented fields; in particular do not invent a `profile` argument for persistent task creation. Explicitly include skill paths and invoking model/effort in dispatch.

## Integration job contract

### Intake, ownership and durable records

The Supervisor owns `assignment.md`, `checkpoint.json`, `findings.md`, `verification.md`, `owner-packet.md`, `receipt.md` and `resume.md` in its job folder, creating each when useful, not empty scaffolding. Each reviewer/worker owns a unique report path. MC alone owns central dispatch/monitor summaries. The snapshot helper owns immutable checkpoint payloads under that job; reviewers never regenerate evidence or edit candidate bytes.

Required intake fields: job/work/SPEC IDs; actual verified task/child identity and host; manager/report recipient; authority and accepted scope; absolute controller/memory/implementation paths; actual CWD, branch and effective runtime permissions; target/source refs resolved to full IDs; dirty input ownership/fingerprints; SPEC/checklist/decision/standards revisions; prerequisite acceptance/review evidence and exact dependency release conditions; integration-unit grouping rationale; approved preparation/runtime/repair scope; active writers and disjoint paths; original history pointers or explicit unavailable limit; stopped MC cycle evidence if MC assigned; report destination and allowed follow-ups. A registry `complete` label is insufficient. Deduplicate by source work IDs, input fingerprint and target revision; reconcile uncertain prior dispatch before retrying.

Prepare an isolated candidate from the recorded target and assigned sources; a local disposable checkout may reuse existing commits and replay recorded owned bytes without creating any new commits. Preserve source worktree, its index, and shared target ref. Never obtain cleanliness by stash/reset/checkout over somebody else's changes. Default merge, cherry-pick, rebase, checkpoint commit and shared-target fast-forward are prohibited before the corresponding owner authorization. Preparation methods creating commits indirectly are equally prohibited.

One active writer owns a path at a time; dependent Wiki edits follow settled repairs. Parallel read-only reviews and demonstrably disjoint repairs are allowed. Unknown overlap is a hold, not permission. Every substantive repair and Wiki output receives manager-assigned independent handoff review before acceptance; author self-check never substitutes. All deviations record original criterion, actual correction, authority/reason, files, effect, checks, risk, downstream consumer and owning classification (`accepted`, `repair_required`, `owner_ruling_required`, `downstream_impact`). Autonomous technical correction follows established intent. Advisory polish is optional.

### Recovery checkpoint and restore invariant

Before mutation, capture a schema-versioned recovery manifest and complete owned preimages. Record repository realpath/Git dir, branch/HEAD, target/source IDs, status and ownership, source/authority hashes, candidate reproduction method, immutable payload locations, runtime fixture/profile separation and limits. Use NUL-safe Git inventory/path handling; do not treat file names as shell fragments. For every owned path preserve existence/deletion, raw bytes (including binary), regular-file mode/executable bit or symlink target, HEAD/base identity, index stage/mode/blob bytes and working-tree bytes independently. Include staged additions/deletions/renames, unstaged changes on the same path and owned untracked inputs; record owned ignored runtime inputs separately only when explicitly needed. Unresolved merge stages require all stage payloads or a reported unmet prerequisite. A net diff or HEAD alone is not recovery.

Snapshot consistency requires before/after fingerprints of relevant worktree/index/ref inputs; if an active writer changes them, retry after coordination or hold. Confirm every payload hash/readback before preparation. Never copy/restore a whole shared index to undo an owned path. For isolated restore, reconstruct the owned index entries and working-tree preimages independently, preserving absence, modes, symlinks and unrelated entries. Remove only job-created owned additions identified in the manifest. Restore requires current ownership, inactive conflicting writers and expected current bytes; a collision produces a non-mutating failure/report. No forced reset or ref movement. Verify restored status plus both index and worktree fingerprints against the checkpoint. Abandoning an isolated preview is valid only after preserving its evidence and demonstrating source/shared state unchanged.

Runtime recovery is separate: code backups do not undo database migrations, external side effects, cache/session deletion or profile writes. Rehearsal uses disposable profile/workspace/database only. Record recovery method and boundaries before runtime effects; never copy, replace or restore development/Alpha databases as part of this setup. Preserve immutable checkpoint payloads and reports through replacements.

### Evidence, review and failure routing

Candidate identity comprises target baseline, ordered source commits, owned path inventory with index/worktree byte hashes/modes/deletions, relevant configuration/fixture/authority hashes and preparation recipe. Every gate/check names its covered identity, sources, exact commands/results/logs, actual coverage and skipped checks. After code, target/source, Wiki generation, fixture/oracle or runtime config drift, invalidate affected dependent claims; preserve explicitly unaffected raw evidence. Changed hashes are normal provenance. Re-review current bytes rather than recertifying old reports by updating a manifest.

Initial and final review cover Behavior & Verification, Standards Compliance, Integrations & Dependencies, Forward Compatibility against actual known plans, and Wiki Impact. Security/migration/performance/packaging specialists are conditional on concrete risks. A combined reviewer is sufficient for small scope with explicit full lens coverage; no fixed reviewer count. Material findings must name violated authority/necessary missing intent, affected path, realistic consequence and direct evidence, with severity and confidence separately. Preserve raw reports and stable finding dispositions.

Clean-room reviewers are fresh read-only sessions without author/manager conversation, underlying author/research work or prior reviewer history. Supply original intent/contract, current bytes and raw test evidence, not desired verdict/prior diagnoses. Successive gates and every repair pass use different fresh reviewers; final orchestrator/reviewers are independent of initial review and all repairs. Record actual identities, inherited root model/effort, terminal results and best-effort closure where supported. Unavailable independent runtime is an unmet gate.

Automated setup slice gates use `C/.agents/skills/mc-spec-review-gate/SKILL.md`. S2 extends its maintained policy explicitly to assigned Commit Supervisor integration gates with distinct gate scopes, retaining clean-room materiality and fail-forward repair. Stop each applicable gate after its first materially clean pass; repair evidenced material findings and obtain fresh current-byte review without an arbitrary pass ceiling. Do not broaden scope, oscillate guessed intent or repeat no-progress repairs indefinitely: investigate the root fact/authority/runtime obstacle and checkpoint the exact hold. Ordinary personal `$clean-room-loop` remains explicitly invoked ordinary-work review with its default three-pass budget and owner extensions; it is neither automatically invoked here nor the automated planning/SPEC/integration gate policy.

Missing intent or prerequisite capability returns a compact issue/investigation packet: exact question, checked decision/proposal/history sources, affected behavior/consumer, evidence/unknowns, resolver, recommended bounded investigation/planning route and observable release condition. A substantive requirement-defining investigation follows independent planning worker-handoff review. Hold affected integration; do not manufacture or launch an unapproved feature/SPEC/prerequisite build. Continue authorized independent work.

| Phase / return | Entry and exit condition |
|---|---|
| `intake` | Authority/source/target/ownership verification; advance only with accepted integration unit and verified recovery snapshot. |
| `initial-review` → `REVIEW_COMPLETE` | Coverage plus `clean`, `findings` or `insufficient-evidence`; report is not owner approval. |
| `repair` / `wiki-update` | Bounded writer returns `READY_FOR_HANDOFF_REVIEW`; manager records `HANDOFF_VALIDATED` after fresh assignment-specific review. |
| `final-review` | Fresh whole-candidate review with all lenses/seams, required checks and resolved material findings. |
| `runtime-check` | Reviewed bytes rebuilt; actual matching app/server/profile and candidate behavior verified. |
| `waiting-owner` → `COMMIT_READY_WAITING_OWNER` | Current final gate + runtime handoff + precise owner packet; end turn, no polling/timer/restart. |
| `waiting-dependency` | Named provider/consumer, resolver and observable release condition; resume only on authorized evidenced release. |
| `needs-owner` | Necessary intent/architecture choice; return question and preserved independent work. |
| `unmet-gate` | Exact missing evidence/runtime capability; retain checkpoint and recovery route, never claim readiness. |
| `authorized-publication` → `OPERATIONS_RECORDED` | Actual owner instruction mapped to current candidate and exact permitted operation(s); pre-operation safety passes. |

A successor reads existing records, verifies previous writer/task and schedule state, source/target/candidate freshness and actual approval scope, then resumes the next unfinished authorized step. Intentional `waiting-owner` is terminal for the turn, not failed/stalled work; never auto-restart it. Do not replay completed repairs, restarts or Git operations. Check ambiguous outcome receipts before retrying.

### Runtime and attended Git handoff

Use the intended checkout's corrected canonical `restart-fusion.sh` and maintained development restart procedure. Record actual renderer/main and server executable/entry paths and ancestry, server URL/port/logs, build result, `FUSION_LOCAL_MACHINE`/workspace watcher namespace, renderer `--user-data-dir`, profile path and server-data ownership. Establish the renderer remains connected after `workspace:init`, and exercise relevant candidate success/failure/regression paths through the real UI/server. A process or listening port is insufficient. Check startup/generation changed bytes against final review and refresh affected evidence before readiness. Runtime failure returns unmet runtime-check, not commit-ready.

The owner packet states behavior and consequential autonomous corrections, candidate identity/location, source/target, changed files, independent gate/check coverage and limits, app/profile/machine/server/logs, test steps, recovery point and exactly proposed Git operations/destinations. “Commit” authorizes only the identified commit operation; no inferred push, PR creation/merge, Alpha deployment or next-SPEC acceptance. “Fix X/Y” reopens bounded repairs, affected fresh gates and runtime handoff with a new packet.

Immediately before **each** authorized Git operation revalidate actual owner instruction/receipt and candidate scope; current source/target/owned index/worktree/config fingerprints; non-conflicting writers; current required checks/reviews/runtime claims; repository/branch/remotes and exact destination; and staged path scope. Stage only intended owned changes. If new bytes or target advancement materially change the candidate, renew affected review and present the revised candidate for approval; do not reuse stale authority. Do not commit unrelated files. Resolve uncertain previous operation by inspecting refs/receipts before retrying. Approval for one commit-producing operation does not automatically authorize another.

Receipts separately name reviewed candidate, owner authorization source, local commit IDs, remote push, PR URL/attachment, PR merge, landed target baseline and consumer adoption evidence. Only actual landed integration releases landing dependencies; adoption is separately evidenced. Use supported explicitly authorized notification routes; a bulletin is not delivery. After every successful Fusion GitHub push ask the repository's Alpha follow-up; perform none without current owner confirmation. MC confirms its entire cycle paused before completed-build handoff and never re-arms automatically. Commit Supervisor does not own central scheduling; roadmap acceptance remains separate.

## Dependency-ordered execution slices

Execute S1 → S2 → S3 → S4 → S5 → S6; no parallel shared writers. Listed surfaces are owned expectations, not a ban on mechanically necessary integration. For **every slice**, use a fresh `mc-spec-slice-builder`: implement, self-review, execute required checks, record every deviation, and return `READY_FOR_ORCHESTRATOR_REVIEW` only after a materially clean builder-owned gate. Builder may spawn only fresh `clean-room-reviewer` sessions, never another builder/manager. Orchestrator independently inspects and uses fresh acceptance reviewers, stopping on first clean pass; material acceptance repairs pass builder, fresh builder review and fresh orchestrator review again. Every descendant inherits invoking root model/effort. No arbitrary pass ceiling. Final SPEC integration adds a fresh whole-SPEC reviewer; supervisor reports every deviation/downstream effect and obtains owner acceptance before another SPEC.

### S1 — Recoverable intake and exact restoration

**Outcome:** an owned job can identify/reproduce its dirty inputs and restore an isolated candidate without changing source/index/shared target or unrelated files.

**Own:** proposed `C/.agents/skills/mc-commit-supervisor/references/workflow.md` (intake/recovery sections), `references/job-template.md`, `scripts/job_snapshot.py`, `tests/test_job_snapshot.py`. The helper is proposed/unimplemented at planning time. One snapshot/verify/isolated-restore responsibility; split only if cohesive complexity warrants it.

**Checklist / checks:** define the packet/state/checkpoint fields above; implement capture, read-only verify and guarded isolated restore entry points. Planned commands: `python3 <skill>/scripts/job_snapshot.py capture --repo <isolated-repo> --job <job> --paths-file <owned-paths.json>`; `verify --job <job>`; `restore --job <job> --repo <recorded-isolated-repo>`. `restore` refuses source/shared checkouts and changed unrelated entries. `python3 -m unittest discover -s <skill>/tests -p 'test_job_snapshot.py' -v` must demonstrate simultaneous staged/unstaged text, binary stage/worktree differences, staged add/delete, untracked file, executable bit, symlink, missing file, odd path characters, index/readback equality and concurrent-mutation/collision non-mutation. Fixture starts from existing local commits without creating checkpoint/fixture commits. Snapshot/helper has no commit/push/reset/ref-moving operations.

**Release/regression:** payload hashes verified; candidate reproduction and restore readback match exact index/worktree semantics; unrelated sentinel bytes/index entries/source/shared HEAD remain equal. Runtime profile recovery explicitly separate. No independent-review or app-readiness claim yet.

### S2 — Independent review and bounded repair

**Prerequisite:** accepted S1; candidate identity/recovery available.

**Own:** proposed `C/.agents/skills/mc-code-review-orchestrator/{SKILL.md,agents/openai.yaml}`, `C/.codex/agents/mc-code-review-orchestrator.toml`; corresponding `mc-commit-repair-worker` skill/UI/profile; workflow review/repair/evidence sections; `C/.agents/skills/mc-spec-review-gate/SKILL.md` bounded integration-policy extension. No registration yet; S5 owns config.

**Checklist / checks:** implement required lenses and conditional specialists, separate raw evidence/findings, leaf writer boundaries, handoff/final gate freshness, materiality and evidence invalidation. Worker assignments name files, manager, actual CWD and preserve others. Define approved intent vs technical correction vs needs-owner routing and deferred-fix release conditions. A table-driven rehearsal/harness checks material finding → coherent repair → fresh worker-handoff review; changed source/target invalidates affected claims; missing reviewer leaves unmet-gate; missing intent yields a bounded prerequisite packet without launching anything. Harness checks are planned artifacts within existing skill tests, not independent agent proof; S6 supplies that.

**Release/regression:** all five lenses accounted for; final review freshness rule explicit; no fixed lens-profile count or ordinary-loop budget introduced; existing builder/SPEC/roadmap gates retain scopes. Validate skill frontmatter with existing `quick_validate.py` for each new skill and TOML syntax via `python3`/`tomllib`.

### S3 — Settled Wiki handoff and independent documentation audit

**Prerequisite:** accepted S2; settled repair/current source identity precedes editing.

**Own:** workflow Wiki section and job template article disposition/report fields; bounded necessary wording in `C/review-and-merge-design.md` and `review-and-merge-handoff.md` clarifying target integration reuse. Ordinary canonical Wiki articles are not changed during setup except actual workflow facts if identified and assigned.

**Checklist / checks:** route changed/renamed/deleted source and relevant unchanged/missing article claims beyond `source-files`; require exact source/page hashes, complete collision-safe `.versions/` preimages, actual quoted UTC edit timestamps, no-op retention, exact metadata, cross-links and staged script-owned navigation. Fresh independent documentation gate checks original scope, omissions and factual accuracy after code settles. Maintain separate article/state/current-vs-future facts. Reuse W local Research/Repair/Audit procedures without launching full manual supervisor, hash-scan baseline system or script relocation. Guide structure changes invoke the existing separate Sync Wiki Context procedure only when applicable.

**Release/regression:** disposable Wiki fixture demonstrates substantive edit snapshot, unchanged page/time retention, generated-block staging/import without `.audit-state.json`, source drift requiring recheck and a missing-article finding. Existing command only when structural generation is needed: `node R/fusion-studio-server/scripts/wiki.js audit <disposable-Wiki>`. Fixture records command/results and does not import operational state. A real fresh Wiki reviewer is reserved for S6.

### S4 — Verified isolated development runtime

**Prerequisite:** accepted S3; code/Wiki/final evaluation precede runtime owner handoff.

**Own:** `R/restart-fusion.sh`; `/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md` bounded invocation/verification correction; workflow runtime section and focused restart tests alongside workflow tests. This narrow script/procedure correction is necessary for the promised isolated rehearsal; no product app architecture change is authorized.

**Checklist / checks:** extend canonical script with explicit `--user-data <absolute-dev-or-disposable-profile>`; reject Alpha checkout/app/profile and unsafe ambiguous ownership. Preserve existing `--repo`/`--machine`/default invocation; selected profile owns cache/port/log operations. Remove global pkill fallbacks; identify only selected checkout/profile process trees and do not kill unrelated Fusion/Alpha. Resolve actual inherited environment/profile correctly, launch from selected checkout, verify live renderer connection and actual server identity rather than port alone; report a verification failure honestly. Inspect necessary Electron launch/profile/server-spawn boundaries within this seam before editing, loading applicable standards if it grows. Preserve databases and unrelated caches.

**Release/regression:** `bash -n R/restart-fusion.sh`; focused tests execute argument/process/profile selection and injected wrong-path, wrong-profile, dead-server/disconnected-renderer failures. Existing default `--repo R --machine RC-MacAir-15 --dry-run` remains accurate; disposable invocation is planned until this slice installs it. S6 executes the real rebuild/restart/connection and UI smoke. No claim that static strings/dry-run prove app health. If independent runtime cannot verify renderer connection, retain an unmet gate with exact evidence, not a fallback launch from another checkout.

### S5 — Assignable top-level entry, active-call migration and owner gate

**Prerequisite:** accepted S1–S4; all referenced entry points/checks exist.

**Own:** `C/.agents/skills/mc-commit-supervisor/{SKILL.md,agents/openai.yaml}`; `C/.codex/agents/mc-commit-supervisor.toml`, `.codex/config.toml`; remove legacy entry/profile only at safe cutover; active references in `C/AGENTS.md`, `session-contract.md`, `record-templates.md`, `.agents/skills/mission-control/SKILL.md`, applicable status/monitor callers; current `deployment.md`, `skills-and-agents.md` hierarchy, `handoff.md`, `todo.md`, `registry.md`, `index.json` routes; `.agents/skills/monitor/SKILL.md`, `.agents/skills/status/references/report-format.md`, `.agents/skills/mc-roadmap-implementation-supervisor/SKILL.md` active caller wording; finish shared workflow/template. Read current files before each write; central record ownership must be coordinated, not seized.

**Checklist / checks:** entry resolves exact bindings and permissions, explicit skill loading/fallback, no invented task API arguments, stopped-cycle evidence, deduplication and prerequisite evidence; all states/returns and precise candidate/operation owner packet; end-turn owner wait; fix-X/Y reopening; final pre-operation safety; separate receipts/adoption/Alpha gate. Inventory active legacy callers and live jobs before cutover. Historical D-021–D-024 text and old reports retain provenance/searchable alias. Existing legacy job locations/IDs are not bulk renamed: record alias→new role, pinned procedure/source revision and next-safe-action. Never restart an intentional wait. Active legacy writer must finish or acknowledge authorized handoff before deleting its entry; unavailable safe handoff holds cutover. Preserve old immutable procedure in that owned job's evidence when needed, not a competing discoverable production shim. No duplicate live job or schedule.

**Release/regression:** `quick_validate.py` for top-level skill; Python `tomllib` parses config and all affected profiles and verifies referenced file existence; targeted `rg` over active local callers confirms canonical entry, with each remaining alias classified historical/job evidence; resolve Markdown links and exact indexed H2 headings; run existing `python3 C/.agents/skills/mc-memory-maintenance/scripts/validate_index.py C`. No model pin/global config change, no auto-dispatch/re-arm. Mark MC-T09 installed/rehearsal pending, never complete from static checks.

### S6 — Actual isolated workflow and recovery rehearsal

**Prerequisite:** accepted S1–S5; effective role loading/delegation capacity and canonical restart seam verified. No source/target/publication/Alpha write permission is added.

**Own:** fixture/harness additions in workflow skill tests, substantive `C/jobs/commit-supervisor/rehearsal-<id>/` evidence and final deployment/MC-T09 updates coordinated with central owner. The slice builder owns fixture/test preparation and its builder gate, not non-reviewer spawning. After that preparation is accepted, the executing SPEC orchestrator owns this SPEC's explicit bounded runtime rehearsal assignment to the newly installed Commit Supervisor using supported runtime children (no persistent chats); its children exercise the installed review/repair procedures. This scoped manager permission does not broaden builder spawning or start operational MC. If capacity cannot support the actual chain, preserve partial evidence and leave completion unmet.

**Checklist / actual acceptance:** make a disposable local checkout based on existing local refs (no new commits, remote pull/fetch or shared target move), isolated workspace/machine subtree, Wiki article fixture and disposable profile; capture staged+unstaged text/binary/untracked/deletion/mode inputs. Assign the actual supervisor with explicit skill and source packet; verify acknowledgment/CWD/profile/root model/effort. Initial fresh reviewer identifies seeded material behavior defect and Wiki obligation; bounded repair worker fixes under established intent; separate fresh manager-assigned handoff gate validates repair; Wiki editor preserves preimage and factual distinction; fresh Wiki reviewer verifies original coverage; fresh final orchestrator/reviewer evaluates whole candidate and all lenses. Record actual identity tree and unchanged source/ref/index/profile sentinels; planted string matching or mock verdicts cannot satisfy these agent gates.

Run real corrected `restart-fusion.sh --repo <candidate> --machine <fixture-machine> --user-data <fixture-profile>`; client build succeeds, main/renderer/server paths match candidate, renderer user-data and server-data match fixture profile, watcher/workspace resolves fixture machine, renderer stays connected after workspace:init. Exercise a fixture Wiki/article read and navigation/reload through actual app/server, plus relevant candidate fix behavior; record UI/runtime evidence and failure/regression oracles. Exercise disconnected/wrong-profile failure and prove readiness withheld while unrelated/Alpha processes/profile hashes are preserved. Tests may inject failure in disposable harness/process fixtures; the successful live app handoff itself may not be mocked.

Reach real `COMMIT_READY_WAITING_OWNER`, save packet and end the supervisor turn intentionally. Before readiness, record a real `waiting-dependency` return for a fixture provider requirement, preserve accepted evidence, then resume a replacement only after the controller supplies labeled fixture release evidence; unresolved intent similarly returns `needs-owner` without prerequisite build dispatch. Distinguish fixture landed and adoption fields without claiming any actual landing. The test controller then supplies an explicitly labeled **rehearsal-only** fix-X/Y event (never real owner Git approval); preserve history, rerun affected fresh gates/rebuild/runtime and produce updated packet. Resume a replacement runtime supervisor only after predecessor terminal/non-conflicting; it reads records, retains valid unaffected evidence and does not replay completed work or revive owner wait. Inject source/target/candidate drift and simulated operation approval mismatch: pre-operation checks refuse stale authority, perform no commit/push. Exercise restore after interruption and verify exact checkpoint worktree/index/modes/deletions/binary bytes/untracked state; collision refuses mutation; abandon preview with source/shared sentinels unchanged. Rehearsal-only labels cannot authorize real publication.

**Release/regression:** actual agent reports and runtime recovery readbacks prove every path above; final whole-SPEC fresh review checks setup plus rehearsal raw evidence; record source revisions, exact commands/results, gate identities, deviations and limits. MC-T09 becomes complete only after installed target and this behavioral rehearsal pass. Missing reviewer/runtime/recovery evidence leaves it incomplete with next safe action. Rehearsal ends with disposable processes stopped by owned path/profile and retained recoverability/evidence; owner's normal/Alpha apps and databases remain intact.

## Final integration and handoff criteria

Require accepted current revisions for S1–S6, all applicable automated checks, actual fresh agent/runtime rehearsal and fresh whole-SPEC integration review. Trace these requirements to evidence:

| Requirement | Slices / completion evidence |
|---|---|
| Recoverable candidate without commit/shared-target move; preservation of staged/binary/concurrent state | S1, S6 exact preimage/index/worktree restore and source/ref sentinels |
| Fresh independent lenses, bounded corrections, worker/final/Wiki gates and current-byte evidence | S2, S3, S6 actual role/reviewer tree and stable finding dispositions |
| Autonomous technical choices, honest intent/prerequisite holds, no new feature launch | S2, S5, S6 authority/hold packets and negative dispatch checks |
| Correct running development app/profile/machine and owner-fix cycle | S4, S6 build, renderer/server paths, UI/connection behavior and revised packet |
| Precise candidate/operation approval, intentional owner wait, no automatic cycle restart | S5, S6 idle terminal return and stale-approval refusal with no Git writes |
| Current naming with safe legacy jobs, landed/adoption/publication/Alpha distinction | S5 migration inventory/links and distinct receipts |

Return `SPEC_READY_FOR_OWNER_REVIEW` directly or `SPEC_READY_FOR_SUPERVISOR_REVIEW` through an assigned implementation supervisor, with accepted slice ledger, changed paths, actual checks/review/rehearsal evidence, all deviations/impact, remaining advisory limits and next safe action. Do not commit/push or start another SPEC. Owner acceptance of completed setup is distinct from approval of any future integration candidate.

No required outcome is deferred. Explicitly excluded follow-on work: factual Wiki hash detection/CLI relocation (future separately authorized Wiki tooling work; integration coverage uses source/diff investigation meanwhile), full manual Wiki Supervisor runs (manual invocation), live product integration/publication/Alpha (separate owner assignment), and actual consumer adoption (future receipt evidence). These exclusions do not impede this workflow's required coverage. A newly discovered missing necessary foundation holds its affected slice; disclosure does not satisfy its release condition.

Planning handoff preserves both execution routes without invoking them: one approved SPEC through `$mc-orchestrator`; or an approved roadmap/external executable packet through `$mc-roadmap-implementation-supervisor`, retaining per-SPEC owner acceptance. Implementation need not have creator provenance when already owner-approved.

## Author self-check and source coverage

Author self-check: one normative SPEC; acyclic sequential ownership and dependencies; direct settled intake; installed/proposed roles separated; no silent product choice; exact checkpoint/restore and runtime seams; independent setup/integration/planning gates distinguished; intentional waits and Git authority preserved; all root requirements mapped above. No tests, implementation, app launch or independent review was performed by this author. Candidate remains `CANDIDATE_AUTHORED`, awaiting manager-assigned worker-handoff, fresh candidate-stage and separate fresh release validation. CANDIDATE.json identifies bytes only.

Read coverage: controller role/session/decision/design/legacy profile and skill/planning/implementation gate sources; complete current Preferences/standards hub and three routed standards pages; full Wiki entry/session/Research/Repair/Audit/manual supervisor and article/update/audit/Guide procedures; shared reviewer and ordinary loop; restart skill plus actual restart script. No broad product-code survey. Raw original history remains unavailable; no main identity invented. Normative external source revisions follow; compare current bytes before later gates/implementation, preserving unaffected coverage. Central navigation-only updates are non-contract changes unless they alter an authority route.

## Source revisions

The following table records SHA-256 of external input bytes at authoring. Paths are repository-relative except absolute personal files. Each listed contract was read within its applicable scope; decisions D-021–D-024 govern current authority, earlier decision history supplies provenance only. No external file is silently part of CANDIDATE.json; governing external revisions are recorded here.

<!-- source-revisions: generated by author below -->

| Source path | SHA-256 |
|---|---|
| `AGENTS.md` | `41dc4e9dc4d58e7505cb6fc37b500129502231293894b5f90eda9398315e001d` |
| `restart-fusion.sh` | `a02c0fa38ffcd89e488ef1785cf83dd2f3476230d8fbaf4916063e9dcedd7380` |
| `ai/RC-MacAir-15/mission-control/AGENTS.md` | `67a88a237b1113daca286791354977f795b3791fd56d80aa192b7bbf0e2784ff` |
| `ai/RC-MacAir-15/mission-control/session-contract.md` | `a6190c66ddd6f511b76b7c257c415c39f52aa3466246b324b4db05637bd3482c` |
| `ai/RC-MacAir-15/mission-control/decisions.md` | `d2cc057a1bfd79455fc420a996a19316403afc35ea446593f3d704ca8222b7ff` |
| `ai/RC-MacAir-15/mission-control/review-and-merge-design.md` | `7e9bcfa884c2e20c180173885667fe1ad8d1cf31c15aca6c9737a0bd2aa387d8` |
| `ai/RC-MacAir-15/mission-control/review-and-merge-handoff.md` | `daf13e49f75279cc21610abad6762212b132fa4810c1cd6f14057cbcb54e3521` |
| `ai/RC-MacAir-15/mission-control/conversation-evidence.md` | `f08c376c586792e56deccaa49d19cb16b6e163d996e862db408cfd8c9e224f6e` |
| `ai/RC-MacAir-15/mission-control/record-templates.md` | `e97b95cfeeb9b6bc2b1667781904f87ca459d157eb71f6256f66ae1c8d9ac87c` |
| `ai/RC-MacAir-15/mission-control/.codex/config.toml` | `755c39322d94bd17c50597ec90c18c743164425734725b97ddf4e5df6dfc78ee` |
| `ai/RC-MacAir-15/mission-control/.codex/agents/mc-review-and-merge.toml` | `93c097025c51ba233b191bc3a7d5e5461848be4de4b98f587311b9be95428f63` |
| `ai/RC-MacAir-15/mission-control/planning/commit-supervisor/reports/author-assignment.md` | `8677188baed633fdbf8a05c79c4afcab839b66ab2c1fcda76655dcc71ff89a6e` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-roadmap-author/SKILL.md` | `6bbc04d37cedf7096f2da2de8be7ac29def302fb192870c0869c1e00a0d35581` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-planning-stage/SKILL.md` | `fbef99148a1b863543dd85ccdc6a3a115808232534a282c670a001b56e147de5` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-planning-validation/SKILL.md` | `3c0018b06c015bbab337e38fb9de56b8278a9ddff6bce183e7a353904bbffbde` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-roadmap-creator/references/planning-contract.md` | `ce471fe594051c7c375c1f371c0ebe4af18b65639f740ad3d95c918a70b9e5ad` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-roadmap-creator/scripts/candidate_manifest.py` | `ef91c9cbb57c7fd6b873d0a25d8498b7febac96a99bda1742b5993275fca1297` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-review-and-merge/SKILL.md` | `87cead992de90ce053b9a739640ba2410c0ca2ef875d481483690198f966b43c` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-spec-review-gate/SKILL.md` | `bf99f11b6d23b6d4b02662309b82736847b9869b86689af6206e9bff17e137d5` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-orchestrator/SKILL.md` | `2cf5f52c9ce9a795a66ee3cf97e7cb3b37bbbc9bc59f3f073f1a12cddcab100c` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-spec-slice-builder/SKILL.md` | `c4ca4bf6f739ea4bea811b6de41cbea6685ad0abd89543f77df33a8e95ccca94` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-roadmap-implementation-supervisor/SKILL.md` | `f514a07a4cc3d12eb2a2a1fef76ca76821bc32c13f97ba755f2e090a2cd6f4cd` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mission-control/SKILL.md` | `26715ee00d19611665e54e635f7a344a2c9e6a21a360865379ecf2ffd47d2265` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/monitor/SKILL.md` | `a749c02ac0422bf3f7a3207fb93e7ff477b966667843c50ae73f36745e2be4e7` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/status/references/report-format.md` | `e87bffd6dd656bd94334ef9d6365aa0b6e266e4b3d8a7f62b2701bde74e48480` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-memory-maintenance/SKILL.md` | `d4dac3b13b575800a8751ac6973533dd1ec6e9da03dc4af7497f7c6163cfacba` |
| `ai/RC-MacAir-15/mission-control/.agents/skills/mc-memory-maintenance/references/records.md` | `a1eaaff8ada20e4e7e48b8d59708ee9b39a31132a12af3ca0152f3008ce6b61f` |
| `ai/RC-MacAir-15/Wiki/AGENTS.md` | `9d353611f3b5ac94efa92048d1c0f8879d71786bcf1b641f915a0f695f5ef697` |
| `ai/RC-MacAir-15/Wiki/.agents/wiki-session-contract.md` | `b5147866ebec7e7f65de1f5f114f14166fe86ccbd8263f1e6ab584f4ec952d00` |
| `ai/RC-MacAir-15/Wiki/.agents/skills/wiki-update/SKILL.md` | `77aaa158fde575f474dac66d14669c9c60215b8455c532c9f9703bba03dada31` |
| `ai/RC-MacAir-15/Wiki/.agents/skills/wiki-research/SKILL.md` | `26ee803266813cae416278ededccb98f9030a84806e28e29abd7cef951ef3736` |
| `ai/RC-MacAir-15/Wiki/.agents/skills/wiki-repair/SKILL.md` | `3fb23901204ffb2789c84a2229bb91dae14bc55cad611178788c5a96537bef70` |
| `ai/RC-MacAir-15/Wiki/.agents/skills/wiki-audit/SKILL.md` | `0e43872db5681508f23ccf2fecf5d8fc1969a6585bb987f81f4cce876c66799e` |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/001-Style_Guide/PAGE.md` | `28ae2301be3115e22b6d69691fb5208e2625945998393071874b9a1fbee70629` |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/003-Updating_Wikis/PAGE.md` | `ec1739e2d693c07c5691fa3624b200915ea1c65257a09b75c853ff1c181a1a78` |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/004-Audit_Workflow/PAGE.md` | `2ea02f01a6b71621e59c7b198e53af019194cc4620efdb0ffd8a7199cdadc637` |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/005-User_Profile_Preferences_and_Design_Philosophy/PAGE.md` | `45fa9f630563d79935d5a461b308c823c0db3ded5c23817ba6d4c8a06c794ed5` |
| `ai/RC-MacAir-15/Wiki/008-Workflows/001-Sync_Wiki_Context/PAGE.md` | `d5a263e3a3856b3bce71a0c2043bf05daeb3538abd94fc1b297d96b89bc69127` |
| `ai/RC-MacAir-15/Wiki/008-Workflows/002-Wiki_Update/PAGE.md` | `18a2d00238e098f8816b71c3fb9bc36117d5d85aeaa5372e121c9b2439b1e0b3` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` | `de3995c68ae84f3b0fa389c6af0327e21dd08f30ac9ffbc7548b76f80ac393d7` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md` | `4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md` | `bd3e7be468289ac0a6ee6502cd8b9fc340f03fd7568deb59370ed00cc3b2a7a3` |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md` | `e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d` |
| `ai/RC-MacAir-15/Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-jobs.md` | `d25edcbe8b088ac46e9e5307e825dfe145fffdf4fdfea415a847ce1c2729d3db` |
| `/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md` | `bf4a3dba3a1f2f5bf41c3d91197adfbd31fa0cb9f60adb67069599fad008e91a` |
| `/Users/rccurtrightjr./.codex/skills/clean-room-loop/SKILL.md` | `a16158bb172c37e19e45430edd46ee92cb8de9f992c8558e04053dfb926b9cf5` |
| `/Users/rccurtrightjr./.codex/agents/clean-room-reviewer.toml` | `3ec16b52c4181728463ef4e1511ccbb2783dc6a9101921c04ba7bba454dd286e` |
