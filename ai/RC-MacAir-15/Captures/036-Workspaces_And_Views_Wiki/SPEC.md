# WV-01 — Workspaces and Views wiki reconstruction

Status: candidate awaiting independent preparation review and owner approval. This SPEC authorizes documentation execution only after approval of the identified candidate. Repository: `/Users/rccurtrightjr./projects/fs-dev`. Active wiki: `ai/RC-MacAir-15/Wiki`.

## 1. Objective and boundary

Replace stale workspace/view explanations with a coherent account of the owner's plugin-based model, current implementation, and explicit unfinished work. A reader must understand the project folder, registered workspace, view definition/plugin, installed view instance, content root and tab without reconstructing captures or implementation history. The output supplies reliable inputs to a later master plan; it is not that master plan.

The normative bundle is INDEX.md, SPEC.md, DECISIONS.md, SLICES.md, VALIDATION.md, PAGE-MAP.json and SOURCES.json. RELEASE-MANIFEST.md identifies reviewed bytes. Read repository AGENTS.md, the four Wiki Guidance subarticles, the exact standards router and routed pages listed in INDEX.md. Fresh execution source checks supersede preparation-time implementation observations, never owner intent. Read Chat overview and Provenance overview for boundaries.

Only PAGE-MAP rewrite/create/retire/bounded_support paths are writable wiki targets. Capture-local execution evidence and check scripts, exact predecessor snapshots, and disposable audit staging trees are also allowed. All other paths are read-only, including product code, templates, view config/state, SQLite, tests, runtime data, plugin captures/repository, other capture records, Chat tree and Events And Ledger tree. No app launch, server run, build, product tests, commit/push or Alpha operation. Do not call external integrations.

## 2. Reader-facing contracts

C01 Vocabulary: a project folder is not necessarily a Git repository; a workspace is registration/binding plus workspace presentation/configuration; a view instance is not a tab or a content folder. A plugin may contribute a view but not every plugin is a view. Use capsule only when explaining implementation. Explain identity, label and ordering independently.

C02 Approved model: faithfully incorporate D01–D08. Plugin contains templates/implementation/capability declarations and its own maintenance instructions; instance contains local agent resources and editable configuration. Workspace plugin selects view plugins; server provisions. Do not turn the owner's example into a six-view requirement. Installs are not improvised agent copying procedures.

C03 Current truth: source-trace registration, add/create, ribbon hide/show, startup availability, identity discovery, root resolution, template copy and renderer dispatch. Record stale Add Project sequence and Capture naming corrections. Existing bundled-template scaffolding is real; plugin-aware composition/provisioning remains unfinished unless new code independently proves it. Generic parsing or template existence alone is not proof of end-to-end feature support.

C04 Boundaries: current installed views use ai/<machine>/System/Views; intended editable instances move outside System, with exact path open. Ordinary view config/persona/skills/workflows do not grant database/file/process/executable-display authority. Describe plugin reference and content-root validation as required target protections, not an invented completed enforcement system. Preserve System data ownership and state-service boundaries. Do not conflate reading documentation, loading skills into a harness and granting capabilities.

C05 State and chat: link to Chat authority for group/session/placement identity. Explain workspace defaults, view state and group-keyed content worksurfaces without promising every view already restores everything. Preserve prior Side Chat direction: one session per content tab, remove left Show threads/slider in target, retain right list button with unspecified future behavior, separate generic non-chat windows desired. Do not implement or redefine these. Legacy-versus-default chat host choice stays unresolved. Restore behavior must be traced through an actual producer/consumer, not inferred from service support.

C06 Catalog: give one short introduction for each current template type plus the System surface. Exactly route Browser, Capture, Office, Library, Media, Email, Calendar, Contacts, Custom, Files, Issues, Wiki, Agents, and System to their PAGE-MAP articles. Explain purpose, content source, current availability/limitations, and code/specialist references; aim for 100–300 words of introductory prose, with additional existing useful detail retained as needed. Identify template-only/placeholder entries honestly. System/Plugins trust-root surfaces are not automatically ordinary plugins. Voice input and document/sheet/PDF editors are capabilities/surfaces, not new view types by assumption. Do not infer working external sync from a SQLite declaration. Instance label Drive is not a global type rename.

C07 Evidence and gaps: every new/revised material implementation assertion has a source inspection record and exact code owner; runtime-unverified claims say so. Each unfinished capability records approved behavior, current limitation, remaining capability, owning subsystem and open decision gates. A consolidated Unfinished Work page uses stable WV-G01… identifiers and links to the owning articles without duplicating competing status narratives. Distinguish demonstrated missing capability, partial support and unverified coverage. It is not an exhaustive app backlog and carries no implementation schedule or approval.

C08 Structure: preserve existing paths except the duplicate section-root PAGE.md explicitly retired in PAGE-MAP. Make the 000 overview the canonical entry, with generated navigation and a short conceptual reading route. It must distinguish core explanations, view introductions and retained specialist references. No empty future-article stubs. Existing specialist Wiki/Voice internals remain available and byte-preserved, explicitly outside this pass's recertification; a link does not certify their current accuracy. Do not claim the entire old section has been audited. Retained legacy TOC duplicates inside those specialist subtrees are an explicit non-blocking structural deferral; do not recreate such duplicates in new content.

