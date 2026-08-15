# BULLETIN — CSS UI Changes Second Brain

> Live coordination for the primary chat and focused side chats. This file routes work and handoffs; it is not a source of product truth, owner decisions, approvals, or implementation authority.

## Purpose

Use the bulletin to expose work that would otherwise remain trapped in one chat: active assignments, cross-document handoffs, conflicts, blocking questions, and concise completion notes.

The user's prompt grants the actual write lease. A bulletin entry is advisory coordination and cannot expand a chat's assigned scope.

This file follows the working-folder bulletin protocol embedded in `$second-brain`. The fronting-agent `$launchpad` skill performs intake or re-entry and sends bounded backstage work to this contract; `$capture` only checkpoints an active workspace. Neither command redefines bulletin triggers or authority.

## Protocol

- Read this file after `index.json` and before editing an assigned document.
- Post only when another chat could otherwise duplicate work, collide with it, remain blocked, or proceed with materially wrong context.
- Post blockers that survive source checks; clarity questions that could change intent, scope, approval, authority, or output; cross-scope handoffs; contradictions or concurrent-edit risks; material out-of-scope observations with a bounded destination; coordination claims for related parallel work; and resolutions that unblock another chat.
- Do not post routine progress, locally answerable questions, content that belongs in an authoritative document, unbounded speculation, transcript summaries, or anything intended to grant approval or implementation authority.
- Give every entry a stable `B-*` identifier; use the next unused number and never renumber existing entries.
- Allowed types: `assignment`, `handoff`, `conflict`, `question`, `observation`, `completion`.
- Allowed statuses: `open`, `claimed`, `blocked`, `resolved`, `superseded`.
- A side chat may create a new entry or update an entry it owns in addition to its assigned document. Do not edit another chat's entry except to add a clearly attributed response.
- Name exact target files and sections. Do not use a bulletin entry as permission to edit those targets.
- Link evidence or name the source used. Separate verified facts from inference.
- When resolved, update the entry in place with the outcome. Do not delete it; compaction is a separate, explicitly requested maintenance action.
- Decisions still belong in `DECISIONS.md`; findings in `ISSUES.md`; proposal lifecycle in `PROPOSALS.md`; purpose, desired outcomes, and enduring goals in `INTENT.md`; raw context in `CAPTURE.md`.

Entry template:

```markdown
### B-NNN — Short title
- **Type:** assignment | handoff | conflict | question | observation | completion
- **Status:** open | claimed | blocked | resolved | superseded
- **Owner/chat:** primary | descriptive side-chat label | unclaimed
- **Target:** `FILE.md` → `Section` (or `none`)
- **Source:** user statement, document, or verified code path
- **Summary:** What other chats need to know.
- **Next:** The bounded next action, decision needed, or `none`.
- **Outcome:** Fill when resolved; otherwise `pending`.
```

## Entries

### B-001 — Bootstrap the bulletin coordination layer
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** primary
- **Target:** `BULLETIN.md`, `AGENTS.md`, `index.json`, process records
- **Source:** RC direction in the primary chat on 2026-08-09
- **Summary:** Add a live coordination surface for the Second Brain proof of concept while keeping document authority and implementation boundaries intact.
- **Next:** Use this format for the first focused side-chat assignment or cross-document handoff.
- **Outcome:** `BULLETIN.md` created and wired into the folder-local contract and routing index.

### B-002 — Keep the working-folder bulletin inside Second Brain
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** primary
- **Target:** `~/.codex/skills/second-brain/SKILL.md`, `BULLETIN.md`, process records
- **Source:** RC correction in the primary chat on 2026-08-09
- **Summary:** Do not create a standalone bulletin skill. The bulletin protocol here belongs to Second Brain curator side chats; a capture constructor must preserve that role boundary.
- **Next:** None; the capture constructor outcome is recorded in B-003.
- **Outcome:** The incomplete standalone skill scaffold was removed from discovery and moved to Trash; the usage threshold and lifecycle remain in `$second-brain`. D-18 and B-006 later assigned intake and re-entry to `$launchpad` and narrowed `$capture` to checkpointing.

