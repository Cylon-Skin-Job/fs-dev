# SPEC-01 Implementation Report — Database Registry Authority

## Approved authority and current candidate

- Approved candidate: `MVP-PROV-SUB-3b8cb4f1e41df682`
- Approved aggregate SHA-256: `3b8cb4f1e41df682c56d03dbf39d8337ad318019e127106dce372fcab000f310`
- Dispatch and current Git revision: `806b33521907ed4b51cf792d5ef664fe319ea349`
- Worktree: `/Users/rccurtrightjr./projects/fs-dev-wt-universal-view-tab-bar`
- Reproducible integrated 27-file work-product aggregate: `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`
- Aggregate derivation: for each path in the exact report-manifest order, emit the newline-terminated ASCII output of `shasum -a 256 <path>` (`64 lowercase hex characters`, two ASCII spaces, repository-relative path), concatenate the 27 lines without a header or footer, then run `shasum -a 256` over those bytes.
- The approved 32-path release-manifest aggregate was independently recomputed at every acceptance level with zero mismatches.
- Product bytes are uncommitted on the revision above. Unrelated pre-existing planning, Wiki, runtime-state, and style changes were preserved. `IMPLEMENTATION-LEDGER.md` was not modified by this SPEC orchestrator or its builders.

## Delivered outcome

SPEC-01 now provides:

- normalized SQLite tables for event schemas, subscriptions, and grants through migration 034, with constraints, indexes, foreign keys, migration-029 data preservation, and dependency-safe rollback;
- deterministic canonical JSON and SHA-256 over exact canonical UTF-8 bytes, including strict malformed, duplicate-key, noncanonical, Unicode, cyclic, sparse, and unsupported-value rejection;
- locale-independent ordinal normalization for filters, schema references, and requested capabilities;
- a named registry repository with pending-only extension creation, separate requested/granted/effective authority, subtractive lifecycle and grant operations, optimistic concurrency, and monotonic update timestamps;
- a closure-identity, test-only human authorization fixture with no production minter, grant route, public route, or upward caller;
- closed MVP filter and capability grammars matching the later ledger and renderer fixtures;
- fail-closed, row-local effective-state evaluation for malformed JSON/BLOB storage, checksum and projection drift, unknown handlers/capabilities/schemas, locked identity drift, invalid scopes, and inactive lifecycle state without silently rewriting persisted lifecycle state;
- four literal JSON Schema 2020-12 documents with Ajv validation and supplemental Unicode-scalar, UTF-8 byte, and normalized-path checks;
- an explicit bundled seed catalog, stable schema IDs, canonical checksums, complete locked integrity descriptors, insert-only/idempotent reconciliation, collision containment, and restart reconstruction;
- startup initialization immediately after migrations and before handlers, subscribers, watchers, facts, sockets, or `listen`;
- exactly four seeded schema rows and zero production subscription rows, grants, or references to absent handlers.

## Slice ledger

| Order | Slice | Builder | Delivered | Builder gate | Orchestrator gate | Accepted state |
|---|---|---|---|---|---|---|
| 01a | Migration and canonical JSON | `/root/spec_01_registry/slice_01a` | Migration 034, canonical JSON/checksum utility, migration/canonical tests | `slice_01a_cleanroom_01`: `CLEAN` on first pass | `slice_01a_acceptance_01`: `CLEAN` | Accepted on exact 01a hashes |
| 01b | Repository and policy | `/root/spec_01_registry/slice_01b` | Repository, capability/filter policy, authorization boundary, CAS/effective state | Passes 1–3 found material authority defects; pass 4 `CLEAN`. Locale repair gate later `CLEAN` | `slice_01b_acceptance_01`: `CLEAN`; locale re-acceptance `slice_01b_locale_acceptance_01`: `CLEAN` | Accepted on repaired locale-stable hashes |
| 01c | Seeds and startup verification | `/root/spec_01_registry/slice_01c` | Literal schemas, validator, seed catalog/reconciliation, startup integration | Pass 1 found a combined-collision fail-open; pass 2 `CLEAN` | `slice_01c_acceptance_01`: `CLEAN` | Accepted on exact 01c hashes |

Slices ran serially with one writer active at a time. No later SPEC was implemented.

## Review and repair history

### Slice 01a

