---
name: Chat Wiki Reconciliation Part 1
description: Identity vocabulary repair evidence and builder review receipt for the six scoped Chat articles.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

# Part 1 — Thread, session, and placement identities

Builder `/root/wiki_part_1`; Part 1 only. Source-inspected on 2026-09-19 in primary development checkout `/Users/rccurtrightjr./projects/fs-dev`, HEAD `88637d11c65be53d4f2ad0f049f64a07fa3db1de`, branch `agent/exact-workspace-paths`. Owner dispatch authorizes execution of the approved specification despite its unchanged preparation-only header. This is documentation evidence, not an Alpha, runtime, or whole-corpus certification. Full initial dirty context and original bytes are in `EXECUTION-BASELINE.json`; this part preserves those owner/worker edits.

## Changes and acceptance

Six pages under `ai/RC-MacAir-15/Wiki/007-Chat_System` changed:

- `000-Overview_and_References/PAGE.md`: user-first group/session introduction and action/storage identity map.
- `001-Identity_And_Persistence/PAGE.md`: group, session, surface and placement ownership; group actions, view continuity and placement close.
- `001-Identity_And_Persistence/001-Thread_Identity/PAGE.md`: explicit action/identity table and storage/placement explanation.
- `006-Runtime_Model/PAGE.md`: introduction and Persistent Unit passages distinguish groups from sessions.
- `000-Overview_and_References/001-Vision/PAGE.md`: synchronized developer vocabulary without changing product goals.
- `000-Overview_and_References/002-Decisions/PAGE.md`: durable identity decision and article link; September 19 owner direction unchanged.

Each page has a byte-exact pre-edit `.versions/2026-09-19-020136.md`; paths/hashes are in `PART-01-SNAPSHOTS.json`. Added capture evidence: this report, that snapshot manifest, read-only `verify-part-01.py`, and its raw result `PART-01-CHECKS.json`. Root exclusively owns `EXECUTION.md`.

| Part 1 criterion | Implemented documentation and direct source evidence |
|---|---|
| User-visible Thread versus chat session | Overview, Identity parent/child and Runtime intro agree: group owns title, immutable workspace/view, membership, primary and ordering; session owns transcript/runtime. `thread-groups/repository.js` `toProjection`, `insertGroup`, `insertMember`, `_populationQuery`; `thread-groups/service.js` `listGroups`, `resolveOpenTarget`; migration `041_thread_group_foundation.js` schema. All server paths below are under `fusion-studio-server/lib/`. |
| Choose rename/delete versus prompt/Stop | Identity action table and narrative: `thread-groups/service.js` `renameGroup` resolves owned group and calls manager compatibility rename; `thread-groups/delete-service.js` `deleteGroup` calls `thread/ThreadManager.js:832` `deleteGroup`, enumerating/fencing/deleting member sessions. Client `src/lib/ws/threadGroupRows.ts` `threadActionRename`/`threadActionDelete` preserve group identity; `src/components/chat/useLegacyChatHost.ts:273` `handleSend` and `:370` `handleStop` target exact `threadId`. |
| Session state, model, turns and provenance stay session-owned | Identity and Runtime statements preserve valid `threadId` use. Client `useLegacyChatHost.ts:215` reads workspace/session draft key, `handleComposerDraftChange` writes that key, `handleModelSelectionChange` addresses exact session; `chatSurfaceContract.ts` explicit mount/model contracts. Existing identity/provenance clauses retained; no provenance rekey is proposed. |
| Main/Side are peer presentations; Move preserves A and creates empty B | `thread-groups/move-service.js` `moveChatToSide` stages a new manager-owned session, inserts peer membership, appends primary history and writes A's placement; `resolveMoveSessionPolicy` copies only server-validated portable selection, not context/provider resume identity. The pages describe empty conversation, not absence of inherited model selection. |
| Group-keyed continuity; null is Legacy | `view-state/thread-worksurface.js` `getThreadWorksurface`, `validateGroupIdentity`, `mutateUnderQueue`: owning capsule state, group key, no Legacy entry. `service.js` `listGroups`/`resolveViewTarget` and repository `_populationQuery` treat null explicitly. |
| Durable placement versus transient mount; tab close preserves conversation | Client `chatSurfaceContract.ts` `ChatMountIdentity`/`mintChatSurfaceId`; `ChatSurfaceComponentMount.tsx` `isTupleHydrated`/`ChatSurfaceReadyMount`; `sideChatBridge.ts` `buildSideChatTabDescriptor` and close callback contract. Server `view-state/thread-worksurface.js:380` `mutateManagedPlacement` records closed disposition, retaining descriptor; `thread-groups/member-service.js` `openMemberInSide` addresses the same member. |

## Reading, checks and self-review

Read root and server AGENTS, full approved SPEC, Wiki Style Guide/Updating, code-standards hub and Architecture Routing, Frontend UI, State Management, Persistence/Metadata pages, the complete spec-review-gate skill, all six current articles, and the source owners above before/while editing. Additional actual source reads establish dependent close/delete/draft behavior rather than trusting comments alone. Read existing assertions in `test/thread/thread-group-repository.test.js:94–167` (populations, unique membership, ownership, rename) and `test/ws/thread-group-move-side-chat.integration.test.js:212–275` (same A, empty B, peer membership, primary, placement). These are inspected assertions, not tests run today.

