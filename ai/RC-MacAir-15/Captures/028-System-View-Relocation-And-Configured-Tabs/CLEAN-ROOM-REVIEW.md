# Clean-Room Review Ledger

**Candidate:** `VIEW-PLATFORM-15c57f9457d64a13`  
**Scope:** all normative files listed in `RELEASE-MANIFEST.md`  
**Owner authorization:** review may exceed the default three passes and continue
until the first clean independent verdict, subject to anti-spiral rules.

## Review contract

Each pass uses a fresh read-only reviewer with no inherited parent findings.
The reviewer reads the candidate, cited owner decisions, routed code standards,
accepted prerequisite reports, and active code needed to test feasibility.

A material finding is one that could cause data loss, authority bypass,
identity ambiguity, unrecoverable/incorrect migration, contract conflict,
incorrect product behavior, unverifiable acceptance, or a misleading claim of
completion. Editorial preference alone is not material.

## Primary audit

Completed 2026-09-07 before independent dispatch.

Material conflicts found and repaired:

1. D-169 still placed relocation after Chat. D-174 now explicitly supersedes
   only that sequencing clause while preserving D-169's domain split.
2. Treating `file.open` as a descriptor-producing launcher would leave its
   Empty tab reserved, forcing TABS-03 to append the selected file. The candidate
   now distinguishes component choices from shell actions and defines an exact,
   stale-safe action-completion transition that releases the reservation while
   preserving the Empty tab.
3. The config transport was underspecified against active code, where
   `panel_config` currently carries roots while legacy panel discovery reads raw
   capsule files. VIEW-02 now defines a normalized `tabPolicies` projection on
   the existing message and forbids renderer reinterpretation of raw disk JSON.
4. The trusted-shell prerequisite fingerprint was abbreviated. The manifest now
   records the full accepted 195-path manifest digest.

Validation after repair:

- normative aggregate reproduced as
  `360bf0d205ebd83ae306953d5c4f23a197c0e3e2856b2e8cd35580de68450ad7`;
- `git diff --check` passed;
- every normative artifact is below 400 lines;
- no known blocking owner decision remains unresolved.

## Independent passes

### Pass 1 — repair required

- **Reviewer:** `/root/view_platform_clean_room_1`
- **Candidate:** `VIEW-PLATFORM-360bf0d205ebd83a`
- **Lifecycle:** fresh read-only reviewer; completion reported; explicit close
  operation unavailable in this tool environment
- **Verdict:** `REPAIR_REQUIRED`
- **Validated material findings:**
  1. view IDs lacked one canonical grammar/equality rule;
  2. `file.open` released its waiting-tab correlation before file selection;
  3. capsule-root aliases `selected-folder` without a path, `sqlite`, and `none`
     were incorrectly described as fixed external roots;
  4. trusted-shell and integrated PROV fingerprints were not reproducible from
     the cited evidence as instructed.
- **Repairs:** added an exact 1–128 byte lowercase ASCII hyphenated view-ID
  grammar and shared-parser requirement; retained picker reservation and added
  a serialized exact-destination preparation handoff into TABS-03; corrected
  content-root classifications; added immutable commit/ledger reconstruction
  commands with tracked authority and expected hashes.
- **Resulting candidate:** `VIEW-PLATFORM-93caa32d6b5d1566`

### Pass 2 — repair required

- **Reviewer:** `/root/view_platform_clean_room_2`
- **Candidate:** `VIEW-PLATFORM-93caa32d6b5d1566`
- **Lifecycle:** fresh read-only reviewer; completion reported; explicit close
  operation unavailable in this tool environment
- **Verdict:** `REPAIR_REQUIRED`
- **Validated material findings:**
  1. external-looking declarations and absolute symlinks could still depend on
     the retiring tree and break after relocation;
  2. multiple pending `file.open` reservations had no owner for the singleton
     File drawer;
  3. classic zero-tab Capture state could be mistaken for first initialization;
  4. free-string validation limits were not exact enough for independent tests.
