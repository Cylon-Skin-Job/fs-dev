# Office Editor Builder Guidance

**Applies to:** Every SPEC in this bundle (living document; dispatch authority is the supervisor's delegation packet alone — there is no candidate/release pairing precondition)

Dispatch authority is the delegation packet from the owner-facing Roadmap Implementation Supervisor: a packet's existence is authorization to execute its SPEC. Release-control freeze/hash ceremony is retired (owner ruling 2026-07-16, REVIEW-HISTORY.md); SPEC and GUIDANCE files are living documents maintained by the supervisor. The decision ladder in ~/projects/Fusion-Home/oe009-run/PROTOCOL.md governs stop behavior everywhere the words BLOCKED or 'stop' appear in this bundle: Tier 1 pre-authorized actions are done and recorded, Tier 2 questions are banked via NEEDS_RULING while work continues, `AUTHORITY_BLOCKED` is reserved for an indispensable owner decision, and `BLOCKED` is reserved for genuine execution impossibility.

## 0. Operating Reality (owner ruling — overrides any conflicting process step)

This work runs in a **local, single-owner development environment** on the owner's own machine, for an unreleased app. It is not a hosted, multi-tenant, air-gapped, or supply-chain context, and must not be treated as one.

- **The owner is trusted, by definition.** Validation, review, and enforcement exist to catch *AI* mistakes, not to police the owner. The owner may read, open, edit, move, rename, or delete any file at any time, with no permission, notice, or justification. That is normal and authorized — it is their machine and their code.
- **Owner actions never invalidate, "contaminate," or "unaccept" work.** If files changed — whether the owner touched them or a builder did — the correct response is to **re-review the current bytes**, never to reject on the grounds that something changed. Drift is expected in a living workspace; it is not a defect and never, on its own, a rejection reason.
- **Hashes are provenance, not a gate.** A hash may be recorded to identify *which bytes were reviewed*. It is a convenience for traceability only. "The hashes changed during review" is **not** an acceptance criterion and **not** a reason to withhold acceptance. Acceptance asks one question: *do the current bytes pass the gates (build, lint/check, tests, review)?* Nothing about byte-identity to an earlier snapshot enters that decision. This concerns the identity of *source artifacts under review*; it does not touch the runtime data-preservation invariants in §3 (byte/value-equivalent metadata preservation), which remain in full force.
- **No burglar posture toward the owner.** Security controls that distrust *inputs* — e.g. resolving repository and machine roots only through the trusted workspace registry rather than a client-supplied path string — are about hostile network clients, not the owner operating locally. Do not extend "don't trust inputs" to the owner's own direct actions.

This section overrides any builder, reviewer, orchestrator, or agent-file process step that treats owner file access or hash-drift as adversarial, or that rejects/blocks on drift instead of re-reviewing the current bytes. The freeze/hash ceremony is retired (see the preamble above); this states positively what replaces it.

## 1. Mission and Boundary

Implement exactly one Office Editor SPEC at a time. The current SPEC owns observable behavior; this document owns shared engineering and handoff rules.

Do not implement or modify document versioning, revision/checkpoint systems, provenance, provenance schemas, event-ledger integration, or provenance preparation. Those areas are neither prerequisites nor optional stretch work.

Also exclude native Office-format editing/import, generic save-pipeline repairs, Recent documents, thumbnails, search, and general export redesign. SPEC-11 is the sole narrow exception: it carries the accepted table title/border/overflow presentation into Print, PDF, DOCX, and emailed equivalents. These are product boundaries, not file allowlists. If omitted mechanical integration is necessary to make the current SPEC work, implement it and record it as a deviation. If a genuinely new product choice is required, bank it via `NEEDS_RULING` with evidence and continue all independent work.

## 2. Repository and Authority Rules

- Work in `/Users/rccurtrightjr./projects/fs-dev` and obey the root `AGENTS.md`.
- Preserve unrelated user/worker changes in the dirty worktree.
- Use active paths `fusion-studio-client/` and `fusion-studio-server/`; historical names and archived SPECs are not current architecture.
- Interpret authority in this order: explicit owner decision, approved current SPEC, current Wiki, then active-code constraint.
- Active code may determine feasibility but cannot silently redefine the approved product behavior.
- A ratified SPEC may name an explicit **target-state documentation delta** from current Wiki behavior. That named delta is an authorized supersession: implement the SPEC, then update only the Wiki pages named by that SPEC after tests pass.
- If a SPEC and current Wiki conflict anywhere outside a named target-state delta, bank the exact citations as a NEEDS_RULING question and continue non-dependent work. Do not choose one silently, and do not stop the session.

### 2.1 Preparation-time source anchors

These line anchors identify the active revision audited when this bundle was prepared. A builder must reread the named surrounding code before editing and report meaningful drift:

| Contract/current constraint | Exact preparation anchor |
|---|---|
| Office table schema/node-view chrome and mutation boundary | `fusion-studio-client/src/components/office/officeTableNodeView.ts:1-12,35-58,71-90`; current Tables Wiki `PAGE.md:23-49` |
| Current structure context, optimistic success, delete guards, color shift, plus-icon mismatch | `officeTableContextMenu.ts:51-116,116-186,244-260,312-325` |
| Milkdown's command manager can return the registered ProseMirror command for invocation with a capture dispatch | `node_modules/@milkdown/core/src/internal-plugin/commands.ts:41-109`; GFM table command wrappers `node_modules/@milkdown/preset-gfm/src/node/table/command.ts:198-275` |
| Current color cascade, duplicated identity, reindex helpers, immediate commit | `officeTableColors.ts:43-64,86-125,136-152,253-266`; `front-matter.ts:152-213` |
| Renderer must use table chrome + injected descendant CSS, never cell/row writes | Tables Wiki `PAGE.md:69-91`; Lessons Wiki `PAGE.md:27-46`; Office Viewer Wiki `PAGE.md:145-178` |
| Current resize minimum, identity, right-edge-only handles, release commit | `officeTableGeometry.ts:63-89,126-185,198-230,263-320,339-343`; Lessons Wiki `PAGE.md:48-71` |
| Baked `<colgroup>` and `ignoreMutation` | `officeTableNodeView.ts:41-58,61-90`; Tables Wiki `PAGE.md:28-49` |
| Current layout/color sibling schemas and layout `style` loss surface | `front-matter.ts:28-34,95-150,152-213,236-252` |
| Current picker tiers, browser-global key/cap, document scraping, and ten-column Google grid | `officeColorPopover.ts:1-45,115-194`; `OfficeDocumentPage.css:582-642`; `front-matter.ts:216-234` |
| Current editor controller lifecycle and external metadata callbacks | `useCrepeEditor.ts:178-193,198-237`; `OfficeDocumentPage.tsx:151-160` |
| Installed transform/history APIs support invertible registered Steps, record nonempty step transactions, and route keyboard history through native Undo/Redo | `node_modules/prosemirror-transform/src/step.ts:16-67`; `node_modules/prosemirror-transform/src/transform.ts:52-94`; `node_modules/prosemirror-history/src/history.ts:260-287,320-464`; `node_modules/@milkdown/plugin-history/src/index.ts:12-71` |
| Installed hardbreak/table Markdown behavior requires an explicit table-cell codec | `node_modules/@milkdown/preset-commonmark/src/node/hardbreak.ts:24-60`; `node_modules/@milkdown/preset-commonmark/src/node/html.ts:20-55`; `node_modules/mdast-util-gfm-table/lib/index.js:145-167` |
| Installed GFM table schema permits one header row, ProseMirror cells support `colspan`, and stock GFM serialization drops spans | `node_modules/@milkdown/preset-gfm/src/node/table/schema.ts:23-27,69-101,206-227`; `node_modules/prosemirror-tables/dist/index.js:235-256,333-347`; `node_modules/mdast-util-gfm-table/lib/index.js:247-284` |
| Default Playwright uses live port/server; no dedicated Office script exists | `fusion-studio-client/playwright.config.ts:3-24`; `fusion-studio-client/package.json:7-23,94-112` |
| Isolated database and machine roots | `fusion-studio-server/lib/db.js:11-17,25-46`; `workspace/ai-paths.js:16-22,60-83` |
| Trusted workspace lookup/list and registry change events | `lib/workspace/registry-service.js:17-67,124-136`; `lib/workspace/workspace-controller.js:225-260,381-397` |
| Global palette seed/source and workspace-local config path | `System_Manager/global-configs/office-custom-color-pallete/colors.json`; `workspace/ai-paths.js:16-22,60-83` |
| Current Print/PDF/DOCX/email actions send body Markdown without renderer metadata and share Pandoc/PDF paths | `useDocumentActions.ts:50-76,110-164`; `electron/ipc/document-handlers.cjs:31-80,88-155,203-214`; `electron/export/submodules/documents/index.cjs:1-79`; `electron/export/pdf-engine.cjs:28-43` |

Preparation evidence—not builder authority—is anchored in this bundle's `DECISIONS.md:15-52`, `CAPTURE.md:38-63,71-176,180-239,246-283,287-337,340-402`, `ISSUES.md:1-105`, and `DECISION-LEDGER.md`. A builder is not expected or permitted to resolve behavior from those raw preparation files. Before release, every applicable ratified decision and disposition must be copied into the paired SPEC or this `GUIDANCE.md`; if the two builder inputs omit or contradict a required contract, bank it via NEEDS_RULING (Tier 2) rather than consulting the preparation record to choose one, and continue non-dependent work.

## 3. Hard Editor Invariants

### 3.1 Markdown and table schema

- Markdown is the canonical Office document body.
- Do not serialize table presentation as inline HTML/CSS in the Markdown body. SPEC-07's canonical bare `<br>` is semantic cell content, never a presentation setting; attributes, styles, and other HTML behavior are not authorized by that codec.
- SPEC-08 owns one additional narrow structural codec. A spanning title row remains a real ProseMirror header row in Office, while saved Markdown uses a valid N-cell GFM header surrogate and `metadata.tableStyles[].titleRow: true` to rehydrate the first row to one `<th colspan="N">` before the first visible editor frame. Rehydration additionally requires at least three physical rows (title, promoted conventional header, and one remaining data row), so its enabled generic deletion can preserve the schema minimum. A marked two-row surrogate fails closed into stale quarantine without merging or rewriting. The title text occupies surrogate cell 0 and every remaining surrogate header cell is empty. The codec never emits an HTML table, never guesses a title marker from content, and never rewrites on open.
- Preserve unknown frontmatter keys during parse/normalize/serialize.
- Apply the ratified structure contract exactly: one schema header plus at least one data row; deleting any header promotes the immediately following row and is disabled if no data row would remain. `Add title row` inserts one full-width header cell and demotes the former header, so a newly added title always has at least three rows. It is disabled whenever row 0 has one physical cell, including every one-column table. There is no Remove Header, Remove Title Row, or Footer action. When the context menu is opened on a verified spanning title cell itself, treat it as a title-row special case: keep `Add title row`, `Insert Row Above`, `Delete Row Above`, `Insert Column Left`, `Insert Column Right`, `Delete Column Left`, and `Delete Column Right` visible but disabled, with no explanation text/tooltip. In the root delete group, SPEC-08 inserts one `Delete Row` (`delete`) action immediately before `Delete Row Above`; it is visible only for that verified title context, is enabled, and removes the current title through the generic promotion transaction. A marked two-row surrogate is stale, never a verified title context.

### 3.2 ProseMirror DOM ownership

Never imperatively write classes, styles, data attributes, text, or replacement nodes onto editable `<td>`, `<th>`, `<tr>`, or their contents. This previously caused rebuild loops, lost selection, and caret resets.

Allowed presentation mechanisms are:

- attributes/styles on Office-owned table chrome such as `<table>` and the baked-in `<colgroup>`; and
- an Office-owned injected stylesheet that targets descendant cells from a stable table-chrome selector.

SPEC-07 has one narrow presentation exception to the content representation, not to the mutation ban: an Office-only ProseMirror node view installed once for the existing Milkdown `hardbreak` node. Its explicit branch has `data-rv-hardbreak="explicit"` and contains the native `<br>`; its inline-soft-break branch retains one literal space and no `<br>`. Scoped CSS toggles the explicit child versus a generated collapsible one-space `::after` presentation. A paired table-cell Markdown codec is installed before initial parse and maps exact semantic `<br>` tokens to/from that same document node, including terminal/consecutive cases. SPEC-08's separately bounded title-row schema/codec is structural and transaction-owned. Neither exception authorizes imperative controller writes into editable cell/row DOM.

Keep `officeTableNodeView.ignoreMutation` behavior compatible with presentation-only attribute writes. Keep the `<colgroup>` in the node view from construction. Resize continues to preview in the body-level overlay and commit table widths once on pointer release.

All column-count, colgroup, width, and handle logic uses logical `TableMap.width`/colgroup boundaries, never first-row physical cell count. A SPEC-08 one-cell title spanning N columns still has N col elements and N+1 resize boundaries.

The SPEC-03 column minimum is a true square: freeze `Wmin` at pointerdown equal to the canonical regular one-line cell's automatic minimum outer border-box row height `Hmin`. Total inline padding is exactly `0.5ch` inside that square (`0.25ch` per side). Content-expanded row height never feeds back into the width clamp, and no row height is persisted or manually resized. Later title/border/alignment packets must preserve this geometry contract.

### 3.3 Frontmatter domains

The normalized domains are siblings:

- `metadata.tables` — width geometry only;
- `metadata.tableColors` — cell/row/column background-color rules only;
- `metadata.tableStyles` — table-wide overflow, the SPEC-08 title-row round-trip marker, border, and alignment only.

A controller read/write must merge its own domain without erasing either sibling or unknown metadata. Do not reuse the current loose `metadata.tables[].style` field: geometry readback reconstructs layout entries and can drop it.

Treat any pre-existing `metadata.tables[].style` object as opaque legacy/unknown data: preserve it byte/value-equivalently during geometry and collection operations, but do not interpret, migrate, or delete it in this roadmap. All newly accepted presentation fields live only in `metadata.tableStyles`.

Every table-scoped entry uses the shared `{ tableIndex, fingerprint }` matching helper. Matching behavior must be centralized rather than copied into another controller. Stable identity across arbitrary duplicate-table reordering remains deferred; do not expand a feature SPEC into a document-format migration.

SUPERSEDED (owner rulings 2026-07-14/15): table-color precedence follows the SPEC-02C model (~/projects/Fusion-Home/oe009-run/SPEC-02C/SPEC-02C.md, scenarios S1-S10): explicit cell entry (color or 'none') wins; else the newer (higher rank) covering row/column entry, legacy equal ranks resolving to the row; else no fill. All color entry creation/deletion/re-keying goes through the pure officeTableColorPolicy module (applyColorPolicy / normalizeColorRules / reindexColorRules) — never reimplement it.

Malformed/out-of-range `tableColors` rules never render and never trigger an open/read rewrite. The next successful structure/direct-color commit on that same table must prune them against next-state dimensions inside the same metadata Step, remove empty maps/entry, and make the cleanup Undo/Redo-exact. Unrelated tables and text-only saves preserve their raw values.

In the final accepted state, a verified row mutation preserves width/style values but refreshes `{ tableIndex, fingerprint }` in every activated table-scoped collection, because top-row/header edits can change the current fingerprint. A verified column mutation additionally reindexes activated width and color coordinates at the exact index. Verified whole-table insertion/removal reindexes all present collections. The staged activation table below determines which domains the current packet owns; an earlier builder must preserve but must not redesign a later domain. Failed mutations preserve every collection byte-equivalently at every stage.

### 3.4 Structural mutation atomicity

Renderer-domain structural atomicity is deliberately cumulative:

| Accepted stage | Required structural transaction payload |
|---|---|
| SPEC-01 | Every accepted row/column transaction carries exact `metadata.tableColors` and `metadata.tables` width/identity transforms in the one dispatch. Color/width history and no-stale-frame guarantees are active immediately; `tableStyles` values remain preserved but are not structurally refreshed yet. A failed/no-op command preserves every collection. |
| SPEC-02 through SPEC-05 | Row/column transactions retain the SPEC-01 color plus width/identity transforms. SPEC-02 additionally owns direct color set/clear, cascade, normalization, and target-table cleanup; SPEC-03 additionally owns direct resize commits. |
| SPEC-06 | Whole-table insertion/removal reindexes every present collection, including opaque/seeded `tableStyles`; row/column activation remains as above. |
| SPEC-07 onward | Row/column transactions carry color, width/identity, and `metadata.tableStyles` identity transforms; SPEC-08 additionally owns the title-row marker/codec; whole-table mutations continue to cover every present collection. |

Each cumulative regression gate must prove all domains activated by its stage. This table is a sequencing contract, not permission to regress or erase a later/opaque collection.

Direct metadata-only actions activate with their owning packets rather than in SPEC-01: cell/row/column color set/clear in SPEC-02, resize in SPEC-03, overflow in SPEC-07, border width/color in SPEC-09, and alignment in SPEC-10. SPEC-08 `Add title row` and title/header deletion are composite structural plus metadata-marker transactions. From its owning packet's acceptance onward, each action must use the metadata Step and remain in every later cumulative regression gate.

**Owner supersession, 2026-07-21:** SPEC-04/05 palette text about cross-workspace convergence, continuous watching, reconciliation, retries, journals, fanout, or timestamps is retired. The accepted target is the selector contract in §4. SPEC-04/05 execution must finish that target, remove superseded machinery, and report every deviation from the older packets. The existing picker remains usable until the file-backed cutover is complete; no accepted intermediate state may expose a read-only palette or lose Add capability.

Never infer success from a menu click. Capture the target table and its pre-mutation `TableMap` dimensions. Build/intercept the proposed ProseMirror transaction before dispatch, apply it to an in-memory next state, and verify the exact same-table dimension/content delta there. Prepare every immutable metadata transform required by the current accepted stage from that verified next state, attach those transforms to the same composite transaction, and dispatch once. A command that cannot yield a verifiable transaction is a failure/no-op and leaves the document, metadata, dirty state, and persistence byte-equivalent.

The Office table history bridge introduced by SPEC-01 is an invertible ProseMirror `Step`, not a second stack. `OfficeTableMetadataStep` carries immutable normalized before/after snapshots for the renderer-owned table collections, returns the same document from `apply`, returns a swapped step from `invert`, maps position-independently, and is registered for transaction JSON. The companion plugin applies the step's `after` snapshot to renderer state synchronously. Every SPEC-01 production structure action appends the color plus width/identity snapshot to the same transaction. From the applicable owning packet onward, every user action that directly changes `metadata.tables`, `metadata.tableColors`, or `metadata.tableStyles`—including set/clear color, resize, overflow, the title-row marker, border, and alignment—uses the Step in the same one-event transaction. Close each table operation into one event. Native keyboard, command, and `beforeinput` Undo/Redo then replay the inverse/forward step automatically; ordinary text events contain no such step. The step is never serialized to Markdown/frontmatter body, and there is no independent renderer undo command, branch, or stack. Workspace `colors.json` add/sync/remove state is external config, not document renderer metadata: editor Undo may revert the table fill applied from a swatch but never changes the workspace palette.

Forward, Undo, and Redo application of a metadata Step each publish one renderer callback, one dirty transition, and one normal save schedule. Loading/applying initial frontmatter creates no history event and no dirty/save effect. A zero-effective-change action creates no Step.

After dispatch, verify the expected live editor state as a defensive assertion. For every renderer domain activated at the current stage, transaction/plugin state must publish its metadata synchronously before the browser's next paint, so a structure edit cannot expose one stale frame in that domain. Only that verified composite success may mark dirty or schedule one save. If the defensive assertion fails, do not attempt a second compensating metadata mutation in that runtime. Capture evidence, stop further mutation in the isolated fixture, repair the transaction/plugin implementation, reset the fixture, and rerun affected gates. Return terminal `BLOCKED` only if repair or revalidation is genuinely impossible.

Undo/redo must keep structural content and every renderer domain activated at the current stage coherent. Group one user command as one observable history action; once a domain is activated, do not create a state in which content undoes but that domain's indices remain shifted.

### 3.5 Final Table submenu composition

**Owner amendment, 2026-08-04 — page-alignment flow:** for page settings Left,
Center, and Right, new/keyless tables inherit the current page alignment. On a
page change from `P_old` to `P_new`, every table whose current effective
alignment equals `P_old` follows to `P_new`; tables with a different value stay
put. This is value-based pinning only—no durable pin flag or rank. If the page
later becomes equal to a previously pinned table, that table rejoins the flow
and follows the next page change. Direct table choices remain target-only.
Justify maps to effective table alignment Center: Left→Left, Center→Center,
Right→Right, Justify→Center. Use those effective old/new values for the flow
comparison, making Center↔Justify a table no-op. Center→Left or Right moves
every effective-Center follower. Keep the value-follow policy consumer-neutral
so later dividers, images, and code blocks can adopt it, but SPEC-10 wires only
tables and must not change those future consumers.

Each menu SPEC adds only its accepted controls; it must preserve earlier controls and must not show placeholders for later SPECs. After SPEC-10, the top-level `Table` (`table_edit`) submenu order is:

1. `Add title row` (`variable_add`), always present and disabled when row 0 has one physical cell;
2. divider;
3. Border size, then Border color (`border_all`);
4. divider;
5. Align table left/center/right (`align_horizontal_left`, `align_horizontal_center`, `align_horizontal_right`);
6. divider;
7. Overflow (`format_text_overflow`) opening the three radio choices Overflow, Truncate, and New line;
8. divider; and
9. Remove table (`delete`).

The existing Cell/Row/Column Background and adjacent row/column Insert/Delete controls remain in the root cell context menu. Every submenu exposes current state and full pointer/keyboard/focus behavior; no inert item is allowed. On a verified spanning title cell, the title-row disabled-state exception above overrides ordinary row-above/column structural targeting; the title-context `Delete Row` remains enabled, title Cell Background still targets `(0,0)`, Column Background still targets logical column 0, and resize handles remain available. `Delete Row` follows normal root-menu pointer/keyboard activation, closes the menu after one accepted dispatch, and restores the editor selection/focus to the promoted header; Undo restores the exact title and selection.

Nested-menu keyboard behavior is cumulative: Left closes only the current submenu and focuses its parent trigger (root Left is a no-op); Escape from any nonmodal layer closes the entire context-menu stack and restores the exact invoking editor cell/selection. Modal Escape follows the separate complete-no-op confirmation contract.

## 4. Workspace Color-Config Rules

- The machine-global palette is `System_Manager/global-configs/office-custom-color-pallete/colors.json` with `{ "custom_colors": [] }`. All Office workspaces on that machine share this one file.
- The workspace-local file remains `ai/<local-machine>/System/config/colors.json` with `{ "custom_colors": [], "sync_enabled": true|false }`.
- `sync_enabled: true` is a source selector: read and display only the global `custom_colors`; Add and Remove write only the global file. Ignore the local `custom_colors` array completely—do not compare, merge, copy, reconcile, or mutate it.
- `sync_enabled: false` selects the local array; Add and Remove read/write only that workspace file. The global file is untouched.
- Toggling sync writes only the local `sync_enabled` flag, preserves both arrays, and immediately switches the displayed source. Drift is irrelevant by design.
- Opening or switching to a workspace reads its local selector once and then reads the selected source. There is no continuous filesystem watching. Another workspace observes global changes when it next opens/switches/refreshes or after an acknowledged mutation in the current app flow.
- Moving a workspace to another machine uses that machine's global palette when `sync_enabled` is true; set false to use the transported local palette.
- Normalize colors to lowercase six-digit `#rrggbb`, deduplicate while preserving order, retain stored entries beyond the visible UI cap, and never rewrite a valid file merely because only part is shown.
- Use ordinary bounded read/write handling and clear errors for malformed, inaccessible, or unwritable selected files. Do not add cross-workspace fanout, merge/convergence rules, watchers, retry schedulers, removal journals, timestamps, a database, versioning, provenance, or recovery state machines.

### 4.1 Presentation-output boundary

SPEC-11 is the only packet allowed to change the document Print/PDF/DOCX/email conversion path. An Office action atomically captures body Markdown, full frontmatter Markdown, and the normalized descriptor from one editor/frontmatter state. For PDF/DOCX/Print and PDF/DOCX email it sends exact body Markdown plus both `presentationMode:'office-tables'` and `tablePresentation`; it never sends HTML, CSS, file paths, Pandoc arguments, OOXML, or scripts. Office Markdown email omits the mode pair and sends the exact full frontmatter document.

The descriptor root has exactly `markdownSha256` and `tables`; each dense ordered table entry has exactly `tableIndex`, `sourceSha256`, `logicalWidth`, `columns`, `overflow`, `titleRow`, `borderWidth`, and `borderColor`. Whole-body and exact GFM source-slice SHA-256 values, logical widths, column lengths, title-surrogate validity, and converter-side semantic cell matrices bind every entry to its exact source. Electron independently recomputes and validates them before temp/converter/output work. Count/source/semantic mismatch fails with `TABLE_PRESENTATION_MISMATCH`; malformed mode/data fails with `INVALID_TABLE_PRESENTATION`.

Absence of both Office fields is the backward-compatible legacy branch. The active Email editor and every other non-Office caller retain that path even when their Markdown contains tables; they are never subjected to Office table validation/transformation. Exactly one Office field, a wrong mode, or Office mode on a non-Markdown/unsupported surface is invalid, and an Office failure never falls back to an unstyled legacy artifact. The discriminant and descriptor are ephemeral request data, not saved document version/provenance fields.

The output contract is narrow:

- spanning title row in actual PDF/DOCX/Print;
- color None is editor-dotted but absent from Print/PDF/DOCX;
- real/default borders use selected width `1..4` on every output surface;
- Print/PDF preserve selected Overflow/Truncate/New line, including hidden content;
- DOCX remains reflowable/full-content; and
- emailed Markdown contains the canonical full document with frontmatter.

Download and email of the same format must use one transformer. Fail a descriptor/table mismatch rather than attaching a style to the wrong table. Preserve existing filename sanitation, temp containment/cleanup, save/milestone behavior, and unrelated export content. Do not broaden this bridge into native Office editing/import, general HTML export, cell-background/alignment fidelity, versioning, provenance, or export history.

For DOCX only, bundled Pandoc's GFM reader exposes canonical table-cell `<br>` as a JSON-AST raw HTML inline but its DOCX writer otherwise drops the hard-break boundary. SPEC-11 therefore owns one trusted Electron-side structural pre-writer bridge: validate the Pandoc table matrix, replace only a table-cell raw inline representing exactly one `<br>` with native `LineBreak`, then write/post-process DOCX and require `w:br|w:cr`. No renderer filter/path/argument or regex table rewrite is allowed.

## 5. Test Isolation and Evidence

SPEC-00 establishes the only permitted Office UI test fixture. Later Playwright tests must:

- use an isolated temporary workspace and isolated `FUSION_APP_USER_DATA`/database;
- enable the Office view through the supported workspace template/manifest;
- never select, create, edit, or delete files in the live `fs-dev` workspace;
- use deterministic fixture documents and clean up all temporary roots/processes even on failure;
- select/reset only scenarios from the shared immutable `fixture-scenarios.mjs` catalog established by SPEC-00 and extended only by the later owning, ratified SPECs; manual Electron smokes use `run-isolated-electron.mjs` with the exact scenario/variant/copy arguments in the SPEC;
- run with `--workers=1` when mutating the shared fixture;
- assert persisted disk/frontmatter state in addition to visible DOM state when persistence is in scope.

Every slice gate is executable through the packet's named test ownership using the mandatory tag `[slice XX.Y]`, where `XX.Y` is the heading number. Tests implementing that gate use the tag at the start of their own test/describe title. For each slice, run the packet's build command if present. For changed client-owned files, lint the exact sorted relative list with the client-local `npx eslint <files>` and record the expansion. The server has no ESLint toolchain: for each changed server `.js`/`.cjs` file, run server-local `node --check <file>` in sorted order and run the applicable tagged Jest gate; never invoke/download ESLint there. Markdown-only changes require link/fence checks, not code lint. Derive targeted test commands mechanically from each applicable packet-level command: append `--grep '\[slice XX\.Y\]'` to Playwright; append `--testNamePattern='\[slice XX\.Y\]'` to Jest; add `--test-name-pattern='\[slice XX\.Y\]'` immediately after `node --test`. The unanchored literal is intentional because runners prepend project/file/parent-suite titles to their full-name match strings. A named test command is applicable when its file list owns at least one assertion in that slice gate; zero matched tests is failure. A standalone runner command is applicable at the earliest slice whose gate names that runner and runs unmodified there. The final slice runs every unfiltered command in `Exact Validation` as the cumulative packet gate.

The tagged Playwright test or isolated Electron/module runner required by a slice gate is its incremental smoke. A pure/model/codec slice whose gate explicitly has no browser, process, filesystem, IPC, or UI surface records `SMOKE_NA_PURE` and runs its tagged pure tests; every other slice must have at least one tagged isolated browser/Electron/process integration assertion before continuing. The packet's `Manual Electron Smoke(s)` section is the final-slice interactive cumulative smoke unless a slice explicitly names an earlier manual action. A command passes only with exit code 0 and the asserted behavior; screenshots alone are not evidence.

SPEC-11's interactive presentation-output scenario must route renderer downloads through its launcher-owned `will-download` wrapper into the printed fixture artifact directory; it may not touch the real Downloads folder. Manual Mail/Preview checks must discard unsent drafts, cancel print UI, and close opened documents/windows, while the coordinator/launcher removes delayed attachment/print temps on shutdown.

Do not broaden a targeted lint failure into repository-wide cleanup. Fix lint errors in files changed by the SPEC; report unrelated pre-existing failures with exact output.

### 5.1 Canonical palette smoke variants

Replace old watcher/convergence variants with selector tests:

- true reads global and ignores a deliberately different local array;
- false reads local and leaves global untouched;
- Add and Remove mutate only the selected source;
- toggling changes only `sync_enabled`, preserves both arrays, and changes the visible palette immediately;
- switching workspaces rereads the target selector/source once;
- reopening under another machine-global fixture uses that global when true and the transported local array when false;
- malformed/unwritable selected-source errors do not overwrite either file;
- no watcher, fanout, retry, journal, reconciliation, timestamp, or background process is created.

The cumulative palette gate must include codec/file-service, WebSocket intent, renderer picker, workspace-switch, and isolated Electron assertions for this selector contract. Retire watcher, convergence, retry, and removal-journal tests instead of preserving their obsolete expectations.

## 6. Slice Discipline

For each vertical slice:

1. Confirm prerequisites and current test baseline.
2. Implement the smallest end-to-end behavior in the slice.
3. Inspect all changed files plus surrounding integration points.
4. Run the mechanically tagged targeted commands in §5 and record matched test counts.
5. Run the slice's tagged isolated smoke, or record the exact permitted `SMOKE_NA_PURE` rationale; run the packet's interactive manual smoke at the final slice.
6. Repair findings and repeat affected review/checks until clean.
7. Continue only after the slice passes.

Do not leave a superseded duplicate path within the same caller/surface, dead flag, placeholder menu entry, test-only production branch, or silent fallback. SPEC-11's explicit no-mode compatibility branch for existing non-Office callers is the sole authorized legacy route and must remain behaviorally distinct from the Office opt-in; it is not a fallback. Temporary adapters must be named in the report with their removal criterion; the default expectation is none.

## 7. Builder and Orchestrator Separation

Execute every released packet through `$orchestrator`. The implementation builder receives only the released SPEC and this `GUIDANCE.md`; it does not invoke the orchestration skill itself.

Builders and orchestrators run their own documented process. They may touch omitted files and complete bounded integration necessary for the current SPEC, but may not silently start an unrelated later feature. Every deviation is reported and the orchestrator assesses its downstream impact. They may not mark their own work owner-accepted; the supervisor reports the complete SPEC to the owner, and the next SPEC waits for explicit owner acceptance.

## 8. Required Terminal Report

Return exactly one terminal status in the report file:

- `SPEC_READY_FOR_SUPERVISOR_REVIEW` (ready for the supervisor's acceptance review); or
- `AUTHORITY_BLOCKED` with the indispensable owner decision and all completed independent work; or
- `BLOCKED` with evidence of a genuine execution/environment impossibility. Stale or failing tests, omitted file authorizations, owner edits, changed hashes, review findings, and unrun commands are never terminal; repair and record them or use Tier 2 while independent work continues.

Both statuses require:

1. changed files and behavior summary;
2. acceptance-criterion mapping;
3. self-review scope, findings, repairs, and final assessment;
4. exact commands and exit/results;
5. automated, browser-smoke, Electron/manual, and persistence evidence, using justified `N/A` where the SPEC permits it;
6. temporary adapters and removal criteria;
7. skipped checks and reasons;
8. every SPEC deviation and out-of-scope touch, including original text, actual change, reason, files, tests, observable effect, risk, and downstream impact;
9. orchestrator classification and recommended correction for each deviation;
10. residual risks; and
11. for `AUTHORITY_BLOCKED` or `BLOCKED`, the exact decision/impossibility, evidence, completed independent work, and explicit `N/A` values for checks that genuinely could not occur.

Review has no arbitrary pass ceiling. Finding count, novelty, changed hashes, or a severity trend never creates an instability terminal state. Repair current bytes and review again until clean or a genuine Tier-3 blocker remains.

## 9. Documentation Gate

When a SPEC changes accepted durable behavior, update only its named current Wiki pages after implementation and tests agree. Wiki text must describe the final observable contract and actual active paths, not the implementation plan or historical failure. A Wiki-only claim is not proof that runtime behavior exists.
