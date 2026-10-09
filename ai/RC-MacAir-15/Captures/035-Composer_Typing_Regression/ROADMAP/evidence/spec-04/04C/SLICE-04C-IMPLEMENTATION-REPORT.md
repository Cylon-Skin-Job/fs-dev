# SPEC-04 Slice 04C Implementation Report

## Outcome

04C implements explicit production shell/session composition and retires the aggregate Legacy compatibility surface. `WorkspacePanel` owns one active view population and renders rail/chat plus `ContentArea` as siblings. The content boundary does not observe chat draft or live state. All built-in content-local duplicate docks are removed. Production Legacy host/hook, dock files, `legacy-main`, null-view registration, automatic null-view bootstrap/open, and hidden reconnect population sweeps are gone.

All required correctness, source, ownership, shell, action, submission, Side Chat, build, focused full V-RENDER and five-minute current-byte gates pass. The first unlocked full run had one isolated 17-ms short-window wall overshoot with every renderer signal clean; exact and full unchanged-source repetitions passed without changing the 2,550-ms threshold. The first focused five-minute run then exposed two measurement-oracle defects, not a product regression: an unauthorized 1.15× wall formula and the queued screenshot bootstrap crossing measurement start. The final runner uses the approved 1.5× per-character delay formula, establishes an ordered fail-closed screenshot lifecycle quiescence boundary, and still requires zero outbound frames during typing.

## Changed files and responsibilities

- Shell boundary: `App.tsx`, new `WorkspacePanel.tsx`, `ContentArea.tsx`, `ChatArea.tsx`.
- Explicit host/session owners: new `ChatSessionHost.tsx`, `useChatSessionHost.ts`, `useChatSessionActions.ts`; updated `useViewChatHost.ts`, `ViewChatHost.tsx`, `ChatSurfaceComponentMount.tsx`, contracts, and stable empty-member projection in `worksurfaceSlice.ts`.
- Production startup/read ownership: `workspace-handlers.ts` no longer requests the null-view list or sweeps inactive Side Chat-capable views; `thread-handlers.ts` retains explicit historical null-view reads but never selects/opens them; the extracted worksurface facade/frame modules retire the sweep export.
- Duplicate-placement retirement: CaptureTiles, FileExplorer, WikiExplorer, OfficeGrid and EmailGrid remove content-local chat docks; the conflict banner moves to the shell content frame.
- Deleted: `LegacyChatHost.tsx`, `useLegacyChatHost.ts`, `ViewWorksurfaceDock.tsx`, `ViewWorksurfaceDock.css`.
- Verification/integration: registration, identity, isolation, threaded-host, architecture observation/source/inventory, shell, worksurface, Side Chat and Electron smoke files listed in `SOURCE-SHA256.txt`.
- Sustained input: new `r1-sustained-electron.mjs`; runner and scenario inventory activate `R1-FIVE-MINUTE-TYPING` through the reserved `soak` suite. The final harness records bounded decoded traffic evidence, settles the expected screenshot bootstrap before measurement, and applies the authority-derived wall budget.

## Acceptance mapping

| Criterion | Implementation and evidence |
| --- | --- |
| ContentArea is a sibling and draft/live quiet | `WorkspacePanel` terminates chat subscriptions below `ViewChatShell`; `ContentArea` receives scalar panel/workspace props and selects only its exact config. Observation/isolation lane 60/60 passes, including zero draft-induced history, formatter, header, rail and ContentArea work. |
| Exact view/session composition | One shell `useViewChatHost` projection feeds the real Sidebar and ChatArea; component/isolated callers use explicit `ChatSessionHost`. V-SHELL passes run `chat-arch-1790142837339-70c50ba4f2`. |
| No redundant hidden commands | `useViewChatHost` gates list/MRU open on `isActive` and connection/address generation. Workspace bootstrap has no null-view list/open and no inactive-view Side Chat sweep. Current V-SHELL proves exactly one active-view startup list, zero null-view lists, and zero startup opens; passive open remains non-warming. |
| Aggregate host retirement | Four Legacy/dock files deleted; source scan and architecture contract report zero production references and one explicit placement. All callers/tests migrated. |
| Persisted null-view data remains readable/cleanable | Store/server historical routes remain unchanged; the handler test hydrates an explicit `viewId:null` response twice with zero selection/open. Production registration rejects null and mounts no compatibility surface. |
| One-job/400-line/cache standards | `ARCHITECTURE-AUDIT.md`; all new/changed core host modules <=400, no new unbounded Map/Set, exact subtractive cohesive exemptions for inherited large content views. |
| Preserve 04A/04B and action/submission contracts | V-ACTIONS and V-SUBMIT pass; R1 correctness, R7 streaming/history, surface isolation, attempt ownership, Side Chat placement/recovery and build pass. |
| Matched short/streaming/current timing | Final full V-RENDER `chat-arch-1790228222155-271e516a9a` passes all ten startup/warm/settled/dense windows at 1,961–2,008 ms plus F1, correctness, R7 and R9. Final five-minute `chat-arch-1790228438993-225fac9ea0` passes 9,520-character retention, input/rAF/long-task, zero traffic and zero sibling/history/formatter work with valid focus and cleanup. |

