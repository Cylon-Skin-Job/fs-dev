# VIEW-02 Dispatch Pack — for a fresh implementation session

**Written:** 2026-09-09, after VIEW-01 owner acceptance
**Purpose:** hand a fresh orchestrator everything needed to implement
`SPEC-02-VIEW-CONFIGURED-TAB-ADOPTION.md` safely against the **accepted** VIEW-01
integration. This pack reconciles the frozen 2026-09-07 planning candidate with facts
learned during VIEW-01 implementation, review, and acceptance. It does not modify the
candidate SPEC; where this pack and the SPEC appear to conflict, stop and ask the owner.

## 1. Authority chain (read in this order)

1. Repo `AGENTS.md` (root) and `fusion-studio-server/AGENTS.md` at the worktree root.
2. Bundle (this directory): `SPEC-02-VIEW-CONFIGURED-TAB-ADOPTION.md`, `DECISIONS.md`
   (VRT-008 through VRT-015 govern VIEW-02), `GUIDANCE.md` (VIEW-02 lifecycle §),
   `CODE-INVENTORY.md`, `ISSUES.md`.
3. `VIEW-01-IMPLEMENTATION-REPORT.md` + `RECOVERY-002-CLOSURE.md` (accepted contracts,
   hazards, and the 002 ledger).
4. Routed code standards under `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/`
   (002-Frontend_UI, 003-State_Management, 004-WebSocket_Protocol are most relevant).

**Worktree:** `/Users/rccurtrightjr./.codex/worktrees/9572/fs-dev` — detached at
`7f0d3c8`, dirty tree IS the accepted VIEW-01 candidate (252 entries at acceptance plus
session artifacts: this bundle's new docs and the rewritten
`fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs`). Do not commit, revert,
normalize, or "clean" it. Never touch the Alpha installation or the primary checkout's
live tree.

## 2. State of the live workspace the SPEC targets

- Canonical root: `ai/RC-MacAir-15/System/Views/` — **nine capsules at acceptance**
  (`001-capture-viewer`, `002-file-viewer`, `003-issues-viewer`, `004-wiki-viewer`,
  `005-browser-viewer`, `006-custom-viewer`, `007-agents-viewer`, `008-contacts-viewer`,
  `009-office-viewer`); the owner added/reordered during the acceptance walk. Retired
  root `ai/RC-MacAir-15/Views` is absent and must stay absent.
- VIEW-02 Slice 3/4 "live capsule" targets: `001-capture-viewer` and
  `002-file-viewer` `content.json`. Canonical template targets:
  `System_Manager/ai-template/templates/view-templates/002-capture-viewer` and
  `010-file-viewer`.
- The owner may keep using the app on this worktree between sessions. Treat live-tree
  view-state byte changes as owner activity, not drift; the durable baseline for
  `002-file-viewer/state/state.json` is the ledger in `RECOVERY-002-CLOSURE.md`
  (hydration re-stamps `activity.tabs[].openedAt` on every activation by design).

## 3. Accepted VIEW-01 contracts you must build on (not reimplement)

- `panel_config` already carries the bounded `viewCapsules` projection
  (`lib/views/view-capsules-projection.js`; renderer
  `src/lib/view-capsule-projection.ts`; Electron `view-capsule-registry.cjs`). The new
  `tabPolicies` map rides the same message and must follow the same discipline: one
  server-side projection function, fresh projection on every successful registry
  mutation, path-free payload.
- Trusted-shell admission (connection-owned role, `lib/ws/trusted-shell-authority.js`)
  is required for any WebSocket-entered narrow service. VIEW-02 adds **no** WS
  messages and no new persistence (SPEC §3 non-goals hold); config is read at normal
  refresh boundaries only.
- Protected-path policy covers `System/Views` and the retired namespace: your config
  writes to live/template `content.json` are working-tree edits made by the
  implementer, not runtime product writes; no runtime path may write them without a
  future validated-config service (out of scope).
- The relocation journal (`view_capsule_relocations`, migrations 038/039) is
  cutover-only; nothing in VIEW-02 touches it.

## 4. Hard-won test-isolation rules (mandatory for any Electron/e2e work)

1. **Migration 009 seeds the dev workspace into every fresh profile DB** — repo path
   resolved from the server's own location — and auto-activates it, hydrating (and
   re-stamping) the real live tree. This caused two real incidents (see closure
   ledger §7). Mitigation is established in
   `fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs`: pre-apply all
   migrations against the isolated profile yourself, then delete the `fs-dev` row and
   the `last_active_workspace_id` seed before any launch; keep the profile outside
   fixture directories; assert before every launch that the registry contains no
   workspace resolving to the repo root; in `finally`, byte-assert the sentinel files,
   retired-root absence, and canonical-root inode.
2. **The public shell commits exactly one frame** (`electron/runtime-ipc.cjs`): a
   second BrowserWindow is denied the runtime descriptor/trusted IPC by design. Do not
   write multi-window tests; the duplicate-window denial pattern is in the smoke.
3. Current sentinel expectations (post-acceptance): `9ca40dea…` 022 CAPTURE,
   `64f6993d…` 022 DECISIONS, `c8301be2…` 028 DECISIONS, `e53c55f8…` System state
   (re-verify at your session start — the owner uses the app),
   `6a99fd03…`/`24cc4db2…` themes, `20a26f99…` 001 state, `b2acb1ab…` 002 state
   (baseline; expect openedAt re-stamps from owner use).
4. Server timing suites (`event-registry/startup-integration`,
   `resources/file-provenance-integration`) can flake under full parallel workers;
   `npx jest --maxWorkers=2` is the stable full-run form.

## 5. Verification gates (beyond SPEC-02 §12)

- Server: `npx jest --maxWorkers=2` → 194/194 suites baseline (your suites add to it).
- Client: `npm run build` (includes preload build).
- **The VIEW-01 durable smoke must still pass unmodified after your changes**
  (`node e2e/view-capsule-public-shell-smoke.mjs` from the client dir →
  `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`): VIEW-02 changes tab chrome the smoke drives.
  If a smoke step legitimately changes behavior, stop and ask the owner — do not edit
  the smoke to fit the implementation.
- Stale-path scan discipline: no new construction of either Views root outside the
  canonical owner/migration-only helpers.

## 6. Lifecycle constraints (from GUIDANCE + DECISIONS)

- One adopter at a time: Capture (Slice 3) fully passes before File Explorer (Slice 4).
- No Side Chat anywhere, not even disabled. No Wiki production conversion.
- Preserve existing state owners (VRT-013): no second tab store; acknowledged atomic
  commits; the file data/content owner, dirty/pending close protection, and
  autocomplete effects stay intact.
- Keep the generic shell and TABS-03 placement controller unchanged unless you can
  demonstrate an accepted-contract defect; solve convenience mismatches in the
  connected adapter.
- Fail-forward independent review; classify every deviation
  compatible/approved/blocking/deferred in your report.
- Your implementation report must include everything in GUIDANCE "Required
  implementation report contents" plus the SPEC §13 plain-English launch recipe for
  the owner visual walk (use the VIEW-01 §9 launch recipe pattern).

## 7. Acceptance

Owner acceptance of VIEW-02 requires the SPEC §13 visual checklist exercised on the
real Electron surface. Only after that may the owner release the view-platform
milestone and authorize BRIDGE-01. Do not begin any Bridge, Chat, prompt, collection,
plug-in, or dynamic-registration work.
