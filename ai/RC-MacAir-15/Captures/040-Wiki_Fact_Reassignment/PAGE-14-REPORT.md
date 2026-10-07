# PAGE-14 — System Tools heading fact reassignment

Status: **REVIEW_READY**. This is an investigation and proposed integration, not migration acceptance. No live wiki, product, template, issue, state, or historical file was edited.

## 1. Assignment and evidence boundary

- Assigned source: `ai/RC-MacAir-15/Wiki/002-System_Tools/000-System_Tools/PAGE.md` (581 bytes; SHA-256 `d1faa0b9bf69199398958a472b7bb8e16204ada860c0ce89d777d47bd5a1d1ff`; filesystem mtime `2026-07-03T17:48:59-0700`). The mtime is file metadata, not a fact-verification date.
- Read the complete source, its three child page introductions and the duplicate folder-level `002-System_Tools/PAGE.md`; the live Wiki Guidance, Integrations And Tools and Frontend UI Standards destinations; Captures README and retirement audit; all four Wiki Guidance rule pages; and the complete Code Standards router. The source's three relative child links resolve to existing `PAGE.md` files.
- Inspected `fusion-studio-server/lib/wiki/audit/toc-sync.js` (SHA-256 `8fa1b29f766bb7142ab89f54b3cf8606cecab0ede458d04004893e3c0ec40b5f`) and `fusion-studio-server/lib/wiki/wiki-tree.js` (`3840e218342806dc3e350f6f73bf0c9a8d68d5c70382963bf5fc86ccf2e0ce8f`) for navigation behavior. The auditor selects a `000-` heading as the TOC owner and does not regenerate the folder-level duplicate. The heading currently has no `section-toc` markers, so the auditor skips filling it. The tree still reads folder pages as nodes; deletion is a separate operation.
- The live Guide was SHA-256 `4a457925f8be92d8044f05a4dc57a969e84b29a981a9575915219f08bf5cebe1`; Integrations And Tools was `429077376fc4baa919d4bceb87a8f25332f65ebb20c70e6167e474634953c763`. These hashes are read-time identities; the coordinator must recheck fresh bytes before integration.
- I did not verify child-page technical recipes, secret access, clipboard runtime enforcement, user-visible navigation, or the proposed new destination pages. Agents 15–17 own those factual checks. I ran no app, setup example, wiki audit, or product test.

## 2. Source-section coverage

| Source portion | Coverage |
|---|---|
| Frontmatter `name` and `description` | P14-F001: historic bucket name and broad description. |
| Frontmatter `incoming-edges`, `outgoing-edges`, `source-files`, `connected-skills`, `related-trigger-files` | P14-F002: legacy relationship metadata; `source-files: []` is appropriate for a navigation-only page. |
| `# System Tools` and one-sentence introduction | P14-F001: duplicates frontmatter description; no unique implementation fact. |
| `## Children`: Custom Theme CSS | P14-F003: existing valid child route. |
| `## Children`: Secrets Manager | P14-F004: existing valid child route. |
| `## Children`: Clipboard History | P14-F005: existing valid child route. |

The page has no examples, tables, caveats, technical claims, or hidden additional sections. Its distinct useful content is three working navigation links. The folder-level `002-System_Tools/PAGE.md` duplicates those three links but is outside this page-agent assignment and outside the 19-source migration pass.

## 3. Claim and disposition table

`W/` means `ai/RC-MacAir-15/Wiki/`. Proposed new destinations remain contingent on agents 15–17 and coordinator reconciliation.

