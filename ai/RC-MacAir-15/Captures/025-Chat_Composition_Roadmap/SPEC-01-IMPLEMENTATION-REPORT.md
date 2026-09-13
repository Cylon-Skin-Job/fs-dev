# SPEC-01 Implementation Report — Thread Group Foundation

**Status:** `READY_FOR_INDEPENDENT_OWNER-SIDE_REVIEW` — orchestrator final integration CLEAN; **not owner-accepted**  
**Approved candidate:** `CHAT-COMPOSITION-2d34f8b45562f8f3` (owner-approved 2026-09-13)  
**SPEC:** `SPEC-01-THREAD-GROUP-FOUNDATION.md`  
**Implementation baseline (dispatch):** `1ded59ce2e0947d6209d0c23e82fe273591e28b2`  
**Baseline branch:** `agent/exact-workspace-paths`  
**Migration head at dispatch:** `040_reported_ui_context.js` → SPEC-01 uses `041`/`042`  
**Orchestrator:** primary session acting as spec orchestrator (owner-appointed, direct run)  
**Execution ledger:** `CHAT-01-EXECUTION-LEDGER.md` (slice gates, deviations, lifecycle)

## Accepted prerequisites and authority

- SPEC-00 Trusted Fusion Shell Authority: implemented `1baaffa`, owner-accepted `7f0d3c8`; exported `trusted-shell` guard consumed as-is.
- Agent Tool Provenance (PROV-01): source `acf12dafe7499b04995617e5d9c1512775e5ba12`, acceptance `3110bd0`; accepted regression commands rerun below.
- BRIDGE-01: owner-accepted `16ccecf`; `ChatActionContext` schemas/migration 040 are protected non-owned baseline.
- BRIDGE-02: owner-approved living candidate `BRIDGE-1e722a9c6d30f6b5`; consumed through `BRIDGE-02-CONFORMANCE-OVERLAY.md` (contract-only).
- Tab Platform milestone: owner-released `333d49e`.
- Overlaid `025` candidate owner-approved 2026-09-13 (`CHAT-I-035` satisfied); CHAT-01 dispatch authorized by `RELEASE-MANIFEST.md` §7.

## Slice ledger

| Slice | Scope | Accepted revision | Orchestrator state |
|---|---|---|---|
| 01A | Safe one-member Thread activation, Fork removal, stable view-ID preflight, atomic creation | manifest SHA-256 `2d95589df207eecb41abf6469844e9f2f8ec2c2c820706025a66130904119164` | accepted (2026-09-13) |
| 01B | Group Rename/Delete, `thread:action`, migration 042 tombstones, lease/fences, fan-out | manifest SHA-256 `3891410d794d0bd989dbba92079f3e783ce6112e0ee8772f73766e04a39a0b74` | accepted (2026-09-13) |
| 01C | Prompt-accepted activity/MRU, `thread:touch` removal, copy/resolve link, View Markdown, `set_harness_selection`, search group join, integration report | SPEC-01 product digest `2a4ba090c7d82dc9411057a3495f23b7c10201db3bddf0beb0014b633bae2ce0` (61 paths, includes 01A/01B bytes) | **accepted** (2026-09-13); final integration CLEAN |

## Delivered outcome (whole SPEC)

Every visible row is a Thread Group with one current Main Chat session. 01A
introduced the durable group schema, stable view-ID preflight, atomic
ThreadManager group/session/mirror creation, group-backed list/open, and Fork
removal. 01B added the canonical `thread:action` Rename/Delete route with
durable idempotency, a group mutation lease, runtime fences, migration 042
cleanup tombstones, and workspace fan-out.

01C completes the SPEC:

- prompt acceptance writes the idempotent `prompt:{threadId}:{turnId}`
  activity and monotonically advances the group `updated_at` in one transaction
  before `message:sent`/provider dispatch; only creation and accepted prompts
  advance visible-list MRU; `thread:touch` is removed end to end;
- canonical `copy_link`, `resolve_link`, `view_markdown`, and
  `set_harness_selection` actions traverse `thread:action` with durable replay,
  authoritative acknowledgements, fan-out, and no `surfaceId`;
