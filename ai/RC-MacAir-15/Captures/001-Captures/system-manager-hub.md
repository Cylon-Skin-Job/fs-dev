# System Manager Hub — Universal System Mode, the Oracle, Asset Depot

**Date:** 2026-07-04
**Status:** Capture from design riff. Builds on `full-permissions-safety-architecture.md` (modes), `discovery-gated-ceilings.md` (READMEs), `view-onboarding-front-pages.md` (onboarding pages), `opencode-harness-integration.md` (vendoring).

## Workspace-Scoped Mode Configs

The mode dropdown is data-driven and **varies by workspace type**: code workspaces get one config, System Manager gets another. Mode configs ship inside the workspace-type JSON templates (the same files that load a new workspace's defaults) — so a workspace's permission personality is part of its template, not code.

## Universal System Mode

Every workspace's dropdown gains a **System Mode**: the agent gets read access to the System Manager's full file/folder tree, with a standing instruction of the shape *"go ingest the System Manager Wiki Guide; you have read access to all of it."*

What a workspace agent in System Mode can do by navigating System Manager's knowledge hierarchy:

- Install and configure web scrapers; api2cli
- Fire a Zapier webhook; drop n8n into a custom-viewer
- Convert PDFs or audio notes into docs — and schedule it with a cron via TRIGGERS.md
- Peruse every templated agent, with prompts and workflows

**Cross-repo movement, de-fretted:** the earlier worry was System Manager needing bespoke code to move files across repos. Resolution: abstract it to a JSON config. Data-driven cross-repo rules are no big deal; System Manager simply ships with them enabled. No special cases in code — special cases in data.

(Read-path plumbing mostly exists: `wiki-tree.js` already scans multiple workspace roots including System_Manager; SPEC-31's path policy already follows workspace symlinks pointing outside the workspace for reads.)

## System Manager's Content Identity

**It does not explain the codebase.** It is tons and tons about everything *else* you might want to do: webhooks that autofire, tweaking the harness hooks, how CONFIGs work, operational how-to. The codebase wiki lives with the code; System Manager is the operations-and-capabilities encyclopedia.

**READMEs everywhere, canonical home here:** the discovery-gated-ceilings mechanism goes cross-repo — READMEs scattered through system folders are symlinks whose canonical articles live in System Manager's wiki. (SPEC-31 explicitly allows workspace symlinks with out-of-workspace targets; this is that case, load-bearing.)

## The Asset Depot

System Manager stores:

- Every imaginable **background agent folder** (templated agents + prompts + workflows)
- **Templates for all views** and **workspace-type JSON files** (right defaults on load — including the mode configs above)
- **Vendored tools** — e.g. grab the best-maintained full-suite web scraper on GitHub with an open license, clone it, modify for easy hooks into our system

**Deferred-install pattern:** a placeholder folder the server pulls from, plus a README that is an *executable instruction*: "go here, download this code into this folder, and decide these 3 issues." Ship the socket and the instructions, not the vendored bytes. The installing agent (in System Mode) completes it on demand. Lighter-weight sibling of the full clone/sweep/wiki/changelog-gate treatment reserved for shipped dependencies like OpenCode.

## System Manager's Own Modes

| Mode | Scope |
|---|---|
| **Read** | Look, don't touch |
| **Agent (Ask)** | Normal assisted work inside System Manager |
| **Oracle** | Reads ALL other repos; recurses on its own mega-wiki frequently; offers tools and suggestions to improve other workspaces |

**The Oracle** is a new agent class: its domain is the system itself. Because System Manager is not a code workspace, the prompt can be liberal — a rich, explicit system-level view and role, without the code-editing constraints.

Safety shape worth stating: **the Oracle proposes; workspace agents dispose.** Read-everywhere, but improvements flow outward as suggestions/tools/tickets — it does not edit other workspaces directly. Its write surface is System Manager itself (its wiki, its templates, its depot). That containment is what makes read-everything acceptable.

Natural Oracle habits once its inputs exist: consume code-audit-sidecar sweep reports across workspaces; watch ledgers for cross-workspace patterns; keep its own wiki fresh via the audit loop ("recurses back on its own mega wiki frequently" — the audit as a standing behavior, not an event).

## Open Threads

>> System Mode read grant mechanics: mounted read-only path? Same-server multi-root (exists) vs cross-machine later?
>> Cross-repo JSON config schema: who can declare what moves where; does the ledger record cross-repo moves with both paths?
>> Oracle cadence: scheduled (cron trigger) vs Workflow-Loop resident? What wakes it?
>> Oracle suggestion delivery: tickets into target workspaces' inbox? A digest page? Both?
>> Deferred-install READMEs: standard frontmatter so an agent can execute them deterministically ("decide these 3 issues" as structured decision points)?
>> Does System Mode inject the System Manager Wiki Guide front page on entry (view-onboarding pattern applied to a *mode*)?
