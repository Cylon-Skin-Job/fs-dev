# SPEC-03 Implementation Report — Mediated File Provenance

## Completion

Implementation and the final integrated clean-room gate are complete. The formal terminal status appears once at the end of this report.

## Execution identity and authority

- Approved candidate: `MVP-PROV-SUB-3b8cb4f1e41df682`.
- Approved 32-path authority aggregate: `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310`.
- Approved authority was independently recomputed before implementation with all 32 paths matching. `RELEASE-MANIFEST.md` remains SHA-256 `ab14143583d52ac4330962e96b1f54d5c7a197c72a0563fa16f0640ea6ccadff`.
- Git revision at dispatch and at completion: `806b33521907ed4b51cf792d5ef664fe319ea349` (accepted SPEC-01/SPEC-02 and this SPEC remain uncommitted in the shared worktree).
- Worktree: `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`.
- `IMPLEMENTATION-LEDGER.md` remained supervisor-owned and was not edited by this orchestrator or its builders.

## Accepted prerequisites

- SPEC-01 was owner accepted with 27-path aggregate `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`.
- SPEC-02 was owner accepted on 2026-08-30 with the response `Okay, I will approve and let's go on to the next spec.` and 22-path aggregate `06d9e15aba776aa73ce13c62c2dd9d12d78537820668c31dc56d3aa9cdaaa49f`.
- Both accepted reports were read fully before dispatch. At final authentication, 18 of 27 SPEC-01 identities still match exactly; the remaining 9 are explicitly extended by SPEC-03 (`event-registry/index.js`, `reconcile.js`, `schema-validator.js`, `seed-catalog.js`, `startup.js`, and four event-registry tests). For SPEC-02, 18 of 22 identities still match exactly; `startup.js` and its integration test are explicitly extended, while the accepted reject-all `staged-bootstrap.js` and its test are intentionally removed by the required 03d cutover. No unexplained prerequisite drift was found.

## Outcome

SPEC-03 now provides the mediated text-file save path end to end: durable opaque reservation binding, stable resource identity, preimage capture, serialized prepare/write/finalize, restart reconciliation, exact admitted resource facts, a narrow provenance-ledger subscriber, and the checksummed `file_save@1` and `resource:provenance@1` WebSocket families. Initial and switched workspace bindings carry server-issued epochs and both protocol advertisements; clients correlate replies against the current pair and preserve dirty content until the exact editor revision is acknowledged.

The 03d activation is coherent. Startup reconciles the registry/subscription/grant state, installs the durable verifier, exact save-owner publishers, ledger handler/provider, one locked subscription and its exact three `system_seed` grants, reconciles pending operations, composes both protocol routes, and only then listens. The former reject-all/discard-only staging adapter is gone. No publisher catalog, factory, minter, upward grant route, raw snapshot query surface, watcher mediation, or SPEC-04 unsolicited renderer projection was added.

Exactly one successful-save legacy `file_changed` broadcast remains until SPEC-04. Create, move, rename, delete, watcher observations, arbitrary external writers, and unrelated file writers remain outside this MVP claim.

## Slice order, completion, and gates

| Order | Slice | Builder | Builder-owned gate lifecycle | Orchestrator acceptance | Accepted current identity |
|---:|---|---|---|---|---|
| 03a | Registry, operation, version, and query repositories | `/root/spec_03_file_provenance/slice_03a` | Passes 01 and 03 produced repair packets; pass 02 was clean but invalidated by later acceptance findings; pass 04 `CLEAN` on repaired bytes | Acceptance 01 found request-binding, contention, phase/chronology, and same-path active-operation defects; acceptance 02 `CLEAN` | 15-path slice aggregate `42d83df850438c96ba27f1d7c556d710fdc8ef06fd0736588f72ac726ec5f8ff` |
| 03b | Save controller and crash reconciliation | `/root/spec_03_file_provenance/slice_03b` | Passes 01–08 and 10–13 produced repair packets; pass 09 was invalidated; pass 14 `CLEAN` | Acceptance 01 found alias serialization and successful replay defects and documented the approved syscall-window residual; acceptance 02 `CLEAN` | 21-path slice aggregate `60ef95f5a46fb2281e236aeb99bca858f1c9a65f33c63cd7e50546ae5a598a68` |
| 03c | Versioned save route, epochs, redaction, compatibility | `/root/spec_03_file_provenance/slice_03c` | Passes 01–04 found and repaired reconnect/bootstrap/milestone/captured-pair/optimistic-save/navigation/revision/error/send/correlation defects; pass 05 was interrupted after builder self-review changed bytes; pass 06 `CLEAN` | Acceptance 01 `CLEAN` | 47-line slice identity aggregate `1df3230b2b2ee80942655e5ef9f2f017eb64eec11216a568aef911de3bc29fbf` (45 edited paths plus two dependency identities) |
| 03d | Ledger handler, governed activation, and public query | `/root/spec_03_file_provenance/slice_03d` | Pass 01 interrupted after self-review; pass 02 clean on an invalidated candidate; passes 03–04 found and repaired failure-taxonomy, advertisement, and unsafe-`since` defects; pass 05 clean on an invalidated candidate; pass 06 clean before final integration repair; pass 07 `CLEAN` on current bytes | Acceptance 01 found physical alias normalization and infrastructure taxonomy defects; acceptance 02 found strict V2 discovery error swallowing; acceptance 03 `CLEAN`; final SPEC gate 01 found a segment-prefix containment defect, repaired before pass 07 | 42-path final slice aggregate `6e0db8ab2a48027d6d29e3dee65092085d8f2a086b3cd76445aa80861992cbc0` |

