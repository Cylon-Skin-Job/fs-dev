---
name: "PW-01 Provenance Wiki Reconciliation Specification"
description: "PW-01 Provenance Wiki Reconciliation Specification for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# PW-01 — Provenance and System documentation reconciliation

Status: proposed, documentation-only; execution awaits explicit approval of the reviewed candidate. This plan does not certify the current wiki, run product tests, or authorize feature implementation.

## 1. Objective

Bring the entire active Events And Ledger section into agreement with current development code and the owner's System database boundary, while distinguishing approved future behavior, unapproved proposals, and unresolved choices. Future builders must be able to understand the durable wiki without reconstructing implementation SPECs or re-asking settled decisions.

## 2. Baseline and scope

Repository: `/Users/rccurtrightjr./projects/fs-dev`. Wiki: `ai/RC-MacAir-15/Wiki`. Capture: `ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation` (C). Preparation HEAD and refs are in BASELINE.json; execution must recapture the current working tree and recheck affected evidence. Dirty source may be the active implementation; record its hash and state rather than treating HEAD alone as current. Do not checkout another branch or merge missing work into this task.

Documentation targets are the 24 existing `PAGE.md` files under `Wiki/010-Events_And_Ledger`, plus existing `Wiki/002-Server_And_Runtime/PAGE.md`, `Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md`, and `007-Persistence_And_Metadata/PAGE.md` in the same standards directory. PAGE-MAP.json enumerates all 27. Supporting-page edits are limited to the System ownership boundary, evidence/status guidance, and directly conflicting provenance rules; do not recertify unrelated content in those pages. No page moves, renames, title identity changes, new wiki hierarchy, or broad navigation regeneration.

Hard exclusions: `Wiki/007-Chat_System/**`, `Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections/**`, `Captures/033-Chat_Wiki_Reconciliation/**`, other owners' capture records, product source/tests/configuration, runtime/generated data, databases and profiles, root AGENTS.md. Treat those as read-only dependencies, including when another session changes them. Do not commit, push, restart, build/reinstall/update Alpha, run a server, or repair products. A mechanically necessary documentation correction inside the stated subject may be proposed as a recorded deviation; these owner-imposed exclusions cannot be overridden by the generic orchestrator scope policy.

## 3. Authority and required reading

INDEX.md identifies exact wiki guidance and standards. DECISIONS.md carries the new owner decisions and limited accepted overlays. Read raw Capture 023/024 decisions, relevant approved contracts and acceptance records; Tabs↔Provenance Bridge decisions, approval/release records and current code; Capture 008's design; Capture 030/032 for cross-program conflicts. Do not edit those inputs or resolve authority by timestamps alone.

Apply PW-D01–09. Existing claims incompatible with approved direction become explicit implementation gaps, not new approved behavior. Existing behavior absent from the target still needs an accurate source description. A settled target does not prove enforcement or migration has happened.

## 4. Required document model

Every one of the 24 primary pages must have an explicit status/scope statement and separate current behavior, target direction, and open questions/proposals where applicable. It need not use mechanically identical headings. Pages for unimplemented subsystems must say so, identify any narrower implemented counterpart, and avoid executable-looking examples presented as live schemas.

Current claims identify the responsible source files/symbols, evidence date/baseline, and limitations. Use `source inspected`, `test asserted, not rerun`, `historically reported at <revision/date>`, or an actual fresh verification label only when its evidence exists. This documentation SPEC requires source inspection and documentation checks, not fresh product runtime verification. No statement may claim a test passed recently solely because a file/report exists. Installed Alpha remains a separate unverified baseline.

Approved direction names the user-facing behavior and boundary; proposals are explicitly unapproved. Open decisions explain the unresolved choice and when it matters. Keep capture/SPEC identifiers, hash manifests, gate bookkeeping, and build receipts in C; durable wiki explanations use ordinary product terms and links to durable wiki pages. Remove old capture links from hand-written prose after preserving their authority mapping in C. Preserve generated navigation byte-for-byte.

The overview must tell future spec authors: read the System boundary and current behavior first; apply settled decisions; recheck relevant source at build time; distinguish a known implementation gap from a new product choice; ask the owner only if material intent is missing or conflicting. No blanket “fully built out,” “all tests pass,” or “entire wiki verified” claim. The completion scope is these pages and named claims, not the whole app.

## 5. Observable acceptance criteria

