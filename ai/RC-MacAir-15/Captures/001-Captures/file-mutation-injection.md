# File-Mutation Injection — Between-Turn Context Deltas

**Date:** 2026-07-04
**Status:** Design capture from riff; observed working in Claude Code, mapped onto our architecture. Not yet spec'd.

> **Provenance correction (2026-07-15):** Treat the event names and flat `actorType` claims below as historical inputs, not current architecture. Canonical mutation work is planned through registered `resource.*` events and the shared provenance envelope; accepted origin/cause/native-reference evidence supplies attribution when available. The exact automation subtype and resource-sidecar contracts remain open in the [cross-article findings](../008-Provenance-Temp/provenance-schema-findings.md). This note records those findings and owner direction in chat without settling decision-tagged branches.

## The Idea

When files change between agent turns, the harness injects a notice into the next outgoing prompt — an XML envelope, same mechanism as attachments — so the agent knows the world moved while it wasn't looking:

> "N files have mutated since last turn: [inline diff | use subagent {{name}} to retrieve details]"

Observed prior art: Claude Code does exactly this. Between turns it attached a system-reminder containing (a) which file changed, (b) the changed region inline with line numbers, and (c) intent framing ("this change was intentional, don't revert it"). Not git-based — harness-side file state tracking, the same bookkeeping it already keeps for read-before-edit enforcement.

## The Core Principle: Relevance Scoping

This is **not** a workspace-wide mutation feed. It is a **cache-invalidation notice for the model's context**. The only files worth announcing are files whose stale contents the agent is currently carrying — files it read or edited this session. A workspace-wide "N files changed" is noise; the intersection is signal.

## Architecture Mapping (captured proposal; canonical migration is still planned)

| Piece | Owner | Status |
|---|---|---|
| Working set (files the agent read/edited this thread) | Server sees every tool call on the wire — accumulate per-thread | New, small |
| Mutation source | Chokidar observation projected into a registered canonical `resource.*` event; any `file:changed` path is legacy compatibility | Planned in the provenance SPEC set |
| Actor attribution | Shared provenance origin/cause plus accepted native/tool/automation references when available; never a flat `actorType` shortcut | Planned; decision-tagged details remain open |
| Injection point | Prompt-assembly path where attachments are prepended | Exists |

Flow: subscriber accumulates accepted canonical resource-mutation facts between turns, keyed by thread → on next user prompt, intersect(working set, accumulated mutations) → non-empty → prepend the XML envelope → clear the accumulator.

## Design Rules

1. **Turn-boundary only.** Deliver at the next user prompt, never mid-turn. Mutations during a turn queue for the next one.
2. **Inline small, delegate large.** A handful of changed lines goes in the tag itself (the agent can act without spending a tool call). Large changesets get the count + "use subagent {{name}} to retrieve relevant details" pointer. Threshold TBD.
3. **Carry intent, not just data.** The most valuable field is not the diff — it's whose change it is (user / linter / another agent / migration) and that it is authoritative. Without it, an agent seeing an unexpected diff in a file it recently wrote pattern-matches to "corruption" and helpfully reverts it — the auto-revert failure mode. Derive attribution only from the approved provenance contract and accepted evidence; unknown watcher observations stay unknown.
4. **Exclude proven self-mutations.** The chokidar echo of an agent's own writes must not be reported back as foreign change, but exclusion requires accepted cause/tool/automation evidence. Mere path/time proximity is not proof.
5. **Realpath-normalize both sides of the intersection.** With app-wide symlinks (SPEC-31), a file read via a linked path and mutated via its real path would fail a string-compare intersection. Identity = realpath, consistent with Decision 12. The shared classify helper exposes `realPath` for exactly this kind of consumer.
6. **One envelope, extensible payloads.** Design the tag as a general "between-turn world deltas" surface, with file mutations as the first payload type. Claude Code uses the same channel for date changes; server restarts and workspace switches are natural future payloads.

## Read-Before-Edit Enforcement (the twin mechanism)

