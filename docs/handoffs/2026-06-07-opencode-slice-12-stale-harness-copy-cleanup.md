# OpenCode Slice 12 — Stale Harness Copy And Documentation Cleanup

## Context

Slice 11 changed the product model:

- `ai/system/config/cli.json` is now the single harness policy.
- OpenCode-only config hides the harness dropdown.
- New Thread directly creates an OpenCode thread.
- Kimi remains as implementation/plugin reference, but is not a normal-user
  default or visible option in the current config.

Some comments/docs still describe the old picker/catalog model or Kimi-default
history. This slice is a cleanup pass only. Do not change runtime behavior that
just passed manual smoke.

## Required Reading

Read before editing:

- `/Users/rccurtrightjr./projects/fs-dev/docs/LESSONS.md`
- `/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`
- `docs/handoffs/2026-06-07-opencode-slice-11-single-cli-config-policy.md`
- `fusion-studio-server/lib/cli-config/resolver.js`
- `fusion-studio-server/lib/cli-config/loader.js`
- `fusion-studio-server/lib/cli-config/catalog.js`
- `fusion-studio-server/lib/thread/thread-crud.js`
- `fusion-studio-client/src/config/harness.ts`
- `fusion-studio-client/src/components/Sidebar.tsx`
- `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx`
- `fusion-studio-client/src/components/CliPickerDropdown.tsx`

## Goal

Remove or update stale Kimi-default and always-visible picker language so future
workers understand the current model:

```text
cli.json is the policy.
OpenCode is the current default and only normal-user harness.
The dropdown is conditional and appears only when cli.json enables 2+ harnesses.
Kimi is retained as a harness implementation/plugin pattern, not the default UI.
```

## Scope

Do:

1. Update `docs/LESSONS.md` to add a lesson for Slice 11:
   - `cli.json` is policy, not just cosmetic catalog override.
   - listing + enabled means allowed/displayed.
   - absent or disabled means not displayed and not accepted for new-thread
     creation.
   - OpenCode-only hides the selector.
   - Kimi remains code/plugin reference only.
2. Update stale comments in touched source files where they still imply:
   - Kimi is the default/primary normal-user path.
   - the CLI picker is always part of New Thread.
   - `cli.json` only changes visual catalog fields.
   - factory catalog entries are automatically displayed unless hidden.
3. Keep terminology precise:
   - "harness policy" for new-thread allow/default behavior.
   - "CLI catalog" for metadata/fallback entries.
   - "picker" only for multi-harness configs.
4. Add or update a short comment near client fallback behavior explaining that
   fallback is OpenCode-only when `workspace:init` has not hydrated config.
5. Add or update a short comment near server resolver/default behavior
   explaining that missing/malformed config resolves OpenCode-only.

Do not:

- Do not change runtime behavior.
- Do not change `cli.json` policy values.
- Do not remove Kimi code.
- Do not remove `CliPickerDropdown`; it is still needed for advanced
  multi-harness configs.
- Do not touch Electron packaging files.
- Do not add model/variant/profile UI.
- Do not edit old historical handoff results unless a stale phrase is actively
  misleading in a current required-reading file.

## Suggested Search Pass

Run broad searches, then edit only current source/docs where wording matters:

```bash
grep -R "KIMI is the primary\|Default harness\|default.*Kimi\|Kimi.*default\|primary experience\|CLI picker\|always.*picker\|visual/catalog\|factory catalog" -n fusion-studio-client/src fusion-studio-server/lib docs/LESSONS.md docs/*.md
```

Review hits. Do not blindly replace strings. Some historical docs may be valid
history and should be left alone.

Likely files to consider:

- `docs/LESSONS.md`
- `fusion-studio-client/src/config/harness.ts`
- `fusion-studio-client/src/components/Sidebar.tsx`
- `fusion-studio-client/src/components/chat/ChatAreaHeader.tsx`
- `fusion-studio-client/src/components/CliPickerDropdown.tsx`
- `fusion-studio-server/lib/cli-config/resolver.js`
- `fusion-studio-server/lib/cli-config/loader.js`
- `fusion-studio-server/lib/cli-config/catalog.js`
- `fusion-studio-server/lib/thread/thread-crud.js`
- `fusion-studio-server/lib/startup.js`

## Acceptance Checks

Run:

```bash
grep -R "KIMI is the primary\|DEFAULT_HARNESS = 'kimi'\|msg.harnessId || 'kimi'\|Default harness - KIMI" -n fusion-studio-client/src fusion-studio-server/lib docs/LESSONS.md
```

Expected: no hits.

Run:

```bash
grep -R "harness-policy" -n fusion-studio-client/src fusion-studio-server/lib docs/LESSONS.md docs/handoffs/2026-06-07-opencode-slice-12-stale-harness-copy-cleanup.md || true
```

Expected: no source code hits. It is acceptable for this handoff to mention
that no separate `harness-policy.json` exists.

Run:

```bash
grep -R "cli.json" -n docs/LESSONS.md fusion-studio-server/lib/cli-config fusion-studio-client/src/config/harness.ts
```

Expected: current comments/docs describe policy semantics, not only cosmetic
overrides.

Validation:

```bash
cd fusion-studio-client
npm run build
npx eslint src/config/harness.ts src/components/Sidebar.tsx src/components/chat/ChatAreaHeader.tsx src/components/CliPickerDropdown.tsx
```

```bash
cd fusion-studio-server
npm test -- --runInBand test/thread test/harness/opencode test/harness/compat-harness-config.test.js
```

Whitespace:

```bash
git diff --check -- docs/LESSONS.md fusion-studio-client/src fusion-studio-server/lib docs/handoffs/2026-06-07-opencode-slice-12-stale-harness-copy-cleanup.md
```

If repo-wide checks are blocked by unrelated existing whitespace, document and
use touched-file checks.

## Manual Smoke

Manual smoke is optional for this slice because it should not change behavior.
If performed:

1. Restart Fusion.
2. Confirm New Thread still directly creates OpenCode.
3. Confirm dropdown remains hidden for OpenCode-only config.
4. Confirm prompt streaming still works.

## Report Back

Include:

- Files changed.
- Stale wording removed/updated.
- Confirmation no runtime behavior was intentionally changed.
- Build/lint/test results.
- Whether manual smoke was run or skipped.
- Any wording that was intentionally left because it was historical context.