Slices executed serially with one product writer active at a time. Each slice used a fresh `spec-slice-builder`; each automated review used a fresh `clean-room-reviewer` governed by `spec-review-gate`. Findings were repaired by the owning builder and reviewed against current bytes. Every listed reviewer and builder is terminal. `close_agent` was unavailable; terminal completed/interrupted dispositions from `list_agents` are retained as lifecycle evidence and did not block accepted sibling spawns.

## Integrated verification

| Command/check | Current result |
|---|---|
| `cd fusion-studio-server && npm test -- --runInBand test/resources test/ledger test/ws` | Final repaired candidate: `24` suites, `200/200` tests passed |
| `cd fusion-studio-server && npm test` | Final repaired candidate: `110` suites passed; `996` passed, `1` existing skip |
| 03d expanded focused server gate | Final repaired candidate: `16` suites, `92/92` passed |
| Strict V2 route plus all view tests | `7` suites, `46/46` passed |
| `cd fusion-studio-client && npx playwright test --config=playwright.source.config.ts` | Orchestrator final rerun: `26/26` passed |
| `cd fusion-studio-client && npm run build` | Passed; `1,815` modules transformed |
| Changed-file ESLint | Passed for all touched client protocol/state/test paths |
| Changed server `node --check` and `git diff --check` | Passed |
| Isolated runtime composition | Fresh temporary `FUSION_APP_USER_DATA` profile initialized six schemas, one subscription with `activeSubscriptions=1`, composed both routes, reached `SERVER_READY` on an ephemeral port, stopped cleanly, and was removed; no live `fusion.db` was edited |
| Staging-removal sweep | Both staging source/test paths absent; zero `staged-bootstrap` or retired `resource_provenance_route_failed` runtime/test references |
| Public UEB export probe | Exact exports remain `bus,emit,on`; no publisher/grant/minter/catalog authority surfaced |
| Latest builder clean gate | `/root/spec_03_file_provenance/slice_03d/slice_03d_gate_pass_7` returned `CLEAN` on the 42-path repaired candidate |
| Final integrated clean-room gate | `/root/spec_03_file_provenance/spec_03_final_gate_02` returned `CLEAN`; independently authenticated 92/92 manifest paths, the approved 32/32 authority, prerequisite drift, mandatory/full/client gates, staging deletion, and deviation/residual claims |

The focused and full suites exercise containment and final-symlink rejection; raw `rootFolder` escape attempts; alias/resource-ID serialization; queue bounds; prepare/write/finalize ordering; exact preimages, byte lengths, and SHA-256 values; outcome-unknown and post-write pending truthfulness; crash/restart replay; reservation opacity; idempotency/conflict; schema/grant drift; redaction; binary/malformed frames; A→B and A→B→A; bind buffering; dirty-revision races; milestone/checkpoint behavior; public selector normalization/order/errors; one legacy broadcast; and the explicit mutation-scope exclusions.

## Exact current SPEC-03 work-product manifest

The integrated aggregate covers the union of all four slice-owned current product/test paths plus the two load-bearing AJV dependency identities. Deleted staging paths are recorded separately and are not assigned invented hashes. The report itself and unrelated pre-existing planning/runtime/style changes are outside this product manifest.

