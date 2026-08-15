# Full-Permissions Safety Architecture — Modes, Snapshots, Ledger Forensics

**Date:** 2026-07-04
**Status:** Capture from design riff. The considered answer to a fair challenge: "you want to run CLIs in full-permissions mode with no blocks?" Yes — because enforcement moves to our side, where it can be granular, explainable, and reversible. Companions: `file-mutation-injection.md`, `opencode-harness-integration.md`.

> **Provenance correction (2026-07-15):** The safety intent remains useful, but the flat attribution and `event-ledger.js` foundation claims below are superseded by the [current provenance planning set](../008-Provenance-Temp/00-provenance-spec-set-map.md). File changes are canonical resource mutations linked to accepted UI/tool/harness/automation evidence when available; otherwise attribution remains unknown. This correction follows the [cross-article findings](../008-Provenance-Temp/provenance-schema-findings.md) and owner direction in chat; decision-tagged schema branches remain open.

## The Argument (three pillars, one defense)

Run the underlying CLI harnesses in full-permissions mode — no native popups. Then:

1. **Modes** scope what the AI may touch (blast radius control, per chat).
2. **Snapshots** make every AI mutation reversible (before/after on every write).
3. **The ledger** makes every mutation explainable (file → tool call → chat → conversation context).

Full-auto is only acceptable because pillars 2 and 3 exist. The UI never asks "allow?" out of context — destructive/permanent operations are a top-tier class that pops OUR modal/overlay, and the assistant itself can explain any permission category in conversation (categories carry a permission-documentation convention such as `name`, `description`, and `when`; this is not a universal event/provenance block, which still requires the shared envelope plus registered extensions).

## The Mode Selector (top of chat)

| Mode | Scope |
|---|---|
| **Read Only** | No writes at all |
| **Capture Docs / Office Coworker** | AI works only inside the ai/ workspace folder; can't touch the main repo |
| **Agent (Ask)** | Full capability, destructive-tier actions prompt |
| **Accept All** | Full capability, no prompts (snapshots + ledger are the net) |
| **Workflow Loop** | Accept All + autonomous re-prompting (see below) |

Modes are the UI; **compilation targets differ per harness** (established in `opencode-harness-integration.md`): Kimi is wire-native, so the server enforces inline; OpenCode executes its own tools, so a mode compiles to a generated permission config + dispatcher gate policies. One mode vocabulary, per-harness backends — same shape as canonical intent → adapter translation everywhere else in the app.

**Folder-scoped modes must resolve realpath** (Office Coworker especially) or a symlink escapes the sandbox — same hole, same fix as SPEC-31c.

## Scoping & Deliberate Elevation Friction

- The app holds full disk access, but AI access is mode-gated: full disk is available **only in Agent (Ask)** by default.
- Enabling disk-wide reach in higher modes requires **editing the config** — no toggle. Rationale: if you want full auto, you must be able to read JSON or direct your AI to. Config literacy is the competence gate.
- **Two-tier surface, by design:** the UI's job is to offer a safe blast radius — every mode reachable by clicking is survivable. The JSON config is full-on YOLO mode, and it is deliberately **not advertised in the UI** — no "advanced" button pointing at it, no unlock flow. You have to be smart enough to discover it. Discovery *is* the gate: warning dialogs train people to click through, while an unadvertised ceiling selects for users who can handle what they find. The UI ceiling and the config ceiling are different on purpose, and closing that gap would be a design regression, not a UX improvement. This two-tier shape generalizes (CSS/themes are the second instance) — pattern + point-of-discovery README doctrine captured in `discovery-gated-ceilings.md`.
- UI affordances for the sane middle: add a specific folder outside the repo and grant it autonomous access; or place system-wide abilities under Accept All **only in Fusion Home's chat** — a docs/office context, not a coding context; acceptable risk because it's folder-scoped and no repo is in reach.
- Default posture: keep the AI inside its own repo/workspace.

## Snapshot + Versioning Scheme

- **AI mutation:** snapshot before AND after, every time. For self-executing CLIs the capture points are the dispatcher's `tool.execute.before`/`after` routes (a snapshot route joins the kit in `opencode-harness-integration.md`); for wire-native harnesses the server does it inline.
- **User typing:** snapshot on pause intervals (no per-keystroke noise).
- **Storage:** SQLite table per the system-partition doctrine (GUI/system writes only), FIFO.
- **Retention:**
  - Last **30** versions per file — the undo/redo working set.
  - **Checkpoint every 20 versions:** the designated checkpoint survives falling out of the 30-window; when a new checkpoint is designated, the prior one retires. (Exact rotation mechanics need pinning at spec time — see Open Threads.)
  - Beyond **48 hours:** collapse to latest-per-day, delete the rest.
- **Ledger rows for culled versions are culled on the same schedule** — the ledger doesn't outgrow the versions it points at.

This is the same tiered-retention doctrine as the wiki's `.archive/` (wiki-audit Decision 20: recent-unconditional → latest-per-day → prune). Two consumers of one policy now exist → per our own standards, the retention logic should be **one shared implementation** with tunable constants, not two parallel schemes that drift.

## The Universal Ledger Entry

Every file change: **resource identity · type of change · evidence-backed provenance**. Link to an accepted UI action, tool/harness event, automation run, or other registered cause only when proof exists; watcher-only observations remain external/unknown rather than defaulting to "user save." The current provenance SPEC set, not the older `event-ledger.js`/`file:changed` path, owns the implementation foundation.

## AI-Queryable Mutation Forensics

The payoff capability: the AI can answer "why did this file change?"

1. Query AI-initiated mutations by file name; narrow by date range, down to hour/minute/second.
2. Follow the linkage to the chat pair that made the change; grab the prior ~6 exchanges for context.
3. For deep dives: assign sub-agents to ~20k-token chunks of the full thread, each returns a summary/report.

Recall from the ledger, precision from the model — the code-audit-sidecar inversion again, pointed at history instead of code.

## Workflow Loop Mode

Autonomous orchestration mode. Wake sources, in priority order:

1. **Self-timer** — the agent sets its own wake ("check back in 20 minutes").
2. **Ticket completion** — agent subscribes to a ticket; its completion wakes the orchestrator (UEB ticket events exist).
3. **Manual countdown fallback** — the app re-prompts every N minutes after turn end if nothing else fired. The loop cannot silently die.

Target workload: run a 7–8 slice SPEC end to end — assign slices as tickets, sub-agents test/validate/review and report back; orchestrator agrees and proceeds, reruns the loop with guidance derived from the last failure, or issues a fix ticket. This is the EGE loop with the human checkpoint replaced by validated sub-agent evidence plus ticket-gated progression — which is exactly why it's a *mode*: you opt into it knowingly, inside the scoping rules above.

## Open Threads

>> Pin the checkpoint rotation mechanics precisely: is there exactly one surviving checkpoint beyond the 30-window at a time, or a chain of every-20th until the 48h collapse? Worked example needed at spec time.
>> Full config schema enumeration: everything a user could want to block — needs its own pass; each entry gets name/description/when so the assistant can explain it.
>> Destructive-tier taxonomy: what exactly is "destructive or permanent"? (Deletes, moves out of workspace, git force ops, schema migrations, external sends?)
>> Snapshot storage: content or diffs? Large-file policy? Binary files?
>> Undo/redo UX: per-file table view ("give them each a table") — where does it live in the UI?
>> Mode → OpenCode permission-config compilation: generated `opencode.json` per mode, or one config + dispatcher-enforced overlays?
>> Workflow Loop guardrails: max loop iterations? budget? who watches the watcher?
