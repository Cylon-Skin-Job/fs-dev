# SPEC — Workspace Chrome Interaction Contract

> **Status:** Owner-authorized implementation handoff. Slice WCI.2 consumes the completed shared menu component for the bounded Workspace consumers named here. Slice WCI.3 is a dependent interaction/accessibility layer on `UNIVERSAL_VIEW_TAB_BAR_SPEC.md`; it is not an alternative tab architecture.
>
> **Scope:** Establish the background-derived interaction-state foundation for Workspace chrome, make the app header and left navigation rail consume the clarified Workspace Foreground and Accent roles, migrate the AI-source selector, Workspace Controls menu, and Workspace Ribbon Add menu to the completed shared menu component, and apply this contract to the shell-owned universal tab bar used by Capture and Files. This SPEC does not define the remaining view-building components, authorize site-wide menu adoption, or replace the Universal tab bar's placement, adapters, persistence, or view behavior.
>
> **Enforces:** `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/PAGE.md`, specifically Architecture Routing, Frontend UI, State Management, and Testing and Smoke Slices.

## Purpose and Authority

New Fusion Studio views must be able to use established chrome without restating hover, pressed, selected, focus, theme, or accessibility behavior. This package creates the first reusable part of that authoring system: Workspace chrome and the universal view-tab bar.

This SPEC implements RC's 2026-08-30 direction developed after `STYLE_GUIDE.html` and `WORKSPACE_CHROME_COLOR_GROUPINGS.md`. Where the sources differ, the newer direction in this SPEC controls this package:

- generic interaction states derive from the local background rather than Workspace Accent;
- Workspace Accent is reserved for the selected left-rail view icon and the Connected indicator;
- Workspace Foreground owns all ordinary Workspace icons, the workspace title, machine-selector contents, inactive tab names and icons, and tab dividers;
- the machine selector has rest, hover, and brief pressed feedback but no selected state;
- tabs use the same hover and pressed language as the machine selector, then use a separate persistent background-derived selected treatment; and
- icon-only Workspace controls retain transparent backgrounds and change to a background-derived interactive foreground on hover; and
- the three Workspace menu surfaces directly attached to this package use the completed shared menu component without pulling content/view menus into scope.

The implementation session is authorized to make and verify the bounded product changes in this SPEC. It must preserve unrelated user and concurrent work in the dirty worktree.

### Authority, precedence, and sequencing

This SPEC and `ai/RC-MacAir-15/Captures/002-SPECs/UNIVERSAL_VIEW_TAB_BAR_SPEC.md` form one dependency-ordered package:

1. The Universal View Tab Bar SPEC controls shell placement, the `ViewTabBar` host, the store-owning adapter registry, the presentational `ViewTabStrip`, combined Capture/File rules B1–B11, persistence, focus-safe view transitions, and its verification matrix, subject only to the explicit overrides below.
2. This SPEC controls Workspace Foreground/Accent ownership and the hover, pressed, selected, focus, disabled, and dark/light visual-accessibility contract applied to that architecture.
3. Where the Universal SPEC asks for visual parity with the old File tab colors, this newer SPEC supersedes only the tab color and interaction-state treatment. The Universal geometry, placement, behavior, persistence, and adapter requirements remain binding.
4. WCI.1 may be implemented independently. WCI.2 depends on the completed shared menu extraction. WCI.3 may begin only after the full Universal SPEC, including its §4.1 path-action migration and verification, is recorded complete, or it must include that full prerequisite scope in the same implementation package. WCI.3 must not create a second view-local shared renderer as an interim solution.
5. If the current worktree still contains the preliminary view-local Capture strip or File `TabRow`, those are migration inputs, not authorities. The current File `+` no-op must not be preserved once the tab strip is visible, but Files does not expose that action before its first file tab exists.
6. Universal §2.3 and §2.4's File visibility/“always” wording is superseded as follows: with zero File tabs, `ViewTabBar` renders nothing and no File `+` is present. Selecting a file through the File tree creates the first document tab; that transition replaces the existing classic no-tab content with the tab strip and reveals the in-strip `+`. Closing the final File tab removes the strip and returns to the existing classic no-tab view state. Replacing that current placeholder with the future long-name identity is not required by this package.
7. Universal B11 is narrowed to the visible-strip state. Once Files has at least one tab, `+` creates or focuses one pathless File view-home tab. That tab uses the view icon and the short view label (`FILES` in the current configuration), while document tabs use document icons and filenames. Selecting a file while the view-home tab is active fills that tab in place; its pathless record remains excluded from persistence. B11 does not provide the first entry into File tab mode.
8. Universal §6's “ONLY the two-key writer change; zero other server diffs” gate applies to the Universal tab/persistence implementation, not WCI.1. A combined package may additionally change `fusion-studio-server/lib/theme/panel-css.js` and its focused theme-generation test solely to publish `--interactive-contrast-foreground`. No other WCI-owned server files are authorized.
9. Universal §4 item 4's “keyboard/click behaviors preserved verbatim” remains binding. Closing the active tab continues to activate and focus the previous tab when one exists, otherwise the next tab. Closing an inactive focused tab preserves the existing active tab and returns focus to it. This SPEC adds navigation and focus recovery around those preserved selection rules; it does not reverse the neighbor preference or activate a neighbor merely because an inactive tab closed.
10. The completed `SPEC-SHARED-MENU-COMPONENT-EXTRACTION.md` implementation is the component-mechanics prerequisite for WCI.2's bounded menu adoption. Its Office ownership rules remain binding. This SPEC authorizes exactly three additional Workspace consumers and the smallest descriptor extension earned by the Workspace Ribbon Add menu; it does not reopen the extraction or authorize any other consumer migration.

