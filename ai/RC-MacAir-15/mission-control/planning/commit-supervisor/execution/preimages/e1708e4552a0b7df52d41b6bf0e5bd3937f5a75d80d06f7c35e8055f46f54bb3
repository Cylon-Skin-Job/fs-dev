# Skills and agent inventory

## Current installation

The D-007 approved local package has now been created. Read [deployment.md](deployment.md) for current paths, namespaced profiles, local skill suppression and verification. The original inventory and source fingerprints below remain a dated baseline; their “not yet moved” statements describe that inventory event, not current local availability. D-013 subsequently removed Second Brain from installed skills and repaired its personal Launchpad/Capture/Checkpoint callers; the source fingerprints below describe the earlier inventory, not those current bytes. See deployment.md for the split between memory maintenance, explicit history checkpointing and document sweeps.

D-015 adds local `mc-preflight` as an inline Launchpad procedure and renames the planned independent final gate to Release Validation. Historical Preflight references below describe that older gate; current definitions and availability are in deployment.md.

D-018 rebuilds the local creator as a Creation Supervisor and adds stage orchestration, candidate authoring and independent planning validation. D-019 adds the standalone Draft Supervisor; current local definitions total sixteen skills/nine profiles; the historical global inventory below remains unchanged. See deployment.md for tested limits.

## Scope and status

Observed 2026-09-26T00:59:37Z by Codex side chat (ephemeral). Inspected 11 personal skill directories under `/Users/rccurtrightjr./.codex/skills/` and 3 standalone profiles under `/Users/rccurtrightjr./.codex/agents/`, plus their relevant references, helpers and UI metadata. This is a bounded inventory of the current paradigm and adjacent utilities, not a product-code audit or a survey of bundled plugins.

The owner identifies Second Brain as legacy v1, to be replaced by Checkpoint and other focused skills (D-006). That direction is settled. Placement and extraction details below are recommendations, not evidence of completed installation. No skills or profiles were moved, disabled, deleted or activated in this inventory.

## Skills and proposed homes

Paths in proposed homes are relative to Mission Control unless stated otherwise. A source under Mission Control and a discoverable installation in a build worktree are separate concerns.

