# Page 13 — Issue Viewer Ticket Authoring fact reassignment

## 1. Assignment and evidence

- **Assigned source:** `ai/RC-MacAir-15/Wiki/001-Project/024-Issue_Viewer_Ticket_Authoring/PAGE.md`; SHA-256 `fdb30d7eae002ba6f343f62d4fcf3a28899801faf971e5bd6ed027309ba6d9ac`; filesystem mtime `2026-07-04T00:48:59.902777Z` (an identity observation, not an edit or verification date). Entire 38-line page read.
- **Recommended shared destination, proposed until coordinator reconciliation:** `ai/RC-MacAir-15/Wiki/003-Automation_And_Agents/002-Ticketing/PAGE.md`, especially `## How to create a ticket that displays` and a new `## Write a useful ticket`. Existing `001-Workspaces_And_Views/009-Issues_View/PAGE.md` owns the view introduction and should link to the Ticketing workflow rather than copy its instructions.
- **Authorities read:** repository `AGENTS.md` supplied in task; Capture README; all four Wiki Guidance pages (Style Guide, Creating Wikis, Updating Wikis, Audit Workflow); complete Code Standards router and relevant Frontend UI and State Management pages; prior retirement audit; current `001-Project/022-Ticket_Routing/PAGE.md`, `001-Workspaces_And_Views/009-Issues_View/PAGE.md`, Automation introduction; actual view `content.json`.
- **Code inspected:** `TicketBoard.tsx` SHA-256 `245643194bfabe4affc3e3757d0c1dbe8e2a267f48aad797feb4efeed1596c4e`; `ticketStore.ts` `9e30ba0996540c51a26ff96c8b1a9bf9dff34f6dcb01f5eb5ca8336f6f00cfca`; `usePanelData.ts` `badc4e283193c1c556471117c611d52a94529b7470798b7697943c4c5684d1bf`; `ai/RC-MacAir-15/Issues/scripts/create-ticket.js` `fb74bfef1057562c27559e666bdf80c6da0caaf6d4e3fc27a06f16ba73869488`; `fusion-studio-server/lib/views/index.js` around `resolveV2ContentPath`/`resolveContentRootDeclaration`; the actual Issues view capsule `content.json` SHA-256 `7ab10c21d8c92642dfea5825b8f80b1469bfd0fbbf0c39e12d5d94b4e43f5110`. Verified source text by read only; no app launch, runtime test, writer invocation, ticket mutation, or broad server-route audit. The current code proves the read path and rendering behavior, not that a particular ticket file is consistent or that future creation paths work.

## 2. Source-section coverage

| Source part | Coverage |
|---|---|
| Title, description, and lead sentence | F001; route reader task into Ticketing. |
| Legacy metadata (`incoming-edges`, `source-files`, connected/trigger lists) | F002; replace on edited route with current metadata schema. |
| `## Current Shape` and its two required artifacts | F003–F005; distinguish complete authoring convention from actual display gate. |
| `## Ticket Content` and its five criteria | F006–F010; retain each unique criterion, not yet present in Ticket Routing. |
| Final warning against Markdown-to-JSON inference | F011; code verified. |

## 3. Claim disposition

Evidence abbreviations in the table: `Board` = `fusion-studio-client/src/components/tickets/TicketBoard.tsx` (`onIndex`, `usePanelData`, `TicketCard`, `TicketDetail`, `TicketFullPage`); `Store` = `fusion-studio-client/src/state/ticketStore.ts` (`setTicketsFromIndex`); `Panel` = `fusion-studio-client/src/hooks/usePanelData.ts` (`file_content_request`); `Capsule` = `ai/RC-MacAir-15/System/Views/003-issues-viewer/content.json`; `Old Ticketing` = `ai/RC-MacAir-15/Wiki/001-Project/022-Ticket_Routing/PAGE.md`. Hashes are in section 1.

