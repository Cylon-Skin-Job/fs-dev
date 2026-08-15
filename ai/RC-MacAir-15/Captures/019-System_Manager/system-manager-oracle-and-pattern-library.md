# System Manager — Zero-Capability Oracle & Pattern Library

Status: CAPTURE — design conversation output; extraction from fs-dev under consideration
Captured: 2026-07-13

## What It Is

A repo/folder holding: all templates, all possible agents you could ever want to build, every permutation of a script that can be plugged right in — with three different scripts per pattern already providing a feasible example. You can see how the APIs are called, how the data is manipulated, and you have the documentation of the API formats.

Two well-known artifacts fused:

1. **A pattern library in executable form.** Three working permutations per pattern is few-shot learning infrastructure: an AI that can copy a working specimen doesn't hallucinate API usage. It's not documentation of the system — it's *specimens*, which is what agents actually learn from in context.
2. **A zero-capability oracle.** The System Manager agent gets **no web tools, executes no triggers, has no tickets.** It can't do anything — which is precisely why it can safely be given awareness of everything. Safety by omission beats safety by enforcement: there is nothing to enforce against an agent holding no capabilities. It's the read tier of the capability boundary embodied as a product: the librarian who knows where everything is and can't touch any of it.

Its one output is **plans**: help you find whatever you want, construct a custom workspace, add all the goodies — which the user's own capable AI then executes under the normal rules. Your own AI can be put into system mode from that repo, consume the wiki top page, and find its way around.

## The Confusion Problem

System Manager's files confuse AI inside fs-dev: exemplars sitting in a live codebase are indistinguishable from reality. Three working permutations look like three live scripts; template agents look like deployed agents. An AI greps, finds a plausible API call, and reasons from a museum exhibit as if it were the running machine. Not an AI defect — an **unlabeled territory**.

### Two Fixes

1. **Kickback labeling (016 pattern):** declare System Manager's tree as *reference territory* in config; any read from it comes back stamped "exemplar/template, not live system code."
2. **Extraction (probably righter):** pull it out of fs-dev into its own repo. It ships as its own product anyway — the confusion is the packaging telling you the boundary is wrong.

## The Four-Product Binary

When the binary is written, the user gets:

- The home product
- The bookkeeping app
- The coding assistant
- The System Manager

## Two Wikis

- **fs-dev wiki** — a prototype that lives with the code and ends up part of the repo. Defines what's *behind the curtain*: source of truth for builders. Converges on truth about internals.
- **System Manager wiki** — a very different kind of wiki, oriented around **how to operate within the system**, not what's behind the curtain. Consumed top-page-first by an AI in system mode. Converges on *effective procedure*.

Operator's manual vs engineering docs — the knowledge-partitioning instinct (internal/frozen vs external/live) given a product boundary to live on.

## Relationships

- Territory/kickback mechanism: `../016-Per_View_Agents/per-view-agents-and-sideways-consensus.md`
- System mode read tier / ticket boundary: `../012-App_Federation/app-federation-and-ticket-boundary.md`
- Freebies the workspaces get wired with: `../018-Local_Model_Toolbox/local-model-toolbox-and-pipelines.md`
- Wiki hierarchy/edges/source-files progression: `../014-Second_Brain_Chat/second-brain-chat-vision.md` (Method Note)
