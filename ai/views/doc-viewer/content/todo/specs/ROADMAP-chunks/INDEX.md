# Theme + State Refactor — Chunk Index

**Master roadmap:** `ai/views/doc-viewer/content/todo/specs/ROADMAP-theme-state-refactor.md`

## Chunks

| # | File | Goal | Risk |
|---|------|------|------|
| 0 | [`chunk-00.md`](chunk-00.md) | Create `ai/settings/` and seed with copies | None |
| 1 | [`chunk-01.md`](chunk-01.md) | Add `__settings__` pseudo-panel to server | Low |
| 2 | [`chunk-02.md`](chunk-02.md) | Add `fetchSettingsFile` to client | Low |
| 3 | [`chunk-03.md`](chunk-03.md) | Update `useSharedWorkspaceStyles` to load from `ai/settings/` | Medium |
| 4 | [`chunk-04.md`](chunk-04.md) | Redirect theme service to `ai/settings/` | Medium |
| 5 | [`chunk-05.md`](chunk-05.md) | Update client path references (comments + UI) | Low |
| 6 | [`chunk-06.md`](chunk-06.md) | Delete old global files from `ai/views/settings/` | Medium |
| 7 | [`chunk-07.md`](chunk-07.md) | Create `ai/settings/tints.css` and extract from per-view CSS | High |
| 8 | [`chunk-08.md`](chunk-08.md) | Move per-view layout CSS to correct location | High |
| 9 | [`chunk-09.md`](chunk-09.md) | Final cleanup — delete old files, full walkthrough | Medium |

## Execution Order

Execute strictly in order (0 → 1 → 2 → ... → 9). Each chunk assumes all previous chunks are complete.

## Rollback Plan

- Chunks 0-5: Old files in `ai/views/settings/` still exist. Revert client code if needed.
- Chunk 6: Old files were deleted. Restore from `ai/settings/` copies if needed.
- Chunks 7-8: Old CSS files still exist until Chunk 9. Revert by restoring imports.
- Chunk 9: Point of no return. Ensure full walkthrough passes before proceeding.
