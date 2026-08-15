# RCC-0108 — Implementation Readiness Review Queue

**Parent SPEC:** `RCC-0108-chat-working-step-activity.md`

**Purpose:** Closed record of the material implementation decisions resolved before the parent contract and implementation package were marked `READY FOR IMPLEMENTATION`.

**Rule:** Work through this list in numeric order. For each item, record `ACCEPTED`, `REVISED`, or `REJECTED` with the owner decision and date. Do not silently reinterpret an accepted item during implementation.

## Review status

| ID | Topic | Status |
|---|---|---|
| R1 | Intentional combined scope and implementation packaging | REVISED — OWNER CONFIRMED 2026-07-21 |
| R2 | Runtime owner, drain identity, and stream frontier | ACCEPTED WITH CLARIFICATION — OWNER APPROVED 2026-07-20 |
| R3 | Step identity, lifetime dedupe, and timestamp boundary | ACCEPTED — OWNER APPROVED 2026-07-21 |
| R4 | Blank thinking/content suppression | ACCEPTED — OWNER APPROVED 2026-07-21 |
| R5 | Safe terminal-error catalog and redacted diagnostics | ACCEPTED WITH ADDITION — OWNER APPROVED 2026-07-21 |
| R5A | Diagnostic persistence limits, retention, and retrieval | ACCEPTED — OWNER APPROVED 2026-07-22 |
| R6 | Error finalization, reconnect, and deduplication | ACCEPTED — OWNER APPROVED 2026-07-22 |
| R7 | In-flight turn validation and post-terminal correlation | ACCEPTED — OWNER APPROVED 2026-07-22 |
| R8 | Pre-40b2 event-bus and redaction posture | ACCEPTED — OWNER APPROVED 2026-07-22 |
| R9 | Required modularization | ACCEPTED — OWNER APPROVED 2026-07-22 |
| R10 | Verification depth and gate order | ACCEPTED — OWNER APPROVED 2026-07-22 |

## R1 — Intentional combined scope and implementation packaging

**Status:** REVISED — OWNER CONFIRMED 2026-07-21

The owner confirmed that prompt-bound routing, thread/turn helper isolation, Working activity, empty-output suppression, durable terminal errors, and user-invoked redacted diagnostics intentionally form one product outcome. On 2026-07-21 the owner revised the earlier one-SPEC implementation constraint: after the decision queue closes, the approved scope may be reorganized into a dependency-ordered roadmap and multiple implementation SPECs if that creates safer ownership and gates. Repackaging cannot omit or reinterpret an approved invariant.

## R2 — Runtime owner, drain identity, and stream frontier

**Status:** ACCEPTED WITH CLARIFICATION — OWNER APPROVED 2026-07-20

**Current proposed SPEC decision:** `ThreadRuntimeManager` is the only mutable canonical turn owner. Every accepted iterator gets a UUID `drainId`; the manager binds its server `turnId` once and uses compare-if-current mutation, stop, terminalization, and cleanup. The live snapshot is only a serializable projection.

**Owner decision:** Accept the single-owner and `drainId` contract. Preserve the existing monotonic `LiveTurnSnapshot.streamSeq` as the authoritative whole-turn stream frontier rather than inventing a duplicate stream revision. Returning to a thread must use the server's current frontier: a completed or terminal result renders immediately, while an in-flight snapshot through sequence `N` is an already-revealed baseline and only later mutations animate. Snapshot/live-message races must produce no gaps or duplicates. Fine-grained cosmetic treatment at the catch-up boundary is deferred to linked ticket RCC-0112; the correctness invariant remains in RCC-0108.

## R3 — Step identity, lifetime dedupe, and timestamp boundary

**Status:** ACCEPTED — OWNER APPROVED 2026-07-21

**Current proposed SPEC decision:** The adapter preserves a finite numeric native `timestamp` exactly and omits missing/non-numeric/non-finite time; the bridge preserves that optional field. Before display-time normalization, the applier derives a stable source identity from `stepId`, `messageId`, or the preserved finite timestamp and checks it against a no-eviction full-turn seen ledger, so A → B → delayed-A remains a duplicate. It then derives `startedAt` once and emits the explicit server identity, `startedAt`, and monotonic `activityRevision`; an event with no stable identity source is ignored and retains fallback orb behavior. Snapshot and affected live messages carry the revision. The client unions ledgers but changes activity/cursor only for a strictly greater revision, preventing an old snapshot from regressing a newer step or resurrecting Working after live output cleared it. The visual timer reports truthful elapsed time, so its first visible label may be greater than `0s` after orb or tool reveal delay.

