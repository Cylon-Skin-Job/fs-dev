# ISSUES — Problems and unresolved intent template

> Inert starter: adapt to the assigned subject. Sourced problems, consequential ambiguity, missing intent and contradictions affecting this work. An issue records a problem or unresolved choice; it does not invent its answer or establish a software defect. No issues exist in this template.

Group by stable subject, not severity or status. Use neutral `I-` IDs and bold-label bullet fields: **Category**, **Type**, **Severity**, **Status**, **Source**, **Observation**, **Affected scope**, **Consequence**, **Resolution needed**, **Owner**, **Next**, and **Related**. Name a responsible role when a person/session is not yet assigned; do not fabricate identity.

Types: defect, inconsistency, contradiction, gap, risk, debt, ambiguity, missing_intent, interpretation_drift. Severity: blocking, high, medium, low, or unassessed. Status: open, awaiting_owner, investigating, deferred, resolved, or superseded. A suspected contradiction is labeled as possible in its observation; the sourced uncertainty is real even when the interpretation remains unsettled. Do not overstate confidence or make harmless exploration a blocker.

For conflicting statements, cite both passages with enough context to compare their subject and scope. Separate owner statements, assistant paraphrases and current code behavior. State the precise question and what each interpretation would change. For missing intent, identify the necessary choice, the sources checked and the gap; “not found in this interval” does not mean “never discussed.”

A clear owner revision belongs in DECISIONS with a supersession link. Open an issue if its meaning, impact or propagation remains unresolved. Resolution cites the decision or evidence and its affected-document updates. Deferral names the future decision point and affected readiness; it cannot hide a required choice in a supposedly ready SPEC. Casual exploratory questions stay in CAPTURE. Contradictions normally stay here as an issue type, not a separate CONTRADICTIONS document.

## Intent and Scope

Are desired outcomes, boundaries or success conditions ambiguous or missing? Has an assistant interpretation drifted from what the owner said? Which exact choice is needed to continue the affected work?

## Approach and Dependencies

Do proposed mechanisms conflict with established architecture, standards, prerequisites or consumer expectations? Identify evidence and uncertainty separately; use domain-specific categories as the project develops.

## Behavior and Verification

What observed behavior, integration risk or inability to demonstrate success threatens the stated outcome? Distinguish inspected code from tested behavior and proposed checks from executed checks.

## Documentation and Coordination

Which stale statements, conflicting records, lost source context or ownership gaps could mislead the next session? Temporary cross-session notices also belong in BULLETIN when its coordination threshold is met; link them instead of duplicating authority.
