# SPEC-11 — Table Presentation Output Bridge

**Domain:** Presentation-aware Print, PDF, DOCX, and emailed attachments  
**Depends on:** Accepted SPEC-10

## Objective

Carry the accepted title-row, border, and overflow contracts through the actual Electron output pipelines. The saved document remains canonical GFM plus normalized frontmatter; an Office caller sends a bounded data descriptor—not HTML/CSS—and Electron binds that descriptor to the exact Markdown before applying it to Pandoc HTML/DOCX output. Existing non-Office document callers retain their exact legacy path. This packet is a narrow compatibility bridge, not a general export redesign.

## Output Matrix

| Surface | Title row | Border color None | Numeric real/default border | Overflow |
|---|---|---|---|---|
| Editor screen | One full-width title cell | Dotted `#ccc` at selected width | Solid selected color at `1..4px` | Selected mode |
| Topbar Preview/Print | Full-width title | No border | Solid selected color/width | Selected mode, including clipping/ellipsis |
| Exported/emailed PDF | Full-width title | No border | Solid selected color/width | Selected mode, including clipping/ellipsis |
| Exported/emailed DOCX | Full-width merged title | No border | Solid selected color/width | Reflowable full content; no clipping/ellipsis contract |
| Emailed Markdown | Valid GFM surrogate plus frontmatter marker | Metadata only | Metadata only | Metadata only |

WYSIWYP applies to Overflow/Truncate/New line on actual Print and PDF. The dotted None line is editor chrome, not printable content. DOCX deliberately remains editable/reflowable while retaining title merge and borders.

## One Immutable Output Snapshot

Immediately before an Office save/export/print/email action, `serializeOfficeOutputSnapshot()` captures one immutable ProseMirror/plugin state and one normalized frontmatter/settings state without awaiting between them. It returns:

```ts
interface OfficeOutputSnapshot {
  bodyMarkdown: string;
  fullMarkdown: string;
  tablePresentation: OfficeTableOutputDescriptor;
}
```

`bodyMarkdown` is the exact canonical GFM body placed in the transformed IPC request's `content`; `fullMarkdown` is that same body serialized with the same captured settings/frontmatter and is used for save/milestone plus Office Markdown email. The descriptor is projected from the serialized body and captured normalized metadata, never from a later editor read. If any part cannot be produced from that single state, the action fails before save/milestone or IPC rather than mixing snapshots.

## Bounded Descriptor and Exact Source Binding

Office transformed output is an explicit IPC mode:

```ts
type OfficePresentationMode = {
  presentationMode: 'office-tables';
  tablePresentation: OfficeTableOutputDescriptor;
};

interface OfficeTableOutputDescriptor {
  markdownSha256: string;
  tables: Array<{
    tableIndex: number;
    sourceSha256: string;
    logicalWidth: number;
    columns: number[] | null;
    overflow: 'overflow' | 'truncate' | 'newline';
    titleRow: boolean;
    borderWidth: 1 | 2 | 3 | 4;
    borderColor: '#rrggbb' | null | 'default';
  }>;
}
```

`presentationMode` is an ephemeral route discriminant, not a saved schema/version/provenance field. `sourceSha256` is output-source identity, not the persistent index/fingerprint fallback used to attach frontmatter.

Implement the one shared browser/Electron source-binding helper at exact packaged path `electron/shared/office-table-source-binding.mjs`, with TypeScript declaration `electron/shared/office-table-source-binding.d.mts`. The `.d.mts` suffix is required so the repository's TypeScript 5.9 Bundler resolver finds the declaration for the sibling `.mjs` import. It is ESM/browser-safe; renderer TypeScript imports it directly through Vite, while Electron CJS uses dynamic `import()`. No second parser/hash/normalizer implementation is permitted. It exports exactly:

```ts
type Sha256Hex = (bytes: Uint8Array) => Promise<string>;
export async function bindOfficeTableSources(markdown: string, sha256Hex: Sha256Hex): Promise<{
  markdownSha256: string;
  tables: Array<{
    tableIndex: number;
    sourceSha256: string;
    logicalWidth: number;
    semanticRows: string[][];
    cellChildCounts: number[][];
    startOffset: number;
    endOffset: number;
  }>;
}>;
export function getOfficeDescriptorByteLimit(bodyUtf8Bytes: number, tableCount: number, totalLogicalColumns: number): number;
```

The injected SHA function uses Web Crypto in the renderer and Node `crypto` in Electron; the helper validates the returned lowercase 64-hex value. It imports declared direct `mdast-util-from-markdown`, `mdast-util-gfm`, and `micromark-extension-gfm` dependencies configured for GFM tables. Regex table discovery is forbidden. `electron/shared/office-table-source-binding.test.mjs` must also read `package.json`, assert that `build.files` includes `electron/**/*`, dynamically import the helper from a real Electron-CJS-style caller, and prove TypeScript resolves its sibling `.d.mts` through the normal build. Given exact `bodyMarkdown` string `M`:

1. `markdownSha256` is the lowercase 64-character SHA-256 hex digest of the exact UTF-8 bytes of all of `M`. Do not normalize a newline, Unicode, or whitespace before hashing.
2. Parse `M` in memory and enumerate mdast `table` nodes in document order. Each must have integer JavaScript-string `position.start.offset` and `position.end.offset` within `0..M.length` and `start < end`.
3. For table `i`, let `S_i = M.slice(start.offset, end.offset)`. `sourceSha256` is the lowercase SHA-256 hex digest of the exact UTF-8 bytes of `S_i`.
4. `tableIndex` is exactly `i`. `logicalWidth` is the parsed positive safe-integer GFM alignment/header width, and every parsed row must contain exactly that many cells.
5. `columns` is null or contains exactly `logicalWidth` positive integer layout pixels. A partial/invalid layout projects null.
6. Set `titleRow:true` only when literal `titleRow:true` is attached to this table and its current serialized SPEC-08 surrogate is valid: the header has `logicalWidth` cells and continuation cells `1..N-1` contain zero mdast content children. A stale fail-closed marker projects false.
7. Project overflow and border fields through the accepted SPEC-07/09 pure normalizers. `default` means the legacy editor border and solid output `#d2d1cf`.

