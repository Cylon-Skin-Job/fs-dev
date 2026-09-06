# TABS-03 Decision Ledger

**Updated:** 2026-09-04

| ID | Decision | Classification | Authority | Effect |
|---|---|---|---|---|
| TTP-D01 | Every placeable target has explicit `presenterId + targetKey`; labels, icons, breadcrumbs, filenames, extensions, and path display are never matching authority. | `owner_decision` + `spec_contract` | TPC-D03, TPC-D11; TABS-02A §11.1 | Defines exact-match identity. |
| TTP-D02 | Exact existing-target resolution runs before requested disposition. An existing exact target is activated and asked to reveal/recenter even when the source requested `new`. | `owner_decision` + `spec_contract` | Vision D-138; TABS-02A §11.1 | Prevents duplicate exact targets. |
| TTP-D03 | `current` may fill the active tab only when it is Empty and unreserved. It never replaces populated content. Otherwise placement appends. | `owner_decision` + `spec_contract` | Vision D-137, D-140; TABS-02A §11.1 | Makes Open in Current non-destructive. |
| TTP-D04 | `new` appends only when no exact existing target is open. | `spec_contract` | TABS-02A §11.1 | Preserves dedupe while honoring disposition for new targets. |
| TTP-D05 | The connected controller, not the source or presenter resolver, mints `tabId` and `componentInstanceId`. | `implementation_choice` | TABS-01 identity authority and state-ownership rules | Prevents caller-selected identity collision or impersonation. |
| TTP-D06 | Direct placement uses a synchronous, code-owned resolver returning a fully known target projection. It does not enter the asynchronous Empty-launch reservation state machine. | `implementation_choice` | TABS-02A direct-placement boundary; active lifecycle API | Keeps placement deterministic and avoids duplicating launcher behavior. |
| TTP-D07 | A pending or failed reservation makes an Empty tab unavailable to direct placement. Placement appends and never cancels, consumes, retries, or overwrites that reservation. | `implementation_choice` | Accepted TABS-01 reservation ownership | Prevents stale completion and cross-route races. |
| TTP-D08 | Multiple open records with the same `presenterId + targetKey` are an invalid ambiguous state. The controller fails closed without mutation or reveal. | `implementation_choice` | Exact-match contract and fail-closed standards | Avoids silently selecting corrupt authority. |
| TTP-D09 | Exact-target matching occurs before target resolution. A valid existing match activates even if the resolver would currently be unavailable; only a request requiring fill/append invokes the resolver. | `implementation_choice` | Exact-existing-target priority and progressive-disclosure behavior | Avoids making existing content depend on unnecessary creation work. |
| TTP-D10 | Existing-target activation commits before presenter reveal/recenter. A reveal failure does not roll back activation; it returns a bounded safe outcome. | `implementation_choice` | Presenter-owned navigation and non-destructive UI behavior | Keeps the correct tab selected without exposing raw errors. |
| TTP-D11 | `requestId` is validated correlation only in TABS-03. Durable idempotency, timestamps, actors, event publication, and causal claims belong to BRIDGE-01/Provenance. | `owner_decision` + `spec_contract` | Shared Interface Contract; provenance scope rulings | Prevents accidental parallel provenance authority. |
| TTP-D12 | TABS-03 introduces no store. Its pure transition is applied once by the already-connected tab owner so tab content, presentation projection, order, active identity, and reservations remain one atomic state boundary. | `implementation_choice` | State-management standards; TABS-01/TABS-02A contracts | Avoids split-brain UI state. |
| TTP-D13 | TABS-03 ends with a virtual/public-path test adapter, not a production view adopter. | `spec_contract` | TABS-02A non-goals and dependency ledger | Keeps the package independently reviewable. |
| TTP-D14 | Invalid or identity-mismatched resolver output fails closed. It never alters or invalidates an exact target that was already matched before resolution. | `implementation_choice` | Validation standards and TTP-D09 | Contains first-party resolver defects without weakening existing-tab activation. |
| TTP-D15 | Each connected tab host serializes the validate/match/resolve/plan/commit portion of placement against its latest committed state. Presenter reveal occurs after that serialized commit and does not hold the placement lane. | `implementation_choice` | Single-owner state standards and exact-target dedupe | Prevents concurrent requests from creating duplicate targets without adding a global service. |
| TTP-D16 | Structurally invalid, legacy, or unaddressed content/presentation records are preserved as placement-unavailable protected tabs and skipped for matching/fill. A structurally valid addressed component and correlated shell remain eligible for exact matching even when their current rendering resolver/body is unavailable. Invalid collection identity/reservation envelopes still fail closed. | `implementation_choice` | TABS-01 stable descriptor identity; TABS-02A invalid-body containment; exact-target priority | Preserves recoverable chrome without allowing transient rendering availability to duplicate a valid exact target. |
| TTP-D17 | A placement commit is acknowledged and atomic: failure leaves state unchanged; success returns a validated snapshot containing the exact transition. The controller holds its per-host lane until that success is observable or a failure is final. | `implementation_choice` | State standards and TTP-D15 | Makes concurrency and `state_commit_failed` executable. |
| TTP-D18 | Resolver-supplied tab display fields use exact closed shape and explicit existing generic-host/presentation byte bounds. JSON input may contain URL strings as inert data, but no URL or display value becomes identity or authority. | `implementation_choice` | Validation standards and generic-host JSON contract | Closes hostile/oversize display handling without narrowing valid JSON. |
| TTP-D19 | Failure correlation echoes `requestId` only when it is independently recoverable as a valid own enumerable data property; otherwise the failure uses `null`. | `implementation_choice` | Safe request validation and correlation | Makes malformed-envelope responses deterministic without invoking getters. |

## Owner decisions required

None inside this package. The owner accepted the completed TABS-02A
implementation on 2026-09-04. The owner must still:

1. approve the exact TABS-03 candidate before dispatch; and
2. later choose the first production adopter and the complete pre-Chat tab
   milestone.
