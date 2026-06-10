# OpenCode Slice 7 — Add OpenCode To New Chat Picker

## Context

OpenCode is now registered in the server harness registry and has opt-in runtime smoke coverage, durable `opencodeSessionId` persistence, and session-continuity tests. However, the New Chat CLI picker does not show OpenCode, so a user cannot create an explicit OpenCode thread through the UI.

The likely gap is catalog sync:

- Server runtime registry includes `opencode`.
- The picker renders `useResolvedCliList()`.
- `useResolvedCliList()` is driven by the hydrated CLI config catalog, or by the client fallback `HARNESS_OPTIONS`.
- Both visible catalogs currently stop at `kimi`, `claude-code`, `gemini`, `qwen`, and `codex`.

This slice should make OpenCode selectable in the New Chat dropdown without changing the default harness.

## Required Reading

Read these before editing:

- `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `fusion-studio-client/src/config/harness.ts`
- `fusion-studio-client/src/components/CliPickerDropdown.tsx`
- `fusion-studio-client/src/state/panelStore.ts`
- `fusion-studio-client/src/hooks/useHarnessStatuses.ts`
- `fusion-studio-server/lib/cli-config/catalog.js`
- `fusion-studio-server/lib/harness/registry.js`
- `fusion-studio-server/lib/harness/harness-status-service.js`
- `fusion-studio-server/lib/thread/thread-crud.js`

## Goal

OpenCode appears in the New Chat CLI picker and selecting it sends:

```json
{ "type": "thread:open-assistant", "scope": "<scope>", "harnessId": "opencode" }
```

The created thread must persist with `harness_id = 'opencode'`.

## Scope

Do:

1. Add an `opencode` entry to the client fallback catalog in `fusion-studio-client/src/config/harness.ts`.
2. Add the matching `opencode` entry to the server CLI config catalog in `fusion-studio-server/lib/cli-config/catalog.js`.
3. Keep catalog fields consistent between client and server: `id`, `name`, `materialIcon`, `accentColor`, `enabled`, and order.
4. Ensure the dropdown shows OpenCode as selectable when the install status is optimistic or installed.
5. Add focused tests if there is an existing practical test surface for the server catalog or thread creation behavior. If no client test harness exists, document that and rely on build/lint plus manual smoke.

Do not:

- Do not make OpenCode the default.
- Do not change `DEFAULT_HARNESS`.
- Do not change `thread-crud.js` default from `kimi`.
- Do not remove Kimi from any picker or catalog.
- Do not touch Electron packaging files.
- Do not touch Slack/extrication files.
- Do not add ACP/server mode.
- Do not add provider/model selector UI.

## Suggested Catalog Entry

Use this shape unless local conventions point to a better icon/color:

Client:

```ts
{
  id: 'opencode',
  name: 'OpenCode',
  description: 'OpenCode CLI — provider-flexible coding agent with JSON streaming',
  materialIcon: 'all_inclusive',
  accentColor: '#10B981',
  details: {
    provider: 'opencode',
    model: 'configured-default',
    features: ['tools', 'streaming', 'thinking']
  },
  enabled: true
}
```

Server mirror:

```js
Object.freeze({
  id: 'opencode',
  name: 'OpenCode',
  description: 'OpenCode CLI — provider-flexible coding agent with JSON streaming',
  materialIcon: 'all_inclusive',
  accentColor: '#10B981',
  details: Object.freeze({
    provider: 'opencode',
    model: 'configured-default',
    features: Object.freeze(['tools', 'streaming', 'thinking']),
  }),
  enabled: true,
})
```

Keep it after `codex` for now. Do not mark it `recommended` yet. The default-switch decision comes later.

## Acceptance Checks

Run from repo root:

```bash
grep -R "id: 'opencode'" -n fusion-studio-client/src/config/harness.ts fusion-studio-server/lib/cli-config/catalog.js
grep -R "DEFAULT_HARNESS = 'kimi'" -n fusion-studio-client/src/config/harness.ts
grep -R "const harnessId = msg.harnessId || 'kimi'" -n fusion-studio-server/lib/thread/thread-crud.js
```

Expected:

- First command finds OpenCode in both catalogs.
- Second command still finds Kimi as the client default.
- Third command still finds Kimi as the server new-thread default.

Then run:

```bash
cd fusion-studio-client
npm run build
npx eslint src/config/harness.ts src/components/CliPickerDropdown.tsx
```

Then run:

```bash
cd fusion-studio-server
npm test -- --runInBand test/harness/opencode test/harness/compat-harness-config.test.js test/thread/thread-harness-config.test.js
```

If the full server suite is reasonably fast in this checkout, also run:

```bash
cd fusion-studio-server
npm test -- --runInBand
```

Finally:

```bash
git diff --check -- fusion-studio-client/src/config/harness.ts fusion-studio-server/lib/cli-config/catalog.js
```

If `rg` is available, use it instead of `grep`. If `rg` is not available, `grep` is acceptable and should be documented.

## Manual Smoke

After restart:

1. Open the New Chat CLI picker.
2. Confirm OpenCode appears.
3. Select OpenCode.
4. Confirm a new thread opens.
5. Send a tiny prompt such as:

   ```text
   Reply exactly: FUSION_OPENCODE_PICKER_OK
   ```

6. Confirm it streams through the normal chat UI.
7. Confirm the created thread is durable with `harness_id = 'opencode'`.
8. Confirm a normal new chat without explicitly selecting OpenCode still uses Kimi.

Use the existing restart script if available:

```bash
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

## Report Back

Include:

- Files changed.
- Whether OpenCode appears in the picker.
- Whether selecting OpenCode creates an `opencode` thread.
- Whether default Kimi behavior remained unchanged.
- Build/lint/test results.
- Manual smoke result.
- Any unrelated dirty worktree files left untouched.
