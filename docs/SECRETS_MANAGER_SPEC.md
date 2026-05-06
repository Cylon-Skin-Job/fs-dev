# Secrets Manager — Spec

**Status:** Implemented — landed at 008cb94 (2026-05-05). v1.1 hardening tracked in `docs/CLIPBOARD_KEYCHAIN_REDESIGN.md` §7.
**Owner:** Open Robin core.
**Precedes implementation of:** the header secrets button + popover, the API Keys sub-module, the `secrets_index` SQLite table, and the wiki page at `ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md`.
**Depends on:**
- `docs/THEME_PICKER_SPEC.md` — precedent for "lift item out of the Robin System panel into its own header surface."
- `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md` — modularity rules this spec is structured to satisfy.
- `open-robin-server/lib/event-bus.js` — Universal Event Bus the secrets mutations publish to (§7g). Convention: two-segment `domain:action`, colon-separated, flat (no sub-module level).
- `open-robin-server/lib/audit/audit-subscriber.js` — existing subscriber persisting chat exchanges; precedent for how subscribers consume the bus.
- `ai/views/doc-viewer/content/specs/SPEC-EVENT-SYSTEM.md` — the broader event-system / event-log architecture this spec hooks into. The persistent event log is spec'd there but not yet implemented; secrets events emit into the bus today and are retroactively persisted when that listener lands.
- `docs/DB_RELOCATION_SPEC.md` — current DB location: `open-robin-server/data/robin.db` (app-level, workspace-independent). `docs/SQLITE_SYSTEM_LAYER.md` is partially superseded — its claim that the DB lives at `{projectRoot}/ai/system/robin.db` is stale.
- Robin System panel (`open-robin-client/src/components/Robin/RobinOverlay.tsx`) — source of the Secrets tab being retired here.

The Secrets Manager is **AI-platform agnostic.** Its wiki article and shell patterns are written for any AI harness with a Bash tool, not for any specific CLI or assistant.

---

## 1. Purpose

Give the user a first-class place to manage credentials, and give every AI that runs in this harness a uniform way to use them without exposing their values to the chat transcript.

The Secrets Manager is a **container** for credential sub-modules. Each sub-module is a self-contained vertical slice — its own UI, WS handlers, storage shape — for one credential class. **v1 ships one sub-module: API Keys & Tokens.** Future sub-modules (OAuth, Passwords) drop in alongside without touching API Keys code.

---

## 2. Long-term vision

### 2a. Agent automation platform

Open Robin is becoming Zapier/n8n with an AI as the workflow author rather than a human dragging boxes. Scripts and triggers are reusable building blocks; agents compose them on demand or are pointed at them from a prompt; background agents run them on schedules.

Credentials in this world must satisfy three constraints simultaneously:
- **Stay out of the chat transcript.** Agents never see raw values.
- **Stay out of the agent's prompt.** Background agents reference scripts; they don't inline credentials.
- **Stay usable by anything the user runs locally.** Scripts, CLIs, one-off shell commands all need a uniform way to fetch the value at exec time, regardless of which AI is calling.

A keychain entry plus a documented shell-capture pattern satisfies all three without depending on any specific AI's tooling.

### 2b. The system-repo template

This Open Robin codebase **is** the system repo. When the app ships in Electron, this repo (minus source-code folders) bundles into the binary as a default template containing:
- Sample background agents under `ai/views/agents-viewer/content/agents/**`
- Wiki markdown for everything the AI needs to know about Open Robin under `ai/views/wiki-viewer/content/**`

A future chat selector will offer **Read / Edit / System** modes:
- **Read** — AI reads/talks about the active workspace's repo.
- **Edit** — AI edits the active workspace's repo.
- **System** — AI gets read access to the bundled system repo, with a system message orienting it to its tools and abilities.

In **System** mode the AI scans the wiki via a title/description index, calls file paths as normal tool reads, learns the agent pattern, learns the Secrets Manager from this spec's wiki article, clones an agent that's almost right, swaps values, tweaks scope, ships a new background pipeline. **The current project is the template the AI works from.**

### 2c. Storage scope rule

Project-wide rule informing this spec:
- **SQLite (`robin.db`) = system.** System events, ledgers, chat-thread state, structured operational data.
- **Files in folders = work product.** Wiki markdown, scripts, configs, agent definitions, content authored by users or AI.

Wiki content is moving from SQLite to filesystem markdown. The secrets *index* (system metadata) stays in SQLite where structured system data belongs. Secret *values* live in the OS keychain — neither file nor DB.

### 2d. Storage layout for this feature

| What | Where | Why |
|------|-------|-----|
| **Secret values** | macOS Keychain (`account = "open-robin"`) | Encrypted by the OS. Never in repo, never in DB, never in a file we manage. |
| **Secret index (metadata)** | SQLite `secrets_index` table | Structured system data. Per §2c. |
| **Wiki article** | `ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md` | AI-readable instruction surface. Per §2c. |

---

## 3. Module shape

Architecture follows `code-standards/PAGE.md`: one job per file, no God files, extract on second consumer, server.js does not grow.

```
Secrets Manager (container)
  ├── header button + popover shell
  └── sub-modules (one per credential shape)
        ├── API Keys & Tokens   ← v1
        ├── OAuth Connections   ← future
        └── Passwords & Sites   ← future
```

The container knows nothing about credential shapes. v1 has only API Keys, so no tabs UI. No registry abstraction, no shared backend base — extract on the second consumer.

### 3a. Reference by name, not by embedding

> **Higher-level features reference credentials by name. They do not extend the credential schema.** LLM Providers, OAuth Connections, Script Runners, and any future feature that wants to act on a credential stores its own configuration alongside a `secret_name_ref` pointing at the credential. Cross-cutting metadata (endpoint URL, model, scopes) lives where it conceptually belongs.

This rule keeps each sub-module's schema one job and prevents API Keys from accreting `endpoint_url`, `model`, `org_id`, etc.

---

## 4. Non-goals

- **No reveal endpoint, no copy button, no auto-mask timer.** Verifying-by-fingerprint and delete-and-re-add are the only flows.
- **No per-CLI / per-platform skills required.** The wiki article + the shell pattern are platform-agnostic.
- **No OAuth, no Passwords sub-module in v1.**
- **No tabs UI in v1.**
- **No shared backend base class in v1.**
- **No bulk import/export.** v2.
- **No script-runner mechanics, no background-agent runtime.** Separate specs.
- **No structured endpoint/model fields on a credential.** Per §3a.
- **No JSON-file storage for the index.** SQLite per §2c.
- **No Python tools in v1.** Long-term objective; deferred. v1 uses raw `security` and `sqlite3` shell invocations the AI knows from the OS.
- **No shell wrappers in v1.** Wiki teaches the raw commands. A `bin/get-secret` shim is a future cosmetic.
- **No changes to server.js.** One line added (or zero with auto-discovery).
- **No prompt-frontmatter tool-access enforcement.** Future enforcement model (§9c).
- **No automatic migration of `kimi-ide`-account keychain entries.** Coexist for now.

