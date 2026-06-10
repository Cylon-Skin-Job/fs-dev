# OpenCode Slice 11 — Single `cli.json` Harness Policy

## Context

The product direction has changed:

- Normal users should not choose between harnesses.
- New Chat should just mean New Chat.
- OpenCode should be the single default harness.
- Kimi should remain as code/hooks for advanced users or plugin authors, but
  should not be displayed or selectable by default.
- We should not add a second `harness-policy.json`. The existing `cli.json`
  surface should become the single config for both display and harness policy.

Current `cli.json` semantics are too weak. It is currently a visual/catalog
override layered on top of a factory catalog. An empty `{}` means "show every
factory harness." That is no longer the desired behavior.

New desired meaning:

```text
Listing a harness in cli.json lists/allows it.
Removing a harness removes it from the UI and from new-thread selection.
Setting a harness inactive/disabled removes it from the UI and from new-thread
selection.
```

## Required Reading

Read these before editing:

- `/Users/rccurtrightjr./projects/fs-dev/docs/LESSONS.md`
- `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `fusion-studio-server/lib/cli-config/catalog.js`
- `fusion-studio-server/lib/cli-config/loader.js`
- `fusion-studio-server/lib/cli-config/resolver.js`
- `fusion-studio-server/lib/thread/thread-crud.js`
- `fusion-studio-client/src/config/harness.ts`
- `fusion-studio-client/src/components/CliPickerDropdown.tsx`
- `fusion-studio-client/src/components/Sidebar.tsx`
- `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx`
- `fusion-studio-client/src/components/chat/useChatArea.ts`
- `fusion-studio-client/src/components/sidebar/useSidebar.ts`
- `fusion-studio-client/src/state/panelStore.ts`
- `fusion-studio-client/src/state/panelStoreTypes.ts`

## Goal

Make `ai/system/config/cli.json` the single authority for:

- default harness for new threads
- which harnesses are allowed for new thread creation
- which harnesses appear in the New Chat picker
- whether the picker should be shown at all

Default repo config should be OpenCode-only, so the New Chat UI directly creates
an OpenCode thread and does not display a harness dropdown.

## Config Shape

Implement a clear shape like this:

```json
{
  "defaultHarness": "opencode",
  "harnesses": {
    "opencode": {
      "enabled": true,
      "name": "OpenCode",
      "materialIcon": "all_inclusive",
      "accentColor": "#10B981",
      "order": 0
    },
    "kimi": {
      "enabled": false
    }
  }
}
```

Rules:

- `defaultHarness` must point to a listed, enabled harness.
- `harnesses` is the allowed/display list.
- A harness absent from `harnesses` is not displayed and not allowed for new
  thread creation.
- A harness listed with `enabled: false` is not displayed and not allowed for new
  thread creation.
- Cosmetic fields still work for listed harnesses.
- Unknown harness IDs should be ignored with a warning.
- If `cli.json` is missing or malformed, fall back to an OpenCode-only default.
- Do not fall back to the full factory catalog for normal operation.

If you need to preserve old direct-object config compatibility, do it narrowly:

```json
{
  "opencode": { "enabled": true },
  "kimi": { "enabled": false }
}
```

may be treated as legacy shorthand for:

```json
{
  "defaultHarness": "opencode",
  "harnesses": {
    "opencode": { "enabled": true },
    "kimi": { "enabled": false }
  }
}
```

Do not allow legacy `{}` to mean "show all harnesses."

## Files To Update

Expected server changes:

- `fusion-studio-server/lib/cli-config/loader.js`
  - `ensureWorkspaceFile()` should create an OpenCode-only config, not `{}`.
- `fusion-studio-server/lib/cli-config/resolver.js`
  - parse the new policy shape
  - resolve only listed + enabled harnesses for UI
  - expose helpers for default/allowed harness selection
- `fusion-studio-server/lib/cli-config/index.js`
  - export new helpers.
- `fusion-studio-server/lib/thread/thread-crud.js`
  - default new threads to resolved `defaultHarness`, not hardcoded Kimi
  - reject or coerce disallowed `msg.harnessId` for new thread creation
  - preferred behavior: reject explicit disallowed `harnessId` with a clear
    error; absent `harnessId` uses default.

Expected client changes:

- `fusion-studio-client/src/config/harness.ts`
  - fallback list should be OpenCode-only unless hydrated config says otherwise
  - expose helper(s) for selectable harness list/count if useful.
- `fusion-studio-client/src/components/Sidebar.tsx`
  - if only one selectable harness exists, New Thread should directly create a
    new thread instead of toggling the picker.
  - do not render `CliPickerDropdown` when there is one or zero selectable
    harnesses.
- `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx`
  - same behavior for collapsed/sidebar header picker path.
- `fusion-studio-client/src/components/sidebar/useSidebar.ts`
  - create-thread handler should use the single allowed/default harness when
    applicable.
- `fusion-studio-client/src/components/chat/useChatArea.ts`
  - header "new chat" behavior should match sidebar behavior.
- `fusion-studio-client/src/state/panelStore.ts`
  - keep `selectHarness(harnessId, scope)` for advanced/multi-harness configs.
  - add a direct "create default assistant thread" action if cleaner, or send
    `thread:open-assistant` without `harnessId` and let the server default.

Update types in `fusion-studio-client/src/types/index.ts` and
`fusion-studio-client/src/state/panelStoreTypes.ts` if you add policy fields to
`workspace:init`.

## Config Files To Update

Update current workspace config:

```text
ai/system/config/cli.json
```

to OpenCode-only policy.

Also update template/source config if it is used for new workspace creation:

```text
System Source Files/ai/system/config/cli.json
```

If that source file is unrelated or generated, document why you skipped it.

## Server Enforcement

This must not be only a UI change.

Server new-thread creation must enforce the policy:

- no `harnessId` -> create with `defaultHarness`
- `harnessId: "opencode"` -> allowed when OpenCode is enabled
- `harnessId: "kimi"` -> rejected when Kimi is disabled or absent

This avoids hidden UI options being invoked manually through WebSocket messages.

Existing historical threads:

- should still hydrate from SQLite/history
- should not be migrated in this slice
- do not delete or rewrite old `harness_id` values

If an existing disabled-harness thread is prompted, document current behavior.
Do not spend this slice designing historical-thread migration.

## UI Behavior

OpenCode-only default:

- New Thread button directly creates a thread.
- No harness dropdown is shown.
- No selector copy or "start chat with" menu is visible.

Multi-harness advanced config:

- If `cli.json` lists two or more enabled harnesses, show the picker.
- Picker should include only listed + enabled harnesses.
- Disabled or absent harnesses do not appear.

Zero enabled harnesses:

- Use OpenCode-only fallback, or surface a clear error. Prefer OpenCode fallback
  for resilience if config is malformed.

## Acceptance Checks

Run config/search checks:

```bash
grep -R "\"defaultHarness\".*\"opencode\"\\|\"opencode\"" -n ai/system/config/cli.json "System Source Files/ai/system/config/cli.json"
grep -R "msg.harnessId || 'kimi'\\|DEFAULT_HARNESS = 'kimi'" -n fusion-studio-server/lib/thread fusion-studio-client/src/config
grep -R "harness-policy" -n fusion-studio-server fusion-studio-client docs || true
```

Expected:

- OpenCode-only config exists.
- No remaining hardcoded new-thread default to Kimi.
- No new `harness-policy` file or references.

Run server tests:

```bash
cd fusion-studio-server
npm test -- --runInBand test/thread test/harness/opencode test/harness/compat-harness-config.test.js
```

Add focused tests for:

- missing/malformed/empty `cli.json` resolves OpenCode-only default
- explicit OpenCode allowed
- explicit Kimi rejected when absent/disabled
- resolved UI config includes only listed + enabled harnesses
- legacy direct-object config, if supported

Run client validation:

```bash
cd fusion-studio-client
npm run build
npx eslint src/config/harness.ts src/components/Sidebar.tsx src/components/chat/ChatAreaHeader.tsx src/components/chat/useChatArea.ts src/components/sidebar/useSidebar.ts src/state/panelStore.ts src/state/panelStoreTypes.ts
```

Run whitespace:

```bash
git diff --check -- fusion-studio-server/lib/cli-config fusion-studio-server/lib/thread fusion-studio-server/test fusion-studio-client/src ai/system/config/cli.json "System Source Files/ai/system/config/cli.json" docs/handoffs
```

If repo-wide `git diff --check` is blocked by unrelated existing whitespace,
document it and use touched-file checks.

## Manual Smoke

After restart:

1. Confirm New Thread creates a new chat directly.
2. Confirm no harness dropdown appears in the sidebar/header.
3. Confirm the created thread has `harness_id = 'opencode'`.
4. Send a simple prompt and confirm OpenCode streams.
5. Try to create a Kimi thread manually through WebSocket only if practical; it
   should be rejected when Kimi is disabled/absent from `cli.json`.

## Out Of Scope

Do not:

- remove Kimi harness code
- remove registry hooks for custom harnesses
- add model/variant/profile UI
- enable visible thinking by default
- touch Electron packaging
- migrate existing historical Kimi threads
- create `harness-policy.json`

## Report Back

Include:

- Files changed.
- Final `cli.json` shape.
- Whether dropdown is hidden in OpenCode-only config.
- Whether New Thread directly creates OpenCode.
- Server enforcement behavior for disallowed Kimi.
- Tests/build/lint results.
- Manual smoke results.
- Any follow-up risks.