Serialization is exact: sort the 92 repository-relative paths below lexicographically; for each emit `<path>`, one ASCII tab, the file's lowercase SHA-256, and one LF; concatenate without header/footer; SHA-256 those bytes. Aggregate: `bb0fe8420ef0a07f7559432e84715162b4f5737bcbacbb450973e1dfaa28e374`.

```text
fusion-studio-client/e2e/file-save-protocol-source.spec.ts	998a1d0cdfe935b1d39bca40925ca698bd7cbbf8c51644da677911e0f831ea61
fusion-studio-client/e2e/resource-provenance-protocol-source.spec.ts	c389291f7ffd0ce15901e1d72f7a1f078d22c9fa6324e476a024f1b527ba23ca
fusion-studio-client/playwright.source.config.ts	c4a1141f5a6a3010c7338ab811f2b12c13835e98f75330500486eb9953aea897
fusion-studio-client/src/components/documentSaveAcknowledgement.ts	c1cfc2376ff4e14190403764549bef01a458e8dbe689f925b9f093b337685aea
fusion-studio-client/src/components/email/EmailDocumentPage.tsx	59af71c78bd64b7b1f5ccd75fa068f30758b1227da22d388bece4129e67466de
fusion-studio-client/src/components/email/useCrepeEditor.ts	6aa75ee1470c74e81e19db54cbfa15f3fd9f6d206b5819b248ab16c175b439c7
fusion-studio-client/src/components/email/useDocumentActions.ts	3aa5a27861c7b47cd3c62beac0f6839f7e8f7af24ec964e5beb191e1be04a5a6
fusion-studio-client/src/components/office/OfficeDocumentPage.tsx	c5a4c2708b316ae7658d52fb38005aa916dcc9cf046e517c44a085e90bc1ba1b
fusion-studio-client/src/components/office/useCrepeEditor.ts	63e5e5ecd8d41010e1047f241048f32d064dbdaacc17068375d0570371f0cbfb
fusion-studio-client/src/components/office/useDocumentActions.ts	ac700109ee2f0f8ae63e96fff62d2a150298a6e22b4162ba325d2ef73bbe8f0f
fusion-studio-client/src/lib/ws-client.ts	9c5843ce2eb5d4bd03003d2c2cfb46203740cfbc63496e77fc8bd2c8cb7823b2
fusion-studio-client/src/lib/ws/file-handlers.ts	5d883e89b1bab6d056455b57966fce79582e1442998b6aecea3cb3a59d06b45e
fusion-studio-client/src/lib/ws/file-save-protocol.ts	ba2e5a1bcffc1237718413f5ca546740b49863a2c647bd388f94f1c8fb42a26f
fusion-studio-client/src/lib/ws/office-palette-handlers.ts	5fe9aa92b6bbaea594a6b1c83582a53fcc9ebc9313206f1dbb794e0b25b2cd06
fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts	a5ea67590c3efee0b01ded5cc255d43057f82b817d2d87d524e0e85d39e7e966
fusion-studio-client/src/lib/ws/workspace-handlers.ts	67e469ca0370bae4b029ba677d6d5f8d775278a7ba412c895a1109392f43103b
fusion-studio-client/src/state/fileDataStore.ts	54b5e8f4e8a07434ac00b60cdb5ee2d61957023c2479b1017858afa0ab92dd0b
fusion-studio-client/src/state/workspaceStore.ts	e0e9c98f4da68b9d9d6c539120df5d7c6c2d907fedd39005e84dc382093a8dd3
fusion-studio-client/src/types/file-explorer.ts	8240a0e7cf2c1b1295ad73077832195b8eeb8a1bff8db68d4b566f96da247437
fusion-studio-client/src/types/index.ts	3a01352cc80df0b5dda560a00611ed0e5157786a6d1e3dff4e83646e223a4656
fusion-studio-server/lib/db/migrations/035_file_provenance.js	18bd81495ac4f8dc830740687e8582f53d35d3e6299944d17a62d3fb916d52f6
fusion-studio-server/lib/event-registry/index.js	9cbfbed9f46a94c2c6201ddfda2da607c536bceb10adfe2bf15d9e67a936c633
fusion-studio-server/lib/event-registry/reconcile.js	e63b976785388a4261446e06607a104061fd12b6b4b427d19c8a9d9314bbfc6c
fusion-studio-server/lib/event-registry/schema-validator.js	bd0dfb12b04fdd358f22503f3dcdf3981e0964176279b35bd3fdca252035f3a1
fusion-studio-server/lib/event-registry/schemas/file-save-v1.json	5073f1271a06e399d4aadc06dafe2fc85b76e43f9f4e0c59f2ef37bc7f7c74de
fusion-studio-server/lib/event-registry/schemas/resource-provenance-v1.json	72d9e23645a58f5ca6cd7c7f5104b760eb54f63f62a026a0918f3dc9b4730675
fusion-studio-server/lib/event-registry/seed-catalog.js	aa61659a2c2f658b4032d36e6b8555d69b25e9b9257a92dc2805520549695982
fusion-studio-server/lib/event-registry/subscription-seed-catalog.js	87c9fc379662096c8df4610b0b7582f4ad874197c74bc688bfc8f4c445e368a0
fusion-studio-server/lib/file-mutations/atomic-writer.js	d357db73e632ecf1d64cd08cb2aa94afe98251e5da45653d8ae48b065580e5c3
fusion-studio-server/lib/file-mutations/bounded-file-read.js	bdfb0d6d677b642321437e6e86b93ab38fcd5b0dbcbc441897a648b945cfa3cb
fusion-studio-server/lib/file-mutations/checkpoint-adapter.js	732abbb6683a70e98e44831bcf43d938b241ca8f2aac7d1a5bae83228e775013
fusion-studio-server/lib/file-mutations/durable-reservations.js	bd615efbde764acd3233dd6558c5730d990a316be17f1aa72c187f059305cdd9
fusion-studio-server/lib/file-mutations/fact-replay.js	b0a0277784942ffe04525c6b0c898edba51aee64061a1c3ff6b31cda9394e4f8
fusion-studio-server/lib/file-mutations/fact-reservation-bindings.js	164f5752c0efdf591ef2a6e5dc08ee5b93830c6cf0ba89320438f848d15b8f3a
fusion-studio-server/lib/file-mutations/file-operation-repository.js	95b07a2cfb420c0cf542fa8be3eb7757967baf9ac59583a479ce4414330ddf8c
fusion-studio-server/lib/file-mutations/file-version-repository.js	748955d606e8e58fe530a57239fe155ffbb79d540d5af1182343306b0558744a
fusion-studio-server/lib/file-mutations/path-authority.js	ba8bd8417110287d8e4910aa92f0911db537795436247194d3b65e52cf333315
fusion-studio-server/lib/file-mutations/provenance-values.js	4d04f140267d5abf51b3cca1da5f9d6f43c49434373f54b1e2ef683e1ae2a35c
fusion-studio-server/lib/file-mutations/reconciliation.js	7eb9110a2dcd7d1eb7ebf57c3a82424d473986dfc654c8888349258f2be2ab9a
fusion-studio-server/lib/file-mutations/save-controller.js	a64017bd47c177f8bd03336ef4042d818b557d276059d7d4b4ca3d131fd56aab
fusion-studio-server/lib/file-mutations/save-mutex.js	59f3b4b28a46ccd2bd5b665d002c39a205d3bfb5210b095c793dd45843e3d3b1
fusion-studio-server/lib/file-mutations/save-owner.js	1907e6aee7679c63425a2f4face046470be855584418e73c7672e94bb6a0c49a
fusion-studio-server/lib/file-mutations/sqlite-contention.js	784e82332a447ce3b02f3420e7a580a215ffccde29a867160f07cdb8293a6f56
fusion-studio-server/lib/file-mutations/stable-resource-repository.js	fbdd5d61054578f93347eb23fd4b1f05c415c5629f680173757c67be9c607267
fusion-studio-server/lib/file-mutations/text-codec.js	95b4b256eda552d9f193761fa7d31fbdbdb42cc34143101e62ca6e2f0bb9df6d
fusion-studio-server/lib/file-mutations/validation-patterns.js	e105151eb3fe2ebbff604f8b8a0ccca8ca8542a8e147f78dae93bf65ce4991c0
fusion-studio-server/lib/fs/dirents.js	78b0c933f40ffecf6602d61f7855db1fd9f16d36d945183050f25e2500be016d
fusion-studio-server/lib/ledger/provenance-ledger-handler.js	dd3badf6a61c6cac23ddc1938ef64a72658963bbf4495b5dda8c95d76c58c362
fusion-studio-server/lib/ledger/provenance-query-paths.js	8d2c73e606590e55fc53af471ea3e92d679f51fa656d31193e8623d77b954d92
fusion-studio-server/lib/ledger/resource-provenance-repository.js	180cb86ef87138513f7ee1c256a544fff2c33c214b6d0cda8cc36cd73b580ea7
fusion-studio-server/lib/startup.js	0b7c2d125aeb60327747ad5479bc2f042ca5152046cd00400c4111756311ebfe
fusion-studio-server/lib/subscriptions/file-provenance-bootstrap.js	5c257c9a1347d5aac4c9fc956bd60b23fb7c1ea4ca1cb402bfe089d1889d7dbc
fusion-studio-server/lib/versioning.js	d3245b523bb7104e613260b61fe0d22e59ec42e5abf0292d22a2275595dc65bf
fusion-studio-server/lib/views/index.js	c26c92a80e9d0f5963cee48016ecf5c6f2dc64c007eb89d74f2791f6d52db6bb
fusion-studio-server/lib/views/panel-paths.js	fb41c26a2cf0695a94bfe83fbea08a68685d47b764b88f4269e0b635a96d0546
fusion-studio-server/lib/ws/client-frame-decoder.js	d16e713812f5e611c1abe2e05e1db3cd423c22a1c30793ded03c4acf06d812f4
fusion-studio-server/lib/ws/client-message-router.js	6f96d43eb4a8a8308ef3edc8ee5f89526e6e6d53c5b9afb267bfc672af6f33cb
fusion-studio-server/lib/ws/connection-init.js	c9f232493effb7b7e6043a19116ae1161d4cfcaa8d9ee7a7067c6f077df221e5
fusion-studio-server/lib/ws/file-save-route.js	7122474de3ab970bf42a3ab751e90f866bd66fac106bb34e415ae24ee702ac6e
fusion-studio-server/lib/ws/office-palette-dispatch.js	cd5a1c4a27d9c2df7a2e855320007395ee2916a7a60ac1a2ce08c8513cbd9c50
fusion-studio-server/lib/ws/redaction-map.js	a76b5c1075479a9e9f7379b62b9d34e8f6bcd88f25f209df233f205d18776728
fusion-studio-server/lib/ws/resource-provenance-route.js	73afa30e69e58c1ec58fe60fce3c2f1ca1e051822c95149702ccc3e1278a461f
fusion-studio-server/lib/ws/workspace-broadcaster.js	64d31ffeb5f55816a74a9efdbd1476b6091fe9b250e76d802386c35891c59678
fusion-studio-server/lib/ws/workspace-session.js	1699d5cee6d6e097016007019af706c1fc050a879272cd34365dbe78654f6814
fusion-studio-server/package-lock.json	18f85fbfb208697f2821add277ec59441e7981f76983fc384709b7822baf49a1
fusion-studio-server/package.json	270905edc53baeb6b1353fa9d53a02754b4538fc1da859685839472824aa801b
fusion-studio-server/server.js	41203624af62743e5aade80a44915f35223a7ceddf6a3666b1829d863bdc6964
fusion-studio-server/test/event-registry/migration.test.js	e522ca50bb071dd81506967a7838e3c08d2ee97fa5736b0882b13bcad9f1667f
fusion-studio-server/test/event-registry/resource-provenance-schema.test.js	8944645ead5255df9569cf1bb8416354af85fca5a2fe8badc67a80293d93fe97
fusion-studio-server/test/event-registry/schema-validation.test.js	b2e99b685ec71bc037f25ddeafd5a3bd88a26e856bbc5c926a85d63061afa6ca
fusion-studio-server/test/event-registry/seed-reconciliation.test.js	e0729c8617195dff2bf858497c3f225c87361576daa585d6a5b05932aa2e3777
fusion-studio-server/test/event-registry/startup-integration.test.js	126293c106156b6ed6c357758a82d3e0a293ce4f892f6625d001c2628d2a0c4e
fusion-studio-server/test/ledger/provenance-ledger-handler.test.js	703f2fa16907cd2bc3bffb2b12d501433db3ab170c49bc5dc2f08e5efed14aff
fusion-studio-server/test/ledger/provenance-query-paths.test.js	b9a5a0d3d74f03bdcd6fb156fbe2740780d4867f303197813f5c5e84a7766850
fusion-studio-server/test/ledger/resource-provenance-repository.test.js	c8e81788dc9b00e2537f67ffe8c857795e848166b4e1191c514658841331eb84
fusion-studio-server/test/resources/durable-reservations.test.js	006085214af3138e295b61821ee727048ee4a9feaedf8910b5dbb0c0a03c2459
fusion-studio-server/test/resources/file-provenance-integration.test.js	57793007b0b33f28d2784a7215b4f765d7f7dec84d960963d4b415eb415891ce
fusion-studio-server/test/resources/migration.test.js	8049d74ec4c122b0b601dceef13b364cfaa1ba645912609e3485b757186a57f3
fusion-studio-server/test/resources/path-authority-and-atomic-writer.test.js	0db61a45dd02f2d9f1a326db8fc3dae5790c185dc532ad22550a281c0c428aa1
fusion-studio-server/test/resources/reconciliation.test.js	5f6a85c3b799c6bebf4193d438852ff06454ecd7f0b02e9ef649cfc77f3a282c
fusion-studio-server/test/resources/repositories.test.js	43c1845bdb21a1c1b95f2496423efb99925242f461611b70519425b79b48f6b9
fusion-studio-server/test/resources/save-controller.test.js	d40e3dbcbf2570ec2845cbff529932073428349383c0aa72337eb5972e88da5e
fusion-studio-server/test/resources/test-db.js	2ca1d3890b7130dce0cdf676e564eb37466330d51ec16a3b240b92d725b276ec
fusion-studio-server/test/resources/text-codec-and-mutex.test.js	360f81095f44f908e2c259d15cd4704325b6c4f481e589f756b10a1ce9615e35
fusion-studio-server/test/subscriptions/file-provenance-bootstrap.test.js	d821dfbd23cefe9ab82b81f77e091f5d7e255aa60c79764c7ff496e0b1692dae
fusion-studio-server/test/ws/client-message-router.test.js	4f4abf9490a7679cd90c0a1b261c21d088826cfe012843a1ab2c4e60d8086059
fusion-studio-server/test/ws/file-save-route.test.js	dfa8cbba18a238d4b8edc1a8e506acc675741209aa0926b93acfa9fd58f1a416
fusion-studio-server/test/ws/redaction-map.test.js	ec8fb4c5c63dcb8e262bc0cf6c766dd84cd1d23c40d7fd124829e017f49c46d4
fusion-studio-server/test/ws/resource-provenance-advertisement.test.js	f66cff901105112b7497645bcf5a4cb92fe1b20886f0e32f3ec7cef89a80657b
fusion-studio-server/test/ws/resource-provenance-route.test.js	80f66702abc99a26822a3b7964baa353cc969e6d479d1804bc1803d2d0133683
fusion-studio-server/test/ws/workspace-broadcaster.test.js	4e6ab8efc082191f410224c344cbad3440afdb0bbd207955f3900dc39de51c28
fusion-studio-server/test/ws/workspace-session.test.js	0179b4545dafb30a9fbd62210b7b5dd7d3cc590f3a7824ae5fee1228aa7598b3
```

