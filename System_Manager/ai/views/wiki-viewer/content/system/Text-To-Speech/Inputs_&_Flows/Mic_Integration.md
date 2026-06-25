---
title: Mic Integration
index_name: Microphone Integration Flow
summary: Describes how the microphone input opens, warms the speech and cleanup stack, captures audio, and sends transcript output into the editable input buffer.
tags:
  - speech-to-text
  - microphone
  - voice input
  - warmup
  - input buffer
---

# Mic Integration

The microphone integration connects the UI voice trigger to the local transcription and cleanup pipeline.

The mic is intentionally not a direct command channel. It captures dictated speech, returns editable text, and lets the user review the output before sending it to an assistant.

---

## First Click Warmup

When the mic is opened, the app warms the local transcription stack.

The warm path prepares the speech-to-text model and confirms deterministic cleanup is ready. It does not warm the local text model for mic cleanup. `[needs citation: local speech-to-text model article]`

---

## Recording Flow

The recording flow captures audio from the microphone and submits it to the server transcription endpoint.

The server returns both the raw transcript and the cleaned transcript. The cleaned transcript is inserted into the UI input buffer, where the user can review or edit it before sending.

---

## Prompt Editing

The mic trigger also exposes prompt editing through the mic context menu.

The prompt editor displays raw markdown with line numbers and saves changes back to the prompt resource used by the local text capability.

Prompt edits do not currently affect microphone cleanup, because the mic path skips model cleanup and uses deterministic JSON rules instead.

---

## Review Boundary

The mic integration exists to preserve a review boundary between speech and assistant action.

This is different from tools that paste dictated text directly into a CLI or agent prompt without showing the user exactly what will be sent.
