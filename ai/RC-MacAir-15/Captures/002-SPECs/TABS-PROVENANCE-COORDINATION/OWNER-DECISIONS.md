# Owner Decisions and Open Rulings

**Updated:** 2026-09-04  
**Purpose:** record cross-lane direction without rewriting owning SPECs

## Active owner direction

| ID | Direction | Cross-lane effect | Source |
|---|---|---|---|
| TPC-D01 | Tabs are intended to become the default content interface. | Later roadmaps must treat tab adoption as the common view path rather than a view-specific feature. | Owner conversation, 2026-09-03 |
| TPC-D03 | Landing-presenter content normally follows preview then Open in New Tab. | Placement keeps source-preview and destination-tab context distinct. | Owner conversation, 2026-09-03; terminology reconciled by TPC-D11 |
| TPC-D04 | Wiki has no separate landing/depth mode; its top article and navigation are a registered Wiki presenter target. | Wiki uses the universal one-tab header and location rail; plus may add another configured Empty container without creating a Wiki-specific shell mode. | Owner conversation, 2026-09-03; presentation reconciled by TPC-D11 |
| TPC-D05 | Empty tabs receive configured buttons that load permitted tab content. | Configuration projects launcher choices; the empty tab itself does not own execution authority. | Owner conversation, 2026-09-03 |
| TPC-D06 | Existing views should be remade one by one after shared groundwork. | Each view receives its own adoption SPEC and dependency gate. | Owner conversation, 2026-09-03 |
| TPC-D07 | Tabs, Provenance, and portable/grouped Chat require explicit coordination while their foundations advance. | This folder tracks handoffs, dependencies, and blockers without widening active packets. | Owner conversation, 2026-09-03 |
| TPC-D08 | Chat implementation is blocked by both Provenance and Tabs and should conform to the shared decisions made here. | Composable Chat cannot dispatch from its current pre-bridge dependency declaration; it must consume an approved Tabs/Provenance integration contract and pass affected review first. | Owner conversation, 2026-09-03 |
| TPC-D09 | Accept the completed SPEC-01 Agent Tool Provenance implementation. | PROV-01 is an accepted foundation for BRIDGE-01; this does not by itself unblock Chat or declarative view conversion. | Owner conversation, 2026-09-04 |
| TPC-D10 | Accept the implemented Tab Shell Presentation Foundation, including its reviewed repairs, compatible deviations, lack of a production adopter, and owner-verified working-tree gates. | TABS-02 remains the accepted historical implementation baseline. TPC-D11 inserts corrective TABS-02A before TABS-03; the aggregate-fingerprint discrepancy remains accepted bookkeeping. Commit and publication remain separate. | Owner conversation, 2026-09-04; sequence updated by TPC-D11 |
| TPC-D11 | Use one universal header model: every sole tab has centered short identity and view icon; every active tab has a breadcrumb location rail; optional history is presenter-owned; landing behavior is not a shell role. | TABS-02A supersedes downstream use of TABS-02's Home/Content role split and must be accepted before TABS-03. Display labels never replace `presenterId + targetKey`. | Owner conversation, 2026-09-04; Vision D-173 |
| TPC-D12 | Complete and accept the owner-defined tab platform milestone before beginning Composable Chat. | Chat is not the first production component-host consumer. Presentation, placement, control-plane/configuration, and the owner-selected first-party tab adoption work remain ahead of Chat; the exact milestone membership must be fixed before Chat dispatch. | Owner conversation, 2026-09-03 |
| TPC-D13 | Accept the implemented Universal Tab Header and Location Rail package, including its reviewed repairs, compatible deviations, deliberate lack of a production adopter, and independently repeated verification gates. | TABS-02A is the accepted uncommitted implementation baseline for TABS-03. The reviewed client-relative aggregate is `f91b7cb7eb6263040c39c1931fbeef401c68c98e4157476c32eb6636f2210a35`. Commit and publication remain separate. | Owner conversation, 2026-09-04 |

## Superseded owner direction

| ID | Direction | Superseded effect | Source |
|---|---|---|---|
| TPC-D02 | The visible paradigm had Home, Content, and Empty forms, with centered Home becoming a Home tab. | Superseded by TPC-D11. Empty remains lifecycle state, but Home/Content no longer select shell layout; tab count and the universal location rail do. | Owner conversation, 2026-09-03; superseded 2026-09-04 |

## Open owner rulings

| ID | Question | Why it matters | Earliest blocking package | Status |
|---|---|---|---|---|
| TPC-O01 | Should Composable Chat remain the first production consumer after the generic host, or should Wiki become the first tab-native view? | TPC-D12 removes Chat from first-consumer consideration. Exact ordering among Wiki, File Explorer, Capture, and other tab adopters is tracked separately from this superseded binary question. | VIEW-WIKI / CHAT-01 execution order | superseded by TPC-D12 |
| TPC-O02 | Is `centered` formally derived layout while `home|content` are component presentation roles and `empty` is lifecycle state? | TPC-D10 records the accepted historical implementation; TPC-D11 removes Home/Content roles, derives single/tabbed identity from tab count, and retains Empty as lifecycle state. | TABS-02 / TABS-02A | superseded by TPC-D11 |
| TPC-O03 | Which tab/placement/navigation events require durable ledger history, versus remaining transient UI state? | Prevents high-volume focus/reorder events from overwhelming meaningful resource and action provenance. | BRIDGE-01 | open |
| TPC-O04 | What is the first bounded registration/permission package that satisfies the Provenance gate for declarative view conversion? | Agent Tool Provenance intentionally does not deliver component trust, consent, or dynamic registration. | PROV-02 and every declarative VIEW-* package | open |
| TPC-O05 | Which exact first-party adoption packages must be accepted before the owner considers the Tab Platform complete and releases Chat? | TPC-D12 fixes the ordering boundary but does not yet enumerate whether Wiki, File Explorer, Capture, or additional configured-view work is inside that milestone. | Pre-CHAT-01 acceptance gate | open |

## Ruling protocol

When the owner settles an item, record the exact decision and date here, identify affected ledger rows, and update the owning normative packet through its normal review/approval process. Do not silently reinterpret an existing approved candidate.
