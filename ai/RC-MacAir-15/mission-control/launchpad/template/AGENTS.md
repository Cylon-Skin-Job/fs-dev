# Launchpad working-folder template

This is a reusable instruction file, not a live Launchpad session. Copy and
adapt it inside an owner-selected working folder. Do not register a task, create
`CHECKPOINT.json`, or treat this `template/` directory as the active project.
The working folder's actual `AGENTS.md` and `index.json` define its document
roles; applicable repository instructions still apply.

## Two session roles

These role instructions apply after this template has been adapted into a live
`mission-control/launchpad/<subject>/` working folder. They do not activate the
`template/` directory. Each domain folder has one fronting main session and
may have supporting side chats. In the owner's Codex workflow, side chats
inherit the main session's CWD: they share its memory folder, not its identity.
Do not create another domain folder or a separate fronting agent for a side chat.

Determine the role from the current conversation context and explicit assignment,
not from CWD, inherited history, or the UUID in `CHECKPOINT.json` alone:

- **Main session — fronting domain agent.** The owner-designated main session
  takes the existing Launchpad role: converse with the owner, restore context,
  shape intent, preserve open questions, reconcile bounded support results,
  maintain the domain's synthesis, and assess planning-handoff readiness.
  Starting an owner-designated main session in this prepared folder establishes
  that local responsibility; it does not require a second fronting agent.
  Missing UUID registration does not prevent conversation or ordinary re-entry.
  Register the main task's verified identity before history checkpointing.
- **Side chat — bounded support agent.** Follow the live side-chat request and
  its explicit write scope. Inherited parent history is reference context, not
  a task queue. Do not take over the main conversation, restart its unfinished
  work, register yourself as the main task, or assume its approvals apply to
  this assignment. A side chat may run `/mc-checkpoint` when explicitly requested,
  or perform other authorized bounded research/documentation. Return the result,
  evidence, changed files and remaining questions; stop at the assignment's end.

If the context explicitly identifies a side conversation, that is the role even
though CWD and parent files are shared. If the role is genuinely unresolved,
state that and resolve it before role-specific writes or registration; do not
invent a third role or assume main-session authority. A replacement main session
must receive the handoff and verify the previous writer is inactive; preserve
checkpoint provenance rather than silently rebinding or resetting its cursor.

## Roles and authority

The roles above are session responsibilities. Skills supply reusable procedures:

- The local `$mc-launchpad` supplies the main session's conversational workflow.
  An explicit invocation or owner assignment of a prepared domain folder
  establishes that workflow; the standing local role already guides re-entry. Use this exact
  working folder as its target. Do not follow the legacy numbered-Capture creation
  fallback, create a duplicate folder, or walk upward into Mission Control's own
  memory when this folder needs its local contract repaired.
- `$mc-memory-maintenance` handles authorized folder initialization, schema changes
  and source-backed record reconciliation. Its helpers replace the required
  Second Brain v1 utilities; do not dispatch the legacy umbrella. Research
  remains a bounded side-chat assignment using the applicable focused tools.
  Current conversation restrictions continue to govern delegation and writes.
- `$mc-capture` explicitly refreshes the current conversation into the local synthesis.
  It is not a main-history reader. A side chat must not treat its inherited history
  as a fresh Capture assignment or claim Capture has checkpointed the main task.
- `$mc-checkpoint` explicitly reads settled turns from the registered main task,
  saves a sourced synthesis, validates it, then advances the cursor. A side chat
  uses the existing local `CHECKPOINT.json` as the history address; it does not
  need a separate workspace registration and does not become the main session.

Neither role is Mission Control. The main domain session owns its local brief
and returns concise outcomes, blockers, evidence links and next actions through
the assigned reporting channel. Side chats return to their requesting conversation;
they do not independently rewrite central MC state without an explicit assignment.
During construction, owner-managed setup chats coordinate this work. The first
Mission Control agent and its hourly loop remain inactive until the system is
fully built. Full Access does not expand either role's assigned scope.

Keep exploratory discussion in `CAPTURE.md` or the indexed equivalent;
explicit owner direction in the intent/decision authority; sourced problems and
consequential ambiguity or missing intent in issues; and unapproved candidate actions in proposals. Neither a Bulletin
entry nor a checkpoint creates owner approval. Do not edit product code,
canonical Wiki, roadmaps, or SPECs without separate authorization.

## Ticket intake and unattended work

