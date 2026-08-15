# SPEC-01 — Table Structure Command Reliability

**Domain:** Row and column structure commands  
**Depends on:** Accepted SPEC-00

## Objective

Make every existing adjacent row/column insert/delete action produce the correct single-table structure, report success from actual editor state, remain undoable, and never mutate renderer metadata after a failed/no-op command.

## Authoritative Behavior

- a table always has one schema header row and at least one data row;
- inserting above row 0 creates one blank header row with the existing column count/alignment attributes inside the same table and converts the former header cells/content to a data row in the same transaction;
- deleting any schema header promotes the immediately following physical row—not the last row—to the schema header, preserving that row's cell content, alignment, and spans; it is permitted only when at least one data row remains after promotion;
- deletion that would leave fewer than two total rows or fewer than one column is disabled with an explanation;
- inserting a second column into a one-column table succeeds; and
- all generally valid operations remain visible. Current boundary-invalid operations are disabled, not silently omitted.

Every accepted structure edit is production-coherent at this first visible cutover. In the same transaction, reindex any present `metadata.tableColors` and `metadata.tables` entry for the target table while preserving unknown siblings and seeded/future `tableStyles` values. Row insert/delete shifts or removes exact cell/row coordinates and refreshes color/layout identity; column insert/delete shifts or removes exact cell/column coordinates. A present width array inserts a copy of the selected anchor column width at the exact new index or removes the exact deleted index; no absent layout entry is created. Header promotion uses the same immediate-next row mapping. Malformed/out-of-range target color rules are pruned against verified next dimensions in this same event; untouched tables remain byte/value-equivalent. Undo/Redo restores the matching structure, colors, widths, identities, and cleanup with no stale frame. SPEC-02 later owns direct color set/clear, rank/cascade behavior, and exhaustive color cleanup; SPEC-03 later owns direct resize gestures, not structural safety.

SPEC-08 later adds `Add title row`, whose one-cell spanning header uses this same agnostic deletion/promotion protocol. This SPEC must not add that menu action early, but its header-deletion planner may not assume that the header contains one physical cell per logical column. In the later title-row cell context, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` are a UI-level disabled special case rather than a remap of the span to logical column 0.

## Current Defects and Constraints

- `officeTableContextMenu.ts` sets `didRun = true` without using command return values, so metadata can shift after a failed mutation.
- stock `addRowBefore` inserts a data row before the required GFM header at row 0, which can split/render another table.
- delete guards and target logic are inconsistent around the header/two-row boundary.
- insert-column can change metadata even when the visible table remains one column.
- Insert Row Above uses `add_2`; the other insert actions use `add`.
- Office intentionally retains Milkdown's table schema/commands and custom node view.

## Vertical Slices

### Slice 01.1 — Mutation planning and verified result contract

Introduce a single mutation coordinator/result shape used by menu actions and later metadata controllers. It must intercept/build the proposed transaction before dispatch and capture:

- target table position/identity;
- axis, operation, and exact index;
- pre-mutation `TableMap` dimensions;
- the proposed transaction and in-memory next document;
- next dimensions/content computed from that undispatched document;
- immutable before/after renderer-metadata snapshots attached to the transaction when a later controller supplies a transform;
- post-dispatch defensive dimensions from live ProseMirror state; and
- `applied` only when the expected delta occurred on the same table.

Extract pure planning/dimension-verification helpers so boundary matrices can be tested without the full UI. The transaction is dispatched once only after preflight succeeds; when a current/later stage supplies a metadata Step, its plugin state changes synchronously in that same dispatch before the next browser paint. A rejected/no-op result must not mark dirty, schedule save, or call color/layout/style reindex callbacks.

For stock Milkdown actions, obtain the registered ProseMirror command through `commandsCtx.get(commandKey)(payload)` and invoke it against an ephemeral target selection/state with a capture dispatch. Require exactly one proposed transaction, inspect its next document, then replay/compose its steps and final selection, plus any Step required by the current accepted stage, into the one live dispatch. Do not use `commandsCtx.call()` for a mutation whose transaction must be preflighted, and do not send a visible selection-only dispatch just to prepare the command.

Add the shared `officeTableHistory.ts` bridge described in `GUIDANCE.md`: a registered invertible `OfficeTableMetadataStep` plus companion plugin. The step leaves the ProseMirror document unchanged while its forward/inverse forms publish exact after/before renderer snapshots. Every production structure action in this packet appends the exact target-table color plus width/identity before/after snapshots to its document transaction. Close each operation into one event. Native keyboard/`beforeinput` Undo/Redo replays the metadata Step; ordinary text transactions contain no renderer step. It has no independent user command, branch, or stack and never serializes into Markdown.

This packet activates structural color plus width/identity coherence under `GUIDANCE.md` §3.4. Publish both snapshots synchronously in the accepted dispatch before first paint and success-gate every renderer callback. Preserve opaque/unowned `tableStyles` and unknown collections without structurally redesigning them; SPEC-07 later activates style identity refresh.

**Slice gate:** automated matrix tests cover insert/delete on first, middle, and last positions plus deliberately false/no-op command results; present/missing color and width fixtures prove exact shift/remove/anchor-width/identity/pruning behavior, target isolation, synchronous publication, and first-frame coherence. History tests interleave text edits with structural events, prove Undo/Redo changes renderer metadata only for the matching event, and prove the step never enters serialized Markdown/frontmatter body data.

### Slice 01.2 — Row boundary correctness

Implement row actions according to the contract above. Preserve cell text, alignments, and valid colspan/rowspan attributes while converting/promoting the header where required. The top-row insert must leave exactly one table in the document. For `[H,A,B]`, deleting `H` yields `[A(header),B(data)]`; it never reorders `B` ahead of `A`.

Unavailable adjacent delete actions must be disabled with `disabled`, `aria-disabled`, and an accessible/title explanation of the minimum/header constraint. Do not catch and discard failures silently.

This explanation requirement applies to ordinary boundary-invalid structure actions only. It does not override SPEC-08's later title-row exception, where the spanning title cell keeps `Add title row`, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` visible but disabled with no explanation text/tooltip.