### B-003 — Settle the `/capture` constructor contract
- **Type:** completion
- **Status:** resolved
- **Owner/chat:** primary
- **Target:** `~/.codex/skills/capture`; `CAPTURE.md` → `Approved /capture constructor skill`; `DECISIONS.md` → D-13
- **Source:** RC approval in the primary chat on 2026-08-09
- **Summary:** The explicit-only fronting-agent `/capture` skill uses highest-prefix-plus-one numbering, `NNN-Descriptive_Name`, and an `INTENT`-based kernel, then hands the folder to `$second-brain`. D-14 later refined the proposal and Wiki-impact filenames.
- **Next:** Use `/capture` on a future conversation and adjust the constructor only from observed workflow needs.
- **Outcome:** The personal `$capture` skill and its read-only numbering helper were created; `$second-brain` was generalized to maintain schema-driven folders without renaming existing `VISION.md` documents. D-18 and B-006 later moved constructor ownership to `$launchpad` and narrowed `$capture` to checkpointing.

### B-004 — Migrate to role-based filenames and record schemas
- **Type:** completion
- **Status:** resolved
- **Owner/chat:** primary
- **Target:** capture documents; `AGENTS.md`; `index.json`; `$capture`; `$second-brain`
- **Source:** RC approval in the primary chat: “Let's do it.”
- **Summary:** Replace approval-state and generic Wiki filenames, separate immediate intent from long-range vision, normalize stable category headings and record metadata, and make the reusable skills create and maintain that structure.
- **Next:** Exercise the schema in future capture and side-chat work; evolve category vocabularies only from observed needs.
- **Outcome:** Added `INTENT.md`; migrated `APPROVALS.md` to `PROPOSALS.md` and `WIKI.md` to `WIKI_IMPACT.md`; preserved historical aliases; normalized record structure; organized Wiki-impact records under six stable subject categories; and updated the local and reusable contracts.

### B-005 — Adopt the category-first issue profile
- **Type:** completion
- **Status:** resolved
- **Owner/chat:** primary
- **Target:** `ISSUES.md`; `AGENTS.md`; `index.json`; `$capture`; `$second-brain`
- **Source:** RC direction in the primary chat on 2026-08-09
- **Summary:** Separate issue subject, type, severity, and status; route contradictions into issues by default; and avoid a redundant contradiction document.
- **Next:** Apply the same category/type distinction to future issue records and create a contradiction extension only if the distinct-corpus threshold is met.
- **Outcome:** Reclassified all 16 issues under four populated subject categories, added controlled issue types, normalized severity to high/medium/low, and updated the local and reusable contracts.

### B-006 — Establish the Launchpad fronting architecture
- **Type:** completion
- **Status:** resolved
- **Owner/chat:** primary
- **Target:** `~/.codex/skills/launchpad`; `~/.codex/skills/capture`; `~/.codex/skills/second-brain`; process records
- **Source:** RC clarification and direction in the primary chat ending with “Do it.”
- **Summary:** Make Launchpad the resumable fronting workflow, Second Brain the backstage batch engine, and Capture a lightweight checkpoint while allowing earned schemas to draw from composable domain examples or locally invented conventions.
- **Next:** Forward-test `$launchpad` in a new session against this folder, then refine only from observed re-entry or schema-selection failures.
- **Outcome:** Created `$launchpad` with folder survey and construction, re-entry orientation, schema derivation, software/research-writing/media examples, backstage routing, and Roadmap Creator readiness rules; aligned `$capture`, `$second-brain`, and the local contract.

### B-007 — Revalidate the theme runtime and shared chrome
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** theme-runtime-revalidation side chat
- **Target:** `ISSUES.md` → `Architecture and Theme Runtime`
- **Source:** CAP-002; I-1, I-2, I-4, I-5, I-9, I-10; current renderer and server theme sources named by those records
- **Summary:** Use the Launchpad software profile and Second Brain current-behavior verification procedure to recheck the canonical token chain, native `color-scheme`, common scrollbars, dropdown/context-menu hover and focus states, hue-slider accent, on-accent text, and status/diff colors against current code and representative runtime behavior. The durable output is a surgical evidence/status update to this section only. This is research and documentation: do not edit product code, proposals, decisions, CAPTURE, or the canonical Wiki; do not infer approval. Other chats share the worktree, so preserve concurrent edits and post any bounded cross-section handoff here.
- **Next:** Launchpad can reconcile CAP-002 after B-008 and B-010 return. A full live light-theme check still needs a non-persisting harness or an owner-approved active-theme change because ThemePicker persists mode changes.
- **Outcome:** Revalidated I-1, I-2, I-4, I-5, I-9, and I-10 against the current client, server theme generator, active workspace styles/catalog, and the running `user-current` dark renderer. Corrected the representative phantom-token count to 170 references across 12 names; confirmed fixed white-alpha glass/scrollbar tokens, `color-scheme: normal`, the unresolved Office `--accent`, missing theme-primary foreground pairing, and fixed diff/warning colors; added generated Cal light-theme contrast measurements with explicit source-derived confidence limits. All six issues remain open. No product code, proposals, decisions, CAPTURE, or Wiki files changed.

