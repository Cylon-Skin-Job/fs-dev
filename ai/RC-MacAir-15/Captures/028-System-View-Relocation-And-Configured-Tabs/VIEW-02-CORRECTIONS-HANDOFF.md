# VIEW-02 Corrections Handoff — Riff Session Starter

**Written:** 2026-09-10 (evening), by the VIEW-01/completions session
**Purpose:** self-contained context for a fresh session to explore and plan the
VIEW-02 corrections with RC before implementation begins.
**Read first:** `VIEW-02-OWNER-DIRECTIVE.md` (same bundle) — it is the
authoritative owner direction. This file adds state, mechanics, and open
questions; where they overlap, the directive wins.

---

## 1. One-paragraph state

VIEW-01 is accepted and closed (report + acceptance ledger in
`RELEASE-MANIFEST.md`; 002 drift ledger in `RECOVERY-002-CLOSURE.md`). A VIEW-02
implementation by a separate session exists **uncommitted** in the worktree —
new adapters/presenters under `src/components/view-tabs/` and
`src/components/{capture,file-explorer}/`, `tabs` config in live + template
`content.json` — but it has **no implementation report** and is mid-flight.
RC dogfooded it, found the chrome layering wrong, and issued a directive
(top bar default; location rail = the single path row
`View > folders > filename`; presenters define structure beneath only) plus a
consolidation mandate (one open entry point per domain; delete the classic
fallback web). The current session applied three interim patches (see §5) and
wrote the directive/memo docs. The corrections work is NOT started beyond that.

## 2. Where everything lives

- **Worktree (the candidate, do not commit/revert/clean):**
  `/Users/rccurtrightjr./.codex/worktrees/9572/fs-dev` — detached at `7f0d3c8`,
  dirty tree = accepted VIEW-01 + VIEW-02 session's uncommitted work + interim
  patches + bundle docs. Never touch the Alpha installation or the primary
  checkout's live tree.
- **Bundle (both copies, keep mirrored):** `ai/RC-MacAir-15/Captures/028-
  System-View-Relocation-And-Configured-Tabs/` in the worktree AND in
  `/Users/rccurtrightjr./projects/fs-dev/…`. Key docs: SPEC-02,
  VIEW-02-OWNER-DIRECTIVE.md, VIEW-02-DISPATCH-PACK.md, VIEW-01-IMPLEMENTATION-
  REPORT.md, RECOVERY-002-CLOSURE.md, RELEASE-MANIFEST.md (acceptance ledger).
- **RC's dogfood profile:** `~/.fusion-view01-acceptance` (preserves their
  walk layout). Launch the app:
  ```
  cd <worktree>/fusion-studio-client
  env FUSION_APP_USER_DATA="$HOME/.fusion-view01-acceptance" \
      FUSION_LOCAL_MACHINE=RC-MacAir-15 \
      ./node_modules/.bin/electron electron/main.cjs
  # server port: cat ~/.fusion-view01-acceptance/server.port
  # browser mirror: http://localhost:<port>/  (degraded; window is authoritative)
  ```
  Rebuild renderer: `npm run build` in the client dir (~4s). A running instance
  from this session may still be up (port 54283) — quit via
  `pkill -TERM -f fusion-view01-acceptance` plus any leftover
  `worktrees/9572/fs-dev/fusion-studio-server` child.

## 3. The corrections to figure out (riff material)

Summaries; full text in `VIEW-02-OWNER-DIRECTIVE.md` §1 (layering) and §4
(consolidation mandate).

1. **Chrome layering** — RC's before/after: today a Capture document shows
   rail(`Capture > Documents and Artifacts`) + centered filename + subheader;
   target is rail(`Capture > Captures <file.md>`) + subheader only. File view:
   rail + content, nothing else. Top identity bar stays the shell default.
2. **Single entry points** — every open funnels through
   `openCaptureDocument` / file equivalent with disposition; no classic
   fallback branches (`openDocFullScreen` classic path, `isTabsMode` shim,
   preview-modal local logic).
3. **Dead code retirement** — classic full-page open, legacy capture tabs
   mode, old local match/fill (`openFileTab`), duplicate chrome in classic
   `FilePageView` paths.
4. **Dock button in the rail** — needs a shell trailing-action slot in
   `TabLocationRail` (it currently supports only presenter Back/Forward).
   Interim: floating control in the file presenter.

