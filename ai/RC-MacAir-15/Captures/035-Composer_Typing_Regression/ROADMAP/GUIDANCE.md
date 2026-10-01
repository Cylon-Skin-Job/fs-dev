# Execution guidance — mandatory dependency of every SPEC

## Authority and baseline

Read `/Users/rccurtrightjr./projects/fs-dev/AGENTS.md`, and `fusion-studio-server/AGENTS.md` for backend work. Read BUNDLE-INDEX, AUTHORITY-AND-DECISIONS, ARCHITECTURE, VALIDATION and the complete selected SPEC. Read the exact routed standards listed by that SPEC under `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards`. Do not substitute another machine's wiki. Current chat entry point: `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md`.

Approved roadmap bytes and explicit owner decisions constrain behavior. SOURCE-BASELINE.json is provenance, not a clean-worktree demand. At each start capture the actual branch/commit/dirty overlap and migration head. Preserve unrelated Office harness, wiki/provenance, runtime state and owner files. Expected changed areas are not rigid allowlists: mechanically necessary integration is part of the slice and must be reported. No implementation starts before candidate approval.

## Every slice packet

Each numbered slice in a SPEC is an executable packet together with that SPEC and the mandatory documents above. A fresh `spec-slice-builder` implements exactly one slice, including mechanically necessary omitted integration, self-reviews, runs its checks, records every deviation and obtains a materially clean builder-owned review before returning `READY_FOR_ORCHESTRATOR_REVIEW`. The builder may spawn only fresh `clean-room-reviewer` agents, never another builder. It repairs forward until the first clean pass without an arbitrary pass ceiling, then stops. A new slice gets a new builder.

The SPEC orchestrator independently inspects current work and uses fresh `clean-room-reviewer` passes; stop after the first clean pass, otherwise route repairs through the owning builder until clean. Material acceptance repairs require the builder, fresh builder-owned review and fresh orchestrator-owned review again. Every descendant inherits the invoking root's model and reasoning effort. No overridden model/effort is authorized by this bundle.

The orchestrator reports all deviations, scope touches and downstream effects. The supervisor presents the completed SPEC to the owner and obtains explicit acceptance before the following SPEC. Direct `$orchestrator` use has the same acceptance boundary. Review CLEAN is not owner acceptance. Genuine new product/authority choices return to the owner with their exact affected contract; routine implementation mechanics are resolved and reported.

## Evidence and deviations

For each slice record changed paths, criterion-to-evidence mapping, exact commands/results, fixture inventory, safe failure evidence, review identities/current bytes, all deviations, downstream impact, skipped checks and residual risk. Distinguish proposal, confirmed defect, baseline failure and implementation choice. Changes to approved normative behavior update affected docs/manifest and require affected review/approval; hashes identify bytes and do not prohibit necessary repairs.

No quick patch counts as architecture completion. Do not create fine-grained filenames whose combined hooks still subscribe the same high-level component to all state. No observer/test-only production bypass, always-success fake transport, second authority store, or provider-specific frontend logic.

## Safety and runtime isolation

Only fresh disposable test profiles/workspaces or explicitly bounded backup-content copies. Never open the live dev/Alpha DB for writes, connect tests to port 3001, remove live Singleton files, replace running logs, or kill by process name. Use timestamped artifacts and owned PID/process-tree cleanup. Real Electron shell authentication remains active. No fake trusted role on a production socket. Fixture harnesses implement the canonical adapter boundary without external model calls and must not bypass production WS routing/persistence.

No commit/amend/push, destructive migration or Alpha operation is authorized. Owner-window restart/diagnostic attachment requires separate authorization; OS sampling/tracing of the owner's window is prohibited by the brief. Isolated fixtures may be profiled. Never download/compile large runtime assets as a test fallback.
