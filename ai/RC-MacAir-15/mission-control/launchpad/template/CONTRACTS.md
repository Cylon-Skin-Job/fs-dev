# CONTRACTS — Shared guarantees template

> Inert starter: adapt to the assigned subject. Durable behavioral and interface guarantees with explicit authority. Proposed contracts stay proposed; a statement here neither approves implementation nor proves adoption. No contracts exist in this template.

Use `CT-` IDs within stable H2 categories. H4 subsections inside a record may expand examples, failure behavior or compatibility when needed. Required bold-label bullet fields: **Category**, **Status**, **Source**, **Authority**, **Applies to**, **Guarantee**, **Boundaries**, **Verification**, **Adoption**, and **Related**. Status is proposed, established, superseded, or withdrawn. Established requires a cited owner decision or applicable normative source; adoption is separately evidenced, partial, unverified, or not applicable.

Authority identifies the source and exact approved scope; a code observation alone cannot establish desired behavior. Applies to names responsible producers/consumers or roles. Guarantee states observable behavior or an invariant; Boundaries includes exclusions and unresolved branches. Verification describes how the guarantee could be checked and links any actual evidence. Missing choices remain linked issues, not implied promises. Link superseding records without deleting prior contract history.

## Product Behavior and Interaction

What consistent behavior may users rely on across features or surfaces? Express outcomes and invariants before prescribing implementation. Preserve exceptions and identify undefined behavior for discussion.

## Interfaces and Data Exchange

What do APIs, events, components or integrations promise to their consumers? Identify inputs, outputs, ownership and relevant failure semantics at the depth justified by the current stage. Keep small data shapes here; use SCHEMA only when persisted structure needs independent treatment.

## State, Lifecycle and Compatibility

What must hold across persistence, reloads, cancellation, upgrades, migrations or consumer versions? State dependencies and limits where grounded. Do not infer that an established guarantee has already been implemented everywhere.

## Documentation and Evidence

What rules govern claims in the wiki, source attribution, current-versus-target behavior and evidence freshness? Cite existing applicable standards rather than inventing new owner policy. Map affected documentation through CHANGE_SURFACE.

## Workflow and Coordination

What must hold across agent assignments, handoffs, owner decisions and dependent work? Link shared MC contracts instead of copying them into conflicting local versions. Proposed workflow changes remain subject to their actual authority.

## Verification and Acceptance

What evidence must accompany a claim of completion or consumer adoption? Keep observable success, performed checks and owner acceptance distinct. At First Draft depth, a plain-language scenario can be enough; executable procedures belong in the later planning stage when their prerequisites are settled.
