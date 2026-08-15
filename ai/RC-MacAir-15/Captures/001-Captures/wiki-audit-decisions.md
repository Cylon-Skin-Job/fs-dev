# Wiki Audit System — Decisions Capture

**Date:** 2026-07-02
**Status:** Agreed in design riff; not yet implemented. Items in Open Questions still need a call.

## Context (already shipped, for orientation)

- `000-` heading articles are front pages at every level, including the wiki root (`Wiki/000-Wiki_Guidance/`). Folders with a `000-` child have no folder-level `PAGE.md`.
- `sync-wiki-tocs.js` maintains `<!-- section-toc:start/end -->` marker blocks in heading articles (guidance group + section/article group).
- Chat System is fully migrated: de-TOC'd main articles, merged sparse sections, renumbered 000–007.
- Wiki content rules so far: durable knowledge only, no spec/plan references, `source-files` = code files only.

## Agreed Decisions

### 1. Article anatomy (four zones)

1. **Frontmatter** — authored. `name` + minimal `description` that covers *what is this / why does it matter / when to use*.
2. **Lead** — authored. 1–2 paragraphs of prose. Deterministic boundary: everything between frontmatter and the first `##` heading.
3. **Body** — authored. The meat, written from the codebase and article domain.
4. **Generated tail** — script-owned marker lists.

Codified in the Style Guide when implemented. Separate AI authoring instructions per zone (description, lead, body).

### 2. Ownership rule

Inside markers = script. Outside markers = authored. No exceptions.

### 3. Children markers

Articles get `<!-- children:start/end -->`; the script fills the list from child frontmatter (name + description). Replaces hand-maintained `## Children` lists.

### 4. Computed edges — dropped from frontmatter

- `incoming-edges` / `outgoing-edges` are removed from frontmatter entirely.
- Script computes outgoing edges from actual body links, incoming edges as the reverse index. Stored in the state JSON only.
- Rationale: a single computed source of truth cannot rot, and keeping computed data out of authored zones protects the intentionality signal (see 6).

### 5. Frontmatter becomes the authored trio

`name`, `description`, `source-files`. Source-files stays authored because it is a claim (which code the page is accountable to); the script validates the claim rather than making it.

`connected-skills` and `related-trigger-files` are killed (resolved 2026-07-02). If skill/trigger connections are needed later, they return as script-computed sections using the same deterministic logic — never as authored frontmatter.

### 6. State JSON with zone-hash change tracking

Per page: hashes of the four zones, `lastAuthoredChange` timestamp, computed edges, source-file freshness. Deterministic change classification each run:

| Change pattern | Class | Action |
|---|---|---|
| Frontmatter or lead touched | intentional | accept, no agent |
| Body only | drift-check | sub-agent evaluates frontmatter + lead against new body |
| Generated block gained/lost entries | structure-changed | check whether lead should mention it |
| Nothing | clean | skip |

Snapshot is recorded after the script's own writes, so "changed since last run" compares authored edits only.

### 7. Source-file freshness via git

Compare each page's `lastAuthoredChange` against `git log -1` commit times of its listed source files:

- All source commits older than page's last authored change → **fresh**.
- Any source file committed after → **stale**; report names the files for the drift-check agent.
- Listed file missing from repo → **broken reference**.
- Empty `source-files` on a knowledge-layer page → **orphan triage**: add sources, merge into another article, or delete.

### 8. The audit run loop

Entry point: user sends the audit page to chat; assistant executes the runbook.

1. **Script pass 1** — fill all marker blocks, compute edges, emit change report.
2. **Triage** — walk the report; spawn per-article eval sub-agents only for drift-check items.
3. **Judgment** — assistant arbitrates sub-agent proposals against written skepticism criteria: over-eager change-for-change's-sake? genuinely new? missed something the prose already covers?
4. **Front page** — run the five Sync Wiki Context sub-agents against the hand zone of `000-Wiki_Guidance`.
5. **Script pass 2** — regenerate blocks, record new snapshot (reseal).

### 9. Sync Wiki Context is absorbed

It stops being a standalone workflow and becomes step 4 of the audit. Its five section prompts become sub-pages of the audit workflow. Article-eval sub-agent prompts are authored in the same style.