Exact duplicate source tables may share a source hash; their array indexes remain authoritative. Stable identity across arbitrary duplicate-table reorder is explicitly out of scope, and this roadmap adds no reorder operation.

Electron independently repeats source-derived steps 1–5 against received `content` before creating a temp path/file, invoking Pandoc, calling the export controller, or opening Preview/Mail. The literal frontmatter marker is intentionally not in body `content`; renderer projection owns that normalized metadata check. Electron instead requires every received `titleRow:true` entry to have the exact safe empty-continuation surrogate from step 6, while false never authorizes a merge. Count, index, whole-Markdown hash, table source hash, logical width, column length, or safe-title-shape mismatch returns exactly `TABLE_PRESENTATION_MISMATCH`. A malformed mode/descriptor returns exactly `INVALID_TABLE_PRESENTATION`. Neither error includes source text, a hash, host path, stack, converter output, or secret.

### Exact Two-Boundary Validator

The Office opt-in payload and descriptor must be JSON-data only, but validation responsibilities follow what each boundary can actually observe. Before crossing `contextBridge`, renderer construction validates its original objects and recursively rejects accessors, inherited enumerable data, non-`Object`/null prototypes (including class instances), symbol keys/values, functions, sparse arrays, nonfinite numbers, coercion, and unknown keys. This source rejection maps to `INVALID_TABLE_PRESENTATION` with zero exposed-API/`ipcRenderer.invoke` calls.

Preload cannot claim to recover provenance already erased by `contextBridge`; it revalidates the exact Office-mode payload key set and every observable descriptor type/key/value/bound, then invokes IPC only with a freshly copied canonical data result. If Electron's later `ipcRenderer.invoke` structured clone itself fails, exactly one invoke attempt rejects, preload maps it to `INVALID_TABLE_PRESENTATION`, and zero `ipcMain` handler/coordinator/filesystem/converter/OS calls occur. Legacy payload handling is unchanged.

Electron main receives structured-cloned data, whose original prototype/accessor/symbol provenance is no longer observable. It must not claim to rediscover that provenance. It independently rejects every observable type/key/value/bound violation below without coercion and before filesystem/converter/OS work:

- Root: a nonnull nonarray object with exactly enumerable own string keys `markdownSha256` and `tables`.
- Root hash and every source hash: exactly `/^[0-9a-f]{64}$/`.
- `tables`: dense array whose length equals the independently parsed GFM table count; there is no separate compatibility table-count cap.
- Entry: a nonnull nonarray object with exactly enumerable own string keys `tableIndex`, `sourceSha256`, `logicalWidth`, `columns`, `overflow`, `titleRow`, `borderWidth`, and `borderColor`.
- Index: safe integer equal to array position. Logical width: positive safe integer equal to parsed width; there is no separate column-count cap.
- Columns: null or a dense array whose length equals logical width, with every value a positive safe integer layout pixel. Existing large valid widths are not rejected by a new presentation-only cap.
- Values: exact enums/boolean, width `1|2|3|4`, and lowercase six-digit hex/null/`default` only.
- Let `B` be received body-Markdown UTF-8 bytes, `T` parsed table count, and `C` the sum of parsed logical widths. Using overflow-safe integer arithmetic, descriptor UTF-8 bytes must be at most `512 + B + 512*T + 32*C`. This structural bound scales only with the already-received source and exact table grid; it prevents injected bulk without imposing a new fixed document/table/column compatibility limit.

No descriptor field may carry renderer HTML, CSS, filesystem paths, Pandoc arguments, OOXML, ZIP content, script, or a persistent event. Preload source validation and main post-clone validation are both required; neither substitutes for the other.

Add exact Node test `electron/preload.test.cjs`. It executes the real preload module in a fresh VM/CommonJS harness with only mocked `electron.contextBridge` and `electron.ipcRenderer`; it must not copy validator logic into the test. Capture the exposed API and assert: legacy payloads remain byte/value-equivalent; each valid Office payload becomes the exact freshly allocated canonical copy and invokes the existing channel once; every observable unknown/type/value/bound/half-pair error rejects as `INVALID_TABLE_PRESENTATION` with zero invokes; mutating the caller object after the exposed call cannot alter the invoked copy; and a mocked structured-clone rejection from `ipcRenderer.invoke` records exactly one rejected invoke, maps to `INVALID_TABLE_PRESENTATION`, and leaves the mocked main/coordinator/filesystem/converter/OS side-effect ledger at zero. Renderer-only prototype/accessor/symbol/class/sparse-array rejection remains covered by `e2e/office-document-output-payloads.spec.ts`, before this boundary.

## Optional Office Mode and Legacy Compatibility

Legacy mode is represented only by the absence of both `presentationMode` and `tablePresentation`. Existing routing, content bytes, validation, filename behavior, and converter behavior remain unchanged.

Office mode requires both fields. Supplying only one, explicitly supplying either as null/undefined, or using any value other than `presentationMode:'office-tables'` returns `INVALID_TABLE_PRESENTATION` before Electron filesystem/converter/OS-handoff side effects; it neither reverses nor duplicates a valid renderer save already performed in the existing action order. Office mode is valid only for Markdown-backed Office PDF/DOCX export, Print, and PDF/DOCX email:

- Export PDF/DOCX own keys: existing `{ sourceType, sourceFormat, format, content, filename }` plus both Office fields; source type/format remain `document`/`markdown`.
- Print own keys: existing `{ content, filename }` plus both Office fields.
- Email PDF/DOCX own keys: existing `{ format, content, filename }` plus both Office fields.
- Office Markdown email omits both fields and sends exact `fullMarkdown` as `content`.

