# Wiki retirement audit — 2026-09-27

Status: proposed cleanup inventory; no deletion or migration executed. Read-only researcher: `/root/wiki_retirement_audit`. Parent recorded the findings. Repository: `/Users/rccurtrightjr./projects/fs-dev`. No product/runtime changes, mutating wiki audit, or historical-file changes.

## Findings and scope

189 live PAGE.md files across 15 sections, excluding .versions. 34 distinct cleanup candidates: 8 duplicate TOCs, 19 other legacy pages, 7 workflow pages to repair. The other 155 pages are keep/reverify. These are not 34 authorized deletions. No whole legacy bucket is ready for immediate removal.

All pages inventoried/triaged; focused content inspection of legacy sections, workflow, Wiki/Voice and overlapping Fusion Home material. This is not factual recertification of all189 pages. Code inspected selectively for material conflicts and generator behavior.

| Section | Pages |
|---|---:|
| 000-Wiki_Guidance | 6 |
| 001-Project | 14 |
| 001-Workspaces_And_Views | 46 |
| 002-Server_And_Runtime | 1 |
| 002-System_Tools | 5 |
| 003-Automation_And_Agents | 1 |
| 004-Integrations_And_Tools | 1 |
| 005-Enforcement | 15 |
| 006-Operations | 1 |
| 006-System_Manager | 2 |
| 007-Chat_System | 38 |
| 008-Workflows | 7 |
| 009-Fusion_Home | 19 |
| 010-Events_And_Ledger | 24 |
| 011-Platform_And_Plugins | 9 |

## Paths and incoming references

`W/` below expands exactly to `ai/RC-MacAir-15/Wiki/`. Counts mean distinct active owner files, not occurrences. The scan included resolving Markdown links and literal full/current or ai/<machine>/Wiki paths in searchable repository text. Historical captures, .versions, Alpha copies and template-local links are separated; broken slugs and workflow examples require additional repair and are not resolving-link counts. Recheck references immediately before future writes.

Owner abbreviations: Guide = W/000-Wiki_Guidance/PAGE.md; Project TOC = W/001-Project/PAGE.md; Project heading = W/001-Project/000-Project/PAGE.md; Tools TOC = W/002-System_Tools/PAGE.md; Tools heading = W/002-System_Tools/000-System_Tools/PAGE.md; Runtime = W/002-Server_And_Runtime/PAGE.md; Automation = W/003-Automation_And_Agents/PAGE.md; Integrations = W/004-Integrations_And_Tools/PAGE.md; Operations = W/006-Operations/PAGE.md; Background Agents = W/001-Project/013-Background_Agents/PAGE.md; Ticket Routing = W/001-Project/022-Ticket_Routing/PAGE.md; Workflow = W/008-Workflows/001-Sync_Wiki_Context/PAGE.md; Audit guidance = W/000-Wiki_Guidance/004-Audit_Workflow/PAGE.md. Issue N = ai/RC-MacAir-15/Issues/inbox/RCC-N.md.

## A — Repair seven maintenance pages first

| Exact page under W | Treatment | Incoming owners |
|---|---|---|
| 008-Workflows/PAGE.md | Keep routing purpose; update description after workflow repair. | 1: Guide |
| 008-Workflows/001-Sync_Wiki_Context/PAGE.md | Replace obsolete relationship metadata example/script name; correct link bases relative to Guide; require version/timestamp rules for writes. | 2: Audit guidance, Workflows root |
| 008-Workflows/001-Sync_Wiki_Context/001-What_Is_This/PAGE.md | Keep bounded orientation prompt; align with repaired parent. | 1: Workflow |
| 008-Workflows/001-Sync_Wiki_Context/002-How_Its_Organized/PAGE.md | Remove rule treating folder PAGE as TOC even when 000 heading exists. | 1: Workflow |
| 008-Workflows/001-Sync_Wiki_Context/003-Domains/PAGE.md | Prefer canonical heading; correct example links relative to Guide. | 1: Workflow |
| 008-Workflows/001-Sync_Wiki_Context/004-Wiki_System/PAGE.md | Route to W/001-Workspaces_And_Views/004-Wiki_View/000-Wiki_View/PAGE.md with correct link base. | 1: Workflow |
| 008-Workflows/001-Sync_Wiki_Context/005-Status/PAGE.md | Remove child-folders = fully-built-out inference. Separate documentation coverage, source verification, approved intent and shipped behavior. | 1: Workflow |