## Exact verification

- Source manifest: 43/43 current hashes verified plus four deletions; digest `21eb00b014cf37b7a710c59a0be97016b91ef55ec9c2b0f8f1e551caadbeaa44`.
- V-ACTIONS: PASS, owned run `chat-arch-1790142422679-bb66a300de`.
- V-SUBMIT: PASS, owned run `chat-arch-1790142587284-2c68046e22`.
- V-ISOLATION: PASS, 18/18.
- V-SHELL: PASS, current-byte owned run `chat-arch-1790145892538-7487268b0d`; view-bound create/move, isolated other population, zero null-view groups, exactly one active-view startup list, zero null-view startup lists, and zero startup opens.
- V-RENDER short/streaming: PASS, F1 + R7 run `chat-arch-1790142872239-8774a215dd`; F1 public route and 2/2 20fps history/live cases.
- V-RENDER composer correctness: PASS, run `chat-arch-1790142889393-2c965f4de0`; focus helper 6/6 plus input/locality 2/2.
- Full V-RENDER: PASS, final-manifest run `chat-arch-1790228222155-271e516a9a`. F1, ten R1 windows, focus helpers 6/6, composer input/locality 2/2, R7 history/live 2/2 and R9 lifecycle all pass. R1 walls are 1,961–2,008 ms; input p95 <=0.7 ms, next-rAF p95 <=16.9/max <=18.3 ms; zero long tasks, outbound frames, formatter calls or history/header/rail/content renders; exact retention and focus true before/after in every window.
- Five-minute typing: PASS, run `chat-arch-1790228438993-225fac9ea0`. Configured 300,000 ms, 9,520 characters at 32-ms pacing; approved wall budget 456,960 ms; measured wall 351,517 ms. Input p95 1.4/max 2.2 ms; next-rAF p95 17.7/max 21.0 ms; 9,520/9,520 input and rAF samples; exact retention; zero long tasks, typing-time WebSocket frames, evidence overflow, formatter calls, or history/header/rail/content renders. The ordered screenshot bootstrap completed at traffic sequences 888–891 and remained stable for 500 ms before measurement. Focus true before/after; SQLite `ok`; no lingering PIDs; fixture and run roots removed.
- Host/identity/observation lane: PASS 64/64.
- Side/worksurface integration lane: PASS 44/44.
- Source architecture, inventory and runner lifecycle: PASS 28/28.
- Final affected architecture/oracle/runner lifecycle rerun after the focused repair: PASS 21/21, including the new authority-formula and fail-closed screenshot-quiescence source contract.
- Historical null-view handler regression: PASS; explicit rows remain readable with zero hidden selection/open.
- Isolated real Electron worksurface smoke: PASS; two groups, content switch/persistence, relaunch restoration and isolated deletion through the production outer ThreadRail.
- Isolated real Electron Side Chat smoke: PASS; four peers, one row, close/reopen lifetime placement, relaunch readback, real outer-rail toggle, empty replacement, retired secondary absent.
- V-BUILD: PASS; TypeScript/Vite, 1,940 modules. Existing gray-matter eval, mixed Capture import and large-chunk advisories only.
- Scoped `git diff --check`: PASS.

## Before/after and focused fail-forward

Accepted 04A focused results were produced on earlier product bytes and are not reused as current-byte proof. First unlocked run `chat-arch-1790226538113-ec3ff261d5` exceeded the unchanged 2,550-ms limit only in warm trial 1 at 2,567 ms; its other nine windows were 1,908–2,086 ms and every main-thread/render/traffic/focus/retention signal was clean. Unchanged-source exact rerun `chat-arch-1790226813486-07f8ef9936` passed all ten at 1,920–1,999 ms; unchanged-source full run `chat-arch-1790227008022-0bead4164a` passed all ten at 1,967–1,985 ms and completed all render cases. The isolated 17-ms wall-only excursion did not reproduce in twenty same-byte windows or the ten final-harness windows, so it is recorded as host scheduling jitter rather than repaired product work. `FOCUSED-R1-FAIL-FORWARD.md` preserves exact receipts and rationale.

## Self-review and repairs

