# Session T1L1 — Server Backend

**Track:** 1 (Server). **Layer:** 1 (Backend logic).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for full architectural context. Sections most relevant to this session: §3a, §5d (validation rules), §5c (fingerprint format), §6, §7a, §7b, §11b, §11c.
**Dependencies:** Session T1L0 must be complete and merged. Specifically: the `secrets_index` table exists, `lib/db.js` exports `DB_PATH`, `lib/secrets.js` exports `KEY_PATTERN`.
**Estimated size:** Medium. Three new files, all under 200 lines each. Pure backend — no UI, no WS, no events.

---

## Files in scope

### 1. `open-robin-server/lib/secrets/api-keys/fingerprint.js` (new)

Pure function. One job: compute the 12-dot + last-4 fingerprint string.

```js
/**
 * Fingerprint for an API key value.
 * Width-uniform: 12 dots + last 4 chars regardless of value length.
 * See SECRETS_MANAGER_SPEC.md §5c.
 */
function compute(value) {
  if (typeof value !== 'string' || value.length < 4) {
    throw new Error('fingerprint requires a string of length >= 4');
  }
  return '••••••••••••' + value.slice(-4);
}

module.exports = { compute };
```

The dot character is U+2022 (BULLET). Twelve of them, then four trailing chars verbatim. Don't use `*`, don't use `•` from a different code point.

### 2. `open-robin-server/lib/secrets/api-keys/index-table.js` (new)

Knex CRUD on the `secrets_index` table. One job: read and write `secrets_index` rows. **No keychain logic, no event emission, no validation beyond what the table schema enforces.**

Required exports:

```js
async function list()                          // → [{name, description, use_when, expires_at, fingerprint, created_at, updated_at}, ...]
async function get(name)                       // → row | null
async function insert(row)                     // throws on duplicate name
async function update(name, fields)            // partial update; throws on not-found
async function remove(name)                    // → boolean (was-present)
```

Use the existing knex instance from `require('../../db').getDb()` (or whatever the existing accessor pattern is — match the precedent in `lib/robin/queries.js`).

Order rows by `name ASC` in `list()` for stable UI rendering.

### 3. `open-robin-server/lib/secrets/api-keys/backend.js` (new)

Coordinates the keychain (values) and the index table (metadata). One job: provide a clean four-method API the WS handlers (Layer 2) will call. **No WS handling, no event emission — that's Layer 2.**

Imports:
- `lib/secrets.js` — keychain wrapper (uses its `set`, `get`, `del`, `KEY_PATTERN`)
- `lib/secrets/api-keys/fingerprint.js` — fingerprint computation
- `lib/secrets/api-keys/index-table.js` — index CRUD

Required exports:

```js
async function list()
// → [{name, description, use_when, expires_at, fingerprint, created_at, updated_at}, ...]
// Reads index-table only. Never returns values.

async function add({ name, value, description, use_when, expires_at })
// 1. Validate name against KEY_PATTERN; throw INVALID_NAME if not.
// 2. Validate value.length >= 8; throw INVALID_VALUE if not.
// 3. Check name not already in index; throw DUPLICATE if so.
// 4. Compute fingerprint.
// 5. Write to keychain via lib/secrets.js.
// 6. Insert into secrets_index.
// 7. If step 6 fails, attempt keychain rollback (lib/secrets.del(name)).
// → the new row.

async function update(name, { value, description, use_when, expires_at })
// 1. Existing row required; throw NOT_FOUND if not.
// 2. If `value` provided: validate length, compute new fingerprint, write to keychain.
// 3. Update index row with provided fields + new fingerprint (if value was set).
// 4. Return the updated row + a `changed_fields` array listing what actually changed.

async function remove(name)
// 1. Existing row required; throw NOT_FOUND if not.
// 2. Delete from keychain.
// 3. Delete from index.
// → true.
```

**Errors** are thrown as instances of a small `ApiKeysBackendError` class with a `code` field:

```js
class ApiKeysBackendError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
ApiKeysBackendError.INVALID_NAME = 'INVALID_NAME';
ApiKeysBackendError.INVALID_VALUE = 'INVALID_VALUE';
ApiKeysBackendError.DUPLICATE = 'DUPLICATE';
ApiKeysBackendError.NOT_FOUND = 'NOT_FOUND';
ApiKeysBackendError.BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE';
```

