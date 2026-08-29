# RCC-0108 SPEC-03 — Server Terminal Errors and Diagnostics

**Status:** READY FOR IMPLEMENTATION

**Roadmap:** [RCC-0108 Implementation Roadmap](RCC-0108-ROADMAP.md)

**Parent contract:** [RCC-0108 Product Contract](RCC-0108-chat-working-step-activity.md)

**Prerequisite:** SPEC-02 accepted

**Risk:** High — this adds a security-sensitive persistence and disclosure boundary

## 1. Outcome

Terminalize every accepted failed turn exactly once with the fixed provider-neutral catalog, preserve partial output, persist only the safe envelope, and offer a separate bounded redacted diagnostic through an exact route/turn/ID lookup.

This SPEC owns server error semantics and diagnostic storage/retrieval. It does not implement error presentation or automatic diagnostic access.

## 2. Closed Error Contract

Only these internal markers may produce a specific terminal catalog result:

```ts
type HarnessRuntimeErrorCode =
  | 'HARNESS_AUTHENTICATION_FAILED'
  | 'HARNESS_MODEL_TIMEOUT'
  | 'HARNESS_PROCESS_EXIT';
```

Only these transcript codes are valid:

```ts
type TurnTerminalErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'MODEL_TIMEOUT'
  | 'HARNESS_EXITED'
  | 'MODEL_RESPONSE_FAILED';
```

The exact kind, message, and recoverability values come from parent §4.13. Shared runtime code checks only a genuine `HarnessRuntimeError` marker and never parses arbitrary error codes, names, messages, causes, stacks, or string lookalikes.

Stop and intentional cancellation remain interrupted, not failed.

## 3. Diagnostic Redaction Contract

OpenCode may inspect native failure data only inside its adapter boundary and may construct only `HarnessDiagnosticCandidateV1`. It must never traverse or serialize an arbitrary Error/provider object.

Before a candidate crosses the adapter boundary:

1. Keep only the closed V1 fields.
2. Replace exact configured secret values obtained from the existing secret/configuration owner.
3. Replace exact non-empty environment values whose keys match:

```text
(?:^|_)(TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|PRIVATE_KEY|ACCESS_KEY|SESSION|COOKIE|AUTH|CREDENTIALS?)(?:_|$)
```

using case-insensitive key matching.
4. Also replace values for OpenCode credential environment keys explicitly read by the adapter.
5. Redact credential/token/private-key patterns and URL userinfo.
6. Rewrite user-home and project-root prefixes to `$HOME` and `$WORKSPACE`.
7. Remove disallowed control characters.
8. If redaction fails, omit all free-form text and retain validated structured fields only.

The server diagnostic service repeats closed-shape validation and bounds. It must not gain a raw-error input.

## 4. Owned Implementation

### Slice A — Harness markers

1. Add provider-neutral `HarnessRuntimeError`.
2. Translate OpenCode native authentication, timeout, and process-close signals at the adapter boundary.
3. Throw only the fixed marker plus an optional already-redacted candidate.
4. Remove shared `-32004` and authentication-message classification.
5. Leave historical non-OpenCode raw failures generic unless that adapter already emits the shared marker.

### Slice B — Terminal normalization and durability

1. Add `turn-terminal-error.js` with an allowlisted catalog reconstruction.
2. Terminalize one post-begin exception as `reason: 'error'`, `partial: true`.
3. Attach the safe error only to the error `turn_end` and terminal snapshot.
4. Reject/omit terminal errors for normal/interrupted reasons.
5. Preserve all partial text/tool output in runtime state.
6. Keep a terminal error snapshot until durable save catches up.
7. Persist only `exchange.metadata.terminalError`; never create an assistant part.
8. Let `chat-turn:saved` merge durable identity/metadata without a second exchange or error.
9. Pre-begin failures create no assistant exchange.

### Slice C — Diagnostic table and service

1. Add the next migration for a dedicated diagnostics table.
2. Store the authoritative workspace/thread/turn binding, UUID diagnostic ID, validated report, creation/expiry timestamps, and fields needed for oldest-first cleanup.
3. Enforce:
   - 128 UTF-8 bytes per short identifier;
   - 4 KiB message prefix;
   - 16 KiB stderr tail;
   - at most 16 allowlisted truncation markers;
   - 24 KiB final serialized report;
   - 30-day retention;
   - 500 rows per workspace;
   - 5,000 rows total.
4. In one transaction before/with insertion, purge expiry and evict oldest rows to both caps.
5. Run the same cleanup at startup.
6. Roll back a failed cleanup/insert and continue terminalization without an ID.
7. Do not use `event_log`, assistant parts, or general exchange metadata for the report.

### Slice D — Retrieval and publication

1. Add focused `chat-turn:diagnostic:get`.
2. Register it through the public client WebSocket message router and a focused diagnostic request handler; do not hide registration inside the service or reuse metadata-update routing semantics.
3. Validate exact `workspaceId + threadId + turnId + diagnosticId` ownership.
4. Return at most one validated 24 KiB report.
5. Return one fixed value-free unavailable response for missing, expired, rejected, or unavailable records.
6. Never include reports in `thread:open`, lifecycle publication, history hydration, logs, or metadata.
7. Keep companion `error`/`auth_error` notification behavior but prevent a second transcript terminal source.
8. Preserve the `streamSeq` contract established by SPEC-02 on error `turn_end`.

## 5. Expected File Surface

