# Clipboard Manager — Keychain Redesign

**Status:** Design note — captures the architectural decision. Implementation spec follows.
**Owner:** Open Robin core.
**Origin:** Discovered during Secrets Manager convergence verification (2026-05-05). The clipboard manager stores values in plaintext SQLite, creating an AI-readable leak path that bypasses the Secrets Manager's boundary. This note records the redesign decision so the implementation pass doesn't reason from scratch.
**Precedes:** A `CLIPBOARD_KEYCHAIN_SPEC.md` to be drafted next, plus an implementation effort similar to the Secrets Manager (T-track session briefs).
**Depends on conceptually:** `docs/SECRETS_MANAGER_SPEC.md` — this redesign reuses its storage primitive and read contract.
**Supersedes:** Parts of `docs/CLIPBOARD_INTEGRATION_ARCHITECTURE.md`, `docs/CLIPBOARD_MANAGER_SPEC.md`, `docs/CLIPBOARD_MANAGER_REFERENCE.md` — the storage layer changes; the UX layer stays.

---

## 1. Problem

The existing clipboard manager stores captured clipboard items as plaintext rows in a SQLite `clipboard` table:

```
clipboard:
  id          INTEGER PK
  text        TEXT     ← plaintext payload
  type        TEXT
  preview     TEXT
  content_hash TEXT
  created_at  INTEGER
  last_used_at INTEGER
```

The clipboard listener auto-captures every copy event on the user's system (`source: "auto"`). When the user copies an API key from a provider's dashboard, a Stripe key from a `.env` file, or a token from any other surface, the value lands in `clipboard.text` plaintext. There it sits until rotated out by the 500-row cap.

**Threat:** The Secrets Manager (`docs/SECRETS_MANAGER_SPEC.md`) carefully avoids putting values anywhere the AI can read, with `secrets_index` holding metadata only and values living in the macOS Keychain. But any AI that runs:

```bash
sqlite3 "$ROBIN_DB" "SELECT text FROM clipboard ORDER BY last_used_at DESC LIMIT 30;"
```

…sees the most recent 30 values the user has copied. Including any secrets they copied to paste into the Secrets Manager popover. Including any secrets they copied for any other reason.

This is a per-feature design conflict. The Secrets Manager creates a boundary; the clipboard manager bypasses it.

## 2. Insight

The clipboard items and API key values have **the same threat shape**:
- Opaque user-supplied strings
- Should not be readable from disk by an agent
- Need to be available to the user (paste back into apps for clipboard, used by scripts for API keys)
- Have lifecycle metadata that's safe to expose

So they should use **the same solution**: keychain for values, SQLite for metadata, shell-capture for retrieval, capabilities-index discoverability via metadata only.

## 3. Proposed shape

### 3a. Architecture relationship to Secrets Manager

Clipboard becomes a **submodule of the Secrets Manager's storage architecture** but keeps its **own UX**.

```
Secrets Manager (storage primitive: keychain + SQLite metadata index + read contract)
  ├── api-keys      → Secrets popover (key icon, header right)
  ├── clipboard     → Existing clipboard popover (separate hotkey, MRU stack)
  ├── oauth         → future
  └── passwords     → future
```

The Secrets Manager's *popover* does not gain a clipboard tab. The existing clipboard popover, hotkey, MRU navigation, and "see more" pagination all remain. Only the storage layer changes — values move from the SQLite `clipboard` table to the macOS Keychain, with metadata staying in a slimmed `clipboard_index` table.

### 3b. Storage layout

| What | Where |
|------|-------|
| **Clipboard values** | macOS Keychain. `account = "open-robin"`, `service = "clipboard:<id>"` where `<id>` is the row's primary key (or a SHA-256-prefix-derived id). |
| **Clipboard metadata** | SQLite `clipboard_index` table: `id, type, preview, content_hash, created_at, last_used_at, source`. **No `text` column.** |

### 3c. Schema

```sql
CREATE TABLE clipboard_index (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT,           -- 'text' | 'link' | 'code' | 'icon' | 'emoji' | ...
  preview       TEXT,           -- first ~80 chars, denormalized for list UI
  content_hash  TEXT NOT NULL,  -- SHA-256 hex; UNIQUE for dedup
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER NOT NULL,
  source        TEXT            -- 'auto' | 'manual' | 'api' | etc.
);
CREATE UNIQUE INDEX clipboard_index_hash ON clipboard_index(content_hash);
CREATE INDEX clipboard_index_lru ON clipboard_index(last_used_at DESC);
```

**The preview** is intentionally a denormalized first-N-chars copy. For non-secret clipboard items (URLs, code snippets, plain text) this is fine — the preview is what the user sees in the popover and was always intended to be shown. For secret-shaped items, the preview is a few characters, possibly leaking partial value. See §4 for the heuristic that mitigates this.