- Self-review repaired SQLite TEXT-primary-key nullability, duplicate JSON-key handling, exact UTF-8 checksum coverage, negative-zero normalization, and isolated single-connection SQLite test behavior.
- Builder reviewer `/root/spec_01_registry/slice_01a/slice_01a_cleanroom_01`: terminal `CLEAN`, first pass.
- Orchestrator reviewer `/root/spec_01_registry/slice_01a_acceptance_01`: terminal `CLEAN`, first pass.

### Slice 01b

- Builder pass 1 found and repaired:
  - locked-system owner/lock downgrade bypass;
  - broader historical grant scope leaking after a request was narrowed.
- Builder pass 2 found and repaired incomplete immutable binding of locked schema key, version, kind, and owner identity.
- Builder pass 3 found and repaired:
  - locked request mutation causing checksum deactivation;
  - historical no-longer-requested grants incorrectly deactivating the whole subscription.
- Builder pass 4: `/root/spec_01_registry/slice_01b/slice_01b_gate_pass_4`, terminal `CLEAN`.
- Initial orchestrator acceptance: `/root/spec_01_registry/slice_01b_acceptance_01`, terminal `CLEAN`.
- The first final SPEC review later found host-locale-dependent canonical ordering. The responsible 01b builder replaced every production registry `localeCompare` use with one ordinal comparator and added cross-locale Unicode regression coverage.
- Locale repair builder gate: `/root/spec_01_registry/slice_01b/slice_01b_locale_repair_gate`, terminal `CLEAN`.
- Locale repair orchestrator re-acceptance: `/root/spec_01_registry/slice_01b_locale_acceptance_01`, terminal `CLEAN`.

### Slice 01c

- Self-review repaired leading-parent-traversal path acceptance, deep-froze catalog definitions, and added stable-ID collision coverage.
- Builder pass 1 found that simultaneous stable-ID and semantic-key collisions only inactivated the ID row, permitting a semantic impostor to remain effective. Reconciliation now evaluates both collisions, diagnoses/inactivates both rows, leaves the other three seeds effective, and makes payload validation return `schema_inactive` for the impostor.
- Builder pass 2: `/root/spec_01_registry/slice_01c/slice_01c_gate_pass_2`, terminal `CLEAN`.
- Orchestrator acceptance: `/root/spec_01_registry/slice_01c_acceptance_01`, terminal `CLEAN`.

### Final SPEC integration

- Final reviewer pass 1 `/root/spec_01_registry/spec_01_final_integration_01` reported the locale-dependent canonical-ordering defect. Its fixable finding was routed forward as repair work; its terminal wording was not accepted as the SPEC disposition.
- After builder repair, fresh lower-gate review, orchestrator re-acceptance, and a repaired cumulative suite, final reviewer `/root/spec_01_registry/spec_01_final_integration_02` returned terminal `CLEAN` on the current 27-file work product.
- The final reviewer independently verified migration behavior, registry policy, authorization boundaries, exact schemas, reconciliation, startup order, locale variants, isolated bootstrap, forbidden surfaces, deviations, and current file identity.

### Completion-packet identity correction

- Supervisor review confirmed that all 27 reported per-file SHA-256 values matched current bytes, but the previously stated aggregate `2beec40761709b1b1cbe7b0225f336e8306eb33bd12af8f05aebd61eeaaf0477` did not match the exact ordered manifest serialization represented by this report.
- The unsupported aggregate claim was removed. The report now defines the serialization precisely and records its independently reproducible SHA-256 as `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`.
- This was a report-identity repair only. No implementation file, approved authority file, test, migration, dependency, or runtime behavior changed, so no implementation review or test result was invalidated.

### Lifecycle dispositions

- Every direct child builder and orchestrator-owned reviewer reached a terminal result before a sibling was spawned.
- Builders accounted for every builder-owned reviewer and confirmed their terminal results.
- No active writer/reviewer conflict remains.
- The runtime exposed no `close_agent` capability. Closure attempts were therefore unavailable and recorded as lifecycle evidence, not treated as a blocker.
- Review gates stopped after their first clean pass; non-clean passes were repaired and reviewed on fresh current bytes.

## Final verification evidence

Commands were run from `fusion-studio-server/` unless noted.

