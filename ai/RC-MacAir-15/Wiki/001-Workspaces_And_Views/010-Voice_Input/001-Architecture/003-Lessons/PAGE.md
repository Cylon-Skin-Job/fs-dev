---
name: Voice Input Lessons
description: Recurring traps and learned constraints for voice transcription cleanup work.
metadata:
  incoming-edges:
    - Voice Input Overview
    - Voice Input Architecture
    - Voice Input Decisions
  outgoing-edges:
    - Voice Input Rule System
    - Voice Input Transcription Flow
  source-files:
    - fusion-studio-server/lib/transcription/cleanup-first-pass.js
    - fusion-studio-server/lib/transcription/cleanup-list-pass.js
  connected-skills: []
  related-trigger-files: []
---

Things not to relearn.

## Check Raw Before Assigning Blame

Several failures looked like Whisper deleted text, but raw transcript history
showed the text was captured. The cleanup pass had over-scoped the correction.

## `Scratch That` Must Scope To The Last Matching Phrase

`push to prod no scratch that push to dev channel` should replace `push to prod`,
not everything before the correction gate.

## Transition Phrases Are Not List Items

Standalone fragments like `After that.` should not become numbered list items.
Back-to-back break phrases such as `after that, and then` are boundaries.

## Closing Prose Must Stay Prose

Phrases like `I think that's it` or `If we want to do more tickets...` should be
split out below the list, not folded into the final list item.

## Do Not Over-List Ordinary Prose

Conversational prose such as grocery-style narration should stay as prose unless
there is enough list evidence.

## WordNet Is A Candidate Source, Not Runtime Policy

WordNet contains thousands of verbs, including rare terms. Use it to discover
candidates, then curate the active verb list.
