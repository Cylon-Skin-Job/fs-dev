---
name: Stub And Planning Defaults
description: Default treatment for incomplete development features and planning-session scope.
metadata:
  incoming-edges:
    - Enforcement
  outgoing-edges:
    - Code Standards
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

Use this page during planning sessions when a feature includes later work that
will not be completed in the current build.

## Dev Stub Policy

Incomplete features may appear as visible stubs when the user wants the UI
shape in place.

Stub controls are inert:

- no click handler
- no backend message
- no state mutation
- no toast

Shared fallback toasts are for active actions that unexpectedly lack required
data. They are not a substitute for implementing stub behavior.

## Planning Scope

Document active behavior, stub behavior, and smoke-test boundaries separately.
Do not let a stub imply persistence, network calls, or background work.
