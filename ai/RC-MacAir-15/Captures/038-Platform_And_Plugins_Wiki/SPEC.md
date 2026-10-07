# PP-WIKI-01 — Platform, Plugins and Composable Presentation

## Objective and baseline

Make the wiki a usable, durable explanation of the approved layered composition model, with enough current source references and explicit unfinished work to inform later product planning. Follow DECISIONS.md D01-D12. This is a documentation SPEC, not a plugin/component implementation SPEC.

Prerequisites: owner approval of the reviewed release candidate; live repository and code-standards guidance; current Workspaces And Views/Chat/Events authority; reread working-tree files rather than assume prior commits describe concurrent work. All execution paths and sources are in INDEX, PAGE-MAP and SOURCES. Missing source files or changed implementations require researching the new owner and updating evidence, not inventing implementation status.

## Scope and non-goals

Only PAGE-MAP articles, their new exact-preimage .versions files, and artifacts inside this capture may be written. No product code, template/config changes, runtime data, database migrations, builds, app/server launch, Git commit/push, Alpha work, external integrations, archive rewrites, or parallel-program dispatch. Do not modify other captures or the plug-ins repository during execution. No section deletions/moves or wholesale stale-wiki cleanup. This scoped work does not recertify all linked pages or accept prior SPEC results for the owner.

## Reader contracts

C01 Explain the six roles using plain language: shell, platform services, standard components, plugin contributions, configured view instances, custom iframe regions. A workspace, view, tab, drawer, file and plugin are not interchangeable. UI renders on the client; server-owned services provide validation/data/actions.

C02 State the adopted extension boundary: fixed hosting/permission rules, useful built-in library, registered plugin-contributed presentation. Distinguish a reusable presentation component from a privileged service and from a canonical file-type renderer. Contributed components consume explicit data/actions through a host; no global store/network/DB discovery or ambient capability is implied. Exact runtime ABI/isolation is open.

C03 Describe configure → compose → implement a protected component. Give one readable illustrative Capture-style sequence (folder data → cards/search → file in current/new tab → return to collection) and one custom-iframe-region example. Label examples illustrative, not manifest syntax, mandatory component inventory or a current feature guarantee. Do not turn the wiki into UI mockups or implementation instructions for every view.

C04 Tabs/drawers/popups are shell-owned hosts. Preserve identity, focus/lifecycle and current owning state rather than proposing a second tab store. A collection retains selection/filter/navigation state; canonical file surface owns file presentation/editing; platform services own save/history. Do not freeze unspecified duplicate-tab, dirty-buffer, restoration or close policies. Link current owners and leave new policies open if needed.

C05 Protected plugin package and editable copied instance remain separate. Server provisions templates and bindings; templates supply local persona/AGENTS/skills/config. Workspace dependencies can be customized. Template bytes do not become privileged code when copied. Current bundled scaffolding is not plugin provisioning; System/Views is current placement, not the selected future location.

C06 Own-view CWD, local harness context and project-wide authorized working access are approved intended behavior. Other-view resources are deliberately read rather than eagerly injected. Project scope does not erase protected System/plugin boundaries, and instruction reads confer no capabilities. Own skills are exposed through the harness and read when needed, not necessarily full bodies pasted into initial context. Explain current project-root OpenCode startup only after fresh inspection.

C07 Data sources can be local files, app-owned SQLite, CSV/JSON, or authorized connectors. Keep content presentation separate from data authority and host placement. System/fusion.db remains platform storage. Commands execute mutations, facts describe actual transitions/results, bus distribution is not transaction execution. Preserve required prewrite provenance protection, optional context, postwrite recovery and observation limits by linking current authoritative pages. General plugin publishers/external-store mediation remain unfinished unless independently proven.

C08 Iframes support specialized custom UI as a target without unrestricted server/Node/database access. Target hybrid composition uses standard host pieces alongside custom regions and a narrow platform-operation interface; a library inside the iframe is optional/deferred. Existing iframe embedding is not evidence of a working future bridge or isolation model.

