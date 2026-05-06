# Session T3 — Wiki Content

**Track:** 3 (Wiki). **Layer:** N/A — pure content, no code.
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for full architectural context. Sections most relevant to this session: §6 (the read contract — this is what the wiki teaches), §10 (wiki article structure and tone), §11e.
**Dependencies:** None. Pure content. Can run anytime, even before any server or client work ships.
**Estimated size:** Small. Three new content files, two index updates. No code, no migrations.

The wiki article you're writing is **the AI's instruction surface.** When any AI in any harness asks "how do I use a credential," it reads this. Get it right.

---

## Files in scope

### 1. `ai/views/wiki-viewer/content/system-tools/secrets-manager/PAGE.md` (new)

The article. Six sections per §10d. Platform-agnostic per §10c — write for "the AI" generically, no Claude/Kimi/Codex/skill/slash-command references.

Use this draft as a starting point. Adjust prose to match the project's existing wiki tone (read `system-tools/custom-theme-css/PAGE.md` for the precedent before writing — match its sentence rhythm, heading style, and code-fence conventions).

```markdown
# Secrets Manager

A capabilities index for credentials. Use this page to learn how to read and use stored API keys, tokens, and passwords without exposing their values to the chat transcript.

## What this is

Open Robin stores credentials in two places:

- **Values** live in the operating system's keychain (macOS Keychain today; cross-platform via Electron's `safeStorage` once the desktop wrap ships). Encrypted at rest by the OS.
- **Names and metadata** (description, when-to-use hint, expiry, fingerprint) live in the SQLite database at `$ROBIN_DB`.

You can list available credentials and capture one for a single command. You cannot read a value into a variable that survives across commands, log it, write it to a file, or include it in a chat message. The harness expects this discipline.

## How to list available credentials

Use the database path the harness provides via the `ROBIN_DB` environment variable:

```bash
sqlite3 "$ROBIN_DB" "
  SELECT json_object(
    'name',        name,
    'description', description,
    'use_when',    use_when,
    'expires_at',  expires_at,
    'fingerprint', fingerprint
  )
  FROM secrets_index
  ORDER BY name;
"
```

The output is one JSON object per line. Pick the entry whose `use_when` field describes the task at hand.

## How to use a credential

Capture into a shell variable inside a single bash command, then immediately use it:

```bash
TOKEN=$(security find-generic-password -a "open-robin" -s "STRIPE_KEY_PROD" -w 2>/dev/null)
curl -s -H "Authorization: Bearer $TOKEN" https://api.stripe.com/v1/charges
```

The capture and the use must occur in the **same** bash invocation. The variable is gone when the subprocess ends. The token never appears in your tool-result channel — `curl` returns the response body, not the request headers.

Two more examples:

```bash
# Pipe to stdin instead of putting in argv
TOKEN=$(security find-generic-password -a "open-robin" -s "GITHUB_TOKEN" -w 2>/dev/null)
echo "$TOKEN" | gh auth login --with-token

# Pass to a CLI as an environment variable for one invocation
ANTHROPIC_API_KEY=$(security find-generic-password -a "open-robin" -s "ANTHROPIC_KEY" -w 2>/dev/null) \
  some-tool --do-thing
```

## Discipline rules

- **Never** echo a captured value: no `echo $TOKEN`, no `printf "$TOKEN"`, no `cat <<< $TOKEN`.
- **Never** write a value to a file: no `> .env`, no `>> config`, no `tee`.
- **Never** capture across two bash calls. The variable is gone, and capturing fresh in a logged-output context risks leaking.
- **Never** include a value in a chat message, log line, ticket comment, or tool-call argument that you (the AI) construct.
- **Never** generate a `.env` file for the user — this bypasses the design entirely.

If the user asks you to put a value somewhere outside this discipline, refuse and explain. The constraint is by design.

## What to do when a needed credential is missing

If `get` returns nothing, the credential isn't stored. Tell the user:

1. Its expected name.
2. What the credential is for.
3. Where to obtain it (provider's dashboard, account settings, etc.).
4. Direct them to the Secrets Manager — the key icon at the top right of the Open Robin window — to add it.

Do **not** ask the user to paste the value into chat.

## Metadata fields

Each entry in the index has:

- **`name`** — the slot identifier (always UPPER_SNAKE_CASE, e.g. `STRIPE_KEY_PROD`).
- **`description`** — short human-facing note: *what is this*.
- **`use_when`** — your retrieval hint: *when to reach for it*. Read this to decide which credential fits the current task.
- **`expires_at`** — unix-ms timestamp, or null. If set and within a week of expiring, proactively warn the user when the credential comes up.
- **`fingerprint`** — `••••••••••••XXXX`: 12 dots followed by the last four characters of the value. Used for identity-match against a provider's dashboard. Not sensitive.

## Progressive disclosure

- **One-off use:** read this article, list secrets, write one bash command, run it. Nothing else needed.
- **Repeated patterns:** if you find yourself writing the same `security` invocation against the same name across many sessions, the user may want to codify it as a per-CLI skill or a script. Suggest this when the pattern is clearly recurring.
- **Workflow / background agent:** drop a script in a folder that calls `security` itself. The agent's prompt references the script by name and never handles credentials directly. Ask the user if they want to set this up when the use case calls for it.
```