| Command/evidence | Final result |
|---|---|
| `npm test -- --runInBand test/event-registry` | 8 suites passed; 77 tests passed |
| `npm test -- --runInBand test/ledger/event-ledger.test.js` | 1 suite passed; 3 tests passed |
| `npm test -- --runInBand` | 86 suites passed; 749 passed, 1 skipped, 750 total |
| `npm run build` from `fusion-studio-client/` | Passed; TypeScript/Vite production build, 1,812 modules transformed |
| `npm ls ajv --depth=0` | `ajv@8.20.0` |
| `node --check` on changed JS modules/tests | Passed |
| `git diff --check` | Passed |
| Ordered 27-line manifest aggregate | `1d432d6613d0366140e3d26e6b9678ce0430f8f5be3f6615e564de99517b1356`; all 27 per-file checks returned `OK` |
| Production repository export smoke | Exact exports: `RegistryAuthorizationError`, `RegistryConflictError`, `createRegistryRepository` |
| Locale repair evidence | `en_US.UTF-8` and `sv_SE.UTF-8` produced identical repaired canonical checksum; no production `localeCompare` remains under `lib/event-registry` |
| Authorization adversarial evidence | Object, string, Symbol, null/omitted, and serialized lookalikes rejected; only exact test-fixture closure identity authorizes upward paths |
| Temporary-profile bootstrap | Temporary `fusion.db`; 4 schemas, 0 subscriptions, 0 grants, 4 effective schemas, 0 active subscriptions; narrow access only; temporary profile removed |
| Migration smoke | Migration 034 applied after 033; event ledger plus all three registry tables present; live developer DB untouched |

The final isolated bootstrap output reported:

```json
{
  "schemas": 4,
  "subscriptions": 0,
  "grants": 0,
  "effectiveSchemas": 4,
  "activeSubscriptions": 0,
  "access": [
    "getEffectiveState",
    "listSchemas",
    "listSubscriptions",
    "validatePayload"
  ]
}
```

The temporary database lived under a test-owned OS temporary directory and was removed. No developer/project `fusion.db`, normal Application Support profile, existing server, watcher, or workspace content was used. Raw command results are recorded in the orchestration/reviewer transcripts and summarized above; no persistent raw-log artifact was created.

Known non-failing output:

- Jest/Node warning: `--localstorage-file` was provided without a valid path.
- Existing Node `DEP0190` child-process shell warning.
- Client build warnings for the existing `gray-matter` eval use and large output chunks.
- The single existing skip is the harness compatibility case at `test/harness/compat.test.js:194`.

## Exact current changed-file manifest