Caller behavior is exact:

- Office PDF/DOCX export, Preview/Print, and PDF/DOCX email always opt in and never fall back to legacy output after a validation/transformation failure.
- The active `EmailDocumentPage` export, print, and email callers omit both fields and retain the pre-SPEC-11 legacy path, even when their Markdown contains tables.
- Other legacy document, HTML-artifact, and spreadsheet callers omit both fields and retain their current route.
- A legacy request is never subjected to Office table-count/source validation or Office title/border/overflow transformation.
- Office mode is invalid for Markdown email, non-Markdown sources, HTML artifacts, spreadsheets, and unsupported formats.

Extract one pure typed payload-builder module `src/lib/documentOutputPayloads.ts` and make both active Office and Email `useDocumentActions.ts` callers use it. Its Office builders require the mode pair for PDF/DOCX/Print/email attachments; its legacy builders have no parameters capable of adding those keys. Office Markdown email uses the legacy Markdown shape with `fullMarkdown`. Exact named Playwright/Node-side test `e2e/office-document-output-payloads.spec.ts` imports this pure module without a page fixture and asserts own-key/value snapshots for every Office and Email export/print/email case; `document-handlers.test.cjs` independently exercises those exact payload shapes at IPC. This bounded refactor may change the Email hook's construction callsite but its emitted payload and user behavior remain byte/value-equivalent.

### Reachable Office Markdown email

The active Office UI must expose the already-supported Markdown branch. In `OfficeDocumentTopbar.tsx`, the open Export dropdown order is exactly `Export DOCX`, `Export PDF`, a direct button labelled `Email Markdown` with Material Symbol `markdown`, the existing divider, then `Preview PDF`. `Email Markdown` has no Folder submenu and introduces no Markdown download. Pointer click and native keyboard activation by Enter/Space each close the dropdown and call `onSendEmail('markdown')` exactly once.

Extend the existing `exportingFormat` state/prop union to `'docx'|'pdf'|'markdown'|null`; Markdown email sets it to `'markdown'` before snapshot/save/milestone/IPC and clears it in `finally`. While it is nonnull, the Export trigger and every dropdown action are disabled and the existing progress indicator is shown, so a pending Markdown handoff cannot be double-submitted. The direct button uses the dropdown's existing visual/focus conventions; this packet does not create a second output menu or alter the Email editor UI. `e2e/office-table-presentation-output.spec.ts` must open the real dropdown by pointer and keyboard on separate fixture copies, assert the exact order/label/icon/disabled state, activate `Email Markdown`, and prove one exact full-frontmatter attachment request and zero PDF/DOCX transform calls.

## Shared Output Coordinator

Create one document-output coordinator used by download export, temporary email attachments, and Print. Its first branch is the exact optional-mode contract above. The Office branch validates once and passes one immutable `{bodyMarkdown, tablePresentation, sourceTables}` object into the PDF or DOCX transformer; the legacy branch calls the existing behavior without an Office descriptor.

Remove duplicated format branches only as needed to ensure the same Office Markdown/descriptor produces semantically equivalent presentation for download, email, and Print. Temp creation/cleanup, filename sanitization, bundled Pandoc resolution, save/milestone behavior, and existing user-facing errors remain intact. All temporary files/directories are unique, stay under the existing OS temp root, and clean on success/failure. Email attachment cleanup may retain the existing bounded delay after Mail receives it.

Track delayed Print/email temp paths in the coordinator and remove them on their normal timer or application shutdown, whichever comes first; cleanup is idempotent. Closing/discarding the external Preview/Mail consumer must never strand a file after the isolated Electron process exits.

## Runtime Dependency and Packaging Contract

Declare `mdast-util-from-markdown`, `mdast-util-gfm`, `micromark-extension-gfm`, `parse5`, `fflate`, and `@xmldom/xmldom` as direct production `dependencies`, because packaged renderer/Electron modules import them at runtime. Use `parse5` as the single inert structural HTML parser, `fflate` for ZIP read/write, and `@xmldom/xmldom` for OOXML parsing/serialization; substitute libraries or duplicate parsers are not permitted. Declare `pdfjs-dist` as a direct `devDependency` only, because it is confined to the artifact oracle. The lockfile pins the installed resolutions. Do not move any runtime import to `devDependencies`, rely on a transitive package, or change the package's existing version field.

Add `e2e/office/verify-packaged-office-modules.mjs` plus `e2e/office/packaged-office-modules-smoke.mjs`. The verifier first reads `package.json` and requires `build.files` to include `electron/**/*`; after `npm run electron:pack`, it resolves exactly one generated `Fusion Studio.app`, its `Contents/Resources/app.asar`, and its `Contents/MacOS/Fusion Studio` executable under the configured `release` root. It spawns that packaged executable with `ELECTRON_RUN_AS_NODE=1`, the smoke module, and the app.asar path, using an isolated temp directory and bounded timeout. The smoke dynamically imports the packaged `electron/shared/office-table-source-binding.mjs`, loads the packaged CJS HTML/DOCX transform modules, and invokes their parser/ZIP/XML entry points against one minimal valid two-column table/descriptor without filesystem or OS handoff. It must prove the expected table hash/width and successful HTML/DOCX structural parse. Missing app/module/dependency, source-tree fallback, more than one candidate, timeout, or nonzero child exit fails; cleanup is required in `finally`. This is test infrastructure only and adds no production environment branch.

## Canonical Semantic-Matrix Cross-Check

