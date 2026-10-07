# Page 01 fact reassignment: Project heading

Status: **REVIEW_READY**. This is a source investigation and proposed migration, not acceptance or a live-wiki edit.

## 1. Assignment and evidence

- Source: `ai/RC-MacAir-15/Wiki/001-Project/000-Project/PAGE.md`; 470 bytes; SHA-256 `2856e3c0fbb5ddb47fc130fe670557a939c54127652fe494d60624c248da76ce`; filesystem mtime `2026-07-03 17:48:59 PDT` (not a verification date). Existing `.versions/2026-08-28-014539.md` matches the current source bytes. Recheck source hash immediately before integration.
- Scope: entire heading page, the sibling `001-Project/PAGE.md` and all twelve sibling child folders; current Wiki Guide and domain front pages; relevant Wiki Style Guide, Creating Wikis, Updating Wikis, Audit Workflow, Capture README, retirement audit, complete Code Standards router, wiki navigation and TOC code. I inspected exact-path incoming references in active wiki/issues/template/tool text and separately noted saved view state.
- Relevant code SHA-256: `fusion-studio-server/lib/wiki/audit/toc-sync.js` `8fa1b29f766bb7142ab89f54b3cf8606cecab0ede458d04004893e3c0ec40b5f`; `fusion-studio-server/lib/wiki/wiki-tree.js` `3840e218342806dc3e350f6f73bf5fc86ccf2e0ce8f`; `fusion-studio-client/src/state/wikiStore.ts` `8d7b2ff56c387aac25de7b87c49383301e008308f8e5eb15aa2eece345e53bb4`.
- Not verified here: the factual contents of the twelve child articles, their proposed new destinations, complete dynamic consumer behavior, template migration, or runtime app behavior. Those are page agents 02–13 and coordinator responsibilities. Code inspection here establishes navigation mechanics, not the accuracy of child topics.

## 2. Complete source-section coverage

- [x] Frontmatter `name`, `description`, `incoming-edges`, `outgoing-edges`, `source-files`, `connected-skills`, `related-trigger-files`: title/description are broad legacy labels; relationship keys are deprecated authored metadata; `source-files: []` is suitable for a navigation page under current Style Guide.
- [x] `# Project` and one-sentence body: repeats the broad description and contains no specific architecture fact.
- [x] `## Children`: one live relative link to `../024-Issue_Viewer_Ticket_Authoring/PAGE.md`. Its target exists. No other body sections, tables, examples, caveats, or links occur in the 470-byte source.

## 3. Claim and route map

`W/` means `ai/RC-MacAir-15/Wiki/`. Destination paths/headings below are proposed until the coordinator reconciles the other reports.

| ID | Original section / claim | Classification and evidence | Disposition; canonical destination and heading | Existing coverage / needed change | Confidence / limit |
|---|---|---|---|---|---|
| P01-F001 | Frontmatter/body: Project is the home for internal architecture, development workflow, and feature documentation. | **Incorrect/superseded as current ownership.** `W/000-Wiki_Guidance/PAGE.md` already calls Project a legacy catch-all, identifies durable domains, and says to write new content there. Style Guide requires heading articles to give intent/navigation and treats durable technical articles as knowledge. | Replace broad current-sounding description with bounded legacy status; route from `W/000-Wiki_Guidance/PAGE.md` `## Status` and from retained source heading `## Where these topics live`. | Guide status exists but Guide's generated Project entry and source description still imply an active general-purpose domain. Narrow update needed. | High for editorial ownership; other reports decide destination claims. |
| P01-F002 | `## Children`: Issue Viewer Ticket Authoring is the heading's sole child link. | **Current navigation fact, pending reassignment.** Relative target resolves and sibling `W/001-Project/PAGE.md` also links it. Assignment maps this article with Ticket Routing to `W/003-Automation_And_Agents/002-Ticketing/PAGE.md`; that destination does not yet exist. | Retain a route to the source until page 13's unique writing criteria are verified and integrated. Then point readers to proposed `W/003-Automation_And_Agents/002-Ticketing/PAGE.md` `## Writing a ticket that appears on the board` (exact heading to reconcile with pages 11/13). | No verified canonical replacement yet. Source heading must not erase this link early. | High that link exists; destination content depends on agents 11/13. |
| P01-F003 | Heading's implied route map: one child appears to be the Project subject inventory. | **Incomplete navigation.** `W/001-Project/PAGE.md` lists twelve sibling topic pages, while heading lists only one. `toc-sync.js` `listTOCChildren`/`generateHeadingTOC` can enumerate all siblings, but `syncHeadingArticle` updates only an opted-in `section-toc` marker block; this heading has none. Style Guide prefers the heading as front page and no duplicate folder PAGE. | Add the supported generated marker block to the retained heading, generated in the coordinator's disposable staging copy, after source-route changes. Keep all still-live child links reachable through the heading until their successors are verified. Final navigation to durable domains belongs in Guide and each domain front page. | Existing duplicate sibling TOC carries twelve links but conflicts with heading ownership; generated heading block is absent. | High for code/bytes; coordinator must verify generated output and final child set. |
| P01-F004 | Legacy frontmatter relationship metadata says `incoming-edges: Wiki Guide` and `outgoing-edges: Issue Viewer Ticket Authoring`. | **Deprecated duplicate of body-link information.** Current Style Guide and Updating Wikis explicitly forbid maintaining incoming/outgoing edge lists, connected-skills, and related-trigger-files. One active Guide body link and one active heading child link are real; metadata should not be used as a link registry. | On an actual heading edit, remove relationship keys, retain verified `source-files: []`, and add actual quoted UTC `last-modified`. Destination: the heading page's frontmatter only, with Guide body links authoritative. | Metadata has not been modernized. | High; exact edit timestamp must be generated at write time. |

