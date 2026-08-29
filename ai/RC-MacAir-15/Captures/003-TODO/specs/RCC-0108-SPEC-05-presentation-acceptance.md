# RCC-0108 SPEC-05 — Presentation, Acceptance, and Documentation

**Status:** READY FOR IMPLEMENTATION

**Roadmap:** [RCC-0108 Implementation Roadmap](RCC-0108-ROADMAP.md)

**Parent contract:** [RCC-0108 Product Contract](RCC-0108-chat-working-step-activity.md)

**Prerequisite:** SPEC-04 accepted

**Risk:** Medium-High — completion ordering and accessibility must remain exact

## 1. Outcome

Present truthful Working activity and one durable safe terminal error without changing segment/history semantics, expose redacted diagnostics only after explicit user action, and prove the complete lifecycle with deterministic Playwright coverage.

This is the final RCC-0108 SPEC. It owns presentation, integrated acceptance, source-of-truth documentation, and the final ticket evidence.

## 2. Owned Implementation

### Slice A — Working presentation

1. Complete the activity/cursor/seen-ledger/revision state transitions and focused handler integration introduced by the typed SPEC-04 transport. Union the matching ledger, accept activity projection only for a strictly greater server `activityRevision`, and never suppress otherwise valid output.
2. Add a pure `WorkingActivity` component using `HourglassFlow size="sm"`.
3. Keep Working outside `StreamSegment`, `AssistantPart`, and historical rendering.
4. Keep `LiveSegmentRenderer.tsx` intact as the one-job completion pipeline.
5. Decide reveal order inside that renderer:
   - orb disposal is complete;
   - activity belongs to the current turn;
   - no newer renderable event cleared it;
   - `revealedCount >= segments.length`.
6. If output arrives during orb disposal, never flash Working.
7. A later post-tool step renders after already-queued tool segments.
8. Compute whole elapsed seconds from server `startedAt`; do not force an initial `0s`.
9. Use one stable accessible `Model working` announcement and hide changing seconds from live-region repetition.
10. Preserve/add reduced-motion behavior without changing other `HourglassFlow` consumers.
11. Use `.rv-` classes and CSS variables with fallbacks.

### Slice B — Terminal error presentation

1. Validate the closed terminal envelope at the client boundary.
2. Invalid input maps to the generic safe catalog entry without copying unknown fields.
3. On error `turn_end`, clear activity and immediately complete/reveal all queued partial output.
4. Finalize atomically, then render:

```text
completed assistant/tool output
  -> one ChatTurnError
    -> reply chrome
```

5. Do not add an error segment or route through `ToolCallBlock`.
6. Reuse/extract one pure shared compaction/dedupe helper.
7. Prefer the immediate message error, fall back to validated metadata, and never render both.
8. Announce the mounted error once with `role="alert"`.
9. Preserve existing authentication notification behavior without a second transcript row.

### Slice C — Explicit diagnostic actions

1. Show View, Copy, and Ask AI only when a valid opaque diagnostic ID exists.
2. Fetch only after explicit user action.
3. Display/copy only the validated redacted report.
4. Ask AI places the report into the composer for review/editing and never sends it.
5. Mounting, hydrating, or focusing the error cannot retrieve or inject a report.
6. Missing/expired/rejected diagnostics show one fixed safe unavailable state.
7. Update the central client WebSocket log redactor before diagnostic dispatch. A diagnostic response may log only its type, fixed unavailable marker, and opaque route/diagnostic identifiers; it must omit every report field and serialized report from browser console and captured application logs.

### Slice D — Integrated Playwright acceptance

Extend the existing `e2e/working-activity.spec.ts` from SPEC-04:

- add `@working` cases;
- add `@terminal-error` cases;
- retain and rerun `@routing` and `@frontier`;
- do not create a replacement fixture or production-visible test hook.

Automate all parent client scenarios, including return after durable completion, return while in flight, and snapshot/live races.

### Slice E — Documentation and ticket evidence

After code and tests agree:

1. Update the Chat Wiki for bound drains, `step_begin`, stream frontier, snapshot activity/cursor/ledger/revision/error state, route/turn gates, post-terminal correlation, blank suppression, transient rendering, terminal errors, diagnostics, and compatibility-path status.
2. Update RCC-0108 with implemented behavior, changed files, test commands/results, warnings, and residual risks.
3. Close the ticket only when every parent acceptance criterion is satisfied.

## 3. Expected File Surface

```text
fusion-studio-client/src/components/MessageList.tsx
fusion-studio-client/src/components/LiveSegmentRenderer.tsx
fusion-studio-client/src/components/chat/WorkingActivity.tsx
fusion-studio-client/src/components/chat/WorkingActivity.css
fusion-studio-client/src/components/chat/ChatTurnError.tsx
fusion-studio-client/src/components/chat/ChatTurnError.css
fusion-studio-client/src/components/chat/ChatDiagnosticDetails.tsx
fusion-studio-client/src/components/chat/ChatDiagnosticDetails.css
fusion-studio-client/src/components/chat/HourglassFlow.tsx
fusion-studio-client/src/components/chat/HourglassFlow.css
fusion-studio-client/src/state/slices/chatSlice.ts
fusion-studio-client/src/state/slices/chatActivityState.ts
fusion-studio-client/src/lib/ws/activity-stream-handler.ts
fusion-studio-client/src/lib/tool-renderers/shared/error-display.ts
fusion-studio-client/src/lib/ws/chat-diagnostic-handlers.ts
fusion-studio-client/src/lib/ws-client.ts
fusion-studio-client/src/lib/ws/turn-lifecycle.ts
fusion-studio-client/src/lib/ws/thread-handlers.ts
fusion-studio-client/e2e/working-activity.spec.ts
ai/RC-MacAir-15/Wiki/007-Chat_System/**/PAGE.md
ai/RC-MacAir-15/Issues/inbox/RCC-0108.md
```