Source preflight also retains an internal semantic matrix for every GFM table; it is not an IPC field. Build each source cell string by ordered mdast traversal: append `value` for `text` and `inlineCode`; append LF for `break`; append nothing for image/imageReference; otherwise recurse through children. For an mdast `html` value, use the same declared inert structural HTML parser in fragment mode—never execute it—and traverse its text nodes in order, appending LF for each `<br>` and ignoring markup/comments; this makes the canonical bare `<br>` exact while preserving visible text inside unrelated inline markup. Then normalize CRLF/CR to LF, normalize Unicode to NFC, replace each run of U+0009/U+000C/U+0020/U+00A0 within each line with one U+0020, trim only those four characters from each line, and rejoin with LF. Retain row/cell boundaries exactly.

Before either output transform mutates a table, it must independently derive and deeply compare the same ordered matrix:

- HTML: enumerate `thead` then `tbody`/direct rows in DOM order; require exactly `logicalWidth` direct `th|td` children before title merge; traverse text nodes in order, append LF for `<br>`, ignore element markup while recursing, then apply the same normalization.
- DOCX pre-writer: parse Pandoc's JSON AST, enumerate `Table` nodes/cells in document order, append `Str`/`Code` text, U+0020 for `Space|SoftBreak`, LF for `LineBreak` and structurally parsed raw-HTML `<br>`, recurse through formatting/link children, and apply the same normalization.
- DOCX package: after the trusted break bridge and DOCX write, enumerate `w:tbl`/`w:tr`/`w:tc` in document order before title merge; append `w:t` text, U+0009 for `w:tab`, LF for `w:br|w:cr`, and LF between multiple `w:p` in one cell, then apply the same normalization.

Any table count, physical width, row count, or semantic cell mismatch returns `TABLE_PRESENTATION_MISMATCH` and cleans all intermediate output. This cross-check prevents a Pandoc-produced table from being styled merely because it occupies the same ordinal slot.

## PDF and Preview/Print Transformation

For Office Markdown→PDF/Print:

1. Run bundled Pandoc to standalone HTML as today.
2. Parse HTML with one declared direct structural HTML dependency; never regex-rewrite tables.
3. Run the exact count/logical-width/semantic-matrix cross-check above in document order.
4. For `titleRow:true`, require empty continuation cells again, retain first-cell content, merge row 0 to one `<th colspan=N>`, and remove only its empty continuation cells.
5. When columns are present, emit a safe `<colgroup>`/fixed layout from normalized pixels. Null uses available print width.
6. Wrap each cell's existing child nodes in one generated `.rv-office-output-cell-content` block when no equivalent generated wrapper exists; preserve node order/text. Apply generated per-index CSS only from validated values:
   - real/default: every outer/inner cell edge solid at selected width/color;
   - null: no painted border on any edge;
   - Overflow: one line, clipped, no ellipsis;
   - Truncate: one line, clipped, rendered ellipsis;
   - New line: normal wrapping/native breaks.
7. In Overflow/Truncate only, present each semantic table-cell `<br>` as exactly one collapsible U+0020 without changing source Markdown. New line retains the break.
8. Render through the production Chromium PDF engine with print backgrounds enabled.

The Print command uses this exact PDF buffer before opening Preview/system print. Downloaded and emailed PDF use the same transformer. No editor `@media print` claim, success boolean, or unparsed PDF file substitutes for artifact assertions.

## DOCX Transformation

Bundled Pandoc 3.9 does not preserve raw GFM table-cell `<br>` as a DOCX hard break by itself, so Office DOCX uses this exact trusted pre-writer bridge before package post-processing:

1. After IPC/source validation, invoke bundled Pandoc with trusted constant arguments to parse exact body Markdown as GFM and emit JSON AST. Renderer-provided arguments/filters remain forbidden.
2. Structurally parse the JSON; enumerate its `Table` nodes and run the pre-writer semantic-matrix comparison above against the already-bound source tables.
3. Within table-cell inline content only, replace a `RawInline` whose format is `html` and whose inert fragment contains exactly one `<br>` element plus no text/other element with Pandoc `LineBreak`. Do not change breaks outside table cells or any other AST node. The canonical SPEC-07 bare `<br>` takes this path.
4. Serialize the otherwise byte/value-equivalent AST and invoke bundled Pandoc with trusted constant JSON→DOCX arguments. A malformed AST, count/matrix mismatch, or failure returns the narrow error and cleans intermediates.
5. Open the generated DOCX and require the bridged break to be `w:br|w:cr` before any title/border package mutation; adjacent `w:t` runs without that break do not pass.

Implement this in exact trusted module `electron/export/submodules/documents/pandoc-table-breaks.cjs`; do not use regex table rewriting or accept a renderer filter/path. Then structurally post-process the package with declared direct ZIP/XML dependencies. Preserve every unrelated package entry and relationship: for every ZIP entry except `word/document.xml`, the uncompressed entry name and bytes/SHA-256 remain exact even if ZIP container offsets/compression metadata change.

- Enumerate `w:tbl` in `word/document.xml` order and run the exact pre-mutation matrix cross-check.
- For `titleRow:true`, retain first-cell content, apply `w:gridSpan w:val=N`, and remove only the empty continuation cells corresponding to the GFM surrogate.
- For real/default border, set top/left/bottom/right/insideH/insideV `w:tblBorders` to `single`, `w:color` to the selected uppercase six hex digits without `#` (`D2D1CF` for default), zero space, and `w:sz` exactly `6|12|18|24` eighth-points for `1|2|3|4px`.
- For null, ensure all six entries exist with exactly `w:val="nil"` and remove their `w:sz`, `w:space`, and `w:color` attributes; no inherited/default table edge may remain visible.
- Preserve paragraphs and hard breaks. Do not encode Overflow/Truncate clipping or ellipsis in DOCX.
- Repack a valid DOCX, reopen/parse it, repeat count/title/border/text assertions, and only then return success.

Download and email DOCX use the same post-processor; one must not bypass it.

## Exact `presentation-output` Fixture