| Existing definition | Type | Consumers | Proposed home or disposition | Dependencies and migration work |
|---|---|---|---|---|
| [launchpad](/Users/rccurtrightjr./.codex/skills/launchpad/SKILL.md) | Skill; fronting workflow | Main domain session | Launchpad parent: `launchpad/.agents/skills/launchpad/` | Adapt Captures-root/numbering fallback, Second Brain calls and references; preserve existing genre/domain examples. |
| [capture](/Users/rccurtrightjr./.codex/skills/capture/SKILL.md) | Skill; current-conversation synthesis | Main session; explicitly scoped side contribution | Shared MC procedures: `.agents/skills/capture/` | Replace Second Brain promotion/validation dependencies with explicit maintained rules/helpers; preserve explicit-only invocation. |
| [checkpoint](/Users/rccurtrightjr./.codex/skills/checkpoint/SKILL.md) | Skill; registered-main history reader | Authorized checkpointing session, usually a side chat | Shared MC procedures: `.agents/skills/checkpoint/` | Preserve settled-turn/cursor transaction; resolve external history CLI independently of skill placement. |
| [second-brain](/Users/rccurtrightjr./.codex/skill-backups/2026-09-26-second-brain-retirement/second-brain/SKILL.md) | Legacy v1 skill | Existing legacy callers | Retirement candidate; do not install as the new system’s default | Extract needed rules/helpers and redirect callers before disabling or removing its installation. |
| [roadmap-creator](/Users/rccurtrightjr./.codex/skills/roadmap-creator/SKILL.md) | Skill; planning workflow | Owner-designated creator session | MC-managed planning skill; proposed `.agents/skills/roadmap-creator/` | Check standalone use outside MC; preserve code-standards and owner-authority contracts; First Draft/Preflight changes belong to MC-T05/06. |
| [roadmap-implementation-supervisor](/Users/rccurtrightjr./.codex/skills/roadmap-implementation-supervisor/SKILL.md) | Skill; execution supervisor | Owner-designated supervisor session | MC-managed execution bundle; deployment must reach actual build CWDs | Hard-coded orchestrator/review-gate paths and named spec-orchestrator dependency. Keep per-SPEC owner acceptance. |
| [orchestrator](/Users/rccurtrightjr./.codex/skills/orchestrator/SKILL.md) | Skill; one-SPEC procedure | Direct owner invocation or spec-orchestrator profile | Same execution bundle as supervisor and builders | Hard-coded review-gate path; requires spec-slice-builder and clean-room-reviewer profiles. |
| [spec-review-gate](/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md) | Skill; automated implementation review policy | Supervisor, orchestrator, builder and their reviewers | Same execution bundle; must be reachable from every gate caller | Present on disk; do not assume catalog discovery from file presence. Distinct from clean-room-loop. |
| [delegater](/Users/rccurtrightjr./.codex/skills/delegater/SKILL.md) | Legacy skill alias | Older explicit planning invocation | Compatibility entry only if still needed | Hard-coded roadmap-creator path; retirement or replacement alias must preserve intended standalone use. |
| [clean-room-loop](/Users/rccurtrightjr./.codex/skills/clean-room-loop/SKILL.md) | Skill; ordinary-work independent review | Explicitly invoking primary session | Keep global by default | General utility distinct from automated SPEC review; moving MC does not require retiring it. |
| [fusion-electron-restart](/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md) | Skill; Fusion development restart | Fusion development sessions across checkouts | Keep current global installation in this migration | Depends on target checkout’s restart-fusion.sh and repo instructions; separate from MC memory workflows. |

## Actual agent profiles and standing roles

| Installed profile | Dependencies and disposition |
|---|---|
| [clean-room-reviewer](/Users/rccurtrightjr./.codex/agents/clean-room-reviewer.toml) | Generic read-only independent reviewer; no hard-coded skill path in its profile. Keep global by default while it serves general review as well as SPEC gates. |
| [spec-orchestrator](/Users/rccurtrightjr./.codex/agents/spec-orchestrator.toml) | Reads absolute global orchestrator and spec-review-gate paths; spawns builders/reviewers. Move with its execution dependencies. |
| [spec-slice-builder](/Users/rccurtrightjr./.codex/agents/spec-slice-builder.toml) | Reads absolute global spec-review-gate path; named clean-room-reviewer dependency. Move with its gate. |

All three names are exposed as available custom agent types in this conversation. No profile was spawned or behavior-tested. The inspected user config has `[agents] max_depth = 3` and no named-agent config mappings or skill overrides; the three definitions are standalone TOML files. A skill’s `agents/openai.yaml` describes its interface/invocation behavior; it is not one of these custom execution profiles.

Mission Control and the Launchpad main/side responsibilities currently live in local AGENTS.md files. Roadmap Creator and Roadmap Implementation Supervisor are skills, not additional installed TOML profiles in the inspected directory. Branch Manager, independent Preflight and requirements-definition roles remain TODO deliverables; this inventory does not install placeholders or infer they exist elsewhere.

## Second Brain responsibility replacement

Retire the v1 umbrella while explicitly retaining needed capabilities. Checkpoint alone does not replace the whole v1 workflow.

