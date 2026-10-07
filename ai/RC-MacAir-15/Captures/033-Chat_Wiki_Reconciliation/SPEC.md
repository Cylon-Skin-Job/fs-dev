---
name: Chat Wiki Reconciliation Specification
description: Sequential documentation repairs that establish a checked Chat System baseline and separate current behavior from owner intent before further feature specifications are written.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Chat Wiki Reconciliation

Prepared 2026-09-19. Status: proposed execution specification; documentation repair has not been executed under this specification. Independent review status is recorded separately in `REVIEW.md`. A clean review evaluates this specification, not the accuracy of the unrepaired wiki or completion of product work.

## 1. Outcome and scope

Make the Chat System wiki a consistent, evidence-backed account of the development implementation, with explicit separation between current behavior, owner-directed future behavior, and unresolved choices. A subsequent session must be able to use it to prepare the remaining feature specifications without restoring retired chat behavior or mistaking planned functionality for shipped code.

Execute the parts below in order, completing and checking one issue before beginning the next. This is a documentation task. Do not implement features, change runtime behavior to match prose, publish, restart either app, or update Alpha. The present request authorizes preparation and review of this spec; execution is a subsequent task.

Paths below are repository-relative. `W` means `ai/RC-MacAir-15/Wiki/007-Chat_System`. `C` means this capture directory. These identify the actual development corpus inspected here; use `ai/<machine>/` in portable product descriptions and do not rename the machine subtree.

Allowed writes during execution:

- Existing `PAGE.md` files under `W`, and their `.versions/` snapshots.
- `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections/PAGE.md` and its snapshot, only if needed to reconcile its direct chat-worksurface claims.
- Execution evidence and the final handoff under `C`.

Read-only dependencies include source code, existing tests, wiki guidance, and historical build/acceptance records. Preserve all pre-existing local changes, including the September 19 Side Chat clarification, its later right-button correction, and their snapshots. Do not rewrite the accepted `025-Chat_Composition_Roadmap` packet, unrelated wiki domains, root `AGENTS.md`, tests, product code, runtime state, or databases.

## 2. Authority and evidence rules

1. Owner direction establishes intended behavior. It does not establish implementation. Source paths and reachable call chains establish source-inspected current behavior; an existing test is evidence of an asserted contract, not proof it passed today. Runtime claims require an actual recorded runtime observation.
2. Where source contradicts intended behavior, document both and the gap. Do not silently declare the code correct as a product choice or change the desired behavior to match it. Where a claim cannot be established, label it unverified and identify the missing evidence. A material unresolved current-behavior contradiction prevents a ready handoff.
3. Historical reports establish what was reported or accepted at their recorded revision. They are not current execution evidence. The composition packet has September acceptance records and committed implementation even though some planning headers still say draft. Do not treat those stale headers as live blockers or edit the historical packet to resolve them.
4. Follow `000-Wiki_Guidance/001-Style_Guide/PAGE.md` and `003-Updating_Wikis/PAGE.md`: version each page before substantive edits, preserve frontmatter and generated marker blocks, keep ordinary prose on one physical line per paragraph, and use real code paths in `source-files`. Do not put links to this SPEC or implementation slice identifiers into new durable wiki explanations. Link between durable wiki articles instead; keep build receipts and review machinery in `C`.
5. Avoid structural migration: no article moves, renumbering, new navigation scheme, or generated TOC rewrites. The documented TOC scripts are absent at the inspected paths. Preserve generated blocks byte-for-byte; report a required structural change instead of inventing a replacement generator.
6. This specification covers the development checkout. It must not certify the installed Alpha build. Record revision, dirty-file context, date, and verification method wherever a baseline claim is made. An evidence summary must qualify the specific claims checked, not imply the entire 38-page corpus was runtime-tested.

### Owner direction to preserve

The following was supplied in this conversation on 2026-09-19 and recorded in the local wiki edits before this spec:

