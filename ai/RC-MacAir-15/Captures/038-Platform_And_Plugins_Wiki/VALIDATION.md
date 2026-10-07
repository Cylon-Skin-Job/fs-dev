# Documentation validation and receipts

This SPEC validates documentation. Do not run product builds/tests or launch apps/server/Alpha. Record those as not run because product behavior is outside scope, not as passed. No UI screenshots required.

## Required commands

S00 implements capture-local `validate-wiki.py` (not present at preparation). From repo root:

```sh
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/validate-wiki.py baseline
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/validate-wiki.py self-test
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/validate-wiki.py slice S01
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/validate-wiki.py final
```

`slice` accepts S00-S05; run corresponding slice after its changes. Baseline is exclusive-create and refuses overwrite. Every run produces unique capture-local evidence with command, time, checked paths/hashes, counts, failures and exclusions, and exits nonzero on required failures. Checker must not mutate live wiki; writing/generation/stamping is a separately bounded procedure. Reuse tooling only after inspecting its actual behavior and adapting to this page map.

## V1 — Scope and concurrency

Census all mapped pages, code/authority inputs and existing .versions. Actual edit receipt records path, action, predecessor hash/snapshot (or absent), successor hash, write phase/time, and responsible slice. Validate snapshots exactly match predecessor bytes and prior snapshots are unchanged. Verify shared-page diff stays within PAGE-MAP purpose through independent semantic review; automation checks path/metadata/generated-block boundaries, not prose meaning. Unmapped changes cannot be claimed as ours; separately attribute external concurrent changes without resetting them. Unexplained overlap or overwritten evidence fails acceptance. Before each write compare latest bytes to planned predecessor; after write reread to verify. Missing/renamed source or article requires investigation, not silent skip.

## V2 — Metadata

Parse frontmatter with installed client gray-matter (Node invoked directly or from Python), not regex alone. Require nonempty strings name/description, unique string source-files, exact repo-relative regular code files (no directories/globs/absolute paths/unresolved placeholders), and quoted UTC seconds timestamp parsed as a string and valid calendar instant. Intent/guidance may use []; technical current claims need actual owners. Reject four old metadata relationship keys on changed pages. Preserve unrelated domain metadata. If parser dependencies are missing, resolve a documentation-only way to use the existing parser; do not change product dependencies silently.

## V3 — Links and navigation

Parse local inline/reference Markdown links outside fenced examples, URL-decode paths/fragments and validate targets and actual heading slugs, including duplicate-heading suffixes. Check every changed page and relevant incoming navigation. New failures are blocking; pre-existing out-of-scope failures are listed separately with scope. Intermediate links can be pending only if exact future PAGE-MAP creates; no pending target allowed at final. Ensure wiki guidance → new overview and WV overview → new section routes exist and every new article is reachable. No deletion/move means no retirement cleanup is expected.

## V4 — Generated contents

Create unique disposable stage containing current active Wiki, with symlinks rejected or safely dereferenced within permitted source scope. Invoke:

```sh
node fusion-studio-server/scripts/wiki.js audit /absolute/disposable/stage/Wiki
```

Run twice. Authorized marker bodies must stabilize on second run; import those generated bodies only via compare-before-write. Never import other pages, legacy TOCs, generated relationship metadata or runtime audit state. No handwritten generator output. Check final live authorized blocks equal staged output. Regenerate after any change that affects navigation and stamp only actual changed pages. Capture generator commands/results and exclusions.

## V5 — Semantic and source coverage

Maintain CLAIMS.json: material claim ID; output page/anchor; classification current/approved/open/gap; current code path+symbol+hash and inspection limits or D/O authority ID; reviewer conclusion. Acceptance coverage maps every D01-D12, C01-C10 and AC01-AC08 to output/evidence. Missing implementation is not inferred from a single grep; bound negative claims to inspected owners and label end-to-end support unverified where appropriate. Trace significant current behavior through producer/consumer paths. Confirm no target or archive prototype is represented as implemented. Check the example preserves file surface, shell, collection and mutation owners; check no arbitrary iframe capability or synthetic API implied. Check current-tab opening does not invent raw-only editing restrictions.

Maintain SOURCE-INSPECTION.md with exact inspected scope and execution-time hashes. Before final, compare source hashes; re-inspect affected claims and repeat affected validation/reviews on material change. Cosmetic/unrelated source drift is recorded with reason it does not affect claims. HEAD equality alone is insufficient.

## V6 — Timestamp receipt

Stamp only actual changed live articles. Save exclusive exact pre-stamp snapshots and before/after hashes; record a receipt listing each page and actual UTC value. Parse and compare to prove body and non-timestamp metadata unchanged by stamping. Do not reset earlier snapshot timestamps, stamp merely read pages, or replace earlier slice acceptance hashes. Final output hashes and final reviews refer to post-stamp bytes. Later real edits update timestamps and repeat affected checks/reviews.

## V7 — Review and hygiene

Read the whole reader route from overview to target, example, current implementation, limitation and owning gap. No keyword checker can replace semantic review. Scan actual changed prose for ephemeral SPEC/Capture links, invented ABI/schema, obsolete target paths and ambiguous current/future statements; inspect hits contextually. Actual current System/Views examples are valid. Run `git diff --check -- <actual tracked changed paths>` and separately inspect untracked created pages for whitespace/conflict markers. Do not use the giant shared worktree diff as this task's output manifest.

Self-test in disposable fixtures must accept valid metadata/links and recognized intermediate future targets; reject malformed YAML, timestamp parsed as date, invalid UTC date, duplicate/directory source, missing link/fragment, unauthorized path change, overwritten snapshot, and stamper changing body. Reject pending links at final. This verifies documentation safety checks; no product test expansion.

Final pass: zero material failures, no pending links, all mapped articles and D/C/AC coverage accounted for, attribution of external changes, source-only limitations explicit, timestamp receipt and final independent CLEAN integration review. Report actual check counts; do not invent them or reuse prior SPEC test totals.
