---
name: Voice Input Architecture
description: Architecture map for Fusion Studio microphone input, transcription, deterministic cleanup, and rule resources.
metadata:
  incoming-edges:
    - Voice Input Overview
  outgoing-edges:
    - Voice Input Decisions
    - Voice Input Lessons
    - Voice Input Rule System
    - Voice Input Transcription Flow
    - Voice Input Structure
  source-files:
    - fusion-studio-client/src/mic
    - fusion-studio-server/lib/transcription
    - fusion-studio-client/scripts/prepare-ai-resources.cjs
  connected-skills: []
  related-trigger-files: []
---

Voice input is a user-facing input surface with server-side transcription and
cleanup ownership.

## Layers

1. Client mic UI captures audio and controls recorder state.
2. Server transcription receives audio and invokes Whisper.
3. Deterministic cleanup applies first-pass correction, list formatting, and final polish.
4. Corrected text returns to the client for chat input use.
5. Raw/corrected transcript history is retained for debugging edge cases.

## Cleanup Passes

- First pass: sentence cleanup, filler removal, replacements, self-correction.
- List pass: list detection, list item creation, transition cleanup, status/example lists.
- Final pass: closing paragraph splits, long item splits, final punctuation.

## Boundary

Voice input prepares text. Chat System owns thread runtime, prompt acceptance,
streaming, persistence, and assistant output rendering.