| V1 responsibility | Current or proposed replacement | Remaining gap |
|---|---|---|
| Main-conversation continuity from recorded history | Existing Checkpoint skill | External reader availability, registration and history-source replacement need validation. |
| Lightweight current-conversation synthesis | Existing Capture skill | Remove its reliance on Second Brain thresholds and helper discovery. |
| Owner-facing shaping and re-entry | Existing Launchpad role and local two-role AGENTS contract | Global Launchpad skill still invokes v1 and uses the Captures root. |
| Decisions/issues/proposals authority and provenance | Local document contract; focused Capture/Checkpoint procedures | Preserve routing thresholds and backlinks when extracting v1 guidance. |
| Folder bootstrap and schema evolution | Template/local contract plus a focused initialization/schema procedure if earned | No standalone replacement initializer was found among inspected personal skills. Do not invent an installed successor. |
| Bounded research and multi-document reconciliation | Explicit support-side assignments; focused procedures as needed | Remaining replacement skills are not yet named or established by the owner; record the gap instead of routing automatically to v1. |
| Index and record validation | Reusable helper extracted from v1 | `second-brain/scripts/validate_index.py` remains the current validator. Proposed maintained home: MC `scripts/validate_index.py`. |
| Structured Capture promotion, routing and backlinks | Focused record-maintenance helper when the schema needs it | `route_capture.py` imports sibling `validate_index`; relocate together and exercise compatible records before retiring originals. |

Using a legacy validation utility temporarily does not adopt Second Brain as the new agent role. The current helper remains readable until its replacement is verified.

## Dependency edges to preserve

- Launchpad calls Second Brain for initialization, promotion and backstage work. Its `references/schema-derivation.md` and `references/operating-procedures.md` also route to v1. `scripts/next_capture.py` implements the old numbered-Capture convention. Updating only SKILL.md would leave stale guidance.
- Capture names Second Brain for substantial work and record thresholds; its validator/backlink instructions depend on helpers housed there. Capture and Checkpoint each set `allow_implicit_invocation: false` in UI metadata; preserve that behavior. Launchpad allows implicit invocation in metadata but requires an explicit start in its body: reconcile with the local main-role contract when migrating, rather than silently changing triggers.
- Checkpoint delegates history access to an external `codex-checkpoint` command or a located `bin/codex-checkpoint.js`. No `codex-checkpoint` command was found on this shell’s PATH. No tools-checkout search or runtime invocation was performed; this is not evidence that the reader is absent from the machine.
- Supervisor and Orchestrator read `~/.codex/skills/...` paths. The spec-orchestrator and spec-slice-builder profiles hard-code `/Users/rccurtrightjr./.codex/skills/...`; Delegater similarly points to the global creator. Rewrite and validate these edges together if their targets move.
- The clean-room-reviewer profile is used by the SPEC chain and suitable for general independent review. Do not remove a shared profile merely because one consumer moves. Preserve the distinction between ordinary clean-room-loop and automated spec-review-gate policies.

## Discovery and deployment boundary