C09 Durability: live wiki prose must stand alone without references to this SPEC, capture numbers, temporary scripts or agent execution logs. Put evidence/implementation bookkeeping in this capture. Durable owner decisions and unresolved product questions belong in wiki prose; current technical source references belong in metadata/body as appropriate.

## 3. Scope, protection and failure behavior

Use PAGE-MAP's exact purpose limits, including shared standards patches that distinguish current System placement from newer target direction. Shared excerpts are not a license for a general standards rewrite. Preserve unrelated paragraphs and current accepted Chat/Provenance contracts. If execution finds another contradictory cross-section statement outside those limits, record a concrete dependency with path/claim/impact. Amend the normative scope and run affected preparation review before changing another article; do not silently expand or declare a material unresolved contradiction clean.

At S00 capture current HEAD plus exact working-file hashes, not merely Git diffs. Before each write reread the live bytes and save an exclusive, complete .versions/YYYY-MM-DD-HHMMSS.md predecessor for every existing modified/retired page. Never overwrite snapshots; wait for a new timestamp if necessary. New pages have absent predecessors. Compare-before-write and reread-after-write prevent overwriting concurrent work. If another writer changes an owned article, reconcile against its newest bytes, record the overlap and re-review affected assertions. Unrelated outside-scope drift is attributed and left alone; do not reset it or count it as our edit. Do not stamp untouched pages.

Retiring the section-root PAGE.md requires a repository reference scan, not only a wiki scan. Historical captures and .versions remain historical and unedited. Existing live inbound wiki link owner is explicitly mapped; if another live dependency appears, resolve via the scoped amendment rule before removal. Store a retirement receipt and exact predecessor. Do not delete the containing folder or its .versions history.

Audit tooling writes more than requested markers and does not stamp timestamps. Use an isolated copy of the active wiki with symlinks dereferenced or rejected, run the owning audit there, and import only authorized generated blocks into current owned pages using exact-match preimages. Never run an unbounded live-wiki audit or sync workflow. Preserve all other page bytes, normalize only actually edited metadata, then stamp. Generated block content is produced by tooling, not hand-authored. See VALIDATION.md for command and idempotence checks.

## 4. Metadata

All new/edited live pages adopt name, description, metadata.source-files (unique exact repository-relative existing code files; [] only for genuinely non-code guidance) and quoted UTC metadata.last-modified in YYYY-MM-DDTHH:mm:ssZ. Remove authored incoming/outgoing edges, connected-skills and related-trigger-files on changed pages; preserve unrelated metadata. Audit legacy source directories, placeholders and stale paths before carrying them into revised source lists. Retained reference articles do not undergo opportunistic normalization.

At final integration a script may apply one current UTC time to the actual changed-page list, as the owner explicitly authorized. Preserve exact pre-stamp versions and all non-timestamp content; append a receipt with before/after hashes, do not overwrite earlier acceptance evidence. Final review evaluates final stamped bytes. A timestamp is modification time, not verification.

## 5. Acceptance

AC01 All mapped outputs exist with required purpose; only mapped retirements occur; retained references are byte-preserved relative to execution baseline except separately attributed external changes.
AC02 All owner decisions D01–D09 are represented, with exact supersessions and open O01–O06 still classified correctly.
AC03 C01–C06 hold against freshly read code; no target provisioning/relocation/context/capability claim masquerades as shipped behavior.
AC04 Each catalog item has a real introduction, current status and relevant source/specialist links; no template-only inference.
AC05 Gap index links to bounded article evidence and future gates; no unapproved default path, schema, permissions, dependency behavior, update strategy or build order.
AC06 Changed pages have valid metadata, timestamps and exact sources; changed local links/fragments resolve and no new incoming links break on retirement.
AC07 Generated navigation matches staged generator output; second staging run has no block drift; unrelated live pages and prior snapshots are not mutated by our work.
AC08 Every edit/retirement/stamp has required predecessor/hash evidence; all deviations, source drift, conflicts, warnings and shared-document effects are reported.
AC09 A fresh independent preparation review is CLEAN before owner execution approval, and separate builder/acceptance/final implementation reviews meet SLICES.md. Preparation CLEAN never certifies execution.
AC10 Final handoff identifies actual changed articles, final hashes/timestamp receipt, source-inspected baseline, all checks, excluded specialist coverage, open product questions and residual cross-section dependencies. No product/Alpha/runtime certification.

## 6. Execution and completion

Order S00 → S01 → S02 → S03 → S04 → S05; one slice writer at a time. SLICES.md defines packets and independent review. VALIDATION.md defines exact check interfaces and pass criteria. All acceptance repairs go through a builder and both review owners. Final status is SPEC_READY_FOR_OWNER_REVIEW only after all gates pass; owner acceptance is separate. No next SPEC is automatically authorized.
