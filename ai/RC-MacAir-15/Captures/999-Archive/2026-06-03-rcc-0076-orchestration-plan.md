# Orchestration Plan: RCC-0076 Slice 1 - Remove Obsolete WorkspaceSwitcher Drawer

## Source Roadmap

Primary roadmap and full context:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
```

## Execution Order

Run these worker handoffs in order. Do not combine them unless the orchestrator explicitly decides to do so.

1. `docs/handoffs/2026-06-03-rcc-0076-slice-1a-switcher-drawer-preflight-report.md`
2. `docs/handoffs/2026-06-03-rcc-0076-slice-1b-detach-switcher-from-app.md`
3. `docs/handoffs/2026-06-03-rcc-0076-slice-1c-delete-switcher-store-handlers.md`

## Why These Slices

Slice 1A is read-only. It lets the orchestrator verify the current dirty worktree and active references before any worker edits.

Slice 1B detaches the obsolete component from `App.tsx` while leaving the old implementation and store API intact. This keeps the client buildable and limits the first edit to one dirty file.

Slice 1C performs the actual deletion and final cleanup. It is intentionally grouped because deleting drawer store APIs while `WorkspaceSwitcher.tsx` still exists would leave stale TypeScript references in active source.

## Orchestrator Review Checklist

After Slice 1A report:

- Confirm there are no active references outside expected files.
- Confirm no new server/Electron scope is required.
- Approve Slice 1B.

After Slice 1B report:

- Confirm only `fusion-studio-client/src/components/App.tsx` changed.
- Confirm `WorkspaceRibbon`, `WorkspaceCarousel`, and `WorkspaceAddModal` remain mounted.
- Confirm build and `git diff --check` pass.
- Approve Slice 1C.

After Slice 1C report:

- Confirm final obsolete-reference `rg` has no hits.
- Confirm ribbon/carousel-reference `rg` still has expected hits.
- Confirm no new close-request/Electron-menu hits.
- Confirm `npm run build` and `git diff --check` pass.
- Decide whether to run manual smoke or assign a smoke-only worker.

## Report Paste Template

Use this when a worker report comes back:

```text
Worker report for RCC-0076 Slice 1[letter]:

[paste report]

Please review against the orchestration checklist and tell me whether to approve the next slice, request a repair, or stop.
```

## Known Starting Context

At orchestration-plan creation time:

- Repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `.ai-project/bulletin/STATUS.md`, `.ai-project/bulletin/SCRATCHPAD.md`, and local `CLAUDE.md` were not present.
- `AGENTS.md` exists and contains some stale `open-robin-*` naming, but the actual target files exist under `fusion-studio-client`.
- The worktree was heavily dirty, including `fusion-studio-client/src/components/App.tsx` and many unrelated runtime/server/client files.
- `WorkspaceSwitcher` was still imported and mounted in `App.tsx`.
- `workspaceStore.ts` still contained `isSwitcherOpen`, `openSwitcher`, and `closeSwitcher`.
- `workspace-handlers.ts` still called `store.closeSwitcher()` on `workspace:switched` and `workspace:added`.
