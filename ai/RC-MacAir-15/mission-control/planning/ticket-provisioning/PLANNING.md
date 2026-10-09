# TP-001 — Authored planning handoff

> Author-only handoff. Status: CANDIDATE_AUTHORED. No independent review, implementation approval or delivered behavior is claimed.

Author: Codex side chat (ephemeral). Source capture: 2026-10-08T02:44:30.296548+00:00.

## Assignment and owned output

The owner requested a SPEC for deterministic ticket-folder replication from a maintained template, with board content used as the seed and ticket ownership after provisioning. The only changed area is this new planning package. The live template, existing workfolders, preview files, central records and Git state were not edited.

Normative files: [SPEC.md](SPEC.md) and [INPUTS.json](INPUTS.json). [CANDIDATE.json](CANDIDATE.json) identifies their bytes. This coordination record and the manifest are outside the normative set.

## Source and author self-check

- Existing template validation passed: nine indexed documents. Checked Markdown links and explicit local procedure paths resolve; no template checkpoint/live state was found.
- All three current previews contain 32 items and 32 checklists. Their inline items, checklist definitions and dependency-plan definitions match at the read-only comparison. This says nothing about their different workflow observations.
- Current primary build #2 has no attached workfolder and no established current step. No Chat Session Management folder was found among the selected Launchpad homes.
- Inspected the existing board writer's lock, atomic replacement and rendering paths. Its CLI does not yet implement ticket-summary syncing; workflow-ui currently rejects versions other than v1 and refreshes its sidecar every ten seconds.
- Read current User Preferences, the standards router and routed Architecture, Frontend, State, Persistence and Testing pages, plus Chat overview and upstream harness intake. INPUTS records exact paths, digests and actual coverage limits.
- Requirement coverage: summary mirroring in section 4; ownership cutover/recovery in section 5; refresh in section 6; template/CLI/pilot slices in section 7; acceptance in section 8. Exact execution/source/write boundaries remain visible.
- Author correction before handoff: the destination lease and board-writer lock protocol avoids nested reacquisition; ticket-local retired/high-water IDs prevent accidental ID reuse after deletion.
- Planned implementation checks A01–A14 have not run. There is no implementation in this package. Candidate/input integrity checks are byte/source checks, not an independent planning pass.
- Completed author integrity checks: candidate manifest check passed for `sha256:c5d34183d52788beff297c7bd9928a9d2e993478f42e74c25c8c66a2371be933`; all 45 captured input fingerprints still match; local Markdown links resolve and code fences balance. Git reports only this new untracked planning package for the scoped output check.

## Remaining gates and return point

Independent worker-handoff, candidate-stage and release validation are pending. The applicable Roadmap Author skill states: “If no authorized review route exists, preserve the provisional candidate and report the missing gate.” Its source is `.agents/skills/mc-roadmap-author/SKILL.md`; the shared planning contract further requires separate fresh reviewer sessions. The current side-conversation boundary prohibits delegation, so this author has dispatched no reviewers and cannot certify those gates.

An owner-assigned main planning manager can take this package, verify input freshness, assign those reviews and reconcile material findings before exact-candidate owner implementation approval. No repeat drafting or separate Launchpad folder is necessary merely to review this single SPEC. Do not launch the live #2 pilot under the current authoring request.

Proposed technical choices for review are structured Markdown summary fields, default optional-document handling, primary-board source binding and explicit foreground watching. No additional product feature is inferred. Live-workfolder adoption and Fusion runtime integration remain separately assigned work.
