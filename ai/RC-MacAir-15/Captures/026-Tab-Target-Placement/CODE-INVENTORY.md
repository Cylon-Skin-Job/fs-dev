# TABS-03 Code And Verification Inventory

**Inspected:** 2026-09-04  
**Repository:** `/Users/rccurtrightjr./projects/fs-dev`

## Active implementation surfaces

| Path | Current role | TABS-03 relevance |
|---|---|---|
| `fusion-studio-client/src/components/view-tabs/componentTabTypes.ts` | Serializable component/tab identities, collection state, limits, failures | Extend or consume bounded placement types without weakening v1 contracts. |
| `fusion-studio-client/src/components/view-tabs/componentTabValidation.ts` | Strict descriptor and tab-record validation | Reuse strict-object, bounded-ID, JSON, and unsafe-key policy. |
| `fusion-studio-client/src/components/view-tabs/componentTabLifecycle.ts` | Empty creation, async reservation/fill/fail/retry/cancel, close | Direct placement must remain distinct and reservation-safe. |
| `fusion-studio-client/src/components/view-tabs/componentTabDomain.ts` | Public domain exports | Export the accepted placement domain/controller surface. |
| `fusion-studio-client/src/components/view-tabs/componentTabPresentationDomain.ts` | v2 role-free shell projection and location types | Place committed targets with correlated `presenterId` and location. |
| `fusion-studio-client/src/components/view-tabs/componentTabPresentationValidation.ts` | Strict shell/location validation | Validate resolver-owned presentation output before mutation. |
| `fusion-studio-client/src/components/view-tabs/componentTabResolver.ts` | First-party component rendering resolver | Pattern for code-owned resolution; placement resolution must remain separate from rendering. |
| `fusion-studio-client/src/components/view-tabs/viewTabContentAdapter.ts` | Connected active content/shell/navigation adapter | Likely integration seam; must not become an ambient store or accept unvalidated state. |
| `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx` | Public rendered tab path | Required end-to-end proof route. |
| `fusion-studio-client/src/components/view-tabs/ViewTabStrip.tsx` | Tab activation/close/add presentation | Must remain a prop-driven presentation consumer. |
| `fusion-studio-client/src/components/view-tabs/viewTabAdapters.ts` | Current production Capture/File adapters | Regression surface only; no TABS-03 adoption. |

## Existing tests and harness

| Path | Evidence provided |
|---|---|
| `fusion-studio-client/e2e/component-tab-domain.spec.ts` | Pure lifecycle validation, reservations, stale completion, collisions, limits. |
| `fusion-studio-client/e2e/component-tab-presentation-domain.spec.ts` | Corrected v2 projection validation and universal layout derivation. |
| `fusion-studio-client/e2e/component-tab-host.spec.ts` | Vite virtual adapter through the public `ViewTabBar` route, resolver containment, lifecycle, identity, focus, shell, and navigation behavior. |
| `fusion-studio-client/e2e/component-tab-panel.spec.ts` | Component/Empty panel presentation. |
| `fusion-studio-client/e2e/component-tab-shell-panel.spec.ts` | Shell header/location behavior and error containment. |
| `fusion-studio-client/e2e/view-tab-contract.spec.ts` | Existing generic tab adapter contract. |
| `fusion-studio-client/e2e/view-tab-runtime.spec.ts` | Production rail/runtime regression surface. |
| `fusion-studio-client/e2e/file-viewer-tabs.spec.ts` | Existing File Viewer tab behavior to preserve. |

`fusion-studio-client/e2e/view-tab-runtime.spec.ts` is not currently hermetic.
The TABS-02A report records that its Capture case fails before the changed route
because `Capture-A.md` is absent and the serial File case then skips. TABS-03
must record any diagnostic attempt but uses the deterministic public-host,
Capture, clipboard, and File tests from the accepted 79-test matrix as its
zero-exit production regression gate unless a hermetic fixture is available at
preflight.

The TABS-02A report records 79 passing focused tests across its five component
tab suites, plus typecheck, lint, build, and diff checks. Its final 22-path
client-relative aggregate is:

```text
f91b7cb7eb6263040c39c1931fbeef401c68c98e4157476c32eb6636f2210a35
```

RC accepted that exact implementation baseline on 2026-09-04. It remains
uncommitted, so the SPEC's exact preflight command—not repository HEAD alone—
identifies the dependency bytes.

## Feasibility findings

- The active lifecycle supports async Empty reservation/fill but has no target
  placement controller.
- `ComponentDescriptor.targetKey` is optional for generic hosting; TABS-03 may
  require it only for placeable addressed targets without changing generic
  unaddressed component support.
- The shell projection already carries `tabId`, `presenterId`, and validated
  breadcrumb location, so placement can correlate content and presentation.
- `ViewTabDescriptor` is a compile-time interface without runtime normalization;
  TABS-03 must add strict display-field validation rather than assuming it.
- No global tab store or durable worksurface owner exists. TABS-03 must expose a
  pure transition plus one connected application seam, not invent persistence.
- Existing virtual-adapter tests can exercise the public rendered path without
  converting Capture, File Explorer, Wiki, or Chat.

## Expected changed areas

Expected new or modified files are limited to:

- placement types/validation/domain/controller under
  `fusion-studio-client/src/components/view-tabs/`;
- the narrow connected adapter/public export needed to invoke the controller;
- focused tests under `fusion-studio-client/e2e/component-tab-*.spec.ts`.

Any required modification outside those areas is a deviation that must be
reported and justified before acceptance. Server, Electron, SQLite, WebSocket,
UEB, provenance, Chat, and production view adapters are prohibited scope.