```text
f87ed11164161e4fcff1f0f510468ec0164bae55af1fd1a350f16be34e1f859e  fusion-studio-server/lib/db/migrations/034_event_registry_authority.js
c394a9b6568f16246f79ba073a2386f26d2dce53079f2379f15b8b99940bbad4  fusion-studio-server/lib/event-registry/canonical-json.js
7e116fadcf4b3846e6a35375783709a8b1abf56fcae022d262212c29622caf3d  fusion-studio-server/lib/event-registry/capability-catalog.js
7d4e3445b8f3790d759202a2c7cbe13ebb6c8e216cccbdf5069e6eb2f2c80f43  fusion-studio-server/lib/event-registry/filter.js
08a07db817d45ec7b6b4c73f2e12e67afaca484f077f13fad0b4e1189feb3d7c  fusion-studio-server/lib/event-registry/index.js
d1518594446b37e0f39fb273806e46d0c4717ad8bf06879411eb15f6799dcff7  fusion-studio-server/lib/event-registry/ordinal.js
edc7bccebfcae09928106d30fe66f70ec72948e209ee43cc74245690b72e0e1c  fusion-studio-server/lib/event-registry/policy.js
9757c1fa7d8941113b711fbd6bbf035cabc3cd056da633169ff64f3358af0376  fusion-studio-server/lib/event-registry/reconcile.js
6dee7b6e2a71b30db2a89d691c55718a0dea3c24bde31f4936ec67e22e2858c3  fusion-studio-server/lib/event-registry/repository.js
e3973db3a37e96a142b2b1a373868d55935645d82119ec4e550b1eb87bf2c3ee  fusion-studio-server/lib/event-registry/schema-validator.js
c3db8e44ca200c2b1bd2b35d8a89e3d061dbd683c1cc9e9b79db91720718aa1e  fusion-studio-server/lib/event-registry/schemas/file-command-accepted-v1.json
1891de528b79bc34666f4b17c5e0ff8c2a4492c783c042f4aecc02837fc9a3a2  fusion-studio-server/lib/event-registry/schemas/resource-changed-v1.json
6a41854349b8ac5744e71e5c8457b744ce32578874da50bba56146898cb85902  fusion-studio-server/lib/event-registry/schemas/resource-mutated-v1.json
edaf1593d9495b0b61439647563ecf7a473804d471e90016379f8dab77229469  fusion-studio-server/lib/event-registry/schemas/resource-refresh-required-v1.json
bd1c010dc7aad4520af03d64485baba8fe2bfdec9074b3b53b6824dfb7192606  fusion-studio-server/lib/event-registry/seed-catalog.js
5a80c08a6d04ccdb75cbe889faa3c84e395baaf327da9e1bc3ef5b130033d6cb  fusion-studio-server/lib/startup.js
18f85fbfb208697f2821add277ec59441e7981f76983fc384709b7822baf49a1  fusion-studio-server/package-lock.json
270905edc53baeb6b1353fa9d53a02754b4538fc1da859685839472824aa801b  fusion-studio-server/package.json
cc39f5c7e5fc8f1802a1f95e31289f2aa6c342bea00759fb75a507ae3342fc67  fusion-studio-server/test/event-registry/canonical-json.test.js
010bf8926d56ffc20695a6d7b79e83c731e51848322c60862cd3c60666193f4a  fusion-studio-server/test/event-registry/filter-and-capabilities.test.js
d153392b31a0fff710424e1903ac331f54cf11e00bb97360dd286ca81cc786a1  fusion-studio-server/test/event-registry/fixtures/test-only-authorized-repository.js
21c8abaef6db2d93571120e137c7e22fbb695a06a9a6dd7a16d6d81def5ce452  fusion-studio-server/test/event-registry/migration.test.js
1616a39d9f50dc6184e71c3faa6f613e480e119087ae110da702e40e8db7c544  fusion-studio-server/test/event-registry/ordinal-ordering.test.js
33d210f853810640308eb5a94248cc32a48d867d8952f71ee0f08b68ce11fc30  fusion-studio-server/test/event-registry/repository.test.js
378465f10ebb7a0c229032541cfca0bc202a2d22368092da1cef6d8921cd5df1  fusion-studio-server/test/event-registry/schema-validation.test.js
1d0fb78c1a414ab2cf42e826b07dfb6425a15b57ac15647347bf9f5b14eb8c86  fusion-studio-server/test/event-registry/seed-reconciliation.test.js
ddf548ab13e3b5f8803a68fb6c6fb9621ff3f319c4074094c3ec2f4e488a4ad2  fusion-studio-server/test/event-registry/startup-integration.test.js
```

No client product-source file changed. The implementation report itself is outside the product manifest above.

## Deviation and out-of-scope accounting

### D-01 — Locked system definition envelopes remain immutable

- Original contract: configuration may revoke or narrow authority, while locked shipped rows remain checksum-verified and application-locked.
- Actual change: unlocked extension definitions may narrow requests and filters. Locked definitions reject envelope edits; their authority is reduced through `narrowCapabilityGrant`, `revokeCapability`, disable, quarantine, or revoke.
- Reason: blessing a changed locked checksum would make shipped integrity host/runtime-dependent and fail restart verification. No approved table exists for a separate granular filter override.
- Files: `repository.js`, `policy.js`, repository tests.
- Tests: locked edit rejection, grant-scope narrowing, revocation, lifecycle containment, and reconstructed repository persistence.
- Observable effect: locked capability/scope and whole-handler authority can be reduced; granular locked-filter rewriting is unavailable in this MVP.
- Risk: a future Systems feature requiring granular locked-filter overrides needs a separately modeled, checksummed, subtractive overlay.
- Downstream impact: no effect on the fixed SPEC-02/03/04 subscriber fixtures. Future Systems/configuration work must not rewrite shipped envelopes.
- Classification: `accepted` security integration; future overlay is `downstream_impact` only.

### D-02 — Ajv production dependency

- Original contract: check in and validate literal JSON Schema 2020-12 documents.
- Actual change: added `ajv@8.20.0` and its lockfile entries.
- Reason: use maintained Draft 2020-12 validation instead of an incomplete generic homegrown validator.
- Files: `package.json`, `package-lock.json`, `schema-validator.js`, schema validation tests.
- Tests: schema compilation plus valid/invalid fixtures for all four documents.
- Observable effect: structural JSON Schema validation is real and reusable.
- Risk: added dependency and package-audit surface. `npm install` reported 14 repository audit findings; they were not individually remediated in this SPEC.
- Downstream impact: SPEC-02 can reuse the validated schema authority.
- Classification: `accepted` required integration.

