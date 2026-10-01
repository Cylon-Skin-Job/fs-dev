# CHAT-SIMPLE-01 C1-A builder handoff

Status: **READY_FOR_ORCHESTRATOR_REVIEW**. Manager: `/root/chat_simple_spec01`. Builder: `/root/chat_simple_spec01/c1a_builder`. Candidate: `sha256:cf93d5d2b63073ccc16ca432bf8fab9fe8f4284fb3c1320b457d2ed8b7a34a54`, owner approval at `implementation/CANDIDATE-APPROVAL.md`.

## Scope and current baseline

- Memory home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control/launchpad/chat-integration-and-retirement`; controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`; product checkout: `/Users/rccurtrightjr./projects/fs-dev`, branch `agent/exact-workspace-paths`, planning HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`.
- Actual tool CWD was separately verified in each location. Applicable product root/server/Wiki and memory/controller AGENTS files were read from disk. The shared product checkout was already extensively dirty. No live DB, profile, app, Alpha checkout, or generated runtime data was edited by this slice.
- Planning SOURCES contained 112 external hashes; orchestrator preflight found 112/112 matches. Immediately before editing, dirty router SHA-256 was `b59f4d74c218e73a4cc828a82a5faa7cbbe08299d7ed1ac78718eac7412036a6`; focused router test was `f65c57a3ff07e54e2c1a5175262ca2ce3a825696a3c2511bd82da1793c9bfb94`. Current source comparison differs on only four of those 112 paths, all changed here: router, router test, Structure Wiki, Protocol Wiki. No missing paths.
- The approved owner decisions retain one deliberate prompt route, server ACK/receipt ownership, Stop and provider retry ownership, passive historyOnly behavior, temporary content-free logger marker, and D-005 broad failure mapping deferral.

## Implementation and owner map

| Changed path under checkout | Current responsibility |
| --- | --- |
| `fusion-studio-server/lib/ws/client-message-router.js` | Public per-connection frame decoder/diagnostic boundary, ordered branch selection, handler factories and exact close cleanup. 362 lines. |
| `fusion-studio-server/lib/ws/view-workspace-ws-handlers.js` | Readiness/discovery lease, captured workspace/view operations, per-recipient registry fan-out, state push and panel ingress. 299 lines. |
| `fusion-studio-server/lib/ws/chat-runtime-ws-handlers.js` | Prompt resolve, initialize/prompt/Stop/response adaptation to existing runtime/provider owners. 197 lines. |
| `fusion-studio-server/lib/ws/file-request-dispatch.js` | Existing file/provenance/agent route selection and versioned File Viewer precedence. 135 lines. |
| `fusion-studio-server/test/ws/client-message-router.test.js` | Public router path assertions for extracted families, diagnostic consumption, order and cleanup. |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/007-Structure/PAGE.md` | Current server owner map and exact source references. |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md` | Exact source references and adding-message owner direction. |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/004-Changelog/PAGE.md` | Bounded dated C1-A architecture entry. |

The displaced inline view/workspace fan-out and lease code, file-family routing, and prompt/provider ingress code are removed from the facade. The existing thread, runtime, receipt, workspace, file, view, and persistence services remain the mutation and provider owners. No temporary adapter, schema, wire message, or migration was added. The three new modules are private; removal criterion is only replacement of their behavior by a later approved owner, with the public facade still routing each family exactly once.

## Acceptance and self-review

- Public order remains `client_log` → `thread:*` → diagnostic prefix with no fallthrough → trusted metadata → file reads → prompt resolve → file mutations → view/workspace/panel → runtime prompt/Stop/response → existing non-chat families → unknown/error. `file_content_request` with File Viewer/version takes the governed route before compatibility panels.
- Prompt uses unchanged private-role guard, request/config validation, captured state/root/workspace/epoch binding, workspace lease, same-attempt lock and existing `acceptPromptThroughRuntime`. The public route has one acceptance owner and no local replay. Stop and response still require captured exact owned wire/session and defer termination to `ThreadWebSocketHandler.cleanup`.
- View mutation/readiness operations retain captured binding and workspace-operation serialization. Registry fan-out retains recipient-specific epoch and independent send failure isolation. Passive thread `historyOnly` still routes through existing thread handlers without new provider effects.
- General ingress diagnostics remain value-free; the existing logger redaction and `temp_chat_boundary_v1` / `TEMP CHAT-AR I-007` marker remain. An unknown diagnostic prefix is consumed before metadata. Close disposes live diagnostics, awaits thread cleanup, then deletes connection/session root without second wire termination.
- Self-review checked each removed inline path has one new owner and no stale import, syntax, four owner sizes, `git diff --check`, preserved exact marker, source hash drift, affected Wiki links/source-file paths, and public route output assertions.

## Exact verification

