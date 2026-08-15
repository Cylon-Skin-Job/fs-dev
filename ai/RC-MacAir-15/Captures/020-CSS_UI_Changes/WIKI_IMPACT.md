# WIKI IMPACT — CSS UI Changes

> Verified documentation coverage, findings, and candidate downstream Wiki changes. This impact map does not authorize editing `ai/RC-MacAir-15/Wiki/`; actual Wiki work requires its own task and process checks.

The 2026-08-09 survey exposed both CSS/UI documentation needs and unrelated repository-wide legacy debt. Current-effort items remain coupled to theme contracts, mode parity, shared components, paper behavior, and Crepe. Naming, keychain, path, hooks, and navigation repairs are explicitly deferred as a separate Wiki-maintenance workstream.

Current coverage across these categories:

**Normative standards.** `005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` prohibits hardcoded colors, spacing, and z-index values, requires values to trace to CSS variables, and teaches `var(--token, fallback)`. `002-Frontend_UI/PAGE.md` defines UI responsibility boundaries.

**Theme architecture.** `005-Enforcement/002-Themes_And_State/PAGE.md` assigns theme CSS to `System/styles/` and describes the cascade, while `003-Chat_Styling_And_Workspace_CSS/PAGE.md` and Chat UI pages document `.rv-` prefixes, variables, fallbacks, and dropdown aesthetics.

**Theme tooling.** `002-System_Tools/001-Custom_Theme_CSS/PAGE.md` maps slider groups to emitted variable families and contains the Wiki's only light/dark-mode mention, but frames itself as a recipe rather than a constraint.

**Paper behavior.** `009-Fusion_Home/001-Office_Viewer/PAGE.md:258-264` documents the Office paper-brightness mute overlay, but not Office's role as the canonical paper reference or the requirement that Email, thumbnails, and future paper-like surfaces consume the same contract.

**Mechanism gap.** Claude Code receives the standards in always-loaded context, but they contain no mode-parity rule. The kimi pipeline declares `connected-skills: [css-conventions]`, yet the skill is absent from `~/.kimi-code/skills/` and the field is not consumed by the build pipeline. There is no stylelint, CI, or hook enforcement for CSS rules. The fallback pattern permits phantom tokens, neither token writer has a documented complete contract, component guidance is surface-local, and the stale compliance checklist no longer reflects the mostly completed `.rv-` migration.

## Policy and Governance

### C-1 — Theme-variable coverage is described inaccurately

- **Category:** policy
- **Type:** finding
- **Status:** verified
- **Source:** Custom Theme CSS page; `variables.css`; token-consumer audit

The Wiki claims `variables.css` supplies fallbacks for every theme variable. Glass, overlay, and scrollbar families exist only as dark-biased white-alpha defaults, while true phantoms such as surface, accent, error, modal, stacking, and typography tokens are absent or survive only in a legacy seed.

### C-2 — Light/dark clamping overstates mode support

- **Category:** policy
- **Type:** finding
- **Status:** verified
- **Source:** Custom Theme CSS page; I-2; I-4

The page implies that mode clamping handles light/dark behavior, but the generator omits glass, scrollbar, and overlay families and no active `color-scheme` is emitted.

### C-3 — Hardcoded chrome contradicts the standards

- **Category:** policy
- **Type:** finding
- **Status:** verified
- **Source:** Code Standards; Themes and State; CSS audit

The prohibition on hardcoded chrome conflicts with live white-alpha panels, the Office steel-blue palette, Crepe's pinned dark chrome, and a `capture-viewer.css` header claiming nothing is hardcoded despite five fixed white-alpha values. The dead `office-viewer.css` is a near duplicate.

### C-8 — Code Standards invents an undefined token family

- **Category:** policy
- **Type:** finding
- **Status:** verified
- **Source:** Code Standards; CSS consumers

The Wiki teaches `--palette-*` as a core token category although it is defined nowhere and is consumed with inconsistent fallbacks in Office and Email components.

