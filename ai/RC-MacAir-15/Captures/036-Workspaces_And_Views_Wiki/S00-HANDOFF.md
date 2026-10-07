# S00 handoff — execution baseline and checks

Status: READY_FOR_ORCHESTRATOR_REVIEW; fresh builder-owned review CLEAN on current checker bytes. Candidate WV01-5108f8838c18f10b. No live Wiki or product files were edited in S00.

## Execution baseline

`BASELINE.json` was created exclusively from the dirty primary checkout at 2026-09-21T11:54:21Z. It records HEAD, exact working-byte SHA-256 for all 53 mapped entries (37 present, 16 absent), 164 live Wiki pages, 330 existing `.versions` files, and 65 source/template files. `TEMPLATE-CENSUS.json` inventories the 13 bundled view manifests and renderer map presence; `PROFILE-CENSUS.json` inventories five bundled workspace profiles. `CLAIMS.json` seeds eight current source-inspected claims, nine approved decisions and six open product decisions. Later slice builders must add article anchors, source inspections and gap evidence for claims they publish. No nested AGENTS.md was found in the mapped Wiki/capture subtree.

`BASELINE-LINKS.json` records 27 pre-existing broken links outside this slice's repair scope. The repository-wide root-retirement scan in `BASELINE.json` found one active Wiki inbound link in mapped `006-System_Manager/001-Workspaces_&_Views/PAGE.md`, plus historical captures and bundled template/mirror links outside the active Wiki. S05 owns the active inbound repair; historical and template references are retained as explicit exclusions. The current baseline remains immutable; preparation hashes are not substituted for it.

## Checker and edit procedure

`validate-wiki.py` supports the required `baseline`, `self-test`, `slice S00`…`slice S05`, and `final` commands. Every invocation writes a unique `runs/*.json` report. `baseline` refuses overwrite. `slice` and `final` compare mapped/live/history/source hashes, replay per-write edit receipts, check exact predecessor snapshots, scoped support edits, parsed frontmatter, sources, links and fragments. `final` additionally checks staged audit idempotence and imported marker bodies, root retirement inbound references and the separate timestamp receipt. Semantic claim accuracy still requires human independent review.

For each new page, rewrite, support edit or retirement, builders should prepare proposed bytes in a capture-local temp file and use:

```sh
python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/wiki-edit.py write <repository-relative-PAGE.md> <proposed-file> --expect <current-sha256-or-absent>
python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/wiki-edit.py retire <repository-relative-PAGE.md> --expect <current-sha256>
```

The helper rechecks current bytes, saves an exclusive full predecessor under that article's `.versions/`, writes atomically and appends `EDIT-RECEIPTS.json`. The checker requires a complete hash chain from this baseline to current bytes. Any unrelated live Wiki drift fails until `EXTERNAL-DRIFT.json` attributes its exact before/after hashes, owner and reason; attributed changes remain visible warnings and are never folded into WV-01 edits. Newly recorded current claims in `CLAIMS.json` must carry exact source paths and hashes, and the checker rereads them on every slice/final pass. It also rechecks all template and workspace-profile census sources. For newly created pages the initial predecessor is absent; later revisions, including the final timestamp pass, require snapshots. Do not hand-edit the receipt. A failed pending receipt or concurrent mismatch must be reconciled before proceeding. The S05 timestamp receipt format is `TIMESTAMP-RECEIPT.json` with `stamped_at` plus `entries` containing each changed live page's `path`, exact `snapshot`, `before_sha256` and `after_sha256`; the checker verifies parsed body and all metadata except `last-modified` are identical across that final pass.

## S00 checks and limits

- `python3 .../validate-wiki.py baseline` — PASS once, immutable baseline created. A second call returned the expected nonzero exclusive-create refusal.
- `python3 .../validate-wiki.py self-test` — 29/29 PASS after reviewer repair, including broken inline/reference/fragment links, YAML/date/source metadata, unauthorized edit, overwritten and intermediate predecessor, missing overview marker and timestamp-body mutation.
- `python3 .../validate-wiki.py slice S00` — PASS; no changed live Wiki page, no historical snapshot drift, no source drift at check time.
- `python3 -m py_compile .../validate-wiki.py .../wiki-edit.py` — PASS.
- Disposable `wiki-edit.py` fixture — PASS for compare, exclusive snapshot, atomic page write and complete receipt.

No app/server launch, product tests, build, runtime check or Alpha operation was performed. Later slices must perform semantic source and reading-route review; this validator cannot certify user-visible product behavior. No deviation from the approved documentation-only scope is proposed. Prior failed self-test reports and reviewer finding remain in the capture as repair history.

## Builder review result

The third fresh read-only clean-room reviewer returned **CLEAN** after inspecting the current S00 artifacts and rerunning self-test (29/29), slice S00, and Python compilation. The first two terminal reviewers found material checker gaps; those were repaired forward and remain recorded in `S00-REVIEW-HISTORY.md`. The third reviewer found no remaining material S00 defect. No reviewer edited files. `close_agent` is not available in this collaboration tool set; all three reviewer terminal states were observed.

## Orchestrator acceptance repair

The first orchestrator acceptance review found that staged generation compared only `section-toc` blocks. `toc-sync.js` also generates `children` blocks, so a stale children description with an otherwise valid link could pass. The checker now compares both marker types across live, first staged and second staged bytes for every changed authorized page. A disposable fixture uses a resolving child link with stale versus current generated descriptions and proves rejection. The repaired checker passes 29/29 self-test cases and slice S00; fresh builder review of these bytes is pending.

The fourth fresh builder review found a valid Markdown shortcut reference form (`[label]` plus a definition) that the link checker skipped. The checker now resolves it, with broken and valid shortcut fixtures. The latest S00 check passes with one attributed source-drift warning: `fusion-studio-server/lib/thread/thread-runtime-controller.js` changed concurrently after baseline; no S00 current claim uses that file. Later slices must reread it if they make a claim from it. A fifth fresh builder review of current bytes returned CLEAN.