- `thread:search` joins membership/group ownership to return `threadGroupId`,
  visible group name, and authoritative group view binding without replacing
  exact exchange/session identity; and
- Legacy (`viewId: null`) groups support list/open/prompt/Stop/Rename/Delete/
  Copy Link/Resolve Link/View Markdown/search without borrowing the active
  panel's view.

Renderer pending/acknowledged model selection is deliberately SPEC-02
(`CHAT-I-026`); 01C implements only the server action, persistence, fan-out,
restart survival, and protocol/tests.

## Required verification results

All commands were run from the named package directory on the current worktree.

| Command | Result |
|---|---|
| `cd fusion-studio-server && npx jest --runInBand` | **203 suites passed; 2975 passed, 1 skipped, 2976 total** |
| `cd fusion-studio-client && npm run build` | passed (TypeScript + Vite production build) |
| `cd fusion-studio-client && npx playwright test e2e/thread-group-compatibility.spec.ts --config=playwright.thread-group.config.ts` | **7 passed** (isolated port 3315, temp profile `/tmp/chat01/01c/e2e-profile`) |
| `cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts` | **65 passed** |
| `cd fusion-studio-client && node e2e/provenance/run-agent-tool-live.mjs` | `AGENT_TOOL_LIVE_PROVENANCE_OK` (dynamic non-3001 ports 49591/49670; marker-owned cleanup) |
| `cd fusion-studio-client && node e2e/provenance/run-file-viewer-live.mjs` | `FILE_VIEWER_LIVE_PROVENANCE_OK` (dynamic non-3001 ports 49709/49787; marker-owned cleanup) |

Focused suites covering the 01C behavior (all included in the full run):

- `test/thread/thread-group-activity.test.js` — activity/MRU transacational
  idempotency, retry convergence, rename/list/open non-advance, Legacy ordering,
  identity bounds;
- `test/thread/chat-search-group-join.test.js` — group join context and
  ungrouped-null behavior;
- `test/ws/thread-group-protocol.integration.test.js` — every canonical action
  through `thread:action`, replay/mismatch, URI round-trip + Legacy resolution,
  mirror-path validation, model/variant acceptance/rejection/fan-out/restart,
  envelope conformance, removed raw routes;
- `test/thread/thread-runtime-controller.test.js` — prompt activity before
  `message:sent`, activity failure rejection through the normal path;
- `test/thread/thread-activation-lifecycle.test.js`,
  `test/ws/prompt-canonical-route.integration.test.js` — canonical route
  integration with the group activity owner;
- accepted Provenance suites remain in the full run
  (`test/agent-provenance/exchange-bind-and-query.test.js`,
  `test/runtime/agent-tool-fixture-route.test.js`,
  `test/runtime/isolated-provenance-runtime.test.js`,
  prompt/runtime suites) and pass unchanged.

Stale-symbol sweeps (recorded): no public `thread:touch` handler or client
sender; no raw `thread:copyLink` route or `thread:link` dependency; no
`thread:rename`/`thread:delete` aliases; no Fork capability outside the
accepted SPEC-00 bounded denial and migration 041 normalization.

## Deviation ledger

The accepted 01A/01B deviations remain authoritative in
`CHAT-01-EXECUTION-LEDGER.md` and are not reinterpreted here. 01C adds:

### 01C-D1 — Versioned application link URI

- **Clause:** SPEC-01 §8.2/§9 "versioned application URI"; `CHAT-I-029`.
- **Actual:** introduced `lib/thread-groups/application-link.js` with the exact
  form `fusion-thread-group:v1?workspaceId=…&threadGroupId=…[&viewId=…][&threadId=…]`.
  Unknown versions/keys (including `surfaceId`), duplicate keys, and malformed
  or oversized identities are rejected.
- **Reason:** the SPEC defines the URI but no prior scheme existed; SPEC-04
  extends member link production/resolution.
- **Tests/effect:** protocol round-trip, Legacy resolution, foreign/stale/`surfaceId`
  rejection.
- **Downstream:** SPEC-04 must keep version `1` and durable-identity-only shape.
- **Proposed classification:** `accepted`.

### 01C-D2 — `copy_link` always carries the validated sole/current member

