---
name: Voice Input Architecture
description: Architecture map for Fusion Studio microphone input, transcription, deterministic cleanup, and rule resources.
metadata:
  source-files:
    - fusion-studio-client/src/mic/VoiceRecorder.tsx
    - fusion-studio-server/lib/transcription/index.js
    - fusion-studio-server/lib/transcription/deterministic-cleanup.js
    - fusion-studio-client/scripts/prepare-ai-resources.cjs
  last-modified: "2026-09-28T04:56:08Z"
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

<!-- section-toc:start -->
## Technical Articles in this Wiki Section

- [Decisions](../002-Decisions/PAGE.md) - Durable decisions for Fusion Studio voice input and deterministic STT cleanup.
- [Lessons](../003-Lessons/PAGE.md) - Recurring traps and learned constraints for voice transcription cleanup work.
- [Rule System](../004-Rule_System/PAGE.md) - Map of editable STT cleanup rule files, generated verb candidates, and runtime rule assembly.
- [Transcription Flow](../005-Transcription_Flow/PAGE.md) - Step-by-step path from microphone capture through Whisper, deterministic cleanup, and chat-ready text.
- [Structure](../006-Structure/PAGE.md) - File and module map for voice input, transcription cleanup, rule resources, packaging, and generated verb candidates.
<!-- section-toc:end -->
