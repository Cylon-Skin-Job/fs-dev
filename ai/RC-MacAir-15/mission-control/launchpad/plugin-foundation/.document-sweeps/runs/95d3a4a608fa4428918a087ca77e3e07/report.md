# Plugin foundation document sweep — initial review

- **Run:** `95d3a4a608fa4428918a087ca77e3e07`; parent: none.
- **Author/time:** Codex main chat, 2026-10-03T13:58:06Z.
- **Input:** Immutable run snapshot of nine direct folder documents. This is an initial review; no earlier sweep baseline exists, so no historical diff is claimed.
- **Scope:** Current plugin-foundation packet, focusing on 2026-10-03 D-015/D-016 and their propagation. Bounded linked read of the chat-integration owner-direction amendment and its current First Draft; no runtime/code verification or full conversation checkpoint.

## Material direction and propagation

| Claim or outcome | Evidence checked | Packet and consumer coverage | Limit |
| --- | --- | --- | --- |
| System owns snapshot execution; repo-local SQLite holds content; plugins declare sources/destinations under approved grants. | D-015, REF-018, INTENT, TICKET | I-016/I-019 retain path, migration, declaration and enforcement work. | Direct chat transcript for REF-018 was not independently retrieved in this sweep. |
| Keep user-edit versions, event-prompted trigger/harness captures and an approximately 30-minute fallback with prior and observed copies; links are association. | D-015, REF-018, CAPTURE | I-016/I-017/I-019 carry byte retention, windows, producer, overlap and evidence gaps. | No scanner or event producer is certified implemented. |
| Chokidar removal and actual chat verification are current; future snapshots do not gate them. Retire ledger `file:changed` recording selectively. | D-016, REF-019, B-002, linked owner-direction amendment and current First Draft | TICKET and INTENT separate current and future work. First Draft now carries the corrected scope and actual chat smoke. | First Draft remains a discussion candidate, not validated implementation or chat success. |
| Default Git publication of a consistent copy has an 80 MB warning and effective 100 MB ceiling; pull does not replace live DB. | D-014, I-020, REF-017 | Still separate from 1 GB local-capacity proposal I-018. | Content/visibility treatment for a remote backup needs explicit resolution before feature release. |

## Findings

### S-001 — Remote visibility and retained content need a publication contract

- **State/severity:** new; material design gap, future feature.
- **Evidence:** D-015 makes the snapshot DB contain retained file bytes; D-014 publishes its consistent copy to a configured GitHub/GitLab remote by default. I-020 tracks size, history and push mechanics but not the case where eligible source content is broader or more sensitive than the selected repository's remote visibility. I-008 covers audit payload privacy but is not linked to the remote-copy policy.
- **Affected scope/consequence:** Snapshot source grants, repository visibility, backup artifact contents and Git history. A default push could disclose retained content beyond the audience intended for a particular file or make later removal difficult.
- **Resolver/next action:** Plugin-foundation records the grant/publication seam in I-020 with a link to I-008; System storage and Git-sync owners define the content-scope and remote-visibility rule before implementation. Preserve the owner's default-push direction while resolving this rule.

### S-002 — Historic watcher reference can be mistaken for a current option

- **State/severity:** new; low documentation clarity gap.
- **Evidence:** REF-016 still says a Chokidar-backed optional observation mode can reuse the watcher, whereas D-015 and D-016 supersede that option and make removal the current target. D-013 and CAPTURE explicitly mark it historical, and TICKET/INTENT use the new direction.
- **Affected scope/consequence:** A reader following REF-016 alone could carry an obsolete capture alternative into future plugin planning.
- **Resolver/next action:** Mark REF-016's support statement as historical evidence only; retain its watcher behavior evidence for retirement analysis.

## Disposition and limits

The new owner direction is propagated through decisions, intent, issues, capture, ticket and bulletin. The linked First Draft reflects the current retirement scope. I-016/I-017/I-019 accurately keep future design unresolved, and no document claims the snapshot service or chat repair is implemented. This sweep did not assess current product code or settle owner choices. Incorporate S-001 and S-002 through memory maintenance; any resulting edits become input to a later sweep.

- **Changed files considered:** Initial baseline includes AGENTS.md, BULLETIN.md, CAPTURE.md, DECISIONS.md, INTENT.md, ISSUES.md, REFERENCES.md, TICKET.md and index.json. No prior baseline for a change list.
- **Checks:** Working-memory index validation passed. Linked owner-direction amendment and current First Draft were read within the retirement/snapshot boundary.
- **Review completeness:** complete within stated document scope.
- **Assessment:** gaps found; neither gap blocks current Chokidar retirement/chat verification, and both concern future planning/document clarity.
