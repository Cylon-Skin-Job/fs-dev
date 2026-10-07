# Page 19 — System Manager root routing

Status: **REVIEW_READY**. This is source investigation and proposed prose, not live-wiki integration or retirement approval.

## 1. Assignment and evidence boundary

- Repository: `/Users/rccurtrightjr./projects/fs-dev`, confirmed with `git rev-parse --show-toplevel`.
- Assigned source: `ai/RC-MacAir-15/Wiki/006-System_Manager/PAGE.md`; 359 bytes; SHA-256 `44cdae622c35511a9321303604742e55a20448eed84fd47b60732f86210e6133`; filesystem mtime `2026-09-27T14:39:31-0700`. The page has no authored `last-modified` field, so the mtime is not an editorial or verification date.
- Read the full source, `006-System_Manager/001-Workspaces_&_Views/PAGE.md`, canonical `001-Workspaces_And_Views/011-System_Manager/PAGE.md`, Workspaces And Views overview, Adding Workspaces, Workspace Compositions and View Catalog, Guide, Fusion Home overview and Vision, Capture rules, all four Wiki Guidance pages, the complete Code Standards router, and the September 27 retirement audit.
- Inspected source scope: `fusion-studio-client/src/components/SystemViewer.tsx` (SHA-256 `1e4b3b5e6c628e399ad4a8f82179220a8172f1fee92f331626afe33825af62c5`), `ContentArea.tsx` (`f3b02f929a2baf1ba18025b41883bf351759815c2204537ccf61454e66ef1327`), `fusion-studio-server/lib/workspace/create-service.js` (`09d5685c5c368e329fa18e68da798615c1aafc736b0d16b8f2008ba0e083e641`), and the `new`, `startup/fusion-home`, and `startup/system-source-files` template profiles (SHA-256 respectively `6cb17a9ab28e11459e7b196bf76f1a62501d1f76f29875831983425d0cd1c924`, `ab88653bc344bb31bdcd1f5a60f12af78b1c476346a279392e7be1f8745d1873`, `2520c5d386a92b9ee9896958e7c1d070db01601f3702fbb6d169bc229d99e529`). Also inspected `fusion-studio-server/lib/wiki/audit/toc-sync.js` for generated Guide-link behavior and the current Create New controller/modal route.
- Did **not** launch Fusion Studio, inspect a live registry/database, verify a packaged install, certify every Fusion Home specialist page, or establish which workspaces are registered in any user's profile. Template profiles and mounted component mappings are source facts, not an installed-workspace inventory.

## 2. Complete source-section coverage

- Frontmatter `name`/`description`: calls this a System Manager table of contents; routing label only, not an architecture assertion.
- Frontmatter metadata: `source-files: []` is appropriate for a pure route. `incoming-edges`, `outgoing-edges`, `connected-skills`, and `related-trigger-files` are deprecated metadata under the current Style Guide. No timestamp is present.
- Body: exactly one bullet, linking `001-Workspaces_&_Views/PAGE.md` and describing it as a System Manager route to workspace/view architecture and lifecycle documentation. The relative target exists and its own page routes to canonical Workspaces And Views articles. There are no examples, tables, caveats or further sections in this source.

## 3. Material claim disposition

`W/` means `ai/RC-MacAir-15/Wiki/`. The destination below is a recommendation; the coordinator owns final integration.

| ID | Original claim/section | Classification and evidence | Disposition and exact destination | Coverage/change | Confidence and limit |
|---|---|---|---|---|---|
| P19-F001 | Frontmatter identity: “System Manager” is a wiki topic. | Current navigation fact. `SystemViewer.tsx` has the System surface; `ContentArea.tsx` mounts `system-viewer`; W/`001-Workspaces_And_Views/011-System_Manager/PAGE.md` is the current article. | Keep one canonical route at W/`001-Workspaces_And_Views/011-System_Manager/PAGE.md#protected-boundary-and-editable-instances` and its introduction. | Already covered. The old root should become a concise successor pointer while still live; no second explanation. | High for source routing; no installed-workspace claim follows. |
| P19-F002 | Description: “Table of contents for System Manager.” | Historical/generated-style routing description, not substantive product behavior. W/`000-Wiki_Guidance/001-Style_Guide/PAGE.md#heading-articles` and `toc-sync.js` show current page/navigation rules. | Replace the source description with a truthful successor-route description if the root is edited. Canonical destination remains W/`001-Workspaces_And_Views/011-System_Manager/PAGE.md` introduction. | Existing canonical article needs no copied TOC text. Source metadata needs migration only on edit. | High. This root exists partly as a generated-navigation target until later physical retirement. |
| P19-F003 | Sole body bullet: “Workspaces & Views” routes to workspace/view architecture and lifecycle docs. | Current routing intent; destination child exists. W/`006-System_Manager/001-Workspaces_&_Views/PAGE.md` directs readers to W/`001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md`, Adding Workspaces, View Architecture and Viewer Search. | Route directly from this retained root to W/`001-Workspaces_And_Views/011-System_Manager/PAGE.md` and, if needed, W/`001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md#reading-routes`. Preserve a link to the live child until page 18 is reconciled and redirected. | Already covered by canonical articles. Replace the indirect single-link TOC with a compact successor note; do not add architecture prose. | High. Page 18 owns the child rule and must be reconciled with this route. |
| P19-F004 | Legacy edge/skill/trigger metadata lists. | Superseded authoring schema, per W/`000-Wiki_Guidance/001-Style_Guide/PAGE.md#frontmatter-contract`. These empty arrays encode no domain fact. | Omit on actual edit; keep `source-files: []` and add actual quoted UTC `last-modified`. | Metadata-only adoption; no destination product prose. | High. Do not stamp an untouched page. |

