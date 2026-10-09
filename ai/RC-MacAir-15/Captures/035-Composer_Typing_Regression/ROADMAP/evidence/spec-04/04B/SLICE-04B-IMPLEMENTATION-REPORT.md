# SPEC-04 Slice 04B Implementation Report

Status: **READY_FOR_ORCHESTRATOR_REVIEW**

Candidate: branch `agent/exact-workspace-paths`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, shared dirty checkout. Exact owned source identity is `SOURCE-SHA256.txt`.

## Outcome

Completed messages now carry deterministic content and metadata revision identities. Each completed row is a memoized observation boundary: live frontier updates may re-enter `MessageList`, but unchanged completed rows do not render or invoke Markdown/tool formatting. Metadata changes re-render only the addressed row while unchanged content retains its mounted derived values.

Derived Markdown, tool, and grouped-tool values live only in the mounted history row/component tree. There is no global cache or retained history index. A content/segment edit changes the content revision and formatter dependencies; hydration replaces the rows; row retirement unmounts and releases every derived value. This preserves selection, scroll position, expanded tools, links, bookmarks, reply chrome, and native copy semantics without virtualization.

The mandatory Working-return race is repaired at the transport projection boundary. An exact cached in-flight snapshot already accepted by revision may re-project activity only during the sanctioned open-race slot rebuild, only for the exact current turn and exact equal revision. It does not advance the revision or admit lower/stale activity. The original server-authoritative `startedAt` is restored.

`LiveSegmentRenderer` was not split or modified. Stable 04A shell/composer ownership and its test-only coverage/focus oracles remain intact.

## Owned files and responsibilities

Production:

- `src/lib/chat/message-revisions.ts` — deterministic content/metadata revision derivation.
- `src/types/chat.ts` — optional completed-message revision fields.
- `src/state/slices/chatSlice.ts` — install/recompute revisions at add, finalization, save merge, and metadata update boundaries.
- `src/components/MessageList.tsx` — per-completed-row memo observation boundary.
- `src/components/InstantSegmentRenderer.tsx` — component-lifetime Markdown/tool/grouped-tool derived values.
- `src/lib/ws/activity-stream-handler.ts` and `snapshot-restore.ts` — exact-equal accepted activity re-projection for the open-race rebuild only.

Tests/runner:

- `e2e/chat-surface-isolation.spec.ts` — 20fps quiet-history/public-UI and scoped metadata/edit/hydration/release cases.
- `e2e/chat-architecture/r7-history-playwright.mjs` — owned R7 history/live wrapper and bounded evidence.
- `e2e/chat-architecture/scenario-inventory.mjs` and `run.mjs` — enforceable R7 history/live inventory/case.

The shared dirty diff also contains accepted prior-slice and concurrent-worker changes in several of these files. They are not 04B-owned and were preserved.

## Acceptance mapping

| 04B criterion | Current implementation and evidence |
| --- | --- |
| Stable completed content/metadata identity | `message-revisions.ts`; revisions installed at every completed-message state boundary. R7 compares both revisions before/after scoped metadata. |
| Live frontier never formats history | R7 delivers 20 canonical content frames at 50 ms intervals and records `MessageList > 0`, `InstantSegmentRenderer = 0`, `renderTextInstant = 0`. |
| Relevant metadata invalidates only affected message | Two independent metadata updates change only the addressed assistant revision/row. Unaffected revision objects are exact; Markdown remains quiet; grouped-tool DOM/expansion survives its metadata-only refresh. |
| Real edit/hydration invalidates stale cache | Same exchange ID is hydrated with changed content/bookmark. Old content disappears, new content is formatted and visible, and exactly one exchange pair remains. |
| Retired values release within bounded lifetime | Formatting is stored only by React `useMemo` inside mounted rows; hydration unmounts old rows and the test proves the old projection is absent. No module/global cache exists. |
| RCC-0108 routing/frontier/finalization | Owned full boot passed every routing/frontier/finalization case, including ordered/buffered snapshots and exactly-one terminal-snapshot/save row. |
| Durable terminal error/interruption dedupe | All core terminal error/save/reopen/dedupe cases passed in the owned full boot. |
| Public UI behavior | R7 proves exact history DOM nodes, selection, scrollTop, expanded tool state/content node, link, and bookmark chrome survive live/metadata updates. Full boot proves reduced motion and diagnostic copy. No virtualization was added. |
| Mandatory original `startedAt` return | Authenticated page-backed ephemeral-port run `boot-1790139173127-0c1b821b` passed the exact named case. |
| V-BUILD and cleanup | V-BUILD passed 1,941 modules. R7/boot/focus receipts show no leaked owned PID and removal of disposable roots; R1 SQLite quick check is `ok`. |

## Verification

- `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce --cases F1-PUBLIC-ROUTE,R7-HISTORY-LIVE` — PASS, run `chat-arch-1790139255483-4864372976`; authenticated public route plus R7 2/2.
- Final R7 rerun after grouped-tool cache self-review repair: `--cases R7-HISTORY-LIVE` — PASS 2/2, run `chat-arch-1790139739078-8e4069b918`; no leaked PID, owned root removed.
- `node fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs boot --working-return` — PASS 1/1, run `boot-1790139173127-0c1b821b`, ephemeral port 63364, authenticated/page-backed, no leak, owned root removed.
- `node fusion-studio-client/e2e/chat-architecture/owned-regression-launcher.mjs boot --all` — 129/130 PASS, run `boot-1790139404160-dd7e263e`, ephemeral port 63397. Every 04B routing/frontier/Working/reduced-motion/terminal persistence/dedupe/copy behavior passed. One disclosed unrelated stale SPEC-05 diagnostic status-text assertion failed; see below. Cleanup passed.
- `node fusion-studio-client/e2e/chat-architecture/run.mjs --suite render --mode enforce --cases R1-F2-F3-COMPOSER` — structured pre-timing stop `R1_FOCUS_UNAVAILABLE`, run `chat-arch-1790139562767-dce9f408d1`. Exact staged window was visible/non-minimized but unfocused after 48 attempts; `measurements=[]`; thresholds were not weakened; cleanup and SQLite quick check passed.
- `npm run build` in `fusion-studio-client` — PASS, 1,941 modules.
- Scoped `git diff --check` — PASS.

