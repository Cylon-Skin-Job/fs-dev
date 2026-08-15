---
name: Voice Input Decisions
description: Durable decisions for Fusion Studio voice input and deterministic STT cleanup.
metadata:
  incoming-edges:
    - Voice Input Overview
    - Voice Input Architecture
  outgoing-edges:
    - Voice Input Lessons
    - Voice Input Rule System
    - Voice Input Transcription Flow
  source-files:
    - fusion-studio-server/lib/transcription/deterministic-cleanup.js
    - fusion-studio-server/lib/transcription/cleanup-first-pass.js
    - fusion-studio-server/lib/transcription/cleanup-list-pass.js
    - fusion-studio-server/lib/transcription/cleanup-final-pass.js
  connected-skills: []
  related-trigger-files: []
---

Durable decisions for voice input.

## Mic Cleanup Is Deterministic Only

Live mic cleanup does not use local model rewrite passes. The model can invent,
comment, or over-edit user intent. Whisper transcription is followed by
deterministic code and editable JSON rules.

## Raw Transcript History Is The Debug Source

When a voice edge case appears, inspect raw and corrected transcript history
before blaming Whisper or cleanup code.

## Rule Files Are Split By Purpose

The rule tree is partitioned so edge cases can be added where they belong:
verbs, transition markers, status segments, correction gates, replacements, and
fillers live in separate files.

## Generated Verb Lists Are Review-Only

`action-verbs.generated.json` comes from WordNet and is not active at runtime.
The active list is curated in `action-verbs.json`.

## Product Identity Stays Separate From Mic Cleanup

`gwen-0-8b` remains a product/internal capability identity. Live mic cleanup does
not depend on that model path.