Extend the shared catalog with scenario `presentation-output`, case `matrix`, no variants, default one copy, and workspace-A file `Presentation Output.md`. It contains exactly 50 tables. Use these ordered constants:

```text
titleKinds = [ordinary, title]
borderKinds = [real, none]
widths = [1, 2, 3, 4]
modes = [overflow, truncate, newline]
realColors = { 1: #e11d48, 2: #16a34a, 3: #2563eb, 4: #9333ea }
```

Generate indexes `0..47` in nested order `titleKind -> borderKind -> width -> mode`:

```text
tableIndex = (((titleKindIndex * 2 + borderKindIndex) * 4 + widthIndex) * 3 + modeIndex)
id = po-<ordinary|title>-<real|none>-<1|2|3|4>px-<overflow|truncate|newline>
fingerprint = fixture-po-<two-digit zero-padded tableIndex>
```

For each, append `metadata.tables` entry `{ tableIndex, fingerprint, columns: [96, 96, 96] }` and `metadata.tableStyles` entry with the same index/fingerprint, exact `tableOverflow`, numeric `borderWidth`, mapped real `borderColor` or null, and `titleRow:true` only for title cases. Property order is exactly `tableIndex`, `fingerprint`, optional `titleRow`, `tableOverflow`, `borderWidth`, `borderColor`.

Each ordinary body is exactly:

```markdown
## <id>

| Label | Break | Long |
| :--- | :---: | ---: |
| <id>-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |
```

Each marked-title surrogate is exactly:

```markdown
## <id>

| Title <id> |  |  |
| :--- | :---: | ---: |
| Label | Break | Long |
| <id>-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |
```

Index 48 is `po-default-keyless`, uses the ordinary-body template, and has no `metadata.tables` or `metadata.tableStyles` entry. It projects exact non-hash values `{tableIndex:48, logicalWidth:3, columns:null, overflow:'overflow', titleRow:false, borderWidth:1, borderColor:'default'}`.

Index 49 is `po-stale-title`. Add layout `{ tableIndex: 49, fingerprint: 'fixture-po-stale-title', columns: [96, 96, 96] }` and style `{ tableIndex: 49, fingerprint: 'fixture-po-stale-title', titleRow: true, tableOverflow: 'truncate', borderWidth: 4, borderColor: '#004e89' }`. Its exact body is:

```markdown
## po-stale-title

| Stale Title | KEEP ME |  |
| :--- | :---: | ---: |
| Label | Break | Long |
| po-stale-title-label | AlphaSegmentABCDEFGHIJ<br>BetaSegmentKLMNOPQRST | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz |
```

It projects `titleRow:false`; all three header cells and `KEEP ME` survive every output.

The exact envelope before scenario-specific arrays is:

```yaml
---
name: 'Presentation Output'
description: 'Office E2E presentation-output/matrix'
metadata:
  fixtureScenario: 'presentation-output'
  fixtureCase: 'matrix'
  fixtureCopy: 1
  preserveUnknown: 'keep-me'
  tables:
    <exact ordered generated entries 0..47, then 49; 48 is absent>
  tableStyles:
    <exact ordered generated entries 0..47, then 49; 48 is absent>
---
```

The two angle-bracket lines above are expansion notation, not emitted bytes; replace them with the entries dictated by the preceding closed formula, using two-space YAML indentation and no comments. After the closing delimiter emit exact framing `Before matrix.\n\n<block-0>\n\n...\n\n<block-49>\n\nAfter matrix.\n`; the file is UTF-8 without BOM and LF-only. With default `--copies=1`, emit the unnumbered canonical `Presentation Output.md` / frontmatter `name: 'Presentation Output'` with `fixtureCopy: 1`. Only when `N>1`, emit N files for `i=1..N`: filename `Presentation Output--copy-${i zero-padded to 2}.md`, frontmatter name `Presentation Output--copy-${i zero-padded to 2}`, `fixtureCopy: i`, and the fixture file ID derived from that filename. No other body, frontmatter, workspace-registration, or config byte changes. This section is the builder's complete fixture oracle. The source-binding tests independently recompute literal hashes from these exact bytes; they must not accept hashes emitted by the projection under test as their oracle. The full Cartesian matrix is the non-hash descriptor oracle; default and stale cases are additional exact oracles.

## Vertical Slices

### Slice 11.1 — Dormant snapshot, source binding, and compatibility foundation

Implement the single-state serializer, GFM source-binding helper, pure payload builders/projection, exact Electron validator, expanded preload/types, optional mode, and shared coordinator interface as dormant callable modules/test seams. Do not switch any production Office caller or expose `Email Markdown` yet. Email editor, Office, and all other live callers remain byte/route-compatible with their prior behavior during this slice.

**Slice gate:** ordinary/valid-title/stale-title/Unicode/CRLF/multiple/duplicate table vectors produce identical renderer/Electron hashes through direct module tests. Original source accessors/inheritance/classes/symbols/functions/sparse arrays fail in the pure renderer builder; preload independently rejects every invalid observable copy before invoke. A forced invoke-clone error records exactly one rejected invoke and zero main/coordinator side effects. Direct handler tests prove that changing one source byte, swapping descriptor entries, count/index/width/column/title mismatch, observable unknown/type/value keys, half-present/null/wrong mode, and unsupported surfaces fail before filesystem/Pandoc/export work. Separately, active Office, Email, HTML-artifact, and spreadsheet callers prove byte/value-identical pre/post routing and the same current results; no live caller reaches the dormant mode, coordinator, or new validator.

### Slice 11.2 — PDF and Preview/Print

Implement structural HTML transformation, semantic cross-check, title merge, columns, borders, all overflow modes, hardbreak presentation, and the shared PDF/Print builder as dormant trusted modules. Do not route production download/email/Print callers through them yet.

