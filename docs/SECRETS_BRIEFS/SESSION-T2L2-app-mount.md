# Session T2L2 — App Mount

**Track:** 2 (Client). **Layer:** 2 (Mounting).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for context. Sections most relevant to this session: §5a (header button visual placement), §5f (mount sites).
**Dependencies:** Session T2L1 must be complete and merged. Specifically: `SecretsManagerButton.tsx` exists and exports a default. T1L3 (server wiring) is **not** required to merge T2L2 — the button can mount and load before the server side fully responds; failed list calls just leave the popover empty. They can also land in either order.
**Estimated size:** Tiny. One file edit, three identical lines added (one per mount site). Most of this brief is verification.

---

## Files in scope

### 1. `open-robin-client/src/components/App.tsx` (modify)

Mount `<SecretsManagerButton />` at three places in the header. The exact three sites are wherever `<ThemePickerButton />` is currently mounted — read App.tsx and find them. As of last inspection they were around lines 234–238 (empty state), 261–265 (loading state), and 290–294 (main render), but match whatever's actually there.

The order in `rv-header-right` per spec §5a is:

```
[ThemePickerButton] [SecretsManagerButton] [RobinButton]
```

So the new button slots between the existing theme swatch and the raven icon. At each of the three sites:

```tsx
<div className="rv-header-right">
  <ThemePickerButton />
  <SecretsManagerButton />          {/* ← new line */}
  <button className="rv-robin-icon-btn" onClick={() => setRobinOpen(true)}>
    <span className="material-symbols-outlined">raven</span>
  </button>
</div>
```

Plus one import at the top of the file:

```tsx
import SecretsManagerButton from './secrets/SecretsManagerButton';
```

Match whatever import-style App.tsx already uses for `ThemePickerButton` (named vs. default, sort order, etc.).

---

## Files NOT in scope

- Anything under `src/components/secrets/` — done in T2L1, do not modify.
- Any server file.
- Any wiki file.

If the visual sees regression or the button doesn't render, the fix lives in the secrets components from T2L1, not here. Report back rather than fixing.

---

## Acceptance criteria

1. **Button visible — empty state.** With no active workspace, the header shows three icons: theme swatch, key, raven, in that order. (Empty-state route in App.tsx.)

2. **Button visible — loading state.** While `loading=true`, the header shows the same three icons.

3. **Button visible — main state.** Active workspace, loaded — three icons, same order.

4. **Click opens popover.** Clicking the key icon opens the Secrets Manager popover. The popover renders below/anchored to the button.

5. **Existing functionality preserved.**
   - Clicking the theme swatch still opens the theme picker.
   - Clicking the raven icon still opens the Robin overlay.
   - Workspace switcher menu still opens.
   - No console errors on load or interaction.

6. **End-to-end (if T1L3 has merged).** Open the popover. The list shows whatever is currently in `secrets_index` (probably empty unless smoke tests have left rows behind). Add a key (`E2E_TEST_KEY` + a sufficiently long value + description). Confirm:
   - The new row appears in the popover at the top.
   - `security find-generic-password -a "open-robin" -s "E2E_TEST_KEY" -w` returns the value.
   - `sqlite3 "$ROBIN_DB" "SELECT * FROM secrets_index WHERE name='E2E_TEST_KEY';"` returns the row with computed fingerprint.
   - Subscribe to `secret:added` on the event bus during the add — payload has `kind: 'api-key'`, name, metadata, **no value**.
   - Delete the row via the inline confirm. All three stores (UI, DB, keychain) drop it.

7. **End-to-end (if T1L3 has NOT merged).** Open the popover. The list shows the empty state (because no `secrets:api-keys:state` came back). The "+ Add API key" form opens but submitting fails silently (no error message — the request goes out, no response comes back). This is acceptable temporary behavior; it resolves once T1L3 lands.

8. **Build passes.** `npm run build` succeeds. No TypeScript errors.

9. **Three mount sites match.** A `git diff` of `App.tsx` shows exactly three additions of `<SecretsManagerButton />` plus one import. No other changes.

10. **No out-of-scope changes.** `git status` shows changes only to `App.tsx`.

---

## Implementation notes

- The brief explicitly says "match whatever's there" for line numbers because App.tsx has been edited many times. Find the three `<ThemePickerButton />` occurrences via grep and add a `<SecretsManagerButton />` immediately after each one.
- The "key" icon for the new button is purely a Material Symbols name; the button component itself defines its visual. No icon work in App.tsx.
- If T1L3 hasn't merged yet, prefer to ship this anyway — it doesn't block on the server. Criterion 6 just gets deferred until both tracks have landed.

---

## Return format

```
Session T2L2 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Button visible — empty state:           [pass / fail + notes]
  2. Button visible — loading state:         [pass / fail + notes]
  3. Button visible — main state:            [pass / fail + notes]
  4. Click opens popover:                    [pass / fail + notes]
  5. Existing functionality preserved:       [pass / fail + notes]
  6. End-to-end (T1L3 merged):               [pass / fail / N/A — T1L3 not yet merged]
  7. End-to-end (T1L3 NOT merged):           [pass / fail / N/A — T1L3 has merged]
  8. Build passes:                           [pass / fail + notes]
  9. Three mount sites match:                [pass / fail + notes]
  10. No out-of-scope changes:               [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: convergence — full E2E once both T1L3 and T2L2 are merged.
```
