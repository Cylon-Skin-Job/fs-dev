# CAPTURE — System Manager: How the Whole System Works

**Date:** 2026-07-15
**Source:** Live session riff — wiki-script architecture discussion that widened into the full system model
**Status:** Vision capture. Complements `system-manager-oracle-and-pattern-library.md` (2026-07-13) in this section — that tile covers the oracle/pattern-library identity and the extraction question; this one covers the distribution, composability, and trust model.

## The Ship List

A new install ships five workspaces:

- Fusion Home
- Solobooks
- Media Studio
- Code Assistant
- **System Manager**

System Manager is currently symlinked and listed as a separate workspace. It is a workspace with an ai folder and its own "repo," but it is literally just capability: scripts, tools, hundreds of approved safe skills, prebuilt triggers (e.g. an email filter script with a regex folder — add new filters, user approves), the wiki script, the ticket script and ticket templates, background agents and scripts for web scraping, polling open-science sites, OCR, RAG, entity extraction and metadata enrichment, and the RLM harness. The System Manager wiki makes any AI that reads it a literal system oracle.

## Server vs Workspace — Who Owns What

The server is a **harness**: rendering, event bus, trigger gating, the apps tier. It is not the home of domain tooling. Everything an assistant does with files lives as workspace files — readable, forkable, wikified. The wiki script currently in `fusion-studio-server/scripts/wiki.js` is in a temporary home; its destination is a System Manager tool folder.

**Apps sit above workspaces:** Email, Calendar, Bookkeeping run on the "server" side as apps, and a config says which workspace agents can touch or even read each one. Cross-repo read/copy is otherwise open — "any cross this-or-that sync is moot; we can do what we want."

**SQLite partitions:** system partition is read-only to AI. Scripts and automations are gated by the UI on the trigger side and the API side — so users can connect any script to run for any reason. The gate is *execution*, user-owned; it is not script location. A set of markdown files entirely exposed to AI editing cannot coherently forbid the AI from changing how automated functions mutate those same files on its behalf.

## Self-Evolving Harness Per Repo

The goal is a self-evolving harness system per repo. If the wiki tool needs an update for one assistant's use case, that workspace's copy gets it. Same for the ticketing script — if the user and AI have more creative ideas than the original design, let them.

Copy-vs-sync is not scaffold-time policy; it's a runtime choice made by scripts. System Manager has its own resident assistant: "Want me to run a script and pull in system-wide improvements, then run a loop looking for cross-repo pollination opportunities?" Or assign a background agent in System Manager to run on a cron and generate a report. The system doesn't need this stuff built bespoke — it is **composable**. Once the provenance work is done, any script that crosses repo boundaries runs as a trigger with UI permissions.

## Tickets As Distribution

Scaffolding ships as tickets, not docs. AI wants to add an RSS viewer → run the script → here's your rss-viewer folder with config and blank state.json → create a folder, point it there, start setting up feed configs → and copy over a ticket that has the setup checklist on it. Onboarding artifact and work tracking are the same object.

New workspace creation: tickets land for "define workspace purpose" and "copy tools and wikis from System Manager," add views, begin constructing the custom part of the wiki — all pulled from System Manager folders, so you always know where to go to add more abilities.

## The Wikification Pipeline (The Product)

Take the intersection of untapped AI-assistant usage and open-source products that negate SaaS. For each (2–3 dozen low-hanging fruit): pull the repo, wikify and document it, build a few scripts and tools, add a folder with markdown to System Manager. Presto — anybody can have it and use it, no techy required. This is why the Office and Productivity Suite exists: to own the private stack.

**README promotion mechanic:** a tool's README symlinks into a workspace wiki as a sub-article ("Note: This article is a symlink of README located at ..."), with names/frontmatter descriptions of the docs subfolder as sub-articles. Worked example: Media Studio > Tools > ComfyUI symlink to README, presenting as the article "Running ComfyUI Within Fusion Studio" with a References and Documentation section listing the doc subfolder. When the user actually sets the tool up, the README **promotes** from sub-article to its own main wiki page and its doc folder contents become sub-articles — everything the assistant needs to be helpful (e.g. editing ComfyUI JSON, why VLMs suit the task, compatible providers, instructions to web-search and check product cards).

## The Composability Fabric

