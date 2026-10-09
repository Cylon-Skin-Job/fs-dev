# SPEC-04 Slice 04A Builder Review Packet

## Candidate identity

- Repository: `/Users/rccurtrightjr./projects/fs-dev`
- Branch: `agent/exact-workspace-paths`
- HEAD: `88637d11c65be53d4f2ad0f049f64a07fa3db1de`
- Shared dirty checkout: yes. Review the current files listed in `SOURCE-SHA256.txt`; unrelated owner/concurrent changes are outside this gate.
- Gate: builder-owned review for SPEC-04 slice 04A only.

## Authority and acceptance target

Review against `AGENTS.md`, release candidate `CHAT-AR-4641ca5897f0`, `SPEC-04.md` §04A, the roadmap packet, accepted SPEC-01/02/03 reports/manifests, the Chat Wiki overview, and routed code standards 001/002/003/004/008.

The required outcome is composer-local observation: the parent host/shell does not observe draft, attachments, full session maps, completed history, live segments, context/token projections, or submission state because of composer typing. Exact `{workspaceId,threadId}` connected leaves own their narrow projections. Commands snapshot exact draft revision, attachment IDs/generations, acknowledged model selection, submission, and current-turn state when invoked. Duplicate mounts share the same session draft while other sessions remain isolated, and all accepted input behavior is preserved. Draft-only work must retain exact text with zero completed-history formatter/MessageList/InstantSegmentRenderer calls and zero header/rail/ContentArea renders.

## Implementation surface and behavior

- `chatSurfaceContract.ts` replaces the aggregate `ChatSurfaceModel` with stable shell, header, and composer contracts.
- `useLegacyChatHost.ts` no longer subscribes to draft, attachments, submission attempts/feedback, history messages, current turns, segments, or live token/context maps for composer rendering. Its command callbacks use `getState()` snapshots at invocation. Stable identities, projections, actions, and refs use memoized references.
- `ConnectedChatComposer.tsx` owns exact draft/attachment/submission and exact composer-status/context/token selectors; `ChatAreaFooter` and `ChatLinkAttachments` are prop-driven presentation.
- `ConnectedChatHistory.tsx` owns exact completed/live history selectors and scroll behavior.
- `ConnectedChatHeader.tsx` owns exact busy/submission gating for Move without forcing the shell host to observe the session maps.
- `ChatSurface.tsx` is memoized and composes the three leaves. Production callers consume the split stable contract.
- `useChatMountInteractions.ts` owns stable mount refs and exact addressed acceptance events without observing history/live maps.
- The isolated Playwright harness adds same-session duplicate mount, other-session isolation, selection/caret, composition, paste/drop, emoji, autocomplete, resize, attachment, and zero-render/formatter assertions.
- The production Electron R1 observer uses test-only CDP precise function coverage. `ChatAreaFooter` executes exactly once per key as the positive control while history/formatter/header/rail/ContentArea functions remain at zero. The fixture-only Vite build injects exact render probes only during the test transform. No production observation hook or auth bypass remains in source or built output.

## Required checks on current bytes

- V-BUILD: `npm --prefix fusion-studio-client run build` — PASS; 1,940 modules transformed.
- V-ISOLATION: `cd fusion-studio-client && npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-isolation.spec.ts` — PASS 15/15.
- V-RENDER 04A: `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce --cases R1-F2-F3-COMPOSER,R1-COMPOSER-CORRECTNESS` — PASS, run `chat-arch-1790129801137-307285764d`. Ten authenticated Electron measurement windows retained exact text; max input p95 0.801 ms, max rAF p95 16.4 ms, max rAF 17.6 ms, zero long tasks, zero target renders, zero formatter calls, and 680 total positive-control composer calls. The two correctness cases passed 2/2. Cleanup: no lingering process, SQLite quick-check `ok`, disposable roots removed.
- V-SUBMIT: `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite submit --mode enforce` — PASS all 7 runner cases, run `chat-arch-1790129982483-03bc3bcf93`.
- Focused existing boundaries: `cd fusion-studio-client && npx playwright test --config=playwright.chat-architecture.config.ts e2e/chat-surface-identity.spec.ts e2e/threaded-chat-host.spec.ts` — PASS 29/29.
- `git diff --check -- <04A integration files>` — PASS.

Evidence copies/summaries are in this directory. Full immutable runner artifacts remain at `evidence/spec-01/01B/chat-arch-1790129801137-307285764d` and `evidence/spec-01/01B/chat-arch-1790129982483-03bc3bcf93`, because the accepted shared runner owns that output root.

## Self-review and repairs already made