No owner decision remains about tab placement or behavior in this package. The explicit overrides above control any conflicting Universal sentence. The only permitted deviations are implementation-detail changes that preserve both SPECs' combined terminal acceptance and are reported in the handoff.

## Product Contract

### App-shell boundary

Fusion Studio owns the persistent App Shell: global header, left navigation rail, thread panel, chat panel, and the host in which the active view mounts. Individual views must not supply or override global header, rail, thread, or chat CSS.

`ContentFrame` mounts the shell-owned `ViewTabBar` above the active view body as specified by the Universal View Tab Bar SPEC. `ViewTabBar` resolves the active panel's adapter and renders the store-free `ViewTabStrip`. A view does not mount its own strip or recreate tab DOM, interaction states, theme wiring, or ordinary tab styling.

### Bounded Workspace-menu adoption

This package adds exactly three non-Office consumers to the completed shared menu component:

1. the app-header AI source/machine selector;
2. the upper-right Workspace Controls action menu; and
3. the Add menu inside the Workspace Ribbon.

The shared component owns their floating action-menu DOM, element anchoring, viewport collision handling, roving focus, keyboard activation, Escape/Tab/outside-pointer dismissal, and action outcomes. Each consumer retains its own trigger, labels, available/disabled state, application actions, and state transitions.

The shared menu surface is also a direct consumer of this package's canonical interaction tokens. Bind its `--interactive-surface-bg` to the component's effective menu surface background, use `--interactive-hover-bg` and `--interactive-pressed-bg` for item hover/focus and brief press, and keep `--interactive-focus-ring` visibly layered over those fills. Replace the component's current isolated `--interactive-surface-hover` lookup rather than publishing a second global alias. The bindings and any component fallback formulas remain component-scoped and background-derived. Because this corrects the one shared renderer, accepted Office menu behavior and geometry must be regression-tested even though Office is not a newly adopted consumer in this package.

This is a presentation migration, not a new action or state architecture. The consumers must keep using their existing store selectors, store actions, callbacks, modal owners, and persistence routes. Do not add a WebSocket message, backend handler, service, browser event, duplicate store field, or second source of truth. Transient menu lifetime belongs to the shared menu handle and the owning trigger/component; it must not be promoted into durable or global state merely to render a menu.

Each React consumer owns one current shared-menu handle and closes it idempotently on unmount, trigger replacement, or containing-surface closure. Closing the Workspace Ribbon must close its Add menu; opening a destination surface from Workspace Controls must leave no action-menu node or listener behind. A closed or replaced handle must not update `aria-expanded`, restore stale focus, or recreate a surface after an asynchronous callback settles.

The AI source menu renders the current local machine as the checked radio item and the future remote option as disabled. This migration must not make remote selection functional or add the future remote Accent border. The trigger is a surface-bearing Workspace control; opening its menu does not give the trigger a persistent selected treatment.

The Workspace Controls menu retains its current macOS Connectors, Fusion, and Workspace theme actions for this package even though those entries may be removed by later product work. Selecting macOS Connectors closes the action menu and opens the existing specialized Connectors surface. That surface contains status and toggle content and is not converted into action-menu rows. Its current close button and outside-pointer dismissal must survive: narrow or relocate the existing header listener so it owns only the specialized Connectors lifetime after the shared component takes over action-menu dismissal.

The Workspace Ribbon itself remains a specialized workspace-switching overlay. Only its Add menu migrates. The menu retains its dynamic hidden-workspace actions, Add Project action, Create New action, existing empty-state communication, and existing results. The ribbon grid, workspace tiles, remove controls, drag behavior, scrim, and overlay lifecycle remain specialized and out of the shared menu renderer.

To preserve the Add menu's current information hierarchy, the shared descriptor union may gain non-interactive heading and status/empty-state descriptors. They must have stable IDs, render as non-action content rather than disabled menu items, receive no roving focus, expose no action outcome, and preserve meaningful accessible grouping/text. No broader descriptor or layout system is authorized by this extension.

The extension stays within the existing shared-menu responsibility split: public descriptor types remain in the types module, generic rendering remains in the surface module, and keyboard/tree logic must identify interactive descriptors through one shared predicate rather than consumer-specific checks. Shared modules must not import Workspace components, stores, services, controllers, or network code. Any new visual values must be component-scoped CSS variables with fallbacks; do not add Workspace-specific selectors to the shared stylesheet.

After each cutover, remove only that consumer's superseded menu markup, positioning, outside-dismissal, keyboard, and menu-specific visual rules. Do not delete `styles/dropdown.css` or another legacy implementation while any out-of-scope consumer still uses it.

### View identity and navigation boundary

The following is a forward-compatibility contract for later view adoption, not authorization to build the future navigation module or a generalized centered-identity component in this package:

- A view definition must have schema headroom for a stable view icon, a long display name for classic centered identity, and a short display name for a view-home tab. Exact field names and the final component API are deferred until the next view-integration SPEC.
- Classic/no-tab chrome centers the long view identity and pairs it with the view icon using the same Workspace font/color family as the tab system. The final icon side, measurements, and reusable identity component are not settled here.
- A view-home tab uses the view icon and short view name. Document/resource tabs use their resource icon and resource label. This permits sequences such as `state.json | view.css | FILES`, where the first two are document tabs and `FILES` is the File view-home tab.
- Each view owns its transition policy between classic identity and tab mode. A shared tab component does not infer that policy from tab count alone.