---

## 5. UI

### 5a. Header button

A small circular key button in `rv-header-right`, between the existing theme swatch and the raven button. Icon: `key` (Material Symbols).

```
[☰ Connected]              [●] [🔑] [raven]
                            ↑    ↑     ↑
                       theme   secrets  Robin overlay
```

Click toggles the popover. Escape and outside-click close it. Open/close logic mirrors `ThemePickerButton.tsx`. **No dot indicator.**

### 5b. Popover (container)

Width: 360px. Max height: 80vh.

```
┌──────────────────────────────────────────────┐
│  Secrets                                     │
│ ─────────────────────────────────────────── │
│                                              │
│   [ active sub-module renders here ]         │
│                                              │
└──────────────────────────────────────────────┘
```

In v1 the body is always the API Keys panel. Container header (`Secrets`) renders so the future tabs strip's location is unambiguous.

### 5c. API Keys sub-module body

Each row shows a **fingerprint**: a uniform prefix of dots plus the last four characters of the value. Computed server-side at `set` time, stored as plain metadata.

```
┌──────────────────────────────────────────────┐
│  API Keys & Tokens                           │
│ ─────────────────────────────────────────── │
│  GITHUB_TOKEN          ••••••••••••a3f7  [✕]│
│  Used by gh-sync.sh · 2d ago                 │
│ ─────────────────────────────────────────── │
│  STRIPE_KEY_TEST       ••••••••••••4242  [✕]│
│  Stripe test mode · 1h ago                   │
│ ─────────────────────────────────────────── │
│  OPENAI_API_KEY        ••••••••••••XYZ4  [✕]│
│  Expires 2026-08-15 · added 5d ago           │
│ ─────────────────────────────────────────── │
│  + Add API key                               │
└──────────────────────────────────────────────┘
```

**Fingerprint format:** exactly 12 dots, exactly 4 trailing chars. Width-uniform (hides length); last-4 supports identity-match against provider dashboards.

**Per row:** name (mono), fingerprint (mono), `[✕]` delete with inline confirm, optional description / expiry / relative `updated_at` line below.

### 5d. Add form

Expands inline when "+ Add API key" is clicked.

```
Name         [GITHUB_TOKEN___________________________]
             UPPER_SNAKE_CASE only — letters, digits,
             underscores. Must start with a letter.
             Suffixes like _PROD, _TEST help your
             future self.

Value        [•••••••••••••••••••••••••••••••••••••__]
             Min 8 characters.

Description  [multi-line textarea, ~3 rows__________]
             [______________________________________]
             [______________________________________]
             What this is, when the AI should use it,
             and what user requests trigger it.        0 / 150

Expires      [date picker]   optional

[Cancel]                                          [Save]
```

**Description field.** Single combined narrative covering three slots: *what it is*, *when AI uses it*, *what user requests trigger it*. Replaces the prior `description` + `use_when` split. Multi-line textarea, hard cap **150 chars**. The `0 / 150` counter sits in the lower-right beneath the field; it goes red when the count exceeds 150 and Save is disabled while over.

Example: *"Full access token to GitLab. Used automatically for issue ticketing and by AI for push/pull commits including wiki updates. Use this key when the user requests GitLab interaction."*

**Expires field.** User-editable, optional. Free-form date picker. The user is the source of truth — they saw the expiry on the provider's dashboard when they created the key. Most API keys have no expiry; the field is left blank for those. Editing is independent of the value (value lives in keychain; `expires_at` lives in the SQLite index).

No "More options" disclosure. All four fields render inline in the form.

`Use when` and `Expires` are under a "More options" disclosure.

**Validation:**
- `name` — required; must match `^[A-Z][A-Z0-9_]*$` (UPPER_SNAKE — letters, digits, underscores; must start with a letter); unique (duplicate prompts "Update existing?").
- `value` — required; ≥ 8 chars.
- `description` — optional; ≤ 150 chars (Save disabled while over).
- `expires_at` — optional.

The name field has live regex validation: green check when valid, red explanation when not. Save is disabled until the name passes. The validation rule matches `lib/secrets.js`'s `KEY_PATTERN` exactly — there is one rule, enforced at the UI layer (early feedback) and at the server layer (defense in depth).

**Rejection message** when the name fails the regex:
> *"Names use UPPER_SNAKE_CASE: `STRIPE_KEY_PROD`, `GITHUB_TOKEN`. Letters, digits, underscores only — must start with a letter."*

**Note on names vs values.** The regex applies to the *name* (the slot identifier — `STRIPE_KEY_PROD`). The *value* (the actual credential string — `sk_live_abc123...`) has no format constraint beyond minimum length. Users sometimes try to paste the provider's key identifier as the name — direct them to invent a stable name they'll remember and paste the actual value in the value field.

On save: server validates the name regex (rejects with `INVALID_NAME` if violated), writes value to keychain, writes index row in SQLite with computed fingerprint, **emits UEB event** (§7g), broadcasts WS state. UI clears form, new row appears at top.

### 5e. Empty state

> *No API keys stored yet. Add keys and tokens your scripts need to talk to outside services.*

### 5f. Mounting

Mount `<SecretsManagerButton />` at the same three sites as `<ThemePickerButton />` in `App.tsx` (empty state, loading, main render). Header order: `[ThemePickerButton] [SecretsManagerButton] [RobinButton]`.

---

## 6. The read contract

### 6a. Two consumers, two paths

| Consumer | What it sees | How it reads |
|----------|--------------|--------------|
| **User-client (UI)** | Index entries (name, description, expires_at, fingerprint, timestamps) | `secrets:api-keys:list` over WS — returns the index, never values |
| **AI / agents / scripts** | Index via `sqlite3` query, values via `security ... -w` capture | Raw OS binaries the AI already knows |

There is **no third path**. There is no "reveal" WS endpoint. The keychain is the canonical store; `security` is the universal accessor; `secrets_index` is the discoverability surface.

### 6b. The shell-capture pattern (taught to the AI via wiki)

```bash
TOKEN=$(security find-generic-password -a "open-robin" -s "STRIPE_KEY_PROD" -w 2>/dev/null)
curl -s -H "Authorization: Bearer $TOKEN" https://api.stripe.com/v1/charges
```

The capture and the use occur in the **same Bash tool invocation**. The token lives in a shell variable for one subprocess, is interpolated into argv (or piped to stdin), and never appears in the AI's tool-result channel — `curl` returns the response body, not the request headers.

