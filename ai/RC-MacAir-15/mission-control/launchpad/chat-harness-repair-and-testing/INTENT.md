# Chat Harness Repair and Testing — owner intent

> Owner-directed purpose and sequence; detailed repair mechanisms are unresolved.

## Outcomes

Provide a distinct home for OpenCode harness repair/testing after the last build is fixed. See [D-001](DECISIONS.md#d-001--create-the-follow-on-harness-home) and [REF-001](REFERENCES.md#ref-001--owner-folder-and-sequencing-direction).

Bring the existing failure-mode work into this folder and ticket while the current-build folder continues its repairs. Preserve the original evidence and distinguish controlled observations, source-backed gaps and unresolved incident attribution. [D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket) authorizes this evidence intake now.

## Boundaries

Integration and Retirement keeps the current last-build job, including its necessary repairs, verification and existing acceptance requirements. This home owns subsequent broader harness work. The split preserves historical evidence, approvals and task identities; it does not approve a harness redesign or resume an existing task. Prepare project folders one at a time, as the owner requested.

## Success and unresolved detail

Preparation succeeds when the ticket provides a usable account of all six retained findings, their source locators, evidence limits and remaining checks, with the current-build/follow-on boundary explicit. Product success criteria, the first repair, testing matrix and supported modes remain open. The prior source discussion requested one issue at a time; structured-error translation was the first discussed item, with no repair approval recorded in the inspected packet. Controlled historical failures do not establish the owner's live incident cause.