| ID | Original claim/section | Classification and evidence | Final disposition / canonical destination and heading | Existing coverage and limitation |
|---|---|---|---|---|
| P13-F001 | Title, description, lead: use page when planning or architecture correction needs a viewer-visible ticket | Useful reader-task policy; source text and Ticketing workflow | Incorporate as opening use case in proposed `003-Automation_And_Agents/002-Ticketing/PAGE.md` > `## Create a ticket`. | Old Ticketing covers creation mechanically, not the planning/architecture-correction use case. High confidence as editorial policy, not runtime enforcement. |
| P13-F002 | Metadata names `ai/<machine>/Issues/content/tickets.json` and `ai/<machine>/Issues/inbox` as source-files; legacy incoming/skill fields | Superseded metadata schema; Style Guide > Frontmatter Contract requires exact repository-relative *code files*, not a data file and directory; `[]` or exact code owners only | When source becomes successor route, remove legacy metadata and stamp actual edit time; Ticketing metadata suggestion in section 4. | Neither source-file value is suitable under current style. No runtime claim is lost; code ownership is supplied in prose. High confidence. |
| P13-F003 | `Current Shape`: create a Markdown ticket file as part of a complete ticket | Current authoring convention, **not a board visibility prerequisite**. Old Ticketing > Ticket `.md` File; `Board` derives a detail path but does not fetch Markdown for cards/modal/full-page; `Store` loads JSON entries. | Merge into proposed Ticketing > `## Create a ticket`: author durable narrative Markdown alongside the registry entry. | Old Ticketing already says create both, but incorrectly implies Markdown is displayed as the full detail. Preserve convention with the corrected UI distinction. High confidence for current UI; other downstream consumers not exhaustively audited. |
| P13-F004 | New Markdown ticket goes under `ai/<machine>/Issues/inbox/` | Current convention for new human/open tickets; actual workspace contains inbox tickets; `Board` `ticketFolder` uses state/assignee to derive `inbox/<id>.md` for file actions. | Merge into Ticketing > `## Create a ticket`; qualify for normal new human/open tickets, since closed/bot entries derive other folders. | Already covered in Old Ticketing creation steps. High confidence for described workflow; file location does not determine board column. |
| P13-F005 | Add JSON entry under `ai/<machine>/Issues/content/tickets.json`; entry required for viewer visibility | Current implementation fact. `Board` sets `indexPath: 'content/tickets.json'`, parses `index.tickets`, and `Store` maps entries to cards; `Panel` fetches that path; `Capsule` maps view content root to `Issues`. | Merge into Ticketing > `## How the board reads tickets` and `## Create a ticket`. | Already covered in Old Ticketing and Issues View. The board does not enumerate Markdown. High confidence for current renderer. |
| P13-F006 | Ticket should explain what confusion or bug occurred | Useful unique authoring criterion, documented guidance | Add to Ticketing > `## Write a useful ticket`. | Not stated in Old Ticketing; it lists generic context/steps. High confidence as guidance; no enforcement. |
| P13-F007 | Ticket should explain why it occurred | Useful unique authoring criterion; distinguish known cause from hypothesis | Add to Ticketing > `## Write a useful ticket`: explain the cause or label it unknown/hypothesized. | Not present in Old Ticketing. High confidence as guidance, cause cannot always be known. |
| P13-F008 | Ticket should identify likely culprit files or architecture gaps | Useful unique authoring criterion; hypotheses need labeling | Add to Ticketing > `## Write a useful ticket`: name likely code owners or missing boundary, with uncertainty stated. | Not present in Old Ticketing. High confidence as guidance, not proof named files are at fault. |
| P13-F009 | Ticket should explain user impact or risk | Useful unique authoring criterion | Add to Ticketing > `## Write a useful ticket`. | Not present in Old Ticketing. High confidence as guidance. |
| P13-F010 | Ticket should give concrete acceptance criteria | Useful unique authoring criterion | Add to Ticketing > `## Write a useful ticket`. | Old Ticketing mentions generic smoke tests in a sample but not this requirement. High confidence as guidance. |
| P13-F011 | Do not rely on current viewer to infer missing JSON from Markdown | Current implementation fact. `Board` index callback uses only JSON and no Markdown scan; `Store` builds ticket array from `index.tickets`; `TicketDetail` and `TicketFullPage` both render `ticket.body` from JSON. | Merge into Ticketing > `## How the board reads tickets`, adjacent to F005. | Old Ticketing says missing JSON means invisible. Clarify that even the expanded body comes from JSON; Markdown remains a separate durable file/action target. High confidence for current UI. |

## 4. Proposed integrated destination prose

### `003-Automation_And_Agents/002-Ticketing/PAGE.md` (proposed path, shared with Page 11)

Under `## Create a ticket` or the reconciled equivalent:

> For a planning task or architecture correction, create a durable `RCC-NNNN.md` ticket in the workspace's `ai/<machine>/Issues/inbox/` and add the matching ID under `tickets` in `ai/<machine>/Issues/content/tickets.json`. The Markdown file holds the working narrative and supports file-based actions; the JSON entry is what makes the card visible. A Markdown file alone is not discovered by the current board. Keep the title, state, assignee, and summary in the registry consistent with the ticket file. A normal new human-assigned open ticket uses `inbox/`; the board places cards by its JSON state and assignee, not by the file's directory.

Under a short `## Write a useful ticket`:

> Explain what happened, its known cause or the leading hypothesis, likely code owners or architecture gaps, the user impact or risk, and concrete acceptance criteria. Mark uncertain causes and suspected files as hypotheses. Keep the registry `body` concise for the card; put the fuller investigation and criteria in the Markdown file. The current preview and expanded view render the registry body, so the Markdown detail should not be described as the viewer's displayed full body.

Under `## Current view behavior` or linked from the Issues View introduction:

