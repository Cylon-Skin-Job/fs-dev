# CHAT-SIMPLE-02 — Unified chat send boundary

## Objective and complete packet

Deliver one private client product-send boundary for the existing renderer chat command callers, preserving truthful local outcomes, each command's admission policy and server authority. This is D-004's second outcome and draft C2-A. Candidate only; approval and implementation in a separate owner-started task precede work.

Normatively incorporate [ROADMAP](ROADMAP.md), [CONTRACTS](CONTRACTS.md) in full, [OWNERSHIP-AND-VERIFICATION](OWNERSHIP-AND-VERIFICATION.md) and [SOURCES](SOURCES.json). Every slice requirement in CONTRACTS **Execution packet inherited by every slice** applies directly. Exact S0 hub/S1–S8 routes and PREF/CHAT/RUNTIME/STRUCTURE/PROTOCOL/ACTIONS are required; no supersession. This packet is independently executable with those accompanying files.

Prerequisite: approved candidate plus completed, independently reviewed and **owner-accepted CHAT-SIMPLE-01** with exact integrated source/build evidence. Verify current checkout, generation/binding ownership and drift from accepted predecessor. C2 does not require deferred provider failure-map resolution because its protected seams remain intact.

## Scope and contract

Implement CONTRACTS **Unified local send result — C2 producer contract** exactly: three statuses with queue/socket destination, fixed reason vocabulary, explicit context and admission policy. Migrate every SEND-01–13 emitter in the finite ownership inventory through that boundary. Preserve the existing one user-text route, canonical message families and domain-owned state/response handling. No blanket queue conversion, automatic mutation/prompt replay, new server schema, provider policy, external API or new cross-capability event.

`ws/product-send.ts` is the proposed focused private owner for serialization/context/result handling. `ws-client.ts` supplies narrow installed/retired connection capabilities. `shell-auth-client.ts` owns actual send/auth queue and exposes rich information before catch handling loses it. Avoid the chatSlice → inbound router → store import cycle. Do not hide duplicate native send code under a new facade. Existing non-chat generic boolean calls may remain only as explicit translations over the same actual machinery.

## C2-A — Complete sender migration

**Fresh builder write scope:** `C/src/lib/ws/product-send.ts`, C1 transport facade/lifecycle integration, `shell-auth-client.ts`, all SEND-01–13 source paths, mechanically required result types in `state/panelStoreTypes.ts`, applicable tests and scoped Wiki changes. `C` is `fusion-studio-client`. Response/domain owners change only to consume local results while preserving their current responsibility. The existing server remains an unmodified authoritative dependency except a documented mechanically necessary integration defect; no server behavior expansion is authorized.

**Public path:** exact host/action/store intent → real shared boundary → existing authenticated product socket/qualified auth queue → existing public server route → owning service/ACK/fan-out → existing client result owner/UI. Use explicit workspace, group/member/session, socket generation and binding context; no target inferred from global current chat. Diagnostic unsubscribe captures old channel target and must refuse a replacement socket.

**Implementation acceptance:**

1. Every SEND row adopts the actual shared function and explicit policy. Socket-only prompt/raw callers never enter the auth queue. Queue-eligible metadata/recovery retain valid-binding bootstrap admission; queued status during activating workspace:init still works before hasReceivedInit projection completes.
2. Native return produces enqueued/socket; qualified local queue admission produces enqueued/auth_queue only. Serialization/refusal/prewrite cases are definitely not_enqueued; increased-buffer or unprovable catch is uncertain. No caught auth false is relabelled definitely absent without evidence.
3. Entry and flush validate exact socket/generation/workspace/epoch/revision. beginInit invalidates old context; same-ID rebind and A→B→A cannot flush stale work. Preserve FIFO/bounds/fail-close/retirement; dropped queue entries are never replayed to replacement.
4. Prompt keeps draft/attachments on definite refusal, records unknown on uncertainty, and waits for message:sent before one accepted bubble. Group/open/model/creation/metadata/diagnostic controllers consume each outcome as specified; response listeners remain alive for possible sends. Local admission never represents stopped, created, saved or accepted.
5. All migrated raw `.send`/JSON serialization paths disappear. Payload builders remain builders. Non-chat exclusions retain their current route; migrate chat worksurface open directly so put/get/placement helper is unchanged. Any shared-helper deviation receives its mandated regression checks.
6. C2 changes recovery sender type/wiring to expose truthful result, while C3 owns the actual ignored-result transition fix. Do not change its timer/late-response behavior prematurely. The remaining C3 seam is explicitly recorded at C2 handoff.

**Checks:** V1, V4, V5, V6, V8, V9 and static retirement searches from ownership/verification. Add `e2e/chat-send-transport.spec.ts` with table-driven coverage of all SEND IDs using the production boundary; do not substitute a mocked sender. Extend corrected isolated native smoke using deterministic provider/real routes/SQLite for exact Main/Side prompt and durable action/readback; it must run under the stated existing entry command. Preserve shared auth/clipboard bootstrap and current two-second hourglass tests. No passed planning check substitutes for these future gates.

**Documentation:** update PROTOCOL's local versus server result distinction and STRUCTURE's sender/type/owner paths. Record all caller policies and preserved uncertainty, not a claim that every app socket send or future plugin is unified. Update RUNTIME/Testing guidance only for changed connection/admission assertions; retain D-005 limitations and temporary logger marker.

**Handoff:** CONTRACTS execution gates apply in full: fresh builder, self-check, deviation log, required checks and fresh builder-owned clean-room review before `READY_FOR_ORCHESTRATOR_REVIEW`; independent fresh orchestrator review and repair-forward on material findings. No arbitrary pass ceiling; stop each gate at first clean pass. Every descendant inherits root model/effort.

## Integration and release

Complete finite caller/policy matrix with final paths and current-byte source/build/test evidence. Prove each command family uses the same physical product-send owner while domain acknowledgements remain authoritative. No protocol/data migration is required; remove dead replaced helpers in scope instead of shimming a second path. Verify D-005 repair seams and no new published consumer contract.

Present combined SPEC-02 outcomes, evidence, all deviations/downstream effects and residual C3 seam to the owner. **Explicit SPEC-02 acceptance releases SPEC-03.** Neither successful queueing nor passing unified-send checks declares earlier accepted/no-response failures solved.
