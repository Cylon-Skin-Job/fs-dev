# BRIDGE-01 Kickoff Handoff — Tabs ↔ Provenance

**Written:** 2026-09-12, by the VIEW-02 acceptance + consolidation session
**Purpose:** self-contained context for a fresh session to open the BRIDGE-01
SPEC conversation with RC. This is a DESIGN-FIRST session: no implementation
until RC approves a SPEC, per the standing one-SPEC-at-a-time rule.
**Read first:** `RELEASE-MANIFEST.md` (acceptance ledger + gates), then
`VIEW-02-NEW-TAB-BEHAVIOR-SPEC.md`, then this file.

---

## 1. One-paragraph state

The view-platform era is CLOSED. VIEW-01 (view capsule relocation + platform)
and VIEW-02 (configured tab adoption + new-tab behavior corrections) are
**accepted, walked, committed, and pushed**. `main` and
`agent/exact-workspace-paths` are unified at `7372933` (main's superseded
tab-bar/composer generations absorbed via an ours-merge; archives in
`archive/universal-view-tab-bar-wip` and `archive/rcc-0108-dirty-state`).
A single working checkout remains: `/Users/rccurtrightjr./projects/fs-dev`.
Alpha is installed, current, and visually in sync (its machine subtree
`ai/RC-Alpha/` is gitignored by design — config synced manually, see I-11/I-12
in `ISSUES.md`). Gate 6 (view-platform milestone release) is the owner's word
and unblocks this bridge.

## 2. Where everything lives

- **Primary checkout (the only working tree):** `/Users/rccurtrightjr./projects/fs-dev`
  — branch `agent/exact-workspace-paths` @ `7372933`, pushed, clean.
- **Alpha source checkout:** `/Users/rccurtrightjr./Applications/Fusion-Studio-Alpha-Source`
  — same branch, same commit, clean. Installed Alpha:
  `/Applications/Fusion Studio Alpha.app` (previous rotated to `.previous`).
- **Bundles:** `ai/RC-MacAir-15/Captures/028-…` (this view-platform bundle),
  `024-Agent-Tool-Provenance/` (PROV-01, accepted), `025-Chat_Composition_Roadmap/`,
  `022-Vision_Roadmap/`, `029-Composable_Views/` (vision + automation captures).
- **Alpha runtime identity:** `FUSION_APP_USER_DATA=$HOME/Library/Application
  Support/Fusion Studio Alpha` + `FUSION_LOCAL_MACHINE=RC-Alpha` (both required).
- **Dev dogfood profile:** `~/.fusion-view01-acceptance` + `RC-MacAir-15`.
  Dev server standalone mode serves the browser mirror on :3001 (degraded —
  see I-12; the browser cannot complete shell auth yet).

## 3. What BRIDGE-01 is

Connect the provenance platform (PROV-01, accepted) to the accepted tab/thread
surfaces: provenance records attach to the surfaces where AI actions happen
(view panels, document tabs, chat threads). The accepted implementation
report's impact assessment (VIEW-02-IMPLEMENTATION-REPORT.md §10) is the
contract baseline: `tabPolicies.newTab` is stable and additive; the connected
runtime seams (`renderEmptyBody`, `blankPlacementTarget`, `createOrRecenterBlank`,
`onEmptyTabCreated`, `initialGateOpen`) are the platform surfaces later work
builds on; **requires downstream correction: none**.

Inputs to reconcile in the SPEC conversation:

1. **PROV-01 accepted contracts** (`024-Agent-Tool-Provenance/` — its
   integration is merged and gated per the RELEASE-MANIFEST prerequisites).
2. **The accepted VIEW-01/02 contracts** — this bundle.
3. **Provisional material:** `022-Vision_Roadmap/` decisions,
   `025-Chat_Composition_Roadmap/` SPECs (chat extraction comes after the
   bridge; its SPECs constrain what the bridge must not foreclose).
4. **RC's 029 realizations** (`029-Composable_Views/custom-views-scripts-and-trust.md`):
   **automations are actors** — scheduled scripts and cron/trigger jobs produce
   tool-provenance events. The bridge's actor model should not assume humans
   and chat agents are the only sources.
5. **Thread-family context (RC, established):** every chat thread has a thread
   family linking side chats to the main thread; view surfaces belong to a
   thread family. Tab ownership will eventually be per-thread-family — the
   bridge must not hardcode single-thread-per-view assumptions that would
   rework when chat surfaces land.

## 4. Design session expectations (RC's process)

- **One SPEC at a time.** Generate the BRIDGE-01 SPEC together with RC
  (roadmap-creator-shaped); no implementation until owner approval.
- Owner gates live in `RELEASE-MANIFEST.md`: gate 6 (milestone release) must
  be spoken by RC; after BRIDGE-01 comes chat extraction (Composable Chat,
  `025-…`), same pattern: SPEC → fresh orchestrator → independent review →
  owner acceptance.
- Do not start chat/prompt/collection/plug-in/Composable-Views work without
  explicit owner release.
- Never commit unless RC asks; the working tree is the candidate.

## 5. Known debts and environment notes

- **I-9/I-10/I-11/I-12** (`ISSUES.md`): journal orphaning on workspace moves
  (data-fix recipe; product fix backlog), Alpha `npm install` rule, the
  sibling-registration clobber (fixed, `4b83927`), and the browser-mirror
  auth gap (shell-states browser test skipped pending a browser auth design).
- **Successor tab SPEC (parked, RC-designed):** self-healing New tab
  (always exists, zero-tab fallback, two-kind taxonomy), universal document
  tabs (render disposition per opening surface, preview/source toggle, doc
  action bar), preview type system. Designs live in this session's queue and
  the NEW-TAB-BEHAVIOR-SPEC; nothing blocks the bridge.
- **Min tab width floor:** `min-width: 0` remains in `.rv-view-tab-item`
  (shrink allowed); the 140px intrinsic width hint (44951b1) gives generous
  few-tab rendering. Floor behavior for crowded strips belongs to the
  successor tab SPEC.
- **Verification gates:** client `npm run build`; server
  `npx jest --maxWorkers=2` (never full parallelism — two timing suites flake);
  durable smoke `node e2e/view-capsule-public-shell-smoke.mjs` →
  `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK` (gate file sha256-pinned — never edit);
  alpha pack flow: pull → `npm install` in BOTH packages → `electron:pack` →
  install (rotate `.previous`) → relaunch with both identity vars.
- **Logging is sanitized by design** (server tee + renderer pipe emit bare
  labels). Diagnostic technique for silent failures: CDP over
  `--remote-debugging-port`, bundle patch with discriminating messages
  (I-11 recipe in `ISSUES.md`), WS frame capture via CDP Network.

## 6. Suggested opening questions for the SPEC conversation

1. What is the provenance actor model? (human, chat agent, harness, scheduled
   automation — and what identity each carries.)
2. What attaches to what: do provenance records bind to threadIds, to tab
   targetKeys, to view panels, or to the thread family?
3. Retention and surfacing: where do provenance records render (a view? the
   doc action bar? a dedicated provenance surface) and who may prune them?
4. What does the bridge owe the chat extraction (so chat surfaces inherit
   provenance without rework)?
