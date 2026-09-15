# Plugin Backend — Handoff

**Capture:** backend handoff · **Parent:** [`../030-Plugin_System/plugin-system-vision.md`](../030-Plugin_System/plugin-system-vision.md)
**Updated:** 2026-09-15

## Current state

- `backend-architecture.md` drafted and linked from the root capture map. It is
  a working architecture, not an approved SPEC; no backend code exists for the
  plugin system.
- No `decisions.md` / `issues.md` here yet — backend-specific entries will be
  added when they accumulate, per the capture system.

## Next actions

1. Owner review of this capture together with the root suite.
2. When classification (`PLUG-I001`) and the manifest/permission grammar
   (`PLUG-I002`/`PLUG-I003`) settle, freeze the backend's registration and
   consent record shapes against them.
3. Select the first modularization target for §5 (pending owner decision;
   criteria: small, clear data territory, low blast radius).
4. The other execution session can begin capability extraction only after the
   target and its command surface are defined — extraction without a surface is
   rework.

## Constraints to carry

- Blocked gates and the five postures in §2 are binding on any backend design:
  fail-open, bounded/async, server-assigned actor/cause, registered producers
  only, consent hashes separate from provenance.
- No migrations for mockup-grade work; no `fusion.db` coupling; isolated
  ports/profiles for tests; no commit/push without owner request.

## Previous handoffs

None — first handoff of this capture (2026-09-15).
