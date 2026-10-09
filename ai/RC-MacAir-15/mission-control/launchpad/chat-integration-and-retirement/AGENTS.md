# CHAT-AR integration and retirement — working folder

This is an owner-selected Launchpad memory folder prepared during Mission Control construction. It is not a Mission Control session or an activated build. Repository and parent instructions apply.

## Scope and authority

Finish fixing the current last build, including necessary retirement, harness verification and existing acceptance requirements. The owner's October 5 [D-008](DECISIONS.md#d-008--narrow-to-the-current-build-and-separate-follow-on-harness-work) narrows this folder's future remit. Subsequent broader OpenCode harness repair/testing belongs in [Chat Harness Repair and Testing](../chat-harness-repair-and-testing/TICKET.md) after this job is finished. Preserve current task ownership, approved SPECs, acceptance and historical baseline/consumer evidence. SPEC-06 remains owner-accepted with residuals. Ongoing bookmarks, unrelated dogfood reports, logger design, and new health-event subscriptions belong in the [health folder](../fusion-health-and-governed-observability/TICKET.md).

The owner's October 7 [D-009](DECISIONS.md#d-009--prepare-the-next-shared-chat-material-insertion-ticket-and-spec) adds one bounded next ticket and single-SPEC planning assignment under [planning/shared-chat-material-insertion](planning/shared-chat-material-insertion/PLANNING.md). Its exact owner request includes “Don't build.” This exception authorizes source inspection, candidate documentation and independent planning review only; it does not reopen the completed build, authorize product implementation or transfer the registered main identity/history boundary. Preserve the separate harness and health scopes above.

## Main and side roles

The owner designates one main session to front this folder. A bounded side chat follows only its assigned scope, returns evidence, and does not acquire the main session's identity from shared CWD. Use the shared [ticket workflow](../../ticket-workflow.md) and [investigation contract](../../investigation-contract.md). A later main session may use [MC Launchpad](../.agents/skills/mc-launchpad/SKILL.md); use [Memory Maintenance](../../.agents/skills/mc-memory-maintenance/SKILL.md) for local record/schema changes and [Document Sweep](../../.agents/skills/mc-document-sweep/SKILL.md) at meaningful documentation transitions.

## Re-entry and records

Read [TICKET](TICKET.md), [index](index.json), unresolved [BULLETIN](BULLETIN.md), [INTENT](INTENT.md), and relevant linked records. TICKET is the return point; CAPTURE is working synthesis; INTENT and DECISIONS preserve owner direction; ISSUES holds sourced gaps; REFERENCES identifies evidence and its limits. The index is static routing. Keep source-native work IDs, exact revisions, decisions and proposal authority distinct. Check the current source before writing. Use the [conversation evidence contract](../../conversation-evidence.md) for bounded history reads.

## Main-chat startup

Before assigned work or a checkpoint handoff, verify this folder's instructions, static index, required records, source pointers and open handoffs. Apply the installed Launchpad `references/folder-startup.md` contract and Checkpoint skill while preserving this folder's TICKET/BULLETIN schema.

Verify the main chat's own UUID using trusted runtime/task metadata or an explicitly verified task link, and confirm the target with Codex's built-in `read_thread`. A shared CWD, supplied source UUID, title or recency is not caller identity. Local UUID tools may supply candidates; local database history readers and the old checkpoint CLI are not used for checkpoint recall or state operations.

If `CHECKPOINT.json` is absent, the verified main chat uses the installed Checkpoint skill's state-only `scripts/checkpoint_state.py register --state <absolute-folder>/CHECKPOINT.json --thread <verified-main-uuid> --host <verified-host>`. Initial registration has `lastCheckpoint: null`; it does not save history or advance a boundary. If the registry exists, read it as JSON or use the state-only helper's `status`, confirm its target with built-in metadata, and preserve its boundary. A different main identity requires an explicit owner handoff and preservation of prior identity/boundary provenance; never replace it automatically because a new chat shares this folder.

Record verified identity, registry path, saved boundary and unresolved issues in TICKET/BULLETIN. Keep live identity/boundary values out of the static index. Validate with Memory Maintenance's `scripts/validate_index.py <absolute-folder>`; Capture routing checks apply only to a compatible structured Capture schema. Side chats do not initialize or rebind the registry.

An authorized history checkpoint paginates settled turns through built-in `read_thread` to the saved boundary (through all pages when null), saves and validates the synthesis and native-read receipt, then advances with the state-only helper. Startup checks and targeted reads do not advance history. Historical local-reader coverage gaps do not establish a native-reader failure.

## Boundaries

Folder scaffolding does not create a main session, initialize checkpoint state, dispatch investigators or product builds, publish Git work, operate Alpha, or activate Mission Control monitoring. A scoped startup assignment permits the verified existing main chat to initialize its own missing registry without advancing history. Product code, canonical Wiki, roadmap and SPEC edits need their own scoped assignment. A new main session verifies CWD, authority and any prior writer before acting.

## Reports and handoff

Keep detailed reports under this folder only after an actual assignment, with one writer per shared target and reviewed source revision. Return concise outcomes, evidence, unresolved owner decisions, and the next safe action. Do not mark planning, implementation, review, integration or owner acceptance complete merely because a folder or document exists.