- All system events flow through the universal event bus and create infinite triggers that filter through JS or regex before firing — this is where user gates apply.
- Webhooks in and out.
- Iframe views run n8n or ComfyUI inside Fusion; system triggers fire their workflows — use their stack for what it's good at.
- Web browser is MVP'd; it will be wired through the UEB and gated. No API needed: open a site, log in with saved credentials *invisible to the agent*, scope its access in the UI, record results to a folder that is linked to a trigger, which runs a script over email/calendar/whatever, hands the result to n8n, passes that to ComfyUI, outputs to a folder symlinked to iCloud, and tells you via Telegram it's done.
- Planned oracle tool calls: screenshot the user's desktop or draw ASCII diagrams of buttons and the functions they run; poll the last 30 navigation events or button clicks; read thread history; if context is too big, query the RLM harness.

## The Trust Model — Recoverability, Not Restriction

- **Scripted deletes** → 30-day cache (copy on SQLite), user-emptied via UI; opt-out, on by default.
- **Scripted writes/mutations** → versioned per event.
- **User typing** → checkpoints, versioned at session grain.

"AI deleted my repo" doesn't work when there's copy-on-SQLite for 30 days. Versioned mutations mean people who don't grasp git are never screwed. Recovery's partner is **detection**: the wiki audit loop (zone hashes, drift classification, clean-context sub-agents over grounded truth) is what turns "we can restore anything" into "we notice what needs restoring."

## Tickets Become Folders — The Staging Area

Tickets are moving from markdown files to folders. A ticket folder holds a pre-run write-up, its suggested edits (before/after markdown), and evidence — and loops can run across several markdown files inside the ticket, then **pause and wait**. Nothing live is touched. The user jumps into tickets, their fronting AI presents issues or approved final text, and they hit **update** (apply the staged edits — themselves versioned per event) or **run** (kick another loop iteration; arbitration feedback becomes the next loop's input inside the same folder).

- This is a PR for people who don't grasp git: propose-freely / apply-on-approval. Background agents get full autonomy because the mutation boundary moved to the approval click.
- Composes with event-driven staleness tickets (wiki-audit-decisions Decision 22): the drift ticket arrives with the article edit already drafted and loop-checked — a button, not homework.
- Why folders, not fat markdown: staged edits are multiple files, loops need intermediate output space, evidence is links + artifacts. Same reasoning as folder-per-article in the wiki.

## The Audit Loop — Self-Audit Against Grounded Truth

The provenance wiki was built by a loop that ran for hours: clean-context sub-agents scan across articles for contradictions, overlap that could centralize, and deviations/bloat; the main AI autonomously fixes issues using the SPEC + half-finished plan files + the main article; the loop reruns until the schema coheres across all domains, then SPEC work resumes.

- **ISSUES.md convention:** when a roadmap-builder agent hits contradictions between the wiki and the plan, it appends to ISSUES.md; the follow-up Q&A surfaces those for the user's call.
- **Grounded-truth context folder:** the files that fed the SPEC work — Captures, Decisions, Vision, Issues — plus conversation transcripts. Sub-agents run across transcripts hunting: errors, contradictions between what the user said and the files, the user contradicting himself, unlisted issues, decisions listed by assumption but never fleshed out in conversation. Triggers + background updaters **will drift** unless they have access to this grounded truth.
- **Post-merge wiki update:** the same context folder drives updating the wiki after merging a big build. When the lead AI says "Done," sub-agents check the transcripts, breadcrumb files, SPECs, the orchestrator's notes on each step, and the actual finished diffs — then submit a finished list of before/after edits. Wiki articles are versioned, so the edits are reviewable and revertible.
- **Mistake provenance:** encounter a mistake → see who penned it → read their thread history even if autonomous → see what they saw → fix the prompt or add another check loop. Errors improve the prompts, not just the pages.
- Cross-article contradictions are invisible from any single article — detection requires the core page plus multiple legs in one clean context (proven by the 2026-07-15 manual pass; findings at `../008-Provenance-Temp/provenance-schema-findings.md`).

## The Thesis

AI just needs **context** (the oracle wiki + RLM), **tools** (System Manager), and **a way to self-audit** (the audit loop). Humans are doing way too much legwork re-explaining things. Someday this whole capture will live in the System Wiki.

## Relationships

- Oracle identity, zero-capability read tier, extraction question: `system-manager-oracle-and-pattern-library.md` (this folder)
- Wiki script build state + audit system decisions: `../001-Captures/wiki-audit-decisions.md`
- Audit-loop process + grounded-truth context folder: `../008-Provenance-Temp/provenance-schema-findings.md` (process note)
- Provenance SPEC set (the enabling layer for cross-repo triggers): `../008-Provenance-Temp/`