- **Clause:** SPEC-01 §8.2 "with an optional validated sole/current member";
  SPEC-04 exclusively adds non-primary member link production.
- **Actual:** in this one-member SPEC the URI always includes the authoritative
  current primary (validated as the sole/current member). A supplied non-current
  member returns `not_found`.
- **Reason:** a stable, resolvable member identity for the only member; SPEC-04
  adds group-only and non-primary production.
- **Downstream:** SPEC-04 must not treat a member URI as placement authority.
- **Proposed classification:** `accepted`.

### 01C-D3 — `set_harness_selection` requires the server model catalog

- **Clause:** SPEC-01 §8.2/`CHAT-I-031` "validates both against current server
  policy".
- **Actual:** the action resolves `resolveCliPolicy(projectRoot)` and validates
  `model`/`variant` against `config[harnessId].models`. A missing catalog, an
  unknown model, or an unknown variant is rejected (`invalid_selection`); a
  policy-read failure is `selection_unavailable`. The prior value is untouched.
- **Reason:** the model catalog is the only server-owned authority; a
  client-supplied catalog is never accepted.
- **Tests/effect:** acceptance + rejection + restart survival + fan-out tests.
- **Downstream:** workspaces without `opencode-models.json` cannot author a
  selection, matching the client menu that only offers catalog entries.
- **Proposed classification:** `accepted`.

### 01C-D4 — Prompt activity is fail-closed on the group owner

- **Clause:** SPEC-01 §5.4/§7; packet note on minimal prompt reordering.
- **Actual:** `acceptPromptThroughRuntime` mints `turnId` before `message:sent`
  and calls `manager.threadGroups.recordPromptAccepted({threadId, turnId})`.
  Any missing service, non-`ok` result, or thrown error rejects the prompt
  through the existing `reportPromptAcceptanceFailure` path and releases the
  reserved runtime. The remainder of the route, ownership transfer, authority
  creation, and drain claim are unchanged.
- **Reason:** production managers always own the Thread Group service; failing
  closed guarantees no ungrouped accepted prompt.
- **Tests/effect:** focused controller tests plus real manager/service MRU tests;
  existing manager fixtures were extended with the group-owner method.
- **Downstream:** no ungrouped prompt can be accepted after activation.
- **Proposed classification:** `accepted`.

### 01C-D5 — `resolve_link` opens Main Chat through the existing open path; no client entry point

- **Clause:** SPEC-01 §8.2/§9 "opens Main Chat either way"; packet note that no
  URL-scheme handler exists.
- **Actual:** on the original (non-replay) committed invocation the handler
  calls the canonical `handleThreadOpen` for the resolved group. No client
  URL-scheme handler or Resolve Link UI is added.
- **Reason:** reuse the single canonical open path; adding a URL-scheme handler
  is out of this slice's scope.
- **Downstream:** a future URL-scheme owner invokes the same `resolve_link`
  action; SPEC-04 reopens/focuses the Side Chat placement without promotion.
- **Proposed classification:** `accepted` / `downstream_impact`.

### 01C-D6 — `thread:action` handler accepts the new durable actions

- **Clause:** SPEC-01 §8.2.
- **Actual:** `DURABLE_THREAD_ACTIONS` recognizes `copy_link`, `resolve_link`,
  `view_markdown`, and `set_harness_selection` alongside `rename`/`delete`; the
  canonical completed frame echoes `link`, `resolved`, `markdownPath`,
  `harnessId`, `model`, and `variant`. `compact` remains outside this SPEC
  (unchanged pre-existing behavior).
- **Tests/effect:** protocol handler tests and Privileged-thread tests updated.
- **Proposed classification:** `accepted`.

### 01C-D7 — Client ack side-effects are requester-only

- **Clause:** SPEC-01 §8.3 fan-out.
- **Actual:** the renderer performs the clipboard copy (`copy_link`) and File
  Viewer open (`view_markdown`) only on the non-`fanOut` acknowledgement; other
  windows receive the frame as state context only.
- **Reason:** fan-out is authoritative state delivery, not a per-window user
  intent.
- **Proposed classification:** `required_repair` (builder self-review).

### 01C-D8 — Strictly monotonic group clock

