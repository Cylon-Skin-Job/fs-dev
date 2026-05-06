# Secrets Manager

A capabilities index for credentials. This page is the recipe for an AI
agent that needs to read and use a stored API key, token, or password —
without ever exposing the value to the chat transcript.

> **Scope:** runtime use of credentials the user has already stored. For
> changes to *how* secrets are stored, encrypted, or migrated across
> platforms, see the master spec at `docs/SECRETS_MANAGER_SPEC.md`. That
> document constrains the code; this page describes an agent workflow.

---

## What this is

Open Robin splits a credential into two parts and stores them separately:

- **Values** live in the operating system's keychain — macOS Keychain
  today, with cross-platform parity arriving via Electron's `safeStorage`
  once the desktop wrap ships. The OS handles encryption at rest.
- **Names and metadata** (description, expiry timestamp, last-four
  fingerprint) live in the SQLite database at the path exposed via
  `$ROBIN_DB`. The description carries both the human-facing summary
  and the retrieval hint that tells an agent when to reach for the key.

You can list everything that's available and capture exactly one value
for one command. You cannot read a value into a variable that survives
across commands, log it, write it to a file, or include it in a chat
message. The harness expects this discipline — the storage split only
holds if the agent honors the contract.

---

## How to list available credentials

The harness exports `ROBIN_DB` for you. Query the index directly:

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

The output is one JSON object per line. Pick the entry whose
`description` describes the task at hand — it doubles as the retrieval
hint. The values themselves are not in this table — only the names and
the hints you need to choose between them.

---

## How to use a credential

Capture the value into a shell variable inside a single bash invocation,
then immediately use it:

```bash
TOKEN=$(security find-generic-password -a "open-robin" -s "STRIPE_KEY_PROD" -w 2>/dev/null)
curl -s -H "Authorization: Bearer $TOKEN" https://api.stripe.com/v1/charges
```

The capture and the use must happen in the **same** bash invocation. The
variable is gone the moment the subprocess ends. The token never
appears in the tool-result channel — `curl` returns the response body,
not the request headers.

Two more shapes that hold the same discipline:

```bash
# Pipe to stdin instead of putting the value in argv
TOKEN=$(security find-generic-password -a "open-robin" -s "GITHUB_TOKEN" -w 2>/dev/null)
echo "$TOKEN" | gh auth login --with-token
```

```bash
# Pass to a CLI as an environment variable scoped to one invocation
ANTHROPIC_API_KEY=$(security find-generic-password -a "open-robin" -s "ANTHROPIC_KEY" -w 2>/dev/null) \
  some-tool --do-thing
```

`security` is macOS-only today. The Electron wrap (v2) extends the same
contract to Linux and Windows by routing reads through `safeStorage`
behind an identical-looking interface. Until then, on non-mac hosts
this page's `security` examples won't work and the agent should say so
plainly rather than improvise.

---

## Discipline rules

- **Never** echo a captured value: no `echo $TOKEN`, no `printf "$TOKEN"`,
  no `cat <<< "$TOKEN"`, no `set -x` around the capture line.
- **Never** write a value to a file: no `> .env`, no `>> config`, no
  `tee`, no heredoc that the value flows into.
- **Never** capture across two bash calls. The variable is gone, and
  capturing fresh in any context whose stdout the harness logs risks
  the value leaking through that log.
- **Never** include a value in a chat message, log line, ticket comment,
  or in any tool-call argument the agent constructs.
- **Never** generate a `.env` file on the user's behalf. That bypasses
  the design entirely and undoes the storage split.

If the user asks for something outside this discipline, refuse and
explain. The constraint is by design — the OS-keychain split exists
specifically so that an agent's chat transcript and tool-result stream
never become an exfiltration surface.

---

## What to do when a needed credential is missing

If the index has no row for the name you need — or `security` returns
nothing for a name that *is* in the index — the credential isn't stored.
Tell the user:

1. The expected name (the slot the agent was looking for).
2. What the credential is for (one short sentence).
3. Where to obtain it (the provider's dashboard, account settings, etc.).
4. To open the Secrets Manager — the key icon at the top right of the
   Open Robin window — and add it there.

Do **not** ask the user to paste the value into chat. The whole point
of the Secrets Manager is to avoid exactly that path.

---

## Metadata fields

Each entry in `secrets_index` carries:

| Field | Meaning |
|---|---|
| **`name`** | The slot identifier. Always UPPER_SNAKE_CASE — e.g. `STRIPE_KEY_PROD`. This is also the keychain account-name suffix. |
| **`description`** | Combined summary and retrieval hint. *What this credential is and when to reach for it.* Capped at 150 characters. This is the field to read when choosing between several similarly-named keys. |
| **`expires_at`** | Unix-ms timestamp, or null. If set and within a week of expiring, proactively warn the user the next time the credential comes up. |
| **`fingerprint`** | `••••••••••••XXXX` — twelve U+2022 dots followed by the last four characters of the value. Used for identity-match against a provider's dashboard. Not sensitive. |

---

## Progressive disclosure

The same workflow scales from one shot to long-running agents — pick
the smallest shape that fits the task:

- **One-off use.** Read this article, list the index, write one bash
  command that captures and uses the value, run it. Nothing else needed.
- **Repeated patterns.** If the agent finds itself writing the same
  `security` invocation against the same name across many sessions, the
  user may want to codify it as a per-CLI helper or a small script.
  Suggest this when the pattern is clearly recurring — don't assume.
- **Workflow or background agent.** Drop a script in a folder that
  calls `security` itself. The agent's prompt references the script by
  name and never handles the credential directly. Ask the user before
  setting this up; the storage split is preserved either way, but the
  shape of the agent changes.