Removed relative to the accepted SPEC-02 staging state:

```text
fusion-studio-server/lib/subscriptions/staged-bootstrap.js
fusion-studio-server/test/subscriptions/staged-bootstrap.test.js
```

## Deviation and out-of-scope accounting

### D-01 — Additive operation/provenance persistence

- Original contract: add migration-backed stable resources, operations, snapshots, replay state, and provenance query storage without editing `fusion.db`.
- Actual change: migration 035 adds the required tables/indexes plus additive `resource_provenance_events`; repositories include bounded SQLite contention retry, path-level active-operation uniqueness, and durable terminal-response replay.
- Reason: concurrent reservation/ledger correctness and restart-idempotent responses require durable uniqueness and state beyond a single controller call.
- Files/tests: migration 035; `file-mutations/*repository*`, `durable-reservations.js`, `sqlite-contention.js`, ledger repository; migration/repository/contention/concurrency/restart tests.
- Observable effect: exact duplicate events are no-ops, conflicting IDs never overwrite truth, and same-path active operations serialize across processes.
- Risk/downstream: migration is additive; one cohesive operation repository exceeds the advisory 400-line target but remains single-purpose. SPEC-04 consumes the durable identities without schema replacement.
- Classification: `accepted — required persistence/concurrency integration`.