### 3d. Keychain entry naming

```
account: "open-robin"
service: "clipboard:<id>"
```

Where `<id>` is the row's `INTEGER PRIMARY KEY`. The service-name prefix `clipboard:` namespaces clipboard entries away from API key entries (whose services are bare uppercase names like `STRIPE_KEY_PROD`). One Keychain account, two service-name conventions, no collisions.

### 3e. Lifecycle: 30-row rolling FIFO

| Operation | Behavior |
|-----------|----------|
| **Insert** | Compute hash. If hash exists, bump `last_used_at` on the existing row, no new row, no new keychain entry. Otherwise: insert metadata row, write keychain entry, then trim — if `count(*) > 30`, delete oldest row by `last_used_at ASC` and remove its keychain entry. |
| **List** | Read `clipboard_index` ordered by `last_used_at DESC`. Returns metadata only. UI displays previews. |
| **Use** (paste, etc.) | Look up the keychain value by id, return to caller. Bump `last_used_at`. |
| **Clear** | Truncate `clipboard_index`. Delete every `clipboard:*` keychain entry. |

Cap at 30 vs. the existing spec's 500: the user's call. Smaller cap = smaller blast radius if an item ever does leak; smaller history depth for ergonomics. 30 is in line with macOS Paste/Maccy/etc.

### 3f. AI access

Same as Secrets Manager:
- AI **may** read `clipboard_index` metadata via `sqlite3 "$ROBIN_DB" "SELECT id, type, preview, last_used_at FROM clipboard_index ORDER BY last_used_at DESC;"`. Returns no values.
- AI **may** capture a specific item's value via `security find-generic-password -a "open-robin" -s "clipboard:<id>" -w` inside `$()` — but has no real reason to. Clipboard is a user-side ergonomic feature; the AI fetching clipboard items is uncommon.
- AI **cannot** `SELECT text` and get a value, because the column doesn't exist.

### 3g. Heuristic: preview redaction

To handle the "preview leaks partial value" risk: when capturing an item, run a fast secret-pattern detector (regex against common API key prefixes — `sk_test_`, `sk_live_`, `ghp_`, `xoxb-`, `Bearer `, hex-of-length≥32, base64-of-length≥40, etc.). If matched:
- Set `type = 'secret'`.
- Set `preview = '••••••••••••' + lastFour(value)` — the same 12-dot + last-4 fingerprint format the API Keys submodule uses.
- Otherwise, store as a normal clipboard item.

This is best-effort, not a hard guarantee. A user copying a non-prefix-matching opaque token may still get a plaintext preview. But it covers the 80% case and converges naturally with the existing fingerprint UX from API Keys.

### 3h. Source-of-paste signal

Optional v2 enhancement: when the secrets popover is the active window/component, *suspend* clipboard auto-capture for the duration. Eliminates the specific failure mode that surfaced this redesign. Not required for v1; the heuristic above handles the general case.

## 4. Migration from existing clipboard

The current `clipboard` SQLite table holds plaintext values that the user has copied over time. **Two migration options:**

### 4a. Nuke (recommended)

Delete the existing `clipboard` table entirely. Users start fresh. Justification:
- The existing table holds **values that have been leaking** for as long as it's been populated. Migrating them preserves the leak.
- Clipboard contents are inherently transient. Users rarely depend on N-day-old clipboard state.
- One-time inconvenience vs. an ongoing leak surface.

Migration:
```sql
DROP TABLE IF EXISTS clipboard;
CREATE TABLE clipboard_index ( ... ); -- per §3c
```

### 4b. Migrate (not recommended)

Read each row, write its `text` to the keychain at `clipboard:<id>`, write the metadata to `clipboard_index`, drop `text`. More complex; preserves the leaky data; offers little value over starting fresh.

**Recommendation: nuke.** Document in the migration's `up()` that this is intentional.

## 5. UX impact

The existing clipboard popover, hotkey, and interactions stay. What changes:

- Popover row rendering: items detected as secrets (§3g) show the fingerprint instead of preview text. Same visual language as the API Keys list.
- Pagination ("see more"): unchanged. The page reads from `clipboard_index` instead of `clipboard`.
- Paste-back: when the user selects an item, the popover fetches the value via the keychain accessor, writes to system clipboard, and (optionally) auto-pastes. Same UX, different fetch.
- Clear-history: new option / refined existing one. Truncates index + keychain entries.

## 6. Out of scope for this redesign

- **Changing the existing clipboard popover's UI/UX.** This is purely a storage-layer redesign. The popover keeps its hotkey, layout, navigation.
- **Cross-app clipboard sync.** Out of scope of any current spec.
- **Per-app clipboard separation.** Same.
- **Encrypted preview text.** The preview is always plaintext (or fingerprint per §3g). Encrypting it just to decrypt for display adds ceremony for no security gain — the keychain is the only thing protecting the actual value.

