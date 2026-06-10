# Wiki Contract Slice 5: System Source Files Migration

## Objective

Convert `System Source Files/ai/views/wiki-viewer` into the canonical shippable system-modification reference wiki using the new `Wiki/` + `PAGE.md` contract.

This is the first content migration slice. It should migrate `System Source Files` only.

## Source Roadmap

Read first:

- `docs/ROADMAP_WIKI_TERMINAL_ACCESS_PRELIMINARY.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-1-root-resolution.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-2-folder-tree-data-model.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-3-viewer-loader-rewrite.md`
- `docs/handoffs/2026-06-08-wiki-contract-slice-4-remove-server-group-synthesis.md`

Expected prior state:
- `wiki-viewer` resolves to `Wiki/` when present.
- Active wiki UI discovers folders and loads `PAGE.md`.
- Server no longer synthesizes old wiki `groups` from `index.json`.

## Path Safety Requirement

This slice moves/renames content and path references. Do not move files before finding references.

Before moving anything, search references for:

```text
System Source Files/ai/views/wiki-viewer/content
ai/views/wiki-viewer/content/system/Text-To-Speech/Rules
Text-To-Speech/Rules
Connectors_Guide.md
Code_Standards.md
Text-To-Speech.md
workspaces & views
```

Document the references in the report-back. Update runtime references in the same slice if the referenced files move.

Known runtime reference:
- `fusion-studio-server/lib/resources/resolver.js` points Text-To-Speech rules at `System Source Files/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules`.

Do not delete old paths until all runtime references are updated and verified.

## Current Source Layout

Current root:

```text
System Source Files/ai/views/wiki-viewer/content/
├── index.json
├── enforcement/
│   └── code-standards/
│       ├── PAGE.md
│       ├── Code_Standards.md
│       ├── LOG.md
│       └── index.json
├── system/
│   ├── index.json
│   ├── connectors/
│   │   ├── Connectors_Guide.md
│   │   ├── LOG.md
│   │   ├── index.json
│   │   ├── MacOS_Connectors/
│   │   ├── Google_OAuth/
│   │   ├── Slack/
│   │   └── resources/
│   └── Text-To-Speech/
│       ├── Text-To-Speech.md
│       ├── index.json
│       ├── Inputs_&_Flows/
│       └── Rules/
└── workspaces & views/
    └── index.json
```

Observed issues:
- Old root is `content/`, not `Wiki/`.
- Uses `index.json`/`sections`/`groups` conventions.
- `workspaces & views` is listed but effectively empty.
- Named guide files exist instead of canonical article-folder `PAGE.md`.
- Text-To-Speech runtime rule JSON lives under the old wiki content tree.

## Target Layout

Create:

```text
System Source Files/ai/views/wiki-viewer/Wiki/
├── PAGE.md
├── 001-Workspaces_And_Views/
│   └── PAGE.md
├── 002-System/
│   ├── PAGE.md
│   ├── 001-Connectors/
│   │   ├── PAGE.md
│   │   ├── 001-MacOS_Connectors/
│   │   │   ├── PAGE.md
│   │   │   ├── 001-Apple_Mail/
│   │   │   │   └── PAGE.md
│   │   │   ├── 002-Apple_Calendar/
│   │   │   │   └── PAGE.md
│   │   │   ├── 003-Apple_Reminders/
│   │   │   │   └── PAGE.md
│   │   │   └── 004-Apple_Notes/
│   │   │       └── PAGE.md
│   │   ├── 002-Google_OAuth/
│   │   │   ├── PAGE.md
│   │   │   ├── 001-Gmail/
│   │   │   │   └── PAGE.md
│   │   │   ├── 002-Google_Calendar/
│   │   │   │   └── PAGE.md
│   │   │   └── 003-Google_Tasks/
│   │   │       └── PAGE.md
│   │   ├── 003-Slack/
│   │   │   ├── PAGE.md
│   │   │   └── 001-Slack/
│   │   │       └── PAGE.md
│   │   └── 004-Reference/
│   │       ├── PAGE.md
│   │       └── ... reference article folders with PAGE.md
│   └── 002-Text-To-Speech/
│       ├── PAGE.md
│       ├── 001-Inputs_And_Flows/
│       │   ├── PAGE.md
│       │   ├── 001-Mic_Integration/
│       │   │   └── PAGE.md
│       │   └── 002-Clean_Up/
│       │       └── PAGE.md
│       └── 002-Rules/
│           └── PAGE.md
└── 003-Enforcement/
    ├── PAGE.md
    └── 001-Code_Standards/
        └── PAGE.md
```

