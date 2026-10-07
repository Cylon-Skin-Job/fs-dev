---
name: Events Taxonomy
description: Categories for UI actions, chat lifecycle, tool calls, harness events, triggers, scheduler runs, resource mutations, render events, and external observations.
metadata:
  source-files:
    - fusion-studio-server/lib/event-bus.js
    - fusion-studio-server/lib/event-registry/seed-catalog.js
    - fusion-studio-server/lib/event-registry/filter.js
    - fusion-studio-server/lib/event-registry/schemas/file-command-accepted-v1.json
    - fusion-studio-server/lib/event-registry/schemas/resource-mutated-v1.json
    - fusion-studio-server/lib/event-registry/schemas/agent-tool-completed-v1.json
    - fusion-studio-server/lib/event-registry/schemas/resource-state-observed-v1.json
  last-modified: "2026-09-19T11:52:20Z"
---

Status: source inspected on 2026-09-19 in the development checkout. This page describes the implemented bounded contracts and separates future direction below. Existing tests were inspected as assertions, not rerun; no live runtime or installed Alpha verification is claimed.

Use this page before naming or classifying events. A name's punctuation does not establish authority. Legacy topics, registered commands/queries, governed facts and renderer projections are different contracts.

## Current registered vocabulary

`fusion-studio-server/lib/event-registry/seed-catalog.js` defines the shipped schema catalog. The event schemas use top-level `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `workspaceId` and `operationId`; they do not implement the older universal `eventFamily`/`ids`/`provenance` envelope.

| Kind | Name/version | Meaning and current consumer |
|---|---|---|
| Command | `file_save@1` | Validated mediated UTF-8 save; a request, not a mutation fact |
| Fact | `file.command_accepted@1` | Durable save acceptance; contains `commandId`, `origin`, `resource`, `intent`; no seeded subscriber or ledger row for this fact |
| Fact | `resource.mutated@1` | Successful mediated save, `create` or `modify`; adds `commandAcceptedEventId`, `mutation`, `fileVersionId`; save ledger and renderer subscribers |
| Fact | `agent.tool_completed@1` | Terminal activity, including schema statuses `completed`, `error`, `blocked`, `interrupted`; `origin`, `thread`, `tool`, `timing`, `resources`, `candidatesTruncated`; ledger and observation scheduling |
| Fact | `resource.state_observed@1` | First/changed eligible `bytes` or `absent` checkpoint; `source`, `resource`, `observation`; agent ledger, with renderer work owned by durable projection jobs |
| Projection | `resource:changed@1` | File Viewer invalidation after a mediated create/modify |
| Projection | `resource:changed@2` | Agent observation invalidation with `first_observation`, `changed` or `unchanged`; does not assert a tool caused a mutation |
| Projection | `resource:refresh_required@1` | Non-fact freshness recovery; no canonical mutation claim |
| Query | `resource:provenance@1`, `agent:activity@1`, `file_tree@1`, `file_content@1` | Typed protocol contracts; registration alone says nothing about a mounted audit UI |

An unchanged observation may issue v2 invalidation without creating another observation fact/checkpoint. Tool status is a terminal activity classification, not a promise of successful execution or a synonym for the event name. Save-to-missing is create; separate create/move/rename/delete commands and arbitrary external writes have not become governed save facts.

## Legacy topics

Public `emit/on` uses colon topics such as `chat:*`, `workspace:switched`, `thread:state_changed` and `file:changed`, with `{type, timestamp, ...data}` rather than the governed envelope. The legacy ledger records only `workspace:switched` and `thread:state_changed`; it ignores `file:changed`. Broad watcher production is retired, while the topic remains available to any independent producer. Legacy trigger activity is not admission, causal proof or comprehensive provenance. See [Universal Event Bus](../001-Universal_Event_Bus/PAGE.md).

## Direction and proposals

### New schema design requirement

Owner-approved direction recorded 2026-09-27 PDT: every new cross-capability event path must classify its command/fact/observation/query/projection contracts and identify executable schema ownership. Follow the [code planning rule](../../005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md#governed-capability-planning).

Reuse definitions only where semantics, identities, units/clocks, authority and lifecycle match. Share genuinely common definitions through the registry's supported mechanisms; new domain-specific schemas are appropriate where no general cross-capability meaning is anticipated. Do not create a giant generic payload, mutate a locked schema in place or add unregistered fields. A SPEC must state schema version/evolution, producer, consumers, privacy/retention and validation tests; unsupported shared-reference mechanisms need an explicit framework extension.

Health counts, queue depth and latency are observations, not mutation proof. Sampled renderer and process health schemas are still to be designed and registered; none of the four current facts above implicitly supplies them. Canonical chat events and the contentful audit subscriber must not be treated as a safe retained health schema.

Product domains include UI actions, chat/harness activity, automation, resource mutations, render synchronization and external observations. This is a useful conceptual taxonomy, not a list of registered governed families. General `ui.action`, `chat.tool.*`, `file.version` and audit/automation envelopes remain outside the implemented catalog. Do not add fields or register an event merely because a conceptual category exists. Approved intent favors distinct timestamped facts and unknown attribution where necessary; exact wider schemas and permission grammar require their own decisions.