No unique product behavior, approved target, policy or implementation claim exists in this 359-byte source. Its useful content is the route and its navigation dependency.

## 4. Proposed integrated prose and source metadata

### Canonical System Manager article — W/`001-Workspaces_And_Views/011-System_Manager/PAGE.md`

**Proposed only if the coordinator finds a gap after page 18 reconciliation:** “Start here for the current System surface and its protected-resource boundary. [Workspaces And Views](../000-Workspaces_And_Views/PAGE.md) owns workspace/view concepts; [Adding Workspaces](../003-Adding_Workspaces/PAGE.md) owns current registration and creation; [View Catalog](../023-View_Catalog/PAGE.md) distinguishes bundled templates from mounted surfaces.” The current canonical article already carries the System UI and protected-plugin account. It does not need the source's one-link TOC reproduced. Retain its verified `source-files` (SystemViewer, resource resolver, view registry, create service) if prose stays within those owners; do not add Fusion Home profile paths as `source-files` to this article for claims it should not own.

### Retained source route — W/`006-System_Manager/PAGE.md`

Proposed short body after an exact predecessor snapshot: “System Manager guidance now lives in [System Manager](../001-Workspaces_And_Views/011-System_Manager/PAGE.md). For current workspace creation and view architecture, follow the [Workspaces And Views overview](../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md). The earlier [Workspaces & Views routing page](001-Workspaces_&_Views/PAGE.md) remains available during this migration.” Once page 18 has an agreed route, the final sentence can be shortened or removed. Suggested `description`: “Routes to the current System Manager article and workspace/view documentation.” Suggested `metadata.source-files: []` and actual quoted UTC `last-modified` on edit; remove legacy relationship keys. This is an interim navigation route, not a second canonical owner.

### Incoming Guide — W/`000-Wiki_Guidance/PAGE.md`

The System Manager row at line 54 is **inside the script-owned `section-toc` block**. `toc-sync.js` constructs the top-level row from folder `006-System_Manager/PAGE.md` as long as the folder has no `000-` heading article. Manually changing that row to `001-Workspaces_And_Views/011-System_Manager/PAGE.md` will be undone by audit. During this no-deletion pass, let the generated row point to the retained successor route with its corrected description; the Guide already links the canonical System Manager article indirectly through the Workspaces And Views section. If a hand-written explicit route is necessary, place it outside the generated block and avoid duplicating a misleading inventory statement. `source-files: []` remains right for navigation; stamp only if actual bytes change.

The Guide's Fusion Home row at line 57 is generated from the Fusion Home page description, which currently states a four-view shipped composition. Repair that **Fusion Home description first**, then stage audit to regenerate the Guide block. Suggested description: “Fusion Home covers the Office surface, related editor work, and planned or separate Calendar, Email, and ToDo material; consult the View Catalog and workspace profiles for current availability.” Do not hand-edit the generated Guide row.

### Fusion Home overview and Vision — W/`009-Fusion_Home/000-Fusion_Home/PAGE.md` and `.../002-Vision/PAGE.md`

Both authored links to `006-System_Manager/PAGE.md` can instead point to the canonical System Manager article **only after** their surrounding prose is corrected. Proposed current-state wording for the overview: “The bundled `fusion-home` startup **profile** selects Office, Files, Issues, Wiki and Agents. The ordinary `new` profile selects Capture, Files, Wiki, Issues and Agents. These profile definitions do not establish which workspaces are registered or which features are complete in a running installation. [System Manager](../../001-Workspaces_And_Views/011-System_Manager/PAGE.md) documents the System surface and protected-resource boundary; [Workspace Compositions](../../001-Workspaces_And_Views/021-Workspace_Compositions/PAGE.md) explains current template copying and intended plugin provisioning.” Link from Vision with the correct relative prefix (`../../../001-Workspaces_And_Views/011-System_Manager/PAGE.md`) if a System reference remains useful. Replace “four actual views” and the assertion that System Manager showcases Capture/basic file management with accurately labeled vision or source-inspected status; they are not supported by the profiles.