```text
fusion-studio-server/lib/harness/types.js
fusion-studio-server/lib/harness/errors.js
fusion-studio-server/lib/harness/opencode/harness-diagnostic-redactor.js
fusion-studio-server/lib/harness/opencode/index.js
fusion-studio-server/lib/thread/turn-terminal-error.js
fusion-studio-server/lib/thread/harness-diagnostic-service.js
fusion-studio-server/lib/thread/thread-runtime-manager.js
fusion-studio-server/lib/thread/thread-runtime-controller.js
fusion-studio-server/lib/thread/thread-runtime-automation.js
fusion-studio-server/lib/thread/live-turn-snapshot.js
fusion-studio-server/lib/db/migrations/<next>_harness_error_diagnostics.js
fusion-studio-server/lib/wire/canonical-chat-terminal-events.js
fusion-studio-server/lib/wire/wire-broadcaster.js
fusion-studio-server/lib/audit/audit-subscriber.js
fusion-studio-server/lib/ws/client-message-router.js
fusion-studio-server/lib/ws/chat-turn-diagnostic-handlers.js
fusion-studio-server/test/harness/harness-runtime-error.test.js
fusion-studio-server/test/harness/opencode/harness-diagnostic-redactor.test.js
fusion-studio-server/test/harness/opencode/harness-send-message.test.js
fusion-studio-server/test/thread/turn-terminal-error.test.js
fusion-studio-server/test/thread/harness-diagnostic-service.test.js
fusion-studio-server/test/thread/thread-runtime-controller.test.js
fusion-studio-server/test/thread/thread-runtime-automation.test.js
fusion-studio-server/test/wire/canonical-chat-event-applier.test.js
fusion-studio-server/test/wire/wire-broadcaster.test.js
fusion-studio-server/test/thread/audit-subscriber-chatlog-finalize.test.js
fusion-studio-server/test/ws/chat-turn-diagnostic-handlers.test.js
fusion-studio-server/test/ws/chat-turn-diagnostic-route.integration.test.js
```

## 6. Required Tests

- Every catalog row and unknown fallback.
- All three exact OpenCode native-to-marker mappings.
- Raw code/text/name lookalikes remain generic outside OpenCode.
- Historical non-OpenCode raw error remains generic.
- Shared code contains no `-32004` or authentication-message classifier.
- No-output post-begin error and partial text/tool error.
- Exactly one error terminal publication and exchange.
- Pre-begin failure produces no exchange.
- Error terminal snapshot survives the save race.
- Metadata rehydrates only the safe envelope.
- Every field, total size, retention, workspace cap, and global cap.
- Prefix/tail truncation and allowlisted truncation markers.
- Every sensitive environment key-family alternative, an adapter-declared credential key, and a nearby non-sensitive environment key.
- Configured-secret, URL-userinfo, token/private-key, home, workspace, and control-character redaction.
- Redactor failure yields structured-only output.
- Cleanup, migration, insertion, and retrieval failures do not alter terminalization.
- Cross-workspace/thread/turn/ID retrieval denial.
- A public-route integration test enters through the client WebSocket message router, proves `chat-turn:diagnostic:get` is registered, and exercises success, unavailable, and ownership-denied responses through the real diagnostic handler/service boundary.
- An unknown or malformed diagnostic request cannot fall through to metadata update handling or return a report.
- Raw error/provider object/stack/stderr/prompt/attachment/secret exclusion from lifecycle, snapshot, metadata, logs, and database.
- No accepted-only UEB relationship or `event_log` diagnostic.

## 7. Exact Acceptance Gate

```bash
cd fusion-studio-server
npx jest --runInBand \
  test/harness/harness-runtime-error.test.js \
  test/harness/opencode/harness-diagnostic-redactor.test.js \
  test/thread/turn-terminal-error.test.js \
  test/thread/harness-diagnostic-service.test.js \
  test/harness/opencode/harness-send-message.test.js \
  test/thread/thread-runtime-controller.test.js \
  test/thread/thread-runtime-automation.test.js \
  test/wire/canonical-chat-event-applier.test.js \
  test/wire/wire-broadcaster.test.js \
  test/thread/audit-subscriber-chatlog-finalize.test.js \
  test/ws/chat-turn-diagnostic-handlers.test.js \
  test/ws/chat-turn-diagnostic-route.integration.test.js
```

## 8. Acceptance Criteria

SPEC-03 is accepted only when:

1. Specific classification occurs only in the OpenCode boundary or from an existing valid shared marker.
2. Shared code reconstructs one of four fixed safe envelopes.
3. Every accepted post-begin failure terminalizes exactly once and preserves partial output.
4. Pre-begin failure creates no assistant exchange.
5. The diagnostic candidate and stored report satisfy the closed shape, redaction, bounds, retention, and ownership contract.
6. Diagnostic failure cannot block or rewrite terminalization.
7. Ordinary chat paths contain no report or raw provider material.
8. Error `turn_end` preserves the authoritative `streamSeq`.
9. The public WebSocket route proves registration, exact ownership enforcement, bounded success, and fixed unavailable behavior through the real handler/service boundary.
10. Focused tests pass before SPEC-04 begins.

## 9. Handoff to SPEC-04

Record the final terminal envelope validator rules, diagnostic request/response wire shapes, terminal snapshot shape, and post-terminal save-correlation fields. SPEC-04 consumes those exact shapes and must not loosen validation.

## Supervisor Amendment (2026-08-25, post SPEC-01 acceptance review)

DEV-5 carry-forward: SPEC-01 deliberately left the failure-path canonical terminalization slot vacant (baseline had no exception-path `turn_end` synthesis; verified against `4f972c5`). This SPEC owns implementing it through the existing bound machinery: `terminalizeTurn(key, identity, status)` + `CanonicalDrainControl`, per parent criteria 9/16. Until this SPEC lands, error-failed turns keep an in_flight snapshot with a warn-logged leftover record replaced on next claim.
