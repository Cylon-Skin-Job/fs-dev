# PROV-01 Integration Report

Status: `OWNER_ACCEPTED`

Date: 2026-09-06

## Outcome

The owner-accepted PROV-01 implementation was authenticated, committed as an immutable content-addressed source candidate, merged into the `agent/exact-workspace-paths` implementation line, reconciled with the already accepted TABS-03 contract, and validated on the integrated baseline.

The Trusted Fusion Shell Authority prerequisite is now satisfied on this implementation line. No BRIDGE-01, BRIDGE-02, Chat SPEC-00, or later feature work was started.

## Revisions

| Identity | Commit | Tree / relationship |
|---|---|---|
| Destination baseline | `18646184475330f998d3dc833dba011bee80ec51` | Included approved Chat planning and accepted TABS-03 merge `2748f03` |
| Accepted PROV-01 source | `acf12dafe7499b04995617e5d9c1512775e5ba12` | Tree `09014e63aa4d58bd93ff13e39e794548758ba48c`; parent `4f972c563948213e3b459ed52f3d2f69ca203b99` |
| Integration merge | `d31fc8aeab0eae9cd622cad7b6db7b81a3498e87` | Tree `147f10c5728de5008fb09654b23a587d9bd098d6`; parents are the destination baseline and accepted source |

The source commit contains exactly 270 accepted path entries: 269 files and the accepted deletion of `fusion-studio-client/src/hooks/useFileTree.ts`.

## Authentication And Fingerprints

### Immutable accepted-source evidence

These hashes reproduce against the isolated accepted source bytes:

| Evidence | Count | SHA-256 aggregate |
|---|---:|---|
| PROV-01 normative source authority | 26/26 | `616b34ab8f748fd247a2ff3cb31f6bfa5d1c3483a48a43f845e07db1751d36cb` |
| Required Capture 023 predecessor authority | 32/32 | `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310` |
| Accepted owner receipt report | 1 | `21258a8b49fe7d545a09c8e56dd23f00cc9a4ed1a5f54ec7a5b78694da8f0a15` |
| Accepted ledger | 1 | `3660d054d3f8dfc487782c21ad3e765f2352356301c361d5fa8954a62363573a` |
| Accepted release manifest | 1 | `e4f695aa00ffcab3cccdea74a17eaf7f45ce78bd317f49de881f8ef15fc2e1e2` |
| Accepted source packet, excluding the deletion | 269 | `11638c8f1934e38a6f051fb3a2ded75d47aed95a1fd301a7d0ecd7ebf3f4f112` |
| Accepted combined product set | 243 | `1e6faf70ef201672919064ac354bd2e393b3089f720583295e17b85e9ece28fb` |
| Accepted PROV union, final source bytes | 129 | `bca58cc2271e29f9947ae202f6c76f50bce11e84157ab0765922b5830daf2c16` |

Historical accepted slice aggregates were also authenticated against their recorded candidate bytes:

| Slice | Historical accepted aggregate |
|---|---|
| 01a | `f612d147ecb4fa710928f222fdf7011b997120d92cf1a7c503dbd2b86eec7383` |
| 01b | `b4a184285791fc3dfc17055a013b9ffbe9bf9a2369bef43b63c524f2e960665e` |
| 01c | `7767339c6e8d5bf65397d6553f9aa5717dbd240f1f93560124f3c22ad1d586b0` |
| 01d | `3700a5e868aa586f1b00f866c19631ff2df1c1bd2a19c158ac0a9901408d1746` |
| 01e | `2359d01db23e2124970a31241873f77ee3b334503a388c65ace728d95357f177` |
| 01f | `c82ab338862d3b54d9c93efe1f5a7111cdaad2c724df91560c377705e986e62e` |

The historical 01a-01e aggregates are provenance identities, not simultaneous final-tree invariants: later accepted slices intentionally superseded shared paths. The final accepted-source slice aggregates are:

| Slice | Final accepted-source aggregate |
|---|---|
| 01a | `3513ecbc770606fbd44d72e438d00da85ec31cc95760462ed888b542e4ffc803` |
| 01b | `778608493596bced0d76db4c2cd69ebe54cf8cbc4184199196a4ea379f962daf` |
| 01c | `e46cec46f5fd7658bb318d1b23da0c33481e9734fd7882d72795f641b0ca95af` |
| 01d | `1583f846760bee9d8bf90324a4d795cd2992a8676b460034bbd87f8b50ce7710` |
| 01e | `a884ea3a7012e672a62f9a052249ebcbf2b7d4a302ab734ad5c230e976170d56` |
| 01f | `c82ab338862d3b54d9c93efe1f5a7111cdaad2c724df91560c377705e986e62e` |

### Integrated-baseline evidence

The integrated current-byte manifests reproduce:

