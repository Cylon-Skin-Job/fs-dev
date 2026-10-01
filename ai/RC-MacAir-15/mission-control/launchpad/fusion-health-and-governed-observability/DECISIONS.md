# Owner decisions

> Explicit owner direction. Source is the supervisor conversation unless linked otherwise.

## Acceptance and follow-up

### D-001 — Close CHAT-AR with tracked residuals

Date: 2026-09-27 PDT.
Owner: “call SPEC 6 complete, with an addendum that ongoing logs will be tracked.”
Disposition: owner-accepted closure of SPEC-06/current CHAT-AR workstream, not a fabricated numerical/native/retirement pass. [Closure addendum](../../../Captures/035-Composer_Typing_Regression/ROADMAP/SPEC-06-OWNER-CLOSURE-ADDENDUM.md) owns acceptance evidence; I-001 and I-002 retain follow-up. The future logger is not current coverage.

### D-002 — Preserve ongoing dogfood observations

Date: 2026-09-27 PDT.
Owner proposes bookmarks, dedicated Codex troubleshooting and a Mission Control Launchpad folder to track work. This folder provides that durable return point. No Codex task, controller, timer or automatic exporter is created. Personal bookmarks/notes remain in fusion.db.

## Architecture and privacy

### D-003 — Fit the logger into the common architecture

Date: 2026-09-27 PDT.
Owner direction includes UEB subscribers, real-time rendering, system event ledger/audit paths, plugin registration and views using protected server functions. New work must plan its governed schemas/authority and reuse shared measurements; no bespoke bypass is authorized. Exact implementation order and contracts still need planning. P-001 is not an approved executable roadmap.

### D-004 — Separate content-free retention

Earlier owner choices retained: actual second DB, not a table in fusion.db; sampled numeric/health events; first of 2 GB/30 days/N events; manual queries for now. No export wiring until plugin/server work. [Predecessor HL decisions](../../../Captures/035-Composer_Typing_Regression/LOCAL-HEALTH-LOGGING/DECISIONS.md) preserve original provenance. N=1,000,000 and detailed sample intervals are prior engineering defaults to revalidate, not newly owner-selected exact values.

### D-005 — Split the follow-up into distinct Launchpad homes

Date: 2026-09-27 PDT.
Source: owner approval in the Mission Control setup conversation after the four-folder proposal, followed by a request for a separate remaining-chat folder and instruction to provision now. This approves durable folder ownership, not executable roadmaps or detailed sequencing.
The [chat close-out](../chat-integration-and-retirement/TICKET.md) owns transferred verification and retirement; [plugin foundation](../plugin-foundation/TICKET.md), [governed events and ledger](../governed-events-and-ledger/TICKET.md), and [plugin views and provisioning](../plugin-views-and-provisioning/TICKET.md) own their respective shared planning contracts. This folder keeps dogfood observations, rendering measurements and the health-logger consumer. The owner will settle details within the prepared folders.

### D-006 — Permit temporary chat failure logs pending the subscriber

Date: 2026-09-28 PDT.
Source: owner direction in the CHAT-AR close-out conversation: temporary logs before subscriber work are acceptable, provided they are noted clearly for deletion or migration; the owner then asked for the note in this work folder.
Disposition: a narrow exception for diagnosing the accepted-message/no-response incident (chat I-007), not approval for a permanent parallel logger, raw-content retention, a governed publisher, or the health-store implementation. The [temporary `temp_chat_boundary_v1` path](../chat-integration-and-retirement/REFERENCES.md#ref-009--temporary-content-free-child-boundary-diagnostics) must be reviewed during the subscriber implementation and either migrated into its governed content-free contract or deleted. The current development app has not restarted into this code, so no new live evidence is claimed.
