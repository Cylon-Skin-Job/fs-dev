# Authority, decisions and issues

Authority order: explicit latest owner direction for the exact subject; approved/source-of-truth contracts for unaffected subjects; code as evidence of current behavior, never proof of desired intent. Archive records retain provenance but do not override the newer decisions. The owner accepted the preceding architecture recommendation with “This is exactly what I want” and requested wiki codification on 2026-09-23. This ledger records that accepted meaning, not a verbatim rendering of the owner's illustrative UI description.

## Owner decisions — propagated_pending_review

| ID | Authority | Required meaning |
|---|---|---|
| D01 | owner_decision | Codify the model in the wiki, separating established current facts, approved intended behavior and unresolved work. Documentation only. |
| D02 | owner_decision | Platform shell hosts tabs, drawers and popup/window surfaces and owns navigation/focus/container lifecycle. Content inside a container is separate from its host. |
| D03 | owner_decision | Platform services own controlled data access/persistence/actions; renderer components draw UI. “Platform-owned” does not mean every UI component executes on the server. |
| D04 | owner_decision | Ship a useful standard presentation library, not a separately installed plugin for each button or field. Plugins can package compositions and contribute reusable presentation components through a defined host contract. |
| D05 | owner_decision | Three customization levels: configure standard components; compose them declaratively; add specialized executable components in protected plugins. Editable instance configuration cannot create executable authority. |
| D06 | owner_decision | Shell and canonical file surface/type registry remain platform-owned. Collections may open that file surface in the current tab with a return route or in another tab. Collection selection/filter/history and file editing/persistence retain their respective owners. No alternate file-save implementation. |
| D07 | owner_decision | A protected view plugin contains server-interpreted contributions/implementation and a template. Server provisioning copies template payload into a separate editable instance, binds to installed plugin and initializes config/state. Workspace plugins select view dependencies/instances. |
| D08 | owner_decision | Templates carry persona, AGENTS.md, relevant skills, workflows/sub-agent definitions where applicable. The instance is agent-editable outside System. Exact destination remains open. Protected plugin powers and user-mediated edit route remain distinct. |
| D09 | owner_decision | Agent starts with view-instance CWD and project-root orientation/access, subject to protected System/plugin boundaries. Own AGENTS/persona enter harness context; own skills are available through the harness with bodies loaded as needed. Other views' instructions/skills are manually read when asked, not all automatically injected. This does not automatically rebind identity, change CWD, or grant powers. |
| D10 | owner_decision | Custom iframes remain an escape hatch and can participate in a hybrid composition: standard platform pieces beside a custom region, plus narrow platform-operation requests. A separate UI library running inside iframes is deferred, not a required first implementation. |
| D11 | owner_decision plus source_of_truth_contract | App-owned files/SQLite remain separate from System storage. Authorized commands/adapters execute mutations; provenance records actual outcomes; the bus distributes facts. A logged tool call is not proof a write succeeded. Preserve required prewrite protection and postwrite recovery distinctions from current UEB authority. |
| D12 | owner_decision | Predictable maintenance uses scripts/tools and plugin-provided instructions. This is not permission to replace server provisioning, validation, or authorization with an ad hoc AI ritual. |

## Exact reconciliations

- Original VISION §4.5's fixed UI inventory/iframe-only extension interpretation is superseded by D04/D05/D10. Capture030 PLUG-D005 continues to govern canonical file-type registration and file-detail rendering; its phrase “plugins do not register renderers” must not be generalized to prohibit specialized presentation components. Extending cards/layouts is not replacing the canonical file renderer.
- Older category-folder paths and thin System capsules are not copied as the target. Original VISION §4.4 records flat installation categories derived from declarations; §4.14.1 records copied editable instances. Exact grammar and machine-scope placement remain open; illustrative names are not a completed schema.
- WV-O06's intended orientation is now settled by D09; harness-specific discovery, assembly, conflict handling and enforcement remain unresolved. Preserve WV-G04 as an implementation gap. Do not require a skill override/precedence model; availability and explicit manual use are the intended distinction.
- Older collections-never-open-files-in-place/raw-only-edit wording cannot prohibit D06's current-tab file surface. This decision does not redesign the canonical editor's mode/save rules.
- Preserve current Chat contracts: side chat is a session tab, not a new left thread list; retain the right list button, do not restore the removed left slider as a target; generic non-chat popup/window use is separate. Illustrative “side agents”/drawer examples do not establish a new launcher inventory or list-button behavior.
- Archive provenance proposals (blanket fail-open, raw bus access, proposed envelopes/executors) do not override the current Events And Ledger decisions. No new generic publisher API is implied.
- No old Plugins View mockup, backend process-per-database rule, inbox-plugin proposal, notification learning, distribution marketplace, or deployment schedule is adopted here.

## Nonblocking open gates — deferred

Each remains owned by the product owner with engineering research supplied by its named subsystem. Document uncertainty; do not choose defaults to make prose appear finished.

| ID | Choice still open | Owner/subsystem and trigger |
|---|---|---|
| O01 | Exact plugin/template/instance folder and manifest schema, shared versus machine-specific instance placement | Plugin/workspace owners, before provisioning/relocation implementation (WV-O01/O04). |
| O02 | Component registration/host ABI, supported props/actions/data shapes, version compatibility and execution/isolation mechanism | UI/platform/plugin owners, before loading contributed executable components. No assumption of arbitrary in-process React imports. |
| O03 | Missing/disabled/incompatible dependencies, customized-template updates, removal and migration semantics | Plugin/workspace owners, before instance lifecycle implementation (WV-O02/O03). |
| O04 | Harness-specific CWD, discovery/injection, skill collision handling and enforcement mechanics | Harness/context owners, before claiming D09 works end to end (remaining WV-O06). |
| O05 | Iframe bridge transport, authentication/authorization, supported operations and optional iframe UI SDK | Platform/custom-view owners, before shipping bridge or SDK. |
| O06 | Exact initial component inventory, drawer content catalog, first conversion example and rollout order | Product owner, before product roadmap approval. Examples in articles do not set those choices. |
| O07 | Per-adapter application-store failure/retry/transaction/provenance integration beyond current trusted built-ins | Data/provenance owners, before general external-store mutation APIs. No cross-store atomicity promise. |

## Material issue ledger

I01 fixed inventory versus extensible presentation; I02 template versus privileged code; I03 local context versus blanket injection/skill edit gate; I04 platform versus server wording; I05 commands/facts/external stores; I06 older drafts versus current independent programs. All are propagated_pending_review to D02-D11 and the mapped outputs. Preparation CLEAN validates the plan's handling, not the wiki implementation. Execution tracks each to validated with article/claim evidence; genuinely new product decisions become awaiting_owner and block only affected scope. Current missing implementation is an expected documentation output, not a blocker. Material unhandled live contradictions are blockers until scoped/resolved/reviewed.
