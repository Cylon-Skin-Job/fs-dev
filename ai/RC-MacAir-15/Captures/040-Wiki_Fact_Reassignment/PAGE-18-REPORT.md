# Page 18 — System Manager Workspaces & Views route

Status: **REVIEW_READY**. This is a page-level recommendation, not migration acceptance. No live wiki, template, issue, code, or version file was edited.

## 1. Assignment and evidence

- Source: `ai/RC-MacAir-15/Wiki/006-System_Manager/001-Workspaces_&_Views/PAGE.md`; 1,664 bytes; SHA-256 `73aa69949811929b9247bce09f0b8f63d37a0418ad1fcf5859da75d6591a6373` at inspection. Its frontmatter says `last-modified: "2026-09-21T13:37:22Z"`; filesystem mtime is `2026-09-21T06:37:23Z`. Neither date is evidence of factual freshness. The file was already dirty in this shared checkout; the coordinator must compare fresh bytes before integration.
- Proposed existing owner: `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/011-System_Manager/PAGE.md` (inspection SHA-256 `55467b3c7b3aeca4cba575d504aaf0dd520a3f213f80377159ce956ba1ceada1`). Also read that section's `000-Workspaces_And_Views/PAGE.md`, `001-Workspace_Paradigm/PAGE.md`, `002-View_Architecture/PAGE.md`, `003-Adding_Workspaces/PAGE.md`, `012-Viewer_Search/PAGE.md`, and `000-Workspaces_And_Views/002-Decisions/PAGE.md`.
- Preparation/authority read: repository `AGENTS.md` supplied with the task; Capture README; Wiki Guidance Style Guide, Creating Wikis, Updating Wikis, Audit Workflow; `005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` router; 2026-09-27 retirement audit. The audit's proposed retirement disposition was treated as triage, not proof.
- Code scope read for spot checks: `fusion-studio-server/lib/workspace/workspace-controller.js` (SHA-256 `4042bde78e7e6a7bfed1a6fd98828e8c82667632ef0143f09e3650d036ad2c27`), `lib/workspace/create-service.js` (`09d5685c5c368e329fa18e68da798615c1aafc736b0d16b8f2008ba0e083e641`), `lib/views/index.js` (`3adaacc60a3fa8c155a9fe9091e96e347400ba93c34b26235b2dc946afe776a3`), and `fusion-studio-client/src/components/SystemViewer.tsx`. No app/server launch, tests, or complete behavior audit was performed; this source makes no detailed runtime claim requiring one.
- Existing source versions: `.versions/2026-08-28-014539.md`, `2026-09-21-062735.md`, `2026-09-21-063002.md`, `2026-09-21-063723.md`. These are historical evidence and were untouched.

## 2. Source-section coverage

- [x] Frontmatter name/description/source-file accountability and edit timestamp.
- [x] Opening statement that this page routes to the main Workspaces And Views section and should not fork architecture.
- [x] `Current Docs`: all five links, descriptions, and relative path resolution.
- [x] `System Manager Rule`: templates, registry, V2 discovery, shared viewer search; canonical-docs-first instruction.

All five outgoing links resolve to current `PAGE.md` files. The page contains no examples, tables, hidden caveats, or separate implementation account.

## 3. Claim disposition