This pattern is generic. Any AI harness with a Bash tool can run it. Nothing about it is platform-specific (today: macOS via `security`; v2 Electron: a shell-callable accessor that talks to `safeStorage`; same wiki snippet).

### 6c. Discoverability — the capabilities index

The wiki article teaches the AI to read the index via `sqlite3`, using the harness-injected `$ROBIN_DB` env var:

```bash
sqlite3 "$ROBIN_DB" "
  SELECT json_object(
    'name',        name,
    'description', description,
    'expires_at',  expires_at,
    'fingerprint', fingerprint
  )
  FROM secrets_index
  ORDER BY name;
"
```

**Why an env var.** The DB lives at `open-robin-server/data/robin.db` today (per `DB_RELOCATION_SPEC.md`) and at `app.getPath('userData')/robin.db` post-Electron. The AI can't reliably resolve either from its own context — workspace-relative paths break for subagents and background runners; absolute paths break across the Electron transition. The harness knows the path (it's already calling `initDb` at boot) and injects it into every spawned AI process's environment as `ROBIN_DB`. The wiki snippet is then stable across dev and Electron without modification.

**If `$ROBIN_DB` is unset.** The AI is running outside a properly-configured harness context. The wiki article instructs it to surface this to the user rather than guess at a path: *"I can't reach the secrets index — `$ROBIN_DB` isn't set in my environment. Open Robin's harness should set this. Please report this as a bug."*

Output is one JSON object per line — the AI's capabilities-index format, shaped like a skill manifest:

```json
{"name":"OPENAI_API_KEY","description":"OpenAI API key for the gpt-research and embedding scripts. Use when a script declares it needs OPENAI_API_KEY, or the user asks for OpenAI-powered functionality.","expires_at":"2026-08-15","fingerprint":"••••••••••••a3f7"}
{"name":"STRIPE_KEY_TEST","description":"Stripe test mode, for local checkout testing. Use when testing the checkout flow against fake card numbers. For prod, use STRIPE_KEY_PROD.","expires_at":null,"fingerprint":"••••••••••••4242"}
```

The AI reads this, picks the entry whose `description` fits the current task, and emits a single Bash command that captures via `security` and uses inline.

The wiki article is the source of truth for this query. If the schema changes, the wiki changes; the AI re-reads.

### 6d. The boundary, precisely

The boundary is **"the value never enters the AI's transcript or tool-result channel,"** not "the value never enters any process the AI invokes."

What this allows:
- `security ... -w` inside `$(...)` interpolation.
- Piping the value to stdin of a tool that needs it.
- Setting the value as an HTTP header in `curl` argv.

What this forbids (taught explicitly in the wiki article):
- `echo $TOKEN` — captures to stdout, lands in the tool result.
- Writing the value to a file (including `.env`).
- Two-call capture (variable is gone between Bash invocations).
- Using the value in any path that constructs a chat message, log line, or tool-call argument the AI sees.

### 6e. What this enables

- **One-off use.** AI reads wiki → runs `sqlite3` to list → writes ad-hoc bash → executes. No skill required per credential.
- **Repeated patterns become per-CLI skills.** Optional optimization for hot patterns.
- **Background agents.** A script in a folder calls `security` itself; the agent's prompt references the script by name and never handles credentials.
- **System-repo cloning (§2b).** AI in System mode reads this spec's wiki article, copies a sample script that uses the pattern, swaps values, ships.
- **Cross-CLI portability.** Any harness with a Bash tool works. No per-AI plumbing.

### 6f. Defense in depth (deferred)

The wiki + shell-capture discipline is the load-bearing protection. Two future backstops are flagged but **not in v1**:

- **Output redactor.** Server keeps an in-memory list of known secret values, scrubs matches from tool-result text.
- **Argv inspector.** Catches `security ... > file`, `tee`, `echo $TOKEN` patterns before subprocess runs.

Both land in a future Secrets Enforcement spec.

---

## 7. Storage backend

### 7a. Two-store model

| Store | What it holds | Why |
|-------|---------------|-----|
| **macOS Keychain** | Values, indexed by `(account="open-robin", service=NAME)` | Encrypted at rest. Read via `security`. |
| **SQLite `secrets_index` table** | Index entries: `name (PK), description, expires_at, fingerprint, created_at, updated_at` | Holds no values. Drives `secrets:api-keys:list` (UI) and `sqlite3 SELECT` (AI). |

Mutations write to both atomically. If keychain write fails, the SQLite row is rolled back, and vice versa. **For `delete`:** read the keychain value before removing it, so an index-delete failure can restore the keychain entry. If both rollback legs fail, throw `BACKEND_UNAVAILABLE` and log loudly — the system is in an inconsistent state and the user must be told. (Pattern landed in T1L1.)

### 7b. v1 backend implementation

`open-robin-server/lib/secrets.js` already exists with `account = "open-robin"` and is **kept**. v1 backend wraps it for the WS handlers and pairs each value mutation with a SQLite mutation and a UEB event.

`open-robin-server/lib/git-credential-open-robin.sh` is **kept** — same model, real consumer.

### 7c. The AI's read interface — raw shell

v1 uses raw OS binaries the AI already knows. No Python tools, no shell wrappers.

```bash
# Get one value
TOKEN=$(security find-generic-password -a "open-robin" -s "NAME" -w 2>/dev/null)

# List the capabilities index
sqlite3 "$ROBIN_DB" "SELECT json_object('name', name, 'description', description, 'expires_at', expires_at, 'fingerprint', fingerprint) FROM secrets_index ORDER BY name;"
```

`$ROBIN_DB` is set by the harness at AI-process spawn time (§6c). Both forms are taught verbatim in the wiki article. The article ships with the system repo and is updated alongside any schema change.

### 7c.1. Where `ROBIN_DB` gets set

**Single one-line change at server boot.** No spawn-site edits.

```js
// lib/startup.js, after initDb() succeeds:
const { DB_PATH } = require('./db');
process.env.ROBIN_DB = DB_PATH;
```

The server's own `process.env` carries `ROBIN_DB`. Every AI-spawn site in the codebase already passes `env: { ...process.env, TERM: 'xterm-256color' }` (verified across `lib/runner/wire-session.js`, `lib/harness/compat.js`, `lib/harness/clis/base-cli-harness.js`), so the variable propagates to every spawned CLI child without per-site changes. Spawn sites that don't pass an `env` option at all inherit by default per Node's standard behavior.

**Implementation audit step.** Before declaring this done, verify the three per-CLI override files (`lib/harness/clis/claude-code/index.js`, `gemini/index.js`, `codex/index.js`) all pass `env` with `...process.env` spread, not a fresh object that shadows inheritance. If any constructs env without spreading, that's a one-line fix at that site — but the goal is for this spec to require zero spawn-site edits when the audit passes. The audit fix, if needed, is independent of the secrets feature and arguably belongs with the broader "consolidate per-CLI spawn into base" refactor (`docs/09-base-cli-harness-split.md` adjacent).

