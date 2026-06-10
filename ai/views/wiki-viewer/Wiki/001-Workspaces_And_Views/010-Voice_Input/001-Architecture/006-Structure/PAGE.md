---
name: Voice Input Structure
description: File and module map for voice input, transcription cleanup, rule resources, packaging, and generated verb candidates.
metadata:
  incoming-edges:
    - Voice Input Overview
    - Voice Input Architecture
    - Voice Input Rule System
    - Voice Input Transcription Flow
  outgoing-edges:
    - Chat System Structure
    - Server And Runtime
  source-files:
    - fusion-studio-client/src/mic
    - fusion-studio-server/lib/transcription
    - fusion-studio-client/scripts/prepare-ai-resources.cjs
  connected-skills: []
  related-trigger-files: []
---

Current file/module map for voice input work.

## Client

| File | Role |
|---|---|
| `fusion-studio-client/src/mic/MicTrigger.tsx` | mic trigger, context menu, silent warm behavior |
| `fusion-studio-client/src/mic/VoiceRecorder.tsx` | recorder modal and recording UI |
| `fusion-studio-client/src/mic/useAudioCapture.ts` | audio capture, duration, analyzer behavior |
| `fusion-studio-client/src/mic/KittVisualizer.tsx` | visualizer bars |
| `fusion-studio-client/src/mic/VoiceRecorder.css` | mic and recorder styling |

## Server

| File | Role |
|---|---|
| `fusion-studio-server/lib/transcription/index.js` | transcription route, Whisper invocation, cleanup call |
| `fusion-studio-server/lib/transcription/deterministic-cleanup.js` | rule loading and cleanup orchestration |
| `fusion-studio-server/lib/transcription/cleanup-first-pass.js` | fillers, replacements, self-correction |
| `fusion-studio-server/lib/transcription/cleanup-list-pass.js` | list creation and list item repair |
| `fusion-studio-server/lib/transcription/cleanup-final-pass.js` | closing paragraph and final polish |
| `fusion-studio-server/lib/transcription/cleanup-utils.js` | shared cleanup helpers |
| `fusion-studio-server/lib/transcription/history-subscriber.js` | raw/corrected transcript history persistence |

## Rules And Resources

| Path | Role |
|---|---|
| `System Source Files/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules/` | editable source rules |
| `fusion-studio-client/electron/resources/rules/text-to-speech/` | copied runtime/package rules |
| `fusion-studio-client/scripts/prepare-ai-resources.cjs` | copies prompts and nested rule resources |
| `fusion-studio-client/scripts/generate-action-verbs.cjs` | generates WordNet verb candidates |

## Removed/Inactive Behavior

- local model cleanup for live mic transcription
- visible hover mini-modal/cue
- unstructured monolithic-only rule editing
