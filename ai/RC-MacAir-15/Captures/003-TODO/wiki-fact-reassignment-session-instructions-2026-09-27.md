# Session assignment: reassign facts from 19 legacy wiki pages

## Mission

Act as the coordinating main agent for a documentation migration in `/Users/rccurtrightjr./projects/fs-dev`. Assign one fresh sub-agent to each of the 19 source pages below. Each agent investigates its page, verifies and classifies its claims, assigns useful material to its proper destination, and returns a durable report with proposed replacement prose. You synthesize all 19 reports, resolve disagreements and gaps, integrate the verified material into the live wiki, and verify the combined result before declaring completion.

Do not stop at dispatching agents, collecting reports, or copying their recommendations. The main agent owns factual reconciliation, destination ownership, actual integration and final resolution.

Primary output is a completed **fact-reassignment pass**. It is not a product implementation or a blanket deletion pass. Assess retirement readiness for every old page; do not delete source articles in this assignment. Leave retained sources clearly routed to their canonical successors, with their stale claims corrected, removed from active prose, or explicitly historical as appropriate. The separate retirement pass can remove them once navigation/dependencies are safe. Distinguish completed fact migration from pending physical retirement in the final report.

## Authority and preparation

1. Resolve the repository root with `git rev-parse --show-toplevel`. Work in primary fs-dev, not Alpha. Preserve the shared dirty checkout and other sessions' changes.
2. Read applicable AGENTS.md, `ai/RC-MacAir-15/Captures/README.md`, and the four Wiki Guidance pages for Style Guide, Creating Wikis, Updating Wikis and Audit Workflow.
3. Read `ai/RC-MacAir-15/Captures/001-Captures/wiki-retirement-audit-2026-09-27.md`. It is a triage input, not proof that a fact is true or a destination sufficient. Recheck paths, current contents and incoming references.
4. Read the complete Code Standards router at `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`, then routed pages relevant to each subject. Existing standards constrain the descriptions; this task does not silently redesign them.
5. Use current owner-approved Workspaces And Views, Platform And Plugins, Events And Ledger and Chat contracts for their subjects. Inspect code for current behavior. Newer owner direction determines intended behavior; code determines observed implementation. Neither a recent timestamp nor a prior CLEAN handoff certifies today's code.
6. Establish a baseline: source/destination bytes and SHA-256 identities, relevant code hashes, current incoming links, existing version snapshots. Put evidence in a new next-unused `NNN-Wiki_Fact_Reassignment` Capture folder. Follow the Capture convention: flat Markdown files; no JSON sidecars or nested report tree.

No product code, schemas/migrations, runtime data, secret access, external integrations, app/server launch, Alpha operations, commit or push. Read code, configuration schemas and tests only as needed to establish the claims. Do not execute credential/setup examples from old pages. No wholesale template-copy or other-machine cleanup.

## Dispatch and file ownership

Create 19 distinct page agents, one per assignment. Run them in sensible waves within available concurrency; do not wait for 19 simultaneous slots. Each agent inherits the coordinator's model and reasoning effort. Do not recursively delegate. Record agent identity, input hashes, assigned page and status in `EXECUTION.md`.

Each page agent may write **only its own** flat `PAGE-XX-REPORT.md` in the run Capture. It reads its source, candidate destinations, relevant authority, code and incoming links. It does not edit live wiki, other reports, templates, issues or product files. Tell every agent it is not alone in the codebase and must not revert others' work.

The main agent is the sole live-wiki writer during integration. This avoids concurrent workers overwriting shared destinations such as Ticketing, Background Services, Guide and Chat Runtime. If another external session owns an overlapping file, coordinate the overlap or integrate against fresh bytes; never overwrite its changes.

Maintain these main-agent artifacts as flat Markdown:

- `EXECUTION.md`: all 19 assignments, identities, completion/revision status and current work.
- `FACT-MAP.md`: one row per material source claim with its final disposition and destination.
- `RESOLUTIONS.md`: conflicts, omissions, source drift, material decisions and how resolved.
- `SYNTHESIS.md`: coherent destination structure, deduplication and final integration plan.
- `CHANGES.md`: actual changed paths, exact predecessors, successors, timestamps and evidence.
- `VERIFICATION.md`: checks, findings, repairs, independent review and remaining limitations.
- `FINAL-REPORT.md`: completed outcome, all 19 source dispositions, canonical destinations and retirement readiness.

## The19 assignments

