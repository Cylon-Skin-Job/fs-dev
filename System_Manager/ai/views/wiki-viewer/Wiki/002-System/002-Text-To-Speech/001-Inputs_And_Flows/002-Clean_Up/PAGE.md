---
title: Clean Up
index_name: Speech-To-Text Cleanup Logic
summary: Details the deterministic cleanup layer, user replacement rules, list handling, correction flags, and disabled local model cleanup boundary after transcription.
tags:
  - speech-to-text
  - deterministic cleanup
  - replacement rules
  - list parsing
  - local model boundary
rule_files:
  - System Source Files/resources/text-to-speech/rules/replacement-rules.json
  - System Source Files/resources/text-to-speech/rules/list-markers.json
  - System Source Files/resources/text-to-speech/rules/correction-flags.json
  - System Source Files/resources/text-to-speech/rules/cleanup-thresholds.json
  - System Source Files/resources/text-to-speech/rules/filler-rules.json
  - System Source Files/resources/text-to-speech/rules/model-pass-rules.json
  - System Source Files/resources/text-to-speech/rules/stt-notice-rules.json
  - System Source Files/resources/text-to-speech/rules/visual-text-rules.json
---

# Clean Up

The cleanup layer turns raw speech-to-text output into editable text while keeping the user's original intent visible and recoverable.

The mic cleanup system currently uses deterministic logic only. The local model cleanup pass is disabled for microphone transcripts because prompt-based correction was not reliable enough to preserve user intent.

The editable cleanup behavior lives in JSON rule files. The runtime code owns parsing, validation, span tracking, and applying the rules; users and LLMs should edit the rule files instead of editing runtime code.

---

## Editable Rule Files

The safe edit surface for cleanup behavior is the runtime resource folder at `System Source Files/resources/text-to-speech/rules/`.

- `replacement-rules.json` — user vocabulary and speech-to-text phrase corrections.
- `list-markers.json` — dictated list start phrases, end phrases, and number marker normalization.
- `correction-flags.json` — phrases that indicate the speaker may be correcting themselves.
- `cleanup-thresholds.json` — deterministic list-boundary and cleanup thresholds.
- `filler-rules.json` — safe removal rules for filler words such as “um,” “uh,” and contextual “like.”
- `model-pass-rules.json` — archived/narrow model-pass definitions; not active for mic cleanup while model cleanup is disabled.
- `stt-notice-rules.json` — XML caution notice behavior when dictated text is sent with little review.
- `visual-text-rules.json` — UI label and feature-name handling where the system warns instead of rewriting risky text.

An LLM may propose changes to these files, but it should not change the cleanup runtime unless the user explicitly asks for implementation work.

---

## Deterministic First

Deterministic cleanup handles predictable transformations and is the active microphone cleanup path.

This includes vocabulary normalization, safe filler-word removal, dictated list handling, gated self-correction parsing, user-defined search-and-replace rules, and tracking the spans that were changed.

The goal is to make common cleanup behavior fast, repeatable, and explainable.

---

## User Replacement Rules

Users can define replacement-style rules for recurring speech-to-text errors.

Rules can match phrases, replace them with canonical terms, and include context guards such as “unless preceded by” or “unless followed by.” This prevents unsafe replacements where the same word should remain literal.

Longer phrase rules should run before shorter phrase rules so specific corrections win before general corrections.

---

## Dictated Lists

List cleanup is primarily deterministic.

The system can recognize list start phrases, list end phrases, and spoken number markers. It can normalize common speech-to-text confusions such as “to” or “too” as `2` when the surrounding sequence makes that interpretation likely.

The deterministic list parser owns the structure. The local model should not decide where a list starts or ends unless a specific edge-case prompt is invoked.

---

## Filler Cleanup

Filler cleanup removes common speech artifacts such as “um” and “uh.”

The word “like” is treated more carefully. It can be removed when it acts as filler, but preserved when it appears to be grammatically meaningful or when the user is referring to the word itself.

---

## Correction Flags

Some phrases indicate the user may be correcting themselves.

Examples include “oh wait,” “I mean,” “I meant,” “scratch that,” “change that,” “oops,” and similar correction markers.

When these flags are present, the deterministic parser looks for explicit correction patterns such as “not X, Y,” “I meant Y,” or “scratch that, Y.” It only rewrites when the target phrase can be identified safely.

---

## Forgotten List End

The system can detect possible forgotten list endings.

One signal is a final list item that is much longer than prior items, especially when it contains transition language such as “after that” or “then we are going to.”

When this condition is detected, deterministic transition rules split likely trailing prose out of the final list item.

---

## Highlighted Changes

Cleanup changes should be tracked as metadata.

The UI can highlight deterministic replacements and model-applied corrections so the user can inspect what changed, hover to see the original text, and restore it if needed.

This keeps cleanup useful without hiding what happened.