| ID | Original claim/section | Classification | Evidence | Disposition; one canonical destination + heading | Existing coverage / needed change | Confidence / limit |
|---|---|---|---|---|---|---|
| P14-F001 | “System Tools” is a bucket for internal tools and operational references for maintaining Fusion Studio. | Historical taxonomy; overbroad as a current ownership description. | Source frontmatter/body; `W/000-Wiki_Guidance/PAGE.md` Status calls it a legacy bucket moving to durable domains; `W/004-Integrations_And_Tools/PAGE.md` is the current tools router; `W/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md` owns UI standards. | Keep as a clearly historical route in the predecessor; current cross-domain navigation belongs in `W/000-Wiki_Guidance/PAGE.md` `## Status` and `## Wiki Sections` until physical retirement. | Guide already names the legacy status but its generated section entry still describes this as current internal tools. Revise heading description so staged generation can render a truthful route; update Guide's hand-written status after child migration. | High for document ownership; no runtime product claim. |
| P14-F002 | Relationship metadata declares incoming Guide and outgoing three children; empty source/skill lists. | Superseded authored schema; `source-files: []` is valid. | `W/000-Wiki_Guidance/001-Style_Guide/PAGE.md` `## Frontmatter Contract` and `## Source Accountability`; `W/000-Wiki_Guidance/003-Updating_Wikis/PAGE.md` `## Source Files And Modification Time`. Actual Guide link and child links were rechecked; metadata graph is not the authority. | On any edit to `W/002-System_Tools/000-System_Tools/PAGE.md`, retain `metadata.source-files: []`, drop edge/skill/trigger keys, add quoted actual UTC `last-modified`. No separate canonical page is needed beyond Style Guide `## Frontmatter Contract`. | Rule already exists; source metadata must be normalized when edited. | High. |
| P14-F003 | Custom Theme CSS is a child readers can open. | Current navigation fact; destination subject ownership proposed. | `W/002-System_Tools/001-Custom_Theme_CSS/PAGE.md` exists (SHA-256 `febd215113906c999f184e2c182c5142b75594ce54d0ecb61eb454580243c485`); source relative link resolves; `W/004-Integrations_And_Tools/PAGE.md` has planned `005-Custom_Theme_CSS/` and a migration-source link. | Route current reader task to proposed `W/004-Integrations_And_Tools/005-Custom_Theme_CSS/PAGE.md` `# Custom Theme CSS`, with architecture link to `W/005-Enforcement/002-Themes_And_State/PAGE.md` as agent 15 verifies. Keep source child link while that child remains live. | New article not yet present at read time; page 15 owns facts and final route. | High that link exists; destination content unverified. |
| P14-F004 | Secrets Manager is a child readers can open. | Current navigation fact; destination subject ownership proposed. | `W/002-System_Tools/002-Secrets_Manager/PAGE.md` exists (SHA-256 `516c2b69cade6c657b0d937521c884130f3d7e5b0f453a65a505264a1964ea7a`); source relative link resolves; Integrations has planned `002-Secrets_Manager/` and a migration-source link. | Route current reader task to proposed `W/004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md` `# Secrets Manager` after agent 16's verification. Keep source child link while that child remains live. | New article not yet present; page 16 owns credential and redaction claims. | High that link exists; technical content unverified. |
| P14-F005 | Clipboard History is a child readers can open. | Current navigation fact; policy owner is elsewhere. | `W/002-System_Tools/003-Clipboard_History/PAGE.md` exists (SHA-256 `fe165b56f579a5cfbae746c29ec3b54d29418ac1b29ea1aeba2b2b877110602a`); source relative link resolves; Frontend UI Standards exists and is the assigned policy owner for page 17. | Route current reader task to `W/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md` proposed `## Clipboard actions` after agent 17 verifies the policy. Keep source child link while that child remains live. | Frontend UI Standards has no clipboard section yet; agent 17 must supply verified policy text. | High that link exists; enforcement unverified. |

## 4. Proposed destination and retained-source prose

These are concise navigation suggestions, **not** permission to publish unverified child facts. The coordinator should integrate against fresh page bytes after agents 15–17 finish.

### `W/000-Wiki_Guidance/PAGE.md` — `## Status` / generated `## Wiki Sections`

> System Tools is a legacy navigation section. For current custom theme and secrets guidance, start with [Integrations And Tools](../004-Integrations_And_Tools/PAGE.md). For app clipboard-copy rules, start with [Frontend UI Standards](../005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md). The older child pages remain available as migration routes until their retirement prerequisites are met.

The Guide's `## Wiki Sections` block is script-owned. Do not hand-edit it; set the legacy heading's accurate description and import only the intended staged generator result. If the folder still exists, the generated list will still include it, so the description must identify its legacy routing role.

### `W/004-Integrations_And_Tools/PAGE.md` — `## Tool Guidance`

> For verified tool instructions, see [Secrets Manager](002-Secrets_Manager/PAGE.md) and [Custom Theme CSS](005-Custom_Theme_CSS/PAGE.md). The latter links to [Themes and State](../005-Enforcement/002-Themes_And_State/PAGE.md) for the architecture contract.

Publish these links only after agents 15–16 establish the actual destination files. Replace the current “Planned Children” labels with truthful status. Exact source-file metadata for this navigation-only page may remain `[]`; article-specific source files belong to the child reports.

### `W/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md` — proposed `## Clipboard actions`

No policy prose is imported from this navigation page. Agent 17 should integrate the verified clipboard rule here, and the Guide/legacy heading should link to it. Exact code source-file suggestions are agent 17's responsibility; none arise from page 14.

### `W/002-System_Tools/000-System_Tools/PAGE.md` — legacy route during this pass

> # System Tools
>
> This legacy section routes to current tool guidance and clipboard standards. Use [Integrations And Tools](../../004-Integrations_And_Tools/PAGE.md) for Custom Theme CSS and Secrets Manager, and [Frontend UI Standards](../../005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md) for clipboard-copy rules. The child pages below remain linked while they are live.
>
> <!-- section-toc:start -->
> <!-- section-toc:end -->

