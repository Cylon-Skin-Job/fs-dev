# Intent

> Owner-directed outcomes and boundaries; not claims of implementation.

## Outcomes

CHAT-AR SPEC-06 is owner-closed with explicit residuals. Make ongoing dogfooding useful through bookmarks and focused investigations. Shape a content-free health store and improve real-time rendering without deriving the same measurements twice. The [chat close-out folder](../chat-integration-and-retirement/TICKET.md) owns remaining verification and retirement; shared governed event/subscriber foundations belong to [governed events and ledger](../governed-events-and-ledger/TICKET.md).

## Architecture direction

New cross-capability work belongs in the schema/provenance model: identify command, fact, observation, query and projection owners; reuse compatible definitions and add domain-specific ones when semantics differ. System ledger, personal chat history and optional sampled health retention are distinct destinations.

The logger should be planned against the [plugin foundation](../plugin-foundation/TICKET.md) from inception under the owner's newer plugin-first direction. The server retains protected authority and exposes narrowly permitted callable capabilities; local rendering stays local. View registration and provisioning belong to the [view folder](../plugin-views-and-provisioning/TICKET.md). Do not turn every render update into a server round trip or move core chat persistence/runtime authority into a view plugin.

## Boundaries

Separate health SQLite database; fusion.db retains personal chat, notes and bookmarks. No chat/tool text, titles, paths, credentials or content archive in the safe logger. Raw opt-in Diagnostics stays a separate ephemeral surface. Retain the first limit reached: 2 GB, 30 days or a bounded event count. Use sampling and manual deterministic queries, not generated summaries.

Exports, automatic upload, server-folder scripts and plugin distribution wiring are later work. Neither a Markdown setup file nor physical DB separation proves enforced permissions; that requires actual scoped capabilities. No implementation, deployment or MC activation is authorized by this folder.
