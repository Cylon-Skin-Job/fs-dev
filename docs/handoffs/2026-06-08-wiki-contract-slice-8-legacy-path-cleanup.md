# Wiki Contract Slice 8: Legacy Path Cleanup

## Objective

Clean up obsolete wiki `content/` assumptions after the active viewer and all target wiki trees have moved to the canonical `Wiki/` + `PAGE.md` contract.

This slice is about cleanup and verification, not new behavior.

## Orientation: Exact Roots

Use these absolute paths. Do not guess path casing or workspace location.

Primary development repo:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Primary app code inside fs-dev:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
```

Internal fs-dev wiki inside the development repo:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer
```

System Source Files mirror inside the development repo:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/views/wiki-viewer
```

Fusion Home workspace and templates are outside fs-dev:

```text
/Users/rccurtrightjr./projects/Fusion-Home
/Users/rccurtrightjr./projects/Fusion-Home/ai/views/wiki-viewer
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/views/wiki-viewer
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/views/wiki-viewer
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/views/wiki-viewer
```

Other migrated default/user workspaces:

```text
/Users/rccurtrightjr./projects/solobooks/ai/views/wiki-viewer
/Users/rccurtrightjr./projects/media-editor/ai/views/wiki-viewer
```

Important: `System Source Files` has spaces in the path. Always quote it in shell commands.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-1-root-resolution.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-2-folder-tree-data-model.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-3-viewer-loader-rewrite.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-4-remove-server-group-synthesis.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-5-system-source-files-migration.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-6-default-workspace-template-migration.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-7-fs-dev-internal-wiki-migration.md`

Expected prior state:
- Active wiki viewer reads folder trees under `Wiki/`.
- System Source Files has `Wiki/` and TTS rule resources moved out of old wiki content.
- Fusion Home, templates, Solobooks, Media Editor, and fs-dev have `Wiki/` trees.
- Old `content/` folders may still exist intentionally.

## Important Git Ignore Note

In `fs-dev`, `ai/` is ignored by `.gitignore`:

```text
.gitignore: /ai/
```

The new internal fs-dev wiki exists on disk but is ignored:

```text
!! ai/views/wiki-viewer/Wiki/
```

Do not assume ignored means absent. If the user wants the internal fs-dev wiki committed, it will require force-add later:

```bash
git add -f ai/views/wiki-viewer/Wiki
```

Do not force-add unless explicitly instructed.

## Cleanup Targets

Primary old roots to assess:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/views/wiki-viewer/content/
/Users/rccurtrightjr./projects/Fusion-Home/ai/views/wiki-viewer/content/
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/views/wiki-viewer/content/
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/views/wiki-viewer/content/
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/views/wiki-viewer/content/
/Users/rccurtrightjr./projects/solobooks/ai/views/wiki-viewer/content/
/Users/rccurtrightjr./projects/media-editor/ai/views/wiki-viewer/content/   # may not exist
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/          # fs-dev internal, ignored by /ai/
```

Also assess legacy metadata/state references:

```text
fusion-studio-server/data/workspace-cache.json
content/index.json
topics.json
ai/views/wiki-viewer/content
wiki-viewer/content
_Guide.md
```

## Path Safety Requirement

Before deleting any old `content/` folder, search references to that exact folder path.

Classify every reference as one of:
- active runtime/code reference requiring fix before deletion
- generated/cache state safe to regenerate
- current documentation requiring update
- historical handoff/archive reference safe to leave
- old retained content path pending deletion

Do not delete a folder if any active runtime/code reference still points to it.

## Known New Canonical Roots

These should already exist after Slices 5-7:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/Fusion-Home/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/solobooks/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/media-editor/ai/views/wiki-viewer/Wiki/PAGE.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/Wiki/PAGE.md
```

If any of these are missing, stop and report which one is missing instead of continuing cleanup.

## Known Metadata Files To Check

