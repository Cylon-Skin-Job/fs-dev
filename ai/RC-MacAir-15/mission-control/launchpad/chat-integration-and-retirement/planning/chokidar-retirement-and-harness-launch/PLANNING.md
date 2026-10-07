# First Draft Planning Coordination

## Current revision assignment

The owner instructed this source conversation to “Make the corrections and run until done” after the SPEC-handoff preflight identified PF-01–PF-03. Revision 2 corrects the draft, obtains fresh independent draft validation, completes a scoped documentation sweep and repeats preflight until the packet is ready for SPEC creation. This assignment stops before SPEC creation or implementation.

Current scope is Chokidar removal and cleanup of obsolete watcher calls, disabling ledger recording of `file:changed`, and actual chat-path verification during later approved implementation. Half-hour/event-triggered snapshots and trigger migration are future work, not removal prerequisites. Plugin-foundation D-016 and the owner amendment supersede the earlier fallback-readiness hold recorded below.

The prior persistent draft supervisor is idle/completed; root now supervises this bounded revision. Runtime stage `/root/draft_scope_revision` owns its new revision-stage report and assigns one draft author plus a fresh independent validator. The author owns only FIRST-DRAFT.md; reviewers own new revision reports. Root owns this coordination document and the subsequent preflight report. Prior review/preflight reports remain historical evidence. No main-session or checkpoint ownership is transferred.

**Current state:** revision 2 is `FIRST_DRAFT_READY_FOR_DISCUSSION`. [Fresh independent review](reports/independent-draft-review-revision-2.md) returns `DRAFT_VALIDATED_FOR_DISCUSSION` with no material findings on draft SHA-256 `98329563e1ac24d1eeaa5753ad9490c10057cf9e9a065e912663ae1f3e907a9c`. Review SHA-256 is `177264f784c3765e3ff05e44fad02737bf42ea8b6b1fcfe5f4abe81280dd9ff4`; [revision stage report](reports/stage-first-draft-revision-2.md) SHA-256 is `db4a1908bfa28162919133769f692c0e35cbf42f97209b9b4fa81bbd3687e728`. PF-01/PF-02 are corrected. PF-03 is complete: fresh draft validation, [scoped sweep](../../.document-sweeps/runs/b294252fbab94747bf3e577244d305a1/report.md) and [renewed preflight](reports/preflight-spec-handoff-revision-2.md). Preflight returns `READY_WITH_EXPLICIT_GAPS` for SPEC creation; PF-04 is carried as receiving-stage technical work. No owner question about snapshot sequencing remains.

The original intake/return below and the immutable [owner amendment](reports/owner-direction-file-changed-ledger.md) / [first preflight](reports/preflight-spec-handoff.md) preserve their historical observation times. Statements there about the earlier unchanged draft or pending review do not describe current revision-2 status. Current authority is the owner correction plus plugin-foundation D-016; the revised draft and fresh review govern this packet.

**Receiving SPEC documentation task (RV2-A01):** identify and assign affected watcher/startup source maps, legacy ledger/resource-event descriptions, screenshot-folder/direct-capture documentation and Apple Calendar listener documentation, plus affected test/startup inventories. The later SPEC must specify their update timing with the retired code. Preserve independent save/tool/provenance and chat contracts; this task adds no new event schema, scanner, provider or failure-UX work. Canonical Wiki edits remain part of that separately authorized product assignment.

## Original assignment (revision 1)

