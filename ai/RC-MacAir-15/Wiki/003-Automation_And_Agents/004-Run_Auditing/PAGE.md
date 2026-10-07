---
name: Run Auditing
description: Current legacy agent-run records, evidence gaps, and review questions.
metadata:
  source-files:
    - fusion-studio-server/lib/runner/run-folder.js
    - fusion-studio-server/lib/runner/index.js
    - fusion-studio-server/lib/runner/prompt-builder.js
    - fusion-studio-server/lib/tickets/dispatch.js
  last-modified: "2026-09-28T04:16:38Z"
---

## Current legacy run record

The standalone ticket dispatcher can start the legacy runner for an eligible assigned ticket, although normal server startup does not mount that dispatcher. A run creates a timestamped folder under the workspace's Agents operational root. It writes `manifest.json` with run, agent, ticket, prompt and lifecycle fields and an initially empty `run-index.json`. When present, it copies the ticket, selected `PROMPT_NN.md` and `LESSONS.md`. It updates the manifest as the wire process starts or exits and appends a line to the agent's `HISTORY.md` on exit. These are operational records, not proof that every wiki edit has a run or that the run is a governed automation fact.

## Evidence and review

The runner does not produce a fixed gather/propose/execute/verify step set, an edge-propagation graph or run-local before/after `PAGE.md` snapshots. It reads live `AGENTS.md` and a selected prompt while building context but does not freeze the complete effective instruction set. Mediated-save preimages and eligible agent observations are separately owned evidence; an observation is not necessarily a pre-edit image. Consult the [Automation Run Provenance Schema](../../010-Events_And_Ledger/003-Provenance_Model/006-Automation_Run_Provenance_Schema/PAGE.md), [File Version Provenance Schema](../../010-Events_And_Ledger/003-Provenance_Model/005-File_Version_Provenance_Schema/PAGE.md), and [Audit Query And Review Provenance Schema](../../010-Events_And_Ledger/003-Provenance_Model/008-Audit_Query_And_Review_Provenance_Schema/PAGE.md) before drawing a cross-source conclusion.

A manual review can ask which ticket and prompt were recorded, whether available inputs cover the work, what changed during the run, whether a proposal matches the actual change and whether later corrections reveal a gap. Cite evidence for each answer. A later edit or nearby event is a reason to investigate, not proof of causation. Step notes, quality scores and an automated review loop need their own producer and evidence design.

## Retention

No automatic 30/90-day deletion schedule is approved here. Preserve durable history by default; retention, deletion, restore and export need user-controlled lifecycle decisions. Current bounded provenance queries are not a saved audit or autonomous review loop.
