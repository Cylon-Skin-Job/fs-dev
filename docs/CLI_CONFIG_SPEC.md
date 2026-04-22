# CLI Config — Spec

**Status:** Draft — ready for handoff.
**Owner:** Open Robin core.
**Supersedes:** `docs/CLI_COLOR_OVERRIDE_SPEC.md` (SQLite + WS round-trip approach). This spec replaces the color-override feature and extends it to cover display name, icon, and picker visibility.
**Code standards:** `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`.
**Related:**
- `docs/CLI_IDENTITY_SPEC.md` (landed) — established the `--cli-accent` CSS variable and the five surfaces that consume it.
- `docs/STATE_OVERRIDE_SPEC.md` (draft) — establishes the override-by-duplication paradigm this spec reuses verbatim for `cli.json`.
- `docs/HARNESS_STATUS_CACHE_SPEC.md` (draft) — orthogonal; installation status stays in SQLite.

---

## 1. Purpose

Replace the SQLite-backed per-CLI color override with a JSON file the user can edit directly. Extend the scope beyond color to cover every display property of a CLI: visibility in the picker, display name, icon, and accent color. Follows the same override-by-duplication paradigm as `state.json` (see `STATE_OVERRIDE_SPEC.md` §3).

**Novice-facing story:** "Want Qwen to be lavender? Edit `cli.json`, change one hex. Want to hide Gemini from the dropdown? Flip `enabled: false`. Want to rename Qwen to 'Jason' with a surfboard icon? Change two strings."

**Power-user story:** the JSON handles the skin. To go further (swap the underlying model, change the system prompt, point at a different endpoint), the user modifies the harness internals — which remains outside this spec's scope.

**Why we're pivoting from the SQLite approach:**
- The SQLite work landed the service/broadcaster/router/migration but never landed a UI to drive them. Feature is unusable today.
- A JSON file is simpler to implement, consistent with the `STATE_OVERRIDE_SPEC` paradigm, and editable by hand — which matches the "nerd-friendly customization" Open Robin design intent.
- Eliminates a WS round-trip (`harness:theme:get/set/reset`), a broadcaster, a hydration hook, and a timing-sensitive `wireReady` race.

---

## 2. Non-goals