- Sending Main Chat to Side Chat does not give the Side Chat its own left-column threads. A Side Chat is one chat in a content tab.
- Latest owner correction supersedes the ambiguous earlier phrase “same header list button”: only the right-hand list button is retained in Side Chat tabs. Remove the left-hand Show threads control and sliding thread-panel behavior from the intended tab experience. Current code identifies these separately: left `dock_to_right` / Show threads and right `event_list` / More options. The right-hand button’s future shared behavior is still to be defined. Record the needed Side Chat UI change as remaining product work, without implementing it in this documentation task or redesigning Main Chat navigation and unrelated header controls.
- Chat tabs are the new paradigm. Do not bring back the former floating/minimized Secondary Chat as a chat mode.
- Preserve or recover the old windowed-container capability for non-chat content, including minimizing to a small button and reopening a content window. No content type set, persistence policy, ownership model, native OS window requirement, sticky-right requirement, or animation requirement has been chosen.
- The purpose of this work is to solidify the wiki so another session can prepare the remaining specs. It is not approval of those future feature specs.

## 3. Execution protocol and evidence

Part 0 creates `EXECUTION.md` in `C`. For each part record: status (`not started`, `in progress`, `checked`, or `blocked`); changed paths; claims checked with source path and symbol/line; checks and actual results; unresolved items; and any departure from the planned edit scope. Keep evidence proportional. A statement that a test file exists is distinct from a test run and must be labeled that way.

Before a part starts, inspect its current files again. If concurrent changes affect its evidence, reconcile and recheck the affected claims without overwriting another worker. Use the recorded baseline to distinguish this task's changes from existing ones. Do not require a clean worktree, discard changes, or create commits as a prerequisite.

When a part passes its exit criteria, continue to the next part within an authorized execution task. A new owner decision is required only if a material ambiguity cannot be represented honestly without deciding product behavior; ask that focused question and leave the dependent part blocked. Routine documentation corrections require no additional permission.

No client build or full server test suite is required for prose-only changes. Prefer source reads, existing test inspection, link/source checks, frontmatter parsing with the repository's existing parser, and scoped diff review. If a live behavior cannot be resolved from source, record the limitation before considering a targeted test; do not launch applications or heavyweight suites implicitly.

## Part 0 — Establish the exact baseline

**Issue:** A mid-build checkout and partially updated wiki must not be treated as a clean, fully verified release.

1. Resolve the root with `git rev-parse --show-toplevel`; confirm the primary development checkout. Record HEAD, branch, `git status --short`, and relevant local changes. `BASELINE.json` is this spec's preparation-time inventory, not a substitute for a fresh execution baseline.
2. Inventory every active `PAGE.md` under `W`, excluding `.versions`; preparation found 38 pages. Record paths and content hashes. Add the directly related View Activity article separately.
3. Read wiki guidance, the Chat overview, Runtime Model, Identity, UI, the September 19 Decisions entry, and the applicable source modules for the first repair. Consult the composition acceptance records only to distinguish historical implementation from deferred work.
4. Create the execution ledger. List every part as not started, then record Part 0's checks. Preserve prior-version files and all unrelated changes.

**Exit:** A reproducible execution inventory exists; local September 19 intent is retained; neither Alpha nor runtime health is inferred from HEAD. No wiki repair is claimed yet.

## Part 1 — Define Thread, chat session, and placement consistently

**Issue:** Entry pages still use “thread” as though the visible item and one conversation were always identical, while newer sections distinguish groups and sessions.

**Primary pages:** `000-Overview_and_References/PAGE.md`; `001-Identity_And_Persistence/PAGE.md`; `001-Identity_And_Persistence/001-Thread_Identity/PAGE.md`; `006-Runtime_Model/PAGE.md` identity/persistence passages. Synchronize the relevant terminology in Vision and Decisions without replacing their intent with implementation detail.

**Evidence:** `fusion-studio-server/lib/thread-groups/{service,repository,move-service}.js`; `fusion-studio-client/src/components/chat/{chatSurfaceContract,ChatSurfaceComponentMount}.tsx` or `.ts` as applicable; `fusion-studio-client/src/lib/ws/threadGroupRows.ts`. Resolve the actual extensions before adding source pointers.

Explain in user terms first, then map identities:

- Visible Thread / internal Thread Group: title, immutable workspace/view binding, membership, primary selection, visible ordering, and group-keyed view continuity.
- Chat session / `threadId`: transcript, runtime, draft, model selection, prompt/Stop targeting, turns, and provenance.
- Main/Side: presentation of peer sessions; Move preserves the existing session and creates an empty Main peer without copying context.
- `surfaceId`: transient mounted UI state; `sideChatPlacementId`: durable Side Chat placement. Closing a tab removes placement, not the conversation or group membership.
- `viewId: null`: explicit Legacy population, never an instruction to borrow the active view.