Use [TICKET.md](TICKET.md) as the initial assignment brief and compact return point. Follow the shared [ticket workflow](../../ticket-workflow.md), adapting its link at other folder depths. Read the ticket at re-entry before following its source and decision links. It records current scope, authority, session/report pointers and the next action; accepted intent and decisions stay in their respective documents.

A small fix can use a bounded proposal, independent review, authorized implementation and verification without a full roadmap. Broader or unresolved work escalates into First Draft/shaping/planning. This local role can coordinate a separately authorized repair assignment; it does not grant product writes just by opening the folder. Review contributors share the memory folder but own separate assignment directories; preserve exact reviewed revisions and finding dispositions. Mission Control monitors unattended work and routes questions/results after activation; the domain session remains the place for owner discussion and steering.

## Investigation governance

The main session follows the shared [investigation contract](../../investigation-contract.md): it selects bounded questions before drafting only when needed to establish the framing, after drafting to resolve concrete gaps, and during revision when evidence changes. It owns assignment scope, report disposition and synthesis. First Draft proposes questions; supporting investigators return evidence and options under their assignments.

Use the contract’s specialty definitions and packet/report fields; these names do not imply installed profiles. Keep investigative reports separate from the shared draft unless a subsequent repair assignment grants exact write ownership. Preserve owner decisions, source revisions and unresolved intent. Under D-010, the owner-designated main Launchpad session has standing authority to start and manage bounded investigators when their answers can materially inform the next project decision; no per-assignment owner approval is needed. Check for existing work first, use an available suitable agent with the contract and scoped packet, record actual identities and source revisions, run independent questions in parallel when supported, and incorporate returned evidence. Main domain sessions remain owner-managed; side chats cannot delegate and session/tool restrictions still apply. Adapt the shared-contract link if this template is placed at a different depth.

## Use the starter documents to guide discussion

TICKET supplies the intake brief alongside the sibling CAPTURE, INTENT, DECISIONS, ISSUES and PROPOSALS conversational templates. REFERENCES, CHANGE_SURFACE and CONTRACTS add source, impact and guarantee structures, with a starter index and BULLETIN. Adapt or omit extensions that have no use in the selected project, updating the index accordingly. They contain prompts, not findings or approved direction. When creating an authorized live folder, replace template titles/preambles and prompt prose with sourced content or an honest “not yet established” where relevant. Remove unused optional categories and update the index. Do not register or populate this template as a live session.

Use the sections as attention cues, not a questionnaire to exhaust. Follow the owner's current thought; at meaningful transitions, check what it leaves unclear or displaces. Surface the most useful next question, and preserve the rest for later re-entry. Topic-specific categories should come from the project, not automatically copy the CSS example.

- CAPTURE preserves the current synthesis, unfinished user threads, unendorsed assistant possibilities, decision prompts and links to routed outcomes.
- INTENT distinguishes why, current desired outcomes, longer-term goals, observable success, constraints and explicit non-goals. Unknown does not mean excluded.
- DECISIONS preserves explicit choices and supersession history; clear owner revisions do not require redundant confirmation.
- ISSUES records sourced problems and consequential ambiguity, missing intent or interpretation drift. For a possible contradiction, cite both statements and their context, identify affected work and ask the exact unresolved question. Check whether an assistant paraphrase created the conflict. An ordinary unexplored idea stays in CAPTURE.
- PROPOSALS holds candidate mechanisms and tradeoffs; approval links to the actual owner decision and only its settled scope.

REFERENCES distinguishes user statements, code, wiki/standards, runtime evidence, external sources and prior work. CHANGE_SURFACE maps affected behavior, code, data, wiki, planning and operational surfaces. CONTRACTS separates proposed versus established guarantees from evidence of implementation/adoption. Link these records together; a source, a change target and a guarantee have different roles. Use H4 subheadings within H3 records when context warrants more detail.

When a new statement may change earlier direction, compare the relevant sources before declaring supersession. Preserve both if unresolved. Link the issue from the decision queue, then propagate an explicit resolution to affected documents before clearing it. A synopsis states its source coverage; unavailable history remains a limitation. These templates do not activate automatic Checkpoint invocation or alter its cursor rules.

Use stable indexed H2 categories and H3 records with neutral IDs. The index defines required fields and allowed status/type values. Fields keep authority, subject, issue type, severity and lifecycle separate. Promotion preserves source backlinks and a compact routed record; do not duplicate authoritative content across documents.