### W-002 — Establish a light/dark parity rule

- **Alias:** W-Create-2
- **Category:** policy
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** `005-Enforcement`
- **Scope:** current_css_ui
- **Basis:** D-4, C-2

Require theme-affecting changes to work in both modes, emit mode-aware tokens and `color-scheme`, and pass representative checks before completion.

### W-003 — Establish token-governance rules

- **Alias:** W-Create-3
- **Category:** policy
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** `005-Enforcement`
- **Scope:** current_css_ui
- **Basis:** I-1, C-1, C-8

Require tokens to be canonically defined before consumption and state that fallbacks provide resilience rather than definitions.

## Architecture and Runtime

### C-5 — Documented cascade layers disagree

- **Category:** architecture
- **Type:** finding
- **Status:** verified
- **Source:** theme Wiki pages; shared-style loaders; disk

The Wiki lists conflicting five- and seven-layer cascades, including nonexistent names. The real order is variables → themes → components → views → file-viewer → capture-viewer → tints. The client constant named `SETTINGS_STYLES_DOC_VIEWER` actually points to `capture-viewer.css`.

### W-001 — Document the theme-generator token contract

- **Alias:** W-Create-1
- **Category:** architecture
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** `005-Enforcement`
- **Scope:** current_css_ui
- **Basis:** I-1, I-2, C-1, C-2

Define every token family emitted per theme and mode, including glass, scrollbar, overlay, and `color-scheme`; cover both the server generator and `LIVE_PREVIEW_TOKENS`; document the `themes.json` mode field as part of the contract.

### W-006 — Document the glass-token family

- **Alias:** W-Create-6
- **Category:** architecture
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** theme-token contract
- **Scope:** current_css_ui
- **Basis:** I-2, I-3

Document liquid-glass and white-alpha overlay semantics as part of the canonical token contract.

### W-009 — Document the iframe token bridge

- **Alias:** W-Create-9
- **Category:** architecture
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** workspace/view theming documentation
- **Scope:** current_css_ui
- **Basis:** `useThemeTokenBridge.ts`

Describe how token declarations are parsed and posted to view iframes, including mutation handling and dependency on W-001's token contract.

### W-010 — Re-home and correct Custom Theme CSS

- **Alias:** W-Update-1
- **Category:** architecture
- **Type:** change
- **Action:** move_and_update
- **Status:** candidate
- **Target:** `002-System_Tools/001-Custom_Theme_CSS/PAGE.md`
- **Scope:** current_css_ui
- **Basis:** C-1, C-2, C-5, C-6

Replace legacy names and paths, fix the cascade and links, remove false coverage claims, and place the page beside the authoritative token contract or clearly link it as a tooling companion.

### W-011 — Correct Themes and State

- **Alias:** W-Update-2
- **Category:** architecture
- **Type:** change
- **Action:** update
- **Status:** candidate
- **Target:** `005-Enforcement/002-Themes_And_State/PAGE.md`
- **Scope:** current_css_ui
- **Basis:** C-5, W-001, W-002

Correct the real seven-layer cascade and link the token-contract and parity rules.

### W-018 — Record the shared-style layer cleanup

- **Alias:** W-Update-9
- **Category:** architecture
- **Type:** change
- **Action:** update_after_decision
- **Status:** candidate
- **Target:** token and shared-style documentation
- **Scope:** current_css_ui
- **Basis:** I-14, P-009, C-3

After the dead layer is resolved, document the actual outcome and correct the self-contradicting live `capture-viewer.css` header.

### W-021 — Rewrite Path Resolution for V2

- **Alias:** W-Update-12
- **Category:** architecture
- **Type:** change
- **Action:** rewrite
- **Status:** deferred
- **Target:** Path Resolution Wiki page
- **Scope:** wiki_maintenance
- **Basis:** current `lib/workspace/path-service.js`

Replace V1 server, workspace-layout, and product-name guidance with the active path-service model.