| ID | Source claim/section | Classification and evidence | Disposition; canonical destination + heading | Coverage/change | Confidence and limit |
|---|---|---|---|---|---|
| P18-F001 | Opening: main Workspaces And Views is durable owner; this is a System Manager route, not an independent architecture narrative. | Current documentation ownership policy. Main overview and `011-System_Manager/PAGE.md` already separate architecture, registration, and System surface. | Retain as concise editing guidance in `001-Workspaces_And_Views/011-System_Manager/PAGE.md` under proposed `## Documentation ownership`; source becomes a successor route. | Needs one sentence; avoid a second architecture narrative. | High for documentation ownership; not runtime behavior. |
| P18-F002 | Current Docs: canonical overview covers current behavior, approved direction, unfinished work. | Current navigation fact. `000-Workspaces_And_Views/PAGE.md` has those divisions and links. | Route to `001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md` under existing `## Reading routes`; no content copy. | Already covered. | High, source link resolves. |
| P18-F003 | Current Docs: Workspace Paradigm covers ownership, activation, boundaries. | Navigation/description. Target exists and describes project folder versus registration, machine-scoped content and view presentation. | Link only to `001-Workspaces_And_Views/001-Workspace_Paradigm/PAGE.md`; no prose migration. | Already covered. | High for route; exact article scope should remain target-owned. |
| P18-F004 | Current Docs: Adding Workspaces covers Add Project, Create New, ribbon, registry, code path. | Current navigation, source-inspected at `workspace-controller.js` and `create-service.js`; detailed facts live in target. | Link only to `001-Workspaces_And_Views/003-Adding_Workspaces/PAGE.md`; no duplicate. | Already covered, with current/target distinction in target. | High for route; no runtime certification. |
| P18-F005 | Current Docs: View Architecture covers capsules, content roots and intended plugin/instance boundaries. | Navigation; `views/index.js` functions `listV2ViewFolders` and `loadV2ViewShell` read current capsules under machine `System/Views`; target labels intended relocation separately. | Link only to `001-Workspaces_And_Views/002-View_Architecture/PAGE.md`; no duplicate. | Already covered. | High for route; future schema remains open. |
| P18-F006 | Current Docs: Viewer Search covers folder-backed React view search. | Navigation; the named `012-Viewer_Search/PAGE.md` is present and scopes current behavior. | Link only to `001-Workspaces_And_Views/012-Viewer_Search/PAGE.md`; no duplicate. | Already covered. | High for route; search internals were not reverified for this routing-only page. |
| P18-F007 | System Manager Rule: for templates, registry behavior, V2 discovery, or shared viewer search, update main Workspaces And Views pages first; keep this page a pointer. | Retain as documentation maintenance policy, not runtime enforcement. Wiki Style Guide places knowledge in its owning section; existing Workspaces And Views pages own the named subjects. `create-service.js` owns bundled-template copy; `views/index.js` owns discovery. | Add concise instruction to `001-Workspaces_And_Views/011-System_Manager/PAGE.md` under proposed `## Documentation ownership`. Specific articles remain the owner for the affected claim; `011` carries only the routing rule. | **Unique instruction to merge.** | High for editorial rule. No code enforces page update ordering. |
| P18-F008 | Frontmatter lists `workspace-controller.js`, `create-service.js`, `views/index.js` as source files. | Metadata, not a separate architecture claim. Files exist and support the linked technical subjects; the current page itself is guidance. Style Guide allows `source-files: []` for non-code guidance. | On a rewritten source route, use `metadata.source-files: []`; do not transfer all three to `011-System_Manager` merely because this route listed them. Preserve `011`'s existing actual code sources after checking its prose. | Metadata cleanup needed if source edited. | High; source-file attribution is page-specific. |

## 4. Proposed integrated prose

**Existing `001-Workspaces_And_Views/011-System_Manager/PAGE.md`, proposed `## Documentation ownership` (one short addition, exact heading subject to coordinator reconciliation):**

> When System Manager work changes workspace templates or registration, V2 view discovery, or shared viewer behavior such as search, update the owning Workspaces And Views article first: [Adding Workspaces](../003-Adding_Workspaces/PAGE.md), [View Architecture](../002-View_Architecture/PAGE.md), or [Viewer Search](../012-Viewer_Search/PAGE.md). Keep this System Manager article focused on the System surface and protected boundary; use links to those articles instead of a second workspace architecture account.

Existing destination `source-files` already names `fusion-studio-server/lib/workspace/create-service.js` and `fusion-studio-server/lib/views/index.js`, plus `fusion-studio-client/src/components/SystemViewer.tsx` and `fusion-studio-server/lib/resources/resolver.js`. Those remain plausible for its current technical paragraphs. The proposed editing guidance itself has no extra code source-file requirement. `workspace-controller.js` belongs to the linked Adding Workspaces article, whose metadata already lists it.

**Old `006-System_Manager/001-Workspaces_&_Views/PAGE.md`, successor route after destination integration:**

> Workspace and view behavior, intended plugin boundaries, and System Manager's protected boundary are documented in [Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md) and its [System Manager article](../../001-Workspaces_And_Views/011-System_Manager/PAGE.md). Follow those owners when changing workspace or view documentation.