**Slice gate:** direct transformer/coordinator tests and the dedicated Electron artifact runner produce rasterized actual production PDF artifacts for all 50 cases: title colspan, stale retention, no None border, default plus every real numeric width/color, Overflow no ellipsis, Truncate visible ellipsis, New line/native breaks, and table-order isolation. Test adapters for future Print/email/download entry points all call the same dormant builder and no failure falls back; live production routes remain unchanged.

### Slice 11.3 — DOCX and email

Implement the Pandoc break bridge, pre-mutation OOXML semantic cross-check, DOCX post-processing, and shared attachment builders as dormant trusted modules. Preserve reflowable content and unrelated package parts; do not switch live download/email routes yet.

**Slice gate:** direct module tests unzip/parse generated DOCX and assert `w:gridSpan`, all six border edges/size/color or no-border, complete text/breaks, stale-title retention, table order, unrelated package hashes/relationships, package validity, and semantic equality between future download/email adapters. The dormant Markdown attachment builder emits exact full frontmatter content. Active Office/Email routes and UI remain unchanged.

### Slice 11.4 — Atomic all-surface cutover, final regression, and documentation

In one production cutover, bind the immutable Office snapshot to the mode/descriptor pair, route Office PDF/DOCX download and email plus Preview/Print through the already-passing shared transformers, and expose the exact direct `Email Markdown` control. Keep Email editor and every non-Office caller on the legacy branch. No partial caller cutover is accepted. Then run every prior Office/browser/server gate, the dedicated production-Electron artifact runner, and the isolated interactive `presentation-output` scenario. Verify output artifacts, Print handoff, attachment routing, cleanup, save/reopen, and no live-workspace mutation. After runtime acceptance, update only the Tables and Office Viewer Wiki pages below.

**Slice gate:** every reachable Office surface requires the pair and uses its owning transformer with no fallback; the real Office Export dropdown reaches Markdown email once by pointer and once by keyboard with exact full content and pending guard; active Email/other legacy routes remain byte/value-compatible. SPEC-00–11 cumulative commands pass; parsed/rasterized artifacts satisfy the matrix rather than merely returning success; temp/process cleanup is clean; current Wiki describes only verified runtime behavior.

## Dedicated Electron Artifact Runner

Add `e2e/office/run-presentation-output-electron.mjs` and `electron/export/submodules/documents/presentation-output-electron-smoke.cjs`.

The parent runner resolves the already-installed Electron executable with `createRequire(import.meta.url)('electron')`—never `npx` or network resolution—allocates isolated user-data/fixture/staging/artifact roots, materializes copy 1 of the exact catalog fixture, and spawns Electron with the smoke CJS as its main script. It accepts no arguments except one optional, nonrepeated `--retain-artifacts`; default is off. Unknown/duplicate arguments fail before allocation. It forwards SIGINT/SIGTERM, enforces a bounded 180-second timeout, kills/waits for the child, and treats timeout/crash/assertion/cleanup failure as nonzero.

The Electron smoke sets its isolated app user-data path before readiness and loads the real source validator, structural HTML/DOCX transformers, coordinator, and production `htmlToPdf`. It uses hidden BrowserWindows, DevTools print media, `did-finish-load`, `document.fonts.ready`, and two animation frames—no fixed readiness sleep. It asserts all 50 transformed DOM cases, generates a nonempty `%PDF-` buffer through production `BrowserWindow.printToPDF`, and uses a declared direct `pdfjs-dist` test dependency to parse and rasterize every actual PDF page in a second isolated hidden BrowserWindow. It invokes the real PDF/DOCX/Markdown attachment builders for download/email and the real Print-buffer builder; only the final OS Mail/Preview/download handoff is replaced with an artifact sink, after handler-routing tests prove that adapter boundary.

The raster oracle is closed and numeric. From one Pandoc base HTML snapshot, the test creates (a) production-transformed HTML and (b) an independent fixture-constant oracle transform that does not import/call production table transformation code. Both use zoom 1, white `#fff` page background, the same loaded fonts, Letter page, and production `htmlToPdf`; readiness is `document.fonts.ready` plus two frames. PDF.js renders both actual PDFs at scale `4` with worker disabled, making one CSS px exactly three raster pixels at 96→72 DPI. Page count and raster dimensions must match. Across every page, at least 99.5% of pixels have maximum per-channel production/oracle difference `<=8`, mean absolute per-channel error is `<=1.5`, and no 8-connected region whose maximum-channel difference is `>24` may exceed 0.05% of that page. These thresholds are the complete antialias tolerance; tests may not widen them or substitute a screenshot judgment.

Property probes then use the independent oracle's table/cell rectangles and unique heading coordinates. Sample the middle 50% of each edge, excluding corners and text by 6 CSS px. A real/default edge must have an expected-color run (maximum RGB-channel distance `<=12`) of `3*borderWidth ±1` raster pixels and at least 90% longitudinal coverage; the four measured widths must therefore fall within one raster pixel of `3,6,9,12`. A None edge strip must be at least 98% within maximum-channel distance `<=8` of its immediately inset background and contain no nonbackground run longer than one raster pixel. At both logical internal boundaries, every title-band probe meets the None-edge absence rule created by the span. In the first non-title row below, real/default cases meet the expected-color stroke rule while None cases meet the same absence rule. Ordinary/stale real/default headers require both internal strokes; ordinary/stale None headers require both absent; PDF.js text items contain exact `KEEP ME` once.

Build an ink mask where maximum-channel distance from the local background is `>32`, after removing border bands. Overflow and Truncate content must occupy exactly one vertical 8-connected line band; New line must occupy at least two bands whose nearest Y extents are separated by at least six raster pixels. In the final 18 CSS px of each Truncate content box, production must match the independent oracle's ellipsis component count and each component centroid within two raster pixels; the paired Overflow oracle/production crop must match its distinct nonellipsis component set. PDF.js text/rectangle anchors must occur in exact fixture order, every table paint bound must remain within the Letter printable box `x=36..576pt`, `y=36..774pt` with `0.75pt` tolerance, and distinct table bounds may not overlap. DOM assertions remain supplemental; every PDF probe above must pass. Destroy every BrowserWindow in `finally` and exit explicitly.

