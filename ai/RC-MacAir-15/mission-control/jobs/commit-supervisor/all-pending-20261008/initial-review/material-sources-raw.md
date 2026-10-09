REVIEW_COMPLETE — `findings`  
Mode: INITIAL. Reviewer: `/root/all_pending_initial_review/material_sources`. Manager: `/root/all_pending_initial_review`.

One material finding, consolidated as **IR-001**.

**IR-001 — Concurrent screenshot saves overwrite one another**

- **Severity:** material.
- **Confidence:** high for filename collision and overwrite mechanics. Native UI overlap frequency was not measured.
- **Violated authority:** CHAT-MATERIAL-SPEC-01 §4.4 and A12 require correlated saved screenshots to remain isolated across concurrent owners, without cross-attachment.
- **Evidence:** [ws-handlers.js](/private/tmp/fusion-main-consolidation-95vxg0_h/candidate/fusion-studio-server/lib/screenshot/ws-handlers.js:22) derives the filename solely from millisecond time. Line 35 writes that path without exclusive allocation. Lines 130–138 return successful responses for both requests.
- **Observable impact:** two same-workspace captures prepared within one millisecond receive the same saved path. One capture replaces the other; both chat pills can reference the later image, despite distinct request IDs and correct renderer routing.
- **Reproduction:** invoke the exact `screenshot:file-capture` handler concurrently with two distinct image buffers. My read-only VM reproduction used real, unmodified `Date`, accepted workspace/protection dependencies, and an in-memory filesystem sink. Pair 1 of 20 returned:
  - Request IDs: `pair-1-0`, `pair-1-1`.
  - Both paths: `/owned/ai/Owned/Data/Screenshots/fusion-capture-2026-10-09T01-05-40-059Z.png`.
  - Source buffers: `PNG-1-0`, `PNG-1-1`.
  - Final stored bytes: `PNG-1-1`.
- **Evidence limit:** this reproduces the current save-handler mechanics without physical filesystem writes. The manager independently reproduced the collision. The dependency is unchanged, but concurrent screenshot isolation is an explicit requirement of this accepted SPEC.

Bounded repair: give each save a collision-safe allocation through the existing save owner, preserving protected-path validation and returned-path metadata. Verify concurrent distinct captures retain distinct paths and their own bytes.

| Required lens | Coverage and result |
|---|---|
| Behavior & Verification | Reviewed clipboard selected/top, recent selected/top, gallery, microphone permission/recording/transcription cancellation, diagnostic retrieval, camera capture/save and presentation seams. No additional material issue found. |
| Standards Compliance | Read the full standards hub and applicable routing/UI/state/protocol/event/persistence/testing routes. Shared insertion uses established owners; portable composer controls receive callbacks. No additional hard-rule violation found. |
| Integrations & Dependencies | Reviewed resource resolution, native screenshot IPC, source cancellation, warming, submission gates and screenshot server save seam. IR-001 affects this immediate dependency. |
| Forward Compatibility | Preserved approved compose-only scope, separate Send/System creation, and existing provenance boundaries. No evidenced obstruction beyond IR-001. |
| Wiki Impact | Reviewed Composer, Screenshot Capture, Structure, Testing/Operations, UI Action Provenance and Wiki/File children against sources. Ownership descriptions otherwise align. Repair should retain accurate concurrent-capture claims. |

Identity and checks:

- Candidate root: `/private/tmp/fusion-main-consolidation-95vxg0_h/candidate`.
- HEAD/baseline: `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`.
- Candidate identity SHA-256: `6e8487a5173edc192f8f3d112b137f1ff0b6e0f6b603ceb94036adc003281762`.
- All 65 accepted-product files matched assembly hashes at final readback.
- Screenshot handler SHA-256: `8d11853e29ee8f0264090145aaf1d461384caeac6b58797a63cb687869756254`; the retained native receipt binds the same handler.
- Retained raw logs passed hash verification: renderer `269 passed`, Wiki `1 passed`, native exit 0. Native receipt records eight PNG captures, four galleries, two resources and four ACK/SQLite readbacks with cleanup.
- Native captures were serial; browser concurrency cases inject saved paths and do not exercise filename allocation.
- Fresh candidate build/renderer logs end with successful build and `269 passed`; command/exit provenance remains supervisor-owned.

Fresh clean-room reviewer; inherited root model/effort with no override; no previous review reports consulted or verdicts relied upon. No delegation, product/document edits, filesystem writes, commits, runtime launches or native actions performed. Raw report returned inline for verbatim preservation at the assigned destination. Terminal result: completed.
