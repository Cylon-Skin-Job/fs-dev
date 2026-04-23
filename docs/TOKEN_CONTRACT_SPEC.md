# Token Contract — Spec

**Status:** Draft — ready for handoff.
**Owner:** Open Robin core.
**Depends on:** `STATE_OVERRIDE_SPEC` (paradigm), per-view theme override loader landed in `useSharedWorkspaceStyles` and per-view-theming retirement commit.
**Precedes:** `THEME_PICKER_SPEC` (future — the header color picker + SQLite theme slugs target this contract).
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.

---

## 1. Purpose

Lock the canonical CSS custom-property surface that a theme may change, vs. the surface a theme may **not**. This is the "CSS API" the future header color picker writes against. Without a contract, each theme change risks either:

- Being too powerful (picker writes a neutral grey → breaks the app's ability to have an inset panel contrast) or
- Being too weak (picker writes the accent → scrollbars stay whatever hardcoded legacy value someone missed)

The contract names every theme-editable token, forbids writes to the rest, and defines the cascade precedence so per-view overrides are predictable.

---

## 2. Non-goals

- **No SQLite schema here.** That's `THEME_PICKER_SPEC`. This doc defines what a slug *contains*, not how it persists.
- **No UI.** The picker lives in a later spec.
- **No migration of existing hex literals.** Extraction tiers B / A-* already retired the bypasses. A tiny residual lives in `variables.css` as *factory* token definitions (see §3a) — those are deliberate.
- **No typography or animation surface in v1.** A later "typography contract" can extend this with font-family / font-weight tokens. Transitions + durations likewise.

---

## 3. Three tiers

### 3a. Neutrals + system (never theme-editable)

Defined in `open-robin-client/src/styles/variables.css`. Bundled with the app; the theme picker must never write these.

- **Luminance neutrals:** `--bg-solid`, `--document-surface-bg`, `--document-code-bg`, `--sidebar-surface-bg`, `--chat-surface-bg`, `--panel-chrome-bg`
- **Text hierarchy:** `--text-white`, `--text-primary`, `--text-secondary`, `--text-dim`, `--text-subtle`
- **Neutral chrome border:** `--neutral-chrome-border`
- **Status semantics:** `--status-ok`, `--status-error`
- **Scrollbar:** `--scrollbar-track`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`
- **Syntax highlighting:** `--token-keyword`, `--token-string`, `--token-number`, `--token-comment`, `--token-function`, `--token-class`, `--token-variable`, `--token-operator`, `--token-punctuation`
- **Layout/sizing:** `--header-height`, `--tools-width`, `--sidebar-width`, `--chat-width`, `--chat-header-height`
- **Z-index stack:** `--z-content`, `--z-gutter`, `--z-inline`, `--z-panel`, `--z-overlay`, `--z-modal`, `--z-tooltip`, `--z-system`
- **Spacing scale:** `--space-2xs`, `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`, `--space-2xl`
- **Font sizes:** `--font-2xs` through `--font-2xl`
- **Radius:** `--radius-sm`, `--radius-md`, `--radius-lg`

Rationale: these are structural. Changing `--sidebar-surface-bg` from `#161616` to white breaks every subsequent tint (`color-mix` assumes dark luminance); changing `--z-modal` breaks stacking; changing traffic-light values breaks platform idiom. None of these are theming concerns — they're system invariants.

### 3b. Theme-editable (the contract)

Defined in `ai/views/settings/themes.css`. The picker writes this file. §4 enumerates the exhaustive list.

### 3c. Per-CLI and per-agent brand colors (cli.json + settings/styles.css)

- `--cli-accent` — set per-thread by `useCliAccentStyle()` based on the thread's harness ID + any user override in `cli.json` (CLI_CONFIG_SPEC).
- `--tile-color`, `--agent-color` — set per-agent from inline style in `AgentTiles.tsx` based on each agent's declared color in its `settings/styles.css`.

These are **not in the theme contract** — they're per-item, not per-workspace. Theme picker never touches them.

---

## 4. Theme-editable token list (the contract)

Every token listed here may be written by the theme picker. The picker must not emit any property outside this list.

### 4a. Accent family (required)

Every theme slug MUST supply all five:

| Token | Type | Purpose |
|-------|------|---------|
| `--theme-primary` | hex `#RRGGBB` | Workspace accent color. Consumed by sidebar-header text, chat-header identity highlights, file-tree active states, etc. |
| `--theme-primary-rgb` | `R, G, B` | Same color as comma-separated RGB channels, for `rgba(var(--theme-primary-rgb), X)` consumers. |
| `--theme-border` | rgba | Accent border at ~38% alpha — panel outer border, focus rings, tool-btn active indicator. |
| `--theme-border-glow` | rgba | Accent border at ~68% alpha — scrollbar thumb hover (global fallback only), focus glow. |
| `--ws-primary` | alias `var(--theme-primary)` | Kept as the shorter name many CSS consumers use. Generator always emits this as `var(--theme-primary)` — never a literal. |

`--ws-primary-rgb` likewise aliases `--theme-primary-rgb`.

**Derivation rule:** the picker takes ONE hex input. `-rgb` is derived by splitting channels; `-border` and `-border-glow` are `rgba(…, 0.38)` and `rgba(…, 0.68)` respectively. The user picks one color; the picker writes all five consistently.

### 4b. Workspace chrome fills (required)

| Token | Type | Purpose |
|-------|------|---------|
| `--ws-sidebar-bg` | hex | Tinted background for workspace-identity surfaces (wiki topic list, issues card column). Distinct from the structural neutral `--sidebar-surface-bg` which stays grey. |
| `--ws-content-bg` | hex | Content-area tinted background (wiki page viewer). |
| `--ws-panel-border` | rgba | Accent-tinted hairline used where a panel cares about workspace identity (wiki/tickets card borders). |

**Derivation rule:** the picker derives these from the accent by mixing with the luminance base:

```
--ws-sidebar-bg  = color-mix(in srgb, #0d0d0d 92%, <accent> 8%)
--ws-content-bg  = color-mix(in srgb, #0d0d0d 96%, <accent> 4%)
--ws-panel-border = rgba(R, G, B, 0.20)
```

The picker may allow per-field override, but the default flow is single-pick-derives-all.

### 4c. Optional extensions (forward-compatible)

The contract reserves but does not require these names. A future theme may populate them; consumers default when absent. The picker SHOULD emit them in slugs but MAY leave them at their variables.css defaults.

| Token | Type | Default | Purpose |
|-------|------|---------|---------|
| *(none in v1)* | — | — | Reserved for future expansion: typography, transitions. |

### 4d. Tokens the contract explicitly excludes

These live in `variables.css` and MUST NOT be written by any theme:

- Any `--bg-*`, `--panel-chrome-bg`, `--sidebar-surface-bg`, `--chat-surface-bg`, `--document-*-bg` (luminance floor)
- Any `--text-*` (hierarchy contract — changing these breaks contrast assumptions)
- `--neutral-chrome-border` (structural hairlines, always neutral)
- `--status-ok`, `--status-error` (semantic, platform-like)
- `--scrollbar-*` (recede, never accented — intentional design decision)
- `--token-*` (syntax highlighting — out of v1 theming scope; a "syntax theme" could be a separate slug later)
- `--space-*`, `--font-*`, `--z-*`, `--radius-*`, sizing vars (structural, invariant)

---

## 5. Cascade

Precedence from low to high:

1. **Factory defaults** — `variables.css` defines every token with cyan fallback values. Bundled, always loaded first.
2. **Workspace theme** — `ai/views/settings/themes.css` overrides `--theme-primary` + accent family + chrome fills for the whole workspace. Loaded globally by `useSharedWorkspaceStyles`.
3. **Per-view theme** — `ai/views/<view>/settings/themes.css` if present, scoped to `[data-panel="<view>"]` by `useViewLayoutStyles`. Overrides only the tokens the file explicitly sets; unspecified tokens fall through to workspace.

CSS cascade handles precedence via load order + selector specificity — no JS merge, no SQLite resolver on the client.

Per-view files may contain ANY subset of the theme-editable tokens (§4). Files that include tokens from §3 are not rejected, but the picker won't write them and human-authored files doing so is flagged as out-of-contract in a lint (future).

---

## 6. Slug schema

A **theme slug** is the structured data the SQLite row stores. A slug renders deterministically to one `themes.css` file.

```jsonc
{
  "id":          "arctic-blue",       // slug — lowercase kebab, unique
  "label":       "Arctic Blue",       // display name
  "description": "Cool cyan on deep charcoal",

  // Accent family — user picks ONE hex; derivations computed at write time.
  "accent":      "#00d4ff",

  // Chrome fills — EITHER derived from accent (default) OR explicit overrides.
  "sidebarBg":   null,                 // null → derive; hex → use literal
  "contentBg":   null,
  "panelBorder": null,

  // Metadata
  "builtin":     true,                 // shipped with the app, cannot be deleted
  "active":      false                 // exactly one row has active: true
}
```

**Derivation at render time** — when the app writes `themes.css` from a slug:

```css
:root {
  --theme-primary:      <accent>;
  --theme-primary-rgb:  <R, G, B from accent>;
  --theme-border:       rgba(<R>, <G>, <B>, 0.38);
  --theme-border-glow:  rgba(<R>, <G>, <B>, 0.68);
  --ws-primary:         var(--theme-primary);
  --ws-primary-rgb:     var(--theme-primary-rgb);

  --ws-sidebar-bg:      <sidebarBg if set, else color-mix 92/8 with accent>;
  --ws-content-bg:      <contentBg if set, else color-mix 96/4 with accent>;
  --ws-panel-border:    <panelBorder if set, else rgba(R, G, B, 0.20)>;
}
```

Every slug produces a complete, valid `themes.css` — no partial slugs, no missing tokens.

---

## 7. Write flow

The picker's write lands in TWO places:

1. **SQLite row** — canonical source of truth. Stores the slug. Survives workspace wipes.
2. **`ai/views/settings/themes.css`** — generated from the active slug. This is what the CSS cascade actually reads.

When the user picks a new theme (slug) or edits the active accent:

1. Server updates/inserts the slug row.
2. Server marks it `active: true`; clears any prior `active` row.
3. Server regenerates `ai/views/settings/themes.css` from the active slug (§6 derivation).
4. Server emits a WS event so every open client reloads shared styles via `resetSharedStyles()`.

**Invariant:** the file is always derived. Hand-edits to `ai/views/settings/themes.css` survive until the next theme-picker write, then get overwritten. Power users who want permanent customization drop a **per-view** `themes.css` override — that path is never touched by the picker.

---

## 8. Per-view override semantics

Per-view `ai/views/<view>/settings/themes.css` works exactly like today (loader already wired):

```css
/* Example: wiki-viewer wants a blood-red accent. */
:root {
  --theme-primary:     #8B0000;
  --theme-primary-rgb: 139, 0, 0;
  --theme-border:      rgba(139, 0, 0, 0.38);
  --theme-border-glow: rgba(139, 0, 0, 0.68);
  /* Chrome fills inherit from workspace — only accent diverges. */
}
```

The loader injects this scoped to `[data-panel="wiki-viewer"]`, so only that panel's `--theme-primary` is redefined. Everything else stays workspace-default.

**Rule of thumb:** write only the tokens you want to diverge. `themes.css` is not required to be exhaustive at the per-view level.

---

## 9. Validation (advisory — not enforced in v1)

Picker-written files should pass:

- Every `--theme-*` and `--ws-*` token present
- Accent hex matches `/^#[0-9a-fA-F]{6}$/`
- Derivations match the expected formulas (§6)
- No tokens outside §4 are emitted

Per-view files have no requirements. Users may hand-author them with any subset; the cascade handles the rest.

A lint pass can check these after implementation (out of scope here).

---

## 10. Files changed (by this spec → informational, no code touches yet)

| File | Action |
|------|--------|
| `docs/TOKEN_CONTRACT_SPEC.md` | new (this doc) |
| `ai/views/settings/themes.css` | already in shape; comment header updated to name the contract it satisfies (quick follow-up) |

No code changes land from this spec alone. Implementation lands in the picker spec.

---

## 11. Rollout

This is a documentation-only commit. No runtime behavior changes.

**When the picker spec lands**, it will consume this contract. The contract is the lock.

Suggested sequence:
1. **(This commit)** Token contract doc + header comment on `themes.css` pointing at it.
2. **(Next)** `THEME_PICKER_SPEC` — SQLite schema, picker UI in header, WS round-trip for activate/preview, file-regeneration path.
3. **(Next-next)** Picker implementation.
4. **(Optional, later)** Lint rule enforcing §9.

---

## 12. Open questions

1. **Consolidation candidates in `variables.css`.** Five legacy tokens — `--color-primary`, `--color-secondary`, `--border-primary`, `--border-glow`, `--glass-bg` — duplicate the accent family with cyan-literal rgba values. If they still have consumers, they should be rewritten to `rgba(var(--theme-primary-rgb), X)`. If orphaned, delete. Not a blocker for this spec; flag for an extraction pass before the picker lands.
2. **Chrome-fill derivation percentages.** `color-mix 92/8` and `96/4` are proposals. If the picker's output feels too muted at blend, tune these. Per-theme override possible via the explicit `sidebarBg`/`contentBg`/`panelBorder` slug fields (§6).
3. **Typography contract.** If we add `--font-body`, `--font-mono`, `--font-ui` per theme later, they join §4c as a second required block and §8 gets an example.
4. **Syntax-theme slugs.** Tokenized already (variables.css §3a), but not theme-controlled in v1. Could become its own slug category (e.g., `syntax_themes` table), keyed independently so users can pair any workspace theme with any syntax theme.
5. **Light themes.** The structural neutrals (§3a) are dark-assumed (`#161616`, etc.). A light theme would need to override those, which the contract forbids. Two paths:
   - (a) A separate "luminance scheme" track (light/dark) layered above themes — swaps the neutral floor.
   - (b) Accept that v1 is dark-only; defer light mode.
   Proposal: (b) — land the picker on dark first.

---

## 13. Acceptance

- The active `ai/views/settings/themes.css` in the repo contains only tokens from §4 (accent family + chrome fills). No tokens from §3 (neutrals, text, status, scrollbar, syntax, layout) appear in it.
- A per-view `themes.css` override file can contain any subset of §4 tokens; the CSS cascade correctly applies it inside `[data-panel="<view>"]` only.
- A theme slug structured per §6 can be hand-rendered to `themes.css` and produce output byte-equivalent to what the picker would emit.
- `grep -n "var(--theme-primary\|--ws-primary)" open-robin-client/src ai/views` returns the expected consumer surface; nothing uses `--color-primary` or similar legacy names (tracking §12.1 follow-up).
- The picker spec, when written, can reference "§4 of TOKEN_CONTRACT_SPEC" for its complete write surface without restating it.

---

/Users/rccurtrightjr./projects/open-robin/docs/TOKEN_CONTRACT_SPEC.md