The Fusion Home overview currently lists `ContentArea.tsx` and Office/Email code but not the profile it invokes. On substantive composition edits, consider adding exact `fusion-studio-server/lib/workspace/create-service.js` to `source-files`; the profile JSON itself is a configuration input and is **not** a code `source-files` entry under the Style Guide. The Vision page may retain `source-files: []` if recast as intent and linked to current-state articles. The Guide remains `source-files: []`.

## 5. Exclusions and historical treatment

- Do not migrate the old root's empty edge/skill/trigger arrays into the canonical article. Current Wiki Style Guide rejects them as authored relationship metadata.
- Do not carry “table of contents” as a second System Manager architecture article. The predecessor remains available through `.versions` and Git; during this pass the live old page is a route.
- Do not turn the System Manager link in Fusion Home into proof that System Manager is a shipped peer workspace with an established Capture/file/code composition. `SystemViewer.tsx` establishes a mounted System surface; `System_Manager/manifest.json` declares a special `system-files` workspace; the inspected source did not prove a registered workspace inventory. The startup template named `system-source-files` selects Office, Files, Issues, Wiki and Agents, not an asserted Capture composition. These are distinct concepts.
- Do not state that Fusion Home currently has four actual views (Office, Calendar, ToDo, Email) merely because its old overview says so. `startup/fusion-home/profile.json` lists Office, Files, Issues, Wiki and Agents. `ContentArea.tsx` mounts Office, Calendar and Email components independently of that profile; it contains no ToDo panel mapping. The View Catalog already distinguishes mounted UI, templates and planned features. Preserve an intended four-app vision only as explicitly labeled direction if owner authority supports it.
- The retirement audit's row is triage evidence, not itself proof of app composition. Historical Capture proposals and `.versions` files should remain untouched.

## 6. Incoming references and navigation blockers

Fresh exact-path search found **three distinct active live-wiki owners** linking to W/`006-System_Manager/PAGE.md`: W/`000-Wiki_Guidance/PAGE.md` line 54 (generated block), W/`009-Fusion_Home/000-Fusion_Home/PAGE.md` line 47, and W/`009-Fusion_Home/000-Fusion_Home/002-Vision/PAGE.md` line 29. The source itself links to its child at `001-Workspaces_&_Views/PAGE.md`, which currently resolves. No active Issue under `ai/RC-MacAir-15/Issues` or active searched code/tool owner was found with the exact root path; dynamic dependencies were not exhaustively disproved.

Separate copied/template-local paths: `System_Manager/ai/views/wiki-viewer/Wiki/PAGE.md` and `System_Manager/ai/RC-MacAir-15/Wiki/PAGE.md` each have their own `006-System_Manager/PAGE.md` route. They target their own wiki copies and are outside this live source's three-owner count. Historical Capture proposals and audit records also mention the path; they are provenance, not active links to rewrite. Current exact links are valid; deleting the root now would break the three live links and the Guide's regenerated link. No additional broken slug was established for this source.

Shared destinations/conflicts: page 18 owns the live child and its “update canonical docs first” rule. Pages 01, 02 and 14 affect Guide navigation. Fusion Home overview/Vision and the Guide's generated description share an unresolved shipped-composition wording problem. The coordinator should serialize those edits, preserve fresh preimages, and rerun a staged audit; Guide/TOC blocks are script-owned.

## 7. Unresolved questions and recommended resolution

| Kind | Question | Recommended resolution |
|---|---|---|
| Researchable current fact | Which startup templates are selectable in the running packaged app, and which workspaces are registered in a particular user profile? | This pass should say only what source profiles and code show. Do not infer installed inventory. Inspect packaging/runtime only if a future article truly needs such a claim. |
| Editorial/location choice | Should the old System Manager root remain a one-paragraph route until physical retirement? | Yes. Its Guide link is generated from the folder and is stable only while the root remains. Direct the authored Fusion Home links to the canonical article after fixing adjacent prose. |
| Editorial/coordination choice | Does canonical System Manager need new text from this source? | No unique fact requires it. If page 18 adds the canonical-docs-first rule, add at most a reading-route sentence here and avoid another architecture narrative. |
| Product intent | Is Fusion Home intended to be a four-app showcase, and should Calendar/Email/ToDo be in a future startup composition? | Preserve as visibly labeled vision if this is owner-approved; current-state wording must use the checked profiles and View Catalog. This product choice does not block routing this source. |

No indispensable owner decision blocks the page 19 fact routing. Unknown runtime inventory must remain unknown.

## 8. Retirement readiness

**Ready for a successor route after coordination, not ready for physical deletion in this assignment.** First, reconcile page 18 and preserve exact predecessors. Make the old root's live body/description a short route and migrate metadata on that actual edit. Correct Fusion Home overview/Vision claims and direct their authored links to the canonical System Manager article; regenerate the Guide block in the coordinator's staged audit so it reflects honest source descriptions. Keep the root while the generated Guide navigation and live child depend on it. Physical retirement later requires a navigation redesign or removal of the legacy folder after all child/reference dependencies are resolved. No deletion or live-wiki edit was performed by this agent.