### D-03 — Bounded accepted-01b policy/repository integration

- Original contract: invalid/colliding schemas remain runtime-inactive and subscription reference resolution fails closed.
- Actual change: `policy.js`/`repository.js` accept an injected schema-definition validator and per-schema collision diagnostics.
- Reason: collision and invalid-definition state must participate in the same effective-state calculation used by later subscription compilation.
- Files: `policy.js`, `repository.js`, reconciliation/schema tests.
- Tests: malformed schema, checksum/identity drift, semantic/stable/simultaneous collisions, and inactive schema references.
- Observable effect: only affected rows become inactive; no lifecycle state is rewritten and no authority is widened.
- Risk: callers constructing the repository must supply complete trusted descriptors/diagnostics when they own locked seeds.
- Downstream impact: SPEC-02 receives accurate active-schema state.
- Classification: `accepted` required security integration.

### D-04 — Awaited startup integration

- Original contract: registry authority starts after migrations and before facts, handlers, subscribers, watchers, public sockets, or listening.
- Actual change: `startup.js` awaits `initializeEventRegistry(getDb())` immediately after `initDb()`.
- Reason: prevent an unsafe partially initialized authority surface.
- Files: `startup.js`, `event-registry/index.js`, startup tests.
- Tests: source-order integration test and isolated bootstrap smoke.
- Observable effect: row-local data corruption logs diagnostics and startup continues; registry infrastructure failure remains startup-fatal.
- Risk: an actual registry infrastructure failure now stops startup, which is the intended fail-closed behavior.
- Downstream impact: establishes the initialization point SPEC-02 will extend.
- Classification: `accepted` required integration.

### D-05 — Shared ordinal canonical-order utility

- Original contract: canonical arrays and checksums must be deterministic.
- Actual change: added `ordinal.js` and `ordinal-ordering.test.js`; filter, schema-reference, and requested-capability sorting use locale-independent code-unit comparison.
- Reason: final review reproduced different canonical checksums under `en-US` and `sv-SE` when `localeCompare` was used.
- Files: `ordinal.js`, `filter.js`, `policy.js`, `capability-catalog.js`, ordinal tests.
- Tests: cross-locale Unicode panel/schema-reference evidence, capability order, focused registry suite, and full server suite.
- Observable effect: canonical envelopes and checksums remain stable across host locales.
- Risk: none beyond consumers receiving the now-deterministic order required by the SPEC.
- Downstream impact: positive; later compiled subscription definitions are portable across hosts/locales.
- Classification: `accepted` required repair/integration.

No other design, sequencing, expected-file, or out-of-scope deviation was found. No compatibility adapter or temporary bridge was introduced.

## Residual risks, skipped checks, and temporary adapters

- Governed publisher minting, subscription generation compilation, delivery, required-ack timing, and handler runtime are intentionally deferred to SPEC-02.
- Production ledger and renderer handlers/subscriptions/grants remain absent by design and must be added atomically by SPEC-03 and SPEC-04.
- A future granular locked-filter override needs the separately reviewed subtractive overlay described in D-01.
- Ajv adds normal dependency and audit maintenance surface; the broader reported package audit findings remain outside this SPEC.
- Live `node server.js`, Electron launch, and browser/manual UI checks were not run because they would start unrelated watchers/adapters and this SPEC has no UI behavior. They were replaced by an isolated production-style database/registry bootstrap. The required client production build did run and passed.
- No Alpha pull/build/install/restart was authorized or performed.
- Temporary adapters: none.

## Downstream assessment

- SPEC-02: `compatible deviation`. It can consume the narrow initialized read/validation surface, complete locked descriptors, stable canonical envelopes, deterministic ordering, and active-schema diagnostics. It must not add a production authorization minter or reinterpret nonfatal historical-grant diagnostics as authority.
- SPEC-03: `none` beyond using the accepted fixed ledger capability/filter/schema contracts and adding its handler/subscription/grants atomically.
- SPEC-04: `none` beyond using the accepted fixed renderer capability/filter/schema contracts and adding its handler/subscription/grants atomically.
- Future Systems/configuration work: `requires downstream correction` only if it needs granular locked-filter overrides; implement a subtractive overlay rather than rewriting shipped locked definitions.
- Owner ruling required: none.

SPEC_READY_FOR_SUPERVISOR_REVIEW
