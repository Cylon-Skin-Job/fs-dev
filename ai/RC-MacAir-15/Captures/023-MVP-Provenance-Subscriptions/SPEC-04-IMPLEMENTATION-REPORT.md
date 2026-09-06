# SPEC-04 Implementation Report — File Viewer Live Render

## Completion

Implementation and the final integrated clean-room gate are complete. The formal terminal status appears once at the end of this report.

## Execution identity and authority

- Approved candidate: `MVP-PROV-SUB-3b8cb4f1e41df682`.
- Approved 32-path authority aggregate: `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310`.
- Authority was independently recomputed before implementation and at the final gate. `RELEASE-MANIFEST.md` remains SHA-256 `ab14143583d52ac4330962e96b1f54d5c7a197c72a0563fa16f0640ea6ccadff`.
- Git revision at dispatch and completion: `806b33521907ed4b51cf792d5ef664fe319ea349`; accepted predecessor work and SPEC-04 remain uncommitted in the shared worktree.
- Worktree: `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`.
- `IMPLEMENTATION-LEDGER.md` remained supervisor-owned and was not edited by this orchestrator or its builders. Its completion SHA-256 is `2f84c6888b0657e104541f863b99993644352dc15db3e8107c3fcdc255e3255c`.

## Accepted prerequisites