## 4. Required Playwright Cases

### `@working`

- Delayed first step and truthful nonzero first label.
- Opaque/blank thinking keeps Working without a blank row.
- Visible thinking, assistant content, and tool-first output each replace Working.
- Output during orb collapse produces no Working flash.
- Post-tool new step orders Working after the tool.
- Duplicate/stale step and stale snapshot cannot reset/resurrect activity.
- Equal/lower `activityRevision` cannot change or resurrect Working; a strictly greater revision changes only activity projection and does not suppress valid output.
- No-step harness retains orb fallback.
- In-flight return restores the original start time with an already-revealed baseline.
- Completed return is instant and does not replay.
- Working is absent from historical rendering.
- Exactly one stable accessibility announcement; seconds are not repeatedly announced.
- Reduced-motion behavior.

### `@terminal-error`

- No-output post-begin error.
- Partial text error and partial tool error flush output first.
- Authentication error produces one inline error plus the existing notification.
- Pre-begin failure produces no transcript row.
- Companion error cannot duplicate the inline row.
- Wrong-turn error cannot affect the active turn.
- Terminal snapshot before save acknowledgement produces one message/error.
- The typed terminal envelope handed off by SPEC-04 produces exactly one visible error after the save acknowledgement merges; no duplicate completed message, content, or error appears.
- Saved-history reopen renders one durable error.
- Invalid/raw terminal data maps to the generic safe presentation without disclosure.
- One alert announcement.
- View and Copy fetch only after activation.
- Ask AI places the report in the composer and does not send.
- Missing/expired/rejected diagnostic uses the fixed unavailable state.
- Mount/hydration performs no diagnostic fetch.
- Successful diagnostic retrieval never prints any report field or serialized report to browser console or captured application logs; the test uses a unique canary present only in the returned report and asserts it is absent from all captured log arguments.

## 5. Focused Presentation Gates

Working:

```bash
cd fusion-studio-client
npx eslint \
  src/components/MessageList.tsx \
  src/components/LiveSegmentRenderer.tsx \
  src/components/chat/WorkingActivity.tsx \
  src/components/chat/HourglassFlow.tsx \
  src/state/slices/chatSlice.ts \
  src/state/slices/chatActivityState.ts \
  src/lib/ws/activity-stream-handler.ts
npm run build
npx playwright test e2e/working-activity.spec.ts --grep "@working" --workers=1
```

Terminal errors and diagnostics:

```bash
cd fusion-studio-client
npx eslint \
  src/components/MessageList.tsx \
  src/components/chat/ChatTurnError.tsx \
  src/components/chat/ChatDiagnosticDetails.tsx \
  src/lib/ws-client.ts \
  src/lib/tool-renderers/shared/error-display.ts \
  src/lib/ws/chat-diagnostic-handlers.ts \
  src/lib/ws/turn-lifecycle.ts \
  src/lib/ws/thread-handlers.ts
npm run build
npx playwright test e2e/working-activity.spec.ts --grep "@terminal-error" --workers=1
```

## 6. Final RCC-0108 Gate

```bash
cd fusion-studio-client
npm run build
npx playwright test e2e/working-activity.spec.ts --workers=1

cd ../fusion-studio-server
npm test
```

Then run:

```bash
cd ..
if rg -n "stepNumber|case ['\"]StepBegin['\"]|type: ['\"]StepBegin['\"]|streamRevision" \
  fusion-studio-client/src fusion-studio-server/lib; then
  echo "stale RCC-0108 symbols remain"
  exit 1
fi
```

Visually verify the tool-row footprint, post-tool ordering, reduced motion, error vocabulary, theme contrast, and absence of collapsible tool chrome.

## 7. Acceptance Criteria

SPEC-05 and RCC-0108 are accepted only when:

1. Working is truthful, transient, accessible, and ordered after the orb/queued output.
2. Empty initial output creates no live or historical artifact.
3. Readable thinking and normal text/tool rendering remain unchanged.
4. Completed/in-flight return behavior satisfies the authoritative frontier contract.
5. Error finalization reveals partial output immediately and renders one safe error before reply chrome.
6. History and terminal snapshot/save races produce no duplicate message or error.
7. Diagnostic actions are explicit, bounded, redacted, and never auto-send.
8. The central client WebSocket logger cannot emit any retrieved diagnostic report field or serialized report.
9. `LiveSegmentRenderer.tsx` retains its exactly-once completion dependency graph.
10. All four Playwright tag families pass together.
11. The client build and full server suite pass.
12. The Chat Wiki and ticket evidence match implemented behavior.
13. All 30 parent acceptance criteria are checked and recorded.

## 8. Completion Record

The implementation report must include:

- delivered behavior;
- changed files grouped by SPEC;
- exact commands and results;
- independent review findings and repairs, if used;
- all deviations from predicted file surfaces;
- security/privacy evidence for diagnostic handling;
- residual risks and deferred RCC-0112 cosmetic work;
- the final RCC-0108 ticket state.

## Supervisor Amendment (2026-08-25, post SPEC-01 acceptance review)

DEV-3 carry-forward for the parent-criterion-22 line/job audit: `fusion-studio-server/test/ws/prompt-canonical-route.integration.test.js` is 546 lines — known and intentional (its filename is pinned verbatim by SPEC-01's gate command, single describable job). Treat as accepted or split at a natural boundary during this SPEC's audit; do not flag it as drift.
