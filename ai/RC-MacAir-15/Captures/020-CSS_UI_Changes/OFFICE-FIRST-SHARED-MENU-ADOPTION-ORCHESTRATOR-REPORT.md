# Office-first shared-menu adoption — orchestrator report

Status: `SPEC_READY_FOR_OWNER_REVIEW`

Approved SPEC: `SPEC-OFFICE-FIRST-SHARED-MENU-ADOPTION.md`
Repository: `/Users/rccurtrightjr./projects/fs-dev`
Baseline provenance: `501eb35379ac0278f9aa20ef7f6b99a16241bac1`
Pre-owner-smoke integrated review-manifest digest: `2f42c7542f2bfa659931f7459d41f1eb8c44e1cb87d58f92728aebe2a636ed09`

The SPEC is implemented and materially clean. All four slices passed builder-owned review, orchestrator inspection and validation, fresh slice acceptance, and a fresh final integrated review. No commit or push was performed.

## Slice ledger

| Slice | Result | Builder | Builder reviewer | Orchestrator acceptance | Primary evidence |
|---|---|---|---|---|---|
| ADOPT.1 — Office New | Accepted | `/root/adopt_1_office_new` | `/root/adopt_1_office_new/adopt_1_cleanroom_1` | `/root/adopt_1_acceptance_2` | Build passed; 11/11 focused tests passed |
| ADOPT.2 — Office Export | Accepted | `/root/adopt_2_office_export` | `/root/adopt_2_office_export/adopt2_gate_pass1` | `/root/adopt_2_acceptance` | Build passed; 25/25 focused tests passed |
| ADOPT.3 — file actions and legacy retirement | Accepted | `/root/adopt_3_file_actions` | `/root/adopt_3_file_actions/adopt3_gate_pass1` | `/root/adopt_3_acceptance_2` | Build passed; 20/20 focused tests passed |
| ADOPT.4 — cumulative audit and cleanup | Accepted | `/root/adopt_4_cumulative` | `/root/adopt_4_cumulative/adopt4_gate_pass1` | `/root/adopt_4_acceptance` | Build passed; 36/36 cumulative tests passed |

Final integrated reviewer: `/root/final_integration_acceptance` — `CLEAN`.

All direct children reached a terminal result. The available collaboration API did not expose a separate child-closure operation; terminal lifecycle evidence was recorded instead.

## Delivered behavior

- Office New renders through the shared menu with the exact required rows, grouping, icons, keyboard behavior, placement, dismissal, and focus restoration. Existing New Folder and New Document effects remain single-dispatch; Import actions remain intentionally inert.
- Office Export renders the required nested DOCX/PDF structure plus Markdown email and Preview PDF through the shared menu. Existing output ownership, payloads, busy/disabled state, rejection handling, and single-flight behavior are preserved.
- Office file and folder context/ellipsis menus use pointer and exact-element anchors through the shared renderer. Star/Pin, Rename, Archive/Restore, and Delete keep their existing domain owners and effects.
- The necessary shared callers in Email file tiles and Capture/TileRow/preview/FilePage/Ticket surfaces were migrated without redesigning their product behavior.
- `src/lib/contextMenu.ts` and its injected `.rv-context-menu*` renderer/styles were deleted after caller and runtime-symbol sweeps.
- Insert, table, color Remove, New, Export, and file/folder action menus now converge on `src/components/menu/` for generic DOM, keyboard, positioning, focus, dismissal, async, and teardown behavior.
- Page Margins and Paper Brightness remain specialized form popovers. Mounted tests verify their input structure, mutual exclusion, and live effects.
- Mounted light/dark checks verify the shared background, foreground, and border token contract on representative root and nested menus.

## Final validation

Run from `fusion-studio-client/`:

```text
npm run build
```

- Orchestrator: passed; 1,838 modules; 6.37 seconds.
- Final reviewer: passed; 1,838 modules; 6.35 seconds.

```text
npx playwright test --config=playwright.office.config.ts \
  e2e/shared-menu-component.spec.ts \
  e2e/office-shared-menu.spec.ts \
  e2e/office-menu-adoption.spec.ts \
  e2e/office-shared-context-menu-consumers.spec.ts \
  e2e/office-table-presentation-output.spec.ts \
  e2e/office-document-output-payloads.spec.ts \
  --project=chromium --workers=1
```

- Orchestrator: 36 selected, 36 passed, 0 failed, 0 skipped; 94.34 seconds.
- Final reviewer: 36 selected, 36 passed, 0 failed, 0 skipped; approximately 1.6 minutes.
- `git diff --check`: passed.
- Stale-symbol, retired-selector, forbidden-import, and migrated-listener sweeps: zero prohibited matches.

Non-blocking warnings were the existing `gray-matter` eval warning, large Vite chunk warning, Node `DEP0190`, `NO_COLOR`/`FORCE_COLOR`, and fixture-only optional resource notices.

## Accepted revisions

### ADOPT.1

- `OfficeGrid.tsx`: `3c8ecb59ce6a930ce60d3c8b9513dc85f4c91a616299864d1d4d3641f3330ae8`
- `OfficeGrid.css`: `fec048ecbaa106e116e0657e49159b87909e4ed5217a0f80d9261229b9102d4c`
- `OfficeNewMenuButton.tsx`: `561f64ebabc2a6e5bc67748baad3fdd44b6a6cd45965b5bcb852429a429416cd`