### B-008 — Complete the product-surface visual pass
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** product-surface-visual-pass side chat
- **Target:** `ISSUES.md` → `Product Surfaces`
- **Source:** CAP-002; D-4, D-5; I-6, I-7, I-8, I-11; current Office, Email, Crepe, and PaperBrightnessControl implementations
- **Summary:** Use the Launchpad software profile and Second Brain current-behavior verification procedure to inspect Office and Email paper in both themes, the shared mute behavior, PaperBrightnessControl chrome, Crepe chrome, and the Office steel-blue palette island. The durable output is a surgical evidence/status update to this section only, including reproducible visual observations and explicit confidence limits. Preserve the always-white-paper owner decision. Do not edit product code, proposals, decisions, CAPTURE, or the canonical Wiki; do not redesign surfaces or strengthen intent. Other chats share the worktree, so preserve concurrent edits and route any architecture or component finding back through a new bulletin handoff.
- **Next:** Launchpad can reconcile CAP-002 now that B-007 through B-010 have returned. B-011 carries the bounded proposal/capture wording handoff from the corrected I-11 finding.
- **Outcome:** Revalidated I-6, I-7, I-8, and I-11 against current source and the running Fusion Home Office and Email surfaces in light and dark modes. Confirmed the undefined brightness-dropdown tokens, unconditional dark Crepe frame, and a 42-occurrence Office steel-blue/dark fallback family. Exercised Office paper, Email reading, Email compose, and the saved minimum paper-brightness value of `0`; the surfaces remained light and dark ink remained legible, so I-11 was corrected from an unreadability defect to the verified contradiction between D-5's pure-white contract and the current warm-white/color-mixed bases plus mute overlay. The light-mode brightness dropdown and transient Crepe selection/block chrome were not isolated, and those confidence limits are recorded in ISSUES. No product code, proposals, decisions, CAPTURE, or Wiki files changed.

### B-009 — Verify sliders and resize-handle accessibility
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** slider-accessibility side chat
- **Target:** `ISSUES.md` → `Components and Interaction`
- **Source:** CAP-002; I-12, I-16; current ThemePicker, PaperBrightnessControl, Office hue-slider, and `ResizeHandle.tsx` implementations
- **Summary:** Use the Launchpad software profile and Second Brain current-behavior verification procedure to compare the three slider implementations in both themes and verify labels, keyboard behavior, focus visibility, track/thumb styling, resize-handle semantics, orientation/value metadata, and keyboard resizing. The durable output is a surgical evidence/status update to this section only. Do not create a component design, edit product code, approve P-005 or P-015, edit CAPTURE, or change the canonical Wiki. Other chats share the worktree, so preserve concurrent edits and post cross-section discoveries as bulletin handoffs rather than expanding scope.
- **Next:** Launchpad can reconcile CAP-002 after the remaining visual-pass assignments return. A light-theme slider check still needs a non-persisting test harness or an owner-approved live theme change because ThemePicker auto-saves and activates mode changes.
- **Outcome:** Revalidated I-12 and I-16 against current source and the running app. Corrected ThemePicker from 13 to 12 unnamed sliders; recorded the labeled PaperBrightnessControl and Office hue ranges, native keyboard semantics, divergent focus/track styling, and the dark-theme runtime result; confirmed that shared resize handles remain bare pointer-only dividers absent from the accessibility tree. No product code, proposals, decisions, CAPTURE, or Wiki files changed.