The stable behavioral boundary is navigation ownership:

- A Workspace-owned slide-out sidebar sits outside the content surface and pushes/compresses that surface when opened. Sources in that sidebar may open or fill tabs; the File tree is the current example.
- Navigation rendered inside a view's content surface is content navigation. It compresses with that content and navigates the current view/tab rather than opening another tab; Wiki article navigation is the current example.
- Shared Workspace styling makes these regions visually coherent, but visual consistency does not erase their different navigation semantics.

Until the sidebar migration lands, the existing File tree retains its tab-opening behavior as an explicit transitional source even though its current React mount still lives under `FileExplorer`. This package does not relocate it or use its temporary DOM ownership to redefine it as Wiki-style content navigation.

Current per-view bindings are:

- **Files:** zero tabs preserves the existing classic no-tab content, with no tab strip and no `+`. Selecting the first File-tree item creates the first document tab and reveals the in-strip `+`. A later `+` creates or focuses the `FILES` view-home tab as defined above. The future centered long-name identity is schema direction only in this cycle.
- **Capture:** Capture has no sidebar tab source. Opening a captured document full screen does not itself create a tab. The already-wired `+` appears in that full-screen state; activating it retains the open document as a document tab, creates and focuses one `CAPTURE` view-home tab, and enters tab mode. Selecting a document from the Capture home opens it full screen by replacing that home tab in place. A later `+` creates a new `CAPTURE` home only when none exists; if one already exists, it focuses that tab instead of duplicating it. These are the binding interpretations of Universal B1, B3, B5, and B9.
- **Wiki:** Wiki navigation remains content navigation and changes the current article. Future Wiki tab adoption may keep a subtle `+` because an article is always open, but that behavior and its centered article-title identity are deferred to Wiki's integration SPEC.

The future Workspace-owned sidebar module, its push layout, and migration of current view-owned rails are explicitly outside this package. This SPEC must not structure tab adapters or CSS in a way that assumes every navigation source lives inside view content.

### Workspace Foreground

`--workspace-foreground-color` governs the ordinary state of:

- the workspace name, including any `Fusion Studio` or workspace-specific title shown in the header;
- ordinary upper-left, header-center, and upper-right Workspace icons;
- unselected left-rail view icons;
- machine-selector text and arrow;
- inactive tab labels and icons;
- tab dividers and ordinary tab-bar chrome; and
- the shared tab-bar add action in its ordinary state.

Moving the Workspace Foreground slider must update all of these live through the existing preview path and after persistence/reload.

### Workspace Accent

`--workspace-accent-color` is not a generic hover or selected-tab color. In this package it governs only:

- the currently selected left-rail view icon and its existing persistent selection marker; and
- the current Connected indicator.

The current connection-status logic remains unchanged. Its later reassignment from local Node/WebSocket status to Tailscale/remote-machine connectivity is deferred.

### Future remote-machine extension

When a remote machine is eventually active, the machine selector will retain a persistent Workspace Accent border. A local machine will not. The border will identify remote source selection, while the connection indicator will independently report remote transport health.

Do not implement remote selection, Tailscale state, or the future indicator semantics in this package. Do not structure the current selector CSS in a way that prevents a later explicit remote-state attribute from layering the Accent border over rest, hover, pressed, and focus.

## Theme and Interaction Token Contract

### Local-background derivation

Generic interaction feedback must derive from the local surface and its mode-aware contrast foreground, not from Workspace Accent or the theme's primary hue.

Publish the mode-wide values and one reusable interaction-context rule equivalent to:

```css
:root {
  --interactive-contrast-foreground: /* mode-aware foreground readable on the active mode */;
  --interactive-focus-ring: color-mix(in srgb, var(--interactive-contrast-foreground) 75%, transparent);
  --view-tab-rail-bg: var(--panel-chrome-bg);
}

.rv-interaction-context {
  --interactive-surface-bg: /* the actual local surface beneath this context's controls */;
  --interactive-hover-bg: color-mix(in srgb, var(--interactive-surface-bg) 92%, var(--interactive-contrast-foreground) 8%);
  --interactive-pressed-bg: color-mix(in srgb, var(--interactive-surface-bg) 88%, var(--interactive-contrast-foreground) 12%);
  --interactive-selected-bg: color-mix(in srgb, var(--interactive-surface-bg) 84%, var(--interactive-contrast-foreground) 16%);
}
```

The percentages above are normative initial values, not examples. A later visual-tuning package may change them centrally, but consumers must not substitute local percentages.

Each distinct participating surface applies the one `rv-interaction-context` utility and binds `--interactive-surface-bg` on that same element. CSS custom-property references are resolved where a derived property is declared; rebinding only `--interactive-surface-bg` on a descendant of a root-declared formula does not recompute that inherited formula. Therefore the hover, pressed, and selected declarations must remain on the reusable context rule, not on `:root` alone and not copied into consumers. Header controls and the machine selector use a header context bound to `--panel-chrome-bg`. The shell-owned universal tab bar is a separate context bound to `--view-tab-rail-bg`. Each shared menu surface applies the same context utility and binds it to its effective menu surface background.

For this package, `--view-tab-rail-bg` aliases `--panel-chrome-bg`. That is the explicit interim canonical rail surface selected for the shell host because the Universal SPEC adopts the existing File tab anatomy. Capture therefore adopts the shell rail surface when it moves out of the view body; this is an authorized hierarchy correction, not an accidental geometry redesign. Future work may retarget the alias centrally, but consumers must not override it per view.