| Evidence | SHA-256 aggregate |
|---|---|
| Slice 01a | `3513ecbc770606fbd44d72e438d00da85ec31cc95760462ed888b542e4ffc803` |
| Slice 01b | `71a080043ea9f9827c99076631375f23304ec9472976b08c2582132df01b894f` |
| Slice 01c | `f18e104cbbda2e4279334ad1be171fbad3e7dfe2093fb68d3837641e3d173a7e` |
| Slice 01d | `6cdcb3ee9e9e063c120569c2ddb6d4cf4a381afe22e3642b191a29cc09e8df2d` |
| Slice 01e | `98a61a2cf3fb70aff06a7cf85c4d9562952f691123cfd04156a69464f8a2fa92` |
| Slice 01f | `0630a8a1a2e1b11c5a0378da5a8de7e32d7673536ae675d0ad9806ec0af036a5` |
| PROV union, 129 paths | `3d2e835e60ef516ace52baf2c098ad28e266499875020cad5330b83c782a3ff8` |
| Accepted 243 product paths after composition | `28f11c251421418a4d3eaf52b2f9a4cf886c6f4152ba36933838b750e9fe73da` |
| Final 249 product/test paths | `4cfee615a6ae79eea5a81eff4889c60fe709d91414acd62857d07eeac6ec193f` |
| Full merge payload, 275 files excluding deletion | `b10150cd731bf09ed44cc1aec14a8e3f99b16db05f3c677ce805acc6a132c80a` |
| Accepted TABS-03, 22 paths | `59d6e036026ad0c609b1c40a271951671ee24075fbb1aa6637b2f5e4d6a14666` |

The 129-path manifest itself hashes to `73792d392382fef3b94f44aabacdb08eb353d27e62ad18e577e862857576d576`. The final 249-path product/test manifest hashes to `8b6734451be7730e20b05f41e786b87531d6f67e6f5433e14c1248c9642deed7`, and the 275-file merge manifest hashes to `642a016bc18c8f089d2ef308ab5e4f1376c64459df496017daa1788674ea2a27`.

The normative 26-file and Capture 023 32-file documentation aggregates are intentionally retained as source-authentication hashes, not asserted as integrated-tree hashes. The destination contained newer accepted Wiki/planning authority: 13 of the 26 and 22 of the 32 paths differ for that reason. No product packet byte was silently substituted under either authority hash.

## Path Accounting

The machine-readable path ledger is `PROV-01-INTEGRATION-PATHS.tsv` and hashes to `24903c8398fd0cc5134b98a8f08f4537e02f9f6471f45c02ff4534e3df3d370f`.

| Relationship to accepted source | Paths |
|---|---:|
| Exact accepted source blob | 244 |
| Exact accepted source deletion | 1 |
| Merge-composed to preserve PROV-01 and TABS-03 | 25 |
| Integration-only compatibility or regression coverage | 7 |
| Total accounted paths | 277 |

Destination status accounting is 211 added, 64 modified, 1 deleted, and 1 source-related path whose destination blob was retained exactly. The merge commit itself changes 276 paths because that retained test path has no destination diff.

## Conflict Resolution And Deviations

Twenty textual merge conflicts were resolved. Each resolution retained the accepted PROV-01 behavior and the already accepted TABS-03/Chat drain behavior.

### Accepted integration deviations

1. **Empty-tab persistence**
   - Original contract: preserve PROV file-view provenance and TABS-03 tab fallback behavior.
   - Actual change: `viewActivity` permits explicit-null persistence only through an opt-in path; `fileStore` opts in only for an empty file selection. TABS home fallback remains intact.
   - Reason: the accepted implementations overlapped in empty-tab state ownership.
   - Tests/effect: client provenance Playwright, TABS public/cumulative/production suites, TypeScript, and build pass. Empty file tabs retain provenance without changing general fallback behavior.
   - Risk/downstream impact: low; compatible deviation, no downstream correction required.

2. **Capture hydration ownership**
   - Original contract: authoritative Capture state must survive hydration without duplicate normalization.
   - Actual change: redundant Capture normalization was removed from `ws-client`; the accepted TABS adapter remains the sole hydration owner.
   - Reason: composing both implementations otherwise duplicated state transformation.
   - Tests/effect: client and TABS suites pass; one deterministic hydration route remains.
   - Risk/downstream impact: low; compatible deviation.

3. **Legacy canonical event compatibility**
   - Original contract: preserve accepted PROV event semantics while retaining the destination drain-driven runtime.
   - Actual change: the exact accepted legacy applier was retained in `canonical-chat-event-applier-legacy.js` and is gated behind an explicit `{ session }` constructor; production callers omit it and remain drain-driven. Stop finalization passes captured drain context.
   - Reason: the source test contract and destination runtime contract use distinct lifecycle ownership.
   - Tests/effect: full server suite, focused merged suites, runtime suites, and live same-database restart pass.
   - Risk/downstream impact: low; compatibility adapter is explicit and inactive on normal production callers.

