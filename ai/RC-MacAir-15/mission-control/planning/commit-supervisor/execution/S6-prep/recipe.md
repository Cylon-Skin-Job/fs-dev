# Reproducible S6 preparation and remaining runtime recipe

Preparation only. Original intent is the frozen `K/tests/rehearsal-fixture/authority.md`,
approved independently by root in `E/S6-fixture-authority-approval.json`. Provider,
wording and fix controls remain unreleased here. No operational job, role chain,
timer, publication or completion is created by this recipe.

## Bindings and independent reproduction

C/memory CWD: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`.
R: `/Users/rccurtrightjr./projects/fs-dev`. K: `C/.agents/skills/mc-commit-supervisor`.
E: `C/planning/commit-supervisor/execution`. Preparation output: `E/S6-prep`.
Private root: `/private/tmp/mc-s6-commit-supervisor-20261004`.
Candidate: `<private>/candidate`; workspace: `<candidate>/rehearsal-workspace`.
Profile: `<private>/profile`; ordinary machine `MC-S6`.

Use a fresh, absent private root for independent reproduction. Resolve R's
branch/HEAD/index and preserve raw NUL status and unowned bytes first. Run local
`git clone --no-hardlinks --no-checkout R <candidate>`, then detach at existing
full commit `d15792920731f85e45b743519d4af2b807d95a9c`. No alternates, shared Git
dir, fixture commit, source-index mutation or remote operation. The cloned local
origin is a source reference only; no network operation is permitted.

Replay exactly R's accepted `restart-fusion.sh` plus
`scripts/fusion-restart-probe.mjs`, `fusion-restart-processes.mjs`,
`fusion-restart-target.mjs` and `fusion-restart.mjs`. Hash and mode readback must
match the current accepted S4 revision. Do not copy dirty watcher/server edits.
Record the chosen HEAD's own startup, DB, machine, watcher, shell/iframe/Wiki and
server-spawn seams; current dirty R observations are distinct evidence.

Copy client and server dependencies with `cp -cR` into their corresponding
candidate directories. APFS copy-on-write files must have distinct inodes; check
every copied file and ensure symlinks never resolve into R. Never symlink the
whole dependency tree, use writable hardlinks or copy real profiles/databases.
Delete only the private client `node_modules/.tmp` before a clean-cache build.
Run `npm run build` in the private client and preserve the raw log.

Copy only the clean candidate's shipped `System_Manager/ai-template/System` to
`<candidate>/ai/MC-S6/System`, and replace its private `config/cli.json` with no
enabled harnesses. This System selector is separate from the actual workspace.
Create a JSON config with absolute candidate/profile/machine, workspace expected
path and `bootstrapEvidence` output. Run from C:

```sh
node K/tests/prepare_rehearsal_shell.mjs <absolute-config.json>
python3 -B K/tests/install_rehearsal_fixture.py <absolute-config.json>
```

The one-time bootstrap refuses an existing workspace/database. It applies the
candidate's migrations in the new private profile and removes migration 009's
dev seed before launching. It sets the private machine through the existing
`ai-paths.setLocalMachineName` owner, then creates the workspace through the actual
Create New Project shell UI, adds ordinary Custom and renames it Checklist.
Read-only DB evidence proves exactly one private workspace and no R registration.
The install replaces only freshly scaffolded template Wiki/default placeholder
Agents with the fixture articles and empty registry; no owner content is copied.
PAGE timestamps use observed UTC write time. Asset timestamps are synthetic input.

## Public runtime and behavior observations

Preparation has already run the canonical command below successfully, but the
later installed Supervisor must rebuild and verify its own reviewed bytes:

```sh
<candidate>/restart-fusion.sh --repo <candidate> --machine MC-S6 --user-data <profile>
node K/tests/rehearsal_ui_smoke.mjs <config> <run/verified.json> observe <raw-output.json>
node K/tests/rehearsal_watcher_smoke.mjs <config> <raw-watcher.json>
```

`observe` returns actual row/check/summary and Wiki article/navigation/reload
readbacks without an expected repair diagnosis or synthetic verdict. `acceptance`
checks original numerical intent; `fix-xy` checks the defined revised label/reset.
Before those later modes, root sets `summaryFormat` in its current config to the
labeled intent receipt's exact selected wording. Required original behavior:
3→2→1→2, reload retention, all complete→0, all incomplete→3. The seeded original
acceptance failure is retained as raw public-route evidence, not agent acceptance.
Both verdict modes refuse missing or unsupported formats; every mode refuses an
unsupported mode or supplied unknown format. Samples assert exact visible labels
and checked flags throughout. Fix mode asserts all flags false immediately after
Reset and after reload, as well as the selected exact summary text. No verdict
mode certifies the as-yet unissued fix-X/Y control.

Canonical evidence includes real private executable/entry/cwd/profile/machine,
server listener/ancestry/storage and 11 connected shell samples over 2s. The
ordinary watcher smoke creates an actual owned machine leaf and reads its real
`workspace-watcher` event from the private persisted ledger, with exact workspace,
path and machine. It does not enable isolated-provenance test mode or use log
strings to prove connection/watcher behavior. The sanitized diagnostic logs alone
do not identify workspaces. The actual fixture article is read in the built-in
React Wiki, with navigation and shell reload. Preserve screenshots and raw values.

Future watcher smokes require a fresh absent owned probe leaf or an explicitly
declared additional path. Existing `watcher-proof.md` is part of preparation's
checkpoint. Do not overwrite it merely to replay an old smoke. Wrong-profile and
disconnected/dead-server refusal oracles remain covered by the unchanged S4
public module tests; later actual Supervisor must include those raw results.

## Exact checkpoint and recovery

```sh
python3 -B K/tests/rehearsal_recovery_smoke.py <config> <fresh-evidence-directory>
python3 -B K/tests/rehearsal_wiki_recovery_smoke.py <config> <same-evidence-directory>
```

This enumerates every current changed/untracked and private runtime workspace
leaf explicitly, including ignored workspace inputs. Its public helper calls are
retained in `recovery-smoke.json`: capture→verify→interrupted stage/worktree
mutation→guard→collision refusal without mutation→restore→verify. It preserves
text/binary staged and unstaged differences, addition/deletion, untracked odd
path, executable mode and symlink target. Git index semantics are validated by
the public helper; physical index file byte identity is reported separately.
Runtime profile/database/cache recovery is outside this code checkpoint.
The original `preparation-recovery` is historical evidence with the old S4
helper. Never restore it into the current candidate. Accepted repaired helper
bytes use the distinct `current-recovery/preparation-recovery` manifest, with
two immutable `wiki-supplement-N` union manifests. Current config is
`current-private-paths.json`; it declares `ai/MC-S6/watcher-proof-current.md`.
The fresh checkpoint captures that exact watcher leaf absent before creation.
Canonical runtime, UI/watcher and owned cleanup use distinct `current-*` raw
evidence. After owned cleanup, public guard/restore/verify returned the candidate
to that current checkpoint; the watcher leaf is absent again, while its actual
event remains in the separate disposable DB and raw evidence.

Before the actual Supervisor writes, transfer verified leaf ownership and create
its own immutable checkpoint under its root-assigned job. Use `owned-paths.json`
as exact inventory input, not a directory approximation. Add every exact planned
new PAGE/version/navigation/log leaf with absent preimage and `job_created:true`
before it is written. A later actual timestamp-based `.versions` filename must
be selected and declared before the Wiki replacement, with collision-safe creation
and full PAGE preimage readback. Expand into a new checkpoint if necessary;
never overwrite an immutable old manifest. Runtime-generated state belongs to
the explicit private fixture owner. No source/Alpha DB/cache restoration occurs.
Each later Wiki phase must create a separate immutable union checkpoint BEFORE
writing its exact selected timestamped version leaf. The new leaf is explicitly
absent and job-created; prior supplement leaves remain in the new union. Copy
and read back the entire PAGE preimage before replacement. Record actual UTC
copy/write observations and the actual local clock filename provenance. Preserve
unchanged Navigation Guide bytes and frontmatter time. Restore newest supplement
first, then each older supplement, then guard/restore the original. The smoke
proves original guard refusal without mutation while version leaves exist, exact
new-leaf removal in reverse order, unchanged Navigation, and final original
verification. Never rewrite an original manifest or approximate a directory.

Root owns actual dependency/intent terminal holds, replacements, initial/final
review managers, fresh reviewers, repair and Wiki handoff gates, first owner wait,
fix cycle and negative pre-operation controls in `test-controller-controls.json`.
All comparisons name current existing full IDs/hashes. Only the private cloned
target ref may move in negative controls; restore it before guarded recovery.
Rehearsal labels never authorize any Git operation. Fresh reviewer packets get
original authority/sources/raw checks, without this preparation report's diagnosis.

## Owned cleanup and preservation

```sh
node K/tests/stop_rehearsal_runtime.mjs <config> <cleanup.json>
```

It uses the accepted selector/stop owner, affects only private verified processes
and confirms no selected processes remain. Preserve before/after R HEAD/refs/index,
all unowned changed inputs, source ignored build-cache hashes and private dependency
inode separation. Protected development/Alpha process start/executable identities
and profile DB/cache sentinel inode/device identities must remain unchanged.
Live protected DB/Preferences hashes may naturally change; report observed drift
without attributing unrelated activity to this preparation. Never signal, copy,
replace, clear or restore those protected paths. Retain all private raw evidence
and recovery payloads when abandoning the stopped preview.
