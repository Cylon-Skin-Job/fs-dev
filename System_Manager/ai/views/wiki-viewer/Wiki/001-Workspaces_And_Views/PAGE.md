# Workspaces And Views

Workspaces are folders with an `ai/` directory. Views are the UI surfaces inside those workspaces.

Use this section for workspace and view modification guidance. The current System Source Files slice only preserves the section entry point because the old `workspaces & views` folder contained no article content beyond legacy navigation metadata.

## Current Guidance

- Workspace-level settings belong under `ai/settings/`.
- View instances belong under `ai/views/<view-id>/`.
- View templates and shippable system assets belong in System Source Files, not in a user's workspace instance.

For implementation standards, see `003-Enforcement/001-Code_Standards/PAGE.md`.