- AC01: Every primary page has a disposition and claim evidence. All three supporting pages have bounded change/disposition records. Exact census equals PAGE-MAP.json or a documented execution-time inventory update; no page silently escapes review.
- AC02: `fusion.db` System ownership, mutable control records, immutable-in-purpose history, pass-through live app content, separate workspace storage, plugin boundaries, snapshots versus authoritative source, and preservation direction agree across the owning hub/overview/decisions/standards. No claim that every System file must move into SQLite.
- AC03: Current governed admission/registry/subscriptions, legacy EventEmitter paths, current event names and actual table owners are distinguished from Capture 008's proposed common envelope/accepted-reference/ledger architecture. Exact supersession limits are preserved, including admission versus delivery/persistence success and real failure timing.
- AC04: Mediated save is traced from the production caller through command validation, durable reservation/preimage, filesystem replacement, facts, projections, renderer handling and store consumption. Required prewrite recovery protection is distinguished from optional reported context and postwrite recovery. Existing snapshots are not advertised as general restore.
- AC05: OpenCode tool capture, times/identity, candidate extraction, observation/checkpoints, exchange binding, ledger/query and resource rendering are traced end to end. Observation is not causal proof or an earlier preimage. Terminal snapshots, interruption and missing/invalid/oversized/native-observer failures are described within actual supported scope.
- AC06: BRIDGE-01 implemented reported context is separated from the unimplemented general UI action subsystem. Current query transports/helpers do not imply a mounted user-facing audit/history UI; production callers and response consumers must be checked. Chat identity context is documented only as provenance boundary, with Chat owner dependencies recorded.
- AC07: Future automation, storm control, audit loops, wider versioning, arbitrary plugin emission and retention/restore remain honest approved-target/proposal/open categories. No capacity, policy, event schema or new runtime permission is invented from a draft.
- AC08: Calendar persistence is traced through source writers/startup/read routes/client use and marked a current-source gap against the target. Do not infer that a user's DB is populated, sync enabled, or a migration approved. Check adjacent storage claims as needed; an incomplete app-wide audit is explicitly bounded.
- AC09: All substantive edits have exact pre-edit `.versions/` copies, no generated navigation changes, valid frontmatter/links/source pointers, and no attributable writes to excluded paths. See VALIDATION.md for exact procedures.
- AC10: Final guidance is self-contained, states the inspected development baseline and evidence limits, and exposes unresolved decisions without requiring readers to parse implementation history. Every deviation and cross-owner dependency is handed off.

## 6. Slice and evaluation protocol

Execute S00–S06 from SLICES.md sequentially with one documentation writer at a time. Each new slice uses a fresh `spec-slice-builder`; all descendants inherit the root model and reasoning effort. Builders may spawn only fresh read-only `clean-room-reviewer` agents, never another builder. They implement the documentation slice, inspect source, self-review, run its checks, record every deviation, and get the first materially clean builder-owned pass before returning `READY_FOR_ORCHESTRATOR_REVIEW`.

The SPEC orchestrator independently inspects raw changes and evidence, reruns applicable checks, and obtains a fresh read-only acceptance review. Follow `~/.codex/skills/spec-review-gate/SKILL.md` at every execution review level. Reviewers receive raw authority, current bytes, criteria, relevant source and test facts; do not prime them with prior conclusions. Stop each gate after the first clean pass; otherwise validate material findings, repair forward and repeat without an arbitrary pass ceiling. Advisory preferences do not block acceptance. Material acceptance repairs return through the responsible builder, a fresh builder review, and a fresh orchestrator review.

Use EXECUTION.md (created only at execution) to record slice state, builder/reviewer identities, commands, result evidence, deviations and downstream effects. States: pending → implementing → builder_clean → orchestrator_review → accepted. Record child terminal status; attempt closure only if supported. Planning reviewers do not count as implementation reviewers.

Each deviation records original contract, actual change, reason, paths, checks, observable effect, risk, and downstream impact. The orchestrator classifies `accepted`, `repair_required`, `owner_ruling_required`, or `downstream_impact`. Ask only for a genuinely necessary product ruling; preserve independent progress. Drift is a reason to inspect/review affected claims, not automatic contamination or authority failure.

## 7. Final gate and handoff

S06 runs all documentation checks and a fresh SPEC integration review. Route defects to the earliest responsible slice and rerun invalidated lower gates. Completion requires all ten criteria, accepted slices, complete source/decision evidence, no unresolved material documentation contradiction, and recorded residual product gaps. Explicitly labeled future decisions and accurately documented implementation gaps are acceptable; an unclassified contradiction masquerading as current guidance is not.

Deliver final REPORT.md, EXECUTION.md, per-page/claim evidence, snapshots/change manifest, exact checks and skipped checks, review lifecycle, and CROSS-SECTION-DEPENDENCIES.md. Return `SPEC_READY_FOR_OWNER_REVIEW` when invoked directly, or `SPEC_READY_FOR_SUPERVISOR_REVIEW` under a supervisor. The supervisor presents the result and obtains explicit owner acceptance before any following SPEC. No subsequent product implementation is authorized by this task.