## Components and Interaction

### W-005 — Consolidate shared-component standards

- **Alias:** W-Create-5
- **Category:** component
- **Type:** change
- **Action:** consolidate
- **Status:** candidate
- **Target:** `005-Enforcement`
- **Scope:** current_css_ui
- **Basis:** D-7, D-19, D-20, P-005, P-010, P-011, P-012, P-016

Elevate existing reusable color-picker and menu-hook guidance and add cross-surface contracts for sliders, menus, popups, color pickers, and the Office-reference paper-presentation primitive consumed by Email, thumbnails, and future paper-like surfaces.

## Product Surfaces

### C-4 — Crepe documentation assumes a fixed dark theme

- **Category:** surface
- **Type:** finding
- **Status:** verified
- **Source:** Crepe Wiki page; Office and Email `useCrepeEditor.ts`

The Wiki treats Crepe's dark theme as fixed and documents only a caret patch, while both integrations import `frame-dark.css` unconditionally despite the stated theme-variable architecture.

### C-7 — Email is documented as unbuilt

- **Category:** surface
- **Type:** finding
- **Status:** verified
- **Source:** Fusion Home and Email Wiki pages; `components/email/`

The Wiki describes Email as planned, but the client contains a substantial inbox, compose, account-switcher, grid, and paper-mute UI. Only the backend and data layer remain genuinely pending.

### W-004 — Document the shared Office-reference paper contract

- **Alias:** W-Create-4
- **Category:** surface
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** `009-Fusion_Home`
- **Scope:** current_css_ui
- **Basis:** D-19, D-20, I-11, P-013, P-016

Document Office paper behavior as the canonical reference, the shared base and brightness/muting contract, and the requirement that Email, thumbnails, and future paper-like surfaces consume it without independent color mixing.

### W-007 — Document the Crepe theme decision

- **Alias:** W-Create-7
- **Category:** surface
- **Type:** change
- **Action:** create
- **Status:** candidate
- **Target:** Crepe documentation
- **Scope:** current_css_ui
- **Basis:** I-7, P-007

Record the current unconditional dark import, the intended mode behavior, and the separation between editor chrome and the shared Office-reference paper contract.

### W-015 — Rewrite Email surface coverage

- **Alias:** W-Update-6
- **Category:** surface
- **Type:** change
- **Action:** rewrite
- **Status:** candidate
- **Target:** `009-Fusion_Home/003-Email/PAGE.md`
- **Scope:** current_css_ui
- **Basis:** C-7, D-19, D-20, I-11

Describe the shipped UI accurately and add Email's obligation to consume the shared Office-reference paper-presentation contract.

### W-016 — Expand the Crepe page

- **Alias:** W-Update-7
- **Category:** surface
- **Type:** change
- **Action:** update
- **Status:** candidate
- **Target:** Crepe Wiki page
- **Scope:** current_css_ui
- **Basis:** C-4, W-007

Replace the stub-level treatment with the actual theme-pinning behavior and intended contract.

## Tooling and Enforcement

### W-008 — Align and document `css-conventions`

- **Alias:** W-Create-8
- **Category:** tooling
- **Type:** change
- **Action:** consolidate
- **Status:** candidate
- **Target:** skill and pipeline documentation
- **Scope:** current_css_ui
- **Basis:** mechanism gap

Document the existing Claude skill, port or align it for kimi, connect the declared dependency, and add token, mode-parity, `.rv-`, and glass guidance.

### W-013 — Reframe the nonexistent Wiki hooks page

- **Alias:** W-Update-4
- **Category:** tooling
- **Type:** change
- **Action:** retire_or_reframe
- **Status:** candidate
- **Target:** `001-Project/018-Hooks/PAGE.md`
- **Scope:** adjacent
- **Basis:** current server Wiki tooling

Mark the described hooks as planned or remove the page; current behavior is implemented through audit and query modules, not the documented watcher module.

