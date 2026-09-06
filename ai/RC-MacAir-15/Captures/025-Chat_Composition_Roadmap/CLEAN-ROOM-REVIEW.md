# Chat Composition Roadmap — Clean-Room Review

**Candidate:** `CHAT-COMPOSITION-a07c15a4d1b153f9`  
**Final verdict:** `CLEAN`  
**Reviewed:** 2026-09-03  
**Review mode:** fresh read-only current-byte review

## Scope

The final semantic reviewer and subsequent exact-hash verification read the
normative artifacts named in `RELEASE-MANIFEST.md`, the repository `AGENTS.md`, directly routed Code
Standards and Chat System pages, source Vision decisions and SPECs, the external
Agent Tool Provenance contract, and relevant current code where needed.

The review tested:

- owner-intent fidelity and the four-SPEC domain split;
- dependency and acceptance gates;
- stable view identity and migration safety;
- trusted Fusion-shell origin, transport, and one-use proof authority;
- group/session/turn/exchange/model/surface/tab/placement identity boundaries;
- public-route vertical slices;
- group deletion, retry, cleanup, and Provenance retention;
- composable chat state isolation;
- worksurface single ownership, acknowledged switching, concurrency, and
  managed placement lanes;
- Generic Component Tab Host non-ownership;
- native and adapterless Side Chat placement;
- Move activity, MRU, primary history, Move/Delete ordering, member access,
  exact-member links, close/reopen, restart, and multi-window behavior; and
- executable acceptance and regression coverage.

## Review Loop

Earlier fresh passes identified material defects. Validated defects were repaired
forward and recorded in `ISSUES.md`, including generic-placement ownership,
trusted-shell authority, view-ID preflight, worksurface flush/merge rules,
multi-member access, global writer cutover, adapterless view support, MRU and
race semantics, vertical slice shape, model-selection authority, deep links,
Delete recovery, event vocabulary, and membership origin.

Each normative repair invalidated the preceding verdict. The final pass reviewed
the corrected bytes without receiving prior diagnoses or a desired conclusion.

## Final Result

The final semantic reviewer reported:

> CLEAN — No material release blocker found in the current candidate.

The reviewer specifically verified:

- `set_harness_selection` accepts only portable `{model, variant}` while the
  harness remains immutable server-owned state;
- a new-request-ID Delete recovery durably records the retained aggregate under
  the new request ID;
- Move uses `origin_kind='move-to-side-chat-primary'`;
- primary history consistently uses `reason='move-to-side-chat'`;
- SPEC-01 owns group/sole-current links and SPEC-04 exclusively owns
  non-primary Side Chat link behavior;
- secure-shell, migration, vertical-slice, worksurface, Generic Host, Side Chat,
  and Provenance contracts remain coherent across the bundle; and
- the unaccepted Provenance and Generic Component Tab Host implementations are
  correctly represented as execution gates, not planning blockers.

After the bundle-index evidence statuses were advanced, a fresh reviewer
spot-checked the new normative bytes and found no additional semantic
contradiction. The candidate hashes and ID below were then regenerated for that
exact index version and independently verified.

## Advisories

There are no material findings. The external Agent Tool Provenance and Generic
Component Tab Host implementations must still be independently owner-accepted
before their dependent SPECs may execute.