### B-010 — Recheck maintenance and migration findings
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** maintenance-migration-recheck side chat
- **Target:** `ISSUES.md` → `Maintenance and Migration`
- **Source:** I-13, I-14, I-15; current token renderers, shared-style loader, workspace style tree, client consumers, and database migrations
- **Summary:** Use the Launchpad software profile and Second Brain source-verification procedure to determine whether the Dracula token CSS, `office-viewer.css` layer, isolated literals, and legacy theme seed are still dead, unused, or current. The durable output is a surgical evidence/status update to this section only with exact current paths and search evidence. Do not delete files, edit product code or migrations, change proposals, edit CAPTURE, or modify the canonical Wiki. Other chats share the worktree, so preserve concurrent edits and use a bulletin handoff for any finding that belongs outside this section.
- **Next:** None; I-13 through I-15 remain open implementation debt for later proposal/plan work.
- **Outcome:** Revalidated the three records against current source on 2026-08-10. The `.token-*`/`--token-*` palette and `office-viewer.css` layer remain dead; the Markdown-icon selector and Pinwheel default are present but not exercised by identified current consumers; and fresh-database startup still provisions legacy theme schema/data even though the active theme service is file-backed. Updated only `ISSUES.md` → `Maintenance and Migration`; no product code, migration, proposal, CAPTURE, or Wiki files changed. Second Brain validation passed.

### B-011 — Reconcile the corrected paper-surface finding
- **Type:** handoff
- **Status:** resolved
- **Owner/chat:** primary Launchpad reconciliation
- **Target:** `PROPOSALS.md` → `Surface Integration` (P-013); `CAPTURE.md` → CAP-002
- **Source:** B-008; I-11; D-5
- **Summary:** The 2026-08-10 light/dark pass did not reproduce the prior claim that minimum paper brightness makes Email ink and controls unreadable. It instead verified that Office uses warm white `#faf9f6` and Email mixes that base toward workspace content before applying the mute overlay, contradicting D-5's literal pure-white contract. Proposal and Capture reconciliation must preserve that distinction and must not treat the new evidence as proposal approval or implementation authorization.
- **Next:** RC must answer CAP-007 before P-013 can become an implementation-ready requirement without risking a contradiction with owner intent. CAP-002 separately remains open for the unexercised direct light-theme states.
- **Outcome:** Updated P-013 to align the candidate action with D-5 while preserving an explicit decision-first path if warm-white or color-mixed paper is desired. Refreshed CAP-002 with the completed and outstanding visual-pass scope, corrected the working synthesis, and recorded CAP-007 as the unresolved owner question. No proposal was approved and no product code or canonical Wiki file changed.

### B-012 — Verify remaining light-theme chrome and controls
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** light-theme-chrome-verification side chat
- **Target:** `ISSUES.md` → `Architecture and Theme Runtime`; `Components and Interaction`
- **Source:** CAP-002; I-1, I-2, I-4, I-5, I-9, I-10, I-12, I-16; B-007 and B-009 confidence limits
- **Summary:** Complete the direct light-theme checks that remained unobserved: global scrollbar track/thumb and hover, shared dropdown/context-menu hover and focus, ThemePicker and other sliders, accent-backed dialogs, and focus treatment. Use a non-persisting or isolated light-theme harness; do not mutate the owner's saved theme state. Update only the two assigned `ISSUES.md` sections with reproducible observations and confidence limits. Do not edit product code, proposals, decisions, CAPTURE, or the canonical Wiki. Preserve concurrent edits and report any finding that belongs to Product Surfaces as a bulletin handoff.
- **Next:** none
- **Outcome:** On 2026-08-13, an isolated non-persisting Chromium harness loaded active `variables.css`, generated Cal light CSS (`luminance: 100`, `accent: #242424`), `dropdown.css`, global scrollbar rules, and a native range. It directly confirmed fixed white-alpha dropdown hover (`rgba(255,255,255,0.06)`), fixed scrollbar thumb (`rgba(255,255,255,0.12)`), `color-scheme: normal`, and browser-native `accent-color: auto` in the light token context. Source inspection confirmed context-menu hover/focus uses the same fixed `--glass-md` and `outline: none`. ThemePicker, BookmarkDialog, mounted accent-backed dialogs, resizable panes, and surface-specific menus were not mounted in this harness; no saved theme state was changed. Updated only the assigned Architecture and Theme Runtime and Components and Interaction records in `ISSUES.md`. `validate_index.py` passed.

