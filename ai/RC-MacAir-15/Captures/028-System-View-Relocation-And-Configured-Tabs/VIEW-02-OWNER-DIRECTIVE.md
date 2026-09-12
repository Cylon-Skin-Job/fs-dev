# VIEW-02 Owner Directive + Integration Defect Memo

**Written:** 2026-09-10, by the VIEW-01 session at the owner's direction
**Audience:** the VIEW-02 implementation session (present and future)
**Authority:** owner direction (rank 1 in the bundle's authority chain)

---

## 1. Owner directive — chrome layering (2026-09-10)

The owner reviewed the running VIEW-02 build and directed this presentation
contract (supersedes the *application details* of D-173 below the identity row;
D-173's universal identity row and location row remain):

1. **The top bar (single-tab identity / tab rail) is the default shell chrome.**
2. **The location rail is the single path row**: `View > folder(s) > filename`.
   - Capture document: `Capture > Captures > responsive-breakpoints.md`
   - File document: `Files > <folders…> > Filename`
   - Empty: the configured neutral label (current behavior).
3. **Presenters do not duplicate the rail.** No presenter-owned breadcrumb bar,
   no standalone filename row, no centered classic chrome beneath the rail.
4. **Each view defines its own structure beneath the rail only.**
   - Capture keeps its document subheader (`<- Title`) and content.
   - File shows content directly (no header of its own).
5. **The drawer slide-out control lives in the breadcrumb header row** (the
   location rail). This requires a shell-provided trailing-action slot — an
   extension to the accepted rail, to be designed by the VIEW-02 session with
   review (interim: the owner accepted a floating dock control in the File
   presenter, 2026-09-10).

Owner's before/after (Capture document):

```
CURRENT (wrong)                     TARGET
Capture > Documents and Artifacts   Capture > Captures > responsive-breakpoints.md
responsive-breakpoints.md           <- Responsive Breakpoints for Tablet and Mobile
<- Responsive Breakpoints …         <document content>
```

## 2. Integration defects found while dogfooding (2026-09-10)

Diagnosed in the worktree build; each blocks the directive above:

1. **Classic fallback web.** Document-open surfaces route inconsistently:
   preview-modal expand → placement (`current`); tile right-click → placement
   (`new`, patched 2026-09-10 by the VIEW-01 session); other paths still fall
   back to classic `FilePageView` with centered filename chrome. The classic
   full-page chrome must be retired from every public open path (SPEC §9/§10
   already require this).
2. **Legacy capture tabs mode** (`isTabsMode` branch) still exists under the
   connected host and renders its own chrome on fallback.
3. **Cold-start legacy hydration is broken**: a fresh profile with persisted
   classic file tabs renders an Empty tab instead of hydrating them; the live
   workspace's file tab state was reset from 6 tabs to 1 by the new adapter.
4. **Drawer wiring**: only the picker-layer CSS consumed `--file-tree-w`; the
   document presenter's drawer had no geometry/collapse CSS (patched
   2026-09-10 with `FileDocumentPresenter.css` — review as part of Slice 4).
5. **Location rail content**: document targets already build
   `['Capture', collection, name]` labels, but mounted tabs were observed with
   landing labels — verify projection refresh per active target.

## 3. Patches already applied by the VIEW-01 session (reconcile, don't revert)

- `CaptureTiles.tsx`: right-click opens route through `openCaptureDocument`
  (placement-first, classic fallback).
- `FileDocumentPresenter.tsx` + new `FileDocumentPresenter.css`: info bar
  removed; content-direct layout; floating dock control; drawer collapse
  wired to `--file-tree-w`.
- `DocumentPreviewModal.css`: backdrop anchored to `.rv-content-area`
  (scoped blur; was viewport-wide, then grid-anchored).

## 4. Consolidation mandate (owner direction, 2026-09-10)

The owner directs the retirement step to be executed as the primary remaining
task, not left implied. After VIEW-02, each adopter domain exposes exactly one
open entry point and one preview entry point, consumed by every surface:

1. **Single domain entry points.** All capture/document opens route through
   `openCaptureDocument` (and the file equivalent) with an explicit
   disposition; component-local open logic is removed. No entry point may
   branch to classic full-page, legacy tabs mode, or local match/fill code.
2. **Fallback retirement.** The classic full-page open path, the `isTabsMode`
   shim branch, and the pre-TABS-03 local tab logic are deleted from the
   public action paths (dead code removal, per SPEC §9/§10 and VRT-012).
   Where a bounded failure surface is needed, it is the accepted Empty
   reservation failure — not a silent classic fallback.
3. **Dumb presenters.** Landing/document/empty presenters receive handlers
   from their connected adapter and contain no open/placement logic.
4. **Single chrome source.** The shell identity row and location rail are the
   only tab chrome; presenters render content structure beneath (§1).

## 5. Verification expectations

- The VIEW-01 durable smoke must still pass unmodified.
- Owner visual checklist (SPEC §13) plus: no centered filename chrome on any
  capture/file document tab; rail shows the full path per §1; drawer toggles
  from the rail (or interim floating control) actually collapse the tree.