- **Clause:** SPEC-01 §5.4 "monotonically advance".
- **Actual:** `recordActivityAndAdvance` writes
  `max(occurredAt, current_updated_at + 1)` so two activities in one millisecond
  still order deterministically and never move the clock backwards.
- **Proposed classification:** `accepted`.

### 01C-D9 — Isolated Playwright port/profile

- **Clause:** `GUIDANCE.md` §6 isolation; packet hard rules.
- **Actual:** `playwright.thread-group.config.ts` moves to port `3315` and temp
  profile `/tmp/chat01/01c/e2e-profile`; never port 3001 or the dev DB.
- **Proposed classification:** `accepted` (test-only).

### 01C-D10 — Dead client module removed

- **Clause:** §8.2/§11 remove superseded routes without aliases.
- **Actual:** deleted `fusion-studio-client/src/lib/thread-link-intent.ts`, which
  existed only to disambiguate the removed `thread:copyLink`/`thread:link` flow.
- **Proposed classification:** `accepted`.

### 01C-D11 — Routing/wiki documentation updates

- **Clause:** packet "Update routed Chat wiki pages affected by 01C".
- **Actual:** updated Chat Identity And Persistence (activity/MRU owner),
  WebSocket Protocol and Thread Actions (link/model actions, `thread:touch`
  removal), Runtime Model (prompt-activity ordering/table), Structure (group
  modules), Testing And Operations (coverage); `smoke-spec03-spec15.js` expected
  export list updated mechanically.
- **Proposed classification:** `accepted` / `workflow_artifact`.

### 01C-D12 — Implementation report artifact

- **Actual:** this report under the approved capture folder.
- **Proposed classification:** `workflow_artifact`.

## Changed-path summary

See `/tmp/chat01/01c/manifest.txt` for the ordered `SHA-256  path` current-byte
manifest (61 paths plus 6 deletions) and the final fingerprint block below.
Exclusions preserved: `ai/RC-MacAir-15/System/Views/002-file-viewer/state/state.json`,
`ai/RC-MacAir-15/Captures/031-Remote_Access/`, and the execution ledger.

## Warnings, residual risks, and downstream impact

- The group clock is wall-clock-derived with a strict monotonic floor; equal
  clocks still order by `group_id ASC`.
- `resolve_link` has no client entry point in this SPEC (recorded above).
- A workspace without the model catalog rejects `set_harness_selection`
  (recorded above).
- SPEC-04 owns non-primary member link production, Side Chat reopen/focus,
  `thread:members`, and Move activity (`move:{requestId}`).
- SPEC-02 owns renderer pending/acknowledged model-selection state.
- No Fork capability was reintroduced; the accepted SPEC-00 bounded denial
  remains.
- Provenance facts remain under `threadId`; grouping never rewrites recorded
  tool activity authority.

## Documentation updated

- `ai/RC-MacAir-15/Wiki/007-Chat_System/001-Identity_And_Persistence/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/005-Testing_And_Operations/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/006-Runtime_Model/PAGE.md`
- `ai/RC-MacAir-15/Wiki/007-Chat_System/007-Structure/PAGE.md`

## Review and lifecycle record

- Builder self-review and repairs are recorded above (01C-D7, 01C-D8).
- Builder gate pass 1 reviewer `spec-gate-reviewer` / "builder-gate-01c-pass-1"
  (fresh read-only subagent, GLM 5.3 Flash high effort): terminal **CLEAN** on
  current bytes at HEAD `1ded59ce2e0947d6209d0c23e82fe273591e28b2`. It
  independently reproduced the full server suite (203 suites; 2975 passed, 1
  skipped), client build, isolated thread-group Playwright (7 passed), source
  Playwright (65 passed), and 160 focused tests. Advisories only: the report
  fingerprint placeholder (refreshed below), the no-realistic-path
  same-key concurrent activity insert, and the 01C-D7 classification wording.
  No material finding survived the four-part test; no repair was required.
- The live Provenance launchers were not rerun by the reviewer; the builder
  produced `AGENT_TOOL_LIVE_PROVENANCE_OK` and `FILE_VIEWER_LIVE_PROVENANCE_OK`
  on current bytes (logs under `/tmp/chat01/01c/`).
