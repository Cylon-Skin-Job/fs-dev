# Wiki fact reassignment — final report

Status: **FACT_REASSIGNMENT_COMPLETE**. This is a completed fact migration, not physical retirement of the old files. The 19 original pages remain as short successor routes. Their exact former bytes are preserved in `.versions/` snapshots; `CHANGES.md` records each edit. No source page was deleted.

## Result

- Nineteen distinct page agents investigated the 19 sources. Their flat `PAGE-XX-REPORT.md` files cover **268 material claim groups**, each with a final disposition and exact live owner or preserved preimage in `FACT-MAP.md`.
- The coordinator reconciled overlapping claims by destination and edited the live wiki serially. Eleven new canonical subject articles were created; existing domain owners, standards and navigation received bounded corrections. The 19 source pages were converted to routes after their destination content was verified.
- `CHANGES.md` records **61 edits over 46 wiki pages**: 50 exact predecessor snapshots and 11 new-article records. The 46 pages comprise 19 retained sources, 11 new articles and 16 existing-owner/navigation pages. No product code, database, Issues, templates, runtime cache or Alpha file was changed by this pass.

## Source disposition and later retirement

All paths in the next table are relative to `ai/RC-MacAir-15/Wiki/`. “Later check” is a physical-deletion prerequisite, not unfinished fact migration. The separate retirement pass must recheck incoming references and saved navigation on fresh bytes before removal.

| ID | Retained source route | Current fact owner or owners | Later check before physical deletion |
|---|---|---|---|
| 01 | `001-Project/000-Project/PAGE.md` | Wiki Guidance and current domain navigation | Keep Project child access; reconcile duplicate root TOC, saved routes and external consumers. |
| 02 | `001-Project/001-Home/PAGE.md` | Wiki Guidance, Setup and subject owners | Redirect historical Home references in Issues/templates and saved navigation. |
| 03 | `001-Project/004-Path_Resolution/PAGE.md` | `002-Server_And_Runtime/007-Path_Resolution/PAGE.md` | Redirect remaining Issue/template references to the path owner. |
| 04 | `001-Project/013-Background_Agents/PAGE.md` | `003-Automation_And_Agents/005-Background_Agents/PAGE.md` | Check Issue/template and automation navigation dependencies. |
| 05 | `001-Project/014-Background_Services_Audit/PAGE.md` | `002-Server_And_Runtime/006-Background_Services/PAGE.md`; Operations troubleshooting | Check dated audit links and shipped-template references. |
| 06 | `001-Project/017-GitLab/PAGE.md` | `004-Integrations_And_Tools/001-GitLab/PAGE.md` | Recheck Project/Integration links and template copies. |
| 07 | `001-Project/018-Hooks/PAGE.md` | Wiki Audit Workflow and Runtime Background Services | Check Issue, template and saved viewer-state references. |
| 08 | `001-Project/019-Run_Auditing/PAGE.md` | `003-Automation_And_Agents/004-Run_Auditing/PAGE.md` | Recheck Issue/Capture mentions and incoming wiki links. |
| 09 | `001-Project/020-Screenshot_Capture/PAGE.md` | `004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md` | Check template copies, old Setup links and saved state. |
| 10 | `001-Project/021-Setup_Wizard/PAGE.md` | `006-Operations/001-Setup/PAGE.md` | Check active Issue references and shipped templates. |
| 11 | `001-Project/022-Ticket_Routing/PAGE.md` | `003-Automation_And_Agents/002-Ticketing/PAGE.md`; Issues View | Preserve old ticket references and review template/runtime links. |
| 12 | `001-Project/023-Warmth_Settings/PAGE.md` | `007-Chat_System/006-Runtime_Model/PAGE.md`; Background Services | Recheck the shipped System Manager template and saved routes. |
| 13 | `001-Project/024-Issue_Viewer_Ticket_Authoring/PAGE.md` | `003-Automation_And_Agents/002-Ticketing/PAGE.md` | Preserve RCC-0109's old folder reference until redirected. |
| 14 | `002-System_Tools/000-System_Tools/PAGE.md` | Wiki Guidance and current Integrations/standards owners | Preserve access to still-live children; check old workflow and saved navigation. |
| 15 | `002-System_Tools/001-Custom_Theme_CSS/PAGE.md` | `004-Integrations_And_Tools/005-Custom_Theme_CSS/PAGE.md`; Themes And State | Recheck three incoming wiki links and template copies. |
| 16 | `002-System_Tools/002-Secrets_Manager/PAGE.md` | `004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md` | Recheck Tools links, Issue mentions and saved viewer state. |
| 17 | `002-System_Tools/003-Clipboard_History/PAGE.md` | Frontend UI Standards; Chat Reply Payloads | Preserve old folder/Issue references while approved direct-copy cleanup proceeds. |
| 18 | `006-System_Manager/001-Workspaces_&_Views/PAGE.md` | `001-Workspaces_And_Views/011-System_Manager/PAGE.md` and five linked subject owners | Reconcile root link and shipped template/mirror copies. |
| 19 | `006-System_Manager/PAGE.md` | `001-Workspaces_And_Views/011-System_Manager/PAGE.md` | Keep root/child and generated Guide navigation valid; recheck saved routes. |

## Main factual resolutions

- Ticketing's board JSON supplies both card and expanded detail; the Markdown ticket is a companion authoring record. A Markdown-only ticket does not appear on the board. Existing creation/dispatch paths have documented gaps; the five writing criteria from source 13 are in the Ticketing owner.
- Chat provider warmth uses its current provider lifecycle, distinct from the event-only observer. The old unified workspace FIFO/TTL and memory estimates remain historical proposals.
- Calendar adapters and system clipboard polling default off under their own gates. Panel screenshots and configured cron triggers can still run automatically. Shared background logging is generic and does not expose the original exception detail.
- `path.resolve()` normalizes paths lexically; it does not follow symlinks. Read and write routes have different containment contracts.
- The old wiki-specific edge/index hook graph is unimplemented. Manual wiki audit and the generic workspace watcher have separate owners.
- Current code still uses managed clipboard history, while newer approved direction calls for direct user-initiated copying and removal of managed history. Both current behavior and target are labeled.
- GitLab integration code exists, but the old personal namespace, token expiry, Wiki API recipe and implied fully working connector were excluded.
- Theme documentation now describes the fixed loaded CSS layers, generated theme CSS and refresh limits. Fusion Home documentation names the current profile-selected views rather than the older four-view assertion.

## Verification and limitations

`VERIFICATION.md` contains the checks and repair trail. All 19 original source hashes matched baseline immediately before routing. Final checks passed for the 268 claim IDs and destinations, 61 change-chain rows, snapshot hashes, 46 changed-page frontmatters/source paths, changed-page links and fragments, and two idempotent staged wiki audits. Forty-one full report code-hash references covering 34 unique code files matched after integration. A fresh independent read-only review of repaired integrated bytes found **no material issue**.

This is source-backed documentation verification, not an app/runtime test. No product tests, build, server launch, setup or credential examples, secret access, external integration, Alpha operation, commit or push were performed. Separate product decisions and implementation work remain for autonomous worker dispatch, trigger-created ticket reliability, managed clipboard history removal, future non-chat resource policy, full GitLab integration and any future wiki-hook automation. Those choices do not block the factual destination or disposition of any claim in this pass.