**Owner decision:** Accepted as proposed. Use stable source identity before time normalization, retain identities for the full active turn, use monotonic `activityRevision` for Working-state projection, keep the orb fallback when no replay-stable identity exists, and display truthful elapsed time even when the first visible value is greater than `0s`.

## R4 — Blank thinking/content suppression

**Status:** ACCEPTED — OWNER APPROVED 2026-07-21

**Current proposed SPEC decision:** Whitespace-only thinking or content that would create a new part is suppressed before accumulation, snapshot, broadcast, or persistence and does not clear Working. Once a real same-type part exists, subsequent chunks—including whitespace—are preserved exactly.

**Owner decision:** Accepted as proposed for both thinking and assistant content. Suppress a whitespace-only chunk only when it would create a new part; once real same-type content exists, preserve later chunks exactly, including whitespace.

## R5 — Safe terminal-error catalog and redacted diagnostics

**Status:** ACCEPTED WITH ADDITION — OWNER APPROVED 2026-07-21

**Owner decision:** Approve the four fixed safe transcript outcomes exactly as proposed: authentication failure, model timeout, harness exited, and generic model-response failure. OpenCode translates its native authentication, timeout, and process-exit signals to a closed provider-neutral `HarnessRuntimeError` marker at the adapter boundary; shared code never parses raw provider errors. Every catalog outcome remains recoverable, and Stop remains interrupted rather than failed.

**Approved addition:** Add a separate diagnostic path without replacing or weakening the safe catalog. The OpenCode boundary may derive a bounded redacted diagnostic candidate from the actual native failure text and structured process/provider context. A bound server diagnostic service validates and persists only that safe projection in a dedicated diagnostics table, returns an opaque `diagnosticId`, and discards the raw capture. The ordinary transcript and exchange metadata receive only the fixed catalog envelope plus that ID. The user may explicitly retrieve the redacted report to view, copy, or place into the composer for AI-assisted troubleshooting; it is never automatically sent to a model. Diagnostic persistence failure cannot block or rewrite terminalization.

## R5A — Diagnostic persistence limits, retention, and retrieval

**Status:** ACCEPTED — OWNER APPROVED 2026-07-22

**Current proposed SPEC decision:** The diagnostic record uses a dedicated migration and owning server service rather than `event_log` or `exchanges.metadata`. The adapter constructs only the closed V1 fields; it never traverses or serializes an `Error` or provider object. Before persistence, the server replaces exact configured secret values and sensitive environment values, redacts credential/token/private-key patterns and URL userinfo, rewrites the user-home and project-root prefixes to `$HOME` and `$WORKSPACE`, and removes disallowed control characters. If redaction fails, it omits all free-form text and retains only validated structured fields.

Proposed bounds are 128 UTF-8 bytes for each short identifier, a 4 KiB prefix for `message`, a 16 KiB tail for `stderrExcerpt`, at most 16 fixed-name `truncatedFields` entries, and 24 KiB for the final serialized report. Retain records for 30 days, at most 500 rows per workspace and 5,000 total. In one transaction before/with each insert, purge expired rows and then evict oldest rows to both caps; run the same cleanup at startup. Cleanup/insert failure rolls back the diagnostic write and terminalization proceeds without an ID. Retrieval returns one report of at most 24 KiB after exact route/turn/ID ownership validation. “Ask AI” places the report into the composer for review and never sends automatically.

**Owner decision:** Accepted as proposed: structured-only fallback on redaction failure; 4 KiB message prefix, 16 KiB stderr tail, and 24 KiB total report; 30-day retention; 500 rows per workspace and 5,000 total; transactional cleanup at startup and insertion; exact route/turn/ID retrieval ownership; and composer-only Ask AI behavior.

## R6 — Error finalization, reconnect, and deduplication

**Status:** ACCEPTED — OWNER APPROVED 2026-07-22

**Current proposed SPEC decision:** Error turns use immediate partial flush: queued output becomes instant completed rendering, followed by one turn error and reply chrome. A normalized terminal error remains in a terminal live snapshot until durable save catches up, and save acknowledgement merges metadata without adding a second row.

**Owner decision:** Accepted as proposed. On failure, immediately reveal and finalize all received partial output, render exactly one terminal error before reply chrome, retain the terminal snapshot through the durable-save race, and merge the eventual save acknowledgement without duplicate content or error rows.

## R7 — In-flight turn validation and post-terminal correlation

**Status:** ACCEPTED — OWNER APPROVED 2026-07-22

**Current proposed SPEC decision:** `turn_begin` is a separate initialization transition: an empty addressed panel initializes, a same-`turnId` duplicate is idempotent, and a different active `turnId` is rejected. Every later in-flight drain message through `turn_end`, including `status_update`, carries `threadId` and `turnId`; the client drops wrong-turn live messages before any store/helper mutation. Tool arguments, grouping, and subagent state are keyed by both identities. Post-terminal `chat-turn:saved` and metadata acknowledgements are explicitly exempt from the live-current-turn gate: they correlate to pending/completed messages by `threadId + turnId` or `threadId + exchangeId` after `currentTurn` clears and cannot mutate live helpers.