Commands run from repository root:

- `python3 ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation/verify-part-01.py`: exit 0, **1,855 checks passed**, errors `[]`; exact raw output and six current page SHA-256 identities in `PART-01-CHECKS.json`. Checks cover 39 pages' generated blocks, 6 exact pre-edit snapshots, 33 untouched article bytes, 1,668 protected-file hashes, unchanged authority/HEAD/product inventory, 6 frontmatter parses using `./fusion-studio-client/node_modules/gray-matter`, 62 existing source paths, 24 relative links and 1 heading fragment. No external link exclusions were needed; fenced illustrative code is excluded from navigation parsing. Existing Decisions config metadata resolves after `<machine>` substitution but is not a code file; retained for Part 6 normalization.
- `git diff --check -- ai/RC-MacAir-15/Wiki/007-Chat_System ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/013-View_Activity_And_Collections ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation`: exit 0, no output.
- Scoped `git diff` plus exact snapshots: manually inspected all introduced identity prose, source pointers and action/storage boundaries. New ordinary prose is single-line per paragraph; no generated block edit, article move, new ephemeral SPEC dependency, identity field rename, or owner-intent change. `rg 'Thread_Identity/PAGE.md#' ai/RC-MacAir-15/Wiki` found no inbound anchors to the replaced child headings.
- Targeted identity/ordering/SPEC sweep confirms the obsolete “persistent unit is a thread” and Overview “thread is the durable conversational identity” introductions are gone. Existing two-cause ordering and older SPEC references remain in untouched passages for their owning later parts; this gate does not claim they are reconciled.

Self-review refined tab-close language to distinguish removal from the open tab set from deletion of a durable placement record: the service retains a closed disposition. Rename prose acknowledges manager compatibility name/mirror writes. No post-edit product defect or repair was discovered. A few exploratory guessed glob/module paths returned no-match/not-found; exact owners were then found with `rg --files` and read. No required validation was skipped because of those discovery misses.

## Deviations, downstream work, and limitations

- D1 (proposed `accepted`): capture-local manifest/verifier/raw-check files supplement the requested report. Reason: reproducible exact-byte, parser, link and protected-file evidence. No product effect; later parts must use their own snapshots because intentional subsequent wiki edits invalidate this fixed candidate check.
- D2 (proposed `accepted`): read additional close/delete/host/view-state owners and add their real source pointers in the four technical entry pages. This is bounded mechanical evidence integration within the advisory page list, with no source edits or change to later parts' behavior.
- D3 (proposed `downstream_impact`): retained known ordering statements, protocol/creation examples, existing Runtime SPEC references and Decisions' config source pointer for Parts 2/4/6/7. They predate this part and are explicitly assigned later; Part 1 certifies identity mapping only. No new unsupported source or ephemeral reference was introduced.

D4 (proposed `accepted`): the final read-only verifier output was temporarily redirected to `/tmp/fusion-chat-part1-final-checks.json` and compared byte-for-byte with the reviewed receipt using `cmp` (exit 0), then removed. This temporary verification output is the only write outside the allowed wiki/capture artifact paths; it had no product effect or downstream impact.

No other out-of-scope write, adapter, shim, product/test/config/runtime edit, database operation, commit/push, application launch or Alpha operation. The six snapshots retain prior owner edits exactly, including both right/left Side Chat control distinctions and the future non-chat container boundary. The default-host/UI gap, button behavior, link focus integration, ordering and source-history topics remain later parts; no Part 2 work began. The orchestrator, not this proposal, classifies deviations authoritatively.

Client build, server tests, smoke/server launch, Electron/manual runtime and Alpha checks: N/A and not run for this prose-only authorized slice. Manual evidence consists of source and document inspection only; no runtime observation or rendered-app claim. Residual limitation: unrelated and later-part passages are not recertified by this identity repair.

## Builder-owned review gate

**CLEAN — READY_FOR_ORCHESTRATOR_REVIEW.** First materially clean pass; no repairs or additional pass required. Fresh reviewer `/root/wiki_part_1/part1_review1` ran as `clean-room-reviewer` with `fork_turns: none`, no model/effort override and a neutral bounded raw packet. Pre-spawn lifecycle inventory confirmed no prior reviewer. The reviewer returned terminal CLEAN with no material findings; `collaboration.list_agents` then confirmed completed status. Post-result tool discovery again found no `close_agent`, so closure is unavailable; terminal disposition is recorded here and no conflicting reviewer remains.

The reviewer independently reproduced 1,855 passing checks, scoped diff cleanliness, current candidate hashes, source ownership and preserved owner intent. It proposed D1/D2 accepted and D3 downstream_impact; the orchestrator retains classification authority. No reviewer edited files, no validated material finding remains, and no advisory expands this slice. The six reviewed wiki SHA-256 values remain exactly those in `PART-01-CHECKS.json`.

Only this administrative gate receipt was appended after review. Final verification repeats the document/preservation check, scoped diff check, report gray-matter parsing, and whitespace/newline inspection of the ten new evidence/snapshot files. All pass. An additional exact-text check confirms the complete preexisting September 19 owner section survives unchanged. No product/source/wiki candidate bytes changed after review.
