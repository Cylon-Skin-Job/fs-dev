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
- **Supports:** Historical October 5 build identity/waiting state and six findings with OpenCode v1.18.32 applicability/qualifications. Build status is superseded by REF-007; the harness evidence remains a historical starting point.
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
- **Status:** historical_observation; build wait superseded by REF-007
- **Source:** [CHAT-AR-SPEC-01 implementation ledger](../chat-integration-and-retirement/planning/chokidar-retirement-and-harness-launch/spec/implementation/SLICE-AND-DEVIATION-LEDGER.md), REF-002 handoff, `list_threads` and compact `wait_threads` snapshot of the separate build audit.
- **Locator:** Ledger “Independent gates and final integration”; existing orchestrator `01a1042c-09df-7473-a1e1-f458eee6b93d`; **1. Chokidar Build Audit & Repair**, `01a10cda-f556-7733-954b-132a648d8d11`, local, active turn `01a10cec-84b1-7ba2-ae3c-8bf96413db28`. No messages sent to either task.
- **Revision:** Ledger SHA-256 `8efd20ee63567330fab117435feaf9e1014b3ba269c0a895c10d75b3d8710240`; retirement candidate `sha256:ca56e1d90d0c252940ca67d1467bb6be06ed95f907fcab602d25b1bad1482144`. Repository identity for this intake: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, HEAD `d15792920731f85e45b743519d4af2b807d95a9c`, dirty; not an accepted follow-on implementation baseline.
- **Checked:** Ledger/hash 2026-10-05T16:46:22Z; task/concurrency and repository identity 2026-10-05T16:47:32Z. No other active destination-folder writer appeared in the inspected task list; destination hashes were checked immediately before editing.
- **Supports:** The October 5 observation recorded separate build ownership, `NATIVE_CHECK_WAITING_OWNER_MANUAL_RESULT` and an active build-audit chat. This remains dated provenance; REF-007 now satisfies the completed-build prerequisite.
- **Limitations:** Historical source/task observations, not live app verification or a present hold. Do not resume the older waiting gates. No task identity or assignment transfers from this observation.
- **Related:** [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work), [TICKET](TICKET.md), REF-002.

### REF-007 — Accepted build closeout and publication packet

- **Kind:** acceptance_review_and_operation_receipts
- **Status:** inspected; sealed records verified
- **Source:** Integration and Retirement completed-build handoff and linked immutable Commit Supervisor job `chat-ar-20261006`.
- **Locator:** [HANDOFF-COMPLETED-BUILD-2026-10-07.md](../chat-integration-and-retirement/HANDOFF-COMPLETED-BUILD-2026-10-07.md), read including October 8 addendum; [completed-work owner acceptance](../chat-integration-and-retirement/planning/startup-integrity-repair/COMPLETED-WORK-OWNER-ACCEPTANCE.md); [original/repair final implementation report](../chat-integration-and-retirement/planning/startup-integrity-repair/implementation/SPEC-FINAL-REPORT.md), acceptance/R3/provenance sections; source [TICKET](../chat-integration-and-retirement/TICKET.md). Job evidence:
  - [final-review-pass-02/report.md](../../jobs/commit-supervisor/chat-ar-20261006/final-review-pass-02/report.md) and adjacent seal.json.
  - [operations-recorded.json](../../jobs/commit-supervisor/chat-ar-20261006/operations-recorded.json): original local commit/landing operation receipt, whose no-push/no-Alpha fields retain their original scope.
  - [runtime-acceptance.json](../../jobs/commit-supervisor/chat-ar-20261006/runtime-acceptance.json) and [runtime-preservation-receipt.json](../../jobs/commit-supervisor/chat-ar-20261006/runtime-preservation-receipt.json).
  - [publication-restart report](../../jobs/commit-supervisor/chat-ar-20261006/publication-restart-20261007/report.md), [completion.json](../../jobs/commit-supervisor/chat-ar-20261006/publication-restart-20261007/completion.json), [completion-seal.json](../../jobs/commit-supervisor/chat-ar-20261006/publication-restart-20261007/completion-seal.json): later push/development restart/Alpha sync-build-install-restart receipts.
