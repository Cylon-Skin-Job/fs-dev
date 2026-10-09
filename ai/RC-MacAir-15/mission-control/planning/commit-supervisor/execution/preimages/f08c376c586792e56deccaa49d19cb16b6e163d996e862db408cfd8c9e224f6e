# Conversation evidence and main-thread resolution

> D-016 authorizes bounded conversation retrieval and local tool integration. Search recovers evidence; it does not create approval, register a main thread, checkpoint history or grant delegation. PROPOSALS.md preserves the candidate and its disposition; DECISIONS.md supplies the explicit owner choice and approved scope.

## Resolve the history source

Use the assigned workfolder and its main-thread source, not the current chat's inferred identity. The read-only `resolve_codex_main_thread` tool takes the absolute workfolder `cwd`, an optional explicitly supplied main `threadId`, and an optional exact checkpoint `statePath` (default `<cwd>/CHECKPOINT.json`).

1. Read the workfolder's checkpoint registry or the verified assignment's main-thread link/UUID. If they disagree, preserve the registry and resolve the conflict; do not silently replace it. A supplied source UUID is not proof of the caller's identity.
2. Without a designation, use `list_codex_threads` for the exact stored CWD. It returns titles, IDs, archived flags and pagination, not a main-role assignment. Multiple main/support/historical chats may share a CWD. Even one match needs an owner designation or existing assignment evidence before it becomes the main source.
3. Use a distinctive owner request with `find_codex_thread` or a bounded conversation search to narrow candidates. Read enough context to establish relevance. Do not choose by recency, title similarity or ranking alone. If still ambiguous, return candidate titles/links and ask which is the main history source. Investigators return the question through their manager rather than independently asking the owner repeatedly.
4. A workfolder path and a task's launch CWD may differ. Verify that mismatch against the assignment; do not silently search every ancestor or sibling. A missing designated thread, malformed registry or unavailable side conversation is a source gap, not permission to substitute another task.

Resolution never writes CHECKPOINT.json or advances a cursor. Only the verified main session registers itself under the existing Checkpoint contract. Registration replacement still requires an explicit supported handoff. Side chats keep ephemeral attribution and never claim a discovered main UUID as their own.

## Retrieve before escalating missing intent

Before raising an apparent missing decision, check the relevant INTENT, PROPOSALS, DECISIONS, ISSUES and prior reports; then applicable current Wiki, Code Standards, User Preferences and approved contracts. Follow exact references first. Search conversation history only where a bounded question can change the next planning decision. Do not perform a general history audit as preflight.

`search_codex_conversations` searches visible user/assistant text in locally recorded settled turns, scoped to a `threadId` or exact `cwd`. Optional role and all/any word matching refine the question. It uses per-call in-memory FTS5/BM25; source databases are read-only and no durable index is maintained. Ranking is relevance, not authority or chronology. It reports selected threads, scan limits, skipped records, result truncation and observation time; incomplete/negative results do not establish absence. Narrow the source or rephrase when limits prevent a useful answer.

Each hit includes task, turn and available message IDs, speaker, turn status and arguments for `read_codex_pairs` around that turn. Read surrounding context before relying on an excerpt, then inspect relevant later decisions/revisions. Use existing read-only pair/history tools when the source is already known. Failed/interrupted turns remain labeled evidence; unsettled turns are excluded by search. A later completed turn does not automatically supersede an earlier decision.

Document and Wiki retrieval remains exact file/section lookup or bounded text search in the assigned paths. This installation does not create a unified document index or a general SQL interface. Stop when the question is answered sufficiently or return the concrete source gap. Tools cannot retrieve side-chat history that the host did not record.

## Cite evidence and reconcile proposals

Use the existing REFERENCES **Source**, **Locator**, **Revision**, **Checked**, **Supports** and **Limitations** fields. For conversation evidence record:

- Task UUID/link and title; turn ID and message ID when returned; speaker and available timestamp/status.
- The relevant quotation or clearly labeled paraphrase, surrounding qualifications and affected scope.
- Retrieval method, observation time, source/interval coverage and unavailable history. A summary is a lead, not a claim that the original was read.
- Later statements checked, contradictions and explicit supersession/decision links. Do not fabricate an unavailable identifier.

PROPOSALS **Source** points to the originating suggestion; **Decision** links to the explicit owner decision and only its approved scope. Keep partial approval, rejection, deferral and supersession visible. Assistant suggestions, search rank, research completion, a Wiki inference or owner silence cannot create product approval. Apply a clearly applicable existing contract to routine implementation choices; distinguish that application from a newly recovered owner decision.

Return `answered explicitly`, `resolved by existing contract`, `interpretation only`, `conflicting`, or `not found within checked scope`, with evidence and the next action. Reconcile outdated issues only within the assigned write authority. A read-only investigator returns proposed corrections; the workfolder owner incorporates them.

## Roles and checkpoint boundaries

Any assigned planning/review agent may make a bounded read without invoking Checkpoint. Launchpad and preflight use it to avoid redundant owner questions; First Draft and Creator preserve locators and unresolved intent; validation inspects material source claims independently. A main Launchpad session may delegate an Intent and Authority investigation under its existing contract. This does not authorize side-chat delegation or extra agents in a restricted session.

History Checkpoint remains explicitly invoked: it reconciles all settled turns in a fixed interval, writes validated synthesis and only then advances the cursor. Targeted search/reads never claim that completeness or move the cursor. When a substantial unreconciled interval matters, recommend a checkpoint instead of pretending a handful of hits covered it. Separate side conversations require their own evidence or durable returns; a main-thread checkpoint does not certify them.

Execution checkpoints retain work state, artifacts/revisions, findings, active assignments, holds and next actions. They are distinct from history cursors. MC receives compact evidence/coverage outcomes; domain sessions retain detailed history. No automatic checkpoint, live controller, monitoring loop or product execution follows from this integration.

## Tool installation and fallback

The local implementation is `/Users/rccurtrightjr./projects/session-hub-codex`. Mission Control's `.codex/config.toml` configures the read-only `mc-conversation-tools` MCP server for trusted MC/descendant launch contexts. It exposes three evidence tools plus the four existing task/history tools. Definitions do not retroactively prove tool availability in a running chat; inspect its actual catalog. An outside-checkout agent needs the explicit procedure/tool path or appropriate scoped deployment.

Without MCP discovery, use the verified Node 25+ executable and absolute scripts directly:

```text
/opt/homebrew/bin/node /Users/rccurtrightjr./projects/session-hub-codex/bin/codex-evidence.js main --cwd <absolute-workfolder>
/opt/homebrew/bin/node /Users/rccurtrightjr./projects/session-hub-codex/bin/codex-evidence.js list --cwd <absolute-stored-task-cwd>
/opt/homebrew/bin/node /Users/rccurtrightjr./projects/session-hub-codex/bin/codex-evidence.js search --thread <uuid> --query <words> --role user
/opt/homebrew/bin/node /Users/rccurtrightjr./projects/session-hub-codex/bin/codex-checkpoint.js pairs --thread <uuid> --mode around --anchor <turn-id> --count 2
```

Use `help` for options. Locate the selected tools checkout again if it moves; do not pick an arbitrary duplicate. The adapter depends on local Codex SQLite/rollout formats, which may change. Report schema/read errors and use an available supported task reader or ask for the source; never repair Codex's internal databases to make retrieval work.

Contributed-by: Codex side chat (ephemeral)
Recorded-at: 2026-09-28T03:08:36Z