### 10. Prompts stay separate files, in the 900 band

Sub-agent prompts live as pages under `999-Audit_Prompts/`, never inlined in the runbook. The runbook instructs: read the prompt file, hand the sub-agent the full text verbatim. A file boundary prevents the orchestrator from paraphrasing the job, and prompts-as-pages get zone hashes — prompt drift is audited like article drift.

### 11. The 900-series operational band

Folders numbered `900–999` are operational attachments (prompts, checks, smoke tests), not content articles:

- **Rendering:** free — the right sidebar already renders child folders with children as labeled groups, and 9xx sorts last naturally.
- **Script rule:** 9xx folders are excluded from generated children/contents lists.
- **Audit rule:** classified as tooling — light validation, no orphan/staleness flags.

### 12. Symlinks: app-wide, first-class

Scope is the whole app, not just the wiki: users can symlink folders anywhere in a workspace and both the UI and AI see a real folder, with metadata marking it as a link and showing its origin.

- **Implemented (2026-07-13):** dirent + lstat link detection (Windows junction fallback), classification via stat through the link, broken links skipped, `isSymlink` + `symlinkTarget` emitted on tree nodes (shared helpers in `lib/fs/dirents.js` + `lib/fs/symlinks.js`); all scanners on the shared stat-through-link contract (`wiki-tree.js`, `sync-wiki-tocs.js`, component/prompt/trigger/ticket loaders, view-state, workspace handlers, file-mentions collector); cycle guards (visited-realpath set via `lib/fs/cycle-guard.js`) in recursive walkers; write-lock enforcement resolves realpath before path rules so links cannot bypass locked folders (`enforcement.js`). Path policy: symlinks placed inside a workspace are user intent — followed for reads even when the target is outside the workspace.
- **Deferred to the audit build:** identity = realpath in audit state and dedup (canonical home tracked once, symlinked appearances navigation-only) — lands with the audit script (Section A).
- Symlinks may be renamed at the link (e.g. `999-Backend_Smoke_Checks` pointing at a workflow folder) — the label comes from the link name, identity from the target.

### 13. Generated group label rename

"User Preferences and Guidance" → "Guidance and Preferences" in the script's generated blocks.

### 14. Three-layer domain lifecycle (Evidence-Gated Execution framing)

| Layer | Lives at | When it fires |
|---|---|---|
| Guidance (intent) | heading article + sub-topics | pre-flight — injected before build; flagged for update post-build |
| Knowledge | 001+ articles | during — reference while implementing |
| Checks (deterministic) | 9xx band — symlinked workflows, smoke tests | post-build — checkpoint before commit |

Code Standards remains the universal build guidance above all domains. Workflows are authored once in 008-Workflows and symlinked into domains where applicable. The wiki is the routing substrate for the build loop: guidance in, checks out, commit gated.

### 15. Explicit `type` field (frontmatter becomes the quartet)

`type`, `name`, `description`, `source-files`. Type is authored explicitly on every page. The script still knows what folder position implies and flags type-vs-position contradictions as audit warnings. Migration: script stamps initial types from position in one pass; authored thereafter.

Vocabulary (open, per OKF; extended only through the registry):

| type | Maps to | Audit rule class |
|---|---|---|
| `guidance` | heading articles + intent sub-topics | inherited aggregate surface, counter tier |
| `article` | knowledge articles + sub-articles | per-file staleness, orphan check, drift-check eligible |
| `workflow` / `prompt` / `check` | 9xx band | tooling validation |
| `log` | changelogs | append-only, staleness-exempt |

`type: log` resolves the Changelog gray zone: dated history is durable, not ephemera.

**OKF alignment (Option A):** adopt the pattern, keep our field names. Style Guide documents the mapping (name→title, source-files→resource, PAGE.md→index.md, LOG.md→log.md) so an OKF exporter is a rename-transform away. Reference: [OKF SPEC](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) — only required field is `type`; open vocabulary; consumers tolerate unknown keys.

### 16. Types and Tags registry page