**Slice gate:** isolated UI cases for 2-, 3-, and 5-row tables prove correct dimensions/content at top, middle, and bottom, then undo and redo each mutation.

### Slice 01.3 — Column boundary correctness and icon cleanup

Support insert left/right on 1-, 2-, and N-column tables, including the visible 1→2 transition. Permit adjacent deletes until one column remains; at one column, deletes are disabled and metadata is untouched.

Use the same insert icon token for all four insert actions; replace the literal `add_2` mismatch with the accepted common `add` icon.

**Slice gate:** column matrix proves exact pre/post widths, cell preservation, one-table identity, no phantom metadata on a forced failure, and consistent icons.

### Slice 01.4 — Save/reopen and structural regression

Exercise sequential mixed mutations and ordinary ProseMirror undo/redo. Save and reopen the fixture. The Markdown must remain a valid single GFM table with the expected dimensions/content and no extra table blocks.

After runtime behavior passes, update only the exact Tables `PAGE.md` path listed under Expected Changed Areas.

**Slice gate:** the cumulative structure Playwright smoke passes twice from a reset fixture; the saved/reopened Markdown has the exact expected GFM dimensions/content, Undo/Redo remains one event per successful command, failed/no-op boundaries remain byte-equivalent, and the authorized Wiki delta describes only verified runtime behavior.

## Expected Changed Areas

- `fusion-studio-client/src/components/office/officeTableContextMenu.ts`
- new `fusion-studio-client/src/components/office/officeTableMutations.ts`
- new `fusion-studio-client/src/components/office/officeTableHistory.ts`
- `fusion-studio-client/src/components/office/officeTableColors.ts`, `officeTableGeometry.ts`, and new shared `officeTableIdentity.ts`
- `fusion-studio-client/src/lib/front-matter.ts`
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs` for the exact `structure/metadata` variant below
- `fusion-studio-client/e2e/office-table-structure.spec.ts` and pure helper tests
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`

Do not patch files under `node_modules`; implement through Office-owned commands/plugins. Do not change table colors beyond consuming the verified mutation result contract.

## Acceptance Criteria

