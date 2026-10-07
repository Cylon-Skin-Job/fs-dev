# Documentation execution interface

Run from `/Users/rccurtrightjr./projects/fs-dev`. These helpers are capture-local documentation tools, not product services. One writer at a time. `BASELINE.json` is an exclusive execution census; never overwrite it. SOURCES is normative and unchanged; ADDITIONAL-SOURCES records bounded producer/consumer reads without changing the release candidate.

## Each content slice

1. Read the live page (or verify absence); compute SHA-256 of those bytes. Write the proposal inside this capture. Use valid frontmatter with a quoted UTC seconds `last-modified`, unique exact code `source-files` or `[]` for intent. New generated marker bodies start empty; leave existing bodies byte-identical.
2. Invoke the writer with the exact PAGE-MAP path, proposal path and predecessor hash (or `absent`):

```sh
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/wiki-edit.py write <repo-relative-PAGE.md> <proposal.md> --expect <sha256-or-absent> --slice S01 --phase content
```

The writer checks scope, slice, symlinks, metadata, generated ownership and edit-chain currency, saves an exclusive exact preimage, records pending intent, compares again, atomically replaces the page, rereads it, and completes EDIT-RECEIPTS.json. Actual edits automatically get current UTC timestamps. No-op writes fail. A real concurrent overlapping edit requires explicit reconciliation; do not reset the page or falsify a completed receipt. A process dying after replacement can leave a pending receipt for manual evidence-backed reconciliation.

`--phase repair` allows accepted-contract repairs across earlier mapped owners, but requires orchestrator routing and deviation evidence; it does not expand authority. S00 owns no wiki changes. S05 generation/stamp helpers can touch earlier mapped outputs for their exact phases. Every proposal still needs the latest expected hash.

3. Update CLAIMS.json only for material statements supported by your page. Current claims have `path`, `symbol`, `source_sha256`, dependent `sources` path/symbol/hash, `limits`, `output`, actual heading `anchor`, and `reviewer_conclusion`. The S00 entries are a seed, not permission to reuse unsupported facts. Add or narrow evidence when your prose differs; source inspection only. Approved/open claims use D/O authority. Do not mark unwritten prose verified.
4. Update COVERAGE.json entries you satisfy with actual page anchors and check/review evidence. All 30 D/C/AC IDs already have planned outputs. Preserve future coverage as planned until proven. Reviewers independently assess meaning; automation checks completeness, paths and hashes, not whether prose fulfills intent.
5. Run `validate-wiki.py slice S01` (substitute your slice), the proportional whitespace check, and your fresh builder-owned gate. The slice validator checks cumulative accepted scope, lets only exact later map creates be pending, and preserves baseline snapshots. Do not run final as a substitute for a slice gate.

## Generation and final timestamp phase (S05)

```sh
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/s05-navigation.py
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/s05-navigation.py --import-blocks
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/s05-stamp.py
python3 ai/RC-MacAir-15/Captures/038-Platform_And_Plugins_Wiki/validate-wiki.py final
```

The first navigation command stages/audits twice and reports proposals without live writes. The explicit import copies only generated marker bodies for mapped pages, using the pre-stage live hash to reject overlapping changes. It excludes whole pages, generated relationship metadata, unrelated legacy TOCs and audit state. Symlinks in the Wiki tree reject staging. Every imported change receives its own exact snapshot and edit receipt. Final validator independently stages twice, compares all owned live marker bodies, checks incoming routes and reachability, requires all 19 outputs updated/created, all coverage verified and claims anchored, no pending links, and the actual changed-page timestamp receipt.

The stamper touches exactly mapped live pages changed since baseline, uses a single current UTC value, records separate pre-stamp exact snapshots, and verifies body/non-timestamp metadata equivalence. It refuses to overwrite TIMESTAMP-RECEIPT.json. If final repair is required, preserve that receipt under a unique capture-local evidence name, make the routed repair and repeat generation/stamping/affected reviews. Do not overwrite prior acceptance records/hashes.

## Source drift and concurrent edits

The checker reports mandatory and additional source drift; claimed source hashes are hard checked. Reread changed sources and update execution claim evidence with reason and affected-review conclusions; leave normative preparation hashes untouched. External wiki changes require EXTERNAL-DRIFT.json entries with path, from_sha256, to_sha256, attributed_to and reason. Attribution is evidence, not authority to overwrite another writer. Baseline incoming-page link failures are disclosed separately; changing linked specialist prose or recertifying its metadata is not part of this packet.

## Checks and limitations

`validate-wiki.py self-test` covers metadata/parser, heading/link/pending-target, edit chain/snapshot/scope, stamp equivalence, generated-block and source-drift cases. `writer-self-test.py` exercises the real safe writer in disposable fixtures. Neither runs the product. Manual independent review remains necessary for purpose-limited shared-page prose and target/current distinction. No builds, server/Electron launch, Alpha, DB migration, commit/push, or unrelated source mutation.