`--interactive-contrast-foreground` is white for dark-mode surfaces and black for light-mode surfaces, using the same theme-luminance decision already used by the server generator and live preview. The baseline client fallback is the dark-mode value. The locally scoped hover, pressed, and selected expressions derive from each context's bound surface and that foreground exactly as shown above; the mode-wide focus ring derives from the same contrast foreground.

The baseline variables stylesheet publishes the root fallbacks/aliases and the single context rule. The persisted server-generated theme publishes the mode-correct `--interactive-contrast-foreground`, and the Theme Picker live-preview path sets and removes that same token with its other preview values. Because each surface binding and its derived expressions coexist on the same context element, changing that binding recomputes the local states. Persisted output and live preview must produce identical computed values. Generated machine-scoped `themes.css` remains output, not an independent source.

Do not globally replace every `--glass-sm`, `--glass-md`, or component-specific hover. Migrate only consumers covered by this SPEC and any shared selector whose only purpose is to provide the same Workspace interaction state.

Use CSS tokens and native state selectors for hover and brief press feedback. Do not add React state whose only purpose is reproducing `:hover` or `:active`.

### State model

For surface-bearing controls:

```text
rest -> hover -> pressed briefly -> hover/rest
```

For tabs, successful activation adds a separate persistent selected state:

```text
inactive rest -> hover -> pressed briefly -> selected
```

Normative precedence is:

1. disabled;
2. selected;
3. pressed;
4. hover;
5. rest.

Focus-visible is a separate accessibility layer and uses `--interactive-focus-ring`; it remains visible over hover, pressed, or selected styling. Workspace Accent must not be used as the focus ring. An open dropdown is not automatically styled as selected. The machine selector has no selected state.

### Visual families

Surface-bearing controls, including the machine selector and tabs:

- rest on their existing surface;
- use `--interactive-hover-bg` on hover;
- use `--interactive-pressed-bg` only during the brief pressed state;
- use Workspace Foreground at rest, then use `--interactive-contrast-foreground` for foreground content on both hover and pressed;
- use `--interactive-contrast-foreground` for selected-tab foreground content; and
- never use Workspace Accent merely because they are hovered or pressed.

Icon-only Workspace controls:

- use Workspace Foreground at rest;
- use the background-derived interactive foreground on hover;
- retain a transparent background on hover;
- do not use Workspace Accent for hover; and
- do not react to hover while disabled.

The selected left-rail view remains the explicit Accent exception.

These foreground transitions are unconditional. Consumers must not retain Workspace Foreground on hover/pressed or invent a contrast threshold. Consequently, the Workspace Foreground slider governs surface-bearing controls in rest/inactive state; their transient hover/pressed foreground and a selected tab's foreground remain mode-derived contrast values.

## Shared ViewTabBar Contract

Use the Universal SPEC's neutral shared location, `fusion-studio-client/src/components/view-tabs/`, and its three-part ownership model:

- `ViewTabBar` is the shell host mounted by `ContentFrame`. It receives the active panel ID, resolves the registered adapter, decides visibility, and supplies a stable programmatic focus fallback through the content shell.
- `ViewTabStrip` is the store-free presentational component. It receives descriptors and callbacks and owns tab DOM, accessibility, interaction states, and ordinary styling.
- `viewTabAdapters.ts` owns Capture/File store access, B1–B11 behavior, persistence/controller calls, labels, icons, opening, closing, selection, and add semantics.

`ViewTabBar` must not import Capture or File stores directly; it reaches them only through the adapter registry. `ViewTabStrip` must not import stores, controllers, panel state, WebSocket clients, or view-specific CSS.

The shared presentational component owns:

- the tablist and tab DOM structure;
- tab roles, `aria-selected`, roving tab focus, and keyboard activation/navigation;
- the ordinary icon, label, optional close action, and optional add action structure;
- inactive, hover, pressed, selected, and focus-visible styling;
- Workspace Foreground integration for inactive names, icons, dividers, and ordinary bar chrome;
- background-derived hover, pressed, and selected treatments;
- close-action reveal behavior;
- label clipping/fade and compact-density behavior currently required by the existing consumers; and
- the tab-bar stylesheet and semantic CSS variables.

Adapters supply only data and behavior, including a required tablist accessible label, stable tab ID, label, icon, active ID, selection callback, optional close callback and required accessible close label, optional add action with a required accessible label, and any adapter-specific focus fallback required when the strip unmounts.

Capture and Files do not render `ViewTabStrip` directly. They retain domain ownership through their adapters and controllers. The File add action follows Universal rule B11; Capture add placement and behavior follow Universal rules B1–B10.

### Normative tab DOM and keyboard contract

The tab rail uses a horizontal, manual-activation model:

| Input or transition | Required result |
|---|---|
| Initial entry by `Tab` | Focus the active tab. If tabs exist but no active tab is reported, focus the first tab. A zero-tab view has no tab rail in the keyboard order. |
| `ArrowRight` | Move focus to the next tab, wrapping from last to first. Do not activate it. |
| `ArrowLeft` | Move focus to the previous tab, wrapping from first to last. Do not activate it. |
| `Home` / `End` | Move focus to the first / last tab. Do not activate it. |
| `Enter` or `Space` on a tab | Activate the focused tab through the adapter and keep focus on it. |
| Pointer click on a tab | Activate and focus that tab. |
| `Delete` on a closable tab | Invoke its close action. A non-closable tab ignores `Delete`. |
| `Tab` from the roving tab | If it is closable, move to that tab's close action; otherwise move to the add action when present, then to the active tabpanel/content. Only the current roving tab's close action participates in sequential keyboard focus. Pointer users may reveal other close actions on hover. |
| `Shift+Tab` through rail actions | Reverse the same order: active tabpanel/content → add action when present → current close action when present → roving tab → the control preceding the rail. |
| Close the active focused tab | Close through the adapter, then activate and focus the previous tab when one exists, otherwise the next tab. |
| Close an inactive focused tab | Preserve the current active tab and visible content, then focus that active tab after the close commits. If no active tab remains, use the active-close recovery rule above. |
| Close causes the strip to disappear | Focus the stable `.rv-content-area` programmatic fallback (`tabIndex={-1}`), unless the adapter supplies a more specific visible focus target. Never leave focus in detached DOM. |
| Invoke add and a tab is created or deduplicated | Activate and focus the created or resolved existing tab after the adapter update commits. If the action creates no tab, focus remains on the add button. |

When at least one tab exists, the tablist sets `role="tablist"`, `aria-orientation="horizontal"`, and the adapter's required `aria-label`. Each tab is a native button with `role="tab"`, a shell-generated stable DOM ID, `aria-selected`, and `aria-controls` pointing to the active view body's shared tabpanel ID.

When the adapter reports at least one tab, `ContentFrame` wraps the active view body in a stable `.rv-view-tab-panel` with `role="tabpanel"`, the referenced ID, and `aria-labelledby` pointing to the active tab's DOM ID. The wrapper must preserve the existing content flex/min-size behavior. Give the wrapper `tabIndex={0}` only when its first meaningful content is not already keyboard focusable; otherwise normal document order moves focus to that first meaningful control.

When File has zero tabs, do not render the visual rail or any `role="tablist"`, `role="tab"`, or `role="tabpanel"` associated with it. The File tree's first successful selection creates the first document tab; only after that commit do the tablist/tabpanel relationships and in-strip add action mount.

A closable tab uses a presentation-only item wrapper containing the tab button and a sibling native close button; do not nest buttons or make the close button a descendant of the `role="tab"` element. The current roving tab's close button is the only close action in sequential focus; other close buttons remain pointer-operable and use `tabIndex={-1}`. A closable tab also exposes `aria-keyshortcuts="Delete"`. When tabs exist, the add action is a native button adjacent to, but not a tab inside, the `tablist`.

The close-button focus step is an explicit product extension to the base APG Tabs Pattern so the visible close action is keyboard reachable. It follows the W3C experimental Tabs With Action Buttons ordering (tab → associated action → panel/content), while the required tablist name, tab/tabpanel relationships, manual activation, arrows, Home/End, and focus recovery remain part of this normative contract. This deviation must be verified with macOS VoiceOver as well as ordinary keyboard focus.

Roving focus may use React state because it implements keyboard accessibility. The prohibition on React state applies only to cosmetic hover and brief press feedback, which remain native CSS `:hover` and `:active` states.

Disabled tabs are deferred until a real consumer requires them. Do not add a disabled-tab descriptor or map File loading to disabled-tab behavior in this package. Existing disabled close-button behavior while a File tab loads remains unchanged.

### Geometry preservation

This package does not redesign the Universal SPEC's strip geometry. Preserve the File-derived height, padding, radius, plus-button exception, close-action geometry, responsive capacity, and fade behavior pinned by the Universal SPEC and `file-viewer-tabs.spec.ts` while moving their ownership into `ViewTabStrip`.

Capture adopts that Universal geometry when its preliminary local strip is removed. This is already authorized by the Universal SPEC's file-anatomy contract and is not an open choice in this package. Where a genuine data-capacity difference cannot use the shared responsive behavior, preserve it through a narrowly named `ViewTabStrip` option rather than consumer-authored state CSS, add coverage for the option, and report the deviation.

The shell rail uses `--view-tab-rail-bg`, initially aliased to `--panel-chrome-bg` as defined above. That alias is the only permitted customization point; Capture/File adapters and view CSS must not choose separate rail backgrounds.

## Current Consumer Migration

### AI source selector

Migrate `AiSourceSelector` so that:

- its native `<select>` is replaced by an element-anchored shared radio menu;
- text and arrow use Workspace Foreground;
- hover uses the shared background-derived hover fill;
- `:active` uses the brief pressed fill;
- hover no longer recolors the border or text to Workspace Accent;
- focus-visible retains a distinct real outline and is not merged into hover;
- the current local option and disabled remote placeholder keep their behavior; and
- no selected or latched-open visual state is introduced.

### Header title and icon controls

Migrate the workspace title and ordinary header icons so that:

- rest uses Workspace Foreground;
- icon-only hover changes foreground through the background-derived interactive foreground while the background remains transparent;
- title/surface-bearing hover uses the shared hover fill where the existing hit area already behaves as a surface control;
- disabled icon buttons do not change on hover;
- no `transition: all` remains on migrated controls; and
- current 32px/18px upper-right geometry, 4px gap, and 8px trailing inset remain unchanged.

This includes header-center workspace navigation and upper-right header actions. Render the Workspace Controls action surface through the shared menu component, preserve the current action callbacks and results, and remove its superseded local action-menu lifecycle and item CSS after acceptance. Opening Fusion, Workspace theme, or the specialized Connectors surface must not have focus stolen back by action-menu teardown. Preserve the Connectors surface's own close and outside-pointer behavior through a narrowly owned listener rather than retaining a competing action-menu dismissal path. Do not otherwise change what header clicks do.

