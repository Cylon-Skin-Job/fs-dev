# Coordination record templates

## Assignment and return packet

Copy into the assigned workspace's handoff or report; MC keeps only a pointer centrally.

```text
Work ID / workspace ID:
Assigned role / session kind (persistent main or runtime child):
Verified runtime identity and host (or explicitly unregistered) / accountable manager:
Assignment authority and source revision:
Absolute controller_home / exact local skill path / profile name if spawning:
Question or outcome / exclusions:
Verified memory CWD / separate implementation checkout and branch:
Applicable local instructions, profile and skills / source revisions:
Assignment revision / allowed follow-up actions / effective permissions:
Worker acknowledgment: actual CWD, role, scope and first action:
Owned write area / writer handoff or lease:
Inputs and revisions:
Main history source: task UUID/host and designation evidence, CHECKPOINT.json path (or unresolved):
Relevant conversation turn/message locators and interval/side-chat coverage limits:
Acceptance and stopping conditions:
Dependencies: provider, consumer, exact release condition, hold owner:
State / last checked / last progress:
Completed actions / evidence and revisions / checks:
Implementation / integration / owner acceptance / consumer adoption:
Open intent / issues / deviations / required owner choices:
Last safe checkpoint / next action / actions not to repeat:
Report path / intended recipient / delivery and acknowledgment:
```

## Investigation packets

For Launchpad research or reconciliation, extend the common packet using [investigation-contract.md](investigation-contract.md#assignment-packet). Its [report and synthesis rules](investigation-contract.md#report-and-synthesis) define evidence, authority, report disposition and incorporation. Keep these fields canonical there rather than maintaining a second research template.

## Decisions, issues and changes

Owner decision: stable ID, exact choice, source attribution/time, affected scope, superseded decision if any, propagation needed. A recommendation belongs in proposals until authorized.

Issue: stable ID, observation and evidence/revision, affected work, consequence, responsible role, resolution condition, next action, state and dated outcome. Missing intent is an issue even if no code defect exists.

Dependency: provider and consumer native IDs, required capability/revision, release evidence, hold owner, notification destination and remaining adoption work. “Provider complete” alone does not prove consumer readiness.

Changelog: timestamp, author, reason, affected documents/work IDs, evidence and material uncertainty. Keep current status in registry/handoff rather than reconstructing it from the log.

Bulletin: B-NNN, type, status, owner/chat, target, source, summary, next action, dated outcome. Entry IDs do not create real assignments.

## Hold and resume walkthrough — illustrative only

This is synthetic documentation, not an executed agent run or actual owner acceptance.

1. `EXAMPLE-ONLY` is assigned a bounded domain brief; its packet records input revision A, owned folder, report location and required capability X.
2. The brief's completed evidence E is saved. Capability X is unavailable: transition to `waiting-dependency`, name its provider, hold owner and exact release evidence. Preserve E and revision A.
3. A successor checks that the prior writer has handed off, reads the packet and verifies the dependency against current revision B. If E's inputs changed, recheck affected claims before reusing E.
4. Once the release condition is evidenced, record the transition and resume only the packet's next unfinished action. Implementation, integration and acceptance remain separately reported.

This describes the record shape on paper; it is not a completed filled-out exercise. Setup chats may exercise sample records and component behavior during construction. No validation task should launch the first MC agent before the system is fully built (D-004). Live controller rehearsals and their receipts are deferred until then.
