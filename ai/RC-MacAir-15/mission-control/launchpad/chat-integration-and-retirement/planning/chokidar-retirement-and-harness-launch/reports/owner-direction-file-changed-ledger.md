# Owner direction — retire file-change ledger recording

> Discussion amendment to the completed First Draft. This records owner intent for subsequent planning; it is not an implementation receipt or an independently validated draft revision.

**Latest scope correction:** Remove Chokidar and verify that chat works afterward. Half-hour snapshots and event-triggered snapshots are future work, not prerequisites for this retirement. The draft's fallback-readiness hold is superseded by the owner direction below.

## Source and authority

- Recorded by: Codex side chat (ephemeral), 2026-10-03T11:10:56Z.
- Source: direct owner instruction in local thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, **Map Fusion–OpenCode chat failure states**: “Okay, we need to disable that file:changed event ledger. Remember the prior intent to set up snapshots every half hour as well as event triggered snapshots? That is the replacement.”
- Context: plugin-foundation D-015 and the original conversation establish System-owned snapshots, event/file association without causal claims, and periodic fallback capture.

## Settled direction and exact scope

- Disable the event ledger's recording of `file:changed` observations. Preserving this file-change ledger feed is no longer a requirement for Chokidar retirement.
- The replacement direction is event-triggered snapshots plus approximately half-hour snapshots. Preserve mediated user-edit versioning and the previously settled trigger/harness capture direction and fallback-then-file-trigger ordering.
- This decision addresses the file-change feed into the ledger. The ledger's workspace/thread recording and unrelated event listeners retain their existing scope. It does not authorize disabling every `file:changed` subscriber.
- Snapshot execution remains System-owned; plugins supply authorized configuration, sources and destinations, with System validation/enforcement of approved grants. Links are association evidence rather than proof of causality.

## Planning effect and next action

- CD-01 and its consumer-disposition question must treat file-change ledger recording as intentionally retired, not a consumer requiring a replacement stream of watcher events.
- Subsequent draft/SPEC planning must carry this amendment with the original source intent. Other watcher-fed consumers remain individually scoped; this direction does not settle their disposition by association.
- The general snapshot scanner and repository-local SQLite design are still separate, unfinished work. Their direction is settled; this note does not claim the replacement is running or add its implementation to the current assignment.
- The reviewed [First Draft](../FIRST-DRAFT.md), SHA-256 `86e4dfa898587cdb4f7c4b0edb46ed8cec5a9a77a27e8e8e48e2198bd1487a06`, and its [independent review](final-independent-draft-review.md) remain unchanged. That review predates this amendment and does not validate a revised candidate.
- Continue owner discussion, then separately authorized SPEC creation and owner approval before implementation. No product code, tests, database contents, checkpoint state or runtime was changed by this record.

## Subsequent owner correction — future snapshots do not gate removal

- Recorded by: Codex side chat (ephemeral), 2026-10-03T11:11:58Z.
- Source: subsequent direct owner instruction in the same conversation: “But the half hour snapshots and event triggers are future work. Right now we are just removing chokidar, establishing that it no longer breaks chat, and moving on.”
- **Current outcome:** cleanly remove Chokidar, its watch registrations and dependent startup/refresh calls; establish through actual chat-path verification that the OpenCode launch/chat failure is resolved; finish this bounded retirement.
- **Future work:** half-hour snapshots, new event-triggered snapshot delivery, general snapshot storage/scanning, and trigger migration to UEB/subscriptions. Their implementation/readiness is not an acceptance condition for Chokidar removal.
- **Supersession:** the First Draft's CD-01 prerequisite and P0 hold requiring the fallback to be ready before broad watcher retirement are not current owner requirements. Do not reproduce that hold in subsequent planning. Loss of the removed watcher's automatic filesystem observations does not create a requirement to build a substitute detector in this work.
- **Preserved scope:** disable the ledger's `file:changed` recording as already directed; retain independently functioning event listeners and capabilities, including the screenshot button, user-save versioning and existing tool-completion observations. Account for obsolete watcher coupling without redesigning unrelated systems.
- **Verification boundary:** later implementation must verify the actual chat path after retirement; the existing disposable descriptor probe alone does not certify chat fixed. If chat still fails, report and investigate that concrete failure within the approved scope rather than declaring removal sufficient.
- **Workflow boundary:** this is a correction of planning scope. First Draft → SPEC → owner approval → implementation remains in force. No source edits, runtime operations or new planning stage were started by this amendment. The previously reviewed draft remains unchanged; its superseded hold is historical until revised through the planning workflow.