**Exit:** The overview, identity article, and Runtime introduction agree. A reader can select the right identity for rename/delete, prompt/Stop, worksurface storage, and tab close without consulting a SPEC. Preserve valid session-specific uses of “thread”; do not blindly replace every occurrence.

## Part 2 — Correct visible Thread ordering

**Issue:** Identity says “permanently, only two causes” advance ordering; Runtime and Thread Actions omit accepted Move despite the implemented third cause.

**Primary pages:** `001-Identity_And_Persistence/PAGE.md`; `006-Runtime_Model/PAGE.md`; `002-Harness_And_Event_Flow/006-Thread_Actions/PAGE.md`. Sweep active Chat pages for competing rules.

**Evidence:** `fusion-studio-server/lib/thread-groups/move-service.js` (`recordActivityAndAdvance` with `move:${requestId}`); `repository.js`; creation and prompt-acceptance call sites discovered from those symbols. Read the relevant existing group activity tests.

Document creation, accepted prompt, and accepted Move as the three implemented causes. Explain idempotent activity keys and distinguish the group's visible ordering clock from legacy per-session timestamps. Passive open, warming, provider completion, Stop, rename, tab close, and member reopen must not be incorrectly described as visible-list activity.

**Exit:** All active ordering descriptions agree with the traced writers. Include one explicit example: accepted Move advances the group once; retrying the same Move or reopening its tab does not. A text sweep finds no remaining unconditional two-cause claim.

## Part 3 — Correct group links versus exact Side Chat links

**Issue:** The protocol still says resolution opens Main Chat “either way.” The server instead resolves non-primary member placement, but that does not establish visible client focus. Source inspection during spec review found no matching `resolve_link` focus handler in the renderer.

**Primary pages:** `002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md`; `006-Thread_Actions/PAGE.md` in the same directory; `004-Chat_UI/005-Menus_And_Modals/PAGE.md`.

**Evidence:** `fusion-studio-server/lib/thread-groups/{application-link,link-service,member-service,placement-delivery}.js`; the action-result branches (including the absence or presence of `resolve_link` handling) in `fusion-studio-client/src/lib/ws/thread-handlers.ts`; relevant existing link/member tests.

Document separate columns for server resolution, renderer response handling, and intended presentation. Trace group-only/current-primary links through Main Chat hydration; trace valid non-primary member links through retained placement resolution and any actual renderer handling; trace invalid/foreign/member-unavailable failures without assuming fallback. At the preparation baseline, `resolve_link` returns exact-member placement fields, the public handler skips Main Chat hydration for that member, and an already-open placement returns without mutation. The renderer focuses placements for `open_member_in_side` but has no equivalent `resolve_link` branch. Consequently, server success or a helper result named `focused` is not evidence that the visible selected tab changes. Carry this source-observed integration gap into the handoff as future product repair, not a documentation-only claim that focus already works. Recheck against execution-time code, and label this finding source-derived unless a targeted runtime test is actually run. Preserve actual URI validation, workspace/view constraints, and no-promotion/no-ordering side effects.

**Exit:** Copy Link, link resolution, and the Side chats menu each have an accurate current-behavior description; do not force parity where integration is missing. Document the known already-open-but-unfocused Side Chat case: exact-member resolution can succeed without selecting the tab. Also inspect the closed-placement case without inferring visible reopen from persistence alone. Distinguish intended exact-member presentation from the implementation gap, record any absent consumer, and identify a bounded product follow-up. No code repair is part of this task. Do not invent cross-workspace navigation behavior.

## Part 4 — Repair list, open, and creation examples

**Issue:** Generic-looking examples describe Legacy listing and session-addressed opens without explaining the new group/view contracts.

**Primary pages:** `006-Runtime_Model/PAGE.md`; `002-Harness_And_Event_Flow/004-WebSocket_Protocol/PAGE.md`; relevant browse/activation paragraphs in Overview and Decisions.

**Evidence:** `fusion-studio-server/lib/ws/thread-ws-handlers.js`; `fusion-studio-server/lib/thread/{thread-crud,thread-harness-config-policy}.js`; `fusion-studio-client/src/lib/ws/{threadGroupRows,thread-handlers}.ts`; `fusion-studio-client/src/components/chat/useViewChatHost.ts`.