Related support edits outside the34 count: Guide's status is misleading (Chat/Enforcement fully built out; Events omitted; substantial Runtime called stub). Audit guidance overgeneralizes skipped(no-markers) as migration work: legitimate ordinary articles need not have generated markers. Repair narrowly. No need to move the workflow into a skill/plugin to do this cleanup.

## B — Eight duplicate TOCs

All eight are navigation-only. Their replacement headings currently lack section-toc markers. Project's heading lists only one child; Wiki/Voice Architecture headings list none. Preserve complete useful navigation before deleting any TOC. Add authorized generated blocks or appropriate explicit links, fix incoming owners and preserve exact preimages.

| Retire proposed page under W | Existing replacement under W | Active incoming owners |
|---|---|---|
| 001-Project/PAGE.md | 001-Project/000-Project/PAGE.md | 0 resolving exact references |
| 002-System_Tools/PAGE.md | 002-System_Tools/000-System_Tools/PAGE.md | 0 |
| 005-Enforcement/PAGE.md | 005-Enforcement/000-Enforcement/PAGE.md | 0 |
| 005-Enforcement/001-Code_Standards/PAGE.md | 005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md | 5: Enforcement TOC; Issue0096; ai/RC-MacAir-15/Issues/content/tickets.json; System_Manager/ai-template/Issues/inbox/RCC-0096.md; System_Manager/ai-v2/RC-MacAir-15/Issues/inbox/RCC-0096.md |
| 001-Workspaces_And_Views/004-Wiki_View/PAGE.md | 001-Workspaces_And_Views/004-Wiki_View/000-Wiki_View/PAGE.md | 1: Guide |
| 001-Workspaces_And_Views/004-Wiki_View/001-Architecture/PAGE.md | 001-Workspaces_And_Views/004-Wiki_View/001-Architecture/000-Architecture/PAGE.md | 1: Wiki View TOC |
| 001-Workspaces_And_Views/010-Voice_Input/PAGE.md | 001-Workspaces_And_Views/010-Voice_Input/000-Voice_Input/PAGE.md | 0 |
| 001-Workspaces_And_Views/010-Voice_Input/001-Architecture/PAGE.md | 001-Workspaces_And_Views/010-Voice_Input/001-Architecture/000-Architecture/PAGE.md | 1: Voice Input TOC |

Read-only generator inspection: fusion-studio-server/lib/wiki/audit/toc-sync.js, lib/wiki/audit/run.js and scripts/wiki.js. A folder with a000 child takes the heading branch and does not regenerate its folder PAGE. Existing duplicates are not automatically removed. Headings without markers are skipped. Folders without headings can still receive generated TOCs. Generated metadata remains legacy and the generator does not timestamp; audit also writes state. Use staged generation during cleanup; no live unbounded audit. Retiring only a root while retaining live children does not retire a section.

## C–E — Nineteen other legacy pages

Paths are exact under W. “New” destinations are proposals and do not exist yet; migration must establish factual coverage before removal. Incoming references include owners that may themselves retire in earlier batches.