1. The first R1 attempt incorrectly used sticky React fiber flags and minified-name assumptions, producing false positive sibling/history counts. Replaced with exact opt-in counters, then removed the production hook entirely after checking SPEC-01/GUIDANCE.
2. Final observation uses CDP precise function coverage plus a 68-call-per-window composer positive control; the Vite fixture uses test-transform-only injected counters. The full default R1 reran after this repair.
3. A first exact-counter attempt counted unrelated async global markdown work and dense hydration overlap. Quiescence and the formatter target were narrowed to the completed-history `renderTextInstant` entry required by 04A; the authenticated workload and thresholds were not weakened.
4. Restored `isActivePanel` gating in the host while splitting projections so inactive mounts retain accepted input ownership semantics.
5. Self-review confirmed every new/extracted production file is below 400 physical lines; the cohesive pre-existing `useLegacyChatHost.ts` remains 529 lines pending its later retirement/split and was not expanded into another aggregate model.

## Deviations and out-of-scope touches

### D-04A-1 — Additional exact connected leaves

- Original SPEC text: “Mount an explicitly connected composer leaf that observes only exact `{workspaceId, threadId}` draft, file-link and pending-submission projections.”
- Actual: also extracted exact connected history and header leaves.
- Reason: removing completed/live session subscriptions and busy/submission Move gating from the parent without dropping accepted behavior mechanically requires those observations below the stable `ChatSurface` boundary.
- Files: `ConnectedChatHistory.tsx`, `ConnectedChatHeader.tsx`, `ChatSurface.tsx`, contract/host/caller integration.
- Tests/effect: R1 and V-ISOLATION prove typing only re-renders the composer leaf; Move/session behavior remains exact. No user-visible redesign.
- Risk/downstream: low; 04B can further optimize history/live behavior inside the already isolated history leaf. Proposed classification: `accepted` mechanically necessary integration.

### D-04A-2 — Shared runner evidence root

- Original SPEC text: write evidence under `evidence/spec-04/04A/`.
- Actual: the accepted runner still emits primary artifacts under its SPEC-01-owned root. 04A copies the terminal logs/results and a bounded R1 summary here, and records both immutable run IDs/paths.
- Reason: changing the shared runner’s evidence-root contract solely for 04A would invalidate accepted downstream runner consumers.
- Files: evidence files only.
- Tests/effect: none on product behavior; all evidence remains traceable by hashes/run IDs.
- Risk/downstream: low bookkeeping risk. Proposed classification: `accepted` adapter compatibility; the orchestrator may elect to generalize the runner root later.

### D-04A-3 — Existing 529-line host remains

- Original packet text: “Keep every new/extracted production file <=400 physical lines and one job.”
- Actual: every new/extracted file is <=136 lines; existing touched `useLegacyChatHost.ts` is 529 lines.
- Reason: the packet limits new/extracted files, and full host retirement is explicitly 04C. This slice removed aggregate reactive state and stabilized its projections without implementing 04C.
- Files: `useLegacyChatHost.ts`.
- Tests/effect: required gates pass; no new oversize module.
- Risk/downstream: maintainability only; 04C remains the removal/split owner. Proposed classification: `accepted` / no SPEC deviation.

No production-visible observer, fake transport, auth bypass, live profile/database, fixed port 3001, Alpha operation, migration, commit, or push was introduced.

## Skipped/non-gating checks and residual risks

- Full V-RENDER was not run because 04A’s exact packet gate is the R1 subset; full render also includes R7 and R9 repairs owned by 04B/later slices. The exact enforced 04A subset passed.
- A combined optional source-focused command included five page-backed `prompt-ownership.slice-c` cases under the fixture-only config and failed before product execution at `page.goto('/')` because that config intentionally has no base URL. The other 35 cases passed. The valid source-focused identity/threaded subset was rerun alone and passed 29/29. The page-backed Working Activity lane was not rerun against its legacy fixed-port config because the slice requires ephemeral owned ports and Working Activity repair belongs to 04B; V-SUBMIT and V-ISOLATION cover the accepted submission/draft contracts.
- The Electron window reported visible but not OS-focused. The runner records this fact; thresholds, exact retention, coverage, and all long-task gates passed. Owner/native acceptance is not a 04A gate.
- No 5-minute typing, streaming, soak, V-SHELL, V-ACTIONS, or V-ALL was run; those are 04C/full-SPEC gates.

## Requested reviewer disposition

Read-only review only; do not edit. Report only material findings satisfying the four-part materiality rule, plus any advisories. Return `CLEAN`, `NOT CLEAN`, `BLOCKED`, or `AUTHORITY_BLOCKED` for this builder-owned 04A gate.
