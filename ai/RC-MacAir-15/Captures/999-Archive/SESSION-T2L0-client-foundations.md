# Session T2L0 — Client Foundations

**Track:** 2 (Client). **Layer:** 0 (State + transport).
**Master spec:** `docs/SECRETS_MANAGER_SPEC.md` — read this for full architectural context. Sections most relevant to this session: §5 (UI shape — for typing the store), §8a (WS protocol), §11h.
**Dependencies:** None for code. The WS protocol is documented in §8a; the server-side implementation isn't required to write the client side.
**Estimated size:** Small. Three files, all under 150 lines each. No UI yet — that's L1.

---

## Files in scope

### 1. `open-robin-client/src/state/secretsStore.ts` (new)

Zustand store mirroring `secrets:api-keys:state` payloads. **Holds index entries only — never values.**

```ts
import { create } from 'zustand';

export interface ApiKeyIndexEntry {
  name: string;
  description: string | null;
  use_when: string | null;
  expires_at: number | null;        // unix ms, nullable
  fingerprint: string;              // '••••••••••••XXXX'
  created_at: number;
  updated_at: number;
}

interface SecretsStore {
  apiKeys: ApiKeyIndexEntry[];
  setApiKeys: (items: ApiKeyIndexEntry[]) => void;
}

export const useSecretsStore = create<SecretsStore>((set) => ({
  apiKeys: [],
  setApiKeys: (items) => set({ apiKeys: items }),
}));
```

That's the entire file. Match the precedent set by `panelStore.ts` or `wikiStore.ts` in the same folder for any conventions (file header comment, etc.).

**Critical rule:** the store holds names + metadata only. There is no `value` field on `ApiKeyIndexEntry`, no method that takes a value, no place a value can sit in client state. Per §5d, the client never has values in scope.

### 2. `open-robin-client/src/components/secrets/api-keys/api-keys-api.ts` (new)

Typed thin wrappers around `secrets:api-keys:*` WS messages. **One job:** translate UI intent into WS messages with correct shapes.

Exports:

```ts
export function listApiKeys(): void
// Sends { type: 'secrets:api-keys:list' }

export function setApiKey(opts: {
  name: string;
  value: string;
  description?: string;
  use_when?: string;
  expires_at?: number | null;
}): void
// Sends { type: 'secrets:api-keys:set', ...opts }

export function deleteApiKey(name: string): void
// Sends { type: 'secrets:api-keys:delete', name }
```

Use the existing `sendMessage` (or whatever the project's WS-send primitive is — look at how `theme-api.ts` does it for the precedent). Don't open new WS connections; reuse the singleton.

No error handling here — errors come back via `secrets:api-keys:error` messages dispatched to the store/components in L1. This module is fire-and-forget send.

### 3. `open-robin-client/src/lib/ws-client.ts` (modify — add dispatcher entries)

This file is the WS client / dispatcher. Find the existing pattern that handles `theme:state` (or `robin:wiki`, or any incoming message routed to a store) and add an analogous entry for `secrets:api-keys:state`.

The entry should:
1. Match `msg.type === 'secrets:api-keys:state'`.
2. Call `useSecretsStore.getState().setApiKeys(msg.items)`.

There may also be patterns to add for `secrets:api-keys:error` if the existing dispatcher routes errors uniformly — match that precedent. If errors are dispatched ad-hoc per-component, leave that for L1.

**Do not** add a request/response correlation pattern, retry logic, or timeout handling. Match what the codebase already does — any new ceremony belongs in a separate refactor.

---

## Files NOT in scope

- `ApiKeysPanel.tsx`, `SecretsManager.tsx`, `SecretsManagerButton.tsx` — L1.
- `App.tsx` mount sites — L2.
- Anything server-side.
- Anything wiki.

---

## Acceptance criteria

1. **Store shape.** `useSecretsStore.getState().apiKeys` is `[]` on initial load. `setApiKeys([{name: 'X', fingerprint: '...', ...}])` populates it. Store has no `value` field, no method taking a value.

2. **Type-check passes.** `tsc --noEmit` (or whatever the project's typecheck command is) passes after the changes. No `any`, no missing properties on the interface.

3. **WS wrappers send correct shapes.** Spy on the WS-send primitive. `listApiKeys()` sends `{type: 'secrets:api-keys:list'}` exactly. `setApiKey({name: 'STRIPE_KEY_TEST', value: 'sk_test_abc12345'})` sends `{type: 'secrets:api-keys:set', name: 'STRIPE_KEY_TEST', value: 'sk_test_abc12345'}` (optional fields omitted). `deleteApiKey('X')` sends `{type: 'secrets:api-keys:delete', name: 'X'}`.

4. **Dispatcher routes `secrets:api-keys:state`.** Simulate a server message `{type: 'secrets:api-keys:state', items: [{name: 'X', fingerprint: '••••••••••••XXXX', description: null, use_when: null, expires_at: null, created_at: 0, updated_at: 0}]}`. After dispatch, `useSecretsStore.getState().apiKeys` contains exactly that one entry.

5. **No values anywhere in client state.** `grep -r "value" open-robin-client/src/state/secretsStore.ts open-robin-client/src/components/secrets/` shows no occurrences except in the `setApiKey` function's `opts.value` (the send-only path, never stored). Specifically: `secretsStore.ts` has zero occurrences of the word `value`.

6. **Build passes.** `npm run build` (or equivalent) succeeds.

7. **No out-of-scope changes.** `git status` shows changes only to `secretsStore.ts`, `api-keys-api.ts`, and `ws-client.ts`.

---

## Implementation notes

- The `secrets/api-keys/` folder under `components/` may not exist yet — create it. The `secrets/` parent folder also new. Mirror the convention of any existing nested-component folder in the project.
- For the WS dispatcher, the file `src/lib/ws-client.ts` already has dispatch logic for many message types. Read it before writing — match the existing pattern (switch statement, map lookup, whatever it uses) rather than introducing a new pattern.
- No CSS in this session. UI styling is L1.
- No `useEffect`, no React hooks beyond what Zustand provides. This is pure state + transport.

---

## Return format

```
Session T2L0 complete.

Files changed:
  - <git diff stat>

Acceptance criteria:
  1. Store shape:                            [pass / fail + notes]
  2. Type-check passes:                      [pass / fail + notes]
  3. WS wrappers send correct shapes:        [pass / fail + notes]
  4. Dispatcher routes state:                [pass / fail + notes]
  5. No values in client state:              [pass / fail + notes]
  6. Build passes:                           [pass / fail + notes]
  7. No out-of-scope changes:                [pass / fail + notes]

Surprises / blockers:
  <anything unexpected; otherwise "none">

Ready for: T2L1 (UI components).
```