If the coordinator chooses the marker approach, create only the empty marker pair in authored prose and let the staged audit populate the three live children. The proposed frontmatter description is “Legacy routes to tool guidance and clipboard standards while source articles remain available.” `metadata.source-files` stays `[]`; use an actual write-time UTC timestamp. If no marker is introduced, retain the explicit `## Children` links until every child is safely retired. Do not remove this page's child routes simply because the Guide links to new destinations.

## 5. Material excluded from current prose

- Do not repeat “internal tools and operational references for maintaining Fusion Studio” as an authoritative current domain definition. It blurs user-facing CSS/Secrets tasks with the clipboard UI policy. The exact original wording remains in the preserved preimage/version and current source until the coordinator changes it.
- Do not carry forward `incoming-edges`, `outgoing-edges`, `connected-skills`, or `related-trigger-files`. Current Style Guide explicitly removes that authored graph. The ordinary links are the navigation evidence.
- Do not duplicate the technical content of pages 15–17 into the Guide or this legacy heading. Their owners must verify and place those facts.

## 6. Incoming references, navigation dependencies, and conflicts

- **One exact active Markdown incoming owner** for this source: `W/000-Wiki_Guidance/PAGE.md`, generated `## Wiki Sections`, line 49 at read time. The parent run's `INCOMING-BASELINE.md` agrees. This is the only live wiki/Issues Markdown file found linking exactly to `002-System_Tools/000-System_Tools/PAGE.md`.
- The source has three valid outgoing child links. The duplicate `W/002-System_Tools/PAGE.md` also links to all three children, but has no exact active incoming Markdown owner. Its physical retirement is a separate duplicate-TOC task.
- `W/004-Integrations_And_Tools/PAGE.md` links directly to old Secrets and CSS child pages; it does not link to this heading. After destination creation those links need redirection, coordinated with agents 15–16.
- `W/008-Workflows/001-Sync_Wiki_Context/005-Status/PAGE.md` contains `[System Tools](002-System_Tools/PAGE.md)` relative to its own folder. That path does not resolve to this source or the duplicate TOC. The workflow is stale and outside this page's edit ownership; flag for the coordinator's narrow support repair. It also says “read its `PAGE.md`,” which misses the `000-` heading rule.
- `ai/RC-MacAir-15/Issues/inbox/RCC-0102.md` and `RCC-0109.md` mention System Tools textually, not as an exact link to this heading. `RCC-0094.md` points to the old Secrets child, not this heading. Preserve issue meaning and handle child reference separately.
- `ai/RC-MacAir-15/System/Views/004-wiki-viewer/state/state.json` has three `pagePath` occurrences for this heading. It is mutable viewer state, not authored navigation; do not edit it. Its existence is a physical-retirement dependency, not a blocker to fact migration.
- `System_Manager/ai-template/Wiki/PAGE.md` and `System_Manager/ai-v2/RC-MacAir-15/Wiki/PAGE.md` link to their own folder-level System Tools copies; their Integrations copies link to their own old CSS/Secrets children. These are shipped/template-local routes, not live incoming links to this assigned file. The template issue copies also carry old slug references. Leave template trees untouched in this pass and list as later template cleanup.
- No hardcoded exact heading path was found in inspected active client/server source; that bounded text search does not prove all dynamic references absent. The wiki scanner traverses folders and may retain this heading in navigation while the folder exists.
- Shared ownership: agents 15–16 and Integrations And Tools; agent 17 and Frontend UI Standards; coordinator with Guide and the duplicate TOC. The Guide status claim must stay consistent with actual destination creation. No technical disagreement is decided by this navigation report.

## 7. Unresolved items and recommended resolution

| Type | Item | Recommended resolution |
|---|---|---|
| Researchable fact | Do agents 15–17 produce verified destination content and route old child pages without losing unique instructions? | Coordinator checks reports and integrated bytes, then updates this heading/Guide. Until then retain all three source child links. |
| Researchable navigation | Does staged generated navigation list all retained children and resolve after edits? | Add marker only if desired, run the required disposable-copy audit twice, import stable intended blocks, validate links. A retained explicit child list also works while no marker is present. |
| Editorial choice | Should Guide keep an explicit legacy section entry until physical retirement? | Yes while the section exists; generated root listing will include it. Make its description accurate and link durable owners in hand-written Guide status. |
| Later implementation/cleanup | How should saved wiki-viewer state and shipped templates handle physical removal? | Separate retirement/template pass; do not mutate runtime state or templates in this fact pass. |
| Indispensable owner decision | None for page 14. | Navigation can be resolved from current guidance and verified destination files. |

## 8. Retirement readiness

**Ready for physical retirement only after prerequisites**, not now: agents 15–17's retained facts must be integrated and verified at their canonical homes; the Guide and Integrations routes must point to those homes; the stale workflow link and any remaining authored references must be repaired; live child pages must each have a safe disposition; staged navigation must show every still-live child; saved viewer state/template references must be handled by the separate retirement plan. The source heading should remain as a short, truthful route during this pass, with complete predecessor preserved before a substantive rewrite. No deletion was performed.
