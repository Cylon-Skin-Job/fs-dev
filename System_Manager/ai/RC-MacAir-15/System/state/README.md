# System State

Workspace-level system state that does not belong to an individual view.

Per-view UI state belongs in `Views/<viewer>/state/state.json`.

This folder is reserved for state such as view availability, hidden/restorable view records, setup progress, plus-button visibility, selected view bindings, and other workspace-level app state that should be repo-visible but is not user content.

It should not contain per-view pane widths, selected files, expanded folders, browser tabs, or view-specific popup state.
