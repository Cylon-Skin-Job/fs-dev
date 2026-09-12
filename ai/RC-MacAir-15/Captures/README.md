# Captures — What This Folder Is

This folder backs the **Capture View** in Fusion Studio. Each numbered subfolder renders as a section; the markdown files inside render as a row of clickable tiles. Root-level files (like this README) are invisible in the UI.

If you're an AI session that landed here without the `capture-artifacts-and-docs` skill loaded, this README is the same contract.

## Rules

1. **Never put content files in this root folder.** Everything goes inside a section subfolder.
2. **Section folder naming:** `NNN-Name_of_Folder`. The numeric prefix orders sections; underscores render as spaces in the UI (e.g. `011-Sync_Design` displays as "011 Sync Design"). Use the next unused number.
3. **Capture docs are flat single `.md` files** placed directly in a section. No sub-structure, no `manifest.json`, no JSON sidecars. (Older conventions mentioning manifests, slug-folders, or capture→workspace conversion are dead — see the fossil in `011-Skills/`.)

## Where Things Go

| You have... | Put it in |
|---|---|
| An idea, design note, conversation output ("capture that") | `001-Captures/` |
| An actionable spec ready for implementation | `002-SPECs/` |
| A task/todo (actionable but not yet spec'd) | `003-TODO/` |
| An HTML artifact / interactive mockup ("create an artifact") | `004-Playground/` |
| Static assets, sketches, mockup source material | `005-Assets/` |
| Screenshots | `006-Screenshots/` |
| Historical/preserved AI tooling | `011-Skills/` |
| Multi-agent process/convergence lessons | `013-Convergence_Loops/` |
| The Composable Views vision/configurable-views platform track | `029-Composable_Views/` |
| Retired or superseded docs | `999-Archive/` |

`NNN-*-Temp` folders (e.g. `008-Provenance-Temp`) are scoped working areas for active roadmaps — don't add unrelated files to them.

## Deciding Between Capture, TODO, and SPEC

- Just information, thinking, or a record → **capture** (`001-Captures/`).
- Actionable but loosely defined → **TODO** (`003-TODO/`).
- Actionable and fully specified → **SPEC** (`002-SPECs/`).

When in doubt, capture it — a capture can be promoted later.