Provide clearly labeled examples for Legacy listing (`viewId: null` or omission as accepted by the handler), view-qualified listing, visible-row open by `threadGroupId`, and the retained exact-session compatibility path where valid. Explain response/request correlation at the level necessary to avoid changing the wrong population. Workspace authority is connection-bound; do not add client authority fields to examples.

For New Chat, state the currently eager session-plus-group creation behavior and distinguish view-bound creation from Legacy creation. Pending New Chat / provider-signal-gated commit is future work, not current behavior. Trace normalization and the public handler before documenting create/resume failures: unknown explicit groups, foreign session IDs, unknown session-only IDs, and omitted IDs may have different treatment. Existing internal comments and a lower-level fallback alone do not establish public reachability. If an old fallback is reachable, document it honestly and record any intent mismatch rather than removing it through prose.

**Exit:** Every example can be traced to an accepted request shape and its actual handler behavior. A builder cannot mistake an unqualified list for “all chats in every view,” substitute group identity for live routing, or assume Pending New Chat is implemented. Group creation is included in the creation narrative.

## Part 5 — Describe the actual UI transition and future owner intent

**Issue:** New composition is implemented, but normal workspace chat remains Legacy, and historical Side Chat requirements differ from the latest owner direction.

**Primary pages:** Overview, Vision, Decisions, `004-Chat_UI/PAGE.md`, Thread Header and Menus articles, relevant Runtime/Structure passages; inspect the direct View Activity article for agreement.

**Evidence:** `fusion-studio-client/src/components/chat/{useLegacyChatHost.ts,useViewChatHost.ts,ViewWorksurfaceDock.tsx,ChatSurfaceComponentMount.tsx,ChatSurface.tsx,ChatAreaHeader.tsx}`; production dock mounting in `CaptureTiles.tsx`, `FileExplorer.tsx`, `WikiExplorer.tsx`, `OfficeGrid.tsx`, and `EmailGrid.tsx` at their actual paths; server `lib/thread-groups/chat-capable-views.js`; existing Side Chat test assertions. For retired windows inspect `git show 554bedf^:fusion-studio-client/src/components/SecondaryChat.tsx` and the companion header/button/state, plus active `src/hooks/useFloatingWindow.ts` and `src/components/email/EmailComposeWindow.tsx`.

Document three separate categories:

1. **Current, source-inspected:** normal workspace Legacy host; view-bound View Threads docks and their actual participating views; Move eligibility; Side Chat renders no nested/left-column ThreadRail; its left-hand Show threads button currently toggles the outer view dock state, while its right-hand event_list / More options button opens the current menu; no claim of a visible dock for adapterless views without one. Old chat popup/container deleted, shared drag/resize mechanics retained for email compose.
2. **Owner direction:** chat placement in tabs; Side Chat tabs have no left-hand Show threads button, thread-panel slider, or nested list in the target design; only the right-hand list button survives from those two controls and its later shared behavior remains to be defined; recover a non-chat windowed content container.
3. **Unresolved:** whether view-bound chat becomes the default production experience; eventual list-button action; content-window scope, persistence, placement ownership, and any sticky-right/animation carryover. Record questions without choosing answers or inventing approval history.

Explicitly record that the current left-hand outer-dock toggle is a product gap against the latest owner direction, not a behavior to preserve or a permanent product requirement. Do not claim a generic window container already exists or infer an OS-native window requirement from the retired in-app overlay. Do not label either current button inert or claim the left-hand toggle is already removed. Label the two buttons by position, icon, and current accessible name so a later builder cannot remove the right-hand button by mistake. Keep restored window work outside this repair.

**Exit:** A reader knows where Move works today, which shell code is gone, what survives, and what remains undecided. The September 19 clarification is preserved and discoverable from the overview. Technical test descriptions may describe current assertions but must not imply those assertions approve the future product design.

## Part 6 — Repair source pointers and historical context

**Issue:** Deleted file references and the missing recent architectural history can send an implementation session to the wrong code or generation.

**Primary pages:** Composer, Reply Payloads, Structure, Changelog; source metadata and immediate explanatory pointers in any active Chat article.

Check all `source-files` entries in active Chat pages. Replace the two deleted `useChatArea.ts` pointers with the actual owners of each documented behavior, rather than automatically substituting one filename everywhere. Validate literal paths; resolve machine placeholders against the recorded namespace when applicable. Classify directories, config/document references, and unresolved patterns explicitly; metadata source lists should contain actual code files under the existing guidance.

