---
name: Voice Input Rule System
description: Map of editable STT cleanup rule files, generated verb candidates, and runtime rule assembly.
metadata:
  incoming-edges:
    - Voice Input Overview
    - Voice Input Architecture
    - Voice Input Decisions
  outgoing-edges:
    - Voice Input Structure
  source-files:
    - System Source Files/ai/<machine>/Wiki/system/Text-To-Speech/Rules
    - fusion-studio-server/lib/transcription/deterministic-cleanup.js
    - fusion-studio-client/scripts/prepare-ai-resources.cjs
    - fusion-studio-client/scripts/generate-action-verbs.cjs
  connected-skills: []
  related-trigger-files: []
---

The voice cleanup rule system is JSON-first.

## Active Rule Tree

Rules live under:

`System Source Files/ai/<machine>/Wiki/system/Text-To-Speech/Rules/`

Important split folders:

- `list/` - list starts, action verbs, transitions, status examples, item cleanup.
- `correction/` - correction gates, replacement indicators, reset phrases, determiners.
- `text/` - replacements and filler cleanup.

## List Rules

- `list/action-verbs.json` - curated active action verbs.
- `list/action-verbs.generated.json` - WordNet candidate verbs, review-only.
- `list/status-segments.json` - `For example` status/completion segment lists.
- `list/transition-markers.json` - item, paragraph, and final transition phrases.
- `list/continuation-relations.json` - relation words such as `of`, `with`, `for`.
- `list/continuation-completions.json` - phrases such as `what we need to do`.

## Runtime Assembly

`deterministic-cleanup.js` loads split files and assembles the rule shape expected
by the cleanup passes. It falls back to older monolithic files where needed.

## Resource Packaging

`prepare-ai-resources.cjs` copies the editable rule tree into Electron resources
so dev and packaged runtime can resolve the same rule structure.
