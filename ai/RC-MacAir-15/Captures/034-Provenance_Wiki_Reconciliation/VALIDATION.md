---
name: "PW-01 Documentation Validation Contract"
description: "PW-01 Documentation Validation Contract for the documentation-only provenance reconciliation."
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Documentation validation

Run checks from `/Users/rccurtrightjr./projects/fs-dev`. `C` below means `ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation`. Evidence includes exact command, timestamp, exit status, stdout/result summary, paths and inspected hashes. Do not convert unrun product tests or historical reports into fresh results.

## V1 — Scope, current baseline and snapshots

At S00 run `git rev-parse --show-toplevel`, `git rev-parse HEAD`, `git status --short`, `git branch -avv`, and `git worktree list`. Capture current target bytes/hashes and generated marker blocks in execution evidence. The preparation BASELINE.json is not a pre-edit snapshot for later execution.

Immediately before each substantive wiki edit, copy the complete current PAGE.md to sibling `.versions/YYYY-MM-DD-HHMMSS.md` using local time. Use exclusive creation; if a timestamp collides, obtain a new timestamp, never overwrite. Record original path/hash and snapshot path/hash. Compare the reread current file to the saved hash immediately before writing; if another writer changed it, preserve that work, re-read and take a fresh snapshot. Never snapshot a snapshot or restore an earlier whole file over someone else's edits.

Per slice, record exact attributable changed/new files, pre/post hashes and diff. Run:

```sh
git diff --check -- ai/RC-MacAir-15/Wiki/010-Events_And_Ledger ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation
```

Inspect untracked artifacts explicitly because ordinary diff excludes them. Compare attributable changes against SPEC scope. Record concurrent external changes without reverting or claiming them. Pass: every substantive edit has an exact pre-edit snapshot; no attributable product/protected/runtime/Alpha writes; no lost concurrent change. A before/after global status difference alone is not attribution.

## V2 — Frontmatter and source pointers

The installed client `gray-matter` parser is available at preparation. Run this command on all primary pages and changed supporting pages using PAGE-MAP.json; it parses frontmatter and checks the schema shape without invoking app code:

```sh
node - <<'JS'
const fs = require('fs');
const matter = require('./fusion-studio-client/node_modules/gray-matter');
const map = JSON.parse(fs.readFileSync('ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation/PAGE-MAP.json', 'utf8'));
for (const row of map.pages) {
  const text = fs.readFileSync(row.path, 'utf8');
  if (!text.startsWith('---\n')) throw Error(`Missing frontmatter: ${row.path}`);
  const {data} = matter(text);
  if (typeof data.name !== 'string' || typeof data.description !== 'string' || !data.metadata) throw Error(row.path);
  for (const key of ['incoming-edges','outgoing-edges','source-files','connected-skills','related-trigger-files']) {
    if (!Array.isArray(data.metadata[key])) throw Error(`${row.path}: ${key}`);
  }
  console.log(`PARSED ${row.path}`);
}
JS
```

For every primary page source-files entry and newly edited supporting-page pointer, verify the exact repository-relative file exists and inspect whether its symbols actually own the claim. Directory/glob/machine-placeholder entries must be resolved to real source files or removed with rationale; no documents as code source metadata. Preserve unchanged unrelated supporting-page limitations in the report instead of certifying them. If parser dependency is missing at execution, record that fact, do not install/change dependencies or claim success; use an available equivalent strict YAML parser and document the substitution, otherwise the validation remains incomplete.

## V3 — Links, anchors, navigation and readability

Inventory Markdown links, reference links and relevant HTML anchors from all primary pages plus changed supporting prose. Resolve local targets relative to the page and verify fragments against actual headings/anchors. Check source-code links too. External URLs require syntax checking only; do not browse or certify remote availability. Code-fenced illustrative links and literal placeholders are excluded only with an explicit example classification. Every omission/failure is recorded; zero unresolved links in rewritten primary prose or newly changed supporting prose is the pass condition. Existing unrelated supporting defects are named limitations.

Compare every `<!-- section-toc:start -->` through `<!-- section-toc:end -->` block byte-for-byte with that page's execution baseline/pre-edit snapshot. No generator is run because it is absent and no structure changes are required. Confirm page names/paths stay stable. If an existing generated item is materially misleading, explain the status immediately outside the block and record the generator dependency; do not silently change generated bytes. Titles/descriptions outside generated blocks may be clarified without renaming page identity.

Inspect changed prose in raw Markdown: one physical line per ordinary paragraph, valid fences/tables and no misleading headings/status labels. No app launch is needed. This is structural/readability inspection, not a claim of visual runtime validation.

## V4 — Ephemeral reference and vocabulary sweep

Run:

```sh
rg -n 'Captures/|SPEC-|ULV-D|LED-D|TOOL-D|AUT-D|UEB-D|RSC-D|CHAT-D|AUD-D|acceptedRef|PreparedCanonicalCandidate|uiActionSeed|ledger_events|file\.version|resource:invalidate|fully built|stub' ai/RC-MacAir-15/Wiki/010-Events_And_Ledger ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md -g PAGE.md -g '!**/.versions/**'
```

Every match in primary prose/changed supporting scope receives a disposition, not automatic deletion. Pass: no draft API presented as current, no unapproved proposal presented as approved, no implicit all-app coverage, and no capture/SPEC dependency in durable explanation. Old authority IDs and receipts are kept in C. Generated and unchanged unrelated supporting matches are explicitly scoped exceptions, never proof of correctness. A zero-match search alone does not validate semantics.

## V5 — Source and decision evidence

For each topic changed, EVIDENCE.md records: page/claim; authority class; current/target/proposal/open status; source file/symbol and line anchors plus hash/revision; full producer-to-consumer chain; failure/limitation; relevant existing test names with `not rerun`; historical report revision/date if used. A renamed helper or comment cannot substitute for reading the active public call path. Negative feature claims require bounded caller/registration searches and the exact directories/patterns used.

Required scenarios: supported save; snapshot failure before mutation; postwrite publication/projection failure; optional malformed reported context; stale workspace/reconnect/dirty-buffer rendering; completed/interrupted tool activity; first/no-change/failed resource observation; query server versus actual UI caller; conditional calendar content persistence; governed versus legacy event persistence. Source inspection may establish implementation paths but must not be labeled live success. Documentation gaps are repaired; product defects are accurately described and deferred.

## V6 — Integrated gate

Re-run V1–V5 as applicable across all accepted slice outputs. Exact per-page disposition: changed-and-checked, read-and-consistent, or limitation explicitly labeled in-page. An unresolved material claim must not remain presented as reliable guidance. Verify AC01–10 with separate evidence rows. Perform fresh read-only final integration review. Check cross-owner handoff and approved/open decision lists, all deviations, current candidate bytes and invalidated lower gates. Pass: no material documentation defect, no unclassified scope violation, and report limits are precise.

## Product verification boundary

No npm build/test, live fixture, server, provider call, app restart, live database read/write, or Alpha operation is required or authorized by this documentation SPEC. Existing tests/reports are inspected as evidence of contracts or past results. If a future runtime claim is desired, record the missing verification and request a separately scoped task; this SPEC can complete with honest source-inspected statements. Documentation validation scripts may be added under C if useful, but may not execute application modules or mutate code/data.
