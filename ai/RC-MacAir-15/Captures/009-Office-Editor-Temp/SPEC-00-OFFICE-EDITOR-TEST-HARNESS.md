# SPEC-00 — Isolated Office Editor Test Harness

**Domain:** Test isolation and reusable Office browser smoke infrastructure  
**Depends on:** None

## Objective

Create a deterministic, self-cleaning Office-enabled test workspace and Playwright runner so every later SPEC can exercise the real React Office editor without reading or mutating the developer's live workspace, database, or Office files.

## Authority and Current Constraints

- Root repository guidance: `AGENTS.md`.
- Playwright currently uses `playwright.config.ts`, port 3001, the normal server database, and whichever workspace is active.
- The current `fs-dev` workspace has no active Office view/Office data root, so it is not a valid Office smoke fixture.
- `FUSION_APP_USER_DATA` relocates `fusion.db`; `FUSION_LOCAL_MACHINE` controls the machine-scoped `ai/<machine>` root; `PORT` is configurable.
- Office view templates and manifests are under `System_Manager/ai-template/templates/view-templates/003-office-viewer/`; active rendering is React `OfficeGrid`, not the legacy iframe placeholder.

## Required Result

One browser command must build/use the client, create isolated temporary user data and workspace roots, seed one active Office-enabled workspace, start the server on a non-production test port, run a smoke through the actual Office UI, and clean up even after failure. A companion manual launcher must apply the same isolation contract to every later Electron smoke.

The runner must not depend on an existing `fusion.db`, workspace registry row, view state, port-3001 process, or developer Office content.

## Vertical Slices

### Slice 00.1 — Isolated workspace and registry seed

Create reusable fixture utilities that:

1. allocate unique temporary `FUSION_APP_USER_DATA` and workspace roots;
2. set `FUSION_LOCAL_MACHINE` to exactly `Office-E2E`;
3. create the supported minimum workspace structure and an enabled Office view using current template/manifest contracts;
4. create `ai/Office-E2E/Office/001-Fixtures/Basic Tables.md` with two uniquely identifiable Markdown tables and valid frontmatter;
5. initialize the isolated database, register only the fixture workspace, and set it active through supported database/workspace services rather than copying a developer database; and
6. expose paths to tests without exposing a production filesystem path to browser code.

**Slice gate:** a Node-side fixture test proves the registry, machine root, Office manifest/root, and document exist under the temporary root and that no resolved path is inside `/Users/rccurtrightjr./projects/fs-dev/ai` or the normal server `data/` directory.

### Slice 00.2 — Dedicated Playwright runner

Add a dedicated Office Playwright configuration and lifecycle wrapper. It must:

- build/serve the normal client bundle;
- launch the server with the isolated environment on a configurable unused port;
- serialize Office mutation tests with one worker;
- wait on the actual server readiness URL rather than a fixed sleep;
- capture trace/screenshot only on failure;
- terminate child processes; and
- delete temporary roots in global teardown, with the exact opt-in debug retention contract below.

Add `e2e/office/run-isolated-electron.mjs`, which reuses that lifecycle to seed the fixture, accepts `--workspaces=1|2|3` (default 1), `--relaunches=N` (default 1), and `--copies=N` (integer 1–32, default 1), launches `npm run electron:dev` with isolated `FUSION_APP_USER_DATA`/`FUSION_LOCAL_MACHINE` and only those fixture workspaces registered, and reuses the same fixture/database across requested relaunches before cleanup. It prints only safe fixture identifiers/paths and cleans up after the final Electron exit or any interrupt. Later SPECs use this launcher, never bare Electron against normal user data.

Debug retention is controlled only by environment variable `FUSION_OFFICE_E2E_RETAIN=1`; missing or any other value is off. With exact `1`, after an orderly child shutdown or an assertion failure the lifecycle still stops/waits for every process and restores captured permissions, then retains only its isolated fixture/user-data roots and prints exactly `OFFICE_E2E_RETAINED_ROOT=<absolute-root>`. It never retains after setup/path-safety failure, SIGINT, or SIGTERM, and never retains a live process/watcher. This environment switch applies equally to Playwright lifecycle and the isolated Electron launcher; no undocumented CLI retention flag exists. Default automated acceptance runs without it and must leave no root.

