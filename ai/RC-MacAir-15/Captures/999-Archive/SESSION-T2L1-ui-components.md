# Session T2L1 — Client UI Components

**Track:** 2 (Client). **Layer:** 1 (UI components).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for context. Sections most relevant to this session: §5 (entire UI section), §6c (the boundary the UI must respect).
**Dependencies:** Session T2L0 must be complete and merged. Specifically: `useSecretsStore`, `api-keys-api.ts` exports, and the `ws-client.ts` dispatcher entries all exist.
**Estimated size:** Medium. Three new component files. Largest is `ApiKeysPanel.tsx` — ~150 lines first cut.

This session is the visible deliverable. Match the polish of the existing `ThemePicker` work — that's the precedent for "feature lifted out of Robin overlay into header."

---

## Files in scope

### 1. `open-robin-client/src/components/secrets/SecretsManagerButton.tsx` (new)

Header key button. Toggles a popover when clicked. Mirror `ThemePickerButton.tsx` exactly — read it first; this file should differ from it only in icon (`key` instead of `palette`), the popover component it mounts, and class names (`rv-secrets-*` instead of `rv-theme-*`).

Open/close behavior **must match** `ThemePickerButton.tsx`:
- Click toggles open.
- Outside-click closes.
- Escape closes.
- The outside-click listener uses the same useEffect-with-pointerdown pattern.

When the popover opens, dispatch a `listApiKeys()` call (from `api-keys-api`) so the store populates. The popover renders from the store.

### 2. `open-robin-client/src/components/secrets/SecretsManager.tsx` (new)

Popover shell. Renders the container header (`Secrets`) and the active sub-module body. v1 has only API Keys, so the body always renders `<ApiKeysPanel />`. No tabs UI, no sub-module selector.

```tsx
import ApiKeysPanel from './api-keys/ApiKeysPanel';

interface Props { onClose: () => void; }

export default function SecretsManager({ onClose }: Props) {
  return (
    <div className="rv-secrets-manager">
      <div className="rv-secrets-manager-header">Secrets</div>
      <div className="rv-secrets-manager-divider" />
      <div className="rv-secrets-manager-body">
        <ApiKeysPanel onClose={onClose} />
      </div>
    </div>
  );
}
```

Width 360px, max height 80vh — apply via class. Styles inline as a `<style>` tag injected once (match the precedent in `ThemePicker.tsx`), or via a sibling `.css` file if that's the project convention. Prefer matching the precedent exactly.

### 3. `open-robin-client/src/components/secrets/api-keys/ApiKeysPanel.tsx` (new)

The actual UI. Renders the list of API keys plus the inline add form. Handles delete confirmation and field validation.

Required behavior:

**List rendering** (per §5c):
- Each row: name (mono), fingerprint (mono), `[✕]` delete button.
- Optional second line: description / expiry / relative `updated_at`.
- Empty state: *"No API keys stored yet. Add keys and tokens your scripts need to talk to outside services."*

**Add form** (per §5d):
- "+ Add API key" button at the bottom of the list.
- Click expands the form inline.
- Three always-visible fields: Name, Value, Description.
- "More options" disclosure expands `Use when` and `Expires`.
- Cancel button collapses without saving.
- Save button calls `setApiKey(...)` then collapses on success.

**Live name validation** (per §5d):
- Regex: `/^[A-Z][A-Z0-9_]*$/` — match `lib/secrets.js`'s `KEY_PATTERN` exactly.
- Green check or invisible OK indicator when valid.
- Red message when invalid: *"Names use UPPER_SNAKE_CASE: `STRIPE_KEY_PROD`, `GITHUB_TOKEN`. Letters, digits, underscores only — must start with a letter."*
- Save disabled until name passes regex AND value length ≥ 8.

**Duplicate handling**:
- Before submitting, check `useSecretsStore.getState().apiKeys` for an existing entry with the same name.
- If found: prompt inline *"`STRIPE_KEY_PROD` already exists. Update existing?"* with [Cancel] [Update] buttons.
- On Update, send `setApiKey(...)` (same protocol — server distinguishes by checking).

**Delete confirmation** (per §5c):
- `[✕]` on a row swaps that row's right side to *"Delete `STRIPE_KEY_PROD`? [Cancel] [Delete]"*.
- Cancel reverts. Delete fires `deleteApiKey(name)`.