`W/` expands to `ai/RC-MacAir-15/Wiki/`. All paths in this table are relative to W. Destinations marked new are suggestions requiring verification, not a license to create redundant articles. Prefer an existing correctly owned article or subsection if it can cover the facts clearly. Check folder numbers remain available before creating anything.

| ID | Source page | Initial destination and investigation |
|---|---|---|
| 01 | 001-Project/000-Project/PAGE.md | Guide/domain navigation. Inventory children and unique routing. Final synthesis depends on 02–13; do not lose access to remaining children. |
| 02 | 001-Project/001-Home/PAGE.md | Guide or current user-preferences guidance for enduring principles; old product identity and broken slug map belong in history, not current facts. |
| 03 | 001-Project/004-Path_Resolution/PAGE.md | New002-Server_And_Runtime/007-Path_Resolution/PAGE.md or relevant existing owner. Verify actual path resolvers/realpath/containment; path.resolve does not resolve symlinks. |
| 04 | 001-Project/013-Background_Agents/PAGE.md | New003-Automation_And_Agents/005-Background_Agents/PAGE.md. Verify trigger actions versus worker spawning and separate current code from worker/workflow ambitions. |
| 05 | 001-Project/014-Background_Services_Audit/PAGE.md | New002-Server_And_Runtime/006-Background_Services/PAGE.md and relevant Operations troubleshooting. Resolve contradictions between dated summary, patches and recommendations. |
| 06 | 001-Project/017-GitLab/PAGE.md | New004-Integrations_And_Tools/001-GitLab/PAGE.md. Preserve verified integration setup/capability, not personal namespace, dated token expiry or obsolete scripts. No credential access. |
| 07 | 001-Project/018-Hooks/PAGE.md | Existing000-Wiki_Guidance/004-Audit_Workflow/PAGE.md and Style Guide for source accountability; actual runtime hooks need their actual owner. Do not resurrect deprecated edge/index graphs. |
| 08 | 001-Project/019-Run_Auditing/PAGE.md | New003-Automation_And_Agents/004-Run_Auditing/PAGE.md, linking current provenance. Verify what is built; do not adopt automatic history destruction or speculative edge propagation. |
| 09 | 001-Project/020-Screenshot_Capture/PAGE.md | New004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md. Distinguish desktop setup from app panel screenshots. A symlink is not inherently read-only. |
| 10 | 001-Project/021-Setup_Wizard/PAGE.md | New006-Operations/001-Setup/PAGE.md. Verify current harness, commands and paths; distinguish optional onboarding, development and Alpha operations. Do not run setup. |
| 11 | 001-Project/022-Ticket_Routing/PAGE.md | New003-Automation_And_Agents/002-Ticketing/PAGE.md plus existing Issues introduction. Verify board JSON/detail Markdown, creation routes and actual dispatch gaps. Coordinate with 13. |
| 12 | 001-Project/023-Warmth_Settings/PAGE.md | Existing007-Chat_System/006-Runtime_Model/PAGE.md for verified chat lifecycle; Background Services for non-chat policy. Reverify process/TTL/cost/storage claims and avoid treating old targets as shipped. Coordinate with 05. |
| 13 | 001-Project/024-Issue_Viewer_Ticket_Authoring/PAGE.md | Same Ticketing owner as11. Preserve unique writing criteria and actual file/registry requirements; integrate once. |
| 14 | 002-System_Tools/000-System_Tools/PAGE.md | Guide/domain navigation after 15–17 resolved. Preserve access to still-live children. |
| 15 | 002-System_Tools/001-Custom_Theme_CSS/PAGE.md | New004-Integrations_And_Tools/005-Custom_Theme_CSS/PAGE.md and existing005-Enforcement/002-Themes_And_State/PAGE.md. Separate user recipe from architecture; verify editable-instance/protected-plugin rules and actual cascade. |
| 16 | 002-System_Tools/002-Secrets_Manager/PAGE.md | New004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md. Verify credential-name discovery, redaction and failure behavior. Legacy names such as ROBIN_DB may still exist; absence cannot be inferred from naming. Never print actual secrets. |
| 17 | 002-System_Tools/003-Clipboard_History/PAGE.md | Existing005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md or a better verified owner. Preserve writeAndRecord/redaction policy, distinguish app copy from system clipboard polling. |
| 18 | 006-System_Manager/001-Workspaces_&_Views/PAGE.md | Existing001-Workspaces_And_Views/011-System_Manager/PAGE.md. Preserve canonical-docs-first instruction without a second architecture narrative. |
| 19 | 006-System_Manager/PAGE.md | Same System Manager destination; inspect Guide/Fusion Home incoming links and surrounding shipped-composition claims. Mere relinking must not imply a verified workspace inventory. |