Default runs remove every created root on success/failure/signal and assert no matching child/temp remains. With `--retain-artifacts`, retention occurs only after all assertions pass: atomically publish the allowlist `.fusion-office-presentation-output-retained`, `source.md`, `descriptor.json`, `transformed.html`, `print-layout.png`, `pdf-raster.png`, `oracle.pdf`, `preview-print.pdf`, `export.pdf`, `email.pdf`, `export.docx`, `email.docx`, `email.md`, and `assertions.json` under `<os.tmpdir>/fusion-office-presentation-output-retained/<12-lowercase-hex-run-id>/`. The private marker's exact UTF-8 bytes are `fusion-office-presentation-output\n`. Build in a marked `.partial-<run-id>` sibling, fsync every file and the staging parent, rename, then fsync the destination parent. `assertions.json` contains only scenario, source/descriptor hashes, relative names, byte counts/hashes, and passed assertion groups—no actor, time, host path, document version, provenance, or history. Print exactly `OFFICE_E2E_RETAINED_ARTIFACTS=<absolute-directory>`.

Failure/timeout/signal retains nothing. Each invocation first removes only prior retained children containing the runner's exact private marker and rejects symlinks/unmarked directories; thus the next default invocation cleans the prior explicit retention. It never retains workspace/user-data/database/process/converter-temp roots.

For the separate interactive `run-isolated-electron.mjs --scenario=presentation-output` only, SPEC-11 also adds test-infrastructure wrapper `e2e/office/isolated-electron-output-main.cjs`. The launcher builds normally, creates `<fixture-root>/artifacts/downloads`, proves its realpath is inside the owned nonsymlink fixture root, prints exactly `OFFICE_E2E_OUTPUT_DIR=<absolute-directory>`, and launches the already-installed Electron executable with this wrapper. Before requiring the unmodified production `electron/main.cjs`, the wrapper registers a `session-created`/`will-download` listener that directs each completed renderer `<a download>` item to a unique sanitized filename in that directory via `item.setSavePath`; interrupted, cancelled, or colliding downloads fail the smoke. This is harness code, not a production environment branch, and every other scenario retains SPEC-00's normal launch path.

On Electron exit, the parent waits for all expected download items, records relative names/byte counts/SHA-256 plus PDF/DOCX magic/package parse results, verifies no `.crdownload`/partial, then removes the complete fixture/output tree under the normal lifecycle. The user inspects files while Electron remains open; debug retention is only SPEC-00's explicit environment contract. No export may write to the user's real Downloads directory.

## Expected Changed Areas

- `fusion-studio-client/src/components/office/useDocumentActions.ts`
- `fusion-studio-client/src/components/office/OfficeDocumentTopbar.tsx`
- `fusion-studio-client/src/components/email/useDocumentActions.ts` only to consume the pure legacy payload builders without changing emitted keys/values
- new `fusion-studio-client/src/components/office/officeTableOutputDescriptor.ts`
- new `fusion-studio-client/src/lib/documentOutputPayloads.ts`
- new `fusion-studio-client/electron/shared/office-table-source-binding.mjs`, `.d.mts`, and `.test.mjs`
- `fusion-studio-client/src/types/electron.d.ts`
- `fusion-studio-client/electron/preload.cjs`
- new `fusion-studio-client/electron/preload.test.cjs`
- `fusion-studio-client/electron/ipc/document-handlers.cjs`
- `fusion-studio-client/electron/export/export-controller.cjs`
- `fusion-studio-client/electron/export/submodules/documents/index.cjs`
- new `fusion-studio-client/electron/export/submodules/documents/table-presentation.cjs`
- new `fusion-studio-client/electron/export/submodules/documents/docx-table-presentation.cjs`
- new `fusion-studio-client/electron/export/submodules/documents/pandoc-table-breaks.cjs`
- new `fusion-studio-client/electron/export/submodules/documents/presentation-output-electron-smoke.cjs`
- `fusion-studio-client/electron/export/pdf-engine.cjs` only if shared validated options/readiness cleanup require it
- `fusion-studio-client/package.json` and lockfile: the six named runtime libraries under direct `dependencies`, `pdfjs-dist` under direct `devDependencies`, existing package version unchanged
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs`
- new `fusion-studio-client/e2e/office/run-presentation-output-electron.mjs`
- new `fusion-studio-client/e2e/office/verify-packaged-office-modules.mjs` and `packaged-office-modules-smoke.mjs`
- new `fusion-studio-client/e2e/office/isolated-electron-output-main.cjs` and narrow presentation-output integration in `run-isolated-electron.mjs`
- `fusion-studio-client/e2e/office-table-presentation-output.spec.ts`
- new `fusion-studio-client/e2e/office-document-output-payloads.spec.ts`
- focused `node:test` files beside new Electron transform/source-binding modules and document handlers
- exact pure-builder/handler compatibility regression coverage for the active Email and Office callsites
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/005-Documents/004-Tables/PAGE.md`
- `ai/RC-MacAir-15/Wiki/009-Fusion_Home/001-Office_Viewer/PAGE.md`

**Authorized target-state documentation delta:** only after artifact acceptance, document the exact surface matrix, optional Office-only descriptor boundary, actual Print/PDF selected-overflow behavior, DOCX reflow exception, title merge, and border output.

## Acceptance Criteria