### D-02 — Bounded filesystem authority and controller helpers

- Original contract: mediated text saves must enforce server-derived containment, exact UTF-8/preimage rules, one atomic replacement, truthful lifecycle ordering, and checkpoint compatibility.
- Actual change: dedicated path authority, bounded read, text codec, mutex, atomic writer, validation, replay/reconciliation, save owner, and shell-free `execFile` checkpoint adapter modules were added; case-insensitive volumes conservatively serialize at parent scope. Containment is segment-aware, so exact parent traversal is rejected without falsely rejecting legal in-root names such as `..note.md`.
- Reason: these security and crash boundaries cannot be safely represented in the legacy direct writer.
- Files/tests: `lib/file-mutations/*`, `lib/versioning.js`, `lib/views/panel-paths.js`, resource/controller/reconciliation tests.
- Observable effect: File Viewer and Office aliases share physical identity and mutex; unsupported/binary/oversize/symlink/outside paths reject before mutation; legal top-level and nested leading-dot-dot filenames save and query normally; Git failure becomes a warning after truthful file success.
- Risk/downstream: the final pathname replacement syscall cannot be conditionally bound to a dirfd with Node's current standard API. Immediate before/after checks minimize and detect the window; arbitrary external writers remain explicitly out of scope.
- Classification: `accepted — mechanically necessary security integration`.

