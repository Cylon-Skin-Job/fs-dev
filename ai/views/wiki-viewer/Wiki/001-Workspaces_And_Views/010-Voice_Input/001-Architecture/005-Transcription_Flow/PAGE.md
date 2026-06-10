---
name: Voice Input Transcription Flow
description: Step-by-step path from microphone capture through Whisper, deterministic cleanup, and chat-ready text.
metadata:
  incoming-edges:
    - Voice Input Overview
    - Voice Input Architecture
  outgoing-edges:
    - Voice Input Structure
    - Chat System Overview
  source-files:
    - fusion-studio-client/src/mic/MicTrigger.tsx
    - fusion-studio-client/src/mic/VoiceRecorder.tsx
    - fusion-studio-server/lib/transcription/index.js
    - fusion-studio-server/lib/transcription/history-subscriber.js
  connected-skills: []
  related-trigger-files: []
---

Current transcription flow:

1. The mic trigger warms Whisper silently on hover/focus.
2. Clicking opens the recorder modal.
3. The client captures audio and posts it to `/api/transcribe`.
4. The server invokes Whisper and receives raw transcript text.
5. Deterministic cleanup runs first-pass, list-pass, and final-pass logic.
6. The server returns corrected text and cleanup metadata.
7. Transcription history stores raw and corrected text for debugging.
8. The client places corrected text into the chat input flow.

## Debugging Edge Cases

Use transcription history to compare raw and corrected text. If raw text is
complete but corrected text loses content, the bug is in cleanup scope, not STT.

Example query:

```bash
sqlite3 fusion-studio-server/data/fusion.db "select id, created_at, raw_text, corrected_text from transcription_history order by id desc limit 3;"
```