## Standard page-agent instruction

Use this packet with the assigned ID/path and exact report destination:

> Own investigation of this one source page. Read the entire page, including examples, tables, caveats and links. Account for every substantive section and material factual/policy claim; group redundant wording but do not silently drop unique facts. Assign stable IDs PXX-F001, PXX-F002, etc. Verify material current assertions against actual source owners and, where needed, producer/consumer paths. Read relevant destinations and authoritative wiki contracts. Classify each item as current fact, approved target, proposal, historical observation, incorrect/superseded, duplicate, or unresolved. Source-code absence is not proved by one grep. Separate documented policy from runtime enforcement.
>
> Recommend one canonical destination per retained item, an exact page and heading, and explain why that destination owns it. State whether equivalent content already exists, needs merging, or requires new prose. Supply concise integrated replacement prose and source-file metadata suggestions; do not merely copy the old page. Link rather than duplicate authoritative contracts owned elsewhere.
>
> Preserve useful unique facts and reader tasks. Incorrect/superseded statements need evidence and a reason for exclusion, not a new place to repeat them as fact. Historical findings can remain in the preserved predecessor without live duplication. Unknown claims remain explicitly unknown; never silently promote them to current facts or approved policy.
>
> Scan active incoming references, including live wiki, guidance, issues, templates and tools; distinguish historical captures/.versions and runtime caches. Identify navigation dependencies and retirement blockers. Do not modify those owners. Do not execute setup, runtime or secret examples.
>
> You are not alone in the codebase. Write only your assigned report. Do not edit live wiki or other workers' reports and do not delegate. Return your report path and REVIEW_READY with a concise summary; REVIEW_READY is not migration acceptance.

## Required page report format

Each PAGE-XX-REPORT.md contains:

1. Assignment, source path/hash/time, inspected authorities and code scope; what was not verified.
2. Source-section coverage checklist: every substantive section accounted for, including navigation-only pages with few/no facts.
3. Claim table: ID; original section/claim; classification; evidence path+symbol/hash or explicit owner authority; disposition; destination page+heading; existing coverage/needed change; confidence/limitation.
4. Proposed destination prose, grouped by destination, with exact code source-file suggestions. New paths/sections marked proposed until coordinator reconciles them.
5. Incorrect, obsolete or duplicate material to exclude, with specific reasoning and where its historical record remains.
6. Incoming reference owners and counts, broken slug examples, shared destinations and cross-agent conflicts.
7. Unresolved questions, distinguishing researchable facts, implementation choices and indispensable owner decisions. Include a recommended resolution where grounded.
8. Retirement readiness: ready after listed prerequisites, or retain because unique material/dependencies remain. No deletions performed.

## Main-agent synthesis and resolution

Collect all 19 reports; retry/reassign failed or incomplete assignments. Verify section/claim coverage against original source bytes, not just an agent's claim of completeness. Navigation pages still require an agent but need no invented facts.

Before live edits:

- Reconcile claims grouped by **destination**, not merely by source. In particular reconcile11+13 Ticketing;05+12 Background Services/Chat;01+02+14+19 navigation;07 maintenance guidance;18+19 System Manager;15+17 standards.
- Establish one canonical owner for each retained fact. Resolve duplicated/conflicting accounts using current source and explicit owner authority. Do not average conflicting statements or let majority vote decide truth.
- Detect unique facts dropped between reports; compare old table rows/examples against final destinations. Track each source claim through FACT-MAP to incorporated, already-covered, historical-only, rejected-with-evidence, or unresolved.
- Route researchable uncertainty back to the responsible page agent, with a bounded question. Resolve ordinary editorial/location choices yourself. Ask the owner only for an indispensable new product decision; continue independent work while awaiting it.
- Write SYNTHESIS.md and RESOLUTIONS.md before integration. For each decision record competing claims, evidence, chosen treatment, destination and affected pages.

Only after reconciliation, integrate destinations in serialized batches. Prefer concise coherent articles over stitching 19 reports into the wiki. Current facts, approved direction and open product work must be visibly distinct. The main agent is responsible for resolving conflicts; “agent reports disagree” is not a completed outcome.