> The React board requests `content/tickets.json` from the Issues content root and builds cards from its `tickets` object. It does not scan `inbox/` or convert Markdown into a registry entry. The registry is therefore the present visibility gate; document creation and reconciliation as a workflow until an actual writer owns both artifacts.

**Metadata source-file suggestion for the shared Ticketing article:** `fusion-studio-client/src/components/tickets/TicketBoard.tsx`, `fusion-studio-client/src/state/ticketStore.ts`, `fusion-studio-client/src/hooks/usePanelData.ts`; add `ai/RC-MacAir-15/Issues/scripts/create-ticket.js` only if describing its actual behavior/limitation. The JSON registry and `Issues/inbox` are data, not metadata source-code paths. Page 11 should choose one deduplicated source list after integrating its wider claims. For this source's eventual short route page, `metadata.source-files: []` is appropriate if it contains only a successor link and historical label.

## 5. Exclude, qualify, or leave historical

- Exclude any implication that **both** artifacts are required for *visibility*. The JSON entry is required for visibility in the current UI; Markdown is part of the complete writing convention and file-action path. Preserve the older wording in the exact predecessor `.versions` snapshot before changing the source.
- Exclude the common Old Ticketing inference that the board opens Markdown as the complete write-up. `TicketDetail` and `TicketFullPage` render `ticket.body` from the JSON-derived store. The new Ticketing page should correct this while merging Page 11's material.
- Do not copy the source's `incoming-edges`, `connected-skills`, `related-trigger-files`, or data/directory `source-files` into newly edited wiki metadata. Current Style Guide explicitly deprecates these fields and requires real code paths or `[]`.
- The source has no obsolete personal examples or executable commands to retain. Its five writing criteria should not be discarded as redundant with the longer Ticket Routing page.

## 6. Incoming references and shared ownership

- **Live wiki direct links: 2.** `ai/RC-MacAir-15/Wiki/001-Project/PAGE.md` links `024-Issue_Viewer_Ticket_Authoring/PAGE.md`; `ai/RC-MacAir-15/Wiki/001-Project/000-Project/PAGE.md` links `../024-Issue_Viewer_Ticket_Authoring/PAGE.md`. The legacy `incoming-edges: Project` value is metadata, not a third link. Both parents are separately assigned (Pages 01/14 navigation work); coordinator should route them to the canonical Ticketing page once it exists while preserving the old source as a successor route for other references.
- **Live issue text: 1.** `ai/RC-MacAir-15/Issues/inbox/RCC-0109.md` mentions the old logical folder under past work completed. This is a historical reference inside an active ticket, not necessarily an instruction to edit the ticket. Leave ticket state/meaning alone; it blocks physical deletion if deep references must remain resolvable.
- **Historical inputs:** the retirement-audit capture and this session assignment mention the source; `.versions` and other Captures are historical. A targeted search of live wiki, Issues, Agents, System Manager templates, client and server found no additional direct hardcoded reference to this title/path. Dynamic or non-text links were not proven absent.
- **Broken slug examples:** none in this source (it contains no Markdown links). Its Project-parent links currently resolve. The destination `003-Automation_And_Agents/002-Ticketing/PAGE.md` does not yet exist at this report time, so links must not be switched before creation.
- **Shared destination/conflict:** Page 11 (`001-Project/022-Ticket_Routing`) owns the broad Ticketing narrative. This report contributes the unique five writing criteria and the precise distinction between durable Markdown and JSON-rendered body. I sent these findings to Page 11's agent. The coordinator should integrate once, not create a separate Issue Viewer Ticket Authoring successor article as a second canonical home.

## 7. Unresolved questions and recommended treatment

| Kind | Question | Recommended treatment |
|---|---|---|
| Researchable fact | Does any active non-board consumer read Markdown ticket bodies or reconcile them into the registry? | Page 11/coordinator can audit writer/dispatch/sync owners if asserting system-wide absence. This report asserts only the current board read path, proven by the inspected code. |
| Implementation choice | Should a future ticket writer atomically create and update both artifacts and surface Markdown body in the UI? | Outside this documentation pass. Label future work; do not describe it as current behavior. |
| Editorial choice | Where should this short writing checklist sit inside the shared Ticketing article? | `## Write a useful ticket` after the creation steps; coordinator can choose exact heading while keeping all five criteria. |
| Indispensable owner decision | None required to migrate these existing claims accurately. | Proceed with current behavior and documented authoring guidance; no product redesign implied. |

## 8. Retirement readiness

**Ready for a short successor route after prerequisites, not for deletion in this pass.** First create and verify the canonical Ticketing page, merge the five writing criteria and corrected JSON/Markdown distinction with Page 11, preserve this source's exact preimage in `.versions`, update both live Project-parent links during their navigation work, and ensure the retained route serves RCC-0109's historical folder mention. Physical removal needs a separate dependency pass because the active issue and any unsearched dynamic references may still rely on the old path. No source, destination, issue, template, runtime data, or code files were edited by this page agent.