**Owner decision:** Accepted as proposed. Require explicit matching thread/turn identity for the complete in-flight live-message family before any store or helper mutation; isolate helper state by both identities; and preserve the separate post-terminal save/metadata correlation path after `currentTurn` clears.

## R8 — Pre-40b2 event-bus and redaction posture

**Status:** ACCEPTED — OWNER APPROVED 2026-07-22

**Current proposed SPEC decision:** RCC-0108 continues using the documented chat compatibility `chat:*` path and does not enter SPEC-40 canonical admission. Diagnostic persistence is a focused operational service, not a canonical UEB publication or `event_log` write. No inbound redaction-map entry is needed for outbound `step_begin`/terminal errors or the ID-only diagnostic request; the diagnostic response is already the validated safe report and must not be logged unless an outbound-specific redaction rule is added. Tests prohibit raw data in all lifecycle, diagnostic, persistence, and metadata outputs.

**Owner decision:** Accepted as proposed. Keep RCC-0108 on the established pre-40b2 `chat:*` compatibility path; do not claim canonical admission or accepted-only relationships; keep diagnostic persistence in its dedicated non-ledger service/table; and require the documented safe-output/no-raw-logging posture.

## R9 — Required modularization

**Status:** ACCEPTED — OWNER APPROVED 2026-07-22

**Current proposed SPEC decision:** One job per file controls. The implementation splits the oversized canonical applier, client types index, and stream handler only along separable domain boundaries. It honors the Code Standards' explicit `LiveSegmentRenderer.tsx — DO NOT SPLIT, breaks completion` exception: tightly coupled live orchestration stays together, while a pure `WorkingActivity` presentation child may be added without moving `LiveTextSegment`, `LiveToolSegment`, or completion detection. Every new/extracted file must finish at or below 400 lines; the named one-job renderer may remain above that guideline.

**Owner decision:** Accepted as proposed. Split the canonical applier, client types index, stream handlers, and new diagnostic responsibilities along their named one-job boundaries; keep every new/extracted file at or below 400 lines; and preserve `LiveSegmentRenderer.tsx` as the documented intact completion-pipeline exception with only pure presentation children extracted.

## R10 — Verification depth and gate order

**Status:** ACCEPTED — OWNER APPROVED 2026-07-22

**Current proposed SPEC decision:** The plan requires one non-mocked public prompt-route integration test, explicit message-router and broadcaster tests, timestamp and stale-drain edge coverage, automated Playwright coverage for every client acceptance scenario, client build before Playwright, and the full server suite last.

**Owner decision:** Accepted as originally proposed. Keep the full verification depth and gate order without adding a separate concurrency amendment. The owner will pause other SPEC implementation that would overlap the shared RCC-0108 server foundation while this work is active.

## Queue closed

All R1–R10 decisions, including R5A, are owner-resolved as of 2026-07-22.

## Final packaging outcome — 2026-07-22

**Status:** COMPLETE — READY FOR IMPLEMENTATION

The packaging review found that one cross-layer implementation SPEC would create overlapping ownership and unrunnable intermediate gates. The approved product contract therefore remains in the parent document and implementation is packaged into:

1. [RCC-0108 implementation roadmap](RCC-0108-ROADMAP.md)
2. [SPEC-01 — Runtime drain ownership](RCC-0108-SPEC-01-runtime-drain-ownership.md)
3. [SPEC-02 — Server step activity and stream frontier](RCC-0108-SPEC-02-server-step-frontier.md)
4. [SPEC-03 — Server terminal errors and diagnostics](RCC-0108-SPEC-03-terminal-errors-diagnostics.md)
5. [SPEC-04 — Client routing and frontier restoration](RCC-0108-SPEC-04-client-routing-frontier.md)
6. [SPEC-05 — Presentation, acceptance, and documentation](RCC-0108-SPEC-05-presentation-acceptance.md)

The final packaging also closes two technical execution gaps without changing product intent:

- every accepted in-flight publication now explicitly carries the authoritative resulting `streamSeq`, so snapshot/live buffering and deduplication have one implementable protocol;
- SPEC-04 creates the deterministic Playwright file and routing/frontier fixture before SPEC-05 extends and runs its Working and terminal-error cases.

The diagnostic contract now defines the closed sensitive-environment-key policy used by the approved exact-value redaction rule. Implementation may begin at SPEC-01 and must proceed in roadmap order without reopening the resolved product decisions.
