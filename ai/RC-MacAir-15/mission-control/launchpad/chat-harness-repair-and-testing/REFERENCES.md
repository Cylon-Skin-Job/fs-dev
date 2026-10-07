# Chat Harness Repair and Testing — sources

> Evidence locators and limits. Reading a report is distinct from repeating its tests.

## Owner direction and prior work

### REF-001 — Owner folder and sequencing direction

- **Kind:** user_quote
- **Status:** inspected
- **Source:** Prior owner provisioning message as recorded in the existing folder records, October 5, 2026.
- **Locator:** Message beginning “Yes, let's do these one at a time though”, naming “Chat harness repair and testing”. Original conversation/turn identity was not supplied in the provisioning record; this intake does not relabel it as a message in the present chat.
- **Revision:** Owner direction as preserved by provisioning.
- **Checked:** 2026-10-05T16:19:23Z, provisioning record's original observation; retained during this import, not newly retrieved original history.
- **Supports:** Name, distinct home, current-build-first sequence.
- **Limitations:** Does not specify repairs, mode selection, implementation authority or detailed product acceptance. Provenance is the existing provisioning record; no original turn ID is invented.
- **Related:** [DECISIONS](DECISIONS.md), [INTENT](INTENT.md).

### REF-002 — October 5 harness and build handoff

- **Kind:** artifact
- **Status:** inspected
- **Source:** Prior handoff by Codex side chat (ephemeral), source task “Map Fusion–OpenCode chat failure states”, 01a0ea32-f152-77a2-afc2-b73e8976685a, local.
- **Locator:** [HANDOFF-CHOKIDAR-AND-HARNESS-2026-10-05.md](../chat-integration-and-retirement/HANDOFF-CHOKIDAR-AND-HARNESS-2026-10-05.md), “Current position”, “Other OpenCode harness issues retained for later work” and “Next safe action”.
- **Revision:** SHA-256 9ce666a9ae0413399d912da8fe2df9f7ef088bfe06e2bf212e4346ef15e4119c; report dated 2026-10-05 16:08 UTC.
- **Checked:** 2026-10-05T16:19:23Z initially; re-read and same SHA-256 verified 2026-10-05T16:46:22Z for this import.
- **Supports:** Current-build identity/outstanding verification and six historical findings with OpenCode v1.18.32 applicability and qualifications.
- **Limitations:** Prior report, not fresh tests or current runtime health. Both named temporary files (`observations.json` and connection-comparison `summary.json`) were absent at recheck. Raw fixtures/native frames/fingerprints were not recovered. Baseline/version applicability needs rechecking; no source file or task is moved/reassigned.
- **Related:** [CAPTURE](CAPTURE.md), I-001–I-006 in [ISSUES](ISSUES.md), source [TICKET](../chat-integration-and-retirement/TICKET.md), REF-004/005/006.

### REF-003 — Owner request to import failure-mode work