### D-03 — Acknowledgement-aware client caller integration

- Original contract: first-party callers use `file_save@1`, never report optimistic success, preserve checkpoint/milestone behavior, and retain dirty/navigation state across rejection/reconnect.
- Actual change: Office/Email pages, editor hooks, action hooks, shared acknowledgement helper, workspace/file stores, WS helpers, and source tests were updated beyond the advisory store-only paths.
- Reason: caller-local dirty/session/checkpoint state and navigation decisions could not be made revision-safe solely inside `fileDataStore`.
- Files/tests: the client component/state/protocol paths in the manifest; 26 source protocol/caller tests and production build.
- Observable effect: callers await correlated acknowledgement; edits made during an in-flight save remain dirty; navigation drains current revisions or aborts; milestone saves serialize instead of being suppressed.
- Risk/downstream: legacy nonadvertising servers retain a bounded fallback. A legacy save crossing a workspace bind forces reconnect through tombstones rather than accepting ambiguous path-only correlation.
- Classification: `accepted — required client integration and compatibility`.

### D-04 — Atomic activation and staging deletion

- Original contract: replace the SPEC-02 reject-all verifier and discard-only installer atomically with durable verification, exact publishers, handler/provider, locked subscription, and exact grants; do not leave partial activation.
- Actual change: `file-provenance-bootstrap.js`, registry/subscription reconciliation, startup, server route installer, and tests compose the whole graph before listen; both staging files were deleted.
- Reason: advertising or accepting saves before durable admission/ledger authority exists would create false success or dropped facts.
- Files/tests: startup/server/bootstrap/registry/subscription/query routes and integration tests.
- Observable effect: production advertises v1 only after both routes and durable authorities are installed; isolated startup reports exactly one active subscription.
- Risk/downstream: no temporary staging adapter remains. SPEC-04 can replace the one legacy projection without undoing save authority.
- Classification: `accepted — mandatory sequencing completion`.