- Every successful action changes exactly one target dimension by exactly one.
- Insert Row Above at row 0 never creates a second table.
- Header deletion promotes exactly row 1, preserves its physical-cell/span shape, and never permutes later rows.
- One-column insert visibly produces two columns.
- A failed/no-op command leaves document state, all frontmatter domains, dirty state, and save traffic unchanged.
- A successful structure edit is preflight-verified and dispatched once with exact color plus width/identity snapshots; structure and both metadata domains are coherent before first paint, while a failed/no-op command is byte-equivalent across all collections.
- Boundary-invalid actions remain visible but disabled with a useful explanation.
- The later SPEC-08 spanning-title-cell exception stays visible/disabled with no explanation text/tooltip.
- Undo/redo restores the exact prior/next structure and content as one history action.
- Interleaved ordinary text Undo/Redo never consumes or restores a table renderer snapshot.
- Reopen produces the same single valid GFM table.
- All four insert actions use the same icon.
- No direct cell/row DOM presentation writes are introduced.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/components/office/officeTableContextMenu.ts src/components/office/officeTableMutations.ts src/components/office/officeTableHistory.ts src/components/office/officeTableColors.ts src/components/office/officeTableGeometry.ts src/components/office/officeTableIdentity.ts src/lib/front-matter.ts e2e/office/fixture-scenarios.mjs e2e/office-table-structure.spec.ts
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts --project=chromium --workers=1
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts e2e/office-table-structure.spec.ts --project=chromium --workers=1
```

All pure mutation-planner, preflight, and metadata-Step/history matrices required by this packet live in `e2e/office-table-structure.spec.ts` (Node-side Playwright tests may omit a page fixture). No additional unnamed test file is permitted.

## Manual Electron Smoke

Register exact variant `structure/metadata`. It uses the three immutable structure filenames, frontmatter, and body tables from SPEC-00 and adds these exact YAML keys immediately after `preserveUnknown`, with no other byte change:

```yaml
# Structure-R2-C1.md
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', columns: [80] }
  tableColors:
    - { tableIndex: 0, fingerprint: 'fixture-structure-r2-c1', cells: { '1,0': '#ffeeaa' } }

# Structure-R3-C2.md
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', columns: [90, 110] }
  tableColors:
    - { tableIndex: 0, fingerprint: 'fixture-structure-r3-c2', rows: { '1': { color: '#d6ebff', rank: 2 } }, columns: { '1': { color: '#d6ffd6', rank: 3 } } }

# Structure-R5-C4.md
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', columns: [70, 90, 110, 130] }
  tableColors:
    - { tableIndex: 0, fingerprint: 'fixture-structure-r5-c4', cells: { '2,2': '#ffcccc' }, rows: { '3': { color: '#fff2cc', rank: 4 } }, columns: { '3': { color: '#e6ccff', rank: 5 } } }
```

The comment labels above separate three fragments and are not emitted. Run `node e2e/office/run-isolated-electron.mjs --scenario=structure --variant=metadata --copies=10`, use a fresh numbered copy for each destructive branch, and repeat top-row insert, two-row invalid delete, one-column insert, column delete, undo, redo, save, and reopen. Pass requires no duplicate table, no silent click, correct disabled state, exact seeded color/width attachment and first-frame rendering against the values above, and matching persisted Markdown/frontmatter.

## Non-Goals

- Direct color set/clear, full rank/cascade matrices, and exhaustive legacy-color cleanup beyond structure-target pruning (SPEC-02); resize gestures and geometry persistence (SPEC-03); style identity refresh (SPEC-07).
- Column resize (SPEC-03).
- Add title row and its GFM surrogate codec (SPEC-08).
- Merge/split cells, general direct “delete selected row/column,” or extra table operations. SPEC-08 later owns the narrowly scoped title-context `Delete Row` UI that invokes this packet's generic header-deletion planner.
- Upstream package patching, versioning, or provenance.

## Worker Handoff

Do not start until the orchestrator declares this exact packet released. Follow `GUIDANCE.md`; return `READY_FOR_ORCHESTRATOR_REVIEW` or evidence-backed `BLOCKED`.
