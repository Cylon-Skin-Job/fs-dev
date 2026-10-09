# Interim integration observations (not final candidate findings)

Shared with sole writer during implementation; final resolution must be checked against frozen bytes.

- Async subscribe lookup can be overtaken by unsubscribe/same-ID replacement. Per-request generation invalidation and post-await cap/identity checks needed; public route race test.
- Native tap initially did configured-secret lookup even with zero capture/observer on finish. Keep closed path cheap and async redaction bounded/disposable; avoid per-batch keychain work.
- Received rate was capture average; measured reveal rate and last-visible age absent. Unmounted last-known waiting age must not imply live progression.
- Raw JSON escaping can hide exact configured secrets from a free-text redactor, and quoted JSON key syntax is not covered by its plain assignment regex. Exercise quotes/backslashes/newlines and native credential fields within existing redaction policy.
- Native generation alone does not reject delayed first OLD/gen1 frame after canonical NEW begin when native baseline remains0. Need accepted canonical-turn fence/retirement protection, including midturn opening; test delayed old first frame after next turn accepted.
- Confirm socket readiness lifecycle: diagnostics must subscribe only after authenticated ready connection; same-pointer readiness transition cannot strand connection. Root saw ws.onopen authentication separation; final integration must use actual ready state path.

No product edits by root. These are targeted implementation review notes, not independent final gate disposition.

Follow-up root inspection:
- Socket store is installed after authenticated activation, so same-pointer CONNECTING concern does not apply to production.
- Root briefly questioned missing explicit renderer-log rule, then read the full default return: redactMessageForLog already returns only {type} for all other frames. Concern withdrawn immediately; no product change required. Do not represent this as a repaired leak.
- Actual LiveSegmentRenderer registers only completed/current mounted segments. Computing ready-segment count from snapshot records minus frontier yields zero despite queued work. Expose actual passive queue count or label unavailable; do not infer queue from mounted records.

Backend initial checks inspected (server-1.log:8 pass): public client router/subscription handler with mocked activation-binding authority, actual native adapter and deterministic subprocess in one case, two subscribers and exactly one translator call per native event. This is not yet actual runtime-dispatch/public prompt integration. Builder asked for actual adapter stalled-observer/secret integration rather than helper-only claim, and focused runtime dispatch route/observer wiring coverage. Tests are in-progress, not final receipts.

Root confirmed compat.js forwards _sendMessage(message, options) directly to session.sendMessage, so optional observer is not dropped at that seam. Runtime ownership remains current after drain clear until revision replacement; diagnostic current guard includes generation/owned turn. Server workspaceEpoch is per connection: the diagnostic subscription intentionally observes only its exact runtime binding, not another window's epoch.

RD-02 runtime/resource distinction (root integration decision): the initial exact subscriber-epoch == emitter-epoch match was too restrictive for the durable addressed chat. Existing runtime-identity.sameRuntimeResource distinguishes workspace+normalized root+thread from per-connection epoch-specific runtime ownership. Match authorized observers to the same durable resource while independently validating each subscriber's captured binding/epoch and emitter's exact captured runtime/drain/generation. This supports the approved follow-later-turn/reconnect/multiple-observer behavior without changing authority, normal routing or harness lifecycle. Foreign roots/threads and retired subscriber bindings remain excluded. Builder instructed to add separate-valid-epoch observation/isolation evidence. Prior note describing exact epoch-only observation is historical, not final design.