The same per-thread file-state ledger powers a second, *active* protection. Mutation injection is the passive half (inform the model its context is stale); read-before-edit is the enforcement half (refuse the consequences if it doesn't listen):

1. **No edit without a read.** An edit/write to a file with no read recorded this session is rejected with an instructive error ("read the file first").
2. **No stale writes.** An edit to a file whose content hash changed since the agent's last read is rejected ("file changed since you read it — re-read before editing").

Rule 2 is what makes the injection design *safe* rather than advisory: even if the model ignores (or never received) the mutation notice, the gate catches the stale write before it clobbers someone else's change. Same ledger, two consumers: notice at turn start, gate at write time. Hash comparison, not mtime (editors and sync tools touch mtimes).

## Enforcement Surface — wire vs CLI hooks (verified against OpenCode docs 2026-07-04)

The wire cannot gate self-executing CLIs. OpenCode executes its own tools; by the time `file:changed` or a tool event reaches our server, the edit already happened. The wire is the **informational/audit layer** there. Kimi is the exception: wire-native, server in the execution path — `checkSettingsBounce`-style inline enforcement stays valid for it.

| Harness | Execution path | Enforcement point |
|---|---|---|
| Kimi (wire-native) | Through our server | Server-side, inline (exists: settings bounce) |
| OpenCode | CLI executes independently | **CLI's own hook system** — bespoke drop-in plugins |
| Claude Code | CLI executes independently | Its hooks system (PreToolUse) — same shape, later adapter |

**OpenCode hook API facts (from opencode.ai/docs/plugins):** plugins are JS modules in `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global), npm-loadable via `opencode.json`. Exactly three hooks can block/modify; everything else (file events, permission events, session events) is observe-only:

- `tool.execute.before` — **throw to block, or modify the call** ← the enforcement point
- `shell.env` — mutate env vars
- `experimental.session.compacting` — inject/replace compaction context

**Native features — do NOT duplicate (from opencode.ai/docs/permissions):** per-tool permission config with path patterns (`*`, `?`, `~`), values allow/ask/deny, last-match-wins, deny survives `--auto`. The *basic* settings write-lock is a config entry, not a hook: `"edit": { "**/settings/**": "deny" }` (their `edit` permission covers edit/write/patch).

**Gaps the bespoke hook kit fills** (the ready-made drop-in set):

1. **read-before-edit + stale-write gate** — `tool.execute.after` on reads populates the session ledger; `tool.execute.before` on edits enforces rules 1–2 above. Docs mention no native read-before-edit; verify empirically before building (don't duplicate work).
2. **Realpath-hardened write-lock** — native permission globs almost certainly match the *logical* tool-input path, so a symlink into settings/ bypasses them — the identical hole as `checkSettingsBounce` pre-SPEC-31c. Hook resolves deepest-existing-ancestor realpath and re-tests the locked patterns. Port of SPEC-31c logic.
3. **Working-set reporter** — `tool.execute.after` (+ `file.edited` event) streams read/edit facts back to the Open Robin server (plugin context provides an SDK `client` and Bun `$`; an HTTP POST to our server works). This feeds the server-side working set for mutation injection AND gives the ledger true actor attribution ("this write = OpenCode session X"), which powers the self-mutation exclusion (Design Rule 4).

Division of labor: **hooks = enforcement + telemetry (CLI-side); server = prompt injection (it assembles prompts anyway) + audit ledger.** The injection needs no CLI cooperation; the enforcement needs no server round-trip.

## Open Threads

>> Which module owns working-set tracking — chat-metadata collector pattern fits (it already tracks per-turn file mentions and mutations)?
>> XML payload shape: per-file entries with path, actor, change kind, optional inline diff?
>> Inline-vs-subagent threshold: line count? file count? both?
>> Does the working set expire (context compaction means old reads may no longer be in the model's context) or persist for thread lifetime?
>> Interaction with the file-mutations chat-metadata collector — same UEB subscription, different consumers; share the subscriber or keep two?
>> Verify empirically: does OpenCode's edit tool already enforce read-before-edit internally? (Docs silent.)
>> Verify: does OpenCode's permission matching resolve symlinks/realpath before glob testing? (Assume no; confirm before shipping hook 2.)
>> Hook kit distribution: ANSWERED — the three hooks become the first routes of the all-hooks dispatcher; see `opencode-harness-integration.md`.
>> Claude Code adapter: same three protections via its PreToolUse/PostToolUse hooks — one enforcement philosophy, per-CLI adapters (EGE cross-CLI vision).