Uncertainty can be resolved editorially by explicitly retaining a proposal/unknown as such when the product decision is outside this task. That does not resolve the product choice. Do not label the pass complete while an unresolved issue still determines whether a factual claim or migration is correct.

## Source pages, navigation and scope limits

After a destination exists and its content is verified, replace the source's misleading active prose with a short successor route or clearly bounded historical note as appropriate, preserving an exact predecessor first. Retain only unique content still awaiting resolution. Do not leave two competing current explanations. Routing headings must preserve navigation to remaining live children.

This pass does not remove the eight duplicate TOCs or rewrite the seven-page maintenance workflow wholesale. It may make narrow supporting corrections necessary for the 19 fact migrations, such as canonical links or status wording; record each support edit and its necessity. Do not use the old Sync Wiki Context workflow, whose status/metadata assumptions are known stale. Do not let whole-wiki regeneration or a factual repair in one paragraph become an unrelated domain rewrite.

Existing live references can be redirected to verified successors without deleting their sources. Issues/templates/runtime caches found in the audit are dependency evidence: do not change ticket state, runtime cache or shipped template trees. Keep existing source routes available when those outside-scope dependencies would otherwise break; list them as retirement prerequisites. Preserved historical captures and versions remain unchanged.

## Safe edits, metadata and verification

- Before each substantive write preserve a complete exact preimage in the article's .versions folder using current naming rules; exclusive-create, never overwrite snapshots. Record before/after hashes and reason in CHANGES.md.
- Compare against fresh live bytes before writing. If another writer changed them, reread/reconcile and recheck affected claims. Never reset concurrent work.
- Apply current name/description, exact unique repository-relative code source-files, and quoted UTC last-modified timestamps to actual changed articles. Use [] for genuinely non-code guidance. Remove deprecated relationship metadata only on pages actually edited; preserve unrelated fields. Timestamp is not a verification date.
- Generated TOC blocks are script-owned. Stage the wiki in a disposable copy, run the existing audit twice, import only intended stable blocks, then stamp actual changes. No unbounded live audit or whole-stage copy-back. Ensure navigation reaches every new canonical article. Do not create folder PAGE plus000 heading duplicates.
- Validate changed frontmatter with the installed parser, source paths, local links/fragments, generated-block idempotence, predecessor integrity and actual modified-file boundaries. Capture exact commands/results. Check all 19 original section/claim maps against final destination prose. Do not run product tests/builds and imply runtime proof from this documentation pass.
- Recheck relevant code hashes before final verification; re-inspect materially changed facts. Report bounded source-only limitations honestly.

## Independent final review and repair

After integration, assign a fresh read-only reviewer the original19 pages' preserved preimages, current destination/source articles, raw authority/code references, FACT-MAP, resolutions and change evidence. Do not supply a desired verdict. Require review of missing unique facts, unsupported current claims, intent-versus-implementation confusion, duplicate/conflicting canonical homes, broken navigation, metadata/timestamps and out-of-scope edits.

Resolve material findings, request bounded worker research where needed, and rerun affected checks. Obtain a fresh independent review of repaired integrated content until there is no material finding. No arbitrary pass count substitutes for resolution. Do not treat a pile of worker reports or a reviewer label alone as proof: inspect actual integrated bytes and evidence yourself.

## Completion gate

Declare FACT_REASSIGNMENT_COMPLETE only when:

- All19 page reports exist and every substantive source section/material claim has a recorded disposition.
- Every retained fact is incorporated at its canonical destination or demonstrated already covered; no migration is left as merely proposed prose.
- Incorrect/superseded claims are excluded from active prose with evidence; historical content is preserved; open future product choices are labeled rather than invented.
- Cross-agent disagreements, omissions and material source drift are resolved in integrated articles; no unresolved factual/migration blocker remains.
- Source articles clearly route to successors or retain explicitly justified unique material; no competing misleading current accounts remain.
- Necessary navigation, metadata, timestamp and snapshot checks pass on final bytes, with no unexplained changes.
- Fresh independent final review has no material finding, and the coordinator has inspected the result.
- FINAL-REPORT.md identifies actual source/destination/support edits, counts and fact coverage, major resolutions, verification evidence, all remaining product choices and per-page physical-retirement prerequisites.

If genuinely blocked, report PARTIAL with exact unresolved items, affected facts/pages, attempts and required owner decision; do not declare done. Pending physical deletions are not concealed: the final report must say fact migration is complete but source retirement is a separate remaining operation. Do not start the next cleanup batch automatically.
