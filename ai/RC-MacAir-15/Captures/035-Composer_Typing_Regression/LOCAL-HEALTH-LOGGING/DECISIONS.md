# Authority, decisions and bounded deferrals

## Owner decisions — propagated

| ID | Authority | Contract | State |
| --- | --- | --- | --- |
| HL-D01 | owner_decision | Build an actual separate local diagnostics store; not another `fusion.db` table. | validated |
| HL-D02 | owner_decision | Store behavior measurements only, not chat content. Character/byte/token counts have explicit distinct units. | validated |
| HL-D03 | owner_decision | Existing notes/bookmarks and personal history remain in the primary database under their existing owners. | validated |
| HL-D04 | owner_decision | Keep individual structured observations and sampled measurements; derive trends deterministically on query, not AI summaries or destructive rollups. | validated |
| HL-D05 | owner_decision | Oldest-first rolling retention bounded by the first of 2 GB, 30 days, or N events. High-volume early eviction is acceptable. | validated |
| HL-D06 | owner_decision | No export wiring now: no uploader, schedule, destination, go/skip endpoint, Server feature, plugin manifest or grants. Manual local queries only. | validated |
| HL-D07 | owner_decision | Scope to current dogfooding needs, with a way to add typed observations in later builds. | validated |
| HL-D08 | owner_decision | Future plugins cannot obtain more authority from Markdown instructions; physical separation supports a future permission boundary but is not itself enforcement. | validated |

## Engineering choices in this candidate

These are `implementation_choice`, not claims the owner selected exact constants. Approval of this candidate approves these defaults; evidence-supported revisions require a documented deviation and affected review.

- HL-C01: `health.db` in an isolated `diagnostics/` directory beside the primary DB's owning directory; own worker, schema versions and migrations. No primary migration.
- HL-C02: decimal 2 GB = 2,000,000,000 bytes total live diagnostic DB family budget; 30 × 24 hours; N = 1,000,000 retained event rows. Physical budget includes indexes and journal/WAL/shared-memory overhead, not only JSON payload size. No snapshots are created in this scope.
- HL-C03: at most one renderer sample per 250 ms per actively revealing/finalizing mounted surface; 5-second process-health samples; 30-second idle liveness; transitions captured separately. No synthetic samples for missed timer ticks.
- HL-C04: logging is locally enabled in the development runtime when this approved feature is integrated; an explicit host startup switch `FUSION_HEALTH_LOGGING=0` disables it for control tests/owner choice. The switch is not forwarded to provider children. No settings UI or general-release consent policy is implemented.
- HL-C05: closed typed event registry, 4 KiB maximum serialized row, 128-row/256 KiB renderer batches, bounded memory and worker IPC, fixed code catalog, no arbitrary JSON attributes or text fields.
- HL-C06: a profile-local random correlation key outside `health.db` maps exact existing route IDs to typed HMAC references. Manual local resolver takes explicit IDs; no primary-DB scraping, cross-store foreign keys, or persisted raw identity map. These references are pseudonymous, not anonymous. Clock, activity and size data remain sensitive metadata, even without content; upload policy is deferred.
- HL-C07: local read-only query CLI plus documented SQL, indexed metadata, no FTS/content index or analysis UI. New event families are code-reviewed/schema-versioned additions, not dynamic arbitrary plugin registration.

## Issue/contradiction ledger

| ID | Classification / impact | Resolution | State |
| --- | --- | --- | --- |
| HL-I01 | active_code_constraint: RD-02 contains native text and resets each turn | Leave it unchanged. Add numeric projections at source owners; do not serialize its buffers into the new store. B/C privacy tests cover coexistence. | validated |
| HL-I02 | source_of_truth_contract: server guidance routes System queries to one primary DB | Exact separate-store owner decision supersedes that rule only for platform health logging; primary ownership remains unchanged. | validated |
| HL-I03 | active_code_constraint: synchronous SQLite calls could disturb server or renderer | Writer/query/cleanup run outside interactive loops, bounded ingress and IPC; failure cannot change normal chat. Paired measurement gate in C. | validated |
| HL-I04 | implementation_choice: deleted rows do not necessarily shrink database files; WAL/readers can grow storage | Physical budget, reclamation, reader deadlines and admission stop required; tests check actual files, not SUM(payload). | validated |
| HL-I05 | active_code_constraint: UTF16 source, visible HTML and formatted tool output are not comparable lengths | Record units and mapping availability; no fictional tokenization, remaining-time prediction or subtraction across unequal units. | validated |
| HL-I06 | active_code_constraint: renderer/server clocks and multiple mounted chats differ | Per-source monotonic time + source/run identity, receipt time and sequence. Cross-process chronology is not latency proof. | validated |
| HL-I07 | active_code_constraint: current progress snapshot copies all segment records | Add an O(1)/bounded passive active-frontier numeric accessor if needed; no full transcript/surface scan every tick, no speed-policy change. | validated |
| HL-I08 | owner scope: historical discussion suggested automatic pre-update snapshots | Not in today's store/manual-query scope. Build/run identity retained; snapshot/export scripts deferred. No hidden archive subsystem. | deferred |
| HL-I09 | active_code_constraint: live SPEC-06/shared dirty worktree | Dispatch only after exact baseline inventory and one code/runtime owner handoff; no reset or implication of SPEC-06 acceptance. | validated |
| HL-I10 | active_code_constraint: an offline reader cannot observe the host's disabled switch | Manual status reports store availability and last recorded evidence; live enablement/liveness unknown. No added status service or disabled-state artifact. See SPEC §7 and V9. | validated |

Validated here means the planning resolution has been propagated and source-audited; implementation remains unbuilt. Exact-candidate independent review is recorded in the release manifest.

## Non-blocking deferrals and future gates

- Plugin packaging/sandbox/capability enforcement, beta distribution/general-release consent: owner/plugin program, before enabling third-party access. Current platform module is not a sandbox certification.
- Folder sharing, weekly upload, server go/skip policy, destination credentials, uploaded-folder cleanup: owner/Fusion Server program, after explicit approval and Server/plugin foundations. No network upload now.
- Pre-update snapshots/export, imported historical recordings, cross-installation instance identity: owner/future tooling. Do not import content-bearing NDJSON test recordings.
- New bookmark/notes UI or persistence: existing metadata owners; no change needed for this SPEC. Explicit identity resolver makes local cross-check possible without moving their text.
- All-app telemetry, long-term trend dashboards, arbitrary tool-name reporting, full provider-native counts and provider usage integration: later typed families only when grounded. Current version logs canonical output counts and tool lifecycle without identifying arbitrary tool names.
- Broader CHAT-AR 06B soak/original-symptom acceptance and 06C: existing roadmap owner; this SPEC's tests do not substitute for those gates.

No additional product question blocks drafting. Candidate approval remains required before implementation.
