---
ticket-id: 001
title: Workspace Onboarding
status: inbox
type: onboarding
created-from: default-view-template
priority: normal
related-captures:
  - ai/Captures/001-Captures/
  - ai/Captures/003-SPECs/
  - ai/Captures/004-ToDo/
  - ai/Captures/007-Workflows/
related-skills:
  - clarify
  - curiosity
  - captures
  - spec
  - pre-flight
---

# Workspace Onboarding

This is the first ticket for a new workspace. Use it to decide what this workspace is for, what should be tracked, and how much automation or collaboration should be enabled.

## Purpose

Help the user shape the workspace without assuming they want implementation work yet.

## Suggested First Pass

- What is this workspace for?
- Is this mostly private, collaborative, code-focused, research-focused, or mixed?
- Should ideas be captured as captures, to-do lists, specs, or issues?
- Should `ai/` be local-only, partially synced, or committed for collaboration?
- Should GitHub, GitLab, both, or neither be connected?
- Should a SQLite mirror be used when that system is available?

## Suggested Outputs

- A short workspace purpose note.
- A setup preference note for git/sync/privacy.
- Any immediate captures or to-do lists the user wants.
- A spec only if the user clearly wants to build something.

## Pass Conditions

- Workspace purpose is written down.
- The user has chosen a rough capture/to-do/spec workflow.
- Git/sync/privacy preference is recorded or explicitly deferred.
- No implementation tickets or automation runs are created without user approval.

## Notes

This ticket is intentionally gentle. It should invite orientation, not force a rigid process.
