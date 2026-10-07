---
name: Voice Input Structure
description: File and module map for voice input, transcription cleanup, rule resources, packaging, and generated verb candidates.
metadata:
  source-files:
    - fusion-studio-client/src/mic/MicTrigger.tsx
    - fusion-studio-client/src/mic/VoiceRecorder.tsx
    - fusion-studio-client/src/mic/useAudioCapture.ts
    - fusion-studio-server/lib/transcription/index.js
    - fusion-studio-server/lib/transcription/deterministic-cleanup.js
    - fusion-studio-server/lib/resources/resolver.js
    - fusion-studio-client/scripts/prepare-ai-resources.cjs
  last-modified: "2026-09-28T04:56:08Z"
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
| `System_Manager/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules/` | editable source rules |
| `fusion-studio-client/electron/resources/rules/text-to-speech/` | copied runtime/package rules |
| `fusion-studio-client/scripts/prepare-ai-resources.cjs` | copies prompts and nested rule resources |
| `fusion-studio-client/scripts/generate-action-verbs.cjs` | generates WordNet verb candidates |

## Removed/Inactive Behavior

- local model cleanup for live mic transcription
- visible hover mini-modal/cue
- unstructured monolithic-only rule editing

## Source and runtime rule selection

`prepare-ai-resources.cjs` selects `System_Manager/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules` when present (as in this checkout), otherwise `System_Manager/resources/text-to-speech/rules`. It copies that tree into `fusion-studio-client/electron/resources/rules/text-to-speech`. Edit the selected source, then prepare/package resources; editing a copied resource alone is not a durable source change.

At runtime `getTextToSpeechRulesRoot` prefers `rules/text-to-speech` under the resource root selected by `FUSION_RESOURCES_PATH`, the development Electron resources directory, or the repository fallback. If that rules directory is absent, it uses `System_Manager/resources/text-to-speech/rules`. Runtime resolution does not directly prefer the legacy wiki source tree. This is source inspection, not a transcription or packaged-build test.