| Candidate | Treatment / destination / prerequisite | Incoming owners |
|---|---|---|
| 001-Project/000-Project/PAGE.md | Retire catch-all after all Project migrations; useful routing goes to Guide. | 1: Guide |
| 001-Project/001-Home/PAGE.md | Retire old identity/broken slug map. Preserve useful local-first/progressive-disclosure principles in Guide and historical preimage. | 2: Project TOC, Issue0102 |
| 001-Project/004-Path_Resolution/PAGE.md | Replace old kimi-ide-server/pseudo-workspace/ai/workspaces architecture. False claim that path.resolve follows symlinks. Preserve lessons only after current containment/resolver trace. New 002-Server_And_Runtime/007-Path_Resolution/PAGE.md; link View Architecture. | 2: Project TOC, Runtime |
| 001-Project/013-Background_Agents/PAGE.md | Migrate worker/workflow layout and trigger types/actions; preserve distinction between trigger action and actual worker spawning; reverify. New 003-Automation_And_Agents/005-Background_Agents/PAGE.md; align provenance/plugin boundaries. | 5: Project TOC, Automation, Ticket Routing, Issues0100/0102 |
| 001-Project/014-Background_Services_Audit/PAGE.md | Extract durable source-verified ownership, opt-ins, safety/logging; retire May30 investigation from live navigation. Summary/patch notes/tables conflict. New 002-Server_And_Runtime/006-Background_Services/PAGE.md and 006-Operations/004-Troubleshooting/PAGE.md. | 3: Project TOC, Runtime, Operations |
| 001-Project/017-GitLab/PAGE.md | Migrate verified support/gaps; retire personal namespace, old helper and dated token expiry as operating instructions. New 004-Integrations_And_Tools/001-GitLab/PAGE.md. No credential inspection/rotation. | 2: Project TOC, Integrations |
| 001-Project/018-Hooks/PAGE.md | Retire proposed edge/index graph and old wiki/hooks.js contract; retain source accountability in existing 000-Wiki_Guidance/004-Audit_Workflow/PAGE.md and Style Guide. Actual watcher behavior needs separate runtime evidence. | 3: Project TOC, Runtime, Integrations |
| 001-Project/019-Run_Auditing/PAGE.md | Migrate frozen instructions/input/output evidence/quality review. Do not import edge propagation or automatic30/90-day destruction as policy. New 003-Automation_And_Agents/004-Run_Auditing/PAGE.md, link provenance. | 4: Project TOC, Automation, Background Agents, Ticket Routing |
| 001-Project/020-Screenshot_Capture/PAGE.md | Separate personal desktop symlink recipe from app panel screenshots. Correct false inherent-read-only symlink claim. New 004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md; verify paths, preserve opt-in/privacy intent. | 2: Project TOC, Integrations |
| 001-Project/021-Setup_Wizard/PAGE.md | Replace Kimi-auth/old-client instructions with current onboarding. New 006-Operations/001-Setup/PAGE.md; separate optional changes and Alpha deployment. | 2: Project TOC, Operations |
| 001-Project/022-Ticket_Routing/PAGE.md | Merge/reverify with authoring article into new 003-Automation_And_Agents/002-Ticketing/PAGE.md; link existing Issues View. Preserve board JSON/detail Markdown distinction; current UI categorizes tickets while creation script writes different index.json, a scoped gap; recheck IDs/worker claims. | 4: Project TOC, Automation, Background Agents, Issue0102 |
| 001-Project/023-Warmth_Settings/PAGE.md | Replace broad FIFO/TTL/process/cost/robin.db claims. Merge verified chat lifecycle into existing 007-Chat_System/006-Runtime_Model/PAGE.md; non-chat policy into new Runtime Background Services with proposal labels as needed. | 2: Project TOC, Runtime |
| 001-Project/024-Issue_Viewer_Ticket_Authoring/PAGE.md | Merge unique writing criteria and Markdown+JSON requirements into new Ticketing article. | 2: Project TOC, Project heading |
| 002-System_Tools/000-System_Tools/PAGE.md | Retire only after3 child subjects migrate; replace Guide routing. | 1: Guide |
| 002-System_Tools/001-Custom_Theme_CSS/PAGE.md | Rewrite recipe, verify old directories/cascade/source edits against protected-plugin model. New 004-Integrations_And_Tools/005-Custom_Theme_CSS/PAGE.md; link existing 005-Enforcement/002-Themes_And_State/PAGE.md. | 3: Tools TOC, Tools heading, Integrations |
| 002-System_Tools/002-Secrets_Manager/PAGE.md | Preserve credential-name discovery/failure handling/redaction; verify identifiers/platform support. New 004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md. ROBIN_DB still exported in startup: old name alone does not prove obsolete behavior. | 4: Tools TOC, Tools heading, Integrations, Issue0094 |
| 002-System_Tools/003-Clipboard_History/PAGE.md | Merge app-copy writeAndRecord and redaction policy into existing 005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md. Named API still exists; do not discard unique policy. | 2: Tools TOC, Tools heading |
| 006-System_Manager/001-Workspaces_&_Views/PAGE.md | Retire routing duplicate; retain update-canonical-docs-first rule in existing 001-Workspaces_And_Views/011-System_Manager/PAGE.md. | 1: System Manager root |
| 006-System_Manager/PAGE.md | Retire after links point to same existing System Manager view article. Fix surrounding Fusion Home shipped-composition claims rather than merely relink. | 3: Guide; 009-Fusion_Home/000-Fusion_Home/PAGE.md; its002-Vision/PAGE.md |

Preserve complete predecessors with current .versions/Git rules. Do not rewrite old snapshots or leave archived PAGE trees in ordinary live navigation. This assessment does not authorize deletion or migration.

## Retained material needing repairs

12 live pages have missing exact source-files references. They remain keep/reverify, not12 more retirements:

- Wiki Architecture005-System and007-Structure (under W/001-Workspaces_And_Views/004-Wiki_View/001-Architecture/) name missing fusion-studio-server/scripts/query-wiki.js. Current CLI has scripts/wiki.js query.
- W/007-Chat_System/000-Overview_and_References/PAGE.md and006-Runtime_Model/PAGE.md name removed fusion-studio-client/src/components/chat/ViewWorksurfaceDock.tsx.
- Chat003-Rendering_And_Lifecycle/005-Reply_Payloads/PAGE.md and004-Chat_UI/{001-Composer,002-Thread_Header,005-Menus_And_Modals}/PAGE.md name removed fusion-studio-client/src/components/chat/useLegacyChatHost.ts.
- Chat004-Chat_UI/PAGE.md names both removed paths.
- W/010-Events_And_Ledger/011-UI_Action_Provenance_Module/PAGE.md and its001-Wiki_Viewer_UI_Context/PAGE.md and002-File_Viewer_UI_Context/PAGE.md name removed useLegacyChatHost.ts.

Follow current source owners and assess actual claims; do not mechanically substitute filenames.

### Wiki specialists

Keep architecture/interface/state lessons/frontmatter reference. Repair obsolete edge metadata/update-graph decisions and Project>Wiki routing; obsolete example structure/query script; blanket current-system-only wording inconsistent with clearly labeled approved direction. Dated changelog is legitimate history, not stale solely due to age.

### Voice specialists

Keep seven nonduplicate articles with unique cleanup/transcription/debugging/packaging detail. Rule System/Structure name obsolete System Source Files/ai/<machine>/Wiki/system/Text-To-Speech/Rules. Current fusion-studio-client/scripts/prepare-ai-resources.cjs selects System_Manager/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules if present, otherwise System_Manager/resources/text-to-speech/rules. Reverify runtime loader and packaged route before selecting an authoritative edit location.

### Fusion Home

Keep19 pages for separate reconciliation. Office/Documents/Tables/Milkdown/Crepe lessons have substantial unique and recently maintained content. Repair shared-SQLite claims against current storage direction; verify four-view/shipped composition statements; route Calendar/Email to newer current-status introductions; fix built-out/stub contradictions and removed sync-wiki-tocs.js reference. Sparse Office subpages are not proven deletion candidates.

### Other domains

Keep nonduplicate Enforcement, Guidance and destination domains. Empty planned children do not make parents worthless. Runtime contains substantial inspected reference; Automation/Integrations/Operations remain migration destinations requiring content.

## Dependencies outside live wiki

No active product source/tool was found hardcoding candidate article paths as required router targets in the searchable text scan. Do not treat that as proof all indirect/dynamic dependencies are absent.

- Active Issues0094,0096,0100,0102 and Issues/content/tickets.json contain references. Repair current pointers without changing historical issue meaning.
- System_Manager/ai-template/Wiki and System_Manager/ai-v2/RC-MacAir-15/Wiki contain stale copies/routes. Their relative links target their own copies, outside189 count. Separate template debt can repopulate stale new workspaces. The two template Issue0096 files explicitly reference logical project wiki paths.
- fusion-studio-server/data/workspace-cache.json has cached old Code Standards paths. Generated state, not authored routing: leave untouched; account for refresh/missing-page behavior during implementation.
- Other System Manager copies, historical Captures/.versions and Alpha copies remain separate. Do not mass-rewrite historical references.
- Root AGENTS has no found dependency on retirement candidates; its Chat authority pointer remains separate.

## Recommended bounded execution order

1. Repair7 workflow pages plus Guide/Audit support paragraphs.
2. Preserve navigation and repair inbound references, then retire8 duplicate TOCs.
3. Consolidate2 System Manager routing pages into the existing view article.
4. Migrate13 remaining Project pages by subject: agents/tickets/audits; runtime/path/warmth; setup/screenshots/GitLab; Home/Hooks; finally the catch-all heading.
5. Migrate4 remaining System Tools pages, preserving clipboard policy and verified secret/CSS guidance.
6. Reverify retained Wiki/Voice/Fusion Home material and12 missing-source pages.
7. Separately scope template-documentation cleanup to avoid reintroducing old structures.

No indispensable owner decision blocks preparation. Future product decisions remain labeled open; cleanup must not invent answers. Exact write scope, link repair, historical preservation, staged generation and validation must be defined before execution. The34 count covers primary candidate pages only, not all supporting pages that a safe migration must edit.
