# App Federation & The Ticket Boundary

Status: CAPTURE — consolidates the draft SPEC direction + the boundary decision
Captured: 2026-07-13

## The Idea

Any frontend web app can be registered with the Fusion server and interconnected with other repos — with zero privilege leakage — because ownership is the default and every interaction is an explicit, bilaterally built agreement.

Core principle (shared with doc-sharing tokens and SQLite system/user partitioning): **ownership is the default; interaction is an explicit agreement.** Default-deny, capability-gated, nothing automatic.

## Registration

- Any frontend web app registers with the server via a **config file**, sucked up into the server and stored in SQL.
- On registration the user is given a **prompt with toggles** — the capability grant surface. Every grant is visible and user-chosen.
- A registered app can run scripts on its own end to **request reads**, and can **mutate data only inside its own data container**.

## The Boundary (settled)

Two tiers, one hard line between them:

### Read tier — System Mode

- The user can grant read access **in session** by switching to system mode.
- In system mode the AI gets awareness of the rest of the system plus extra tools — **read only**. Effectively: file locks are off for read access, system-wide.
- It can consume a repo, make notes, copy skills/patterns — anything that doesn't mutate outside its own container.

### Write tier — Tickets

If a session wants another repo to **DO** something, it must **file a ticket.** That is the boundary.

- Tickets run on a basic trigger: **new folder/file in `open/`**, then assigned.
- An assigned ticket carries: `automation: <triggername>` plus whatever other variables that trigger expects.
- Tickets can be used to run a trigger — but **only if the receiving repo built a ticket watcher for that tag** and registered it on the server behind the same config-with-toggles prompt.
- If nothing is built and registered on the receiving end for that tag, the request **fails**. Nothing is automatic.

### Why this works

- **Reads are safe to liberalize** because they can't change anything; system mode makes exploration cheap without weakening the write boundary.
- **Writes are requests, not commands.** The receiving repo's watcher decides what "receiving a mutation request" means — queue it as an issue, run logic to detect an agreed trigger tag, act on it, or ignore it. The requester gets exactly what the receiver chose to hand it.
- **Bilateral by construction.** Both ends must build: the requester files tagged tickets; the receiver builds + registers the watcher for that tag. Either side absent → no interaction. No privilege ever flows implicitly.
- Data in one repo is genuinely **owned**, and repos *agree* to interact.
- **Nothing is lost on failure.** A failed ticket isn't a vanished error — it's a file sitting right there. The user can run it manually, fix the trigger config, and re-drop the same ticket to test. The ticket is its own dead-letter queue and its own test fixture: file a ticket → watch it sit → build/fix the watcher → re-run the identical ticket. Worst-case failure mode of the whole system is "a todo item appeared."

## First Implementation — Wiki Maintenance Tickets

Tickets become folders here first; the wiki is the first customer of the ticket system (and the user is its first user — deliberate dogfooding on a corpus that's real, bounded, and forgiving).

**Mechanics:**

1. A **trigger file** generates a wiki ticket from a **template**: instructions + empty markdown files of all the artifact types. The template is the contract — output schema is decided before the loop runs, so sub-agents fill slots instead of inventing shapes, results accumulate cleanly, and the report is mechanically generatable. (SPEC-40's schema-registry instinct applied to agent output.)
2. An **orchestrator spawns sub-agents, one per article**, each squaring its article against the rest — the 8-hour unification pass (see `../013-Convergence_Loops/adversarial-document-convergence.md`) converted into a repeatable, parallel, resumable job. Agents write artifacts into the ticket folder as they go, so an interrupted run keeps everything accumulated so far.
3. The job **just runs and accumulates artifacts**, then generates a **report**; the ticket moves to **closed**.
4. **User reviews what changed and why** — the human gate sits at the merge point, not in the hot path. Same shape as the orchestrator protocol's clean-report gate: autonomous evidence gathering, owner acceptance, artifact trail as proof.

**Other ticket types:** gap-in-knowledge hunts, etc. — each is just another template + trigger tag.

**Strategic role:** one machine, swappable corpus. Everything proven here ports to the consumer second-brain app (`../014-Second_Brain_Chat/second-brain-chat-vision.md`): wiki articles → memory artifacts, contradiction-squaring → background brain, gap-finding ticket → "what does the second brain not know about this user." And building it builds the federation primitive itself — trigger file + template + registered watcher is exactly the boundary mechanism above, so wiki tickets are its first working instance.

## Watch Out For (future design pressure)

The "it's not automatic, it fails" property is the entire strength. Convenience features that auto-register watchers, auto-grant toggles, or add "trusted repo" shortcuts would quietly dissolve the boundary. Any relaxation should itself be an explicit toggle in the registration prompt.

## Relationships

- Same capability/token model as the doc-sharing design, generalized from docs to whole apps: `../001-Captures/machine-sync-sharing-model.md`
- Intra-machine version of the same principle: SQLite system vs user partitions; settings/ AI-write-locks (Enforcement wiki section).
- Ticket mechanics build on the existing TRIGGERS.md fail-open workspace-watcher matcher (one matcher, per provenance master plan — canonical publication observes it, never a second execution path).
- Source material: user's draft SPEC + collection of notes (pre-wiki; wiki does not yet describe this).
