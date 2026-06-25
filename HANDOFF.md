# AI Workspace Template V2 — Handoff

**Date:** 2026-06-17
**Current ticket:** AI workspace template V2 / workspace folder rearrangement
**Scope reminder:** Stay focused on workspace template layout, Create New scaffolding, and server/client pickup. Do not continue ledger/startup/onboarding work unless explicitly requested.

---

## What We Accomplished

### Canonical Template Layout

The AI template is now organized around the V2 structure:

```text
System Source Files/ai-template/
  templates/
    view-templates/
    workspace-templates/
      new/
      startup/
        fusion-home/
        media-studio/
        invoicing-and-expenses/
        system-source-files/
```

Key decisions:

- `templates/view-templates` is the canonical V2 source for view shells.
- `templates/workspace-templates/new/profile.json` is the default Create New profile.
- `templates/workspace-templates/startup/*/profile.json` contains shipped startup profiles.
- Legacy/transitional roots are intentionally removed from the canonical template:
  - `System Source Files/ai-template/Views`
  - `System Source Files/ai-template/ai`
  - `System Source Files/ai-template/templates/views`
  - `System Source Files/ai-template/templates/workspaces`

### Server Create/Scaffold Flow

Updated:

- `fusion-studio-server/lib/workspace/create-service.js`
- `fusion-studio-server/lib/workspace/workspace-controller.js`
- `fusion-studio-server/lib/ws/workspace-request-handlers.js`

Behavior now:

- Create manifest exposes `workspaceTemplates`.
- `workspace:create_requested` accepts optional `workspaceTemplateId`.
- Missing `viewIds` is valid and defaults to the selected workspace profile.
- `scaffoldProject({ workspaceTemplateId })` reads the profile and scaffolds the selected views.
- Generated workspaces do not copy source-only `templates/`.

### Client Create New UI

Updated:

- `fusion-studio-client/src/components/WorkspaceCreateModal.tsx`
- `fusion-studio-client/src/components/WorkspaceCreateModal.css`
- `fusion-studio-client/src/state/workspaceStore.ts`
- `fusion-studio-client/src/types/index.ts`

Behavior now:

- Create New modal includes a `Workspace template` selector.
- Selector lists:
  - `New Workspace`
  - `Fusion Home`
  - `Invoicing and Expenses`
  - `Media Studio`
  - `System Source Files`
- Selecting a workspace template resets checked views to that profile.
- Submit sends `workspaceTemplateId`.

### Smoke/Test Coverage

Added/updated:

- `fusion-studio-server/test/workspace/ai-template-v2.test.js`
- `fusion-studio-server/test/workspace/workspace-create-template-smoke.test.js`

Coverage includes:

- Canonical V2 template roots exist and transitional roots do not.
- Create manifest exposes workspace profiles.
- Default `new` profile selects Files, Wiki, Issues, Agents.
- `fusion-home` startup profile selects Office plus Files, Issues, Wiki, Agents.
- Unknown profile IDs reject.
- V2 view discovery resolves machine-specific `ai/<machine>/Views`.
- Controller/request smoke verifies `workspaceTemplateId` reaches scaffold/register/switch flow.

Browser smoke passed:

- Modal lists all workspace profiles.
- Default `new` checks only Files/Wiki/Issues/Agents.
- Selecting `Fusion Home` adds Office and shows the profile description.

Verification passed:

```text
npm run build                         # fusion-studio-client
npm test -- --runInBand               # fusion-studio-server
git diff --check
```

Latest full server result:

```text
44 test suites passed
500 tests passed
1 skipped
```

---

## Current State

The local Fusion server was restarted during smoke testing and was left running on:

```text
http://127.0.0.1:3001/
```

The temporary Vite preview server used during testing was stopped.

The working tree is intentionally dirty. Do not revert unrelated changes. The user is actively using the ticket system in another session.

Known unrelated/active dirty files include:

- `ai/system/state/state.json`
- `ai/views/issues-viewer/content/tickets.json`
- `ai/views/issues-viewer/inbox/RCC-0090.md`
- `fusion-studio-server/data/workspace-cache.json`

---

## Important Scope Notes

### Ledger Work

Ledger infrastructure was accidentally added outside the approved scope:

- `fusion-studio-server/lib/db/migrations/029_event_ledger.js`
- `fusion-studio-server/lib/ledger/`
- `fusion-studio-server/scripts/query-event-ledger.js`
- `fusion-studio-server/test/ledger/`
- startup wiring in `fusion-studio-server/lib/startup.js`

The user asked for this to be documented as non-canonical/unapproved on the other spec. A note was added to the ledger-related ticket/spec. Do not continue ledger work unless explicitly requested. It may require cleanup or modification later.

### Machine Identity Work

Manual machine identity work was done for forward progress only:

- Script: `fusion-studio-server/scripts/machine-fingerprint.js`
- Given name: `RC-MacAir-15`
- Machine UUID: `8abd75a7-03c4-4019-9840-8fcd0be35767`
- Stable fingerprint: `3605305a2ea5150ec671fcfb6b333e8a12be937e89716966c03d867ad771c49b`
- Diagnostic fingerprint: `7cf9dcc53762b3fdc850dfe27c69620000d1f0d8ea106f4eceeafa1494e835ac`

Startup/onboarding deterministic identity generation is not implemented yet and should remain out of this current template-ticket scope unless the user asks for it.

---

## Next Recommended Slice

**Browser-level Create Submit smoke from the modal.**

Goal:

1. Use the actual Create New modal in the browser.
2. Enter a throwaway path under `/private/tmp`.
3. Select `new`, submit, and verify the workspace is created/registered/switched.
4. Repeat or follow up with `fusion-home` if needed.
5. Verify generated filesystem:
   - `new`: Files, Issues, Wiki, Agents only.
   - `fusion-home`: Office plus Files, Issues, Wiki, Agents.
6. Clean up throwaway workspace registration if the UI smoke registers it in the real DB.

Be careful: browser-level submit will mutate the real running Fusion DB unless isolated. Prefer either:

- a dedicated automated smoke with temp `FUSION_APP_USER_DATA`, or
- explicit cleanup after registering temp workspaces through the real server.

---

## Useful Commands

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npx jest test/workspace/ai-template-v2.test.js --runInBand
npx jest test/workspace/workspace-create-template-smoke.test.js --runInBand
npm test -- --runInBand
```

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
lsof -i:3001
```

---

## Files Most Relevant To Continue

- `docs/AI_WORKSPACE_TEMPLATE_V2_SPEC.md`
- `System Source Files/ai-template/templates/view-templates/`
- `System Source Files/ai-template/templates/workspace-templates/`
- `fusion-studio-server/lib/workspace/create-service.js`
- `fusion-studio-server/lib/workspace/workspace-controller.js`
- `fusion-studio-server/lib/ws/workspace-request-handlers.js`
- `fusion-studio-server/test/workspace/ai-template-v2.test.js`
- `fusion-studio-server/test/workspace/workspace-create-template-smoke.test.js`
- `fusion-studio-client/src/components/WorkspaceCreateModal.tsx`
- `fusion-studio-client/src/state/workspaceStore.ts`
- `fusion-studio-client/src/types/index.ts`