### D-05 — Public query path normalization and strict view discovery

- Original contract: panel selectors normalize to the same physical canonical path as mediated saves; infrastructure failures return bounded `query_failed`, while actual selector errors return `invalid_request`.
- Actual change: a dedicated query normalizer reuses physical save authority. Shared panel/view discovery and dirent classification gained opt-in `strictFilesystemErrors`; only the provenance query enables it, and only `ENOENT`/`ENOTDIR` mean absence in strict mode.
- Reason: lexical alias joins and swallowed V2 manifest/root/entry EIOs produced missing results or blamed valid callers.
- Files/tests: `provenance-query-paths.js`, `panel-paths.js`, `views/index.js`, `fs/dirents.js`, query route and route/view integration tests.
- Observable effect: symlink-parent save→exact/folder queries agree; manifest/root/entry EIO returns one paired `query_failed` diagnostic; a healthy unknown panel remains `invalid_request`. No-panel canonical historical selectors remain lexical.
- Risk/downstream: panel-aware historical queries depend on current filesystem resolution; callers can use canonical no-panel selectors for moved historical paths. Default view callers preserve prior non-strict behavior.
- Classification: `accepted — required security/error-taxonomy integration`.

### D-06 — Closed fallback when registry validation infrastructure throws

- Original contract: every valid paired query receives a fixed response; server exceptions must not leak diagnostics or force recursive failure.
- Actual change: the query route has a separately closed encoder for the exact paired `query_failed` union only when the checksummed validator itself throws.
- Reason: retrying the failed validator caused a second exception and socket close 1011.
- Files/tests: `resource-provenance-route.js` and its injected-registry-failure tests.
- Observable effect: one static paired error and one bounded diagnostic; no raw exception, selector, SQL, or snapshot data.
- Risk/downstream: the fallback bypasses the unavailable validator only for the fixed closed error. Remove if the registry later supplies an independently trusted fixed-error encoder.
- Classification: `accepted — bounded failure-containment integration`.