### Workspace Ribbon Add menu

Migrate only the Workspace Ribbon's Add menu to the shared component:

- keep the existing Add trigger, ribbon layout, and overlay behavior;
- render hidden workspaces as dynamic action items with their existing icons and add-to-ribbon result;
- retain the visible section label and the no-hidden-workspaces state through non-interactive shared descriptors;
- retain Add Project and Create New, their ordering/group separation, and their current modal results;
- keep the menu inside the viewport and restore focus to the Add trigger on cancellation; and
- remove the superseded Add-menu DOM, positioning, outside-click listener, and dedicated action-row styling after the shared path passes.

### Left navigation rail

Migrate ordinary rail icons so that:

- rest uses Workspace Foreground;
- hover uses the background-derived interactive foreground;
- the hover background remains transparent;
- the selected view icon and existing selection marker use Workspace Accent; and
- the 40px target and 24px glyph geometry remain unchanged.

### Capture and File tabs

Complete or consume the Universal SPEC's shell-hosted migration: remove the Capture-specific tab renderer and the File viewer's local `TabRow`/tab-strip rendering; route both through their adapters into the shared `ViewTabBar`/`ViewTabStrip` contract. Do not mount the shared strip from `CaptureTiles`, `DocViewerHeader`, `FileViewer`, or any other view branch.

Both consumers must then provide identical state semantics:

- inactive names, file/view icons, dividers, and ordinary strip actions use Workspace Foreground;
- hover uses the same fill and foreground language as the machine selector;
- pressing uses the same brief pressed language as the machine selector;
- selected uses the stronger background-derived selected fill and contrast foreground;
- selected does not use Workspace Accent;
- a hovered inactive tab does not look selected;
- focus remains visible;
- close actions retain their behavior; and
- existing responsive labels, fade, compact behavior, and add-button geometry remain operational.

The Universal SPEC remains authoritative for Capture tab persistence and B1–B10, plus placement, and adapter/controller routing. File visibility and B11 behavior use the explicit zero-tab and view-home overrides in this SPEC, including pathless view-home persistence exclusion. “Retain behavior” in this section means retain the resulting combined contract, not preserve preliminary or no-op current code.

Remove or narrow machine-scoped and bundled selectors that would override this contract after the shared component is mounted. Do not leave parallel Capture/File tab-state definitions active.

## Implementation Slices

### Slice WCI.1 — Theme and Workspace shell states

1. Publish the shared background-derived hover, pressed, selected, and contrast-foreground contract through baseline variables, persisted theme generation, and live preview as required by the current cascade.
2. Apply the trigger-state contract to the AI source selector and upper-right Workspace Controls trigger without changing their menu implementation in this slice.
3. Migrate header title/navigation/actions and the left rail.
4. Preserve the two explicit Accent consumers: selected rail view and Connected.

**Gate:** dark and light themes produce complementary background-derived states; Workspace Foreground and Accent sliders update their assigned shell elements live; disabled/focus behavior passes inspection; the client build and UI-chrome stale-selector sweep pass before WCI.2 begins.

### Slice WCI.2 — Bounded Workspace menus

#### WCI.2A — Header menus

1. Migrate the AI source selector to an element-anchored shared radio menu while keeping the current local/disabled-remote behavior and existing workspace-store ownership.
2. Migrate the Workspace Controls action menu while preserving its current callbacks and destination-surface focus.
3. Narrow or relocate the old header outside-pointer listener so it owns only the specialized Connectors surface after shared action-menu dismissal replaces the old path.
4. Delete the replaced native-selector/action-menu markup, local action-menu state/listeners, positioning, and dedicated item styles; retain code and CSS still used by the Connectors surface or out-of-scope dropdowns.

**Gate:** run the client build and the focused public-entry `e2e/workspace-header-menus.spec.ts` suite through `playwright.office.config.ts`, whose isolated multi-workspace fixture prevents the test from reading or mutating the developer's port-3001 workspace state. Broaden that config's `testMatch` only enough to include the two named Workspace-menu suites. The suite must operate the visible header triggers and prove radio/disabled semantics, trigger `aria-expanded`, roving keyboard behavior, Escape/Tab/outside dismissal, all-corner placement, destination focus, current action results exactly once, unmount/replacement cleanup, the independent Connectors close/outside path, and computed hover/pressed/focus-ring values from the menu surface's effective background in dark and light modes. A stale-symbol sweep must prove the replaced header menu paths and isolated `--interactive-surface-hover` lookup are gone without reporting out-of-scope `dropdown.css` consumers as failures.

#### WCI.2B — Workspace Ribbon Add menu

1. Extend the shared descriptor and renderer contracts only with the non-interactive heading and status/empty-state forms required by the existing Add menu.
2. Migrate the Add menu through its visible Ribbon trigger while leaving the Ribbon overlay, grid, workspaces, removal, dragging, scrim, and modals under their existing owners.
3. Delete the replaced Add-menu DOM, local open/outside lifecycle, positioning, and dedicated action-row styles after the shared path passes.