### ADOPT.2

- `OfficeDocumentExportMenuButton.tsx`: `066861e3ee7393bed17f54784b4022ac22393c36a99bc3ed19b05140b96da1bc`
- `OfficeDocumentTopbar.tsx`: `f898fb705233794c25964d5a9724fbb520d738aa09a9165b7d6b68b826c9ade6`
- `OfficeDocumentPage.tsx`: `2e545795ea6f7b032c558c12f8f34f72b1f051c918247a350e813ba49874ffb5`
- `OfficeDocumentPage.css`: `0956a4d3aedd7d34f6ef06757c5327ad6e433ca251f9a1c069647d3fd9298f67`

### ADOPT.3

- `useFileTileMenu.ts`: `56de5b79a65fcbf78794b4f8d7b57d695237d8e2a30e210e26bd58dd2514fa91`
- `CaptureDocumentMenuButton.tsx`: `d1fac6371d827bbfb8fc2529d8d6e935ff15798a6ed1743494b53cc7c3768961`
- `src/lib/contextMenu.ts`: deleted
- `office-shared-context-menu-consumers.spec.ts`: `162b97917343a90adbfe08195a35b278c1fd75b995f4c600d8fb068c489ffa64`
- `shared-context-menu-consumer-helpers.ts`: `204bdcd2d609052c90f5c4e3259db18f53a5489c0f8cba39274b96d9e8c7ff64`
- `office/global-setup.mjs`: `f8790fffdccf41f21915dd800f23b924427b5c620c6362e170d090df04b00d40`

### Cumulative tests

- `office-menu-adoption.spec.ts`: `f3c532528ebdd5ac93f62ba8d220f4c0f538ed9ea5a702f1e80fbd9525aab55f`
- `office-table-presentation-output.spec.ts`: `baddddd6d782fc9563e9fcf6823e25c530c029716c8425d724a64dbb97217ac1`
- `office-shared-menu.spec.ts`: `cc6bca724a4ec864359a3666d1c7853dbe35b99944922644235430cf7310c9f1`

## Deviation and out-of-scope ledger

All deviations are classified `accepted`; none requires owner ruling or downstream correction.

- Extracted `OfficeNewMenuButton.tsx` and `OfficeDocumentExportMenuButton.tsx` to keep Office-owned descriptors and handle lifecycle out of oversized page/chrome modules. Observable product behavior is the specified migration only.
- Narrowed combined Send/Export CSS to active Send rules while deleting retired Export selectors. Email document Export remains deferred and unchanged.
- Added an isolated Issues/Ticket Playwright fixture and a test helper module to reach required supporting mounts while keeping the behavior suite focused. Test-only impact.
- Retained `tabindex="-1"` as a compatibility seam on otherwise nonsequential invocation tiles so exact Escape/Tab/action focus can be restored without adding them to sequential tab order.
- Hardened the Office test navigation helper to make cross-scenario fixture resets deterministic. Test-only impact.
- Used representative mounted light/dark token injection instead of mutating persisted theme files. This directly verifies shared token consumption without changing theme state.

After the owner smoke-tested the completed package, Office file/folder ellipsis menus were found to have empty icon slots. The shared renderer was correct; the `useFileTileMenu` descriptors had omitted their icon fields. Star/Pin, Rename, Archive/Restore, and Delete icons were added without changing actions or lifecycle; the Star action uses the exact `kid_star` symbol from the Office sidebar. The client build passed, the mounted supporting-consumer suite passed 5/5 after the icon addition, and the exact Office descriptor/anchor/focus test passed 1/1 after the sidebar-icon alignment before Fusion was rebuilt and restarted for owner testing.

One initial ADOPT.3 acceptance pass compared the Capture Archive row against committed HEAD instead of the owner-authorized starting worktree and requested a repair. Pre-slice evidence showed the conditional Archive behavior already existed in the starting worktree. No owner behavior was reverted; a fresh acceptance review using the correct baseline returned `CLEAN`.

Overall downstream impact: `compatible deviation`. The only non-Office product surfaces affected are the supporting callers required to retire the legacy renderer. No later-SPEC correction is recommended.

## Skipped checks and residual risk

- Native Electron save, email, print, and operating-system dialogs were not manually exercised; mounted tests verify API dispatch and exact payloads.
- ThemePicker persistence and generated theme-file replacement were not part of the light/dark gate.
- No pixel-diff screenshot baseline or manual Electron/Alpha smoke was required or run.
- Repeated Capture branch instances sharing the same menu component were represented through direct TileRow, preview, FilePage, Email, and Ticket mounts rather than every duplicate branch being opened separately.
- `Unstar` and `Unpin folder` are recomputed from live collection state and source-verified, but the inverse labels are not each asserted by reopening the menus.

No product adapter or temporary compatibility renderer remains. The isolated CSS-token override is test-only. Deferred Header, Chat, Workspace, Calendar, Email document, Tools Panel, Sidebar, native, and unrelated dropdown consumers remain untouched.
