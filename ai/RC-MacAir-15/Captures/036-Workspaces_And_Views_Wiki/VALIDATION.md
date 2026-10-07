# Documentation validation contract

No product tests, builds, app/server launches, or Alpha operations are needed or authorized. Validation establishes documentation correctness and bounded source evidence, not product runtime behavior.

## Capture-local checker interface (built in S00)

Run from repository root:

```sh
python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/validate-wiki.py baseline
python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/validate-wiki.py self-test
python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/validate-wiki.py slice S01
python3 ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/validate-wiki.py final
```

The checker is an execution artifact to be implemented, not a claimed existing script. baseline is exclusive-create and refuses to replace evidence. slice accepts S00–S05; final reads all owned outputs. Reports go to unique capture-local run files and include command, timestamp, actual inputs/hashes, counts, failures and exclusions. Exit nonzero on failed required checks. A pass based solely on keyword presence is not semantic acceptance.

V1 Scope: exact present/absent page census, actual edit manifest and per-edit preimages. Require each write within PAGE-MAP authority and compare bounded support sections against their preimage. Check retained/protected hashes; separately attribute legitimate external changes rather than restore them or falsely pass them as our work. Fail unexplained overlap/mutation. Hash existing .versions and ensure no historical file modified or removed. New snapshots exactly match each predecessor, including retirement and stamp phases.

V2 Metadata: parse with the installed client gray-matter package (via Node from Python if necessary), not regex alone. Require nonempty name/description, unique string source-files and exact existing files without dirs/globs/unresolved placeholders, quoted UTC seconds timestamp parsed as a string, no four legacy relationship keys. [] allowed for intent/guidance; technical pages need actual owners or a specifically reviewed non-code classification. Preserve unrelated metadata. Validate actual UTC date syntax, not only its shape.

V3 Links: parse relative inline and reference-style Markdown links, URL decoding and optional fragments; resolve local paths and actual Markdown heading slugs including duplicate heading suffixes. Exclude fenced examples and external URLs. Check all changed pages and every live incoming reference to retired root; report pre-existing retained-page failures without blaming this SPEC. No new broken links permitted. Intermediate pending links must target exact future PAGE-MAP creates and expire at final. Historical captures/.versions may retain old paths with a recorded retirement map; additional active dependencies require amendment before removal. Verify section navigation can reach every core/view introduction and each gap's owning article.

V4 Generation: create a unique disposable staging directory with an absolute Wiki root; copy current wiki without escaping symlinks. Use the existing generator:

```sh
node fusion-studio-server/scripts/wiki.js audit /absolute/disposable/stage/Wiki
```

Run twice. Compare generated marker bodies on authorized pages; the second run must not change those blocks (audit state-file changes and unrelated legacy regeneration are not imported). Import only authorized generated blocks through compare-before-write. Ensure markers exist where needed before staging, using the marker syntax in current guidance. Never import staged whole-wiki output, generated edges, state files or retained-reference rewrites. Post-import stamp actual changes and preserve snapshots. A missing/stale generator dependency is a failure to resolve within documentation tooling authority, not permission to edit runtime code or hand-author generated blocks.

V5 Content and evidence: maintain CLAIMS.json recording material claim, page/anchor, classification (current/approved/open/gap), exact source/code symbol and hash for current claims or D/O authority ID for intended/open claims, plus inspection scope. Reviewer independently checks material claims along actual producer/consumer routes. Every AC/C contract maps to outputs and evidence. Gap records have stable identifier, target, current limit, remaining capability, owner and decision gate; no dates/build order fabricated. Catalog census covers all mapped types and actual placeholder status. Retained references are visibly outside recertification from owned entry points.

V6 Source/protection drift: reread claimed source hashes before final. If changed, reassess affected claims and repeat affected checks/reviews; do not treat mere HEAD equality as stability. Scope all whitespace checks to actual changed live files and new capture artifacts, not whole dirty Git diff. Run git diff --check -- <actual tracked changed paths>; separately check untracked new pages. Scan changed wiki prose for implementation capture/SPEC links, retired code paths, unqualified target assertions and stale doc-viewer naming; inspect each hit in context, allowing explicitly historical examples. Preserve source-current System/Views examples.

V7 Timestamp receipt: script uses final actual changed page list, excludes retired/untouched/history files, writes one current quoted UTC time, and validates before/after parsed content and metadata differ only in last-modified. Save exclusive exact preimages and before/after hashes in a separate receipt. Final hashes/review refer to post-stamp bytes; retain earlier acceptance hashes as historical evidence. Subsequent real edits require timestamp updates and affected validation/review again.

V8 Human review: read canonical overview → workspace → provisioning → instance/context → state → catalog → selected view → gap → source-map routes. Require understandable terms, clear current/target/open labels, no implementation approval disguised as wiki prose, and no implied whole-wiki/runtime certification. Optional screenshots are unnecessary for Markdown-only acceptance; no UI automation required.

self-test must reject fixture cases for invalid frontmatter, YAML-native timestamp, bad date, duplicate source, directory source, missing/fragment link, unauthorized edit, overwritten snapshot and timestamp pass altering body. It must accept correct Markdown heading/reference-link cases and explicitly recognized intermediate future links, while rejecting those at final. Fixtures stay disposable and never touch live wiki.

Final pass requires zero material failures, no intermediate pending links, full coverage of AC01–AC10, separately listed baseline warnings/external drift, and final independent CLEAN review. Report exact commands and outcomes; no invented check totals.