**Error handling**:
- Subscribe to `secrets:api-keys:error` messages (extend `apiKeysStore` if needed, OR handle locally via a transient component-state error banner — match whatever precedent the theme picker established).
- On `INVALID_NAME` / `INVALID_VALUE` / `DUPLICATE`: show the relevant message inline near the form.
- On `BACKEND_UNAVAILABLE`: show a top-of-popover red banner — *"Couldn't reach secrets storage. Try again, or restart Open Robin."*

**No values stored.** The form's `value` field is component-local state. Once `setApiKey` is called, clear it. Never write it to the store, never log it, never include it in props passed to children.

---

## Files NOT in scope

- `App.tsx` mount sites — Layer 2, next session.
- `secretsStore.ts`, `api-keys-api.ts`, `ws-client.ts` — done in T2L0, do not modify.
- Any server file.
- Any wiki file.

If `apiKeysStore` needs an additional field (e.g., for the latest error message), that's a small extension worth adding here. Note it in the surprises section of the return report.

---

## Acceptance criteria

1. **Header button mirrors ThemePickerButton.** Visual diff against `ThemePickerButton.tsx` — same open/close mechanics, same focus styling, same outside-click handler. Only differences: icon, mounted popover, class names.

2. **Popover opens.** Clicking the key icon opens `SecretsManager`. Escape closes. Outside-click closes. Re-clicking the key icon toggles closed.

3. **List renders.** With `useSecretsStore` populated (manually or via WS), the list shows one row per entry. Fingerprint renders as `••••••••••••XXXX` (12 BULLET chars + last 4). Empty state shows when zero entries.

4. **Add form opens, validates name live.** Type `lower` → red "UPPER_SNAKE..." message. Type `STRIPE_KEY` → message clears, indicator green. Save is disabled while message is red. Save is disabled when value length < 8.

5. **Add form submits.** Fill name, value, optionally description / use_when / expires_at. Click Save. The form sends a correctly-shaped `setApiKey(...)`. Form clears and collapses on the next state broadcast (don't preemptively close before the round-trip).

6. **Duplicate prompt.** Submitting a name that already exists in the store shows the "already exists. Update existing?" prompt before sending. Confirming sends. Cancelling does nothing.

7. **Delete confirm flow.** Click `[✕]` → row's right side becomes inline confirm. Click Cancel → reverts. Click Delete → sends `deleteApiKey(name)`.

8. **Error display.** Force a `secrets:api-keys:error` (mock or send a bad request). The error banner appears with the spec's prescribed copy. Subsequent successful operations clear the error.

9. **No values in DOM after submit.** After successful add, search the DOM tree for the test value string — zero matches. The form's `value` field has been cleared from state.

10. **Type-check and build.** `tsc --noEmit` clean. `npm run build` succeeds.

11. **Component portability.** Components import only: React, the store, `api-keys-api`, sibling components. They do not import from `open-robin-server` (per the cross-project import rule). They do not directly call `fetch` or `sendMessage` — only via `api-keys-api`.

12. **No out-of-scope changes.** `git status` shows changes only to the three new files. (Plus `apiKeysStore.ts` if you extended it — note in surprises.)

---

## Implementation notes

- Read `ThemePickerButton.tsx`, `ThemePicker.tsx`, and any `theme-picker.css` (or equivalent) before starting. They're the precedent for nearly every decision in this session.
- The fingerprint uses U+2022 (BULLET). Don't use `*` or a different bullet character. The server-side stored value uses U+2022; the client just renders `entry.fingerprint` directly without re-formatting.
- For class names use `.rv-secrets-*` prefix to avoid collisions, matching `.rv-theme-*` precedent.
- Match the precedent for stylesheet handling. If `ThemePicker.tsx` injects styles via a `<style>` tag, do the same. If it imports a `.css` file, do the same.
- Visual polish — make this look at least as good as the theme picker. The user will visually evaluate this.

---

## Return format

```
Session T2L1 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Header button mirrors ThemePickerButton: [pass / fail + notes]
  2. Popover open/close:                      [pass / fail + notes]
  3. List renders:                            [pass / fail + notes]
  4. Add form live validation:                [pass / fail + notes]
  5. Add form submits:                        [pass / fail + notes]
  6. Duplicate prompt:                        [pass / fail + notes]
  7. Delete confirm flow:                     [pass / fail + notes]
  8. Error display:                           [pass / fail + notes]
  9. No values in DOM:                        [pass / fail + notes]
  10. Type-check and build:                   [pass / fail + notes]
  11. Component portability:                  [pass / fail + notes]
  12. No out-of-scope changes:                [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: T2L2 (mount in App.tsx) — but only after T1L3 ships, since the UI needs a server to talk to for E2E.
```