- **Kind:** user_instruction
- **Status:** received
- **Source:** Direct owner message in the present chat, October 5, 2026.
- **Locator:** Message beginning “Currently I have another folder completing chokidar removal” and requesting “pull the work from that folder, regarding Open Code failure modes, into this folder and ticket.” No caller UUID or turn identifier is inferred.
- **Revision:** Owner instruction as received during this intake.
- **Checked:** 2026-10-05, direct conversation context; consolidated alongside the 2026-10-05T16:47:32Z source check.
- **Supports:** Evidence consolidation into this ticket while the separate current-build work continues.
- **Limitations:** Does not authorize product implementation, changing harness modes, reassigning source tasks or current-build acceptance.
- **Related:** [D-003](DECISIONS.md#d-003--bring-the-existing-opencode-failure-mode-work-into-this-ticket), [TICKET](TICKET.md), [INTENT](INTENT.md).

### REF-004 — Targeted source conversation reads

- **Kind:** conversation_evidence
- **Status:** inspected_with_raw_evidence_gap
- **Source:** **Map Fusion–OpenCode chat failure states**, `01a0ea32-f152-77a2-afc2-b73e8976685a`, local; built-in `read_thread` plus read-only `search_codex_conversations` / `read_codex_pairs`. Search-result titles were retrieval leads; the app's verified title is used here.
- **Locator:** Selected settled turns and their final assistant messages:
  - `01a0f468-b086-7721-aaf1-3fbf89a55414`; `msg_0830b0caa15bed42016abd8d594b3087d2941d72f4b9a14385`: controlled local-provider matrix, mode differences, adapter replay and recovery qualifications. Owner read/probe authorization read in the same turn.
  - `01a0f560-6682-7fc2-9470-db42a17b36be`; `msg_0830b0caa15bed42016abdccfb102887d2b432aaf25043ca65`: single-credential inspection, successful native probes and Python-route gateway limitation.
  - `01a0f56b-3623-79d2-a490-80aba445bc4e`; `msg_0830b0caa15bed42016abdcf3833b887d2909035e538d39cff`: September 30 resumed-session socket failure, retry/completion times and config timing comparison.
  - `01a0f9b4-a7a9-7c62-9c24-dff8c6fb3092`; `msg_0830b0caa15bed42016abee83de24087d29af4f902e243f91a`: 8/8 normal reuse and 8/8 fresh successes, zero retries, socket-sampling/packet-capture limits.
  - `01a10440-575f-7442-9b2d-12c9484f132f`; `msg_0830b0caa15bed42016ac199dadfc087d2acd88f098a7a5961`: later retained-issue summary, unconfirmed causal theories and old false-send fix.
  - `01a10442-5f6d-78d0-ab20-397a945b3cc3`; owner message `01a10442-5fa7-7323-b679-b4d0740df32e`: “Hand these to me one at a time”; assistant `msg_0830b0caa15bed42016ac19a3ae1a087d2a53b3e8d72194a6a`: first-item error-translation proposal, with controlled-probe qualification.
  - `01a10445-35fa-7581-bcab-6717ffb6f24a`; `msg_0830b0caa15bed42016ac19af72b4087d2acba564393281e88`: retry versus terminal-failure discussion for v1.18.32.
  - Later handoff turn `01a10cce-0dab-7983-9676-174b0d0d07f5`: inspected through built-in `read_thread`; owner request and saved handoff align with REF-002. Recent interrupted causation audit remains labeled interrupted.
- **Revision:** Source-native settled turn/message IDs above; probe version v1.18.32. Historical summaries, not recovered raw execution traces.
- **Checked:** 2026-10-05T16:46:22Z–16:47:32Z. Three searches (`retry`, `attach`, `reused fresh`) in this exact task; matching surrounding settled turns read, then exact comparison/retry turns and latest six built-in turns. Searches scanned 149 recorded assistant messages; result lists were limited to 6, 4 and 2 respectively, not a complete history review.
- **Supports:** Fixture results; direct JSON/headless/attach differences; credential and connection-comparison limits; discussion order and proposal status. Original linked docs were OpenCode v1.18.32 CLI/retry/provider source and Together error codes; no fresh web/current-release verification performed in this import.
- **Limitations:** Prior tests were author-reported, not independently repeated. Named temporary raw probe files were absent. Outputs outside selected turns and unavailable child histories were not exhaustively recovered. Targeted retrieval neither advances a checkpoint nor designates this chat as the folder main.
- **Related:** [CAPTURE](CAPTURE.md), I-001–I-005, REF-002/005.

### REF-005 — Historical recovery and fallback investigations

- **Kind:** investigation_reports
- **Status:** inspected_with_historical_applicability_limits
- **Source:** Source-native CHAT-AR-INV-001 and CHAT-AR-INV-002, September 28, 2026; source-native CHAT-AR I-007/I-008 and REF-008 retain their identities and dispositions.
- **Locator:** [CHAT-AR-INV-001/report.md](../chat-integration-and-retirement/investigations/CHAT-AR-INV-001/report.md), read in full, especially F1/F2 and source hashes; [CHAT-AR-INV-002/report.md](../chat-integration-and-retirement/investigations/CHAT-AR-INV-002/report.md), ranked hypotheses/send-recovery/source-identity sections inspected; [source I-008](../chat-integration-and-retirement/ISSUES.md#i-008--accepted-prompt-recovery-after-response-start-failure).
- **Revision:** Report SHA-256: INV-001 `74d5d6458fc09f4a40a6d38e342b2c35377935a4061e1751a31d3af777a23638`; INV-002 `f175d9d58bafb79a27b1f85e1cb0b69e8523114f1826ba84fd83353912b1f157`. Original checkout: `/Users/rccurtrightjr./projects/fs-dev`, `agent/exact-workspace-paths`, dirty HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`; material source hashes remain in each report.
- **Checked:** Reports inspected and hashes computed 2026-10-05T16:46:53Z–16:47:32Z; original observations 2026-09-28 07:40/07:42 UTC.
- **Supports:** I-003's separate receipt/status and pre-begin hydration edges; I-006's conditional metadata-error fallback. Source locations provide starting points for a later baseline recheck.
- **Limitations:** Historical source analysis; current product bytes not revalidated. Fresh-renderer loss was not reproduced through the public route; fallback execution was not established in the incident. This consolidation is not a new independent worker-handoff acceptance or roadmap release and does not reopen historical SPEC acceptance. Unrelated UI/compatibility findings were not imported as harness issues.
- **Related:** I-003, I-006, [CAPTURE](CAPTURE.md), REF-004.

### REF-006 — Current-build dependency and concurrency observation

- **Kind:** dependency_and_task_observation
- **Status:** observed_not_closed
- **Source:** [CHAT-AR-SPEC-01 implementation ledger](../chat-integration-and-retirement/planning/chokidar-retirement-and-harness-launch/spec/implementation/SLICE-AND-DEVIATION-LEDGER.md), REF-002 handoff, `list_threads` and compact `wait_threads` snapshot of the separate build audit.
- **Locator:** Ledger “Independent gates and final integration”; existing orchestrator `01a1042c-09df-7473-a1e1-f458eee6b93d`; **1. Chokidar Build Audit & Repair**, `01a10cda-f556-7733-954b-132a648d8d11`, local, active turn `01a10cec-84b1-7ba2-ae3c-8bf96413db28`. No messages sent to either task.
- **Revision:** Ledger SHA-256 `8efd20ee63567330fab117435feaf9e1014b3ba269c0a895c10d75b3d8710240`; retirement candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`. Repository identity for this intake: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`, dirty; not an accepted follow-on implementation baseline.
- **Checked:** Ledger/hash 2026-10-05T16:46:22Z; task/concurrency and repository identity 2026-10-05T16:47:32Z. No other active destination-folder writer appeared in the inspected task list; destination hashes were checked immediately before editing.
- **Supports:** Current-build ownership stays separate. The inspected ledger reports `NATIVE_CHECK_WAITING_OWNER_MANUAL_RESULT` with actual chat and final integration outstanding. The separate build-audit chat was active; its latest repair/acceptance packet must be re-read before releasing follow-on product work.
- **Limitations:** Mutable source/task observations, not live app verification. The older ledger's wait state is not asserted to be the active audit's final disposition. Reports may change during that work; no closure or task reassignment is inferred.
- **Related:** [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work), [TICKET](TICKET.md), REF-002.