- **Planning ID:** CHAT-AR-FD-CHOKIDAR-OPEN-CODE-001
- **Stage:** `stage:first-draft`
- **Manager / recipient:** owner of the new First Draft session
- **Controller home:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`
- **Memory folder:** `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`
- **Owned output:** `planning/chokidar-retirement-and-harness-launch/`
- **Read-only source checkout:** `/Users/rccurtrightjr./projects/fs-dev`
- **Source branch / HEAD:** `agent/exact-workspace-paths` / `d15792920731f85e45b743519d4af2b807d95a9c`
- **Original history:** `Map Fusion–OpenCode chat failure states`, thread `01a0ea32-f152-77a2-afc2-b73e8976685a`, host `local`; targeted settled turns were read with built-in `read_thread`.

## Original inline preflight (historical)

**Status: `READY_WITH_EXPLICIT_GAPS` for `first-draft`.** The owner supplied two concrete outcomes—retire Chokidar without breaking required consumers and address the locally reproduced OpenCode launch failure—and explicit exclusions and decision boundaries. The original conversation was verified by built-in `read_thread` against its title and folder CWD. Its newest settled turns confirm the stopped/reverted implementation, current Chokidar questions, the accepted 30-minute delayed trigger behavior, and that a First Draft → SPEC → owner approval → implementation sequence is required.

The current repository is on the assigned branch and commit. It has 488 dirty/untracked paths overall; the identified watcher/startup/screenshot/Calendar/workspace/file-mutation/provenance/trigger source surfaces are not dirty. No existing folder output existed at assignment time. Do not clean, reset, or overwrite any source checkout state. Draft only from current bytes; record the exact revisions and hashes used in the stage report and draft.

Current owner direction and hard exclusions are provided in the assignment packet and supported by plugin-foundation D-015 / REF-018. Chokidar removal does not authorize building the general snapshot service. Preserve user-save versioning, UEB/subscription direction, trigger/harness snapshot direction, delayed fallback semantics, and association without causal attribution. The macOS screenshot-folder monitor is retired; preserve in-app direct screenshot capture and attachments. Apple Calendar watcher retirement is allowed only if nothing waits or races on its completion; keep the optional Google poller distinct. Together.ai retry is separately deferred; server warm-up remains unconfirmed.

The configured current User Preferences, Code Standards router/routed standards, Chat overview and applicable UEB/file-versioning/snapshot contracts must be checked by the author and independent validator. Required scope includes: actual Chokidar providers and downstream consumers; watcher root/lifecycle/cleanup; safe trigger/filter contract under accepted delay; distinct existing save preimages and admitted tool snapshots versus absent general scanner; direct screenshot path and incidental refresh; Apple watcher versus optional Google poller and passive calendar sync; and the local EBADF numeric descriptor-range reproduction with its limits. Do not claim watcher leak, production pipe descriptor identity, database size, thread model, invalid workspace entries, provider key issue, or Together.ai cause without evidence.

### Gaps accepted for a conditional draft

1. Exact event/trigger migration and compatibility contracts, including what remains active when the general snapshot scanner is deferred. The First Draft stage should identify candidate vertical slices and dependencies; candidate creation must resolve any release-blocking contracts.
2. Whether any legacy watcher consumer remains a required product behavior, especially file filters, chat mutation metadata, theme regeneration and inactive ticket dispatch. Scope those as evidence-backed requirements/questions, not automatic commitments to reproduce all watcher behavior.
3. Exact lifecycle ownership for watcher cleanup and workspace rebinding. Prior audit found an initial-root watch and no switch/removal close/rebind path, but did not establish a leak.
4. Exact app-level proof of the harness fix. The disposable Node/libuv/macOS probes establish a numeric descriptor boundary and plausible pressure mechanism; they do not identify the production pipe descriptor or prove a leak.
5. Snapshot schema/path/migration and event correlation details remain unresolved; draft must not define them as approved architecture.

These gaps do not prevent a useful discussion skeleton. No current document-sweep report was claimed or required for the standalone First Draft handoff. This is not Roadmap Creator readiness.

## Authority and boundaries

- `SPEC-06` acceptance remains closed; transferred residuals do not reopen it.
- First Draft only. Do not create executable roadmap/SPECs, implement product code, alter tests, mutate databases, restart apps/servers, call providers, resend prompts, perform Alpha operations, publish, or deploy.
- Owner direction is distinct from source facts, technical inference, and proposals. Do not make a suggested native watcher/poller the selected architecture.
- No checkpoint registration or history-boundary advance. This task is not a successor main Launchpad or Mission Control session.

## Revision 1 stage return (historical)

The stage has returned `FIRST_DRAFT_READY_FOR_DISCUSSION`. The then-current revision-1 draft at `FIRST-DRAFT.md` had SHA-256 `86e4dfa898587cdb4f7c4b0edb46ed8cec5a9a77a27e8e8e48e2198bd1487a06`; the final independent report is `reports/final-independent-draft-review.md` and returns `DRAFT_VALIDATED_FOR_DISCUSSION` on that exact hash with no material findings. The stage report is `reports/stage-first-draft.md`. Earlier reports and repaired findings are preserved: DRAFT-01 corrected System grant enforcement wording; F-01 corrected the trigger/fallback direction. Source branch/HEAD remained `agent/exact-workspace-paths` / `d15792920731f85e45b743519d4af2b807d95a9c`; assigned product paths stayed clean, unrelated dirty work preserved.

**Return:** `FIRST_DRAFT_READY_FOR_DISCUSSION`. Recommended next safe step is owner discussion of the P0 dependency/readiness and consumer disposition questions. This status does not create SPECs/roadmaps or approve implementation. The required sequence remains First Draft → SPEC → owner approval → implementation. No subsequent planning stage was started.


## Preparation completion receipt

Revision 2 is independently validated for discussion. Sweep `b294252fbab94747bf3e577244d305a1` completed 2026-10-03T12:50:05Z with no material gaps within the handoff scope; its report SHA-256 is `03644d972eaec758a9868927c03ee2e6969ea210a7ce98619a330b0f9531a1c7`. Renewed preflight records current inputs and dispositions in `reports/preflight-spec-handoff-revision-2.md`. This completion receipt and preflight are coordination outputs after that sweep, not silently included in its captured PLANNING hash. The draft, review, stage, owner authorities and product-source bytes remain unchanged; this delta changes progress pointers only.

**Next safe action:** a separately authorized `mc-roadmap-creator` assignment can author the bounded SPEC candidate from this packet. It resolves PF-04 and assigns RV2-A01 documentation updates before executable release. No additional owner scope decision is needed; this preparation assignment does not start SPEC creation or authorize implementation, publishing or deployment. Current sequence remains First Draft → SPEC → owner approval → implementation.
