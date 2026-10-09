---
name: mc-checkpoint
description: Reconcile a registered main Codex task into durable project memory from its last saved turn cursor. Use when the user explicitly invokes /mc-checkpoint or $mc-checkpoint to inspect all settled turns since the previous checkpoint, save a bounded synthesis, and advance the cursor only after the artifact is written. Also use for explicit pair-ID history queries. Do not use for a lightweight checkpoint of the current Launchpad conversation; that is /capture.
---

# Checkpoint

Track where a durable review of a main Codex task stopped. A checkpoint pair ID
is a Codex turn ID. A turn may contain multiple assistant messages or no user
message, so do not assume a strict one-user/one-assistant pair.

This is a focused history procedure, often performed by a side chat. Follow
the target folder’s own `AGENTS.md`, document schema and [record rules](../mc-memory-maintenance/references/records.md).
It does not invoke the legacy Second Brain workflow or register a side chat
as the main session. A checkpoint summarizes history but cannot create owner approval or
implementation authority.

Resolve the tool for this run: use an installed `codex-checkpoint` command if
present, or locate the unique `bin/codex-checkpoint.js` in the user-supplied
tools checkout/current workspace and run it with Node. Verify the candidate
file exists; the tools checkout may have moved. If several candidates exist
or none can be found, ask for its path instead of guessing. Call the resolved
command `<tool>` below.

Documentation-delta review belongs to [Document Sweep](../mc-document-sweep/SKILL.md). This skill preserves its explicit invocation and history cursor behavior; it neither supplies a document baseline nor certifies package coverage. A sweep may use a separately authorized targeted history read without advancing CHECKPOINT.json.

For targeted reads and candidate lookup, follow [conversation-evidence.md](../../../conversation-evidence.md). The installed reader is currently at `/Users/rccurtrightjr./projects/session-hub-codex/bin/codex-checkpoint.js`; verify the path before use and re-resolve if moved. `resolve_codex_main_thread` reads the registry or returns exact-CWD candidates; it never registers or advances. A CWD candidate alone is insufficient evidence for main registration.

## Resolve the main task and registry

1. Use the exact registry or working folder named by the user. Otherwise find
   one `CHECKPOINT.json` in the established working folder; do not choose by
   recency across multiple folders. The file is live cursor state, separate
   from any static `index.json`.
2. Read applicable `AGENTS.md` instructions and the target document's local
   schema before editing.
3. Read the registry with `<tool> status --state
   /absolute/path/CHECKPOINT.json`. If absent, the verified main task may
   register itself with `<tool> register --state
   /absolute/path/CHECKPOINT.json --thread <main-uuid>`. It stores `main.threadId`,
   `main.hostId`, and `lastCheckpoint.pairId`. The main task must register its
   verified UUID once. A side chat reads that UUID; it does not claim the main
   task's UUID as its own. If the registry is missing and no verified main UUID
   or unambiguous folder was supplied, ask for that information.
4. When contributing from an explicitly identified side conversation, sign
   the record as `Codex side chat (ephemeral)` with an ISO UTC timestamp. If
   the conversation type is unclear, say `Codex chat (identity unresolved)`.
   Do not infer a side-chat UUID from a request-text match.

## Read a bounded history interval

The tool reads locally recorded Codex tasks and excludes reasoning, developer
messages, and tool payloads. Run `<tool> help` for syntax.

1. Capture the latest settled pair ID with `cursor --thread <main-uuid>` as a
   fixed high-water mark. An in-progress turn is not checkpointed.
2. Read `pairs --mode since --thread <main-uuid> --anchor <last-pair-id>
   --count 20`. Omit `--anchor` for the first checkpoint. Follow `hasMore` and
   `nextAfterPairId` until the fixed high-water mark has been read. Include
   interrupted and failed turns with their statuses. New turns that settle
   after the high-water mark belong to the next checkpoint.
3. For focused inspection, use `--mode at --anchor <id>`, `--mode before
   --anchor <id> --count N`, or `--mode around --anchor <id> --count N`.
   `before` excludes the anchor. `around` includes N turns on each side plus
   the anchor. These queries alone do not advance the checkpoint.
4. If the local task reader cannot find the registered task or pair, report
   the missing history and preserve the existing cursor. Do not substitute
   another task or advance based on an incomplete interval.

## Save and advance

Write a concise, source-attributed synthesis into the user's target document
or the destination defined by the working folder. Preserve owner decisions,
facts, proposals, and open questions as distinct claim types. Re-read the
target before editing to account for concurrent work. If no durable target is
clear, present the proposed destination and ask before advancing.

Validate the saved artifact using `python3 <MC-home>/.agents/skills/mc-memory-maintenance/scripts/validate_index.py <working-folder>` and, for compatible structured Capture records, the sibling `route_capture.py <working-folder> check`. Coordinate one writer for overlapping synthesis/cursor work; expected-cursor comparison does not lock Markdown. A replacement main-history source requires an explicit supported re-registration procedure preserving old provenance; never reset it by guessing.

After the artifact is saved and locally required validation passes, advance
`CHECKPOINT.json` to the fixed high-water pair using:

```bash
<tool> advance \
  --state /absolute/path/CHECKPOINT.json \
  --pair <high-water-pair-id> \
  --expected <previous-pair-id-or-none> \
  --artifact /absolute/path/to/updated-document.md
```

The tool rejects a changed previous cursor, an unknown or in-progress pair,
and backward movement. If no new settled pairs exist, leave the file alone.
Report the main task UUID, previous and new pair IDs, the interval covered,
the artifact changed, and any status or evidence limitations.
