# Worker Handoff: RCC-0076 Slice 1B - Detach WorkspaceSwitcher From App

## Repo

```bash
cd /Users/rccurtrightjr./projects/fs-dev
```

Confirm:

```bash
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The tree may already be dirty with unrelated user/session work. Inspect before editing and do not overwrite unrelated changes.

## Required Reading

Read these before editing:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-remove-obsolete-workspace-switcher-drawer.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-rcc-0076-slice-1a-switcher-drawer-preflight-report.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
```

## Goal

Remove the obsolete `WorkspaceSwitcher` mount path from `App.tsx` only. Keep the app buildable by leaving the drawer component, drawer CSS, and store state untouched for the final deletion slice.

## Edit Scope

Primary file:

```text
fusion-studio-client/src/components/App.tsx
```

Do not edit any other source file unless TypeScript proves it is required. If another file is required, stop and report the blocker instead of expanding scope silently.

## Task

In `fusion-studio-client/src/components/App.tsx`:

1. Remove the import:

   ```ts
   import { WorkspaceSwitcher } from './WorkspaceSwitcher';
   ```

2. Remove all `<WorkspaceSwitcher />` mounts from all render branches.

3. Preserve all existing mounts for:

   ```text
   WorkspaceRibbon
   WorkspaceCarousel
   WorkspaceAddModal
   ModalOverlay
   LiaisonOverlay
   FusionOverlay
   SecondaryChat
   SecondaryDockButton
   ```

4. Do not touch logic in:

   ```text
   fusion-studio-client/src/components/WorkspaceTitle.tsx
   fusion-studio-client/src/hooks/useWorkspaceKeyboard.ts
   fusion-studio-client/src/components/WorkspaceRibbon.tsx
   fusion-studio-client/src/components/WorkspaceCarousel.tsx
   fusion-studio-client/src/state/workspaceStore.ts
   fusion-studio-client/src/lib/ws/workspace-handlers.ts
   ```

## Non-Goals

- Do not delete `WorkspaceSwitcher.tsx` or `WorkspaceSwitcher.css` in this slice.
- Do not remove `isSwitcherOpen`, `openSwitcher`, or `closeSwitcher` in this slice.
- Do not change ribbon behavior, carousel behavior, add modal behavior, remove behavior, Electron menus, or server code.
- Do not implement future ribbon membership behavior.

## Acceptance Checks

Run from repo root:

```bash
rg -n "WorkspaceSwitcher" fusion-studio-client/src/components/App.tsx
```

Expected result: no hits.

Run:

```bash
rg -n "WorkspaceRibbon|WorkspaceCarousel|WorkspaceAddModal" fusion-studio-client/src/components/App.tsx
```

Expected result: current ribbon/carousel/add-modal mounts still exist.

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

Then:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

## Report Requirements

Paste back:

- Whether repo root matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- Files changed.
- `rg` acceptance check results.
- `npm run build` result.
- `git diff --check` result.
- Any files touched outside the declared scope, with reason.

## Expected Outcome

Only `fusion-studio-client/src/components/App.tsx` changes. The obsolete drawer is no longer mounted, while the current ribbon/carousel/add-modal path remains mounted.
