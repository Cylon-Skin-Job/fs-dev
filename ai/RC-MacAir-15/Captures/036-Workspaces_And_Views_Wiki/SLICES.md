# WV-01 slice packets

## Common requirements for every packet

Fresh spec-slice-builder per new slice; all descendants inherit the invoking root model and reasoning effort. Builder reads SPEC, decisions, validation, page map, applicable sources/standards and prior accepted evidence. It is not alone in the checkout: preserve other sessions' edits, adjust to newest bytes, never revert them. Own only mapped slice paths plus necessary capture-local evidence and the scoped integration permitted by SPEC. Any omitted integration must stay within that authority or be raised as a deviation/scope amendment.

Each builder self-reviews, runs required checks, records every deviation (including none), and obtains a fresh clean-room-reviewer review. Builder may spawn only fresh clean-room-reviewer threads, never another builder. Stop on first materially CLEAN pass; repair forward and use fresh reviewers otherwise, without an arbitrary pass ceiling. Return READY_FOR_ORCHESTRATOR_REVIEW only with exact hashes, evidence, warnings, source limitations and builder review.

The SPEC orchestrator independently inspects each result and obtains its own fresh clean-room-reviewer acceptance pass. Stop after first clean pass; otherwise route material repair through a builder, fresh builder-owned review and fresh orchestrator-owned review. Never substitute the builder review for acceptance. For final acceptance fixes reuse a repair builder where suitable; use a new builder for each new slice. Advisory-only findings may coexist with CLEAN. Report every deviation and downstream effect. Any supervisor must obtain explicit owner acceptance before a following SPEC.

## S00 — Freeze scope and establish checks

Prerequisite: approved candidate and current primary checkout. Own capture-local BASELINE.json, EXECUTION.md, source/claim inventory, validators and disposable fixtures only; no live wiki edits. Inventory all mapped pages and relevant code/template sources, protected Chat/Provenance and retained references; scan root retirement references repository-wide; record pre-existing broken links. Verify PAGE-MAP still fits actual files and no new nested AGENTS applies. Implement validate-wiki.py with VALIDATION.md's command interface and negative fixtures. Record exact source hashes/claim locations and machine/runtime limits. Acceptance: checks detect their specified invalid fixture conditions; baseline includes present and absent paths; no product/wiki mutation. This is an evidence slice, not a product vertical slice.

## S01 — Establish owner intent and canonical overview

Prerequisite S00 accepted. Own overview, new Vision and Decisions pages. Give conceptual definitions and reading routes; label planned links until their later-slice targets exist in staging only, not as a final completed claim. Record D01–D08 and O01–O06; supersede old thin/System-instance target precisely. Preserve independent plugin permission boundary and authority classification. Run slice validation: links to exact later-owned targets may be pending with explicit manifest entries until S05; all other checks must pass. Reviewer checks raw owner decisions, not a prior agent's desired interpretation.

## S02 — Explain workspace registration and provisioning

Prerequisite S01 accepted. Own Workspace Paradigm, View Architecture, Adding Workspaces, Workspace Compositions. Source-trace public UI/request → controller → registry/scaffolding/readiness → response/render as needed for claims. Explain actual registration versus server-owned target provisioning, five current defaults versus illustrative composition, unique view identity versus template id/fixed dispatch, content root versus capsule. Read actual tests as evidence of assertions only; don't imply they ran. Record demonstrated gaps WV-G01–03 provisionally, without choosing deferred policies. Run slice checks and semantic source review.

## S03 — Explain editable instances, context and state boundaries

Prerequisite S02 accepted. Own View Configuration And Agents, System Manager, Viewer Search, View Activity And Collections, and mapped bounded support pages with slice S03. Trace actual state writers/readers and harness launch where claims need them. Integrate newer outside-System target while preserving code-current paths and shared storage/history contracts. Keep accepted Chat details intact and link their authority; do not promise universal state restore. Identify context-loading and enforcement gaps without assuming all existing protections absent. Preserve unrelated shared-page paragraphs and report exact scoped diff. Run slice checks and both review levels.

## S04 — Build human-readable view introductions

Prerequisite S03 accepted. Own all S04 page-map entries. Census current bundled template manifests and mounted renderer routes, distinguishing installed workspace labels from type identities and defaults from optional views. Inspect domain code enough to substantiate each introduction, especially demo/placeholder/external-service claims. Catalog links to all 13 templates and System, existing specialist references remain read-only; no duplicated Office/Voice implementation manuals. Read Provenance calendar findings before summarizing storage; record fresh conflicts rather than overwrite its owner. Validate source/links/status coverage and get both reviews.

## S05 — Integrate gaps, navigation, metadata and final handoff

Prerequisite S04 accepted. Own Unfinished Work, Developer Map, section root retirement, mapped S05 support paths; integration changes to earlier rewritten/created pages limited to gaps, navigation, metadata and accepted-contract repairs via review. Produce bounded consolidated gap register, source map, staged generated navigation, incoming-link repair and retirement receipt. Normalize edited metadata and apply final timestamp pass. Validate final current bytes, inspect human reading routes and status wording, preserve specialist exclusions. Append final evidence rather than replace old reviews. Independently review the entire integrated SPEC output after all material edits/stamping; repair through builders until CLEAN. Publish HANDOFF.md with exact changed list, final hashes and final check/review outputs; no product implementation or next SPEC.
