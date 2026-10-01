# Authority and decisions

## Precedence and evidence

New explicit owner direction supersedes only the exact contract it addresses. Source code is a feasibility constraint, not product intent. Prior measurement reports and this author's diagnoses are evidence to test, not authority to force a particular implementation.

| ID | Classification | Contract | Status / propagation |
| --- | --- | --- | --- |
| AR-D01 | owner_decision | Design a roadmap: reproduce bugs first, then refactor affected responsibilities with their fixes | validated; all SPECs |
| AR-D02 | owner_decision | Defer the bounded memo patch; review architecture and God-file concerns | validated; ARCHITECTURE, 03–05 |
| AR-D03 | owner_decision | Preserve the September 19 view-bound production direction and unrelated work | validated; all SPECs; source is attached brief and conversation |
| AR-D04 | spec_contract | Server acceptance commits the user bubble; Stop persists partial output; exact thread/turn/sequence owns streams | validated; 02,04,05,06; ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-02-COMPOSABLE-CHAT-SURFACES.md and RCC-0108 references in BUNDLE-INDEX |
| AR-D05 | source_of_truth_contract | One responsibility; connected hosts may use established actions but do not absorb independent policies | validated; standards hub, 03–05 |
| AR-D06 | spec_contract | Keep eager New Chat, group-backed peer sessions, content-only worksurfaces and trusted shell authority | validated; previous roadmap SPEC-00–04 and DECISIONS CHAT-RD-008/010/011 |
| AR-P01 | proposal | On uncertain Send, recover authoritative status before permitting a resend; never automatically replay provider work | awaiting_owner; SPEC-02 and ARCHITECTURE adopt recommended candidate behavior, not implementation authority |
| AR-P02 | proposal | Pending-acceptance indicator expires to visible recovery status at 15 seconds; text becomes editable, resend remains gated until outcome is known | awaiting candidate approval; SPEC-02 |
| AR-P03 | proposal | Quantified rendering and sustained-input release gates, including a 45-minute soak and final owner symptom acceptance | awaiting candidate approval; VALIDATION, SPEC-06 |
| AR-C01 | active_code_constraint | 88637d1 plus uncommitted view-bound host bytes is the development baseline; earlier slow-render defect exists at 501eb35 | recorded; SOURCE-BASELINE.json, SPEC-01 |
| AR-C02 | active_code_constraint | Current prompt acknowledgement has no attempt identity; pending state precedes a transport function that can silently return | recorded; SPEC-02 requires a correlated submission contract |
| AR-C03 | active_code_constraint | ThreadManager.addMessage currently increments counters; it does not persist the full accepted prompt/exchange | recorded; receipt persistence must not be mistaken for existing transcript durability |
| AR-C04 | active_code_constraint | Source-level global action consumer exclusion and listener lifetime hazards need runtime reproduction | recorded; SPEC-01 and 03 |
| AR-I01 | implementation_choice | Focused modules, narrow dependencies and consumer-level subscriptions; exact filenames may change with documented integration | all SPECs; behavior/ownership remain fixed |

## Genuine pending choice

AR-P01 was put to the owner during planning. Recommended: preserve text and recover server status before enabling resend, preventing duplicates. Alternative: permit manual resend while status is uncertain with a duplicate warning. The latter requires revising SPEC-02's user-facing recovery gate, tests and final criteria before approval. Silence is not acceptance. Approval of an exact candidate explicitly including AR-P01–P03 may resolve those proposals together; the manifest must record that receipt.

## Supersessions proposed for this candidate only

The single aggregate ChatSurfaceModel/connected-host implementation shape in previous SPEC-02 is replaced by smaller presentation contracts and explicit consumer subscriptions. All identity and shared-session-truth semantics remain. Legacy production event listeners/global-current targeting are replaced in SPEC-03, not retained as a fallback. New 15-second uncertainty UI and correlated attempt receipts supplement existing acceptance semantics; they do not make client timers authoritative about rejection or guarantee provider exactly-once execution.

## Preserved scopes and exclusions

No Fork, cloned context, pending-new-chat redesign, provider change, generic plugin/event-bus architecture, Office SPEC-12 adoption, automatic database wiping, or Alpha deployment. Existing null-view durable records are preserved. They do not authorize a hidden Legacy production host or new null-view thread creation. This program does not redefine historical link/export/delete semantics merely to remove a module name.