Add a JavaScript/MJS block to `eslint.config.js` scoped to `eslint.config.js` and `e2e/office/**/*.mjs`, using `@eslint/js` recommended rules, ESM/latest ECMAScript, and Node globals. The exact lint command below must lint rather than ignore the config or any lifecycle/launcher helper.

Add a deterministic, extensible scenario catalog in `e2e/office/fixture-scenarios.mjs`. The launcher accepts `--scenario=<id>`, optional `--variant=<id>`, and `--copies=N`; unknown/duplicate option names, unknown IDs/variants, and malformed/out-of-range counts fail before fixture allocation. SPEC-00 registers only foundation IDs `basic`, `structure`, `color-integrity`, `geometry`, `palette`, `table-lifecycle`, and `overflow`. Its initial `palette` variants are `valid`, `malformed-cold`, `malformed-after-valid`, `read-only`, `contributor-read-failure`, and `destination-write-failure`; none encodes a member cap. Later accepted packets extend the same catalog from their own self-contained oracle: SPEC-01 adds structure variant `metadata`; SPEC-04 adds read-only `over-20-read` and `file-too-large`; SPEC-05 adds mutation `over-20-external`, `all-missing-first-add`, and `remove-partial`; SPEC-08 adds `title-row`; SPEC-09 adds `borders`; SPEC-10 adds `alignment` plus `full`; SPEC-11 adds `presentation-output`. Each registered definition is immutable within that accepted revision. Under the exact copy rule below, generated copies differ only in filename, frontmatter `name`, `fixtureCopy`, and the fixture file ID derived from them; every other document byte is identical. Browser setup uses the same catalog and recreates a scenario from its definition between tests.

### Canonical decision-neutral fixture manifest

Workspace IDs are exactly `office-e2e-a`, `office-e2e-b`, and `office-e2e-c`, displayed as A/B/C, with roots `<fixture-root>/workspace-a|b|c`. Seed registry rows in that exact order with labels `Office E2E A|B|C`, icon `description`, descriptions `Isolated Office fixture A|B|C`, `sortOrder` and `ribbonSortOrder` `0|1|2`, `ribbonVisible: true`, and type `code`. `--workspaces=1` registers A, `2` registers A then B, and `3` registers A then B then C. `registry-service.list()` must return that order, `last_active_workspace_id` is exactly `office-e2e-a`, and A is active on every initial launch/relaunch; B/C begin inactive. Each document path is `ai/Office-E2E/Office/001-Fixtures/<filename>` inside its assigned workspace. A scenario creates only the files listed for it.

Every fixture document is UTF-8 without BOM, uses LF, and ends with one LF. It uses this exact frontmatter key order and quoting:

```yaml
---
name: '<filename without .md>'
description: 'Office E2E <scenario>/<case>'
metadata:
  fixtureScenario: '<scenario>'
  fixtureCase: '<case>'
  fixtureCopy: <1-based integer>
  preserveUnknown: 'keep-me'
  # scenario-specific keys below, in the order shown in this manifest
---
```

After the closing delimiter, emit `Before <case>.`, a blank line, every declared table separated by one blank line, `After <case>.`, and the final LF. A table descriptor `(id, headerId, R, C)` has exactly R physical rows including the header. Its Markdown is:

```text
## <id>

| <headerId>-h0 | ... | <headerId>-h(C-1) |
| --- | ... | --- |
| <id>-r1c0 | ... | <id>-r1c(C-1) |
...
| <id>-r(R-1)c0 | ... | <id>-r(R-1)c(C-1) |
```

No alignment colons or inline HTML appear unless an override below says so. `--copies=1` writes the listed filename with `fixtureCopy: 1`. For N > 1, each listed `.md` becomes `--copy-01.md` through `--copy-NN.md`; only `name`, `fixtureCopy`, filename, and the fixture file ID derived from them differ. N applies to every document template, never to workspace registrations or config files.