`000-Wiki_Guidance/005-Types_and_Tags`. The registry itself is a fenced YAML block inside the page (parseable + human-readable); prose around it explains each entry. The script validates all `type` and tag values against this block. A marker block on the wiki front page pulls the type/tag lists in, so the entry point teaches agents the query vocabulary.

### 17. Tags: facet family only, closed registry, demand-driven growth

- **Facet tags only** (UI, Runtime, Services, CRUD, Persistence, …) — anchored to the architecture's own layer vocabulary. Domain tags are NOT used: section headings + name/description matching already cover domain retrieval.
- Registry entries carry `name` + one-line apply-when. Sub-agents assign tags by picking from the registry — never inventing. Cap ~3–4 tags per page.
- Growth rule: a new tag registers only after a real query has wanted it twice (audit log is the demand signal).

### 18. The universal wiki script

One script, two subcommands sharing one scanner and one state file:

- `audit` — everything in Decisions 1–9 (marker fills, computed edges, zone hashes, freshness, change report).
- `query` — by `type`, `tag`, name/description fragment, and **source path** (absorbs the existing `query-wiki.js`).

Boundary (anti-overthink clause): the script only reads, reports, and writes inside markers. No third subcommand until a need is proven, no config DSL, no daemon.

### 19. Source-path queries (reverse index)

The state JSON's page→sources map is flipped into a sources→pages reverse index each run:

- `query --source <file>` — exact match against claimed sources.
- `query --source <folder>/` — prefix match for everything accountable to that folder.
- Output: name, description, wiki path, type, matched sources — grouped as *articles accountable to this code* and *guidance covering this domain* (via inherited surfaces).

This is the pre-flight query ("what am I accountable to before touching this file?"); the staleness check is the same index driven by git. No embeddings anywhere — the agent reading names/descriptions is the semantic layer.

### 20. Per-page versioning via `.archive/`

Each folder may hold a `.archive/` beside its `PAGE.md`. Dot-prefixed = invisible to every existing scanner (viewer, TOCs, queries, audit) with zero code changes.

- **Sole author is the script** (version-hygiene rule: never manual copies). Trigger: authored-zone hash moved since last run; marker-only regens do not version.
- **Timing:** archived at reseal — each version is a sealed, consistent page. Max one version per page per run.
- **Naming:** `PAGE.<ISO-timestamp>.md` (sortable), plus `versioned: <datetime>` appended to the copy's frontmatter.
- **Retention:** last 10 versions unconditional → latest-per-day for the 10 distinct days preceding that block → delete remainder (~20 files/page max, pruned every run). Retention constants at the top of the script; it ships in the open, users may tune.
- **State vs history split:** `Wiki/.audit-state.json` holds only rebuildable data (hashes, indices, counters), never versioned. `.archive/` holds the only unrebuildable data: content history.

### 21. The appears-in note (symlinked articles)

Not frontmatter — a third script-owned marker block, inserted after frontmatter and above the lead:

```markdown
<!-- appears-in:start -->
> **Note:** This article lives in multiple locations. Home: `<canonical path>` ·
> also appears as `<link path(s)>`. Changes made in any location apply to all of them.
<!-- appears-in:end -->
```

- Rationale: the linked article is the same file (one inode, many paths) — a `symlink:` frontmatter field would be false at the canonical home, and computed data in an authored zone corrupts the intentionality classifier and fires spurious versions.
- The script computes appearances during its realpath scan; inserts, updates, and removes the block as links come and go. Location-neutral phrasing is true at every path. Renders in the viewer under title/description; visible in raw reads.
- Zone-hash rule: authored-zone hashes are computed after stripping ALL marker blocks (section-toc, children, appears-in, vocabulary) — generated updates never classify as intentional edits or trigger versions.
- Symlinked folders: the note goes on the folder's entry `PAGE.md` only; descendants stay clean, their appearance lists live in the state file for queries.

### 22. Event-driven staleness tickets (added 2026-07-15)

The UEB fires whenever a mutation event touches a file listed in some wiki article's `source-files`. A trigger checks the path against the sources→pages reverse index (Decision 19's state JSON — cheap lookup, no scan) and adds a ticket to the inbox naming the article and the mutated file. As mutations continue across a session, the trigger **appends items to the open ticket** rather than creating new ones — one ticket per article with a growing file list, session as the batching boundary.