- **No new UI.** The existing CLI picker and Robin CLI-details pane render the merged config automatically. No settings screen in this spec.
- **No per-CLI-scoped system prompt or endpoint fields.** The JSON controls display only (`enabled`, `name`, `icon`, `accentColor`, `order`). Model/endpoint/prompt live in the harness implementation.
- **No hot reload.** `cli.json` is read on server startup. Hot reload lives under SPEC-30 once it ships and will pick up `settings/` files uniformly.
- **No migration of existing SQLite `harness_theme` rows** to the JSON file. The SQLite table gets dropped; any user who customized during the brief window this was live (there's no UI, so this should be zero users) can manually re-enter in `cli.json`.
- **No per-view CLI UI.** The per-view override file path is part of the paradigm (see §4b), but is intentionally undocumented in the UI — it exists for power users who explore the filesystem.

---

## 3. The paradigm

Identical to `STATE_OVERRIDE_SPEC` §3:

```
ai/views/settings/cli.json              ← workspace default (user-editable)
ai/views/<view>/settings/cli.json       ← optional per-view override (power-user escape hatch)
```

**Factory source:** `HARNESS_OPTIONS` in `open-robin-client/src/config/harness.ts` is the canonical catalog. The server reads this list (mirrored server-side — see §7) and merges the workspace `cli.json` over it, then optionally merges a per-view `cli.json` on top.

**Precedence** (low to high):
1. Factory catalog (`HARNESS_OPTIONS`)
2. Workspace `ai/views/settings/cli.json`
3. Per-view `ai/views/<view>/settings/cli.json` (if present)

**Merge semantics:** deep merge per CLI id. Keys absent from the override inherit from the level below. An explicit `null` in the override replaces the inherited value (matches `STATE_OVERRIDE_SPEC` §6 clamp).

**Unknown CLI ids:** if `cli.json` contains a CLI id that doesn't exist in the factory catalog, the resolver ignores it with a warning. The JSON cannot introduce a new CLI; it can only customize ones that exist.

---

## 4. File layout

### 4a. Workspace default

**Path:** `ai/views/settings/cli.json`

Created on server startup if missing. Initial contents:

```json
{}
```

An empty object means "inherit everything from the factory catalog." The user edits this file to customize; the file is not pre-populated with factory values. Keeping it empty makes it obvious at a glance which CLIs have been customized.

### 4b. Per-view override

**Path:** `ai/views/<view>/settings/cli.json`

Never created by the server. A power user discovers this path by analogy with state/styles and drops one in by hand. Rare in practice; the paradigm supports it so the mental model stays consistent across `state`, `cli`, and `styles`.

### 4c. Retired paths and tables

All of the following are deleted by the migration (§10):

- SQLite table `harness_theme`
- Migration `open-robin-server/lib/db/migrations/011_harness_theme.js`
- Module `open-robin-server/lib/harness/harness-theme-service.js`
- Module `open-robin-server/lib/ws/harness-theme-broadcaster.js`
- WS message types `harness:theme:get`, `harness:theme:set`, `harness:theme:reset`, `harness:theme_state`, `harness:theme_changed`, `harness:theme_error`
- Client module `open-robin-client/src/lib/ws/harness-theme-handlers.ts`
- Client hook `open-robin-client/src/hooks/useHarnessThemes.ts`
- Store slot `panelStore.harnessThemes` (replaced — see §8)
- Startup wiring block at `open-robin-server/lib/startup.js:§3.7c`
- Any read-only swatch code in `open-robin-client/src/components/Robin/CLIDetail.tsx` that was added for the prior spec (it becomes correct-by-default under this spec and doesn't need special handling)

---

## 5. Data shape

### 5a. Per-CLI entry (what a user may write)

Every key is optional. Presence of a key overrides the factory value.

```ts
interface CliEntryOverride {
  enabled?:     boolean;   // hides from picker when false; harness still startable by direct ID
  name?:        string;    // display name in chat header, sidebar, picker
  materialIcon?: string;   // Material Symbols name (matches catalog field name)
  accentColor?: string;    // hex '#RRGGBB'; sets `--cli-accent`
  order?:       number;    // sort position in picker (lower first); default = catalog array index
}
```

**Note on field naming:** `materialIcon` is used in the factory catalog today. The JSON matches the catalog field name verbatim so the merge is trivial and there's no alias table. A separate follow-up can rename the field to `icon` everywhere if desired; out of scope here.

### 5b. Workspace file (full example)

```jsonc
// ai/views/settings/cli.json
{
  "gemini": { "enabled": false },
  "qwen":   {
    "name":         "Jason",
    "materialIcon": "surfing",
    "accentColor":  "#2E8B8F"
  }
}
```

Effect: Gemini disappears from the picker; Qwen renders as Jason with a surfboard and a teal accent. Kimi, Claude, Codex, Robin inherit catalog values entirely.

### 5c. Per-view file (full example)

```jsonc
// ai/views/wiki-viewer/settings/cli.json
{
  "claude-code": { "accentColor": "#8B0000" }
}
```

Effect: inside wiki-viewer only, Claude's accent is dark red. Every other view (and every other field on Claude, like name/icon/enabled) falls through to the workspace override or the factory.

### 5d. Validation

- Unknown keys on a CLI entry → ignored with a server log warning.
- Unknown CLI ids → ignored with a server log warning.
- Malformed JSON → server logs a warning and treats the file as empty (`{}`). Never crashes.
- `accentColor` that doesn't match `/^#[0-9a-fA-F]{6}$/` → ignored with a warning; field falls back to factory.

---

## 6. Resolver

**File:** `open-robin-server/lib/cli-config/resolver.js` (new).

```js
/**
 * Resolve the effective CLI config for a given view (or workspace-wide if
 * viewId is null). Deep-merges factory catalog → workspace cli.json →
 * per-view cli.json. Applies validation (§5d).
 *
 * @param {string} projectRoot
 * @param {string|null} viewId
 * @returns {Promise<Record<string, ResolvedCliEntry>>}
 */
async function resolveCliConfig(projectRoot, viewId) { ... }
```

**Shape returned:** a map keyed by CLI id, with every factory field populated (name, materialIcon, accentColor, enabled, details, etc.) plus the resolved-config extras (`order`). This is what the client consumes — it never needs to do its own merge.

**Entry shape returned** (superset of factory + override, all fields resolved):

```ts
interface ResolvedCliEntry {
  id:            string;
  name:          string;
  description:   string;
  materialIcon:  string;
  accentColor?:  string;
  details:       { provider: string; model: string; features: string[] };
  enabled:       boolean;
  comingSoon?:   boolean;
  recommended?:  boolean;
  order:         number;   // defaulted from array index if neither file specified
}
```

---

## 7. Server

### 7a. Factory catalog, mirrored server-side

**File:** `open-robin-server/lib/cli-config/catalog.js` (new).

The factory catalog currently lives only on the client (`config/harness.ts`). The server needs access to do the merge. Rather than parsing TS at runtime, mirror the same array in a plain JS module. Keep the two files in sync by convention (documented near the top of both files; a lint/test can assert equality of the `id`/`name`/`accentColor` triples if drift becomes a concern).

This is a known duplication cost. The alternative (server reads a JSON catalog, client imports it) is cleaner but reshapes more code. Out of scope here; flag as follow-up.

### 7b. Loader

**File:** `open-robin-server/lib/cli-config/loader.js` (new).

```js
async function loadWorkspaceConfig(projectRoot)       // reads ai/views/settings/cli.json
async function loadViewConfig(projectRoot, viewId)    // reads ai/views/<viewId>/settings/cli.json
```

Both return `{}` if the file is missing, malformed, or unreadable. Both log a warning on parse failure (§5d).

### 7c. API — hitch to workspace init

The client receives the resolved config **as part of the existing `workspace:init` WS message**, not via a new round-trip. This avoids the hydration race that bit the color spec (theme hydration keyed on `wireReady`).

**Message shape extension** (`workspace:init`):

```jsonc
{
  "type": "workspace:init",
  "activeWorkspaceId": "...",
  "workspaces": [...],
  "cliConfig": {                       // NEW
    "kimi":        { /* ResolvedCliEntry */ },
    "claude-code": { /* ResolvedCliEntry */ },
    "gemini":      { /* ResolvedCliEntry */ },
    ...
  }
}
```

`cliConfig` is always the workspace-level resolution (no view known yet at init). When the user switches views, per-view overrides are folded in client-side (see §8b).

### 7d. Per-view resolution on panel switch

When the client sends `set_panel { panel }`, the server already responds with `panel_changed`. Extend that message with an optional `cliConfigDelta` field containing per-view overrides from `ai/views/<view>/settings/cli.json`:

```jsonc
{
  "type": "panel_changed",
  "panel": "wiki-viewer",
  ...existing fields...,
  "cliConfigDelta": {                  // NEW, may be {}
    "claude-code": { "accentColor": "#8B0000" }
  }
}
```

Client merges the delta onto its workspace-level `cliConfig` locally for that view's render path.

**Why a delta and not a fully resolved map:** keeps the message small when no overrides exist, and lets the client maintain the workspace map as the canonical source. Views without an override file send `cliConfigDelta: {}` (or omit the field entirely — both work).

### 7e. Startup: ensure workspace file exists

At startup, if `ai/views/settings/cli.json` is missing, write an empty `{}` to it. This makes the file discoverable to curious users without requiring them to guess the path.

The existing `settings/` AI-write-lock applies to AI-driven edits, not the app's own bootstrap write. Matches the same carve-out in `STATE_OVERRIDE_SPEC` §4a.

---

## 8. Client

### 8a. Store

**File:** `open-robin-client/src/state/panelStore.ts`.

Replace `harnessThemes: Record<string, string>` with:

```ts
cliConfig: Record<string, ResolvedCliEntry>;           // workspace-level resolved config
cliConfigViewDelta: Record<string, Record<string, Partial<ResolvedCliEntry>>>;
// viewDelta keyed by viewId; inner map keyed by cli id → partial override
hydrateCliConfig: (cfg: Record<string, ResolvedCliEntry>) => void;
setCliConfigViewDelta: (viewId: string, delta: Record<string, Partial<ResolvedCliEntry>>) => void;
```

`hydrateCliConfig` is called from the `workspace:init` handler. `setCliConfigViewDelta` from the `panel_changed` handler.

### 8b. Resolver helper

**File:** `open-robin-client/src/config/harness.ts`.

Reshape existing helpers to consult the store. `HARNESS_OPTIONS` stays as the hardcoded factory (kept for type definitions and as a fallback before `workspace:init` arrives).

```ts
// Existing pure functions stay; gain one new hook-based reader
export function useResolvedHarness(harnessId: string): ResolvedCliEntry | null;

// Keep existing resolveCliAccent / cliAccentStyle; they continue to accept an
// overrides map. The hook pipeline now feeds the map from cliConfig instead of
// the old harnessThemes slot.
```

Consumers of `getHarnessOption`/`getHarnessIdentity` migrate to `useResolvedHarness(id)` where reactivity is needed (component render path). The pure `getHarnessOption` remains as the factory-catalog fallback for non-React code paths.

### 8c. Picker filtering

`CliPickerDropdown` filters the list to `entry.enabled === true` before rendering. Disabled CLIs are invisible. No "hidden" affordance in the UI.

### 8d. Sort order

`CliPickerDropdown` sorts by `entry.order ?? <catalog index>`. Consumers that iterate `HARNESS_OPTIONS` directly (e.g. settings section in `CLIDetail`) switch to iterating the resolved map sorted the same way.

### 8e. The five `--cli-accent` surfaces

Unchanged from `CLI_IDENTITY_SPEC` / `CLI_COLOR_OVERRIDE_SPEC`:

- `.chat-item.active` background tint
- `.rv-chat-header-identity` icon + name
- `.rv-secondary-header-identity` icon + name
- `.rv-cli-picker-dropdown .rv-dropdown-item` icon + hover tint
- Sidebar CLI picker selected state

All continue to read `var(--cli-accent, #00d4ff)`. The only plumbing change is the source of the value (resolved config, not SQLite round-trip).

---

## 9. WebSocket messages removed

Drop entirely — no callers remain after migration:

| Message                    | Direction  | Replaced by                 |
|----------------------------|------------|-----------------------------|
| `harness:theme:get`        | C → S      | `workspace:init.cliConfig`  |
| `harness:theme:set`        | C → S      | (no client write path)       |
| `harness:theme:reset`      | C → S      | (no client write path)       |
| `harness:theme_state`      | S → C      | `workspace:init.cliConfig`  |
| `harness:theme_changed`    | S → C      | (none in v1; hot reload will re-emit `workspace:init` when SPEC-30 lands) |
| `harness:theme_error`      | S → C      | (drop)                      |

The client no longer writes config — the user edits the file by hand. When the server sees a file change post-SPEC-30, it re-runs the resolver and broadcasts a replacement `workspace:init.cliConfig` (or a scoped delta). Out of scope here.

---

## 10. Migration & deletion plan

Run as a single commit. Everything listed must either be deleted or updated before the commit lands; no half-state.

### 10a. Server: delete

- `open-robin-server/lib/db/migrations/011_harness_theme.js` — delete file.
- `open-robin-server/lib/harness/harness-theme-service.js` — delete file.
- `open-robin-server/lib/ws/harness-theme-broadcaster.js` — delete file.
- `open-robin-server/lib/startup.js` — remove the `§3.7c. Harness-theme broadcaster` block added for the prior spec (≈3 lines).
- `open-robin-server/lib/ws/client-message-router.js` — remove the three handlers for `harness:theme:get/set/reset` and the `harness:theme_error` response path.

### 10b. Server: drop the SQLite table (data loss)

Create a new down-migration that drops `harness_theme` if it exists. Do not keep migration 011 and simply no-op it — delete the file and add `012_drop_harness_theme.js` (or equivalent index) so `knex migrate:latest` on a fresh install skips the table entirely. Any environment that previously ran 011 will see 012 drop the table.

Data loss is acceptable: there has been no UI to populate the table; the only rows are the seeded catalog defaults.

### 10c. Server: add

- `open-robin-server/lib/cli-config/catalog.js` — factory mirror (§7a).
- `open-robin-server/lib/cli-config/loader.js` — file reads (§7b).
- `open-robin-server/lib/cli-config/resolver.js` — merge (§6).
- `open-robin-server/lib/cli-config/index.js` — barrel.
- `open-robin-server/lib/startup.js` — ensure `ai/views/settings/cli.json` exists (§7e).
- `open-robin-server/lib/workspace/` (wherever `workspace:init` is assembled) — include `cliConfig` in the payload (§7c).
- `open-robin-server/lib/ws/client-message-router.js` — extend `panel_changed` response with `cliConfigDelta` (§7d).

### 10d. Client: delete

- `open-robin-client/src/lib/ws/harness-theme-handlers.ts` — delete file.
- `open-robin-client/src/hooks/useHarnessThemes.ts` — delete file.
- `open-robin-client/src/types/index.ts` — remove `'harness:theme_state'`, `'harness:theme_changed'` from `WebSocketMessageType`.
- `open-robin-client/src/state/panelStore.ts` — remove `harnessThemes` slot, `setHarnessTheme`, `hydrateHarnessThemes`.
- Any remaining imports of `useHarnessThemes` — today it's called in `ChatArea.tsx:97`; delete that line.

### 10e. Client: add/update

- `open-robin-client/src/state/panelStore.ts` — add `cliConfig`, `cliConfigViewDelta`, `hydrateCliConfig`, `setCliConfigViewDelta` (§8a).
- `open-robin-client/src/lib/ws/workspace-handlers.ts` (or wherever `workspace:init` lands) — hydrate `cliConfig`.
- `open-robin-client/src/lib/ws/panel-handlers.ts` (or wherever `panel_changed` lands) — store `cliConfigDelta`.
- `open-robin-client/src/config/harness.ts` — add `useResolvedHarness` hook (§8b); existing pure helpers stay.
- `open-robin-client/src/hooks/useCliAccentStyle.ts` — read overrides from resolved `cliConfig` (keyed `id → accentColor`) instead of `harnessThemes`.
- `open-robin-client/src/components/CliPickerDropdown.tsx` — filter by `enabled`, sort by `order`.
- `open-robin-client/src/components/Sidebar.tsx` — same filter/sort for the sidebar's CLI picker.
- `open-robin-client/src/components/ChatArea.tsx` — drop `useHarnessThemes()` call; the resolver now drives everything.
- `open-robin-client/src/components/Robin/CLIDetail.tsx` — drop the inline swatch added for the prior spec; the meta section shows the resolved name/icon/color via the standard CLI identity path.

### 10f. Files created

- `ai/views/settings/cli.json` → `{}` (empty workspace override file, so discovery is trivial).

### 10g. Grep verification

After the migration commit, these searches should return **zero results** in both server and client:

- `harness_theme`
- `harnessThemes` (except in the deleted commit's diff)
- `harness:theme:`
- `harness:theme_`
- `useHarnessThemes`

---

## 11. Rollout

Each step is independently commit-able:

1. **Spec approval.**
2. **Server foundation** — new `lib/cli-config/*` modules, including the factory catalog mirror and resolver. Unit-testable without any client or WS wiring.
3. **Workspace init extension** — include `cliConfig` in `workspace:init` payload. Client ignores it for now. No behavior change.
4. **Client hydration** — store slot + `hydrateCliConfig`. Still no consumer; hardcoded `HARNESS_OPTIONS` still in charge.
5. **Consumer migration** — components switch from `getHarnessOption`/`HARNESS_OPTIONS` to `useResolvedHarness` / resolved `cliConfig`. Filter by `enabled`. Sort by `order`.
6. **Panel-level deltas** — `panel_changed.cliConfigDelta` server-side; client merges per view.
7. **Delete the theme feature** — all of §10a–d in one commit, since the new path is already serving every render.
8. **Seed empty workspace file** — ensure `cli.json` exists with `{}`.
9. **Smoke test** — drop a test override into `ai/views/settings/cli.json`, restart, verify every surface picks up the change (picker, sidebar, chat header, popup header, Robin detail). Flip `enabled: false` on one CLI, verify it disappears from the picker but remains startable by direct ID.

---

## 12. Acceptance

- Fresh repo: first launch creates `ai/views/settings/cli.json` with `{}`. Every CLI renders with factory values. Picker shows all `enabled: true` entries in catalog order.
- Edit `cli.json` to `{ "gemini": { "enabled": false } }`, restart server, reload client. Gemini is hidden from the picker in every view. Kimi/Claude/Qwen/Codex/Robin render identically to factory.
- Edit `cli.json` to rename Qwen with `{ "qwen": { "name": "Jason", "materialIcon": "surfing", "accentColor": "#2E8B8F" } }`. Every surface that shows Qwen — picker dropdown, sidebar CLI picker, chat header (if a Qwen thread is open), secondary-chat header, thread rows with a Qwen harness — shows "Jason" with the surfboard icon and teal accent.
- Drop `ai/views/wiki-viewer/settings/cli.json` with `{ "claude-code": { "accentColor": "#8B0000" } }`. Inside wiki-viewer, Claude's accent is dark red. In every other view, Claude's accent is whatever the workspace file or factory says.
- Malformed JSON in `cli.json`: server logs a warning, treats the file as `{}`, app runs normally with factory values.
- Unknown CLI id `{ "xyzzy": { "name": "nope" } }`: server logs a warning, entry is ignored.
- Grep for any retired identifier (§10g) returns zero hits.
- `tsc -b --noEmit` passes. `npm run build` passes. Server starts without warnings about the dropped table.

---

## 13. Open questions

1. **Field-naming consistency.** The factory catalog uses `materialIcon`; the JSON file does too. Should both rename to `icon` for a friendlier user file? Proposal: not in this spec. Do it in a follow-up after the refactor settles.
2. **Factory catalog duplication** between client (`config/harness.ts`) and server (`lib/cli-config/catalog.js`). Acceptable short-term cost; flag for a follow-up that introduces a shared `ai/views/settings/cli.catalog.json` as the single source and has both ends read it. Out of scope here.
3. **Hot reload.** Deferred to SPEC-30. Until then, `cli.json` changes require a server restart.
4. **Per-view file discoverability.** The per-view path is supported by the resolver but not advertised in any UI. Do we want a README in `ai/views/settings/` pointing at the pattern? Proposal: yes, one short README covering all three paradigm members (`state.json`, `cli.json`, `styles/`) once `STATE_OVERRIDE_SPEC` and this one both land. Write as a follow-up.
5. **Robin's accent.** Robin has no catalog `accentColor` today. Users can now set one via `cli.json`. Do we also add one to the factory so Robin has a default? Proposal: leave factory as-is (Robin falls back to `--text-primary`); users who want a color set it explicitly in `cli.json`.

---

/Users/rccurtrightjr./projects/open-robin/docs/CLI_CONFIG_SPEC.md
