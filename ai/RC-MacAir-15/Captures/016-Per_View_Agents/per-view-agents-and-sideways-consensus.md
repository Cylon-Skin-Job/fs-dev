# Per-View Agents & Sideways Consensus

Status: CAPTURE — design conversation output
Captured: 2026-07-13

> **Provenance correction (2026-07-15):** A file change is a canonical resource mutation and may be linked to an originating tool call only through accepted evidence; it is not itself stored "as a tool call." The exact shared-resource versus domain-sidecar contract remains an owner decision in the [cross-article findings](../008-Provenance-Temp/provenance-schema-findings.md). This correction follows that file and owner direction in chat.

## The Idea

Every view gets a specialized AI: when you're in the Wiki panel, there's a wiki agent with certain information, a certain protocol, view-scoped skills and awareness, and a sense that it looks at its own history. The wiki agent is the first and template case.

This snaps onto rails already laid: SPEC-34's adapter architecture is *per-view* (Wiki adapter, File Viewer adapter, each with named selectors and domain mappings). A view agent is the conversational face of that same boundary — its protocol is the view's adapter contract plus its slice of the domain; its skills are view-scoped routines (injected, per the second-brain model, keyed by which panel is open).

## Article as Context Object

Wiki articles are versioned **within folders shared with the primary articles** — versions, review reports, and sweep results live in a subfolder of the article itself. The article carries its own provenance: a thing + its history + its evidence in one visible folder. Same anatomy as tickets and captures — one more corpus absorbed by the same pattern. The agent needs no bolted-on memory system; the article folder IS its memory.

## The Verification Ladder

The wiki agent takes a request ("something's off, change this part, add something") and then immediately runs processes to catch its own mistakes:

1. **Synchronous self-review** — edit lands; agent runs its mistake-catchers at once: clean-room-loop pass, edge check. Cheap, instant, catches the obvious.
2. **The compelled report** — a durable artifact in the article's subfolder recording what changed and what was checked. Not optional; ticket workers leave one when completing a wiki ticket, and **the wiki editor himself is compelled to do the same.** The agent operates under the same protocol as everyone else (Enforcement principle: constrain the AI mechanically, never the user).
3. **The background sweep ticket** — filed automatically, runs off asynchronously, does the expensive thoroughness the hot path shouldn't wait for.

**Fail-open contract:** reports and sweeps chase the edit; they never gate it. A failed sweep is a ticket sitting visibly in `open/` — nothing lost, nothing blocked. Verification in the hot path is the exact mistake the event system exists to avoid.

## Sideways Consensus

Consensus mode (`../015-Consensus_Mode/consensus-mode.md`) is two AIs converging on an artifact in **space**, side by side. This is the same convergence laid out in **time**: editor now, self-review seconds later, sweep hours later — each leaving artifacts in the same folder, agreement accumulating instead of negotiating. Same fixpoint idea, different axis. It is also the orchestrator protocol miniaturized: worker self-review → independent inspection → clean-room gate, transplanted from SPEC slices into wiki edits.

## Enforcement Mechanism — Tool-Result Kickback

The wiki path is defined in a config inside the wiki viewer, so the hierarchy is known and writes into it are detectable. Enforcement is **protocol injection through the tool call result**: the write succeeds, and the result comes back carrying the reminder — *you just edited an article; the report belongs in its subfolder; the sweep ticket gets filed.*

Why this is the right mechanism:

- **Fires at the moment of relevance.** Front-loaded instructions decay over a session; a reminder riding the tool result is unmissable and arrives exactly when the obligation is created. Same reason routine-injection beats load-at-start skills.
- **Derived, not configured per-agent.** Territory comes from the view config that already exists; the protocol comes with the territory. Any agent (view agent, generalist, Codex worker) gets the same kickback — the system owns the protocol, not the agent's prompt.
- **Fail-open by construction.** The edit already succeeded; the reminder rides the result.

**Generalization — the actual spec:** each view's config declares its territory and its protocol; the server enforces the protocol via tool-result kickbacks on writes into that territory. Wiki: report + sweep ticket. Office: "thumbnail regeneration queued." Settings: hard refusal. One middleware, per-view rules, declared in config alongside the paths they govern.

## Metadata Through the UEB — The Query Surface

Wikis and trigger files have domain metadata. Any canonical metadata projection must use the shared envelope plus a registered domain extension; this capture does not define a universal `name`/`description`/`when` block.

- A wiki page can declare a **source file** (`source-files:` frontmatter already exists) → a ticket is filed when the source file changes.
- The file change is saved as a canonical resource mutation with its own registered type; when an accepted tool-call reference exists, the resource event links to it without collapsing the two records.
- Query recorded wiki edits by time range and compare them with the filesystem. Ledger storage is fail-open and may contain explicit gaps when admission or persistence fails, so the database is audit evidence rather than a complete mirror of filesystem truth.

This is SPEC-35's indexes (event family/type, timestamp range) doing what they were designed for — the provenance system's query surface consumed by view agents.

## Relationships

- Consensus mode (spatial version): `../015-Consensus_Mode/consensus-mode.md`
- Ticket boundary + wiki maintenance tickets: `../012-App_Federation/app-federation-and-ticket-boundary.md`
- Convergence method: `../013-Convergence_Loops/adversarial-document-convergence.md`
- Provenance master plan (SPEC-34 adapters, SPEC-35 indexes, SPEC-40 validation): `../008-Provenance-Temp/01-provenance-implementation-master-plan.md`
