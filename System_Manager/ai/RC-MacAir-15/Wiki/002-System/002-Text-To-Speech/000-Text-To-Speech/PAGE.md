---
title: Text-To-Speech
index_name: Speech-To-Text Cleanup System
summary: Explains the local speech-to-text cleanup pipeline, including transcription, deterministic cleanup rules, local model capability boundaries, and transcript history storage.
tags:
  - speech-to-text
  - transcription
  - local model
  - deterministic cleanup
  - System:LLM API
---

# Text-To-Speech

Fusion Studio includes a local speech-to-text pipeline for turning dictated audio into editable text before it is sent to an assistant.

The installed speech-to-text model is Whisper `large-v3-turbo`, accessed through the server transcription module. `[needs citation: local speech-to-text model article]`

Mic cleanup currently uses deterministic rules only. A local text capability still exists behind the internal `gwen-0-8b` identity, currently backed by `onnx-community/Qwen3-0.6B-ONNX`, but it is not run on microphone transcripts because live self-correction prompts proved too likely to rewrite or invent intent. `[needs citation: local text model article]`

The system is designed to keep the user in control. Speech is transcribed, cleaned, shown in the UI, and stored for later comparison so cleanup behavior can be tuned over time.

---

## Pipeline Overview

The voice input flow has four stages:

1. Audio is captured from the microphone.
2. Whisper `large-v3-turbo` produces a raw transcript. `[needs citation: local speech-to-text model article]`
3. Deterministic cleanup applies predictable text corrections from editable JSON rules.
4. The cleaned transcript is returned for user review. The local text model cleanup pass is skipped for mic input.

Both the raw transcript and corrected output are stored in the database so previous samples can be reviewed and replayed through newer cleanup logic.

---

## Workflow Hooks

The transcription system can be called outside the mic UI.

For example, if a workflow needs to handle a longer recording, such as a 30 minute audio file, it can call the server transcription module or use the standalone transcription script as a starting point:

```bash
node fusion-studio-server/scripts/transcribe-file.js path/to/recording.webm output.txt
```

That script initializes the local Whisper model and transcribes a file from disk. Workflow scripts can use the same transcription module directly when they need custom chunking, post-processing, transcript storage, or additional automation.

The HTTP mic endpoint is optimized for interactive voice input. Longer recordings should be handled by workflow scripts so they can manage file size, chunking, retries, and output handling explicitly.

---

## Mic Integration

The pipeline is pre-wired into the microphone trigger in the Fusion Studio UI.

Opening the mic warms Whisper and the deterministic cleanup path. After recording, the cleaned transcript is pasted into the editable input buffer rather than sent directly to an assistant.

See [Mic Integration](../001-Inputs_And_Flows/001-Mic_Integration/PAGE.md) for the UI flow and warmup boundary.

---

## Deterministic Cleanup

Deterministic cleanup handles corrections that should not require model judgment.

At a high level, it normalizes known vocabulary, recognizes dictated list structure, applies safe filler-word cleanup, and records any changes so the UI can show what was altered.

This layer exists to make common speech-to-text fixes fast, repeatable, and inspectable. It is the active cleanup path for microphone transcription.

See [Clean Up](../001-Inputs_And_Flows/002-Clean_Up/PAGE.md) for the deterministic cleanup layer and editable rules.

---

## Local Model Boundary

The local text model is not currently used for microphone cleanup.

Earlier experiments used narrow prompts for self-correction and list-boundary repair. Those prompts were disabled for mic transcription because the model could add commentary, remove valid context, or change the user's intent. The deterministic parser now handles supported self-correction and list-boundary cases directly.

The prompt resources remain editable for future capability work, but changing the prompt does not re-enable model cleanup for the mic path.

---

## System:LLM API

The System:LLM API can run the local text capability for non-mic tasks or future cleanup experiments. `[needs citation: System:LLM API article]`

The current local text capability is configured behind `gwen-0-8b` and backed by Qwen3. Mic transcription warmup deliberately reports cleanup as deterministic and skips model warmup. `[needs citation: local text model configuration article]`

---

## Related Articles

- Local text model `[needs citation]`
- Local speech-to-text model `[needs citation]`
- Transformer.js runtime `[needs citation]`
- PyTorch model notes `[needs citation]`
- Transcript history storage `[needs citation]`
