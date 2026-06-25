---
name: Voice Input Overview
description: Overview of Fusion Studio voice input, Whisper transcription, deterministic STT cleanup, editable rules, and voice-to-chat behavior.
metadata:
  incoming-edges:
    - Wiki Guide
    - Workspaces And Views
    - Chat System Overview
  outgoing-edges:
    - Voice Input Architecture
    - Voice Input Decisions
    - Voice Input Lessons
    - Voice Input Rule System
    - Voice Input Transcription Flow
    - Voice Input Structure
  source-files:
    - fusion-studio-client/src/mic/MicTrigger.tsx
    - fusion-studio-client/src/mic/VoiceRecorder.tsx
    - fusion-studio-server/lib/transcription/index.js
    - fusion-studio-server/lib/transcription/deterministic-cleanup.js
  connected-skills: []
  related-trigger-files: []
---

Start here when working on Fusion Studio voice input.

Voice input turns microphone audio into chat-ready text. The live mic path uses
Whisper for speech-to-text, then applies deterministic cleanup rules before the
text enters the chat input. Local model cleanup is intentionally skipped for live
mic transcription because it can rewrite user intent.

## Current Model

- Whisper produces raw transcript text through `/api/transcribe`.
- Deterministic cleanup runs server-side after transcription.
- Cleanup rules are JSON files under the Text-To-Speech rule tree.
- Split rule files are source-of-truth for editing clarity; the runtime loader
  assembles them into the shape expected by the cleanup passes.
- Transcription history stores raw and corrected text so edge cases can be
  debugged against what Whisper actually heard.
- Hover/focus warms Whisper silently. The recorder modal opens on click.

## Architecture Map

- [Architecture](001-Architecture/PAGE.md) - current system overview.
- [Decisions](001-Architecture/002-Decisions/PAGE.md) - durable choices.
- [Lessons](001-Architecture/003-Lessons/PAGE.md) - bugs and traps not to relearn.
- [Rule System](001-Architecture/004-Rule_System/PAGE.md) - editable JSON rule files and generated verb candidates.
- [Transcription Flow](001-Architecture/005-Transcription_Flow/PAGE.md) - mic capture through cleanup and chat handoff.
- [Structure](001-Architecture/006-Structure/PAGE.md) - file/module map.

## Maintenance Reference

Keep voice input architecture, cleanup decisions, rule file organization, and
debugging lessons in this tree. Link to Chat System for chat runtime behavior and
to Server And Runtime for broader backend ownership.