Before escalating missing intent, follow [conversation-evidence.md](../../conversation-evidence.md). Resolve the designated main thread from CHECKPOINT.json or a verified assignment; shared CWD only yields candidates. Check PROPOSALS → DECISIONS, current Wiki/contracts, and targeted conversation context including later revisions. Record exact available thread/turn/message locators and coverage limits. Ask for the main source when designation remains ambiguous, without registering a side chat or advancing a cursor.

## Documentation sweeps

Use `$mc-document-sweep` after a meaningful batch of issues/decisions, structural revisions, and before planning handoff. Its procedure is at `../../.agents/skills/mc-document-sweep/SKILL.md` for a direct Launchpad child; adapt the path at other depths. The main session can dispatch a bounded reviewer under D-010. This is change-driven review, not periodic conversation capture or an hourly automation.

A sweep compares documentation to its last reviewed snapshot, follows affected unchanged records, revisits open findings and examines source-coverage gaps. Reports and snapshots live in `.document-sweeps/` only when a real folder is reviewed; do not create them in this inert template. Register that operational location in a live folder's handoff when first used, not as another content authority or a live cursor in index.json. Checkpoint remains the explicit history procedure with its separate cursor.

The main session incorporates findings into the appropriate documents and tracks disposition. No baseline means an initial package review, not invented history. Partial or stale work does not advance the baseline; a completed review with findings can advance while those findings remain open. A sweep is not independent Release Validation or release approval.

Before First Draft or Roadmap Creation handoff, the main workfolder agent runs `$mc-preflight` inline using `../../.agents/skills/mc-preflight/SKILL.md` (adapt at other depths). Apply the destination-specific threshold and reuse current sweep findings; return readiness, carried gaps and exact inputs. This does not launch work or replace stage Validation, independent Release Validation or owner approval.

## The files have different jobs

| File | Job | What must not go there |
| --- | --- | --- |
| `AGENTS.md` | Local instructions, document boundaries, attribution, and concurrency rules. | Changing task status or unapproved authority. |
| `index.json` | Static routing schema: document paths, kinds, authority, exact `##` sections, and `read_before` dependencies. | Chat UUIDs, live cursors, issue text, decisions, or progress. |
| `BULLETIN.md` | Advisory, cross-chat assignments, blockers, handoffs, and resolutions worth preserving for later readers. | Owner approvals, canonical facts, routine progress, or an expectation of automatic delivery. |
| `CAPTURE.md` | Readable conversation synthesis and open loops for Launchpad re-entry. | A raw full transcript or silently approved proposals. |
| `CHECKPOINT.json` | Optional live state naming one verified main Codex task and the last reviewed settled turn. | Document schema, findings, or the identity of an ephemeral side chat. |

New Launchpad folders normally establish `TICKET.md`, `CAPTURE.md`, `INTENT.md`,
`DECISIONS.md`, `ISSUES.md`, and `PROPOSALS.md` plus the local contract. Extend
the schema only when substantive material earns another document. Register
content documents and `BULLETIN.md` (as a support file) in `index.json`;
validate the index after changing documents or their `##` sections. Keep live
checkpoint state separate from that static index.

The `index.json` contract uses `schema_version` (currently `2`), `name`,
`description`, and ordered `documents`. Each document declares its relative
`path`, stable `kind`, `authority`, `lifecycle`, `read_before` dependencies,
and exact `##` `sections`; `support_files` records `AGENTS.md`, `index.json`,
and `BULLETIN.md`. Validate with:
`python3 <MC-home>/.agents/skills/mc-memory-maintenance/scripts/validate_index.py <working-folder>`.
For compatible structured CAP-NNN records, also use the sibling
`route_capture.py <working-folder> check`. Do not make the index a task registry
or a copy of document contents. These helpers belong to Memory Maintenance;
Checkpoint remains the history procedure.

For a folder directly under `launchpad/`, the shared procedures live at
`../../.agents/skills/` and the fronting procedure at
`../.agents/skills/mc-launchpad/SKILL.md`. Use those namespaced local definitions; the legacy personal skills retain
their original names and are not this folder’s default procedures. Adapt these
relative paths if a working folder uses a different depth.

## Re-entry and coordination

The main session reads the active folder's `AGENTS.md`, then `index.json`,
unresolved `BULLETIN.md` entries, owner intent, the working synthesis, and only
the relevant decisions/issues/proposals. Tell the owner what is settled, open,
and useful next. A side chat reads the same local contract, its assignment,
relevant bulletin entries and only the documents needed for that assignment.
For `/mc-checkpoint`, also read local checkpoint state and the registered main
history interval. Do not choose a different working folder by recency.