Self-review found and repaired: an overbroad source-regex false positive; a V-SHELL locator that scoped the shared menu portal under the panel; a missing reload in the new sustained fixture after project creation; obsolete rail/dock selectors in worksurface and Side Chat tests; and a harness that omitted the content-sibling conflict banner after dock removal. Clean-room pass 1 then found two material omissions: the workspace/thread handlers still performed a hidden Legacy null-view list/open, and the older real Electron worksurface smoke still targeted the deleted dock. Both were repaired. The new startup frame oracle then exposed the separate five-view reconnect Side Chat sweep, which was also retired; adapterless restart now waits for its exact view to become active. Focused fail-forward exposed the sustained runner's invented 1.15× wall cap and decoded two queued screenshot frames at +289.1/+294.3 ms. The oracle was repaired to the approved 1.5× per-character budget and an ordered event-driven quiescence boundary; it does not sleep past or filter traffic. Each affected source, host, Side Chat, worksurface, Electron, shell and build gate was rerun to green. All failed/focus-unavailable attempts remain in raw evidence and are summarized in `FOCUSED-R1-FAIL-FORWARD.md`.

## Deviations and out-of-scope touches

- Proposed classification: mechanically necessary 04C integration. The packet named the five-minute gate but the reserved soak suite had no executable case; 04C added the bounded case and exact scenario registration.
- Proposed classification: verification-oracle repair within 04C. `VALIDATION.md` owns the 1.5× configured per-character delay budget; the new sustained case had incorrectly invented `configuredDurationMs * 1.15`. The repaired case also waits for the observable screenshot bootstrap lifecycle and sequence stability before resetting evidence, then counts every measured frame with zero required. This changes no product route or threshold.
- Proposed classification: mechanically necessary caller migration. Existing worksurface/Side Chat fixture and Electron smoke code still modeled the deleted content dock. They now target the real shell rail/state and mount the real content-sibling conflict banner in the host-only harness.
- Proposed classification: criterion-required production cleanup. The accepted 04B reconnect sweep was a hidden inactive-view list owner incompatible with 04C's explicit active-host rule. Removing it does not alter persisted placement truth: the exact view host's qualified list still drives per-group placement reads when that view becomes active, verified for adapterless and Electron relaunch paths.
- Proposed classification: bounded subtractive exemptions. CaptureTiles, OfficeGrid and EmailGrid exceed 400 lines but 04C only deleted duplicate-dock bytes; no unrelated split was attempted.
- Proposed classification: bounded cohesive router exemptions. `workspace-handlers.ts` and `thread-handlers.ts` exceed 400 lines as pre-existing protocol dispatchers; 04C's touch is strictly subtractive retirement of hidden command ownership. The changed extracted worksurface frame/facade modules remain <=400.
- No DB/migration/server route, SPEC-05 behavior, live profile/database, port 3001, owner window, Alpha, commit or push was touched.
- Downstream effect: SPEC-06/full program soak can extend the now-live, current-byte-passing soak inventory and reuse its bounded decoded traffic evidence. Native/IME/owner acceptance and the 45-minute mixed workload remain SPEC-06 work.

## Skipped checks, adapters and residual risks

No required 04C correctness/source/ownership/build/timing gate was skipped. No owner window was automated. Native/IME/owner symptom acceptance and the 45-minute soak remain later SPEC-06/program work. The existing full-boot 129/130 stale diagnostic status-text advisory was not changed or rerun merely to alter SPEC-05-facing text. Test adapters use disposable profiles/workspaces and the canonical deterministic harness; none change a product route or fabricate a pass.

Residual risk is confined to later native/IME/owner acceptance and the SPEC-06 45-minute mixed workload. No known material 04C correctness or focused timing defect remains in executed gates.

## Reviewer history and lifecycle

- Pass 1: `/root/spec04_slice04c/review_04c_pass1`, terminal `FINDINGS — NOT CLEAN`. Two material findings were accepted and repaired: hidden Legacy null-view startup list/open, and the unmigrated worksurface Electron smoke. Exact evidence and builder disposition are in `BUILDER-REVIEW-FINDINGS-1.md`.
- The reviewer edited no files and reached terminal status before repair. This environment exposes no `close_agent` operation, so closure could not be attempted; missing closure is lifecycle evidence only.
- Pass 2: fresh reviewer `/root/spec04_slice04c/review_04c_pass2`, terminal `CLEAN`; 43/43 hashes and four deletions verified, both pass-1 repairs and all current receipts confirmed, no files edited. Exact review evidence is in `BUILDER-REVIEW-PASS-2.md`.
- Focused fail-forward changed the sustained oracle and its contract test after pass 2, so a new review was mandatory. Pass 3: fresh reviewer `/root/spec04_slice04c/review_04c_focus_pass3`, terminal `CLEAN`; digest `21eb00b014cf37b7a710c59a0be97016b91ef55ec9c2b0f8f1e551caadbeaa44`, all 43 hashes/four deletions, unchanged short threshold, authentic repetitions, authority wall formula, bounded fail-closed screenshot quiescence, unfiltered zero-frame requirement, final focused receipts, deviations and residuals independently verified; 21/21 affected checks passed; no files edited. Exact review evidence is in `BUILDER-REVIEW-PASS-3.md`.
- This runtime exposes no `close_agent` operation, so closure could not be attempted for any terminal reviewer. All terminal dispositions are recorded; missing closure is lifecycle evidence only and no reviewer remains conflicting.