- **Revision:** Published commit `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`, tree `1c80f83c6c4b2b61e42c4dbb988c1f942b672ade`. Current handoff SHA-256 `28177c987e9b203b61fb68c1cbcaa03a171294c88ca7b05a2d040052d126e158`; final review report `383600a1238b1318dac82e12f65f1843589b14d84da43f3c990735020ea7dd5d`; publication report `a8869d9ed16575dfad0e91eb8602cc1d06c0c62c61206ee01da976938359fe72`; completion `770671183ca4e99462d7782a2c7721415fc412ae78196ba57d84c69530c1474d`. All 14 final-review seal members and 34 publication/deployment seal members matched at recheck.
- **Checked:** 2026-10-09T00:51:41Z–00:52:11Z, October 8 PDT; linked owner-acceptance/R3 sections read afterward. Primary checkout verified `/Users/rccurtrightjr./projects/fs-dev`, `main`, same published HEAD. This is a commit anchor; actual dirty files/config/runtime still require binding for a later assignment.
- **Supports:** Both build contracts are owner accepted, independently integrated and published; no authorized build action remained unfinished at closeout. Accepted R3 real OpenCode proof covers two usable chats, three completed persisted exchanges and passive ordered reopening. Final pass 02 is CLEAN with dependency-bound retention; checks include 34 focused screenshot/106 cumulative renderer tests, client build, 19 focused server suites/186 passes, 221 full suites/3,265 passes/one existing skipped Kimi TODO, retained on 832 unchanged server/Electron dependencies. Private candidate also checked two chats, three PNG captures and six Wiki articles; it was stopped. Development/Alpha restart receipts establish dated identity and sustained connection; Alpha registry retained six workspaces and fs-dev selection.
- **Limitations:** No new tests/provider sends/deployment or fresh runtime inspection by this receiver. Deployment receipts did not send another provider prompt and do not verify later Alpha model adoption. Private preservation covers five physical files and 25 foreign process tuples in its repeat window; original physical/logical DB equality remains unproved. The owner-waived 45-minute soak remains unperformed; fixture cleanup is not broad graceful-shutdown certification. Deferred restart-support helpers/current article and unrelated uncommitted work remain outside the pushed product commit; no publication of those units is authorized here. Earlier October 5 waits and pre-operation no-push fields are historical, not contradictory current holds.
- **Related:** [D-002](DECISIONS.md#d-002--finish-the-current-build-before-follow-on-harness-work), [TICKET](TICKET.md), [CAPTURE](CAPTURE.md), REF-006/008.

### REF-008 — Alpha model failure and authorized configuration correction

- **Kind:** incident_report_controlled_reproduction_and_config_readback
- **Status:** source packet inspected; corrected default independently read back; real response unverified
- **Source:** October 8 addendum in REF-007, source task **Map Fusion–OpenCode chat failure states**, and receiver's narrow read-only model/config fingerprint.
- **Locator:** [Alpha addendum](../chat-integration-and-retirement/HANDOFF-COMPLETED-BUILD-2026-10-07.md#october-8-addendum--alpha-model-lookup-failure-and-configuration-correction). Original attempts:
  - Turn `c22a7b0c-a849-4fca-9df8-0ecca10119e7`; thread `2026-10-07T02-18-51-726`; session `ses_eea55c2dfffePNXkdj0Pzz61ry`; October 7 09:20:40 UTC.
  - Turn `c63bed3e-d0ca-44c8-aa2b-1b3d2af837f1`; thread `2026-10-01T16-04-16-060`; session `ses_eea5539a2ffeLLRBubtht4cMgO`; October 7 09:21:15 UTC.
  - Source incident evidence: Alpha profile `server-live.log` lines 109019–109064 at diagnosis, profile `server-data/fusion.db` receipt/diagnostic metadata, and `/Users/rccurtrightjr./.local/share/opencode/opencode.db` native model/session metadata. These runtime stores were not newly queried here.
  - Controlled scratch paths `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/alpha-model-check-n3sfic5z` and `alpha-model-detail-sb79d_fu`; detailed error ref `err_9554c629`. Source chat retains command results.
  - Corrected [Alpha fs-dev cli.json](../../../../RC-Alpha/System/config/cli.json): `harnesses.opencode.model` only. Source authorization/correction turn at REF-010.
- **Revision:** Source addendum dated `2026-10-08T22:33:47Z`, whole handoff hash at REF-007. Readback model `togetherai/deepseek-ai/DeepSeek-V4.1-Flash`; config SHA-256 `7b9c2ca63a7e743301b81ae8e0d8a47463a71b4d24983ab28daaf1c80d0b914c` at receiver check. Diagnosed installed OpenCode version v1.18.32.
- **Checked:** Source packet/conversation and read-only default/config hash 2026-10-09T00:52:11Z, October 8 PDT. Both named newer scratch directories existed at that check; their contents were not recopied or independently rerun. Earlier missing 401/429/comparison artifact finding remains unchanged.
- **Supports:** Alpha selected obsolete Fireworks `deepseek-v4-flash-0731`; both attempts spawned/returned native IDs, had no stored ID at launch, and exited 1 before output. Native session model metadata plus isolated debug reproduction identify local `ProviderModelNotFoundError`; JSON wrapped it as `UnknownError`, Fusion surfaced generic `HARNESS_PROCESS_EXIT`. No captured HTTP status; distinct from controlled 401/429 and pre-PID EBADF. Source correction changed only default model to Together, preserving thinking/other settings; no code/catalog/credential/DB/bundle/restart/provider/publication operation was part of that correction. Receiver confirms current default value only. Compared adapter/translator/tap/outcome files matched at diagnosis; both live servers had 21 numeric descriptors/47 lsof rows.
- **Limitations:** Original Alpha detailed native error was not saved; reproduction remains distinct from incident evidence. No key fallback, retry, Together outage, stale-session cause or descriptor cause established. Source-reported semantic single-field comparison was not independently repeated against the absent pre-edit config. Existing harness runtime snapshots/per-thread overrides can differ from the corrected default; a real Alpha response after correction is unverified. No catalog is added here. Temporary directory presence is not durable transcript recovery; dated PIDs are not present operation targets.
- **Related:** I-001, I-003, [CAPTURE](CAPTURE.md), REF-007/009/010.

### REF-009 — Source-checked OpenCode error references

- **Kind:** versioned_primary_reference_map
- **Status:** source-reported inspection retained; no new web retrieval by receiver
- **Source:** Owner's error-list question and source-chat response inspected at REF-010; delegated packet's October 8 official-doc/source locators.
- **Locator:** [Official troubleshooting/common issues](https://docs.opencode.ai/docs/troubleshooting/#common-issues); version-bound [session schemas](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/core/src/v1/session.ts), [provider definitions](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/provider/provider.ts), and [message conversion](https://github.com/anomalyco/opencode/blob/v1.18.32/packages/opencode/src/session/message-v2.ts).
- **Revision:** Source checked October 8; code locators explicitly v1.18.32. Official guide is mutable and partial, not an exhaustive versioned catalog.
- **Checked:** Source-chat answer/packet retrieved October 8 PDT, 2026-10-09T00:52:11Z. This reference preserves the originating inspection; it is not receiver verification of the latest release or each linked schema.
- **Supports:** Source map names `ProviderModelNotFoundError`, `ProviderInitError`, `AI_APICallError`; versioned error schema coverage reported includes `ProviderAuthError`, `APIError` with optional statusCode/isRetryable, `MessageAbortedError`, `MessageOutputLengthError`, `StructuredOutputError`, `ContextOverflowError`, `ContentFilterError`. A later mapping can inspect underlying error → native JSON representation → Fusion feedback, retaining exposed status/retryability.
- **Limitations:** Mapping is an assistant proposal, not owner-approved implementation or proof of live UI translation. Re-read exact definitions/conversion when planning a bounded change; do not infer exhaustive error coverage from a common-errors guide.
- **Related:** I-001, I-002, REF-008/010, [CAPTURE](CAPTURE.md).

### REF-010 — Owner-authorized transfer and source conversation

- **Kind:** conversation_authority_and_evidence
- **Status:** received and inspected
- **Source:** **Map Fusion–OpenCode chat failure states**, `01a0ea32-f152-77a2-afc2-b73e8976685a`, host local; owner-authorized incoming handoff to existing **Track OpenCode failure modes**.
- **Locator:** Built-in `read_thread`, latest four settled turns:
  - `01a11922-12e3-7513-aeee-9720afc2db4d`, user `01a11922-14cd-7610-b906-aaa8534cbd0b`: Alpha/Macbook diagnosis request; assistant `msg_0830b0caa15bed42016ac6f2eb42fc87d29172282bed2b122a`: obsolete model, reproduction and incident limits.
  - `01a11da5-fe35-7921-a98d-bba4ea15159d`, user `01a11da5-ffe8-72c0-a248-a3845518d726`: set Alpha to Together DeepSeek 4.1 Flash and record handoff; assistant `msg_0830b0caa15bed42016ac81a7899c087d29838414d551e4e9e`: correction and unverified real-response limit.
  - `01a11da9-a23f-77e2-b31f-cb877951775f`, user `01a11da9-a29a-7e50-a400-5df5d0bc9ef0`: documented-error-list question; assistant `msg_0830b0caa15bed42016ac81b281b2c87d2b7480bef4f73e639`: partial guide/versioned sources/mapping proposal.
  - `01a11e23-7b20-7ed3-846f-b3b9323d83a4`, user `01a11e23-7b73-7203-b5ee-d84aa5423109`: “Pass all handoff information to the following chat: codex://threads/01a10cf2-cd72-7c50-af8d-27588c6a17e6”; source final confirms delivery.
- **Revision:** Exact source-native turn/message IDs, all completed; newest transfer final at source updatedAt `1791507063`. The receiver's role/main identity is not inferred from this source UUID or destination mention.
- **Checked:** 2026-10-09T00:52:11Z, October 8 PDT; built-in reader. Source was idle; inspected app task list showed no other active chat in the exact destination CWD. Destination hashes were checked before writing.
- **Supports:** Explicit owner authorization for the one-way packet delivery, source diagnosis/correction and documentary intake under D-003/D-004. Closeout is corroborated by actual REF-007 files/seals; source statements alone do not replace those receipts.
- **Limitations:** Latest four settled turns, not exhaustive history or tool-output reconstruction; no checkpoint advanced. Packet receipt does not authorize reciprocal messaging, product execution, runtime operation, publication/deployment or main rebinding. Source's separate next assignments are not inherited.
- **Related:** [D-004](DECISIONS.md#d-004--receive-the-completed-build-and-alpha-incident-handoff), REF-007/008/009, [TICKET](TICKET.md).

October 8 handoff reconciled by Codex side chat (ephemeral), 2026-10-09T00:56:36Z.