Raw/bounded receipts are copied into this folder. Primary runner artifacts remain under the shared accepted `evidence/spec-01/01B|01C/<run-id>` roots.

## Self-review and repairs

- Reproduced the mandatory Working-return failure before repair: the open race cleared the addressed slot, the equal cached snapshot rebuilt the baseline, and the strictly-greater activity gate left accepted Working absent.
- Limited re-projection to exact equal revision plus exact current turn in the sanctioned cached-snapshot rebuild; lower revisions and ordinary equal snapshots still drop.
- Found and repaired metadata-only grouped-tool recomputation by memoizing segment grouping on the stable segment-array reference. Added a DOM identity/expanded-state regression for the tool-derived subtree.
- Confirmed content and metadata inputs are separated, no cache key depends on array position, and no global/session-unbounded formatted cache was introduced.
- Confirmed finalization normalizes the message before/after save merge without creating another row; existing terminal snapshot/save and reopen tests pass.
- Confirmed no `LiveSegmentRenderer` change, virtualization, DB/migration, server, Alpha, port-3001, owner-window, production probe, commit/push, or destructive operation.

## Builder review history and lifecycle

- Pass 1: `/root/spec04_slice04b/review_04b_pass1`, fresh read-only `clean-room-reviewer`, terminal **CLEAN**, no material findings.
- The reviewer verified the exact 11-file manifest, digest `77803db53182f921ae2c562e3e4000ff5ce33462158c9c39eb24b5c8d3986c5a`, current integration/evidence/deviation packet, and returned no requested repair.
- `list_agents` confirmed terminal completion. This runtime has no `close_agent` operation, so a closure attempt was unavailable; this is lifecycle evidence only.
- No source/evidence repair followed the clean review.

## Deviations, adapters, and downstream effects

### D-04B-1 — shared runner artifact roots

- Original: 04B evidence belongs under `evidence/spec-04/04B`.
- Actual: shared runners write immutable primary artifacts to accepted SPEC-01 `01B`/`01C` roots; bounded receipts are copied into 04B.
- Reason: preserve runner ownership and downstream consumers.
- Effect/risk: evidence bookkeeping only; no product effect. Proposed classification: accepted compatibility adapter.

### D-04B-2 — equal accepted snapshot projection rebuild

- Original: activity revisions are strictly greater.
- Actual: one exact-equal accepted activity projection may be rebuilt after the addressed open path cleared its UI slot.
- Reason: mandatory carried red case requires the already accepted server `startedAt` to return over an already revealed baseline; treating it as a new transport transition would be wrong.
- Guard/effect: exact current turn plus equal revision plus explicit rebuild call site only; namespace revision is not advanced. Ordinary equal/lower snapshots remain rejected. Proposed classification: accepted bounded repair preserving the transport contract.

### D-04B-3 — R7 history/live runner case

- Original: R7 covers live/Stop/finalization broadly.
- Actual: the shared render suite gains an enforceable `R7-HISTORY-LIVE` case for completed-history quietness and cache/UI behavior.
- Reason: the 04B-specific pass criteria were not otherwise measured by the runner.
- Effect/risk: test-only, low. Downstream full V-RENDER inherits the case. Proposed classification: accepted mechanically necessary verification.

No 04C aggregate-host retirement or SPEC-05 product behavior was implemented. 04C may remove legacy host compatibility while retaining the completed-row boundary. SPEC-05 remains free to refine diagnostic status taxonomy without changing this cache design.

## Skipped checks and residual risks

- R1 timing was not measured because the Mac was locked. The runner returned structured `R1_FOCUS_UNAVAILABLE` before timing, with positive coverage calibration and honest cleanup evidence. A focused rerun remains required for new wall-time evidence; accepted 04A focused evidence remains unchanged at its accepted bytes.
- Full boot has one current-byte failure outside 04B: `@terminal-error Ask AI cannot overwrite a server-owned pending acceptance` expects the old `Wait for the current message...` status, while accepted current 04A/concurrent bytes intentionally render `Unable to add diagnostic...`. The same test still proved one prompt, unchanged draft, and no overwrite. 04B did not change the diagnostic component, submission action, or this stale assertion. Proposed classification: out-of-scope concurrent current-byte oracle mismatch; retain as an explicit red, do not mask or repair in 04B.
- The revision hash is deterministic non-cryptographic identity with serialized-length suffix, not a security boundary. Inputs are local presentation state; a theoretical deliberate collision is residual low risk. Hydration/edit regressions prove ordinary invalidation.
- React component-lifetime release is structural rather than GC-timing based; the tests prove retirement/unmount and absence of stale DOM, not nondeterministic heap collection.

## Security/privacy and cleanup

Fixtures contain sanitized deterministic strings only. No private transcript, live profile, live DB, raw provider error, or owner-window content was read or recorded. Evidence records frame/test names and bounded synthetic content. Owned ports were ephemeral; staged roots and processes were removed.

Final source identity: 11/11 current hashes in `SOURCE-SHA256.txt`; manifest digest `77803db53182f921ae2c562e3e4000ff5ce33462158c9c39eb24b5c8d3986c5a`.

Final builder disposition: **READY_FOR_ORCHESTRATOR_REVIEW**.