Use this as a guide, not as a requirement to create empty low-value pages. If a folder is navigable, it should have `PAGE.md`.

## Content Migration Rules

- `Wiki/PAGE.md` should explain what System Source Files is: the shippable reference for modifying system features and behavior.
- Section `PAGE.md` files should summarize the section and link/describe child articles.
- Convert named guide markdown into `PAGE.md`:
  - `Connectors_Guide.md` -> `002-System/001-Connectors/PAGE.md`
  - `Text-To-Speech.md` -> `002-System/002-Text-To-Speech/PAGE.md`
  - Prefer `Code_Standards.md` or existing `PAGE.md` as source for `003-Enforcement/001-Code_Standards/PAGE.md`; reconcile duplicates rather than blindly copying both.
- Convert old grouped articles into article folders with `PAGE.md`.
- Preserve useful `LOG.md` files only if they still make sense next to the canonical article. They are not part of primary navigation.
- Do not carry old `index.json` files into the new `Wiki/` tree as primary navigation.

## Text-To-Speech Rules Decision

The JSON rule assets currently live under the old wiki content path and are loaded by runtime code.

Preferred approach:
- Move runtime rule JSON out of the wiki navigation tree into a resource location such as `System Source Files/resources/text-to-speech/rules/` or another existing packaged resource location.
- Update `fusion-studio-server/lib/resources/resolver.js` and any packaging scripts that reference the old path.
- Add a wiki `Rules/PAGE.md` that explains where the runtime rules live and how to modify them.

Acceptable temporary approach:
- Keep the `Rules/` JSON folder in the old `content/` location for this slice, document it as temporary, and do not delete old `content/` yet.

Do not silently move rule JSON without updating runtime references.

## Folder Naming Rules

- Use numeric prefixes for ordering.
- Use underscores for spaces.
- Preserve dashes when semantically meaningful.
- Avoid `&` in folder names for this migration; use `And` for safer paths.

Examples:
- `001-Workspaces_And_Views`
- `002-Text-To-Speech`
- `001-Inputs_And_Flows`

## Explicit Non-Goals

- Do not migrate `fs-dev` wiki content.
- Do not migrate `Fusion Home`, `Solobooks`, or `Media Studio` in this slice.
- Do not delete old `content/` until references are verified and the report states it is safe.
- Do not change DB-backed Fusion overlay wiki behavior.
- Do not reintroduce JSON index navigation.

## Verification Steps

1. Confirm new wiki tree exists:

```text
System Source Files/ai/views/wiki-viewer/Wiki/PAGE.md
```

2. Run reference searches after migration:

```text
System Source Files/ai/views/wiki-viewer/content
ai/views/wiki-viewer/content/system/Text-To-Speech/Rules
Connectors_Guide.md
Code_Standards.md
Text-To-Speech.md
workspaces & views
```

Report all remaining references and classify them as runtime, docs/handoff, old content pending deletion, or intentionally retained.

3. Build if runtime code changed:

```bash
cd fusion-studio-server
node -e "require('./lib/resources/resolver')"
```

If client code is touched, also run:

```bash
cd fusion-studio-client
npm run build
```

4. Runtime/manual smoke if practical:

- Open System Source Files workspace.
- Open Wiki view.
- Confirm `Wiki Guide` loads.
- Confirm sections render in numeric order.
- Confirm section/article/right-sidebar pages load from `PAGE.md`.
- Confirm no missing-page errors for intentionally navigable nodes.

## Report Back Format

When done, report:

- Files/folders created, moved, or deleted.
- Reference search results before/after.
- How Text-To-Speech rule JSON was handled.
- Whether old `content/` remains and why.
- Verification commands run and results.
- Any blockers for Slice 6.

## Success Criteria

- `System Source Files/ai/views/wiki-viewer/Wiki/PAGE.md` exists.
- System Source Files has a navigable canonical `Wiki/` tree using `PAGE.md`.
- No new JSON index navigation is introduced.
- Runtime references to moved rule assets are updated or explicitly documented as temporarily retained.
- The old `content/` tree is either safely removed or clearly documented as temporary pending reference cleanup.