**Gate:** run the client build, the cumulative shared-menu contract suite, and the focused public-entry `e2e/workspace-ribbon-add-menu.spec.ts` suite through the same isolated `playwright.office.config.ts` fixture. The tests must cover hidden-workspace and zero-hidden-workspace states, non-focusable heading/status content, Add Project, Create New, add-to-ribbon behavior, Escape/Tab/outside dismissal, trigger focus recovery, Ribbon-close/unmount cleanup, all-corner placement, computed hover/pressed/focus layering, and exactly-once results. Re-run the accepted Office shared-menu suites because descriptor discrimination, generic rendering, and canonical interaction-token consumption changed. A stale-symbol sweep must prove the old Add-menu renderer/lifecycle/styles are gone while the specialized Ribbon remains.

### Slice WCI.3 — Shared tab component

1. Complete or consume the Universal SPEC's `ViewTabBar`, `ViewTabStrip`, adapter registry, controller routing, persistence, placement, and B1–B11 behavior.
2. Apply this SPEC's shared DOM, ARIA, keyboard, close/add focus, responsive, fade, and interaction-state contract to `ViewTabStrip`.
3. Convert Capture to its Universal adapter; remove all view-local strip mounting.
4. Convert Files to its Universal adapter; remove local `TabRow`, local strip mounting, and the no-op add action.
5. Move the shared geometry and responsive selectors into the shared stylesheet, update the pinned tests to follow that ownership, and remove or narrow superseded consumer, bundled, and machine-scoped tab-state CSS.

**Gate:** the Universal prerequisite, including §4.1 path actions, is complete or included; Capture and Files use the shell-owned host and the same presentational component and computed state tokens; the combined B1–B11 overrides, File's classic zero-tab/no-`+` state, Capture's full-screen-document `+` transition, persistence, placement, keyboard/focus, and responsive behavior pass; and no active consumer CSS redefines tab geometry or hover/pressed/selected colors.

## Verification and Acceptance

### Required verification

1. Run `npm run build` in `fusion-studio-client/`.
2. From `fusion-studio-server/`, run `npm test -- --runInBand test/theme/panel-surfaces.test.js`. The focused test must assert dark and light `--interactive-contrast-foreground` output and must remain the only WCI-owned server-test delta.
3. From `fusion-studio-client/`, run `npx playwright test --config=playwright.office.config.ts e2e/workspace-header-menus.spec.ts e2e/workspace-ribbon-add-menu.spec.ts e2e/shared-menu-component.spec.ts e2e/office-shared-menu.spec.ts --project=chromium --workers=1`. Add the two focused Workspace-menu files and broaden only this isolated config's `testMatch` to include them. This command owns the Workspace, shared-menu, and Office menu-regression gate.
4. Separately, from `fusion-studio-client/`, run `npx playwright test e2e/captures-archive.spec.ts e2e/clipboard-capture.spec.ts e2e/file-viewer-tabs.spec.ts --project=chromium`. This command owns the existing port-3001 Capture/File regression gate. Do not combine it with the isolated Office-fixture command or point `clipboard-capture.spec.ts` at the Office fixture port. Update relocation assertions to inspect shared hosts/components/stylesheets while preserving behavioral and geometry coverage; do not delete assertions merely because consumer-owned symbols disappear. Fail either gate if any named selection matches zero tests.
5. Confirm the Universal prerequisite's complete verification record is still valid, including §4.1 path-action migration and its source sweep. If the prerequisite is implemented in the same package or has changed since its last accepted evidence, rerun the full Universal verification matrix rather than only the three tests named above.
6. Exercise a dark and a light theme through live preview, cancel or restore the preview afterward, and confirm the owner's saved configuration and generated theme file are unchanged unless the implementation intentionally persists a test theme with prior authorization.
7. Inspect computed styles for the machine selector, workspace title, header-center icons, upper-right enabled/disabled icons, the three bounded Workspace menu surfaces, unselected/selected rail icons, and inactive/hovered/pressed/selected Capture and File tabs. The rail and shared tabs currently have no disabled product state; do not add one merely to satisfy verification.
8. Confirm the normative computed mixes: hover 8%, pressed 12%, and selected 16% from each control's same-element interaction-context binding toward the mode-correct contrast foreground; confirm the focus ring is derived from interactive contrast, not Workspace Accent. A descendant-only rebinding of `--interactive-surface-bg` with formulas inherited from another surface fails this check.
9. Confirm the machine selector, title/surface controls, and inactive tabs use Workspace Foreground only at rest and switch unconditionally to `--interactive-contrast-foreground` on hover/pressed; selected tabs also use that contrast foreground.
10. Confirm the shell tab rail computes `--view-tab-rail-bg` and `--interactive-surface-bg` from `--panel-chrome-bg` for both Capture and Files, with no per-view background override.
11. Move Workspace Foreground live and confirm every Foreground consumer changes in its rest/inactive state while selected rail Accent and Connected retain Accent ownership.
12. Move Workspace Accent live and confirm only the selected rail view, its marker, and Connected change within this package.
13. Walk every row of the normative tab keyboard table for Capture and Files, including wrapping, Home/End, manual activation, `Delete`, sequential close/add focus, active-tab previous-first recovery, inactive-close selection preservation, final-close strip-unmount fallback, and add-created/deduplicated focus. Repeat the semantic name/relationship and focus-order walk with macOS VoiceOver; confirm File exposes no tab rail semantics at zero tabs, then mounts a labeled tablist and tabpanel after the first File-tree selection.
14. Verify keyboard focus and activation for the selector, Workspace Controls menu, Workspace Ribbon Add menu, header controls, rail controls, tab close actions, and the tab add action. For each bounded Workspace menu, verify trigger semantics, initial/roving focus, Enter/Space activation, Escape and Tab behavior, outside-pointer dismissal, focus return, disabled items, all viewport corners, and exactly-once action results. Confirm the Add menu's heading and empty state never enter the roving focus order.
15. Walk the combined Universal/WCI rules B1–B11, including Capture's no-tab full-screen document, its already-wired `+`, CAPTURE-home create-or-focus/replace behavior, restart persistence, File's existing classic zero-tab content with no strip or `+`, first-selection tab creation, File view-home create-or-focus/fill behavior, and pathless view-home persistence exclusion.
16. Verify Capture and Files retain selection, closing, compact labels, fades, resize behavior, and the File-derived shared geometry.
17. Search the active cascade for superseded consumer tab selectors, view-local tab mounting, fixed Accent hover dependencies, per-view rail backgrounds, and `transition: all` on migrated controls. Confirm no active consumer CSS redefines shared tab geometry or hover/pressed/selected colors.

