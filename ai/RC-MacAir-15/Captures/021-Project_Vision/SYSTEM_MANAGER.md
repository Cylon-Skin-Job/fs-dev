# SYSTEM MANAGER — Robin

> Working product-concept synthesis for Robin and the future system-level management surface. DECISIONS.md remains authoritative; this document does not authorize migration or implementation.

## Identity and Placement

Robin is the product-facing evolution of the System Manager concept. Raven remains RC's private name for the GPT-4-era inspiration.

- Robin sits above and across workspaces rather than occupying one workspace.
- A bird icon or app button provides the persistent entry point.
- The initial interaction is a modal or app drawer above the current screen, with chat as the default surface and app content available from menus or conversation references.
- This Robin shell is the primary interaction paradigm for the planned web application, while desktop workspaces remain VS Code-like with attached chat.
- Robin is the easiest place to ask what is happening elsewhere in Fusion Studio, discuss system behavior, and decide whether triggers, filters, or notification routing should change.
- D-001 and D-002 establish the identity and placement; the final visual design and interaction states remain open.

INTERACTION_MODEL.md develops the cross-surface contract without authorizing implementation.

The existing repository-level System_Manager directory represents the older workspace-shaped concept. I-010 records the eventual inconsistency; this capture does not authorize changing or deleting it.

## System Manual and Grounding

Robin begins with the Fusion Studio system manual as its base instructions and system orientation.

- D-003 places the manual in SQLite rather than in the System Manager workspace.
- The manual must distinguish stable product instructions from live system state, procedures, user preferences, and change history.
- Robin should be able to answer from indexed manual knowledge, identify when it lacks grounding, and offer to inspect the authoritative source.
- A change to skills, scripts, policies, or other system behavior may produce both a manual-update candidate and a review notification.
- The manual needs source identity, version history, edit authority, and a way to prevent stale summaries from outranking current code or configuration.

## Cross-Workspace Intake

Robin can receive tickets, events, and review items from any workspace.

Receiving a bounded event is not standing permission to search the originating workspace's chat history or other content. Cross-workspace history retrieval requires a visible user-approved scope, and the resulting source material remains governed by that scope.

Potential event sources include:

- agents modifying skills, scripts, prompts, workflows, or system configuration;
- recurring or autonomous items completed while the user was away;
- blocked work that needs owner clarification;
- changes to a topic, entity, project, timeline, or other visible memory node;
- cross-workspace conflicts or important state changes; and
- scheduled administrative, research, communication, or maintenance work.

The event contract must preserve origin, affected workspace, triggering process, source evidence, action taken, confidence, severity, review requirement, and an exact link back to the underlying record.

## Notifications and Review

Robin's bird icon may display a badge when reviewable system activity exists. Opening Robin reveals concise items such as “Review 1 script that ran” rather than forcing the user to inspect raw logs.

Candidate controls include:

- open, dismiss, acknowledge, or revisit;
- silence one workspace for a bounded duration;
- permanently suppress a known low-value event class;
- remove the badge while retaining history;
- group repetitive events into a bundled summary;
- redirect a notification class to another review surface; and
- apply badge thresholds without discarding the underlying records.

Notifications provide awareness, not decision authority. Silent or bundled delivery must not hide a security, privacy, data-loss, or explicit-approval requirement.

A supervisory routine can make status reporting proactive. While watched builds or orchestrators are active, Robin may receive hourly or event-driven grounded snapshots, bundle unchanged work, elevate failures or blocked questions, and stop the heartbeat when nothing remains active.

## Conversation and Background Context

Robin should remain conversationally responsive even when a request spans many domains.

1. Check the system manual, indexes, visible memory nodes, and fast summaries for awareness.
2. Search broadly enough across already-authorized sources to answer the immediate question.
3. State uncertainty or missing context rather than bluffing.
4. Offer to investigate the subject more deeply when additional grounded work would help.
5. If requested, seed background agents with the initial search and conversation so they can retrieve, compare, and reconcile missing context.
6. Return a compact synthesis with provenance and preserve it in the subject's database-backed Launchpad container for easy future recall.
7. Improve that node when the user returns to the subject, without asking them to design its tags or schema.
8. Keep specialist code, research, or administrative agents focused on their actual task instead of making each one monitor the whole system.

This resembles Launchpad at the system level and Second Brain backstage: a persistent fronting conversation coordinates bounded context work without surrendering owner judgment.

Robin may also present active and inactive background-worker templates that users can install, inspect, modify, or disable. Template visibility or installation does not grant data access; each worker still needs explicit tools, scopes, triggers, output contracts, and review behavior. WORKFLOW_MODEL.md develops this candidate lifecycle.

Robin also hosts the Routines app. When an utterance semantically invokes a routine, Robin resolves the executable attachment, loads its database-backed Launchpad state and relevant memory nodes, gathers any missing context through bounded receipts, guides or performs the authorized steps conversationally, and records the run. Routines can be reached through the app catalog or from the topic, project, health, learning, or other nodes where they have been injected. ROUTINES_MODEL.md develops this behavior.

For a blocked orchestrator, Robin can act as the owner's interaction surface: show the exact question with its run and checkpoint, collect the user's answer, preserve it as owner-authored input, relay it to the originating run, and offer only the continuation controls valid for that state. Robin must not silently transform contextual discussion into permission to restart or broaden the run.

## Open Design Questions

- What is the SQLite schema for the system manual, its sections, versions, citations, and derived summaries?
- Which events must Robin receive, and which remain workspace-local?
- What distinguishes informational, reviewable, approval-required, privacy-sensitive, and urgent notifications?
- How do badge counts behave under grouping, silence, acknowledgement, and partial review?
- Which background actions require prior approval, periodic approval, retrospective review, or no interruption?
- How are event retention, deletion, export, and audit history governed?
- How does Robin's persona express rapport, opinion, uncertainty, and source boundaries without implying literal sentience?
- How does the current System_Manager workspace migrate without losing useful bundled procedures or history?
- How are user-downloaded or locally edited worker templates permissioned, versioned, reviewed, rolled back, and isolated?
- How does Robin disambiguate routine aliases, ordinary questions, and requests to resume an interrupted run?
- How are proactive build and orchestrator reports grouped, aged, silenced, and tied to authoritative live state?
- Which run controls can Robin expose, and how does it distinguish resume, retry, restart, and worker replacement?
