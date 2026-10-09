---
name: mc-capture
description: Checkpoint and reconcile the current conversation into an existing Mission Control or Launchpad working-memory folder. Use only when the user explicitly invokes /mc-capture or $mc-capture to refresh the readable conversational synthesis, preserve displaced user threads and unendorsed assistant possibilities, route mature outcomes to their proper documents, and leave the folder ready for re-entry without creating a new capture folder or launching a substantial background batch.
---

# Capture

Save where the conversation stands without turning the checkpoint into a transcript, a new workspace constructor, or an implementation task.

## Invocation Boundary

Run only when the user explicitly invokes `/mc-capture` or `$mc-capture`. Use the local Launchpad workflow for domain re-entry and shaping. Use [Memory Maintenance](../mc-memory-maintenance/SKILL.md) for authorized folder/schema work; research remains a bounded support assignment. Do not invoke the legacy Second Brain workflow.

## Resolve the Active Folder

1. Use the exact working folder or document named by the user.
2. Otherwise use the working folder established by this session’s assignment and CWD.
3. Read its local `AGENTS.md` and `index.json`; if a domain folder is incomplete, report the gap instead of falling back to the controller parent or another domain.
4. If no single active folder can be established, ask which folder should receive the checkpoint. Do not create one or guess among projects.
5. Read every applicable `AGENTS.md`, then `index.json`, `BULLETIN.md`, the indexed conversational-memory document, and its declared dependencies.

## Reconcile the Checkpoint

1. Refresh the working synthesis so another session can understand what prompted the discussion, what was explored, and where the thinking now stands.
2. Preserve user-originated threads displaced before full exploration.
3. Keep assistant-originated possibilities visibly unendorsed.
4. Keep unresolved owner choices in the decision queue; never promote tentative language into a decision.
5. Read the shared [record rules](../mc-memory-maintenance/references/records.md). Route mature outcomes by their authority: explicit owner choices to decisions, verified actionable problems to issues, candidate actions to proposals, and specialized material to its indexed domain document.
6. Leave compact routed records and source backlinks rather than duplicating full content in Capture.
7. Add one lightweight history checkpoint when it materially improves later re-entry.

Use the folder's own filenames, kinds, record schemas, and authority boundaries. Do not impose the common kernel on an established local schema.

## Keep the Operation Light

- Do not perform broad web research, repository audits, or multi-agent delegation.
- Do not invent new owner intent, approval, or implementation scope.
- Do not create a new document unless the user's checkpoint explicitly establishes substantive material and the local schema rules clearly require it; otherwise leave the possible extension as an open thread for Launchpad.
- Do not edit product code, a canonical Wiki, roadmaps, specs, tickets, or external systems.

## Verify and Report

Run `python3 <MC-home>/.agents/skills/mc-memory-maintenance/scripts/validate_index.py <working-folder>`. For compatible structured CAP-NNN records, also run the sibling `route_capture.py <working-folder> check`. These helpers are local and require no legacy skill. A side chat captures only its current authorized conversation; use Checkpoint to read registered main history. Report the folder, documents updated, outcomes routed, validation status, and the most important thread preserved for re-entry.