## 7. Related: WS debug logger redaction

A second leak surfaced during the same convergence: the WS debug logger writes `[WS →]: ${JSON.stringify(msg)}` for every incoming message, which means the `secrets:api-keys:set` payload (carrying the user's value) lands in `server-live.log` verbatim.

This is **not** a Secrets Manager bug per se — the value has to travel over WS at submit time; that's the protocol. But the *logger* logging the payload verbatim is a separate concern, in scope for project-wide log discipline rather than the Secrets Manager spec.

The fix and this clipboard redesign share a theme — *log/storage discipline for known-credential-bearing channels* — and probably belong in the same hardening pass:

| Surface | Today's behavior | Proposed |
|---------|-----------------|----------|
| Clipboard SQLite | Plaintext `text` column | Keychain + metadata-only index (this doc) |
| WS debug logger | Logs all message payloads verbatim | Per-message-type redaction map; redact `value` on `secrets:api-keys:set`, `clipboard:append`, etc. |
| (Future) Output redactor | Not built | In-memory cache of known values, scrubbed from tool-result text before AI sees it |

The first two are concrete v1.1 work. The third is the §6f deferred enforcement spec from `SECRETS_MANAGER_SPEC.md`.

## 8. Implementation order (when this becomes a spec)

Anticipated session breakdown when the implementation spec is written:

1. **Migration**: drop `clipboard` table, create `clipboard_index` table.
2. **Backend storage layer**: clipboard's existing service module migrates to `lib/secrets/clipboard/backend.js` (mirroring `lib/secrets/api-keys/backend.js`). Same shape: coordinates keychain values + index table + UEB events.
3. **WS handlers**: `clipboard:list`, `clipboard:append`, `clipboard:touch`, `clipboard:clear` (per existing CLIPBOARD_MANAGER_SPEC §4) move to `lib/secrets/clipboard/handlers.js`. Payloads simplify — no `text` field on outbound messages.
4. **UEB events**: clipboard mutations emit `clipboard:added` / `clipboard:used` / `clipboard:deleted` per the existing `secret:*` convention. Bus naming is `clipboard:*` to match the WS protocol family it serves; semantically still in the secrets-architecture umbrella.
5. **Heuristic preview redaction** (§3g) in the backend's insert path.
6. **Client repository**: existing `clipboardRepository` and components query the new state shape. Preview rendering branches on `type === 'secret'` for fingerprint display.
7. **WS debug logger redaction** (§7 bonus): per-message-type redaction map applied at log site.

Total scope: comparable to the Secrets Manager work but smaller per layer (the UI already exists; only storage layer changes). Probably 4–5 sessions.

## 9. Decisions captured

| Question | Answer |
|----------|--------|
| Cap on rolling history | **30 items** (was 500 in old spec; user-confirmed during the discussion that surfaced this redesign) |
| Submodule integration shape | **Architectural** (shared storage + read contract). **Not UI.** Existing clipboard popover stays. |
| Migration strategy | **Nuke existing `clipboard` table.** Existing entries are pre-leak and shouldn't be preserved. |
| Naming convention | `service = "clipboard:<id>"` namespaced under existing `account = "open-robin"`. |
| Preview redaction | **Heuristic best-effort** with secret-pattern regex. Not a hard guarantee; matches the §6f "wiki + discipline is the load-bearing protection" stance. |
| Timing | **After Secrets Manager ships.** Path B from the discussion: ship secrets first, redesign clipboard next. |

## 10. Open decisions for the implementation spec

These deliberately stay open until the implementation spec is drafted, so the spec author has a chance to weigh them with fresh eyes:

1. **Exact secret-pattern regex set.** Which prefixes / shapes does the heuristic match? Worth spending real thought on; impacts false-positive and false-negative rates.
2. **Pause-on-secrets-popover-open.** Build §3h optional v2 enhancement, or skip?
3. **Per-app clipboard policy.** Future feature or never? Note in non-goals.
4. **Cap configurability.** 30 is the default; user-settable in System Settings, or hard-coded? Default: hard-coded for v1, configurable later.
5. **`clipboard:added` UEB event payload.** Should it include `preview` (already non-secret per heuristic) or `id` only? Default: `id, type, preview, last_used_at` — same as the index row.
6. **Existing `lib/clipboard/` module's fate.** Refactored in place to use new storage, or moved to `lib/secrets/clipboard/`? Lean: move, to make the architectural relationship explicit.

---

`/Users/rccurtrightjr./projects/open-robin/docs/CLIPBOARD_KEYCHAIN_REDESIGN.md`