- Every reachable Office output surface matches the exact matrix; every legacy caller preserves its existing route.
- Body, full Markdown, and normalized descriptor come from one immutable editor/frontmatter snapshot.
- Exact Markdown/table source hashes, logical widths, column lengths, title validity, and semantic matrices bind each descriptor entry to the intended source and converter output.
- Invalid/mismatched presentation fails before misleading output and leaks no path/bytes/temp file; Office never falls back.
- PDF/Print honor selected overflow and hardbreak presentation; DOCX keeps full reflowable content.
- None is dotted only in the editor and absent from Print/PDF/DOCX; real/default borders use exact mapped widths/colors.
- Valid titles remain full-width in PDF/DOCX; stale titles lose no continuation content; Markdown remains the GFM surrogate plus marker.
- Download/email share transformers; Print uses the same presentation-aware PDF path.
- Office Markdown email contains exact canonical body plus frontmatter; Email editor calls remain legacy.
- The real Office Export dropdown exposes exactly one direct `Email Markdown` action in the ratified order; pointer/keyboard activation is single-shot and pending state prevents resubmission.
- Existing save/milestone behavior, unrelated content/package parts, filename sanitation, unknown frontmatter, and document state are preserved.
- Actual Electron PDF buffers are parsed and raster-asserted; transformed DOM or screenshots alone do not pass.
- No renderer-supplied HTML/CSS/path/arguments, general Office import/editing, document versioning, provenance, or export history is introduced.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint src/components/office/useDocumentActions.ts src/components/office/OfficeDocumentTopbar.tsx src/components/email/useDocumentActions.ts src/components/office/officeTableOutputDescriptor.ts src/lib/documentOutputPayloads.ts src/types/electron.d.ts e2e/office/fixture-scenarios.mjs e2e/office/run-isolated-electron.mjs e2e/office/run-presentation-output-electron.mjs e2e/office/verify-packaged-office-modules.mjs e2e/office/packaged-office-modules-smoke.mjs e2e/office-document-output-payloads.spec.ts e2e/office-table-presentation-output.spec.ts
node --check e2e/office/isolated-electron-output-main.cjs
node --test e2e/office/fixture-lifecycle.test.mjs
node --test electron/shared/office-table-source-binding.test.mjs electron/preload.test.cjs electron/export/submodules/documents/table-presentation.test.cjs electron/export/submodules/documents/pandoc-table-breaks.test.cjs electron/export/submodules/documents/docx-table-presentation.test.cjs electron/ipc/document-handlers.test.cjs
node e2e/office/run-presentation-output-electron.mjs
npm run electron:pack
node e2e/office/verify-packaged-office-modules.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-document-output-payloads.spec.ts e2e/office-table-presentation-output.spec.ts --project=chromium --workers=1
npx playwright test --config=playwright.office.config.ts e2e/office-*.spec.ts --project=chromium --workers=1
```

Then run the exact cumulative palette server gate:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand test/office/palette-config.test.js test/office/palette-watcher.test.js test/office/palette-sync.test.js test/office/palette-removal-journal.test.js test/ws/office-palette-handlers.test.js
```

Record expanded browser/Node/Jest/Electron file lists and exit codes. Tests inspect source-binding vectors, transformed HTML, rasterized PDF/text geometry, DOCX XML/package validity, handler routing, legacy compatibility, and cleanup.

## Manual Electron Smokes

Artifact inspection:

```bash
node e2e/office/run-presentation-output-electron.mjs --retain-artifacts
# inspect the printed allowlisted directory
node e2e/office/run-presentation-output-electron.mjs
```

The second command must remove the prior marked retained directory and leave no current staging/temp roots.

Interactive UI/IPC smoke:

```bash
node e2e/office/run-isolated-electron.mjs --scenario=presentation-output --workspaces=1 --copies=4
```

Use the four numbered documents deterministically: copy 01 downloads exactly one PDF and one DOCX; on copy 02 use the real Export dropdown's DOCX/PDF Email submenu actions and its direct `Email Markdown` action to create exactly one attachment of each format, including keyboard activation of `Email Markdown`; copy 03 exercises Preview/Print; copy 04 performs save/reopen and raw-source readback without another output. Expected renderer download names are exactly `Presentation Output--copy-01.pdf` and `Presentation Output--copy-01.docx`; any other/missing/extra item fails. Pass requires the exact dropdown order/label, matching title/border/overflow behavior, DOCX reflow/full text, exact Markdown frontmatter, Mail attachment routing, no stale temp/process, and no live-workspace mutation. The dedicated runner supplies optional retained artifacts; the interactive scenario adds only the exact launcher-owned output sink above and otherwise preserves SPEC-00 lifecycle/cleanup behavior.

The launcher must print the owned output directory before interaction. Inspect each renderer download there while Electron remains open and record the launcher's post-exit hashes/parsers; nothing may appear in the real Downloads directory. For every email action, do not send: inspect the attachment, close the compose window, and explicitly discard the draft. For Preview/Print, cancel the system print dialog and close the opened Preview document/window. Before closing Electron, confirm no Mail draft or Preview document from the smoke remains. The coordinator/launcher must then prove delayed attachment/print temps, downloads, fixture roots, child processes, and watchers are gone; external-app cleanup is a manual pass criterion, never assumed from IPC success.

## Non-Goals

- Native DOCX import/editing, arbitrary typography/layout fidelity, cell-background export, table-alignment export, or a general HTML export API.
- Changing saved Markdown to HTML tables or embedding presentation CSS.
- Document versioning, provenance, export history, or a persistent descriptor/event.

## Worker Handoff

Follow `GUIDANCE.md`. Report snapshot/source-binding fixtures, exact validator and compatibility matrices, transformed HTML, rasterized PDF/DOCX evidence, handler-path equivalence, retained/default cleanup, complete cumulative commands, and exact skipped/N/A rationale. Return `READY_FOR_ORCHESTRATOR_REVIEW` or — only for Tier-3 conditions under the run protocol's decision ladder — evidence-backed `BLOCKED`; bank Tier-2 questions via `NEEDS_RULING` in the report file and keep working.