- Complements Decision 7, doesn't replace it: push (UEB trigger) for live drift, pull (git comparison at audit time) as the backstop for offline/external changes. Same reverse index drives both.
- Once provenance lands, tickets carry the causal chain (thread/turn/tool call that mutated the file) so the wiki-update agent opens the ticket already holding the evidence trail.
- 9xx/tooling pages excluded — only knowledge-layer pages with source claims generate tickets.
- Trigger is user-gated on the UEB like any automation; ticket format is owned by the workspace's wiki-script fork.

## Open Questions (circle back)

1. **Runbook location** — ✅ RESOLVED 2026-07-02: executable runbook + prompts at `008-Workflows/001-Wiki_Audit` (absorbing Sync Wiki Context); `000-Wiki_Guidance/004-Audit_Workflow` stays the intent-layer description pointing at it.
2. **Kill `connected-skills` / `related-trigger-files`?** — ✅ RESOLVED 2026-07-02: killed. See Decision 5.
3. **Intent-layer exemption** — ✅ RESOLVED 2026-07-02: no exemption needed. Intent pages inherit the domain's aggregate source surface (union of the section's knowledge articles' source-files, computed; authored entries add to it). Reported as a domain-commit counter ("N commits since last reviewed"), informational tier only — no sub-agent fires. Orphan detection scoped to knowledge pages. Two check tiers: knowledge = per-file staleness (drift-check eligible); intent = aggregate counter.
4. **Versioning** — ✅ RESOLVED 2026-07-02: per-page `.archive/` folders, script-only authorship, tiered retention. See Decision 20.
5. **State file name/location** — ✅ RESOLVED 2026-07-02: `Wiki/.audit-state.json`, one per workspace wiki, rebuildable and never versioned. See Decision 20.
6. **PageViewer metadata footer** — dropping edges from frontmatter empties the footer until the server enriches content responses from the state file (correct thin-client shape; separate client/server task).

## Implementation Checklist (confirmed work)

### A. Audit system build

- [x] Consolidated script skeleton (2026-07-13): `scripts/wiki.js` with `audit` + `query` subcommands, shared scanner, `Wiki/.audit-state.json`; absorbed and deleted `sync-wiki-tocs.js` + `query-wiki.js`; `wiki-page` type added to the frontmatter catalog
- [x] Maintain `<!-- children:start/end -->` blocks in articles from child frontmatter (2026-07-13; name + description, heading inside the block)
- [ ] Computed edges: outgoing from body links, incoming as reverse index, stored in state JSON
- [ ] **← NEXT (Phase 1.3), parked as of 2026-07-14:** another build is touching the server — tread lightly, resume only on the user's all-clear. When it clears, first decide whether 1.3 builds in place or the script migrates to System Manager first (see `019-System_Manager/CAPTURE.md`). State JSON: zone hashes (frontmatter/lead/body/generated), `lastAuthoredChange`, change-classification report output
- [ ] Git-based source-file freshness: fresh/stale/broken-reference, plus orphan detection on knowledge-layer pages
- [ ] Strip `incoming-edges`, `outgoing-edges`, `connected-skills`, and `related-trigger-files` from all existing page frontmatter (edges now computed; skills/triggers killed)
- [ ] Prune the PageViewer metadata footer sections to match the new frontmatter contract
- [ ] Update Style Guide: four-zone anatomy, what/why/when description rule, per-zone AI authoring instructions
- [ ] Author the article-eval sub-agent prompt (frontmatter + lead vs body)
- [ ] Build the audit runbook page wiring the five-step loop and skepticism criteria (location = Open Question 1)
- [x] Convert Chat System's hand-maintained `## Children` lists to children markers (2026-07-13; all five section pages)
- [x] Exclude 9xx folders from generated children/contents lists (2026-07-13); audit classification as tooling lands with change classification
- [x] Rename generated group label to "Guidance and Preferences" (2026-07-13)
- [ ] Restructure runbook: `008-Workflows/001-Wiki_Audit` with `999-Audit_Prompts/` (five section prompts moved in + new article-eval prompt); `000-Wiki_Guidance/004-Audit_Workflow` becomes the pointer page
- [ ] Create `000-Wiki_Guidance/005-Types_and_Tags` with the fenced YAML registry (types + seeded facet tags); add front-page marker block for the vocabulary
- [ ] Migration pass: stamp `type` on every existing page from position
- [ ] Consolidate scripts: `audit` + `query` subcommands, absorb `query-wiki.js`, shared scanner + state file
- [ ] Query: type/tag/fragment filters + source-path reverse index (file exact, folder prefix), grouped article/guidance output
- [ ] Intent-layer inherited source surfaces + domain-commit counters in the audit report
- [ ] Author the tag-assignment sub-agent prompt (registry-constrained, 3–4 tag cap)
- [ ] Versioning: `.archive/` snapshot on authored change at reseal + tiered retention pruning
- [ ] Appears-in marker block: computed from the realpath scan; zone hasher strips all marker blocks before hashing authored zones
- [ ] Audit state, edges, and dedup key identity by realpath (canonical home tracked once; symlinked appearances navigation-only) — moved from A2; app-side symlink support already shipped
- [ ] Run the full audit once end-to-end as validation