### Terminal acceptance

- Generic hover, pressed, and selected-tab states derive from local background/contrast rather than Accent.
- Workspace Accent affects selected rail view and Connected, not generic interaction or selected tabs.
- Workspace Foreground affects ordinary icons, workspace title, machine-selector contents, inactive tab names/icons, tab dividers, and ordinary tab-bar chrome.
- Machine selector hover and pressed feedback match the tab interaction language and it has no selected state.
- The AI source selector, Workspace Controls action menu, and Workspace Ribbon Add menu render through the completed shared menu component with their existing availability and results preserved.
- The shared menu component derives hover and pressed fills from its effective local surface through the canonical interaction contract, exposes a distinct visible focus ring, and no longer depends on the isolated `--interactive-surface-hover` lookup.
- The Ribbon Add menu preserves its visible grouping and empty-state communication without making non-actions keyboard menu items.
- The Connectors surface and Workspace Ribbon remain specialized; no content/view menu is migrated by this package.
- The bounded menu migrations add no new user action, protocol route, durable/global state, duplicate state owner, or consumer-specific dependency inside the portable menu component.
- Icon-only Workspace hover remains transparent and does not use Accent.
- Capture and Files render through one reusable ViewTabBar.
- `ContentFrame` owns the only `ViewTabBar` mount; Capture and Files provide adapters and do not mount tab DOM.
- New view authors can supply tab descriptors/callbacks without recreating tab interaction CSS or markup.
- Horizontal roving focus, manual activation, `Delete`, close recovery, add focus, absence of zero-tab rail semantics, tab/tabpanel relationships once populated, VoiceOver semantics, and strip-unmount fallback match the normative keyboard/DOM contract.
- Dark/light, live-preview, persisted-theme, existing disabled controls, focus, hover, pressed, and selected checks pass.
- Existing geometry and behavior outside the stated state migration remain unchanged.
- The Universal prerequisite, including §4.1 path actions, is complete; the combined B1–B11 overrides, File's classic zero-tab/no-`+` state, Capture's full-screen-document `+` transition, and the three named Playwright regression files pass after assertion migration.
- Client production build succeeds.

## Deferred Work

This SPEC intentionally does not implement or settle:

- remote-machine selection and Tailscale connectivity;
- removal or semantic reassignment of the current local Connected indicator;
- the future remote-selector Accent border beyond preserving an extension point;
- thread-panel or chat-panel redesign;
- composer/provider-selector migration outside any token foundation strictly needed here;
- any menu-component re-extraction, site-wide menu adoption, or migration beyond the three named Workspace consumers;
- the remaining view-building components such as a general ViewNavBar or DocumentSurface component;
- any later reassessment or retargeting of the current canonical `--view-tab-rail-bg: var(--panel-chrome-bg)` alias;
- disabled-tab descriptors and styling until an actual view supplies a disabled tab state;
- unresolved global control padding/radius/fade measurements;
- unrelated `--glass-*` cleanup; or
- specialized editor, drag, destructive, color, table, browser-tab, or status interactions.

## Implementer Handoff

Before editing, re-read the repository `AGENTS.md`, this SPEC, `UNIVERSAL_VIEW_TAB_BAR_SPEC.md`, `STYLE_GUIDE.html`, and the current dirty-worktree diff for every affected file. Treat generated `themes.css` as output of the server theme generator rather than an independent source file. Preserve concurrent menu, Capture, File viewer, header, theme, and style-guide work.

The final implementation report must include:

- tokens introduced and their dark/light derivation;
- the shared ViewTabBar API and ownership boundary;
- how the implementation satisfied Universal B1–B11, adapter, persistence, placement, and focus-fallback requirements;
- shell and view consumers migrated;
- the three Workspace menu consumers migrated, any shared descriptor extension, and the obsolete local menu code/styles removed;
- the existing store/action owner retained for every migrated command and confirmation that no protocol, service, persistence, or duplicate-state path was added;
- one-sentence responsibilities for every changed shared-menu file and any required split where a file would otherwise combine jobs or exceed the Code Standards guidance;
- selectors removed or intentionally retained;
- all files changed;
- computed-style and live-slider results;
- the normative keyboard-table and responsive-tab results;
- the two focused Workspace-menu, shared/Office menu-regression, and three Capture/File Playwright results, including any assertion relocations;
- exact build/test commands, pass/fail results, durations, warnings classified as pre-existing or new, and residual untested risk; and
- every deviation from this SPEC, including whether it affects later remote-machine, menu, geometry, ViewNavBar, or DocumentSurface work.