Adjust headings and prose flow as needed to match the existing wiki tone, but keep the structure and the technical content exact. Don't drop sections, don't soften the discipline rules, don't add Claude-specific references.

### 2. `ai/views/wiki-viewer/content/system-tools/secrets-manager/index.json` (new)

Topic metadata. Match the schema of `system-tools/custom-theme-css/index.json` exactly — read that file before writing this one. Expected shape:

```json
{
  "version": "1.0",
  "id": "secrets-manager",
  "label": "Secrets Manager",
  "description": "Read API keys, tokens, and passwords from the OS keychain without exposing values to chat.",
  "type": "topic",
  "rank": <next-available rank in system-tools, ask the existing index for sort order>,
  "icon": "key",
  "color": null,
  "created": "<today's date in ISO-8601>",
  "updated": "<today's date in ISO-8601>",
  "frozen": false,
  "edges_out": null,
  "edges_in": null,
  "sources": null,
  "settings": {}
}
```

Confirm fields against `custom-theme-css/index.json` — if it has a `children` field or different shape, match that. Don't invent fields.

### 3. `ai/views/wiki-viewer/content/system-tools/secrets-manager/LOG.md` (new)

Change log. Match the format of `system-tools/custom-theme-css/LOG.md`. First entry is today: "Initial article. Teaches the shell-capture pattern for OS-keychain-stored credentials."

### 4. `ai/views/wiki-viewer/content/system-tools/index.json` (modify)

Add `"secrets-manager"` to the `children` array. Today the array reads `["custom-theme-css"]`. After this change it reads `["custom-theme-css", "secrets-manager"]` (or in whatever order matches the convention — alphabetical or by rank).

Update the parent's `updated` field to today's ISO date.

### 5. `ai/views/wiki-viewer/content/topics.json` (modify)

Register the new topic under `topics`. Match the entry shape used for `"system-tools/custom-theme-css"` — read that entry first. Add an analogous block keyed `"system-tools/secrets-manager"` with the new article's slug, label, description, and rank.

Update the file's `last_updated` field to today's ISO timestamp.

---

## Files NOT in scope

- Anything under `open-robin-server/` or `open-robin-client/`.
- The legacy `system_wiki.secrets` row in SQLite (left dormant per §10b).
- Any other wiki articles.

---

## Acceptance criteria

1. **Three new files exist.** `PAGE.md`, `index.json`, `LOG.md` under `ai/views/wiki-viewer/content/system-tools/secrets-manager/`.

2. **Schema match — index.json.** `secrets-manager/index.json` has the same top-level keys as `custom-theme-css/index.json`. No extra keys, no missing keys.

3. **Schema match — LOG.md.** First-entry format matches `custom-theme-css/LOG.md`.

4. **Two index updates.** `system-tools/index.json` `children` includes `"secrets-manager"`. `topics.json` `topics` includes a `"system-tools/secrets-manager"` entry.

5. **Article content.** `PAGE.md` covers all six topics from §10d:
   - What this is (capabilities index)
   - How to list (sqlite3 + `$ROBIN_DB`)
   - How to use (security capture + interpolation)
   - Discipline rules (no echo, no file write, etc.)
   - What to do when a key is missing
   - Metadata fields (description, use_when, expires_at, fingerprint)
   - Progressive disclosure (one-off → skill → workflow)

6. **Platform-agnostic tone.** Search `PAGE.md` for "Claude", "Codex", "Kimi", "Gemini", "Qwen", "OpenCode", "skill", "slash-command", "MCP" — all should return zero hits. The article speaks to "the AI" generically.

7. **Article renders.** Boot the server (or use whatever the wiki-viewer renders against in dev) and confirm the new article appears in the wiki viewer's index, opens cleanly, code fences render, headings render.

8. **No out-of-scope changes.** `git status` shows changes only to the five files listed in scope.

---

## Implementation notes

- The article is the AI's instruction surface for *every* AI that runs in this harness. Be precise. Bad copy here means real values leak.
- `security` is macOS-specific. The article notes that v2 (Electron) extends to Linux/Windows. Don't pretend it's already cross-platform; don't bury the macOS-only note.
- The dot character in fingerprints is U+2022. Make sure your editor doesn't substitute it for `*` or a different bullet variant.
- Don't add a section the spec didn't ask for. The article is intentionally tight — every section earns its keep.

---

## Return format

```
Session T3 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Three new files exist:                  [pass / fail + notes]
  2. index.json schema match:                [pass / fail + notes]
  3. LOG.md schema match:                    [pass / fail + notes]
  4. Two index updates:                      [pass / fail + notes]
  5. Article content covers six topics:      [pass / fail + notes]
  6. Platform-agnostic tone:                 [pass / fail + notes]
  7. Article renders:                        [pass / fail + notes]
  8. No out-of-scope changes:                [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: convergence (E2E testing once T1 + T2 land).
```