## 4. Known defects (verified, not speculation)

- **Legacy hydration broken**: cold start renders an Empty tab instead of
  persisted classic file tabs; RC's live tab state was reset 6→1 by the
  adapter (SPEC-02 §10 violation).
- **Fallback web**: opens resolve differently per entry point/timing (why RC
  saw "caching" that wasn't — served bundle verified current, shell protocol
  sends no-store).
- **Location rail showed landing labels** on a document tab
  (`Documents and Artifacts`) despite adapters building
  `['Capture', collection, name]` — projection refresh per active target
  needs verification.
- **Migration 009 hazard**: every fresh profile DB seeds the dev workspace
  (repo path from the server's location) and auto-activates/hydrates the real
  tree. Any Electron test must pre-migrate + strip `fs-dev` and
  `last_active_workspace_id` (working pattern:
  `fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs`).
- Minor: empty-state overlay intercepts the workspace-ribbon Add button
  (found while probing; needs a z-index/pointer-events pass).
- Dev profile `fs-dev` row points at a stale packaged-resources path
  (why the acceptance walk used a fresh profile).

## 5. Interim patches already in the tree (reconcile, don't blindly revert)

- `capture/DocumentPreviewModal.css` — backdrop anchored to
  `.rv-content-area` (scoped blur; fixes both the miscentering and the
  full-app blur).
- `file-explorer/FileDocumentPresenter.tsx` + new `.css` — info bar removed,
  content-direct layout, floating dock control, drawer collapse wired to
  `--file-tree-w`.
- `capture/CaptureTiles.tsx` — right-click tile opens route placement-first.

## 6. Verification gates for whoever implements

- VIEW-01 durable smoke must pass unmodified:
  `node e2e/view-capsule-public-shell-smoke.mjs` (client dir) →
  `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`.
- Server: `npx jest --maxWorkers=2` (full parallelism flakes two timing
  suites; they pass isolated).
- Client: `npm run build`.
- Owner visual checklist SPEC-02 §13 + directive §5 additions.
- Protected-byte discipline: sentinels listed in `RECOVERY-002-CLOSURE.md`;
  002 baseline `b2acb1ab…` with owner-blessed openedAt re-stamps; live-tree
  view-state changes from RC's own use are owner activity, not drift.

## 7. Open questions worth riffing with RC

- Does the single-tab identity row keep centering the **document filename**
  for doc tabs (redundant with the rail terminal), or show the view identity?
- Where exactly does the dock control land — rail trailing slot (shell
  change, needs review) vs floating (current interim)?
- Preview modal's relationship to placement: is preview a disposition or a
  separate surface (SPEC says previews remain previews)?
- Hydration semantics: when legacy classic tabs exist AND generic records
  exist, who wins, and how did the live state get reset?
- Can legacy capture-tabs mode die now, or does any state still depend on it?

## 8. Process reminders

- Owner acceptance gates: VIEW-02 acceptance requires the SPEC §13 visual
  walk; BRIDGE-01 stays blocked until RC releases the view-platform
  milestone. After VIEW-02: generate the BRIDGE-01 provenance SPEC next
  (RC's roadmap: tabs → provenance → chat extraction, one SPEC at a time).
- Report requirements: GUIDANCE.md "Required implementation report contents";
  the VIEW-02 session still owes its implementation report.
- Never commit unless RC asks; the dirty tree is the candidate.

## 9. Codebase map (session-learned — saves re-exploration)

**Renderer chrome/layout**
- `src/components/App.tsx` — `PanelWrapper` computes panel CSS vars per view:
  `--file-tree-w`, `--right-col-w`, `--left-chat-w` from
  `panelStore.viewStates[panelId]` (widths/collapsed). `main.rv-content-area`
  (App.css:245) is the positioned, overflow-hidden content container.
- `src/components/view-tabs/` — the accepted tab platform + VIEW-02 adapters:
  `TabLocationRail.tsx` (rail; presenter Back/Forward only, no action slot),
  `componentTabShell.css` (single-chrome 36px, rail 54px),
  `componentTabLauncherCatalog.ts`, `componentTabConnectedAdapter.ts`,
  `captureViewTabAdapter.ts` (presenter registrations incl.
  `capture.document`), `captureConnectedTabs.ts` (`openCaptureDocument`,
  `isCaptureConnectedActive`, scroll persistence),
  `captureConnectedOwnerPorts.ts` (`resolveCaptureDocumentTarget` — was dead
  code), `captureClassicConversion.ts`, `fileConnectedAdapter.ts`.
- `src/components/capture/` — `CaptureTiles.tsx` (landing grid; open
  handlers: left-click preview, right-click → placement (patched),
  `openDocFullScreen` placement-first with classic fallback;
  `loneCaptureIsHandingOff` branch), `CaptureDocumentPresenter.tsx`
  (passes `hideChromeTitle` to FilePageView), `FilePageView.tsx` (classic
  doc page: DocViewerChrome + identity + subheader `rv-capture-document-
  subheader`), `DocumentPreviewModal.{tsx,css}` (blur backdrop, now anchored
  to `.rv-content-area`).
- `src/components/file-explorer/` — `FileViewer.tsx` (classic),
  `FileDocumentPresenter.{tsx,css}` (connected; patched),
  `FileTreeDrawer.tsx` (renders `.rv-file-tree-sidebar` unconditionally),
  `FilePickerDrawerLayer.css` (the only other `--file-tree-w` consumer),
  `FileNode.tsx` (`.rv-file-tree-item` tree rows), `FileTree.tsx`.
- State: `src/state/panelStore.ts` (widths/collapsed per view;
  `toggleCollapsed('file-viewer','rightCol')` drives the drawer),
  `fileDataStore`, `fileStore`. View state persists server-side via
  `lib/view-state/writer.js` (STATE_OVERRIDE_SPEC §7; hydration re-stamps
  `activity.tabs[].openedAt`).

**Server**
- `lib/views/` — VIEW-01 modules (canonical root owner, readiness,
  relocation journal/service, `view-capsules-projection.js` → `panel_config`
  `viewCapsules`; VIEW-02 adds `tabPolicies` here per SPEC §4).
- `lib/db.js` — DB path from `FUSION_APP_USER_DATA` at module load;
  migrations in `lib/db/migrations/` (009 seeds the dev workspace +
  `last_active_workspace_id` into every fresh DB — the test hazard;
  038/039 = relocation journal + canonical wiki path).
- Workspace attach/create: `lib/workspace/create-service.js` (templates at
  `System_Manager/ai-template/templates/view-templates/`); template capsules
  `002-capture-viewer`, `010-file-viewer` carry the `tabs` config.

**Electron**
- `electron/main.cjs` (spawn, menu labels 'Add Project...' /
  'Create New Project...', single-window), `runtime-ipc.cjs` (ONE committed
  shell frame — duplicate windows are denied by design),
  `shell-protocol.cjs` (`fusion-shell://app/`, no-store),
  `port-file.cjs` (`server.port` in userData), `view-capsule-registry.cjs`.

**Tests/e2e**
- `fusion-studio-client/e2e/view-capsule-public-shell-smoke.mjs` — the
  durable VIEW-01 gate + the isolated-profile pattern (pre-migrate, strip
  seed, per-launch registry guard, sentinel byte assertions).
- `view-capsule-projection.spec.ts` — projection/race matrix (fanout
  coverage). Server suites: `npx jest --maxWorkers=2`.

## 10. Continuing the build after the corrections (RC's sequence)

1. **Finish VIEW-02**: corrections per this handoff + directive → the owning
   session writes its implementation report (GUIDANCE contents) → RC runs the
   SPEC §13 visual walk + directive §5 additions → owner acceptance.
2. **RC explicitly releases the view-platform milestone** (gate 6 in
   `RELEASE-MANIFEST.md`). Only then:
3. **Generate BRIDGE-01 (Tabs↔Provenance bridge) SPEC together with RC** —
   one SPEC at a time per RC's rule. Inputs to reconcile: PROV-01 (accepted,
   `../024-Agent-Tool-Provenance/`), accepted VIEW-01/02 contracts, and the
   provisional material already in the tree (`../022-Vision_Roadmap/`
   decisions, `../025-Chat_Composition_Roadmap/` SPECs). Consider the
   roadmap-creator workflow at this point.
4. **BRIDGE-02 → then Chat extraction** (Composable Chat,
   `../025-Chat_Composition_Roadmap/`), same pattern: SPEC → fresh
   orchestrator → independent review → owner acceptance.
5. Standing rule throughout: VIEW work never starts Bridge/Chat/prompt/
   collection/plug-in/Side-Chat work without explicit owner release.