When the current assignment authorizes direct task messaging, use it for work
that needs a recipient's attention now: assignments, questions, steering, and
completion notices. Otherwise return the result in the requesting conversation. The Markdown
Bulletin is the durable shared record, not a messaging or wake service. Read
it at startup and meaningful checkpoints. Post only if another chat might
duplicate work, collide, remain blocked, or proceed with materially wrong
context without the entry. Use stable `B-NNN` IDs and record Type, Status,
Owner/chat, Target, Source, Summary, Next, and Outcome. Preserve the original
claim and add an attributed, dated outcome when resolving it. For a busy
Bulletin, assign one writer or use explicit file/section write leases; re-read
before editing. Scope write ownership for synthesis and decision documents as
well as the Bulletin. Coordinate a checkpoint writer with other document writers;
a cursor comparison does not lock Markdown or prevent two agents overwriting
the same synthesis. Markdown does not serialize writes or attest identity.

## Main-task checkpoint and JSON cursor

Find the current `codex-thread-tools` checkout or an installed
`codex-checkpoint` command; do not assume a fixed path after the tools folder
moves. If no unique tool or no verified main-task UUID is available, ask
instead of guessing. The optional read-only MCP server exposes
`find_codex_thread`, `read_codex_history`, `get_codex_pair_cursor`, and
`read_codex_pairs`; request-text lookup identifies a recorded task, not the
calling chat. The CLI also owns `CHECKPOINT.json` registration and advancement.

In a live working folder, the verified main task registers itself once. A side
chat uses that registration; if it is absent or mismatched, report the gap and
preserve state rather than guessing a UUID or creating a competing registration:

```text
<checkpoint-tool> register --state <working-folder>/CHECKPOINT.json --thread <main-task-uuid>
```

The tool creates this separate JSON state (note `schemaVersion`, not the
index's `schema_version`):

```json
{
  "schemaVersion": 1,
  "main": { "threadId": "<verified-main-task-uuid>", "hostId": "local" },
  "lastCheckpoint": null
}
```

Subsequent checkpoints store `pairId`, `recordedAt`, and an optional
`artifactPath`. A side chat reads the registered main UUID as a history
address; it never signs its own work with that UUID.

For an explicit `$mc-checkpoint` run:

1. Read the registry and capture `cursor --thread <main-task-uuid>` as a fixed
   high-water ID. A “pair ID” is a Codex turn ID, not necessarily one
   user/assistant exchange. Completed, interrupted, and failed turns count as
   settled; an in-progress turn does not.
2. Page through `pairs --mode since --thread <main-task-uuid> --anchor
   <previous-pair-id> --count 20` until reaching that high-water ID. Omit
   `--anchor` on the first run. For focused inspection use `--mode at`,
   `--mode before --count N`, or `--mode around --count N` with an anchor ID.
   The reader returns user/assistant text, not reasoning, developer messages,
   or tool payloads.
3. Reconcile the covered interval into the authorized Markdown artifact,
   citing source task and turn IDs and keeping facts, proposals, decisions,
   and open questions distinct. Validate the working folder as required.
4. Only after the artifact is saved, run `advance --state
   <working-folder>/CHECKPOINT.json --pair <high-water-id> --expected
   <previous-pair-id-or-none> --artifact <updated-file>`. The tool verifies
   task membership and settled status, rejects backward movement, and checks
   that the previous cursor has not changed. If history is missing or no new
   settled turn exists, do not advance.

`index.json` is static schema; `CHECKPOINT.json` is operational state. Do not
hand-edit the cursor or use a request-text match to invent a side-chat UUID.
An explicitly identified side conversation signs contributions as
`Codex side chat (ephemeral)` with an ISO UTC timestamp. A normal task uses
its UUID only when directly verified.

The reader relies on Codex local storage formats, which may change. Its
history may omit ephemeral side chats. If the registered task or turn cannot
be read, preserve the cursor and report the gap; do not substitute another
task. The `codex-thread-tools` checkout documents the CLI, MCP reader, and
Markdown Bulletin pattern in `README.md` and `docs/CODEX-*.md`.

Contributed-by: Codex side chat (ephemeral)  
Recorded-at: 2026-09-25T04:56:57Z

Role contract updated by: Codex side chat (ephemeral)  
Recorded-at: 2026-09-26T00:49:22Z