- **Repairs:** added source/projected-root validation and a repair condition for
  relocation-dependent roots/links; established one exact File-picker context
  with atomic replacement and retirement; required one-time classic Capture
  conversion before initial policy; fixed UTF-8/count/whitespace/control limits
  and boundary tests.
- **Resulting candidate:** `VIEW-PLATFORM-1be178ecd97d89f1`

### Pass 3 — repair required

- **Reviewer:** `/root/view_platform_clean_room_3`
- **Candidate:** `VIEW-PLATFORM-1be178ecd97d89f1`
- **Lifecycle:** fresh read-only reviewer; completion reported; explicit close
  operation unavailable in this tool environment
- **Verdict:** `REPAIR_REQUIRED`
- **Validated material finding:** free-string validation allowed lone Unicode
  surrogates even though the accepted renderer presentation contract rejects
  them, allowing a server-ready policy to become an inert invalid shell.
- **Repair:** required well-formed Unicode before UTF-8 counting and added lone
  high/low-surrogate rejection plus valid-pair acceptance tests.
- **Resulting candidate:** `VIEW-PLATFORM-5f2100a73ef4e122`

### Pass 4 — repair required

- **Reviewer:** `/root/view_platform_clean_room_4`
- **Candidate:** `VIEW-PLATFORM-5f2100a73ef4e122`
- **Lifecycle:** fresh read-only reviewer; completion reported; explicit close
  operation unavailable in this tool environment
- **Verdict:** `REPAIR_REQUIRED`
- **Validated material finding:** the Electron `fusion-studio:` protocol still
  resolves custom/local HTML views through unscoped `ai/views/<viewId>` and was
  missing from the relocation inventory and acceptance path.
- **Repair:** added Electron as an active VIEW-01 owner; defined a
  readiness-verified server view-ID/folder-basename map forwarded through
  authorized IPC with no renderer-supplied capsule/file path; required Electron
  derivation and manifest/containment verification under `System/Views`, atomic
  map retirement across workspace/runtime changes, and a custom-app
  relocation/restart/switch/traversal fixture.
- **Resulting candidate:** `VIEW-PLATFORM-dfdc1d2889febfc7`

### Pass 5 — repair required

- **Reviewer:** `/root/view_platform_clean_room_5`
- **Candidate:** `VIEW-PLATFORM-dfdc1d2889febfc7`
- **Lifecycle:** fresh read-only reviewer; completion reported; explicit close
  operation unavailable in this tool environment
- **Verdict:** `REPAIR_REQUIRED`
- **Validated material findings:**
  1. exact historical tree-byte digest validation after `verified` would reject
     legitimate state and registry writes on the next restart;
  2. Electron's custom-app capsule map had no mandatory refresh after a registry
     mutation changed a folder basename.
- **Repairs:** limited digest comparison to `planned`/`moved` recovery and made
  verified restart check stable root identity plus current canonical manifests;
  required the same server projection on every successful existing registry
  update, fan-out to bound clients, authorized atomic Electron map replacement
  before refreshed interaction, and immediate post-reorder/add custom-app tests.
- **Resulting candidate:** `VIEW-PLATFORM-15c57f9457d64a13`

### Pass 6 — clean

- **Reviewer:** `/root/view_platform_clean_room_6`
- **Candidate:** `VIEW-PLATFORM-15c57f9457d64a13`
- **Lifecycle:** fresh read-only reviewer; completion reported; explicit close
  operation unavailable in this tool environment
- **Verdict:** `CLEAN`
- **Material findings:** none
- **Action:** stopped at the first clean independent verdict, as required.

## Final verdict

`CLEAN`

The exact candidate `VIEW-PLATFORM-15c57f9457d64a13` is ready for owner
approval. This verdict validates the planning packet only; it does not authorize
VIEW-01 implementation, VIEW-02 implementation, Bridge, Chat, Side Chat, or
plug-in work.
