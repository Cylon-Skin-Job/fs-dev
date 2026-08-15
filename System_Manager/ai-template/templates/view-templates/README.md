# View Templates

Canonical reusable v2 view shells live here.

Each view template should contain only view-shell material:

- `manifest.md`
- `content.json`
- `state/state.json`
- `styles/layout.css`
- `styles/icon.md`
- optional `onboarding/` setup material

Workspace data belongs in top-level workspace folders such as `Wiki/`, `Issues/`, `Captures/`, `Office/`, `Agents/`, and `Data/`, not inside the view template. The view template's `content.json` points at that default root and may be edited in a workspace to use a repo-shared folder instead.