**Why `lib/db.js` exports `DB_PATH`.** `initDb()` already resolves the path at boot using `path.join(__dirname, '..', 'data', 'robin.db')`. Export the resolved path as a module-level constant so `lib/startup.js` (and any future readers) get a single source of truth. Without an export, callers would have to re-derive the path, which would drift the moment the path moves (e.g., to Electron's `userData`).

### 7d. v2 (Electron) — the swap

When Electron lands:
- Values move from macOS Keychain to `safeStorage` (cross-platform).
- A small shell-callable accessor replaces the bare `security` invocation in the wiki snippet (probably named `get-secret` at that point).
- The SQLite `secrets_index` table is unchanged.
- The AI's `sqlite3` query is unchanged.

The wiki article is updated once, and every AI on every harness picks up the new pattern by re-reading.

### 7e. Why SQLite for the index

Per §2c project rule: SQLite is system, files are work product. The secrets index is system metadata about credentials — not user-authored content. SQLite gives:
- Atomic transactions paired with the keychain write.
- Trivial query surface (`SELECT json_object(...)`).
- Standard place for system data, alongside chat threads, system events, ledgers.
- UEB integration (§7g) — mutations emit events the same way every other system mutation does.

### 7f. Why no dev-mode banner

v1 storage is the macOS keychain — encrypted today. No banner.

### 7g. UEB integration

Every mutation publishes an event on `lib/event-bus.js` (the project's Universal Event Bus), the same way other system events do (`chat:turn_end`, `ticket:created`, `agent:run_started`).

**Naming convention:** two-segment `domain:action`, colon-separated, flat. The WS protocol's three-segment namespacing (`secrets:api-keys:set`) is a wire-protocol concern; events use the simpler bus convention. Sub-module distinction lives in the payload via a `kind` field.

| Mutation | Event type | Payload |
|----------|-----------|---------|
| Add | `secret:added` | `{ kind, name, description?, expires_at?, fingerprint }` |
| Update | `secret:updated` | `{ kind, name, description?, expires_at?, fingerprint, changed_fields[] }` |
| Delete | `secret:deleted` | `{ kind, name }` |

Where `kind` is one of `'api-key'` (v1), `'oauth'`, `'password'` (future). `changed_fields[]` lists which metadata fields a `secret:updated` actually changed (e.g., `['description']`, `['value', 'fingerprint']`); subscribers can ignore no-op updates.

Events **carry no values**. Only names, metadata, and the post-update fingerprint (which is non-sensitive — last-4 chars of the value, already approved by the user as an identification surface). Consumers react without seeing plaintext.

Bus internals (`id`, `chain_id`, `timestamp`) are added by `event-bus.js` automatically — handlers don't include them.

### 7h. History via the event log

The user-facing intent is: secret mutations form a queryable history alongside chat exchanges, file events, ticket lifecycle, etc. The right home for that history is the project-wide event log (`ai/system/event-log.json`), spec'd in `SPEC-EVENT-SYSTEM.md` §"System Event Log."

**Current state:** the event bus is built and runs in production. The `audit-subscriber` persists chat exchanges. The general-purpose `on('*', appendToEventLog)` listener that would persist *every* event — including `secret:*` — is **spec'd but not yet implemented**.

**This spec's contract with that future:**

- v1 emits `secret:added` / `secret:updated` / `secret:deleted` exactly as described in §7g.
- v1 does **not** build a parallel `secrets_audit` table. The event log is the right home; building per-feature audit accretion is the kind of god-table risk this codebase actively defends against.
- The `secrets_index` SQLite table holds *current state only*. Versioning and history come from the event log when it ships.
- Until the event log persistence lands, secret mutation history is in-memory only (the events fire on the bus, subscribers can react in-process, but they're not persisted to disk for later query). For v1 this is acceptable — the user can see current state in the popover; rotation history is a v1.x concern.

When the event log lands, every prior `secret:*` event from that point forward is captured automatically. No backfill is possible (events before the listener don't exist on disk), but every mutation after the listener's birth is queryable forever.

A note has been added to `SPEC-EVENT-SYSTEM.md` listing the secrets-side emit calls as one of the consumers waiting on that listener.

---

## 8. WebSocket protocol (UI only)

The WS protocol is for the user-client UI. **The AI does not call these endpoints.** The AI's read path is `sqlite3` + `security`. This dissolves the connection-origin-tag question for this feature.

### 8a. API Keys protocol

| Direction | Type | Body | Purpose |
|-----------|------|------|---------|
| C → S | `secrets:api-keys:list` | — | request current state |
| S → C | `secrets:api-keys:state` | `{ items: [{name, description, expires_at, fingerprint, created_at, updated_at}] }` | response + broadcast on mutation. Never returns values. |
| C → S | `secrets:api-keys:set` | `{ name, value, description?, expires_at? }` | server writes value to keychain, writes SQLite row, publishes UEB event, broadcasts WS state. `description` rejected with `INVALID_VALUE` if > 150 chars. |
| C → S | `secrets:api-keys:delete` | `{ name }` | remove from keychain + SQLite, publish UEB event, broadcast state. |
| S → requester only | `secrets:api-keys:error` | `{ name?, code, message }` | codes: `NOT_FOUND`, `INVALID_NAME`, `INVALID_VALUE`, `DUPLICATE`, `BACKEND_UNAVAILABLE` |

No `reveal`, no `value`. No WS path returns plaintext.

### 8b. Future sub-module protocols

Each future sub-module defines its own `secrets:<name>:*` messages independently.

---

## 9. AI access boundary

### 9a. What the AI may do

- Read the capabilities index by running `sqlite3 ROBIN_DB "SELECT ... FROM secrets_index;"`.
- Capture a value into a shell variable inside a single Bash invocation: `TOKEN=$(security find-generic-password -a "open-robin" -s NAME -w 2>/dev/null)`.
- Interpolate the captured variable into argv or stdin of the same command.

### 9b. What the AI may not do

- Run any command that lands a value in its tool-result channel.
- Call `secrets:api-keys:*` over WS.
- Generate `.env` files, log lines, or tool-call arguments containing values.

The wiki article (§10) is the primary teaching mechanism. Backstops in §6f deferred.

### 9c. Future enforcement: prompt-frontmatter tool gating

Planned long-term mechanism, deferred from this spec: agent prompts carry frontmatter declaring which tools and secrets the agent may access, similar to TRIGGERS.md and CSS files loaded into RAM. When a trigger fires:

1. Harness reads the agent's prompt frontmatter.
2. Hands the AI only the declared tools and secrets.
3. The AI cannot reach anything outside its declared scope.

Example: a "wiki agent" prompt declares it can read diffs/code, look at chat history, edit `/wiki-viewer/content`, and access `GITLAB_API_TOKEN` — and nothing else. The harness enforces at runtime.

This model replaces the per-secret AI-visibility toggle (which was rejected as a poor fit). Access control is per-agent, not per-credential.

---

## 10. Wiki article (load-bearing deliverable)

### 10a. Location and structure

`ai/views/wiki-viewer/content/system-tools/secrets-manager/` — a folder in the system repo (§2b) containing three files, mirroring the theme-picker precedent at `system-tools/custom-theme-css/`:

| File | Purpose |
|------|---------|
| `PAGE.md` | The article content. Teaches the AI the shell-capture pattern, the `sqlite3` index query, the metadata fields, and the discipline rules. |
| `index.json` | Topic metadata: id, label, description, type, rank, icon, sources, edges. Same schema as `custom-theme-css/index.json`. |
| `LOG.md` | Change log for the article. Same pattern as `custom-theme-css/LOG.md`. |

Two index files also need updating:

- `ai/views/wiki-viewer/content/system-tools/index.json` — add `"secrets-manager"` to the `children` array.
- `ai/views/wiki-viewer/content/topics.json` — register the slug under `topics` (probably keyed `"system-tools/secrets-manager"`, matching the precedent's `"system-tools/custom-theme-css"`).

### 10b. Legacy `system_wiki.secrets` row in SQLite

**Left in place. Not deleted, not blanked, not migrated.**

Per the theme-picker precedent: when the theme picker was lifted out of the Robin overlay, the corresponding `system_wiki.customization` row was left untouched in SQLite. The same applies here: the `system_tabs.secrets` row gets deleted (migration `014_drop_secrets_system_tab.js`), removing the secrets tab from the overlay; the orphaned `system_wiki.secrets` row becomes dormant data.

**Why not even drop the system_tabs row?** Project plan: the entire Robin System panel stays mounted as visual reference until *every* feature has been migrated to the header (theme, secrets, and future LLM Providers / Connectors / Enforcement equivalents). Each migrated feature drops its `system_tabs` row at retirement time so it falls off the panel's tab strip; the wiki rows are left to be cleaned up in a single batch at the end. This spec contributes one tab-row deletion to that batch. The full panel + table teardown is a separate retirement pass once the user is satisfied with all migrated features.

### 10c. Tone — AI-platform agnostic

The article is written for any AI harness with a Bash tool. It does **not** reference:
- Specific AI products (Claude Code, Codex, Kimi, etc.) by name as the audience.
- Specific harness skill systems, slash commands, or proprietary tool schemas.
- Specific OS-only paths or commands beyond the macOS-specific `security` (which is called out as v1's macOS implementation, with v2 Electron noted as the cross-platform path).

It speaks to "the AI" generically and teaches generic Bash + sqlite3 commands.

### 10d. Content outline

1. **What this is.** A capabilities index. The AI lists available credentials and reaches for them by name.
2. **The shell-capture pattern.** Exact `security` snippet for capture; exact `sqlite3` snippet for listing. Two end-to-end examples — a `curl` auth header and a CLI env-var pass-through.
3. **The discipline rules.** No echo. No file write. No `.env` generation. No two-call capture. No values in chat messages or tool-call arguments.
4. **What to do when a needed key is missing.** Tell the user the name, what it's for, where to get it. Direct them to the Secrets Manager (key icon, top right). Do not ask them to paste into chat.
5. **The metadata fields.** `description` is the single combined narrative covering *what it is*, *when AI uses it*, *what user requests trigger it* (≤ 150 chars). `expires_at` is a proactive-rotation cue. `fingerprint` is the visible identity-match string (12 dots + last 4).
6. **Progressive-disclosure path.** One-off use → ad hoc shell. Repeated pattern → optional per-harness skill. Workflow → script in a folder, agent prompt references it.

### 10e. The article is the AI's source of truth

When an AI (any AI, any harness) is asked about how to use a credential and is operating in System mode (§2b), it reads this article. When it builds a new background agent that needs a credential, it clones this article's example pattern. **This is not documentation polish — it is the AI's instruction.**

---

## 11. Files

### 11a. Wiring change (3 files, ~17 lines)

Earlier drafts of this spec claimed "one line in server.js." That was naive. The actual precedent in this codebase splits handler-family wiring across three files — `server.js` exposes the dependency, `lib/startup.js` constructs the handlers via factory, and `lib/ws/client-message-router.js` dispatches incoming messages. Following the precedent (matching the cousin `themeHandlers` exactly):

| File | Change | Lines |
|------|--------|-------|
| `server.js` | Expose `getSecretsHandlers`-style getter; one binding, one getter, one assignment. | ~3 |
| `lib/startup.js` | Require `./secrets/index` (explicit subpath per §11b note); call factory with `{ getAllClients }`; return the handlers object up the init chain. | ~4 |
| `lib/ws/client-message-router.js` | Destructure `secretsHandlers`; add a dispatch block immediately after `theme:*` for the three `secrets:api-keys:*` types. | ~10 |

Total: ~17 lines, all mechanical. (Pattern landed in T1L3.)

### 11b. Server (new)

```
open-robin-server/lib/secrets/
  index.js                          ← registers all sub-module handlers; <40 lines
  api-keys/
    handlers.js                     ← 4 WS handlers (list/set/delete + state broadcast); emits UEB events
    backend.js                      ← coordinates keychain (lib/secrets.js) + SQLite (index-table.js)
    fingerprint.js                  ← compute("•".repeat(12) + value.slice(-4)); one job
    index-table.js                  ← read/write secrets_index SQLite rows; one job
```

| File | One-sentence job |
|------|------------------|
| `lib/secrets/index.js` | Register every sub-module's WS handlers with the router. **Importers must use the explicit subpath:** `require('./lib/secrets/index')` (or equivalently `'./lib/secrets/index.js'`). The bare path `require('./lib/secrets')` resolves to the existing `lib/secrets.js` keychain wrapper, not this directory — Node's module resolution prefers the `.js` file when both exist. (Foot-gun discovered in T1L2.) |
| `lib/secrets/api-keys/handlers.js` | Translate `secrets:api-keys:*` messages into backend calls, broadcasts, and UEB events. |
| `lib/secrets/api-keys/backend.js` | Coordinate the keychain (values) and the SQLite `secrets_index` table (metadata). |
| `lib/secrets/api-keys/fingerprint.js` | Compute the 12-dot + last-4 fingerprint string for one value. |
| `lib/secrets/api-keys/index-table.js` | Read and write `secrets_index` rows via knex. |

### 11c. Server (kept, refreshed)

| File | Change |
|------|--------|
| `lib/secrets.js` | **Kept.** Account already `"open-robin"`. `KEY_PATTERN` regex stays as-is (`/^[A-Z][A-Z0-9_]*$/`); the spec's UI validation matches this exactly. May add a small `getMany` / `exists` helper. Consider exporting `KEY_PATTERN` so the WS handler layer reuses the same regex object rather than redeclaring (single source of truth). |
| `lib/git-credential-open-robin.sh` | **Kept.** Real consumer. |

### 11d. Tools (none in v1)

No Python tools, no shell wrappers. The AI uses raw `security` and `sqlite3` per the wiki article. Tool-style abstractions deferred to a future spec when cross-platform Electron support and richer tooling justify them.

### 11e. Wiki (new — ships with the system repo)

Three files in a new folder, plus two index updates. Mirrors the theme-picker precedent at `system-tools/custom-theme-css/`.

| File | Job |
|------|-----|
| `ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md` | Teach any AI the shell-capture pattern, the `sqlite3` index query, the metadata fields, and the discipline rules. Platform-agnostic. |
| `ai/views/wiki-viewer/content/system-tools/secrets-manager/index.json` | Topic metadata: id, label, description, type, rank, icon, sources, edges. Same schema as `system-tools/custom-theme-css/index.json`. |
| `ai/views/wiki-viewer/content/system-tools/secrets-manager/LOG.md` | Change log for the article. Same pattern as `custom-theme-css/LOG.md`. |

| File | Change |
|------|--------|
| `ai/views/wiki-viewer/content/system-tools/index.json` | Add `"secrets-manager"` to the `children` array. |
| `ai/views/wiki-viewer/content/topics.json` | Register `"system-tools/secrets-manager"` under `topics` with appropriate metadata. |

### 11f. Server (touched)

| File | Change |
|------|--------|
| `lib/db/migrations/013_secrets_index.js` (new) | Create `secrets_index` table. |
| `lib/db/migrations/014_drop_secrets_system_tab.js` (new) | Remove `secrets` row from `system_tabs`. (`system_wiki.secrets` row left for the broader wiki-to-filesystem sweep.) |

### 11g. Server (NOT deleted)

`lib/secrets.js`, `lib/git-credential-open-robin.sh`, and `scripts/migrate-keychain.sh` all stay.

### 11h. Client (new)

```
open-robin-client/src/components/secrets/
  SecretsManagerButton.tsx          ← header key button + popover open/close
  SecretsManager.tsx                ← popover shell + active sub-module slot
  api-keys/
    ApiKeysPanel.tsx                ← list rows + add form + delete confirm
    api-keys-api.ts                 ← thin WS wrappers
    apiKeysStore.ts                 ← index entries; never values
```

| File | One-sentence job |
|------|------------------|
| `SecretsManagerButton.tsx` | Render the header key button and toggle the popover. |
| `SecretsManager.tsx` | Render the popover shell and active sub-module body. |
| `api-keys/ApiKeysPanel.tsx` | Render and operate the API Keys list and add form. |
| `api-keys/api-keys-api.ts` | Wrap `secrets:api-keys:*` WS messages in typed functions. |
| `api-keys/apiKeysStore.ts` | Mirror `secrets:api-keys:state` payloads as a Zustand store. Also holds `lastError: ApiKeysError \| null` set by the `secrets:api-keys:error` dispatcher and cleared on the next successful `setApiKeys`. (Pattern landed in T2L1.) |

If `ApiKeysPanel.tsx` crosses 200 lines, split into `ApiKeysList.tsx` + `ApiKeysAddForm.tsx`. Not before.

### 11i. Client (touched)

| File | Change |
|------|--------|
| `src/components/App.tsx` | Mount `<SecretsManagerButton />` at the three header sites. |
| `src/lib/ws-client.ts` | Add **both** `secrets:api-keys:state` and `secrets:api-keys:error` to the message-type dispatcher, matching the `theme:*` precedent. The `:state` case calls `setApiKeys`; the `:error` case calls `setApiKeysError`. (T2L0 originally added only `:state`; T2L1 added `:error` when error display became implementable.) |
| `src/types/index.ts` | Extend the closed `WebSocketMessageType` union with `'secrets:api-keys:state'` and `'secrets:api-keys:error'`. Required because the union is closed and tsc rejects un-extended literals; every prior dispatcher family (theme, clipboard, workspace, harness) extended it the same way. (Pattern landed in T2L0.) |
| `src/components/App.css` | Add `.rv-secrets-*` rules for the popover, form, list, and counter. **Theme-variable rule:** all colors use the project's existing tokens — primary buttons use `var(--chrome-accent, var(--accent-dim, var(--text-dim)))` with `--chrome-accent-fg` for foreground, focus borders use the same. **Do not invent fallbacks like `var(--accent, #4ea1ff)`** — `--accent` is not a defined theme variable in this codebase, so the hardcoded fallback always wins, breaking dark/light theming. Reference: `ai/views/wiki-viewer/content/enforcement/themes-and-state/PAGE.md` puts buttons on the chrome accent channel. (Bug found and fixed during COLLAPSE polish pass.) |

---

## 12. Future sub-modules

### 12a. OAuth Connections

`lib/secrets/oauth/`, `components/secrets/oauth/`. Provider cards with Connect/Disconnect/Reauthorize. State machine over `(provider, refresh_token, expires_at, scopes)` — refresh token in keychain, indexed in `oauth_index` SQLite table. Owns its own browser-callback HTTP route.

### 12b. Passwords & Sites

`lib/secrets/passwords/`, `components/secrets/passwords/`. Three-field form (URL, username, password). Indexed in `passwords_index` SQLite table; password value in keychain.

### 12c. LLM Providers (separate sub-system, references API Keys)

Lives outside the Secrets Manager. Stores `(name, secret_name_ref, base_url, model, auth_mode)` and references API Keys by name (per §3a).

### 12d. When the second sub-module lands

- `SecretsManager.tsx` grows a tabs strip.
- A registry shape may emerge in `lib/secrets/index.js` if both sub-modules' registration looks identical.
- A shared helper is extracted **only if** both backends end up with copy-pasted logic.

---

## 13. Migrations

`013_secrets_index.js`:

```js
exports.up = (knex) => knex.schema.createTable('secrets_index', (t) => {
  t.text('name').primary();
  t.text('description');
  t.integer('expires_at').nullable();
  t.text('fingerprint').notNullable();
  t.integer('created_at').notNullable();
  t.integer('updated_at').notNullable();
});
exports.down = (knex) => knex.schema.dropTable('secrets_index');
```

`014_drop_secrets_system_tab.js`:

```js
exports.up = async (knex) => {
  // The system_wiki rows where tab='secrets' carry a FK to system_tabs.id.
  // §10b keeps those rows dormant, so null the FK before deleting the tab.
  await knex('system_wiki').where('tab', 'secrets').update({ tab: null });
  await knex('system_tabs').where('id', 'secrets').delete();
};
exports.down = async (knex) => { /* re-seed from 002 literal */ };
```

`004_secrets_wiki_update.js` is left as legacy; the broader system_wiki → filesystem migration handles its row. The `tab` field on `system_wiki.secrets` is nulled here as a side effect — that's intentional. The row's `content`, `context`, `description`, and `surface_when` are untouched, so the dormant-wiki-row design from §10b is preserved.

**FK constraint discovered during T1L0 implementation.** A naive `delete from system_tabs where id='secrets'` fails with `SQLITE_CONSTRAINT_FOREIGNKEY` because `system_wiki.tab` references `system_tabs.id`. The two-step migration above is the correct shape and is what shipped.

---

## 14. Test plan

- **Empty state.** Fresh boot → empty-state copy + "+ Add API key."
- **Add.** Submit `STRIPE_KEY_TEST` + value + description + expires_at. WS panel: `secrets:api-keys:set` carries the value; `secrets:api-keys:state` does not. Keychain: entry exists at `account=open-robin, service=STRIPE_KEY_TEST`. SQLite: `SELECT * FROM secrets_index WHERE name='STRIPE_KEY_TEST'` returns the row with computed fingerprint. UEB: `secret:added` event fired with `{kind: 'api-key', name, description, expires_at, fingerprint}`, no value.
- **Description length validation.** `set` with description of 151+ chars → `INVALID_VALUE`. UI Save disabled while count > 150; counter renders red.
- **Fingerprint.** Stored fingerprint is exactly `••••••••••••` + last 4 chars regardless of value length.
- **Update.** Add an existing name → "Update existing?" → confirm → keychain entry updates (verified via `security find-generic-password -w`), SQLite `updated_at` advances, fingerprint reflects new last-4, UEB `secret:updated` fired with `changed_fields` correctly listing what changed.
- **Delete.** Inline confirm → keychain entry gone, SQLite row gone, UEB `secret:deleted` fired with `{kind, name}`, broadcast state empty.
- **Outside-click + Escape.** Both close popover.
- **Two clients.** Mutation in one broadcasts state to both.
- **Validation — value.** `set` with value < 8 chars → `INVALID_VALUE`.
- **Validation — name regex.** `set` with name `my-stripe-key` (lowercase + hyphen) → `INVALID_NAME`. Same for `123_KEY` (leading digit), `OpenAI_Key` (mixed case), `KEY WITH SPACE`, empty string. UI rejects pre-submit (Save disabled, red indicator on field). Server rejects post-submit if anything bypassed the UI. Both error paths return the same `INVALID_NAME` code.
- **Validation — name regex (positives).** `STRIPE_KEY_PROD`, `GITHUB_TOKEN`, `KIMI_KEY_CODE_PLAN`, `A`, `Z9`, `OPENAI_API_KEY_TEST_2026` all accepted.
- **UI / server agreement.** The regex pattern in `ApiKeysPanel.tsx` (or its validation helper) and `lib/secrets.js`'s `KEY_PATTERN` are byte-identical. A code search for `[A-Z][A-Z0-9_]*` finds exactly two occurrences (one per layer), and they match.
- **AI shell read.** From a Bash tool: `TOKEN=$(security find-generic-password -a "open-robin" -s "STRIPE_KEY_TEST" -w 2>/dev/null); curl -H "Authorization: Bearer $TOKEN" https://example.com`. Tool result: curl response. Token absent.
- **AI shell list.** `sqlite3 "$ROBIN_DB" "SELECT json_object('name', name, ...) FROM secrets_index;"` returns one JSON object per row. No values present.
- **`ROBIN_DB` propagation.** From a Bash tool spawned by any installed CLI (Kimi, Claude, Codex, Gemini, Qwen, OpenCode), `echo $ROBIN_DB` prints the absolute path to `open-robin-server/data/robin.db`. Verifies the env-var inherits through every AI-spawn site without per-site edits.
- **UEB events carry no values.** Subscribe to `secret:*` (wildcard) during a full add/update/delete cycle. Inspect every payload: no `value` field, no plaintext anywhere, only `kind` + `name` + non-sensitive metadata + the 12+4 fingerprint.
- **Event log forward-compat.** With the (future) `on('*', appendToEventLog)` listener registered, run a full add/update/delete cycle. Verify the log captures three `secret:*` entries in order, none containing a value. (Skip this test until the listener ships; flagged in `SPEC-EVENT-SYSTEM.md`.)
- **Wiki article.** `ai/views/wiki-viewer/content/system-tools/secrets-manager/` contains `PAGE.md`, `index.json`, and `LOG.md`. PAGE.md renders in the wiki viewer and contains no Claude/CLI-specific references. `system-tools/index.json`'s `children` array contains `"secrets-manager"`. `topics.json` lists `"system-tools/secrets-manager"`. The wiki viewer's title/description index surfaces the new article.
- **Legacy row dormant.** `system_wiki.secrets` row still exists in SQLite (left alone per §10b). No active code path surfaces it in any UI after `014_drop_secrets_system_tab.js` runs — verified by clicking through the Robin overlay (no Secrets tab visible) and the wiki viewer (the new filesystem article is what surfaces, not the SQLite row).
- **Server logs.** Grep `server.log` and `wire-debug.log`. No raw values.
- **server.js diff.** At most one new line.

---

## 15. Code-standards check

Against `ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md`:

- [x] Each new file has one job describable in one sentence.
- [x] No file projected to exceed 400 lines. Largest: `ApiKeysPanel.tsx` ≈ 150 first cut.
- [x] Imports don't cross layer boundaries.
- [x] CSS uses variables with fallbacks per `.rv-` patterns.
- [x] Components portable. Header button + panel hold no app-state.
- [x] No premature abstractions. No tabs UI. No shared backend base. No registry. No dev banner. No Python tools. No shell wrappers.
- [x] No scope creep. OAuth, Passwords, LLM Providers, script-runner, prompt-frontmatter enforcement, output redactor, argv inspector, Python tooling, shell shims — all explicitly out of scope.
- [x] "One giant server.js" defended: server.js gains zero or one line.
- [x] "Delete, don't deprecate" applied: `lib/secrets.js` is alive, not deleted.
- [x] AI-platform-agnostic. Wiki teaches generic Bash + sqlite3, no harness-specific assumptions.

---

## 16. Open decisions — resolved

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Dot indicator on header button | **Skip.** |
| 2 | AI read interface | **Raw `security` + `sqlite3` shell.** Python and shell-wrappers deferred. |
| 3 | Index storage | **SQLite `secrets_index` table.** Per project rule (§2c): SQLite is system. |
| 4 | Output redactor + argv inspector | **Defer to future enforcement spec.** |
| 5 | Per-secret AI-visibility toggle | **Defer / never.** Replaced by future prompt-frontmatter tool gating (§9c). |
| 6 | Migrate `kimi-ide` → `open-robin` keychain entries | **Defer.** Coexist; circle back after the rest ships. |
| 7 | Wiki article path | **`ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md`.** |
| 8 | Tools directory | **None in v1.** No Python tools, no shell wrappers. |
| 9 | Python 3 dependency | **Not added in v1.** Long-term objective for richer user-specific tooling. |
| 10 | `get-secret` on PATH | **Not in v1.** Wiki teaches the raw `security` invocation. Shim is a future cosmetic. |

### 16a. Open questions surfacing from this revision

1. **UEB event format — RESOLVED.** Inspection of `lib/event-bus.js` and existing emitters (`chat:turn_end`, `ticket:created`, `agent:run_started`) confirms two-segment colon-separated `domain:action`, flat. Secrets emits `secret:added` / `secret:updated` / `secret:deleted` with `kind` field for sub-module distinction. See §7g.
2. **`robin.db` path in the wiki snippet — RESOLVED.** Per `DB_RELOCATION_SPEC.md`, the DB lives at `open-robin-server/data/robin.db` today and at `app.getPath('userData')/robin.db` post-Electron — app-level, workspace-independent. The wiki snippet uses `$ROBIN_DB`, set by the harness at every AI-process spawn site by reading `DB_PATH` exported from `lib/db.js`. See §6c and §7c.1.
3. **Wiki retirement of `system_wiki.secrets` row — RESOLVED.** Per the theme-picker precedent (`system_wiki.customization` row was left untouched when the theme picker moved to `system-tools/custom-theme-css/`), the legacy SQLite row stays in place as dormant data. Removed from UI exposure by `014_drop_secrets_system_tab.js` (which deletes `system_tabs.secrets`); the corresponding `system_wiki.secrets` row simply sits unread until the broader system_wiki → filesystem migration sweeps it. Documented in §10b.
4. **Persistent event log timing.** §7h notes that secret mutation history is in-memory only until the `on('*', appendToEventLog)` listener from `SPEC-EVENT-SYSTEM.md` ships. That work is project-level, not secrets-specific, but secrets is now an explicit consumer. Note added to `SPEC-EVENT-SYSTEM.md` listing secrets-side emit calls as one of the consumers waiting on that listener.

---

## 17. Implementation order and dependency tree

The work splits into three independent tracks plus a final convergence. Anything in the same layer of the same track can ship in parallel; layers within a track are sequenced.

### 17a. Track 1 — Server (sequenced)

```
Layer 0 (foundations):
  └─ lib/db/migrations/013_secrets_index.js      (CREATE TABLE)
  └─ lib/db/migrations/014_drop_secrets_system_tab.js
  └─ lib/db.js                                   (export DB_PATH)
  └─ lib/startup.js                              (process.env.ROBIN_DB = DB_PATH)
  └─ lib/secrets.js                              (export KEY_PATTERN)

Layer 1 (backend, needs Layer 0):
  └─ lib/secrets/api-keys/fingerprint.js         (pure function)
  └─ lib/secrets/api-keys/index-table.js         (knex CRUD on secrets_index)
  └─ lib/secrets/api-keys/backend.js             (coordinates keychain + index)

Layer 2 (handlers, needs Layer 1):
  └─ lib/secrets/api-keys/handlers.js            (WS handlers, emits UEB events)
  └─ lib/secrets/index.js                        (registers handlers)

Layer 3 (wiring, needs Layer 2):
  └─ server.js                                   (one-line registration)
```

### 17b. Track 2 — Client (sequenced)

```
Layer 0 (state + transport):
  └─ src/state/secretsStore.ts                   (Zustand mirror of state messages)
  └─ src/components/secrets/api-keys/api-keys-api.ts   (typed WS wrappers)
  └─ src/lib/ws-client.ts                        (add secrets:api-keys:* dispatcher)

Layer 1 (UI, needs Layer 0):
  └─ src/components/secrets/api-keys/ApiKeysPanel.tsx
  └─ src/components/secrets/SecretsManager.tsx
  └─ src/components/secrets/SecretsManagerButton.tsx

Layer 2 (mounting, needs Layer 1):
  └─ src/components/App.tsx                      (mount at three header sites)
```

### 17c. Track 3 — Wiki (independent of code)

```
  └─ ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md
  └─ ai/views/wiki-viewer/content/system-tools/secrets-manager/index.json
  └─ ai/views/wiki-viewer/content/system-tools/secrets-manager/LOG.md
  └─ ai/views/wiki-viewer/content/system-tools/index.json    (add child)
  └─ ai/views/wiki-viewer/content/topics.json                (register slug)
```

Track 3 has zero code dependencies and can run any time, including before Track 1 ships.

### 17d. Convergence — End-to-end

After Track 1 Layer 3 and Track 2 Layer 2 are both done:
- E2E test: full add / update / delete cycle through the UI.
- Verify keychain values, SQLite index rows, UEB events, broadcast state.
- Verify wiki article renders and is platform-agnostic.
- Verify legacy `system_wiki.secrets` row is dormant (no UI surfaces it).

### 17e. Parallelism map

These can all run simultaneously:

- **Track 1 Layer 0** (one session, fast — five small files)
- **Track 2 Layer 0** (one session, parallel — three files; can stub server responses)
- **Track 3** (one session, parallel — content work, no code)

Once Track 1 Layer 0 ships, Track 1 Layer 1 starts. Once Track 2 Layer 0 ships, Track 2 Layer 1 starts. The natural pipeline:

```
T=0   :  Track 1 L0  ‖  Track 2 L0  ‖  Track 3
T=1   :  Track 1 L1  ‖  Track 2 L1  ‖  (Track 3 done or rolling)
T=2   :  Track 1 L2  ‖  Track 2 L2
T=3   :  Track 1 L3
T=4   :  Convergence E2E
```

A reasonable end-to-end with three parallel sessions: 4–5 work cycles.

### 17f. Session brief format

Each session brief is a separate file in `docs/SECRETS_BRIEFS/` named `SESSION-<TRACK><LAYER>-<SHORTNAME>.md`. Briefs follow this structure:

1. **Master spec reference** — link to `SECRETS_MANAGER_SPEC.md` and the §s most relevant.
2. **Files in scope** — exact paths.
3. **Files NOT in scope** — what to leave alone.
4. **Acceptance criteria** — specific test-plan items from §14 that must pass.
5. **Dependencies** — what must already be merged before this session starts.
6. **Return format** — what to paste back into the orchestrator session.

The orchestrator (this session) prepares each brief in turn, ends each comment with the brief's absolute file path, and integrates the returned report before preparing the next brief.

---

`/Users/rccurtrightjr./projects/open-robin/docs/SECRETS_MANAGER_SPEC.md`