Environment: macOS arm64; Node `25.6.1`; Jest via `npm test` in `/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server`; test-owned fixtures use temporary roots and no live development profile. Both exact commands ran on current C1-A behavior and rebuilt the native secure-file observer in `pretest` successfully.

| ID | Exact command from server root | Result |
| --- | --- | --- |
| V2 | `npm test -- --runInBand --runTestsByPath test/ws/client-message-router.test.js test/ws/prompt-canonical-route.integration.test.js test/ws/privileged-thread-public-route.integration.test.js test/ws/chat-turn-diagnostic-route.integration.test.js test/ws/live-diagnostic-route.integration.test.js` | PASS, 5 suites / 103 tests. |
| V4 | `npm test -- --runInBand --runTestsByPath test/ws/thread-group-protocol.integration.test.js test/ws/thread-group-member-access.integration.test.js test/ws/thread-group-move-side-chat.integration.test.js test/ws/thread-worksurface-routes.integration.test.js test/ws/prompt-submission-recovery.integration.test.js test/ws/shell-auth-public-route.test.js` | PASS, 6 suites / 83 tests. |

The first intermediate V2 run failed 93 tests because the mechanical extraction carried an unused `wireLifecycle` destructure into the view owner. The line was removed; focused and both exact cumulative commands then passed. Node emitted the existing `--localstorage-file` warning with no valid path. There were no test assertions skipped. V1/V3/V5/V8/V9 and native Electron smoke belong to C1-B or final SPEC integration, so this slice does not claim them.

## Wiki disposition and deviations

- Structure and Protocol updated. Their complete preimages were saved as `.versions/2026-09-28-182331.md` in each article folder. Changelog preimage is `.versions/2026-09-28-182507.md`. Authored metadata uses actual UTC edit timestamps; no generated navigation block was changed.
- Runtime Model unchanged: runtime/receipt/Stop semantics and owner services did not move. Chat Overview unchanged: public contract and accepted CHAT-AR residual status did not change. Thread Actions unchanged: action handler and durable result ownership did not move. Testing And Operations unchanged: required checks were executed but the guidance itself did not change. No deferred broad failure mapping or health subscriber migration is claimed.
- No behavioral SPEC deviation or out-of-scope product touch is proposed. A mechanically necessary test fixture change exposes `sessions` and `clearSessionRoot` spies for exact public close assertions; it changes only the focused test helper. Changelog metadata was normalized under current Wiki authoring guidance while making its dated entry. Proposed classification: accepted documentation/test integration, no observable product effect and no SPEC-02/03 impact.
- Residual risk: this is server ingress parity only. Client transport, native smoke, unified sender migration and inquiry outcome handling remain for C1-B/02/03; later broad Fusion/OpenCode failure mapping remains deferred. The native observer warning is environmental and did not fail either command.

## Current fingerprints and review lifecycle

| Path under checkout | SHA-256 |
| --- | --- |
| `fusion-studio-server/lib/ws/client-message-router.js` | `8e9f6ec7f7d604f3e0e4e175a7443aa105e537696e44e0da0dfdfa2511805bd0` |
| `fusion-studio-server/lib/ws/view-workspace-ws-handlers.js` | `b4155e555676d5d1e482c0bb3c2e252f6e7c246bed52fc4a36026db816be0fc7` |
| `fusion-studio-server/lib/ws/chat-runtime-ws-handlers.js` | `1760aeab66b9ad7145e8a64a9aff6c9a7c7ec50cfa5cd2ce77714a3117de693e` |
| `fusion-studio-server/lib/ws/file-request-dispatch.js` | `d264dcdedf082346f76a0da2d7c361367a3bc088d72400798ee648a70fc20f38` |
| `fusion-studio-server/test/ws/client-message-router.test.js` | `eb6d76a4d4b98a43406a6d6812cbb90c890c0b865aded3c9d953f7ab23cf26f9` |
| Structure Wiki | `39a9b19ec953162e526f2f37d381a7c5dcb5782a0fe69c3c88be10a77208d212` |
| Protocol Wiki | `ad2c4eee810d080894aaacb86ff910c52e1e3f50547606b4fd3df89d6a1946a4` |
| Changelog Wiki | `9ec9772ed7bc2cbcec3bfa2f5a0eb55e48e7ad3edde8c7f8e06dd99f63a5ddf5` |

Builder-owned review gate: **CLEAN** on the fingerprinted bytes above. Fresh, read-only reviewer `/root/chat_simple_spec01/c1a_builder/c1a_clean_review` reached terminal completion with no material findings, no advisories and no additional deviations. The reviewer independently reran V2 (5 suites / 103 tests) and V4 (6 suites / 83 tests) on the reviewed bytes and noted the nonfatal Node local-storage warning. Fingerprints were rechecked after the review and did not change. The available collaboration runtime has no `close_agent` operation; terminal completion was recorded and no second reviewer is active. This builder made no post-review product edit. Do not release C1-B until the orchestrator performs its independent slice gate.