| Scenario | Case / filename / workspace | Exact tables and cell overrides | Exact renderer metadata fragment |
|---|---|---|---|
| `basic` | `basic` / `Basic Tables.md` / A | `(basic-a,basic-a,2,2)`; `(basic-b,basic-b,2,2)` | none |
| `structure` | `structure-r2-c1` / `Structure-R2-C1.md` / A | `(structure-r2-c1,structure-r2-c1,2,1)` | none |
|  | `structure-r3-c2` / `Structure-R3-C2.md` / A | `(structure-r3-c2,structure-r3-c2,3,2)` | none |
|  | `structure-r5-c4` / `Structure-R5-C4.md` / A | `(structure-r5-c4,structure-r5-c4,5,4)` | none |
| `color-integrity` | `color-integrity` / `Color Integrity.md` / A | `(color-a,duplicate-header,3,3)`; `(color-b,duplicate-header,3,3)` | exact block C below |
| `geometry` | `geometry-one` / `Geometry-One.md` / A | `(geometry-one,geometry-one,2,1)` | `tables[0] = { tableIndex: 0, fingerprint: 'fixture-geometry-one', columns: [120] }` |
|  | `geometry-three` / `Geometry-Three.md` / A | `(geometry-three,geometry-three,3,3)` | `tables[0] = { tableIndex: 0, fingerprint: 'fixture-geometry-three', columns: [120,120,120] }` |
|  | `geometry-four` / `Geometry-Four.md` / A | `(geometry-four,geometry-four,3,4)` | `tables[0] = { tableIndex: 0, fingerprint: 'fixture-geometry-four', columns: [90,110,130,150] }` |
|  | `geometry-long` / `Geometry-Long-Minimum.md` / A | `(geometry-long,geometry-long,2,2)`; override `r1c0` with exactly 64 `M` characters | `tables[0] = { tableIndex: 0, fingerprint: 'fixture-geometry-long', columns: [180,180] }` |
|  | `geometry-keyless` / `Geometry-Keyless.md` / A | `(geometry-keyless,geometry-keyless,2,3)` | none |
| `palette` | `palette-a|b|c` / `Palette-A|B|C.md` / matching A/B/C | one `(palette-x,palette-x,2,2)` per workspace | none; config bytes below |
| `table-lifecycle` | `table-lifecycle` / `Table Lifecycle.md` / A | `(life-a,life-a,2,2)`; `(life-b,life-b,3,2)`; `(life-c,life-c,2,2)` | exact block L below |
| `overflow` | `overflow` / `Overflow.md` / A | `(overflow-a,overflow-a,2,2)`; `(overflow-b,overflow-b,2,2)`; override `overflow-a-r1c0` with `FirstLineSegmentABCDEFGHIJ<br>SecondLineSegmentKLMNOPQRST`; override `overflow-b-r1c1` with `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` | exact block O below |

The 64-character override is exactly `MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM`.

Block C is exact YAML under `metadata` after `preserveUnknown`:

```yaml
  tableColors:
    - tableIndex: 0
      fingerprint: 'fixture-duplicate'
      cells: { '0,0': '#ff0000', '1,1': '#00ff00', '2,2': '#0000ff' }
      rows: { '1': { color: '#ffeeaa', rank: 4 }, '2': { color: '#aaddff', rank: 7 } }
      columns: { '0': { color: '#ffccdd', rank: 3 }, '1': { color: '#ccffdd', rank: 7 } }
    - tableIndex: 1
      fingerprint: 'fixture-duplicate'
      cells: { '0,1': '#663399', '1,0': '#008080', '2,2': '#ff8c00' }
      rows: { '0': { color: '#f0e68c', rank: 5 } }
      columns: { '2': { color: '#add8e6', rank: 5 } }
```

The unmasked second-table intersection at row 0/column 2 is the equal-rank fixture and must resolve to the row color `#f0e68c`, never the column color.

Geometry fragments use the same expanded YAML field order as their object notation above. Block L is:

```yaml
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-life-a', columns: [100, 140] }
    - { tableIndex: 1, fingerprint: 'fixture-life-b', columns: [120, 160] }
    - { tableIndex: 2, fingerprint: 'fixture-life-c', columns: [140, 180] }
  tableColors:
    - { tableIndex: 0, fingerprint: 'fixture-life-a', cells: { '0,0': '#aa0000' } }
    - { tableIndex: 1, fingerprint: 'fixture-life-b', cells: { '0,0': '#00aa00' } }
    - { tableIndex: 2, fingerprint: 'fixture-life-c', cells: { '0,0': '#0000aa' } }
  tableStyles:
    - { tableIndex: 0, fingerprint: 'fixture-life-a', fixtureSeed: 'keep-style-0' }
    - { tableIndex: 1, fingerprint: 'fixture-life-b', fixtureSeed: 'keep-style-1' }
    - { tableIndex: 2, fingerprint: 'fixture-life-c', fixtureSeed: 'keep-style-2' }
```

Block O is:

```yaml
  tables:
    - { tableIndex: 0, fingerprint: 'fixture-overflow-a', columns: [96, 96] }
    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', columns: [96, 96] }
  tableStyles:
    - { tableIndex: 1, fingerprint: 'fixture-overflow-b', tableOverflow: 'truncate', fixtureSeed: 'keep-overflow' }
```

The first table is deliberately style-keyless and therefore exercises the default `overflow` mode. Both tables are geometry-constrained to two 96-pixel columns. The `<br>` bytes are intentional canonical semantic-break fixture input; SPEC-00 only seeds them and does not assert their later presentation. After SPEC-07 accepts its narrow table-cell break codec, the explicit-break cell's single-line rendered text is exactly `FirstLineSegmentABCDEFGHIJ SecondLineSegmentKLMNOPQRST`; the one visual space comes from its stable hardbreak node view and scoped CSS, not a document mutation.

### Canonical palette bytes and fault phases

The `valid` variant creates all three configs with the exact canonical serializer later owned by SPEC-04: UTF-8, no BOM, two-space JSON indentation, LF, one final LF, `custom_colors` first and `sync_enabled` second. A/B/C contain exactly one color—`#aa0001`, `#00bb02`, and `#000cc3` respectively—and false. For example A's complete bytes are:

```json
{
  "custom_colors": [
    "#aa0001"
  ],
  "sync_enabled": false
}
```

B and C are byte-identical except for their exact one color. The synced A/B starting bytes used by both sync-failure variants are exactly:

```json
{
  "custom_colors": [
    "#aa0001",
    "#00bb02"
  ],
  "sync_enabled": true
}
```

C retains its one-color false bytes. The failure variants use these deterministic phases:

| Variant | Initial state and failing workspace | Trigger / required observation | Recovery and cleanup |
|---|---|---|---|
| `malformed-cold` | Before server launch, A contains exactly the UTF-8 bytes `{"custom_colors":[` with no trailing LF; B/C are valid. | Cold read of A reports unavailable and performs zero writes. | Atomically replace A with its canonical valid bytes; wait for ready. |
| `malformed-after-valid` | Start from `valid`; wait until A is confirmed ready. | Atomically replace A with exactly `{"custom_colors":[`; observe degraded last-known-good and zero service writes. | Atomically restore A's canonical valid bytes; wait for ready. |
| `read-only` | Start from `valid`; capture A config-directory mode, then set that directory to `0555` before the mutation. | Add `#123456` in A; observe `READ_ONLY`, unchanged file bytes, and no table color application. | Restore the captured mode, retry the add, require success, then restore mode again in `finally`. |
| `contributor-read-failure` | A and B start with the exact synced bytes above; C is valid false. After initial `ok`, capture B file mode and set it to `0000`. | Atomically replace A with canonical bytes whose array is `['#aa0001','#00bb02','#123456']` in that order and true; B read fails, all service writes are zero, and A/B report degraded with B's workspace ID only. | Restore B's captured mode and atomically rewrite its prior canonical bytes to trigger reconciliation; require convergence. |
| `destination-write-failure` | Same synced A/B and false C state; capture B config-directory mode and set it to `0555` after initial `ok`. | Add `#123456` through A; B is the sole failed destination, successful writes remain, and the set is degraded without a temp-file leak. | Restore B's captured directory mode and atomically rewrite B's current canonical bytes to trigger retry; require convergence. |

Permission variants are supported only when the fixture proves the server runs as a non-root UID and a preflight write/read probe fails with the expected permission error. Otherwise the test fails closed as unsupported; it may not silently skip. Teardown always restores every captured mode before cleanup or an allowed debug-retention handoff, including after SIGINT, SIGTERM, or assertion failure. Atomic external replacement always means same-directory temp write/fsync/rename under the temporary fixture root.

SPEC-00 must not register or assert title-row, Border, Alignment, output-presentation, default-on synchronization, removal, or first-20 UI behavior. Their owning packet defines and tests its exact catalog extension.

Do not alter the default Playwright config's behavior for unrelated suites.

**Slice gate:** deliberate test failure still stops the server and removes the fixture unless debug retention is explicitly enabled. Subprocess tests run the launcher's test-only lifecycle probe, send SIGINT and SIGTERM in separate cases, and pass only after the launcher and its child sentinel exit and all temporary roots are gone.

### Slice 00.3 — Real Office open/edit/readback smoke

Add `e2e/office-harness.spec.ts` that:

1. opens the app and verifies the fixture workspace is the only active workspace;
2. opens Office and the deterministic fixture document;
3. asserts the real Crepe editor and both tables are visible;
4. makes a harmless unique text edit, waits for the normal save response, and verifies the isolated disk file contains it; and
5. restores/recreates the fixture so repeated runs start identically.

**Slice gate:** two consecutive runs pass and neither run changes tracked repository content or the normal database.

## Expected Changed Areas

- `fusion-studio-client/playwright.office.config.ts` (new)
- `fusion-studio-client/e2e/office/fixture-lifecycle.mjs` and Office global setup/teardown helpers (new)
- `fusion-studio-client/e2e/office/fixture-lifecycle.test.mjs` (new)
- `fusion-studio-client/e2e/office/fixture-scenarios.mjs` (new)
- `fusion-studio-client/e2e/office/run-isolated-electron.mjs` (new)
- `fusion-studio-client/e2e/office-harness.spec.ts` (new)
- `fusion-studio-client/package.json` only if a named convenience script is added; existing scripts must remain compatible
- `fusion-studio-client/eslint.config.js` for the narrowly scoped Node/MJS block

Production UI behavior is not in scope. Test-only production branches, hard-coded developer paths, and committed runtime fixture databases are forbidden.

## Acceptance Criteria

- The test process owns every file, database, and server process it mutates.
- Test setup fails closed if any target resolves inside the live workspace `ai/` tree or normal `fusion-studio-server/data`.
- Office is provisioned through current V2 workspace/view contracts.
- The smoke reaches active React `OfficeGrid`/`OfficeDocumentPage`, not a static placeholder.
- Setup and teardown are idempotent and safe under an interrupted/failed test.
- The reusable Electron launcher proves the same environment/registry/path isolation and cleans up on normal exit and interrupt.
- Every required scenario/copy is deterministic and resettable from the shared immutable catalog.
- No fixed sleep is the sole readiness condition.
- No versioning or provenance file/module is touched.

## Exact Validation

From `fusion-studio-client/`:

```bash
npm run build
npx eslint eslint.config.js playwright.office.config.ts e2e/office/fixture-lifecycle.mjs e2e/office/fixture-lifecycle.test.mjs e2e/office/fixture-scenarios.mjs e2e/office/global-setup.mjs e2e/office/global-teardown.mjs e2e/office/run-isolated-electron.mjs e2e/office-harness.spec.ts
node --test e2e/office/fixture-lifecycle.test.mjs
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts --project=chromium --workers=1
npx playwright test --config=playwright.office.config.ts e2e/office-harness.spec.ts --project=chromium --workers=1
```

Use the exact helper filenames enumerated above. If active-code drift makes one impossible, return `BLOCKED`; do not rename a helper or weaken the exact validation command inside an implementation session. `fixture-lifecycle.test.mjs` covers path/registry safety, scenario determinism/reset, an injected wrapper failure, and real SIGINT/SIGTERM subprocess cleanup. The failure case starts a real child-process sentinel and throws; signal cases start the launcher's lifecycle-probe mode and signal it; each passes only after all child PIDs exit and temporary roots disappear. The test command itself exits zero when cleanup is correct. Production server code is not changed by this SPEC; fixture seeding composes existing database/workspace services from test lifecycle code.

## Smoke Pass Criteria

The UI identifies the isolated workspace, opens `Basic Tables.md`, renders two `.rv-office-table` elements, persists the unique edit to the isolated file, and leaves the live repository and normal database byte-unchanged.

## Manual Electron Smoke

From `fusion-studio-client/`, run:

```bash
node e2e/office/run-isolated-electron.mjs --scenario=basic --copies=1
```

Open `Basic Tables.md`, make and save one unique edit, close Electron normally, and verify the launcher reports fixture cleanup. Pass requires the isolated workspace to be the only registered workspace in that process, the edit to exist only under its temporary root before cleanup, and the live repository/normal database hashes to remain unchanged.

## Non-Goals

- Testing any feature from SPEC-01 onward.
- Electron IPC/export testing.
- General workspace onboarding redesign.
- Fixing unrelated Office or Playwright tests.

## Worker Handoff

Follow `GUIDANCE.md`, including slice-by-slice self-review and the required terminal report. Return only `READY_FOR_ORCHESTRATOR_REVIEW` or `BLOCKED`. Browser and isolated Electron smoke evidence are required.