### Sibling inventory and provisional domain route

The sibling `W/001-Project/PAGE.md` presently links every listed topic. All twelve folder targets exist. This inventory preserves navigation only; it does **not** certify topic claims or new paths. Except 024, the source heading lacks links to these siblings.

| Sibling article under `W/001-Project/` | Provisional canonical owner / coordinating report |
|---|---|
| `001-Home/PAGE.md` | Guide or user-preferences guidance; page 02 |
| `004-Path_Resolution/PAGE.md` | Server And Runtime path resolution; page 03 |
| `013-Background_Agents/PAGE.md` | Automation And Agents background agents; page 04 |
| `014-Background_Services_Audit/PAGE.md` | Server And Runtime background services plus operations lessons; page 05 |
| `017-GitLab/PAGE.md` | Integrations And Tools GitLab; page 06 |
| `018-Hooks/PAGE.md` | Audit Workflow/Style Guide for document policy; runtime owner for actual hooks; page 07 |
| `019-Run_Auditing/PAGE.md` | Automation And Agents run auditing; page 08 |
| `020-Screenshot_Capture/PAGE.md` | Integrations And Tools screenshot capture; page 09 |
| `021-Setup_Wizard/PAGE.md` | Operations setup; page 10 |
| `022-Ticket_Routing/PAGE.md` | Automation And Agents ticketing; page 11 |
| `023-Warmth_Settings/PAGE.md` | Chat Runtime Model and Server And Runtime background services; page 12 |
| `024-Issue_Viewer_Ticket_Authoring/PAGE.md` | Automation And Agents ticketing; page 13 |

## 4. Proposed integrated prose and metadata

### `W/000-Wiki_Guidance/PAGE.md` `## Status` and generated `## Wiki Sections`

The Guide already gives the correct broad direction. Refine its status only after reports 02–13 and domain destinations are integrated:

> **Legacy routes:** Project retains links to its original pages while their verified facts are moved to the owning domains. Start with [Workspaces And Views](../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md), [Server And Runtime](../002-Server_And_Runtime/PAGE.md), [Automation And Agents](../003-Automation_And_Agents/PAGE.md), [Integrations And Tools](../004-Integrations_And_Tools/PAGE.md), or [Operations](../006-Operations/PAGE.md) for current subject guidance. The Project pages are predecessor routes, not a new-content home.

The `## Wiki Sections` block is generated. Do not hand-edit its Project entry. Its description comes from the heading's frontmatter via `toc-sync.js#extractDescription`, so changing the heading description and running staged generation should replace the current catch-all wording. `source-files: []` remains appropriate for Guide text without a direct code subject; retain its other actual source metadata only if source accountability is verified in the coordinator's edit.

### Retained `W/001-Project/000-Project/PAGE.md` `## Where these topics live`

Suggested successor route after child content has been reconciled:

> This is the legacy Project section. Current architecture and task guidance live in [Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md), [Server And Runtime](../../002-Server_And_Runtime/PAGE.md), [Automation And Agents](../../003-Automation_And_Agents/PAGE.md), [Integrations And Tools](../../004-Integrations_And_Tools/PAGE.md), and [Operations](../../006-Operations/PAGE.md). Use [Wiki Guidance](../../000-Wiki_Guidance/PAGE.md) to choose a domain. The original child pages below remain as routes to their successors until a separate retirement pass removes them.

