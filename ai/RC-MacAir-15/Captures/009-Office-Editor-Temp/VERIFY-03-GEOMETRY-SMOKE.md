# VERIFY-03 — Deferred Geometry Live-Evidence Completion

**Status:** `APPROVED`
**Recovery candidate:** `OE-009-RECOVERY-RC1`
**Type:** validation gate; not an implementation SPEC
**Blocks:** SPEC-06 and final roadmap completion

## Objective

Finish the live Electron observations that remained unexecuted after the external Computer Use drag surface failed. Preserve and reuse the already valid internal-drag/history/persistence evidence. Do not infer, design, or implement a product fix unless a repeatable product failure is observed.

## Reusable Passed Evidence

From the retained SPEC-03 live result:

- at 100%, an internal drag changed `[120,120,120]` to `[159,81,120]`;
- only the adjacent pair changed and total width remained 360;
- one accepted release persisted the change;
- Undo/Redo and back/reopen passed;
- the persisted layout rendered normally at 80%.

These observations need not be repeated unless the integrated recovery candidate changes geometry-owned files or cumulative tests reveal drift.

## Remaining Matrix

Run `node e2e/office/run-isolated-electron.mjs --scenario=geometry --copies=8` and record:

The boundary/zoom matrix is mandatory, not three independent spot checks. Every boundary type must be exercised at normal and non-100% zoom as required by the original SPEC-03 gate:

| Boundary | 100% | Non-100% |
|---|---|---|
| Internal | reuse the passed 100% internal observation | perform an accepted drag at 125% |
| Left outer | perform outward and inward drags | perform outward and inward drags at 125% |
| Right outer | perform outward and inward drags | perform outward and inward drags at 125% |

In addition, record:

1. approved alignment anchor and guide rectangles for both outer boundaries in both directions and zooms;
2. both ratified minimum clamps, with no column below the frozen square minimum;
3. 125% client-to-layout conversion and persisted integer delta for internal, left-outer, and right-outer boundaries;
4. Escape, blur, pointer-cancel, and zero-delta complete no-op branches;
5. rapid sequential drags with one commit per accepted release;
6. horizontal-scroll guide/handle alignment;
7. long/multiline cell behavior proving content height does not feed back into frozen width minimum;
8. smooth live guide motion while the table itself commits only on accepted release.

For every accepted drag, capture boundary type, zoom, client delta, scale, effective layout delta, minimum, pre/post column arrays, total, guide rectangle, dirty/write count, and persisted result.

## Evidence Method

Preferred evidence is a reliable live pointer surface against the isolated Electron app. If the same external control layer fails again before a gesture reaches the app, record it as infrastructure and stop that attempt without changing product code.

An automated replacement may be used only if the owner explicitly rules that it satisfies the original owner-hands intent. Such a driver must operate the real isolated Electron renderer, deliver actual pointer/mouse input through a supported automation surface, assert numeric overlays and persisted bytes, and leave production code unchanged. Existing Playwright DOM math alone does not close the live-guide observation.

## Failure Classification

- **Product failure:** a delivered gesture reaches the app and repeatably violates the SPEC-03 contract on clean isolated bytes. Record exact evidence, mark VERIFY-03 failed, and return to roadmap planning for a bounded amendment. Do not repair under this validation packet.
- **Infrastructure failure:** the control surface cannot see/control the isolated window or fails before delivery. Keep VERIFY-03 incomplete; no downstream implementation is invalidated solely by that failure.
- **Pass:** all remaining observations complete on one integrated revision with post-run persisted-byte assertions and cleanup.

## Checks and Cleanup

Before live work, run the targeted geometry Playwright file and build if the integrated revision has changed since the last accepted evidence. After live work, inspect the generated document frontmatter, verify no unrelated metadata collection changed, remove the exact realpath-validated isolated root, and confirm no Electron/server child remains.

If 04R/05R changed no geometry-owned files and cumulative `office-table-geometry.spec.ts` remains green, the prior passed observations plus this completed remainder form the final SPEC-03 smoke record.

## Completion Record

Append results to `/Users/rccurtrightjr./projects/Fusion-Home/oe009-run/SPEC-03/LIVE-SMOKE-RESULT.md` without erasing the prior infrastructure failure. The Roadmap Implementation Supervisor alone changes the ledger residual from incomplete to passed or failed.