- Lifecycle: pass 1 is terminal; no second pass was spawned because the first
  pass was materially clean (no arbitrary pass ceiling needed).
- Post-review change: this report's fingerprint block was refreshed
  (documentation-only). No product/runtime/test byte changed after the review.
- HEAD remained `1ded59ce2e0947d6209d0c23e82fe273591e28b2`; no commit, amend, or
  push was performed.

## Orchestrator Final Integration Record

- Orchestrator independent reruns on the integrated bytes: full server suite
  `npx jest --runInBand` 203 suites / 2,975 passed / 1 skipped / 2,976 total;
  client `npm run build` passed; isolated thread-group Playwright 7 passed
  (port 3315/temp profile); accepted Provenance source suite 65 passed;
  `AGENT_TOOL_LIVE_PROVENANCE_OK` and `FILE_VIEWER_LIVE_PROVENANCE_OK`
  launchers passed on dynamic non-3001 ports with marker-owned cleanup.
- Fresh read-only whole-SPEC integration reviewer (GLM 5.3 Flash, high effort)
  returned **CLEAN** with no validated material finding, independently
  reproduced the full server suite, build, and isolated Playwright, verified
  every hash and the exact changed-path reconciliation, confirmed §12 coverage,
  overlay conformance, non-regression of SPEC-00/TABS-03/BRIDGE-01/Provenance/
  migrations 001–040, and docs conformance, and found no missed deviations.
  Advisories only: pre-008 `scope='view'` rows (already invisible, preserved),
  wall-clock monotonic group ordering, no client `resolve_link` entry point,
  catalog-gated `set_harness_selection`, and the workspace-wide mirror-cleanup
  sweep behavior.
- Orchestrator-ordered repairs across the chain: 01A R1 (material: invalid
  present `metadata.view-id` must stop, not be rewritten) plus R2–R5; 01C-D7
  (requester-only ack side effects) repaired in builder self-review. No finding
  was left unclassified.
- Owner acceptance has **not** been granted; SPEC-02 and every downstream group
  consumer remain blocked until the owner explicitly accepts.

## Final current-byte fingerprint block

The implementation report is excluded from its own fingerprint to avoid a
circular digest (same convention as `SPEC-00-IMPLEMENTATION-REPORT.md`).

```text
SPEC-01 product manifest (61 paths; excludes this report, the execution ledger,
and the two unrelated preserved paths): /tmp/chat01/01c/manifest-product.txt
PRODUCT_DIGEST = 2a4ba090c7d82dc9411057a3495f23b7c10201db3bddf0beb0014b633bae2ce0
UNION_PATH_LIST = /tmp/chat01/01c/spec-union-paths.txt
UNION_PATH_LIST_SHA256 = b178762b05adcefb00d25cf978827f22963776607ea6c95621fc7153f35ea313
spec-01/01a accepted revision: 2d95589df207eecb41abf6469844e9f2f8ec2c2c820706025a66130904119164
spec-01/01b accepted revision: 3891410d794d0bd989dbba92079f3e783ce6112e0ee8772f73766e04a39a0b74
spec-01/01c/final accepted revision: PRODUCT_DIGEST above
```

The post-finalization full changed-set manifest (product paths + this report)
is recorded in `CHAT-01-EXECUTION-LEDGER.md`; the product digest and union path
list above are stable across that finalization and were independently
reproduced by the whole-SPEC reviewer.

Deletions (6): `fusion-studio-client/src/components/chat/useComposerForkAction.ts`,
`fusion-studio-client/src/lib/thread-link-intent.ts`,
`fusion-studio-server/lib/thread/thread-fork-service.js`,
`fusion-studio-server/test/harness/opencode/compat-pending-fork-smoke.test.js`,
`fusion-studio-server/test/thread/thread-fork-service.test.js`,
`fusion-studio-server/test/ws/thread-fork-handler.test.js`.

## Final Statement

**READY FOR INDEPENDENT OWNER-SIDE REVIEW.** The orchestrator does not
self-accept. Owner acceptance of this exact current byte set (product digest
`2a4ba090c7d82dc9411057a3495f23b7c10201db3bddf0beb0014b633bae2ce0`, migration
head `042`) is required before SPEC-02 or any downstream consumer begins.