Each of these `index.json` files should point `settings.contentDir` and `settings.systemWikiDir` to `ai/views/wiki-viewer/Wiki`:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/Fusion-Home/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/solobooks/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/media-editor/ai/views/wiki-viewer/index.json
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/index.json
```

The active server resolver does not read `settings.contentDir` for panel root resolution anymore, but these values should still be cleaned for consistency and future tooling.

## Expected Active Code State

After prior slices, active code should not depend on old wiki content paths.

Verify these searches:

```text
fusion-studio-client/src: ai/views/wiki-viewer/content
fusion-studio-server: ai/views/wiki-viewer/content
fusion-studio-client/src/components/wiki: index.json|topics.json|_Guide|sections|articlesBySection|groupsByArticle
fusion-studio-client/src/state/wikiStore.ts: sections|articlesBySection|groupsByArticle|guideContent|articleContent
fusion-studio-server/lib/file-explorer.js: wiki-viewer|buildWikiGroups|groups: synthetic
```

Expected:
- No active client wiki/store old-model matches.
- No `file-explorer.js` wiki-specific behavior matches, except unrelated comments if any.
- Any remaining path references are docs/cache/legacy content and must be classified.

Concrete search commands from the fs-dev repo root:

```bash
grep -R "ai/views/wiki-viewer/content" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server" || true
grep -R "wiki-viewer/content" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server" || true
grep -R "index\.json\|topics\.json\|_Guide\|sections\|articlesBySection\|groupsByArticle" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/wiki" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/wikiStore.ts" || true
grep -n "wiki-viewer\|buildWikiGroups\|groups: synthetic" "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/file-explorer.js" || true
```

These commands use `grep` because this handoff may be executed in an environment where `rg` is unavailable.

## Deletion Policy

Preferred conservative approach:
- Do not delete large old `content/` trees in this slice unless reference searches are clean and the user confirms deletion is desired.
- Instead, produce a deletion matrix with `safe`, `blocked`, or `retain until commit decision` status.

If deleting is clearly safe and desired:
- Delete old `content/` folder for one target at a time.
- Re-run reference search after each deletion.
- Verify the app still loads `Wiki/` for that target.

Never delete ignored fs-dev `ai/views/wiki-viewer/content/` casually; it may contain internal history and is not visible in normal git status.

## Documentation Updates

Update current, non-historical docs that still instruct agents/humans to use old wiki paths.

Do not bulk-edit historical handoffs just to replace old paths. Historical records may remain as history.

Current docs likely needing updates:
- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md` if it still states old paths as current rather than historical.
- Any active standards docs that point at old code standards path.

New fs-dev code standards path:

```text
ai/views/wiki-viewer/Wiki/003-Enforcement/001-Code_Standards/PAGE.md
```

## Workspace Cache Policy

`fusion-studio-server/data/workspace-cache.json` is generated/dirty state. If it contains old wiki roots:
- Prefer regenerating through normal app startup/workspace refresh if known.
- If manually editing is necessary, document why.
- Do not treat generated cache references as source-of-truth blockers unless runtime uses them without refresh.

Exact cache path:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/data/workspace-cache.json
```

This file was already dirty before the wiki cleanup work. Treat it carefully and do not mix cache churn with source cleanup unless necessary.

## TTS Rules Resource Location

Text-To-Speech rules were moved out of wiki content in Slice 5.

New source location:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files/resources/text-to-speech/rules
```

Known active code references that should point there:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/resources/resolver.js
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/prepare-ai-resources.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/generate-action-verbs.cjs
```

Do not look for TTS runtime rules under `System Source Files/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules`; that folder was removed.

## Explicit Non-Goals

- Do not implement terminal wiki access; that is Slice 9.
- Do not rewrite the wiki viewer unless a cleanup bug is found.
- Do not change DB-backed Fusion overlay wiki behavior.
- Do not force-add ignored `ai/` files without explicit user instruction.
- Do not delete historical handoff docs.
- Do not delete old content trees without reference classification.

## Verification Steps

1. Active client build:

```bash
cd fusion-studio-client
npm run build
```

2. Server module syntax checks for touched server files:

```bash
cd fusion-studio-server
node -e "require('./lib/views')"
node -e "require('./lib/file-explorer')"
node -e "require('./lib/resources/resolver')"
```

3. Reference searches:

```text
ai/views/wiki-viewer/content
wiki-viewer/content
content/index.json
topics.json
_Guide.md
buildWikiGroups
groups: synthetic
```

Report and classify remaining matches.

4. Confirm canonical roots exist:

```bash
for p in \
  "/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/Fusion-Home/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/fusion-home/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/project-repo/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/Fusion-Home/workspace-templates/media-studio/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/solobooks/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/media-editor/ai/views/wiki-viewer/Wiki/PAGE.md" \
  "/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/Wiki/PAGE.md"; do
  test -f "$p" && printf 'OK %s\n' "$p" || printf 'MISSING %s\n' "$p"
done
```

5. Manual smoke if practical:

- Open System Source Files wiki.
- Open Fusion Home wiki.
- Open Solobooks wiki.
- Open Media Editor/Media Studio wiki.
- Open fs-dev wiki.
- Confirm each loads `Wiki Guide` and section/article `PAGE.md` pages.

6. Git visibility check:

```bash
git status --short --ignored "ai/views/wiki-viewer/Wiki" "ai/views/wiki-viewer/content"
git check-ignore -v "ai/views/wiki-viewer/Wiki/PAGE.md" || true
```

Report ignored paths clearly.

## Report Back Format

When done, report:

- Cleanup/reference searches performed.
- Remaining old path references and classification.
- Old content folders deleted, retained, or blocked.
- Any docs updated.
- Any generated cache handling.
- Verification commands run and results.
- Whether ignored `ai/` content needs a user decision before commit.
- Any blockers for Slice 9.

## Success Criteria

- Active code no longer depends on old wiki `content/` paths or old JSON navigation concepts.
- Remaining old references are classified and intentional.
- Old content folders are either safely removed or documented as retained for explicit reasons.
- Current docs point to the canonical `Wiki/` paths.
- Build/syntax checks pass for touched code.
- The project is ready for Slice 9 terminal wiki access.