Repository skill discovery follows `.agents/skills` from CWD to repo root. Parent placement can serve multiple domain folders; `launchpad/template/` is not an ancestor of live sibling folders. Same-name skills are not merged, so a staged local copy plus the global definition is not a reliable override. See [official skill documentation](https://learn.chatgpt.com/docs/build-skills).

Custom agent TOML files use personal `~/.codex/agents/` or project `.codex/agents/` installations. Storing a profile as an arbitrary Markdown file or skill does not register it. See [official custom-agent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Observed local discovery surfaces: repository-root `.agents/` and `.codex/` are absent; MC has only its Full Access `.codex/config.toml` and no local skill installation. User `~/.agents/skills` is absent; the inspected personal skills currently reside under `~/.codex/skills`. Preserve the working installation until the destination is verified, rather than treating documentation paths as proof of effective loading.

Build sessions may have a repository-root or separate-worktree CWD outside MC ancestry. Proposed execution sources can be maintained with MC, but their installation must explicitly serve those CWDs, through a suitable project installation or a retained personal installation. The exact execution deployment remains a choice. Do not claim moving everything under MC makes it visible everywhere. Live MC startup remains deferred until the system is fully built.

## Migration sequence and unresolved choices

1. Keep the D-006 legacy classification in the template and remove default v1 dispatch from the new contract. This documentation step is done; installed global callers remain unchanged.
2. Extract shared authority/schema rules and needed helpers, then adapt Launchpad/Capture/Checkpoint together. Preserve supported operations and validate helpers before retiring v1 dependencies. Decide whether the remaining support tasks merit additional named skills only when their contracts are clear.
3. Choose which workflows remain usable outside MC and how execution worktrees receive skills/profiles. Recommended defaults are recorded above; actual standalone usage has not been surveyed across other projects.
4. Stage the selected migration outside discovery paths, rewrite dependency edges, validate files/helpers, and switch installations as one coherent change. Preserve an exact rollback copy outside scanned skill directories. Do not leave same-name global/local copies as an assumed precedence mechanism.
5. Verify discovery for intended domain/main and shared-CWD side contexts and the chosen build CWD. No subagents or live MC run are authorized in this side conversation; record unperformed runtime checks and have them exercised in an appropriate later context. Retire redundant global registrations only with those results and intact rollback data.

Next bounded implementation: extract the v1 rules/helpers needed by the existing local contract and update their consumers. This inventory does not declare the whole MC-T04 workflow complete.

## Source fingerprints

SHA-256 of entrypoints/profile definitions at inspection. Supporting files were inspected where referenced above; fingerprints below are entrypoints only. Re-read current bytes before a migration because other sessions may edit personal skills.

| Source | SHA-256 |
|---|---|
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/capture/SKILL.md) | `ecf6b086faacac20d31c84b61b956161b15ed9f3e68c9cb8a47cd9e18060492f` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/checkpoint/SKILL.md) | `87e8a4e38b9678dcfb08e8011b65faf397c745b2283128abb38c9b97cd967d6a` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/clean-room-loop/SKILL.md) | `a16158bb172c37e19e45430edd46ee92cb8de9f992c8558e04053dfb926b9cf5` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/delegater/SKILL.md) | `9c9e4888c1dca2131a211f8019e908a863c9b0ebd0977308855f8b54b3deb7d2` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/fusion-electron-restart/SKILL.md) | `bf4a3dba3a1f2f5bf41c3d91197adfbd31fa0cb9f60adb67069599fad008e91a` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/launchpad/SKILL.md) | `8c7c3cf9c2115ea2380ac30a57867e7c12510e72bacf9a9ad149e86f63cbf019` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/orchestrator/SKILL.md) | `84e8bee6cf8cc2363330f73df568d6fbf1366fd406a28a58c97688c177d42198` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/roadmap-creator/SKILL.md) | `b73d0a559cab7a77fc89b452c886bcd4737c768e473cf9ef0e23ec129a60687b` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/roadmap-implementation-supervisor/SKILL.md) | `35ee8670a2be6bba061fa389016f4b00e925391f65e5909df4760cfb64a9af0a` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skill-backups/2026-09-26-second-brain-retirement/second-brain/SKILL.md) | `34b51c705edfab51f177891b9460699d60b0a7795320c4e3f430a0ca3c6b5760` |
| [SKILL.md](/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md) | `4332677863d2f80c3079c0d2507ed1e8e60b2b7629df8a8d7f31249c536bb6c0` |
| [clean-room-reviewer.toml](/Users/rccurtrightjr./.codex/agents/clean-room-reviewer.toml) | `3ec16b52c4181728463ef4e1511ccbb2783dc6a9101921c04ba7bba454dd286e` |
| [spec-orchestrator.toml](/Users/rccurtrightjr./.codex/agents/spec-orchestrator.toml) | `53a10cd8b95aeed2250680b8a68e9eb621978e6736b2aab18bbdd58527d1bf0f` |
| [spec-slice-builder.toml](/Users/rccurtrightjr./.codex/agents/spec-slice-builder.toml) | `8a68ab3498aa5ee52d66e3142cc8d0061e3432c702be16485c64d8b0147b7345` |