### B-013 — Verify remaining surface-specific light states
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** surface-light-state-verification side chat
- **Target:** `ISSUES.md` → `Product Surfaces`
- **Source:** CAP-002; I-6, I-7, I-8, I-11; B-008 confidence limits
- **Summary:** Complete the direct light-theme checks that remained unobserved for surface-specific UI: PaperBrightnessControl dropdown, transient Crepe selection/block chrome, Office color popover, Office column-grab guide, and any mounted Office/Email accent-backed controls. Use a non-persisting or isolated light-theme harness and treat D-20's Office behavior as the paper reference. Update only this `ISSUES.md` section with reproducible observations and confidence limits. Do not edit product code, proposals, decisions, CAPTURE, or the canonical Wiki. Preserve concurrent edits and route architecture/component findings back through a bulletin handoff.
- **Next:** None; direct mounted Crepe selection/block-handle and Email accent-control checks remain bounded confidence limits for later fixture-based verification.
- **Outcome:** Resolved on 2026-08-13. Used an isolated headless Chromium harness with `PaperBrightnessControl.css`, `OfficeDocumentPage.css`, and installed Milkdown `frame-dark`/block-edit CSS under Office-reference light variables, without mutating persisted theme state. Confirmed the PaperBrightnessControl dropdown and ring remain `#202020`; confirmed Crepe slash-menu surface/hover remain `#121212`/`#232323`; confirmed the Office color popover resolves to warm `#faf9f6` while steel-blue text/guide values remain active and the column guide pseudo-element reaches opacity `1` when active. No mounted live-editor selection/block handle or Email compose accent-backed control was available, so those observations remain source-backed and explicitly unverified at runtime. Updated only `ISSUES.md` → `Product Surfaces`; validator passed.

### B-014 — Map the shared Office-reference paper change surface
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** paper-change-surface-mapping side chat
- **Target:** `CHANGE_SURFACE.md` → all sections
- **Source:** D-19, D-20, P-013, P-016, I-11, CAP-002
- **Summary:** Inspect the current code and runtime contracts for Office paper, Email paper, thumbnails, brightness/muting, shared styles, and editor chrome. Populate `CHANGE_SURFACE.md` with exact file paths and entry points, current duplication or divergence, the smallest shared boundary to design, consumer relationships, dependencies, verification needs, and explicit non-goals. This is planning analysis only: do not edit product code, canonical Wiki, proposals, decisions, CAPTURE, or the document schema beyond the assigned file and owned bulletin entry. Other chats share the worktree; preserve concurrent edits.
- **Next:** none
- **Outcome:** `CHANGE_SURFACE.md` now maps the exact Office, Email, thumbnail, brightness, persistence, and editor entry points. It identifies `lib/officePaperBrightness.ts` as the existing numeric seam, documents Office's warm `#faf9f6` plus overlay as canonical, and records Email's independent `color-mix`/missing-overlay divergence and the separate Email document-page hardcodes. It bounds a renderer-local shared paper-variable/value boundary, preserves the intentional overlay-free PNG capture path, lists acceptance checks and fixture limits, and records technical choices for later plan/spec work. No owner decision is required now; no product code, Wiki, proposal, decision, CAPTURE, or schema files changed. `validate_index.py` and Capture route checks passed.

### B-015 — Draft the paper implementation package
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** paper-implementation-notes side chat
- **Target:** `IMPLEMENTATION.md` → all sections
- **Source:** D-19, D-20, P-013, P-016, I-11, `CHANGE_SURFACE.md`; RC's clarification that saved thumbnail PNGs are clean sources and displayed thumbnails receive the slider-controlled overlay afterward
- **Summary:** Turn the approved behavior and bounded change surface into a plain-language, pre-roadmap implementation draft. Preserve the distinction between a clean captured PNG and the overlay applied to its displayed thumbnail. Include ordered code/test work, exact consumer files, unchanged behavior, and only genuine technical details still to decide.
- **Next:** Use this draft as input to a formal roadmap/spec when RC authorizes that planning step. Do not edit product code, canonical Wiki, owner decisions, proposals, issues, CAPTURE, or other bulletin entries from this handoff.
- **Outcome:** Added `IMPLEMENTATION.md`, a plain-language pre-roadmap draft that sequences the neutral shared paper boundary, Office, capture/display thumbnails, Email, and verification. It records the clean-PNG/display-overlay distinction explicitly, preserves current brightness persistence and controls, and identifies no missing RC product decision. Folder index and capture-route checks passed.