### A2. App-wide symlink support — ✅ COMPLETE 2026-07-13 (one item deferred to Section A)

- [x] Add `symlinkTarget` (resolved origin) to file-explorer tree nodes; surface as badge/tooltip in client trees (`lib/fs/symlinks.js`, `LinkedResourceIndicator.tsx`)
- [x] `wiki-tree.js`: follow symlinked folders (stat-through-link) + cycle guard
- [x] `sync-wiki-tocs.js`: same contract in `listTOCChildren`/walk + cycle guard
- [x] Sweep remaining `withFileTypes` scanners to the shared contract (tickets, components, prompts, triggers, views, view-state, workspace handlers, file-mentions collector) — shared helper `lib/fs/dirents.js`
- [x] Write-lock enforcement resolves realpath before applying path rules (`enforcement.js`)
- [x] File watcher follows symlinked folders (`lib/watch/core.js` `followSymlinks: true`) — smoke-test that events emit under the *linked* path if not yet observed live
- [ ] *(moved to Section A — needs the audit script)* Audit state, edges, and dedup key identity by realpath (canonical home tracked once; symlinked appearances navigation-only)

### B. Paradigm migration sweep

Apply the Chat System pattern per section: heading article gets hand-written guidance + marker block; main articles de-TOC'd (promote `000-` child content into folder `PAGE.md`); sparse clusters merged into right-sized sub-articles; stale folder-level `PAGE.md` files deleted.

Old-style TOC heading articles (current script `no-markers` list):

- [ ] `001-Project/000-Project` (legacy bucket — light touch, content migrating out)
- [ ] `001-Workspaces_And_Views/000-Workspaces_And_Views`
- [ ] `001-Workspaces_And_Views/004-Wiki_View` — de-TOC article tree (`000-Wiki_View`, `001-Architecture/000-Architecture`)
- [ ] `001-Workspaces_And_Views/010-Voice_Input` — de-TOC article tree (`000-Voice_Input`, `001-Architecture/000-Architecture`)
- [ ] `002-System_Tools/000-System_Tools` (legacy bucket)
- [ ] `005-Enforcement/000-Enforcement`
- [ ] `005-Enforcement/001-Code_Standards` — de-TOC (`000-Code_Standards`)

Sections with no `000-` heading article (currently non-clickable labels, no front page):

- [ ] `006-System_Manager` — create heading article (has real content today)
- [ ] `008-Workflows` — create heading article
- [ ] Stubs, create heading articles when populated: `002-Server_And_Runtime`, `003-Automation_And_Agents`, `004-Integrations_And_Tools`, `006-Operations`

### C. Viewer and templates

- [ ] Nav: in-body wiki links should select (left-rail highlight + right sidebar follow), not just view
- [ ] `System_Manager` template wiki copies: refresh to the new paradigm after the sweep

## Additional Gray Zone

- ✅ RESOLVED 2026-07-02: Changelog pages are `type: log` — dated history is durable, append-only, staleness-exempt. They stay in the intent layer. See Decision 15.