Add concise, historically dated entries for verified composition milestones (groups, surfaces, worksurfaces, Side Chat tabs, retired Secondary Chat) using Git/acceptance evidence. Distinguish implementation/acceptance dates from today's documentation date and any installed-build claims. Retain the older June history and the September 19 clarification. Do not fabricate intermediate change dates or copy execution ledgers into the wiki.

**Exit:** All active Chat source pointers are resolved, corrected, or explicitly removed with the reason recorded. No deleted `useChatArea.ts` reference remains as an active owner. The changelog explains the transition without declaring deferred features implemented. Fresh draft/accepted roadmap header differences stay in handoff evidence, not product prose.

## Part 7 — Whole-section consistency gate and handoff

**Issue:** Local fixes are insufficient if another active page still presents a conflicting rule as authoritative.

Read every active Chat page from the Part 0 inventory and the direct View Activity article. Record a per-page disposition: changed and checked; read and consistent for this reconciliation; or unresolved with the precise claim. This is a sweep for identity, ordering, linking, targeting, creation, UI placement, source ownership, and current-versus-future classification. It is not exhaustive recertification of unrelated rendering, security, harness, or persistence internals.

For newly discovered contradictions in these themes, correct the owning part and its dependent text, then recheck the affected criteria. For unrelated or larger findings, record exact evidence and scope separately. Do not silently broaden into product repairs. If an unrelated finding makes a page unsafe as authority, label the claim/section unverified and carry an explicit handoff limitation; do not certify it by omission.

Required checks:

- `git diff --check -- ai/RC-MacAir-15/Wiki/007-Chat_System ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections` plus inspection of new evidence and snapshot files (untracked files do not appear in ordinary diff).
- Parse changed page frontmatter with the existing `gray-matter` parser used by the wiki; do not install or alter dependencies. If unavailable, record the unavailable check and do not claim it passed.
- Resolve actual relative Markdown links and heading fragments in changed pages. Exclude explicitly illustrative examples and external URLs with reasons; do not count unresolved navigation as valid. Verify source pointers and all newly claimed code symbols.
- Compare generated marker blocks to the Part 0 baseline: unchanged. Verify each substantively changed page has a byte-exact pre-edit version. Reused valid snapshots are acceptable only when they match the exact pre-edit bytes for this execution.
- Inspect the final diff for preservation of pre-existing changes, no product/runtime edits, no new ephemeral-plan dependencies in wiki prose, and no invented owner decisions.
- Repeat targeted text sweeps for unconditional two-cause ordering, universal Main Chat link resolution, unlabeled Legacy examples, obsolete active source paths, and statements that the floating content container is already available. Inspect matches in context; historical mentions are allowed when clearly labeled.

Write `HANDOFF.md` under `C` with: baseline and changed paths; each part's outcome; what is source-verified versus runtime-observed; the durable wiki entry points; unresolved owner decisions; and separate future work candidates (exact-member link renderer focus/reopen integration if still missing, Side Chat removal of the left-hand Show threads control/slider while retaining the right-hand list button, default chat-host transition, future shared right-hand list-button behavior, generic non-chat windows, and Pending New Chat or other deferred composition work only as supported by existing records). These are planning inputs, not approved product SPECs. State any residual authority limitation explicitly.

**Exit:** No material contradiction remains in the reconciliation themes; all required applicable document checks pass; unresolved future design stays explicitly future. If a required check or material reconciliation is blocked, hand off a blocked/limited status with exact reason instead of declaring the wiki ready. A completed documentation reconciliation is not evidence of a successful runtime test or a complete product build.

## 4. Completion criteria

The documentation execution is complete only when Parts 0–7 meet their exits, every changed claim has evidence or an honest future/unverified designation, the per-page sweep and checks are recorded, and `HANDOFF.md` makes the scope safe for a fresh implementation-planning session. It must not require the reader to reconstruct accepted SPEC slices merely to understand current chat behavior.

The present specification review is a separate gate: audit this document, use fresh read-only independent reviewers under the requested clean-room loop, repair material defects within the authorized review budget, and record the exact reviewed document hash in `REVIEW.md`. Stop after the first materially clean pass. Do not execute Parts 0–7 as part of reviewing the plan.
