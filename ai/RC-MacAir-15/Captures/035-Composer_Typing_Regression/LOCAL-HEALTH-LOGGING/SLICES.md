# HL-01 slice packets

Read the complete `SPEC-HL-01.md`, `VALIDATION.md`, authority ledger and exact standards paths in `INDEX.md` before any slice. Each packet includes necessary mechanical integration to make its vertical path real; do not leave wiring to a hypothetical later builder.

## Common builder/orchestrator protocol

Each slice uses a fresh `spec-slice-builder` inheriting the invoking root model and reasoning effort. A builder implements only its assigned slice and necessary integration, self-reviews, runs required checks, records every deviation and downstream effect, and obtains a materially clean builder-owned review before returning `READY_FOR_ORCHESTRATOR_REVIEW`. It may spawn only fresh `clean-room-reviewer` agents, never another builder. Stop review after the first CLEAN pass; repair forward and obtain a fresh pass for material repairs without an arbitrary pass ceiling. Advisories do not invent new scope.

The SPEC orchestrator independently inspects the changed bytes and evidence, then obtains fresh `clean-room-reviewer` passes, stopping after the first CLEAN pass or routing material repairs back through a builder until clean. Material acceptance repairs require fresh builder-owned and orchestrator-owned reviews. A new builder owns each new slice. Builders are not alone in the checkout; preserve all unrelated user/worker edits, reconcile shared files and never reset other changes. Single owner for each shared file/runtime lane.

Every packet returns: changed-file inventory and hashes; accepted baseline; commands and raw outcomes; privacy/bounds evidence; deviations with authority and effect on consumers; residuals; fresh review packets. No commit/push, Alpha, upload or human-session restart is authorized. Supervisor presents completed SPEC to owner for explicit acceptance before following SPECs.

## HL-01A — server lifecycle to bounded store and readback

Ownership: new `fusion-studio-server/lib/health-logging/` core schema/validator/projection API, worker and migrations, server startup/shutdown integration, minimal manual `status/events` readback command and focused server tests. Do not modify renderer or reveal behavior.

Implement a real startup/runtime-start observation, bounded optional worker initialization, per-profile store/key identity, exact separate-store migration behavior, count/age/physical retention, queue/IPC bounds and optional shutdown. Establish code-owned event registry and query identity checks. Use fixed runtime/health events to exercise a real lifecycle path, not just a standalone insert helper. Supply bounded queue and integrity status needed by later instrumentation.

Validation: V1–V5 plus V9 storage/query baseline in `VALIDATION.md`; actual server startup into disposable profile, lifecycle readback, shutdown/restart, injected init/write/corruption/newer-schema failures without chat bootstrap failure, primary DB unchanged by logger-only operations, all limits using small fixtures plus full-size qualification scheduled in C. Initial CLI must not create/migrate a missing DB.

Exit evidence includes path/profile isolation and unsupported/disabled behavior. Deliver typed projection/worker API, limits and schema/query guide to B; freeze v1 envelope and field validation. Retention is not deferred to C; C independently qualifies the integrated result.

## HL-01B — real numeric observations through owning routes

Prerequisite: A passed both gates. Ownership: minimal integration in server thread/wire/diagnostic domain owners, renderer stream/reveal/composer/transport owners, Electron lifecycle/child-channel owners, event definitions and related tests. Preserve existing raw viewer, primary persistence and normal render behavior.

Implement catalog §4.2 and sampling/identity semantics, including always-on content-free observations when raw Diagnostics is closed. Construct scalar projections before any telemetry boundary. Reuse accepted stream sequence gate and actual reveal progress. If bounded active-frontier accessor is required, add it without changing pacing or completion. Implement trusted numeric batch route within named diagnostic family; private Electron producer cannot be spoofed by renderer. Initialize/dispose exactly once per owner; no content-bearing channel subscription as a shortcut.

Validation: V1, V3, V6–V8 and route regression checks in V10. Public authenticated scripted turn with known content → accepted/save/reveal/composer/connection observations → manual DB readback. Two simultaneous chats, two mounts, old-turn late events, disconnected/hidden/unmounted sources, source reload and Stop. Supported native lifecycle callbacks exercised without changing machine lock/power state. Assert normal chat transcript/output, provider invocation count, saved rows and reveal policy match control.

Exit: required family registry with exact units/availability and event/source provenance; producer rate/cost accounting; fresh reviews. C receives exact fixtures/build IDs and known unsupported observations, not unverified claims.

## HL-01C — manual investigations and integrated qualification

Prerequisite: B passed both gates. Ownership: finish read-only CLI/query recipes and documentation, integrated privacy/resource/performance tests, isolated Electron smoke, packaging inventory and evidence report. Material product repairs route through the existing responsible builder boundary plus fresh reviews; no expansion into a dashboard/export/plugin.

Implement presets/filter/pagination/deadlines, correlation resolver and query-time statistics over retained samples with correct coverage labels. Qualify full 1M-event cap and actual physical-budget algorithm, query-vs-writer contention and no-growth failure behavior. Run whole v1 privacy probes and paired logging on/off performance tests on the same product candidate. Document actual overhead and observation rate instead of asserting a guessed CPU percentage.

Validation: all V1–V11, including A/B repeats on integrated source, client build, route regressions, separate-store identity on restart, packaged runtime file inclusion, actual isolated Electron smoke, and content-free query examples demonstrating the current backlog/composer problem shape.

Exit: final source/build/evidence manifests, before/after performance table with explicit limitations, schema/query guide, all deviations and downstream effects, both CLEAN gates, no implication of CHAT-AR acceptance. Do not restart the owner's retained human app until specifically requested.