- SPEC-01: owner accepted, 27-path aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`.
- SPEC-02: owner accepted, 22-path aggregate `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`.
- SPEC-03: owner accepted, 92-path aggregate `bb0fe8420ef0a07f7559432e84715162b4f5737bcbacbb450973e1dfaa28e374`.
- Every accepted implementation report was read before dispatch. Final review authenticated predecessor drift and found zero unexplained paths. SPEC-04 deliberately extends the accepted registry, startup, workspace-session, save, renderer-state, and test surfaces.
- SPEC-03 deviation D-08 is closed as required: the single controller-owned successful-save `file_changed` compatibility broadcast was removed during the atomic SPEC-04 projection cutover. Legacy `file_changed` remains only for explicitly non-migrated move/rename/delete and watcher routes.

## Outcome

SPEC-04 now provides the governed File Viewer render path from mediated save through durable provenance, typed resource fact, exact projection, central invalidation/refetch, and visible UI update. `system.resource-render-projection` is installed with exact subscription/grant authority and workspace-scoped recipient resolution. Canonical `resource:changed` and bounded `resource:refresh_required` messages carry server-issued workspace epochs and are validated through the central renderer path.

The locked `file_tree@1` and `file_content@1` query definitions use checksummed JSON Schema 2020-12 seeds, shared validators/types, request IDs, and server-captured workspace pairs. Stale pairs are rejected before filesystem I/O. Replies completing during binding use the existing one bounded pair-tagged queue; overflow closes for reconnect rather than losing freshness.

`fileDataStore` is the sole File Viewer owner for trees, content, metadata, errors, pending reads, correlation, representations, interests, projection dedupe, invalidation, and reconnect hydration. `fileStore` owns presentation only. The component listener, duplicate tab content/loading fields, and `useFileTree.ts` were removed. Tab order, active document, breadcrumb, collapse state, hidden-folder representation, dirty protection, symlink behavior, rename/move/delete compatibility, and unrelated cached resources are preserved.

The required isolated live launcher builds a nonce-owned temporary profile/workspace/database on unique non-3001 ports, guards every path with markers and refusal checks, and leaves developer DB/profile/workspace plus repository Playwright output unchanged. Its test-only mode observes and blocks prohibited startup factories, filesystem watchers, child processes, and UI-triggered harness revalidation. The proof uses the ordinary built File Viewer UI and one second transport-only local-client socket, observes typed projection before render, joins all provenance IDs and connection identity, exercises recovery and prewrite rejection, validates stale/reconnect/bind behavior, and proves File Viewer/Office aliases share one physical resource identity while only File Viewer invalidates.

## Slice order and gate lifecycle

| Slice | Builder | Builder-owned lifecycle | Orchestrator acceptance | Accepted identity |
|---|---|---|---|---|
| 04a — typed projection subscriber and atomic cutover | `/root/spec_04_live_render/slice_04a` | Passes 01–02 found and repaired material issues; pass 03 `CLEAN` | `/root/spec_04_live_render/slice_04a_acceptance_01` `CLEAN` | 21 paths, `9aa0963e02bc9533119bd24ce99668bb687cdf159cc258371ba53ec61eefe62f` |
| 04b — central store event semantics | `/root/spec_04_live_render/slice_04b` | Pass 01 repaired live emitter/version routing; passes 02–03 were clean before later acceptance repairs; passes 04–05 repaired failed-send/representation edges; pass 05 `CLEAN` on accepted bytes | Acceptance 01 repaired unopened-file refetch; acceptance 02 repaired hidden representation; `/root/spec_04_live_render/slice_04b_acceptance_03` `CLEAN` | 37 paths, `f6fec6fef9978a6ddef82afe52a2300ec92f5caf3826201a7438741580e508d9` |
| 04c — File Viewer store cutover | `/root/spec_04_live_render/slice_04c` | Passes 01–06 repaired stale symlink hints, failed/unavailable hidden toggles, collapsed/unseen representations, reconnect activation, and cross-workspace effect ordering; pass 07 `CLEAN` | `/root/spec_04_live_render/slice_04c_acceptance_01` `CLEAN` | 18 manifest lines including deletion, `98e9304cdaa73f8cc66ee1ce1f1c28013072b0c42d994501b8b334604534270f` |
| 04d — isolated live acceptance | `/root/spec_04_live_render/slice_04d` | Pass 01 interrupted after builder self-review changed bytes; pass 02 found output/stale-proof defects; pass 03 clean before acceptance repair; pass 04 exposed late harness CLI startup; pass 05 `CLEAN` | Acceptance 01 repaired self-authored absence claims; `/root/spec_04_live_render/slice_04d_acceptance_02` `CLEAN` | 8 paths, `6cab570a33eea2ff68a29a0569fa95fd3f961356da0eb33c7709f78a971dc625` |

Slices executed serially with one product writer at a time. Every new slice used a fresh `spec-slice-builder`; every review used a fresh read-only `clean-room-reviewer` governed by `spec-review-gate`. Findings were routed back to the owning builder, and current bytes were reviewed again until the first clean pass. All direct children are terminal. `close_agent` was unavailable; completed/interrupted states were confirmed before sibling spawns and retained as lifecycle evidence.

Final integrated reviewer `/root/spec_04_live_render/spec_04_final_gate_01` returned `CLEAN` after authenticating authority, all slice identities, the 66-path union and deletion, prerequisite drift, required commands, cutover boundaries, and live isolation claims.

## Integrated verification

| Command/check | Final current-byte result |
|---|---|
| `cd fusion-studio-server && npm test` | Orchestrator rerun: 117/117 suites passed; 1,069 passed, 1 skipped |
| Focused final server gate | Independent final review: 7 suites, 85/85 passed |
| `cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts` | Independent final review: 54/54 passed |
| `cd fusion-studio-client && npm run build` | Orchestrator rerun passed; 1,818 modules transformed |
| `cd fusion-studio-client && node e2e/provenance/run-file-viewer-live.mjs` | Orchestrator rerun passed normal and injected post-write-failure scenarios on ports 51347 and 51364; final `FILE_VIEWER_LIVE_PROVENANCE_OK` |
| Isolated runtime guard tests | 11/11 passed, including every audited startup factory, filesystem watcher, child process, pre-captured spawn, and production-default behavior |
| Traced isolated live run | Passed with zero isolated-run matches for external harness CLI/version/spawn execution |
| Manifest authentication | 66/66 current paths matched aggregate `15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590`; `useFileTree.ts` deletion confirmed |
| Safety/format | Developer DB/profile/workspace and repository `test-results` hashes unchanged; marker-owned cleanup; `git diff --check` passed |

The live proof covers canonical save-to-render and targeted recovery; matching command, operation, resource-event, resource, version, causation, connection, workspace, and epoch IDs; projection-before-render ordering; no legacy save broadcast/watcher/poll/remount/reload path; duplicate/stale rejection; unrelated cache preservation; genuine held schema-valid A1 tree/content replies after A→B and A→B→A; reconnect; bind queueing and overflow; failed prewrite; Office alias identity; and transport-only origin assurance.

## Exact current SPEC-04 work-product manifest

The aggregate covers the lexicographically sorted union of current product and test paths owned by all four slices. Serialize each line as `<path>`, one ASCII tab, lowercase SHA-256, one LF, with no header/footer. SHA-256 of those 66 lines: `15c18e67df1d9a69ef96fea6819ade662de23b1f41234c824eb2e92351237590`.

The report itself and unrelated owner/planning/runtime/style changes are outside this product manifest.

```text
fusion-studio-client/e2e/file-viewer-central-cutover-source.spec.ts	1aa84969e8a5b09af0c2618042fc5f1f9a3a91ea763d8007766f2478c12e460f
fusion-studio-client/e2e/file-viewer-empty-tab.spec.ts	a1000f9e5f9d654d0b7b1577257bb20e3eb5dac2068e5c6ea92a0789e076e943
fusion-studio-client/e2e/file-viewer-read-projection-source.spec.ts	e3363a2ad82ff4db462c629f2773bb088029ed57fa4cabe06f2129ea210cdf47
fusion-studio-client/e2e/provenance/file-viewer-live-resource.spec.ts	3c5adcb4b71f0bd38567852750a67f3b8bda34946a252424b62c799f52d13325
fusion-studio-client/e2e/provenance/run-file-viewer-live.mjs	062cdb5cb29d6a0a1d7b6572a4badb77c7fa0c1ce0b1566117244fce8c2cfdf9
fusion-studio-client/playwright.provenance.config.ts	21240b955fb7045ccb6a5c5dfda756ca1bd037ab842fe91a5b103a2b9c4253d1
fusion-studio-client/playwright.source.config.ts	aeb476c2b50b7a49cf84229e52173e6be7c433056595e231d4aef2466a95d5c9
fusion-studio-client/src/components/file-explorer/FileExplorer.tsx	9b61e23fcbccec378b56c6144ef715f4b5461229ce88a3e59a8f990c49d694f5
fusion-studio-client/src/components/file-explorer/FileNode.tsx	2c19497c92d0119f0eb55caae78515f2a7b9777c9afbe5518c4dee8bb5c3c446
fusion-studio-client/src/components/file-explorer/FileViewer.tsx	d9790b5acc8299937ebea21e65a81123f82797be992ebd85036c7af3daefcaea
fusion-studio-client/src/components/file-explorer/FolderNode.tsx	5003c42a39c3fce9877258c2f7f5ec68a2f32eb8f058c84d336fc42ce4ca8fd1
fusion-studio-client/src/components/file-explorer/fileViewerMetadata.ts	63e7fcb95a03ae7e0fa6008be56a65d432115d4ba52d29a28bdcf0617f5757a5
fusion-studio-client/src/components/sidebar/useSidebar.ts	0556d321544be2f772d091b87b1c4e6e016bc3c8b6d324e59a5de2bcba724297
fusion-studio-client/src/components/view-tabs/viewTabAdapters.ts	ef9ff3face66251d3f863224057a64eb0fc7fc12e7cfeaca89ac9178840e9b00
fusion-studio-client/src/lib/file-tree.ts	e6a498c56f47369fd7a3dc76237fe41af616a551fb2b2040d6cd8d21e48716ce
fusion-studio-client/src/lib/ws/file-handlers.ts	4c95be092d3753026f603212c35c410724e7a8fcde2bc5b8dd2c28a83d54bdda
fusion-studio-client/src/lib/ws/file-viewer-read-protocol.ts	8ecc5efcd7effd270210151741de868906a86edd4ac000a87edc0fa754903f22
fusion-studio-client/src/lib/ws/resource-projection-protocol.ts	bb677227218ed8ae1b55cb3dc5361c998e7036f9f19f983727348b94185606a2
fusion-studio-client/src/lib/ws/workspace-handlers.ts	f105bb85911a5d730feaa181ec9b57fb621fac0723cff52c5fd497ab3677d8bc
fusion-studio-client/src/state/file-data-read-model.ts	ff35e64b61b6903566636497ee94c3cf1d91958e516ea68bbe402cc98192fa9b
fusion-studio-client/src/state/fileDataStore.ts	3eba3697a785067fc67a8b4ba35e837e8980542222fc588436f20d49c0f8314e
fusion-studio-client/src/state/fileStore.ts	6a1a5264f976a154de66f01ee0fca71745da36fac5df74d58c380a5798230d0b
fusion-studio-client/src/state/workspaceStore.ts	af5a08387d124cbed0dbb15c50e74e23fc0a3ebf65a265fa5b817faf3a8aa864
fusion-studio-client/src/types/file-explorer.ts	1efec4959fef5338dbc4da04a762af303d2945716672e837c87c7d59f9aad5ca
fusion-studio-client/src/types/index.ts	2114d818b895d641ff176af36b975eafd17433270c236e498ebf79bd9864ce51
fusion-studio-server/lib/event-registry/reconcile.js	089558d64678204668b67f01b19de2ccf32141b39ae442c3cc829d0e24bd1f01
fusion-studio-server/lib/event-registry/schema-validator.js	86bae763730e37c6390451254a0dda31545aa665b33211847bcc841d22079ed2
fusion-studio-server/lib/event-registry/schemas/file-content-v1.json	94ba44c10f5e198209a3ebe3bb9c7ea22e63cee57c967e46b5b14dad00e083a2
fusion-studio-server/lib/event-registry/schemas/file-tree-v1.json	00dd9cae63c4bddc63d2329fa677d7ca5575a0e4ccd662ac424642d29f9d1757
fusion-studio-server/lib/event-registry/seed-catalog.js	eefefe8d7693f4a90bdb2ac03d8b36ca8d963b14f620e71e74ed3b13d45c71a6
fusion-studio-server/lib/event-registry/subscription-seed-catalog.js	ce98d4ffd09c77bda4dcaaa6eec5655a73b9701b3d968c47456c2689635b1ff8
fusion-studio-server/lib/file-mutations/fact-replay.js	dc6e0126c6f1dd087580e868f0ded58fcf349c9d194d21e96ba1ff475ab8a6d3
fusion-studio-server/lib/file-mutations/reconciliation.js	b8b1c1aa2896117dc85de000262b66fb448e65e2b99e6f4053514de2e0dd059f
fusion-studio-server/lib/file-mutations/save-controller.js	ef2621d4cd0c86e8ff7720c6c1f013df4c0a722ca12df72f49efbf3d0f7edf5b
fusion-studio-server/lib/file-mutations/save-owner.js	f39cb7ccebe325e51315bffd3aeeb0128fe29396f4dbf43fa8172c768334af7c
fusion-studio-server/lib/file-reads/file-viewer-read-service.js	85d2bc066976233019c68e330688e0b97470f1e619cc2cd0db272db45dc81cdf
fusion-studio-server/lib/http/harness-routes.js	0200dc9b0422192fdf4d74a41598a4d9168bdbcba082b95f8bb5735a80318850
fusion-studio-server/lib/startup.js	ad6784c8ca2ee153f6bf7dc344efb1b12de39232a74fea1d54d7ad87b51a3ce8
fusion-studio-server/lib/subscriptions/handlers/resource-render-projection.js	79b15ecf77fd2ba4256984ffba915f8b93e4068a828306f6db59dfa51f39e4f9
fusion-studio-server/lib/testing/isolated-provenance-runtime.js	c9f4c001182db6376359d2221784c2328215e1f49ca8ca0d58c0cd0b40865904
fusion-studio-server/lib/ws/client-message-router.js	6623967d9c2301e8918ffcdaf4229dd4b44a55fbfc393cc6af0a51898669a2de
fusion-studio-server/lib/ws/connection-init.js	88f5434f8762e4ed1d3a052480da98e54e500d1e0866e64ca03a837b6749e9f1
fusion-studio-server/lib/ws/file-viewer-read-route.js	c2de7b8df0e48ff9c56ebaf1c834165a0a5c4236168516ff7fa35bdb99d81629
fusion-studio-server/lib/ws/resource-projection-publisher.js	861b957ba52004257362fb97434d5c91187631041b818bd09a5e27a557c9e2e4
fusion-studio-server/lib/ws/workspace-broadcaster.js	200b207221106ea685972adeff8e2d274972d0bb3c42cd18243049a139964547
fusion-studio-server/lib/ws/workspace-session.js	465a45755f604b84426dcc787b27e542a42f0d060402c4cff477230ffc91eada
fusion-studio-server/server.js	9b783bec61a573e4bedc399939f8c026a4ed7dda19f901955cdf919d1bed0259
fusion-studio-server/test/event-registry/file-viewer-read-schema.test.js	f91e48866c179c4a208bfdb411b79d64fc76e020fc7bbc16308748ee8fe74b47
fusion-studio-server/test/event-registry/schema-validation.test.js	ae9d223bbaa065feac48f892869bf646f5e4739e6b81eb2423ef2a9d397c9e10
fusion-studio-server/test/event-registry/seed-reconciliation.test.js	e8caab052033259c9d24e4f829d9f5260c71020334780a0b6aa7bc275531c324
fusion-studio-server/test/event-registry/startup-integration.test.js	d07ffd51b121b2cb002c49cfb786ec0de2b1d59810e0bcb9f68d29403aeeddbf
fusion-studio-server/test/file-reads/file-viewer-read-service.test.js	095cafea7b91cfe34c52067e3e22f04886cd4124f5c11c00f4e1f6b7a665b0f1
fusion-studio-server/test/resources/file-provenance-integration.test.js	b33cd664caadda72d4f9f782b2fdec52aed876185ddabb0e62f92959cb08b5cf
fusion-studio-server/test/resources/reconciliation.test.js	211f3ceb4d41859bc16b56d6143198d04f92a04483edc9f0bf940b2b243bf638
fusion-studio-server/test/resources/save-controller.test.js	d34e0e535584dee6f56d6a71441677b46cac58088917ed7a24846784e9ad64b6
fusion-studio-server/test/runtime/isolated-provenance-runtime.test.js	e58cad9d0c9f86e3a58900eba2693c4a88dc5b8fef5a87af04775fe01ae18871
fusion-studio-server/test/subscriptions/compatibility.test.js	bd6ab58cf26a0de4bef5902fcc306c0a6ea9630058d8675e4778875d46d07fa8
fusion-studio-server/test/subscriptions/resource-render-projection-handler.test.js	d7835873a07b1b9a4b91d28a5afba9d630af30cfc742e857b96a89eeea69c47c
fusion-studio-server/test/subscriptions/resource-render-projection-runtime.test.js	68ca953e46bbab9e48a7ce3f34088d69407e031290fb6e0af016634a5f092317
fusion-studio-server/test/ws/client-message-router.test.js	eca86fc63c66b93637f9a3f86553d9c9d211905a366da2dd3d9ad244b45f9eab
fusion-studio-server/test/ws/file-save-route.test.js	1e2cbe4c3524ff1a88bc807ac288a409906a95949852abbd911546038985c3af
fusion-studio-server/test/ws/file-viewer-read-route.test.js	f86e8d5ab75c5fdda415f7f6984aebb5e0daa5f77178d3de0ff9b542058232a0
fusion-studio-server/test/ws/resource-projection-publisher.test.js	b80a6b53ff75d57ff62a50b050770bd846fb3b3d3b22426efb6fdc04fb48e036
fusion-studio-server/test/ws/resource-provenance-advertisement.test.js	7e5752cd7a667292c347373e6eba456e233df0fbe40b12783972e6b83da59d43
fusion-studio-server/test/ws/workspace-broadcaster.test.js	713197a320c03f2a6b7d666908705b535d80e3afa4df832b7cbd69241cfd375f
fusion-studio-server/test/ws/workspace-session.test.js	d04b395d2c7c5a509f31115554d09d71297ed439b247ff8c4462c189dda29f5f
```

Removed by the File Viewer ownership cutover:

```text
fusion-studio-client/src/hooks/useFileTree.ts
```

## Deviation and out-of-scope accounting

### D-01 — Projection subscriber and atomic compatibility cutover

- Actual change: installed the exact projection handler/subscription/grants, server-recipient publisher, recovery path, diagnostics, runtime composition, and generation-aware client protocol while removing the controller-owned successful-save broadcast.
- Reason: recipient resolution and unsolicited epoch injection belong to the projection subscriber/session boundary, not the mutation controller.
- Observable effect: admitted saves produce one typed projection; post-write admission/projection failure produces bounded targeted recovery; non-migrated legacy routes retain compatibility.
- Risk/downstream: external writers and watcher semantics remain outside this SPEC. No publisher/minter/grant authority was widened.
- Classification: `accepted — required atomic integration`.

### D-02 — Locked File Viewer query definitions through seed reconciliation

- Actual change: added locked `file_tree@1` and `file_content@1` schemas, checksummed seeds, validators, service/route, advertisement, redaction, and drift tests using authoritative startup reconciliation rather than a new migration.
- Reason: the existing registry authority already reconciles locked definitions at startup; an additional migration would duplicate ownership.
- Observable effect: exact request/response unions, pair capture before I/O, stale no-I/O rejection, closed version behavior, and deterministic drift detection.
- Risk/downstream: schema changes now require an intentional version/seed change. This is the final review's only registry-shape deviation and was accepted as contract-equivalent.
- Classification: `accepted — bounded registry integration`.

### D-03 — Existing one-queue binding and recovery integration

- Actual change: File Viewer replies and projections share the existing bounded pair-tagged workspace bind queue; pairless pending replies are tagged when queued, and overflow closes/reconnects. A queued old-pair reply superseded by a later bind also closes/reconnects rather than emitting stale data.
- Reason: a second queue would violate ordering and create split freshness authority.
- Observable effect: bind/init precedes matching data, stale pairs never leak, and freshness failure is visible and recoverable.
- Risk/downstream: reconnect may replace an ambiguous queued reply; retained central interests rehydrate authoritatively.
- Classification: `accepted — required transport integration`.

### D-04 — Central File Viewer ownership and presentation adapters

- Actual change: moved canonical state to `fileDataStore`; reduced `fileStore` to presentation; added the narrow activity/error bridge, metadata resolver, composite tab subscription, sidebar link loading, eviction naming adjustment, and source-test configuration; deleted `useFileTree`.
- Reason: tab/activity/navigation consumers still need presentation integration without copying resource truth.
- Observable effect: one canonical cache/listener path, exact last-consumer release, reactive close-disabled state, current symlink authority, dirty safety, and preserved tab/navigation UI.
- Risk/downstream: `fileDataStore.ts` exceeds the preferred size guideline but remains one cohesive cache/request-lifecycle owner. Rename/move/delete stay on compatibility handlers until their SPEC.
- Classification: `accepted — mechanically necessary client integration`.

### D-05 — Exact hidden representation and workspace hydration repairs

- Actual change: central per-tree/default hidden representations now cover cached, collapsed, unseen, projected, failed-send, unavailable, reconnect, and same-workspace cases. Activity hydration synchronously registers only authoritative current-workspace tab interests.
- Reason: asynchronous UI effects and previously unseen keys could otherwise retain or resurrect the wrong representation/path.
- Observable effect: both hidden toggle directions are exact, same-workspace reconnect preserves presentation, and A→B cannot create B interests for removed A tabs.
- Risk/downstream: none beyond retaining per-key representation metadata until the corresponding interest is released.
- Classification: `accepted — correctness repair within 04c`.

### D-06 — Isolated test/runtime boundary integration

- Actual change: added test-only isolation hooks in `server.js`, `startup.js`, and `harness-routes.js`, plus the runtime guard module. The mode is inert unless the exact isolated test contract is satisfied.
- Reason: the required browser proof exercises ordinary startup and `/api/harnesses`; suppression must be observational and installed before modules can capture native process methods.
- Observable effect: all eight startup effects and UI harness revalidation are requested-but-blocked; filesystem watcher/child-process attempts fail immediately; final audit spans browser activity and requires zero actual invocations.
- Risk/downstream: production-default factories and harness revalidation are explicitly tested unchanged. No production authority or external adapter was added.
- Classification: `accepted — required test/runtime integration`.

### D-07 — Dedicated browser transport controls and safety canaries

- Actual change: added the dedicated Playwright config/launcher/spec, marker-owned output, repository-output protection, and a browser-transport hold for genuine pending schema-valid A1 replies.
- Reason: the runtime proof must delay replies without modifying product code and must prove cleanup cannot delete repository/developer artifacts.
- Observable effect: stale replies are tested after both navigation sequences without socket failure; all artifacts remain under the owned root; protected developer/repository hashes remain unchanged.
- Risk/downstream: the fixture's second socket is explicitly `local_client` with `transport_only` assurance and exact connection ID, not authenticated user UI.
- Classification: `accepted — required acceptance infrastructure`.

## Residual risks, skipped checks, and compatibility disposition

- Full client lint was not used as a release gate because the repository has an accepted unrelated backlog of 37 errors and 3 warnings outside the touched 04c paths. Exact changed-path lint, TypeScript production build, source tests, and live proof passed.
- Existing server local-storage/`DEP0190` warnings and Vite `gray-matter` eval/chunk-size warnings remain outside isolated execution behavior. The isolated traced proof showed no prohibited external CLI launch.
- One unrelated server test remains skipped.
- `src/hooks/usePanelData.ts` contains a documentation-only stale comment mentioning deleted `useFileTree`; there is no active symbol/reference.
- Arbitrary external-file refresh, authenticated plugin/custom-view bridges, Office/Email dirty-editor adoption, rename/move/delete render migration, restore UI, later SPECs, publishing, and Alpha deployment remain out of scope.
- No production Electron/Alpha restart, rebuild, install, or profile mutation was performed.

SPEC_READY_FOR_SUPERVISOR_REVIEW