### B-016 — Prepare the theme-foundation decision brief
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** theme-foundation-brief side chat
- **Target:** `BULLETIN.md` → B-016 only
- **Source:** I-1 through I-5, I-9, I-10; P-001 through P-004, P-008, P-014; D-4 and D-6
- **Summary:** Reconcile the verified shared theme defects and their proposals into a concise, plain-language decision brief: what is already approved, what remains proposed, what must be grouped for a coherent first theme package, affected code areas, and any genuine owner choices. This is research and coordination only.
- **Next:** RC decision on whether to approve the proposed parts of the first package; approved scrollbar work can proceed in its eventual spec either way.
- **Outcome:** **Theme foundation, in plain language:** The app already knows how to calculate its main backgrounds, borders, text, and accent colors for light and dark themes. It does not consistently publish the supporting values that shared controls need. As a result, light mode inherits dark-oriented white hover layers, scrollbars, overlays, accent text, and browser-native controls.

  **Already approved:** D-4 requires light mode to match dark-mode quality; D-6 / P-003 specifically approve light-aware scrollbar track, thumb, and hover values. This is direction and future-spec scope, not product-code authorization.

  **Smallest coherent first package:** add one complete shared token set to both writers—the server generator (`fusion-studio-server/lib/theme/`) and the immediate Theme Picker preview (`fusion-studio-client/src/lib/theme/live-preview.ts`)—then have it state the active light/dark mode. The set should cover the currently missing shared surface/accent values needed by common controls, mode-aware glass and overlay values, a readable foreground paired with a primary accent, and scrollbar values. This fixes the invisible light-mode hover/focus states, white-on-white scrollbars, browser-native controls choosing the wrong scheme, the Office hue slider's fixed fallback, and black text on dark primary buttons. It must preserve the existing generated background/text/accent calculations and keep preview and saved-theme output aligned.

  **Code zones:** theme fragments and generator under `fusion-studio-server/lib/theme/`; `fusion-studio-client/src/lib/theme/live-preview.ts`; baseline fallbacks in `fusion-studio-client/src/styles/variables.css`; global native-control/scrollbar rules in `fusion-studio-client/src/index.css`; shared dropdown/context-menu rules in `fusion-studio-client/src/styles/dropdown.css` and `fusion-studio-client/src/lib/contextMenu.ts`; primary-button and Office hue consumers.

  **Order:** first establish the shared values and active mode in both writers; next consume the approved scrollbar values and replace the affected shared hover/focus and primary-accent fallbacks; then verify a saved light theme and a non-persisting live preview agree. The previously approved scrollbar work belongs here because it uses the same shared output.

  **Separate follow-on packages:** P-004 is the broader sweep replacing every hardcoded white-glass panel; P-008 is semantic warning/error/diff colors; P-005 is a reusable slider component; P-002's old database-seed retirement is maintenance work after the active token contract is stable. They should not delay the foundation package.

  **Genuine owner choice:** P-001, the active-token portion of P-002, and P-014 are still proposals. RC needs only to approve grouping those proposed pieces with already-approved P-003 as the first theme-foundation package. No color, interaction, or visual-style choice is missing: dark mode remains the reference under D-4.

### B-017 — Add the approved theme package to the implementation draft
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** theme-implementation-notes side chat
- **Target:** `IMPLEMENTATION.md` → all sections; `index.json` → `IMPLEMENTATION.md` entry; `AGENTS.md` → implementation-draft boundary
- **Source:** D-21; P-001, P-003, P-014, P-017; I-1, I-2, I-4, I-5, I-6, I-9; B-016
- **Summary:** Expand the shared implementation-notes document into separate, plain-language theme and paper packages. The theme package needs exact affected code zones, required behavior, ordered work, verification, non-goals, and only real remaining technical details. Preserve the paper package unchanged in meaning.
- **Next:** Complete the theme draft and validate the working folder. Do not edit product code, canonical Wiki, owner decisions, issues, proposals, CAPTURE, or unrelated bulletin records.
- **Outcome:** Refactored `IMPLEMENTATION.md` into separately bounded Theme Foundation and Paper packages. The theme package records D-21's shared server/preview token contract, active mode, first consumers, acceptance checks, and explicit exclusions; the paper package retains its prior behavior and acceptance meaning. Updated the index and local document boundary. Index validation and capture-route checks passed.