### D-07 — Capability advertisement and schema closure corrections

- Original contract: bind state atomically carries supported protocol authority; request validation and repositories agree on selector bounds.
- Actual change: both bind frames advertise `resourceProvenanceProtocolVersion: 1`; client state guards before pending registration/send. Locked schemas/semantic validation reject unsafe `since`, dot/dot-dot filenames, and preserve the approved empty milestone.
- Reason: unadvertised old servers otherwise leave queries pending, and divergent validator/repository bounds misclassified caller input as infrastructure failure.
- Files/tests: connection init/broadcaster/workspace state/query protocol, registry schemas/validator, advertisement/schema/route tests.
- Observable effect: old servers reject locally without sending; switch/reconnect replaces capability with the new pair; unsafe selectors never execute a repository query.
- Risk/downstream: seed checksums correctly drift against any provisional pre-acceptance profile rather than silently mutating locked definitions.
- Classification: `accepted — protocol conformance repair`.

### D-08 — Legacy compatibility boundary

- Original contract: preserve one legacy `file_changed` save broadcast through SPEC-03; SPEC-04 owns recipient-session resolution and final unsolicited `workspaceEpoch` injection.
- Actual change: exactly one controller-owned successful-save broadcast remains; no provenance query UI or unsolicited renderer projection was added.
- Reason: maintain current consumers without preempting SPEC-04's projection cutover.
- Files/tests: save owner/controller, workspace broadcaster/session, client legacy fallback and compatibility tests.
- Observable effect: legacy consumers continue receiving successful save notification; versioned request/reply authority is live.
- Risk/downstream: a crash after durable success but before checkpoint/legacy notification can omit that compatibility side effect; durable replay avoids duplicating the write/facts. SPEC-04 must remove/replace the legacy projection deliberately.
- Classification: `accepted — required temporary compatibility boundary`; removal criterion is SPEC-04 acceptance.

## Staging-adapter removal proof

- `fusion-studio-server/lib/subscriptions/staged-bootstrap.js`: absent.
- `fusion-studio-server/test/subscriptions/staged-bootstrap.test.js`: absent.
- Runtime/test search for `staged-bootstrap`, reject-all/discard-only installer symbols, and retired `resource_provenance_route_failed`: zero active references.
- `file-provenance-bootstrap.js` installs the durable verifier and exact publishers; startup supplies the ledger provider/handler, locked subscription/grants, pending replay, and both protocol routes.
- Public event-bus exports remain only `bus`, `emit`, and `on`.

## Residual risks, skipped checks, and compatibility disposition

- Accepted residual: a narrow final rename syscall window remains because Node's standard API lacks conditional `renameat`/dirfd binding. The implementation checks immediately around replacement and reports `outcome_unknown` where detectable; arbitrary external writers remain out of scope.
- A crash after durable success but before checkpoint or the legacy notification may omit the non-authoritative compatibility side effect. Durable command/resource facts and replay remain truthful and idempotent.
- Panel-aware historical query resolution uses current filesystem authority; canonical no-panel selectors remain available for historical paths.
- No Electron manual UI or Alpha launch/deployment was performed. This SPEC is nonvisual and has source-level client protocol/caller tests, a production build, full server tests, and isolated runtime composition. Alpha changes were not authorized.
- Full client lint was not used as a gate because the repository has 37 pre-existing unrelated errors and 3 warnings outside the changed-file set; targeted changed-file lint is clean.
- Existing nonblocking warnings remain: Node local-storage/DEP0190, Playwright `NO_COLOR`, Vite `gray-matter` eval/chunk size, and one unrelated skipped harness test.
- No temporary adapter remains. The only intentional compatibility surface is the single successful-save `file_changed` projection and legacy nonadvertising-server fallback, both explicitly bounded above.

## Lifecycle disposition

All four direct builder children are terminal. All builder-owned reviewers and all orchestrator acceptance/final reviewers are terminal (`CLEAN`, repaired findings, or explicitly interrupted before verdict because bytes changed). The first final integrated gate found a segment-prefix containment defect; the 03d builder repaired it, reran the full matrix, and fresh builder pass 07 returned `CLEAN`. Fresh orchestrator final gate 02 then returned `CLEAN` on the current 92-path candidate. There is no active writer/reviewer conflict. The runtime exposed no `close_agent` operation; missing closure is recorded as lifecycle evidence rather than a blocker. No unresolved owner decision or execution impossibility remains.

`SPEC_READY_FOR_SUPERVISOR_REVIEW`
