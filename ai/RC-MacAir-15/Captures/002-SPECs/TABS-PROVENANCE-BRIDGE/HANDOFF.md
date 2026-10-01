# TABS↔PROVENANCE BRIDGE — Session Handoff / Resume Entry Point

**Written:** 2026-09-12, end of the BRIDGE-01 design session
**Purpose:** self-contained orientation so a fresh session can continue **without
re-reading the whole context chain**. Read this file first; follow links only
when you need depth.

---

## 1. Where we are

The view-platform milestone is released (gate 6 open). A BRIDGE design session
with RC resolved the full bridge scope. **No bridge code exists yet.** Both
bridge SPECs are now authored as candidates in this bundle — BRIDGE-01
(implementable) and BRIDGE-02 (contract-only until chat exists). Independent
clean-room review is in progress; **the immediate next action is owner review
and approval of the BRIDGE-01 candidate, then dispatch to an orchestrator.**
Nothing is dispatched before that approval, and the clean status is recorded in
`RELEASE-MANIFEST.md` when a pass returns clean.

## 2. Read-first order

1. This file.
2. `DECISIONS.md` — the locked owner decisions (BRG-D01…D11).
3. `ROADMAP.md` / `roadmap.json` — the ordered work and statuses.
4. `SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md` and
   `SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md` — the two candidates.
5. Only when needed: the authoritative inputs in §6.

## 3. What the bridge is (reconciled)

- **Core direction is action → provenance:** record user/system mutations and
  attach the tab/view/component context in which they happened
  (`ComponentActionContext`). Agent→surface attachment stays state/query.
- **BRIDGE-01** adds tab/component context to UI-originated *mutation*
  provenance, reusing the accepted mediated-save carrier. **It does not build**
  the draft `ui.action`/SPEC-34 subsystem, the SPEC-40 canonical API, any
  rendering UI, retention, or non-mutating telemetry.
- **BRIDGE-02** is a contract-only approval gate that adds chat identity
  (`threadGroupId, threadId, surfaceId`) to that context, so chat is written to
  conform rather than retrofitted. Its code lands with chat.

## 4. Code reality (do not re-discover)

| Area | Exists | Draft/broken |
|---|---|---|
| Tabs (client) | TABS-03 chokepoint: `fusion-studio-client/src/components/view-tabs/componentTabPlacementController.ts` + `componentTabConnectedOwner.ts`; the placement types (`componentTabPlacementTypes.ts`) export `requestId, tabId, componentTypeId, componentInstanceId, presenterId, targetKey`; **not** workspaceId/viewId | no action/provenance seam; no global tab store; no worksurface owner |
| Provenance (server) | PROV-01 fully built: migrations `035_file_provenance.js`, `036_agent_tool_provenance.js`; `lib/agent-provenance/*`; governed `publishFact` + `STATIC_PUBLISHERS` in `lib/subscriptions/admission.js`; ledger `029_event_ledger.js` | canonical `publishCanonical`/`AcceptedCanonicalRef` (SPEC-40) **not built** |
| UI actions | `reportedUiContext {viewId, viewInstanceId}` schema on mediated save (`resource-mutated-v1`, `file-command-accepted-v1`) — **plumbed but never populated** (`state/fileDataStore.ts` does not pass it) | entire SPEC-34 `ui.action`/`uiActionId`/renderer envelope — **zero code**, blocked on `UEB-D01`/`RSC-D17` |
| Chat | `threadId` routing/persistence only; the `threads` table has a `view_id` column that is read/mapped but never written non-null, so it is not used for view binding | thread groups, `threadGroupId`, `ChatSurface`, chat `surfaceId`, ChatActionContext — **all zero code** (the only `surfaceId`/`ChatSurface` names in code are unrelated menu/theme symbols) |

**Insertion point:** the tab-owner layer (`ConnectedTabOwnerPorts`/`ConnectedTabOwnerRuntime`, `runIntent`) already carries `workspaceId`/`viewId`. Do **not** edit the fingerprint-frozen TABS-03 `componentTabPlacement*` types.

**Migration head:** `039` → next free is `040`.

## 5. Sequence (see `roadmap.json`)

1. **BRIDGE-01** — implementable now.
2. **BRIDGE-02** — contract-only.
3. **Chat packet** (`025-Chat_Composition_Roadmap/`) → chat joins provenance.
4. **View decomposition/unification** → views join provenance. A view is a
   presentation layer over files/folders (open in tab or own tab); app-style
   views add database pointers; unified document tabs add a render/raw switch
   (`../../022-Vision_Roadmap/THREADS_AND_VIEWS.md`, `../../029-Composable_Views/composable-views-vision.md`,
   `../../027-Files_Editing_and_Design_Inheritance/` D-019/CAP-025, and the parked
   successor tab SPEC in `../../028-System-View-Relocation-And-Configured-Tabs/BRIDGE-01-HANDOFF.md` §5).

## 6. Authoritative inputs

- `../TABS-PROVENANCE-COORDINATION/INTERFACE-CONTRACT.md` (planned BRIDGE-01/02 contracts)
- `../TABS-PROVENANCE-COORDINATION/OWNER-DECISIONS.md` (TPC ledger; `TPC-O03` is answered by BRG-D03)
- `../../028-System-View-Relocation-And-Configured-Tabs/BRIDGE-01-HANDOFF.md`
- `../../024-Agent-Tool-Provenance/PROV-01-INTEGRATION-REPORT.md` and its SPEC
- `../../025-Chat_Composition_Roadmap/` (SPEC-01/02/03, DECISIONS)
- `../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md` (actor/context/cause enums)
- `../../../Wiki/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md` (draft UI-action design)

## 7. Process rules (unchanged)

- One SPEC at a time; no implementation until the owner approves the exact
  candidate.
- Roadmap-creator shape: bundle index, decisions, ordered roadmap, executable
  SPECs, release manifest, clean-room review, owner approval by candidate ID.
- Fresh `spec-slice-builder` per slice; fail-forward independent review; owner
  acceptance before the next SPEC.
- Never commit unless RC asks.

## 8. Verification gates (for when implementation starts)

- Client: `npm run build` in `fusion-studio-client/`.
- Server: `npx jest --maxWorkers=2` in `fusion-studio-server/` (never full
  parallelism — two timing suites flake).
- Durable smoke: `node e2e/view-capsule-public-shell-smoke.mjs` →
  `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK` (gate file sha256-pinned — never edit).
- Accepted mediated-save + provenance regression suites must stay green.

## 9. Resume prompt

> Read
> `ai/RC-MacAir-15/Captures/002-SPECs/TABS-PROVENANCE-BRIDGE/HANDOFF.md`,
> then `DECISIONS.md`, `ROADMAP.md`, and the two SPECs. Both bridge SPECs are
> authored candidates under independent clean-room review; awaiting owner
> approval of BRIDGE-01 before dispatch.