Layer 2 (handlers) catches these and translates to `secrets:api-keys:error` WS messages.

**Atomicity:** if either the keychain write or the index write fails partway through, attempt to roll back the other side. If rollback also fails, log loudly and throw `BACKEND_UNAVAILABLE` — the system is in an inconsistent state and the user needs to know.

---

## Files NOT in scope

- `lib/secrets/api-keys/handlers.js` — Layer 2, next session.
- `lib/secrets/index.js` — Layer 2.
- `lib/secrets.js` — already touched in T1L0; no changes here.
- `lib/event-bus.js` — events are Layer 2.
- `server.js` — Layer 3.
- Anything client-side, anything wiki.

---

## Acceptance criteria

1. **Fingerprint format.** `fingerprint.compute('sk_live_abc123_a3f7')` returns `'••••••••••••a3f7'` (12 BULLET chars + 'a3f7'). `compute` of a 4-char string returns `'••••••••••••' + the 4 chars`. `compute` of `<4` chars throws.

2. **Index-table CRUD.** Insert a row, list it back, get it by name, update one field, delete it. All round-trip cleanly. `list()` returns rows ordered by name ascending.

3. **Backend `add()` happy path.** `add({name: 'STRIPE_KEY_TEST', value: 'sk_test_abcd1234', description: 'test', use_when: 'tests', expires_at: null})` writes to both stores. Verify with `security find-generic-password -a "open-robin" -s "STRIPE_KEY_TEST" -w` and `sqlite3 ... "SELECT * FROM secrets_index WHERE name='STRIPE_KEY_TEST'"`.

4. **Backend `add()` validation.** `add({name: 'lower', value: 'sk_test_12345678'})` throws `INVALID_NAME`. `add({name: 'OK_KEY', value: 'short'})` throws `INVALID_VALUE`. `add` of an existing name throws `DUPLICATE`.

5. **Backend `update()`.** Update an existing row's `description` only — value unchanged in keychain, fingerprint unchanged, only `description` and `updated_at` change in index. Update with a new `value` — keychain rewritten, fingerprint reflects new last-4. `changed_fields` correctly lists what changed.

6. **Backend `remove()`.** Delete a row. `security find-generic-password ... -s NAME` fails with not-found. `secrets_index` row is gone. Calling `remove()` again throws `NOT_FOUND`.

7. **Atomicity.** Force a failure mid-`add()` (e.g., temporarily make `index-table.insert` throw). Verify the keychain entry was rolled back via `security`. Same in reverse.

8. **No event emission, no WS, no DOM.** `grep -r "event-bus\|emit\|WebSocket" open-robin-server/lib/secrets/api-keys/` returns zero matches. The backend is pure data-access.

9. **File sizes.** Each new file under 200 lines. If any approaches that, check it's still one job.

10. **No out-of-scope changes.** `git status` after the work shows changes only to the three new files.

---

## Implementation notes

- The keychain wrapper (`lib/secrets.js`) already validates names against `KEY_PATTERN` internally and throws `SecretsError`. Backend can either let those throws bubble (translating to `INVALID_NAME`) or pre-validate and throw its own `ApiKeysBackendError.INVALID_NAME` first. Pre-validation gives cleaner error semantics and is recommended.
- `lib/secrets.js`'s `set` does upsert (`-U` flag). Backend's `add` must check the index table to detect duplicates and reject — don't rely on the keychain to enforce uniqueness, because the index is the source of truth for "what secrets exist."
- For `update()`, accept a partial-fields object and apply only the provided fields. Don't require all fields. `changed_fields` is computed by comparing old vs new.
- Use `Date.now()` for `created_at` and `updated_at` (millisecond timestamps, matches the existing convention in other tables).

---

## Return format

```
Session T1L1 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Fingerprint format:                      [pass / fail + notes]
  2. Index-table CRUD:                        [pass / fail + notes]
  3. add() happy path:                        [pass / fail + notes]
  4. add() validation:                        [pass / fail + notes]
  5. update():                                [pass / fail + notes]
  6. remove():                                [pass / fail + notes]
  7. Atomicity:                               [pass / fail + notes]
  8. No event/WS/DOM:                         [pass / fail + notes]
  9. File sizes:                              [pass / fail + notes]
  10. No out-of-scope changes:                [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: T1L2 (handlers + UEB events).
```