### W-023 — Repair the Wiki authoring-tool instructions

- **Alias:** W-Update-14
- **Category:** tooling
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** Style Guide and Wiki authoring pages
- **Scope:** wiki_maintenance
- **Basis:** current audit and query tooling

Replace references to nonexistent sync and query scripts with the active TOC-sync and query modules.

## Maintenance and Migration

### C-6 — Custom Theme CSS migration never completed

- **Category:** maintenance
- **Type:** finding
- **Status:** verified
- **Source:** Wiki navigation and page location

Integrations and Tools lists Custom Theme CSS as planned while the implemented page remains under legacy System Tools.

### C-9 — Source-file frontmatter points to renamed paths

- **Category:** maintenance
- **Type:** finding
- **Status:** verified
- **Source:** Wiki frontmatter and current filesystem

Several Wiki View, Workspace Paradigm, and Server and Runtime pages cite renamed or moved scripts, state slices, and runtime-manager files.

### W-012 — Replace the stale compliance checklist

- **Alias:** W-Update-3
- **Category:** maintenance
- **Type:** change
- **Action:** retire_or_rewrite
- **Status:** candidate
- **Target:** Code Standards compliance section
- **Scope:** current_css_ui
- **Basis:** C-8 and stale audit evidence

Remove ephemeral spec references, reconcile completed and partial migrations, correct renamed components, and close the fallback loophole through W-003.

### W-014 — Correct Warmth Settings naming

- **Alias:** W-Update-5
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** candidate
- **Target:** `001-Project/023-Warmth_Settings/PAGE.md`
- **Scope:** adjacent
- **Basis:** active `fusion.db` identity

Replace Robin-era database and product naming while separately noting the adjacent stale ignore pattern.

### W-017 — Retire the Office Viewer redirect stub

- **Alias:** W-Update-8
- **Category:** maintenance
- **Type:** change
- **Action:** retire
- **Status:** candidate
- **Target:** `001-Workspaces_And_Views/014-Office_Viewer/PAGE.md`
- **Scope:** adjacent
- **Basis:** one live inbound link

Update the inbound link before removing the obsolete redirect page.

### W-019 — Correct Secrets Manager identity and commands

- **Alias:** W-Update-10
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** Secrets Manager Wiki page
- **Scope:** wiki_maintenance
- **Basis:** verified keychain identity

Replace Open Robin naming and obsolete keychain account commands while preserving the still-live environment variable where appropriate.

### W-020 — Correct GitLab keychain commands

- **Alias:** W-Update-11
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** GitLab Wiki page
- **Scope:** wiki_maintenance
- **Basis:** verified keychain identity

Replace the stale `kimi-ide` account with the active Fusion Studio identity.

### W-022 — Correct Setup Wizard legacy naming

- **Alias:** W-Update-13
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** Setup Wizard Wiki page
- **Scope:** wiki_maintenance
- **Basis:** active product and keychain names

Replace Kimi-era product, client, and keychain references.

### W-024 — Repair dead source-file frontmatter

- **Alias:** W-Update-15
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** affected Wiki View, Workspace, and Runtime pages
- **Scope:** wiki_maintenance
- **Basis:** C-9

Point source-file metadata to the renamed query script, state slice, and runtime-manager paths.

### W-025 — Repair Runtime Model cross-links

- **Alias:** W-Update-16
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** two Enforcement pages
- **Scope:** wiki_maintenance
- **Basis:** moved Runtime Model page

Replace broken links with `007-Chat_System/006-Runtime_Model/PAGE.md`.

### W-026 — Replace inert legacy slug links

- **Alias:** W-Update-17
- **Category:** maintenance
- **Type:** change
- **Action:** update
- **Status:** deferred
- **Target:** six `001-Project` pages
- **Scope:** wiki_maintenance
- **Basis:** viewer relative-path resolution

Replace slug-style links that the current viewer cannot resolve with valid relative paths.