For this guidance-only route, proposed `metadata.source-files: []`; stamp the actual write time and preserve an exact `.versions` preimage before the coordinator changes it. Keep the existing route until navigation and shipped-template dependencies have been handled in the separate retirement pass. No new article is needed.

## 5. Material to exclude from a new live account

- Do not copy the five-link `Current Docs` list wholesale into `011-System_Manager`: the Workspaces And Views overview already routes to those articles, and duplicating the list creates maintenance drift. The old text remains in the preserved preimage and, during this pass, the source route.
- Do not infer that V2 discovery or bundled templates implement the approved protected plugin model. `create-service.js` copies bundled templates into machine `System/Views`; `views/index.js` discovers current capsules there. `002-View_Architecture/PAGE.md` and `002-Decisions/PAGE.md` expressly distinguish current storage from the future trust boundary.
- Do not turn “update docs first” into a claim of runtime enforcement or mandatory privileged approval for ordinary instance edits. The instruction governs documentation placement; the existing System Manager article separates the proposed protected plugin workflow from current UI behavior.

## 6. Incoming references and navigation dependencies

- **Active `ai/RC-MacAir-15/Wiki` direct inbound: 1**: `006-System_Manager/PAGE.md` links to `001-Workspaces_&_Views/PAGE.md`. The root is page 19's assignment; coordinate its successor link to `001-Workspaces_And_Views/011-System_Manager/PAGE.md` without removing access to any still-live children.
- **Active indirect navigation into the root: 3**: `000-Wiki_Guidance/PAGE.md`, `009-Fusion_Home/000-Fusion_Home/PAGE.md`, and `009-Fusion_Home/000-Fusion_Home/002-Vision/PAGE.md` link to `006-System_Manager/PAGE.md`. These belong to page 19's synthesis and may contain composition claims that need separate verification.
- **Shipped template/mirror wiki direct inbound: 4**: two pages in `System_Manager/ai-template/Wiki/001-Workspaces_And_Views/` and two matching pages in `System_Manager/ai-v2/RC-MacAir-15/Wiki/001-Workspaces_And_Views/` link to their own `006-System_Manager/001-Workspaces_&_Views/PAGE.md`. These are outside this pass's edit scope but block physical retirement without template/mirror reconciliation. Current source route must remain available. This search does not certify every template's architecture prose.
- Search of active wiki Markdown, issues, shipped template Markdown, and tool/code text found no other direct inbound to this exact source path. Historical Capture inventories, baseline JSON, prior handoffs, and `.versions` reference it; they are evidence, not active navigation. The exact-path search also found historical Capture mentions, which should remain untouched.
- All five outgoing links in this source resolve. No broken slug on this source was found. The `&` in its slug can complicate broad text searches, so direct link resolution was checked separately. This finding does not certify the entire wiki link graph.

## 7. Unresolved and coordination

- **Researchable integration check:** Re-hash the dirty source and destination just before writing. If concurrent edits changed the ownership rule or destination, reconcile fresh bytes; never overwrite them from this report.
- **Researchable retirement dependency:** During the later physical-retirement pass, decide whether the shipped template and mirror wiki links are regenerated, updated, or intentionally retained. They are outside this pass and do not block moving the fact now.
- **Editorial choice:** The coordinator can choose the exact short heading in `011-System_Manager`; `## Documentation ownership` is recommended. No indispensable owner decision is needed for the one-sentence routing rule.
- **Cross-agent coordination:** Page 19 owns `006-System_Manager/PAGE.md` and its Guide/Fusion Home inbound links. Its root route should point to the same `011-System_Manager` owner without implying the planned workspace composition has shipped.

## 8. Retirement readiness

**Fact migration:** ready after the canonical-docs-first sentence is integrated into the existing `011-System_Manager` article and this source becomes a short successor route with a preserved exact preimage. The five navigation links are already covered by the Workspaces And Views overview and their target articles.

**Physical deletion:** defer to a separate retirement pass. Prerequisites are repairing the active root link, reconciling four shipped template/mirror links, preserving navigation to any remaining live children, and checking fresh incoming references. No deletion was performed.