### B-018 — Prepare the editor and Office-chrome decision brief
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** editor-office-chrome-brief side chat
- **Target:** `BULLETIN.md` → B-018 only
- **Source:** I-7, I-8; P-006, P-007; D-4, D-20; B-013
- **Summary:** Produce a concise plain-language brief that separates the dark-only Crepe editor chrome from the Office steel-blue styling island. State the smallest safe scope for each, their dependencies on the approved theme foundation and paper behavior, exact code zones, what must remain unchanged, and whether RC has a real product decision to make.
- **Next:** Discuss the two proposed packages one at a time. Neither is approved for implementation yet.
- **Outcome:** **1. Crepe editor chrome (I-7 / P-007).** The Office and Email editors always load Milkdown's `frame-dark.css` (`components/office/useCrepeEditor.ts:6-9` and `components/email/useCrepeEditor.ts:8-11`). In light mode that leaves slash menus and other transient editor controls dark (`#121212` surface; `#232323` hover), even though the document sheet remains the Office-standard paper. The smallest safe future package is to make the Milkdown chrome follow the active app mode in those two editor integrations, then check the small Office toolbar overrides in `components/office/OfficeDocumentPage.css:1201-1210`. It depends on the approved Theme Foundation package supplying reliable mode and chrome values. It must not change editor commands, Markdown/content serialization, table behavior, or the D-20 paper base and brightness overlay. Verify both modes in Office and Email: toolbar, slash menu, selection controls, and block handle; retain a fixture check if transient controls cannot be opened live. **Owner choice:** approve P-007's scope; no separate visual-style choice is needed because D-4 already makes dark mode the reference and requires light-mode parity.

  **2. Office steel-blue chrome (I-8 / P-006).** Office's color picker, custom-color controls, table insert/context menus, column-resize guide, and confirm dialog still fall back to a separate steel-blue/dark family. The main style concentration is `components/office/OfficeDocumentPage.css:594-1158`; the matching DOM entry points are `officeTableGeometry.ts`, `officeColorPopover.ts`, `officeCustomColorEditor.ts`, `officeInsertMenu.ts`, `officeTableContextMenu.ts`, and `officeTableConfirmDialog.ts`. The smallest safe future package is to replace only those chrome literals and fallbacks with the shared theme values supplied by Theme Foundation, preserving the existing controls and interaction rules. It depends on Theme Foundation first; it must use—not redefine—the D-20 shared Office paper value wherever a popover sits on paper, and it must not alter table data, table layout, color persistence, or the paper brightness model. Verify light and dark popover/menu/dialog/readability, active swatches, keyboard focus, and the active column guide in a mounted Office document. **Owner choice:** approve P-006's scope; there is no unresolved choice about the paper behavior or a new Office visual language.

### B-019 — Add the approved Office-token package to the implementation draft
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** office-token-implementation-notes side chat
- **Target:** `IMPLEMENTATION.md` → Office Token Package; `index.json` → `IMPLEMENTATION.md` entry; `AGENTS.md` → implementation-draft boundary
- **Source:** D-22; P-006; I-8; B-013; B-018; D-20
- **Summary:** Add a separately bounded Office token package to the shared implementation draft. It must replace historical steel-blue literals/fallbacks with Theme Foundation values while preserving Office controls, document/table behavior, color persistence, and paper behavior.
- **Next:** Use this package only as pre-roadmap input after Theme Foundation; do not edit product code, canonical Wiki, owner decisions, issues, proposals, CAPTURE, or unrelated bulletin records from this assignment.
- **Outcome:** Added the indexed `Office Token Package` to `IMPLEMENTATION.md`. It sequences the D-22 migration after Theme Foundation, names the concentrated CSS and Office DOM/control zones, preserves D-20 paper behavior and current Office commands/data/persistence, and excludes Crepe under D-23. Folder validation and capture-route checks passed.

