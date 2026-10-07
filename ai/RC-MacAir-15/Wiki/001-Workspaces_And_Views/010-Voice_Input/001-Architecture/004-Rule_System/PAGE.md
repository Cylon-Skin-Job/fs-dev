---
name: Voice Input Rule System
description: Map of editable STT cleanup rule files, generated verb candidates, and runtime rule assembly.
metadata:
  source-files:
    - fusion-studio-server/lib/transcription/deterministic-cleanup.js
    - fusion-studio-server/lib/resources/resolver.js
    - fusion-studio-client/scripts/prepare-ai-resources.cjs
    - fusion-studio-client/scripts/generate-action-verbs.cjs
  last-modified: "2026-09-28T04:56:08Z"
---

The voice cleanup rule system is JSON-first.

## Active Rule Tree

Rules live under:

`System_Manager/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules/`

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

## Source and runtime rule selection

`prepare-ai-resources.cjs` selects `System_Manager/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules` when present (as in this checkout), otherwise `System_Manager/resources/text-to-speech/rules`. It copies that tree into `fusion-studio-client/electron/resources/rules/text-to-speech`. Edit the selected source, then prepare/package resources; editing a copied resource alone is not a durable source change.

At runtime `getTextToSpeechRulesRoot` prefers `rules/text-to-speech` under the resource root selected by `FUSION_RESOURCES_PATH`, the development Electron resources directory, or the repository fallback. If that rules directory is absent, it uses `System_Manager/resources/text-to-speech/rules`. Runtime resolution does not directly prefer the legacy wiki source tree. This is source inspection, not a transcription or packaged-build test.