C09 Separate every material claim as current source-inspected behavior, approved target, unresolved choice or gap. Current implementation assertions need exact inspected code owners and hashes in CLAIMS.json; no runtime validation is claimed. The new gap register PP-G01… records target, current limit/evidence strength, remaining capability, owning subsystem and decision gate. Reuse WV-G IDs for provisioning/instance/context gaps through links; do not fork competing status records.

C10 New wiki prose stands alone: no capture/SPEC IDs, temporary script paths, execution logs or planning-artifact dependencies. Durable decisions can have page-local IDs. Historical sources belong in this capture; actual code belongs in source-files. Keep the existing specialist references available and explicitly outside this bounded recertification.

## Safety of documentation edits

Execution S00 records HEAD plus working-file hashes, exact page baseline and existing snapshots. Before every write reread and compare current bytes; save an exclusive complete predecessor beside each existing changed page as .versions/YYYY-MM-DD-HHMMSS.md, even for this SPEC's generated/stamp phases. New pages begin with absent predecessors. Never overwrite old snapshots. If bytes changed concurrently, reconcile current content and re-review affected edits. Never reset other work.

Only PAGE-MAP purpose-limited portions may change on shared pages, apart from required metadata normalization and generated navigation. If another live contradiction needs a new owner page, amend scope explicitly and run affected preparation review before editing it. Unrelated stale passages can be listed as excluded coverage; a contradiction that defeats this model cannot be hidden as a warning.

Generate navigation using the existing wiki audit on an isolated staging copy, twice; import only authorized generated blocks through exact preimage comparison. Never run the mutating audit on the live full wiki. Do not hand-author generated entries or copy back unrelated legacy TOCs/audit state.

## Metadata

Every actual changed/new article has nonempty name/description, metadata.source-files as unique exact existing repository-relative code files (or [] for intent/guidance), and quoted UTC metadata.last-modified with seconds and Z. Remove legacy incoming/outgoing-edges, connected-skills and related-trigger-files only from edited pages; preserve unrelated fields. Timestamp is edit time, not verification. Script-stamp the actual final changed-page list using current time; preserve exact pre-stamp bytes and receipt; never stamp untouched/history files. Final checks and review examine post-stamp bytes.

## Acceptance

AC01 All 19 mapped outputs exist, no unmapped article changes/retirements, unrelated bytes protected with external changes separately attributed.
AC02 D01-D12 and C01-C08 represented in reader-facing prose, precise old interpretations superseded, O01-O07 disclosed without invented schema/ABI/runtime guarantees.
AC03 Current assertions source-traced through actual relevant owners and clearly bounded; target components, plugin provisioning, view CWD and iframe bridge not claimed shipped.
AC04 WV-O06/G04 reflect settled intended behavior and remaining mechanics; existing IDs/Chat/UEB/storage contracts preserved.
AC05 New section reachable from wiki guidance and WV overview; reader can follow composition → file surface → data boundary → custom region → relevant gap. All changed local links/fragments and generated blocks valid, no final pending links.
AC06 Valid metadata, exact sources, timestamp receipt and predecessor/snapshot integrity for every actual edit; generated blocks idempotent.
AC07 Complete claim/decision/acceptance coverage, separate source drift/limitations, and all fresh builder, orchestrator and final integration review gates CLEAN.
AC08 Final HANDOFF identifies actual changed articles/hashes, six slice outcomes and review identities, exact checks/results, timestamp receipt, deviations/downstream effects, unresolved choices and source-only verification limits. Completion is SPEC_READY_FOR_OWNER_REVIEW, not owner acceptance or product implementation.

## Execution

S00 → S01 → S02 → S03 → S04 → S05 per SLICES. Stop execution on missing candidate approval. Preparation CLEAN is not execution completion. Material repairs go back through a builder and both independent review owners. No next SPEC starts without owner acceptance and separate authority.