### B-020 — Prepare the shared controls and accessibility decision brief
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** shared-controls-accessibility-brief side chat
- **Target:** `BULLETIN.md` → B-020 only
- **Source:** I-12, I-16; P-005, P-015; D-4, D-7, D-21; CAP-008
- **Summary:** Produce a concise, plain-language decision brief for ordinary numeric sliders and resize-handle accessibility. Keep the future visual hue picker separate from the generic Slider concept. State the smallest safe scope, code zones, dependencies, verification, what remains outside this package, and genuine owner choices.
- **Next:** Return a brief for one-at-a-time owner approval discussion. Do not edit product code, canonical Wiki, owner documents, issues, proposals, CAPTURE, implementation draft, index/schema, or other bulletin records.
- **Outcome:** **1. Ordinary numeric sliders (I-12 / narrowed P-005).** Theme Picker has twelve separate, unnamed native range inputs in `components/ThemePicker.tsx:196-250`; its CSS only uses browser `accent-color` (`components/ThemePicker.css:442-469`). Paper brightness is a separate, correctly named native range in `components/PaperBrightnessControl.tsx:82-104`, with its own CSS and focus rule in `components/PaperBrightnessControl.css:84-113`. The smallest safe future package is one thin Slider component plus one themed stylesheet for only those numeric controls: each caller retains its value, range, and persistence, while the component requires a programmatic label, a visible focus state, keyboard-native range behavior, accessible current-value information where useful, and mode-aware track/thumb styling. It should be built after D-21's Theme Foundation so it consumes the shared light/dark values rather than adding more fallbacks. Verify keyboard adjustment and focus in both themes, meaningful accessible names for all twelve Theme Picker controls and paper brightness, the current values/ranges, and unchanged saved-theme and brightness persistence. **Excluded:** Office custom-color hue. Its current `0–360` range lives in `components/office/officeCustomColorEditor.ts:88-99` with styling in `components/office/OfficeDocumentPage.css:887-893`; CAP-008 keeps it as a future visible hue-gradient/color-picker design thread under D-7, not an ordinary Slider migration. Also exclude a universal color picker, menu work, paper behavior, and any redesign of Theme Picker settings. **Owner choice:** approve this narrowed numeric-only P-005 scope; that approval should supersede P-005's older wording that included the hue control.

  **2. Accessible resize handles (I-16 / P-015).** The shared pointer-drag primitive and its four wrappers are in `components/ResizeHandle.tsx:36-165`; it currently returns event handlers and a CSS class to bare `<div>` elements. The visual/hit-target rules are in `components/App.css:270-309`. Mouse dragging and stored widths already work, but keyboard and assistive-tech users cannot reach a handle or change/commit a width. The smallest safe future package is to retain that drag/store path and add a focusable separator control to each wrapper, correct vertical-separator semantics and orientation, an accessible name, visible focus styling, keyboard width changes using the existing `clampPaneWidth` limits, and the same commit path used after a pointer drag. It should follow D-21 so focus/active colors use shared theme values. Verify every left/right handle in both themes: tab reachability, announced role/name/orientation/value, arrow-key resizing in the correct direction, limits, visible focus, pointer-drag parity, and persistence after commit. **Excluded:** changing default widths, pane layout/grid placement, handle location/hit-target geometry, or a general layout redesign. **Owner choice:** approve P-015's accessibility scope. D-4 and D-7 set the parity/reusable-component direction, but P-015 itself remains a proposed package.

### B-021 — Add the approved pane-resize accessibility package to the implementation draft
- **Type:** assignment
- **Status:** resolved
- **Owner/chat:** resize-accessibility-implementation-notes side chat
- **Target:** `IMPLEMENTATION.md` → Pane Resize Accessibility Package; `index.json` → `IMPLEMENTATION.md` entry; `AGENTS.md` → implementation-draft boundary
- **Source:** D-25; P-015; I-16; B-020
- **Summary:** Add a bounded pane-resize accessibility package to the shared implementation draft. It covers keyboard operation, semantics, and focus for the shared Threads/sidebar, primary-chat, secondary-chat, and File Explorer resize dividers while preserving pointer drag and persistence.
- **Next:** Complete the draft and validation. Do not edit product code, canonical Wiki, owner decisions, issues, proposals, CAPTURE, or unrelated bulletin records.
- **Outcome:** Added the indexed `Pane Resize Accessibility Package` to `IMPLEMENTATION.md`. It sequences the D-25 work after Theme Foundation, maps the shared primitive and all four current wrapper/mount zones, preserves the pointer drag and saved-width paths, and excludes unrelated resizers and layout redesign. Folder validation and capture-route checks passed.