Set `description` to a truthful legacy-route description, keep `metadata.source-files: []`, remove deprecated relationship metadata, and set the quoted UTC `last-modified` to actual edit time. Add `<!-- section-toc:start -->` and `<!-- section-toc:end -->` outside authored prose; allow the staged audit to populate the intervening child list. **Do not insert a manually authored twelve-link list inside the markers.** If the coordinator has not yet migrated a child, label it as an old source in prose rather than asserting that its claims are current. If all child source pages remain at the end of this pass, the generated list will still list them, so their own successor routes and the Guide wording must be clear.

Suggested exact source-file metadata for both navigation articles: `[]` (the navigation itself describes no product code). `toc-sync.js` is supporting verification evidence, not automatically a subject of the Project heading.

## 5. Exclusions and historical record

- Exclude the active claim that Project is the general home for current internal architecture/development/features. Its exact predecessor remains in the source's `.versions` and the coordinator's required new preimage; the source page becomes a bounded legacy route.
- Exclude relationship metadata as a routing contract. Current Style Guide uses body links and `source-files` plus timestamp; the old metadata remains in preserved versions.
- Do not copy the sibling TOC's descriptive claims into the heading as current facts. Several child topics have obsolete or mixed-status content. Generate only links, then let their dedicated reports establish successor facts.
- Do not use the obsolete Sync Wiki Context workflow as a regeneration method. `W/000-Wiki_Guidance/004-Audit_Workflow/PAGE.md` currently links it, but the assignment explicitly forbids its use and the retirement audit flags its stale routing/status examples.

## 6. Incoming references, link defects, and shared destinations

- **Active exact incoming authored link:** 1 owner, `W/000-Wiki_Guidance/PAGE.md` generated `## Wiki Sections` line 46, `../001-Project/000-Project/PAGE.md`. The sibling `W/001-Project/PAGE.md` has no resolving authored link to this heading; it is a duplicate navigation page slated for a separate pass. There are no other exact-path authored source/tool links in the searched active wiki, Issues, templates, and product source; this is not proof against dynamic consumers.
- **Saved/runtime references:** `ai/RC-MacAir-15/System/Views/004-wiki-viewer/state/state.json` records `001-Project/000-Project` and `.../PAGE.md` in recent navigation entries. It is runtime state and out of scope for edits. `wikiStore.ts#setRoot` filters persisted navigation entries by current tree, but the coordinator should test the actual retirement path in the later deletion pass rather than infer every client behavior from this single branch.
- **Historical inputs:** the existing `.versions` snapshot, retirement audit, and prior Capture proposals mention this path. Preserve them unchanged; they are not live navigation owners.
- **Broken slug example adjacent to migration:** `W/008-Workflows/001-Sync_Wiki_Context/005-Status/PAGE.md` shows `[Project](001-Project/PAGE.md)` from a nested workflow page, which does not resolve to the current Project page and targets the duplicate TOC form. It is an obsolete example in a seven-page workflow outside this pass. The coordinator may make only a narrow supporting fix if necessary; never rely on that workflow to regenerate Guide.
- **Shared destinations/conflicts:** Guide with pages 02, 14, and 19; Automation Ticketing with pages 11 and 13. Domain front pages must be updated only once after all topic reports. If the Project heading is edited while the duplicate sibling TOC remains, the two navigation lists can disagree; final verification must compare the heading's generated links to all live siblings.

## 7. Unresolved items

| Type | Item | Recommended resolution |
|---|---|---|
| Researchable fact | Which of the twelve child topics have a verified canonical destination and a completed source route after integration? | Coordinator reconciles pages 02–13 against actual destination bytes, then regenerates/validates heading navigation. |
| Editorial implementation choice | Whether to leave the generated old-child list visible after all routes are integrated. | Keep it in this non-deletion pass because the folders remain; bound the prose and child pages as predecessor routes. Remove the section only in a later coordinated retirement. |
| Researchable behavior | Whether any indirect wiki consumers require the exact heading path beyond the Guide link and saved view state. | Re-scan product/template references and smoke the wiki navigation when the separate deletion pass is proposed; do not edit runtime state now. |
| Indispensable owner decision | None identified for this navigation-only page. Destination details belong to the topic reports and owner-approved contracts. | No owner pause needed for this page. |

## 8. Retirement readiness

**Retain during this fact-reassignment pass. Ready for a later physical retirement only after:** all twelve child reports are integrated into verified canonical articles; each still-live predecessor is a clear route or justified historical source; Guide/domain navigation is updated and generated blocks are stable; the duplicate `001-Project/PAGE.md` dependency is handled in its separate cleanup pass; active and saved-path consumers are checked; and removing the `000-` heading is coordinated with the remaining Project folder. `wikiStore.ts#findHeadingArticle` makes a section without a `000-` child non-clickable, so deleting only this heading while retaining the section would degrade navigation. No source or wiki deletion was performed.