4. **Harness and live-bind composition**
   - Original contract: retain destination Chat `step_begin` handling and accepted PROV `tool_snapshot` identity, timestamps, and signals.
   - Actual change: both event families are composed; terminal-snapshot-only records receive exact result expansion with `terminalSnapshotExpansionVersion=1` and `complete=true`, while ordinary incremental records are unchanged.
   - Reason: live restart reconstruction needs a bounded, versioned terminal expansion without weakening incremental semantics.
   - Tests/effect: focused runtime suites, new provenance regression, full server suite, agent live provenance, and file-view live provenance pass.
   - Risk/downstream impact: low; compatible deviation and additive version marker.

5. **Integration-only mechanics**
   - Original contract: preserve both accepted contracts without beginning later work.
   - Actual change: seven compatibility/regression paths were retained or added: `resolveViewTabBarModel.ts`, `viewTabTypes.ts`, `viewActivity.ts`, `live-turn-snapshot.js`, `canonical-chat-event-applier-legacy.js`, `canonical-chat-tool-events.js`, and `canonical-chat-tool-events-provenance.test.js`.
   - Reason: these are mechanically necessary to compose and prove the accepted contracts.
   - Tests/effect: all final checks pass; no BRIDGE or later Chat behavior was implemented.
   - Risk/downstream impact: low; compatible deviation.

No deviation requires an owner ruling. No downstream SPEC correction is required.

## Validation

| Validation | Result |
|---|---|
| Server full test suite | 150/150 suites passed; 2,181 passed and 1 existing skipped test (2,182 total) |
| Focused final runtime suites | 14 suites, 723/723 tests passed |
| New terminal-snapshot regression | 3/3 passed |
| Client provenance Playwright | 58/58 passed |
| TABS-03 public suite | 12/12 passed |
| TABS-03 cumulative suite | 115/115 passed |
| TABS-03 production suite | 24/24 passed |
| TypeScript project build | Passed |
| Client production build | Passed; 1,869 modules |
| Electron package | Passed; unsigned Darwin arm64 |
| Packaged native observer | `PACKAGED_NATIVE_OBSERVER_OK:arm64:141`; ready-descriptor swap verified |
| Agent live provenance, same database restart | `AGENT_TOOL_LIVE_PROVENANCE_OK` |
| File-view live provenance | `FILE_VIEWER_LIVE_PROVENANCE_OK` in normal and fact-publish-failure paths |
| Protected development state | Unchanged during isolated live validation |
| Product-only diff and scope audit | Passed |
| Unmerged entries / conflict markers | None |
| Final independent integration review | `CLEAN` (`/root/prov01_integration_final_review`) |

One earlier parallel full-suite run encountered the known intermittent `harness-diagnostic-service.test.js` behavior. The exact suite then passed 15/15, a 73-test sequence passed three times, the focused sequence passed ten times, and the subsequent full suite passed. No product byte was altered for the intermittent observation.

Accepted Capture evidence is byte-exact to the source commit. Its pre-existing Markdown hard-break whitespace is therefore intentionally preserved.

## Workspace Preservation

The integration was prepared in an isolated worktree. The five unrelated uncommitted destination files under System theme/state and Capture/File Viewer view state were excluded from every integration commit. Their hashes immediately before and after the destination fast-forward were identical:

| Protected uncommitted path | SHA-256 before and after fast-forward |
|---|---|
| `ai/RC-MacAir-15/System/state/state.json` | `aee8053a87b74f3e00bbfe5ec3dba87cf66396b3b4bbffc5c1f2b028ac1eefb3` |
| `ai/RC-MacAir-15/System/styles/themes.css` | `50a8fa64d59780bb0e13c09fe4a7bee050ceed37ba36e3f49b8505dabac8c8da` |
| `ai/RC-MacAir-15/System/styles/themes.json` | `752fae20976dbc2d758973c732757b8cc6f96d5edc1e05fa0a94f9fd888c3500` |
| `ai/RC-MacAir-15/Views/001-capture-viewer/state/state.json` | `20a26f991940386ac16aa6c3c6c2a02469faa669f9c23a3081493da49be1f98d` |
| `ai/RC-MacAir-15/Views/002-file-viewer/state/state.json` | `9e9969bcb7cb32dfb28b9a522ca2ec0e1f228cb7528265e0305b55ef3872d42e` |

## Review Ledger

- Source inventory and authentication: completed.
- Accepted source commit: `acf12dafe7499b04995617e5d9c1512775e5ba12`.
- Merge composition and repair: completed.
- Builder/reviewer chain: recorded in the accepted slice reports and current orchestration evidence.
- Final independent reviewer: `/root/prov01_integration_final_review`, result `CLEAN`.
- Residual risk: limited to the documented intermittent diagnostic-suite observation; repeated isolation and final full-suite evidence passed.
- Downstream impact: `compatible deviation`; Trusted Fusion Shell Authority is satisfied and SPEC-00 may proceed.
- Owner acceptance: granted 2026-09-06 in the coordinating Chat Composition task.
