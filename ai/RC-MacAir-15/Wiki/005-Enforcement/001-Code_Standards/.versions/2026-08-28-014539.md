---
name: Code Standards
description: Table of contents for Code Standards.
metadata:
  incoming-edges: []
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

- [Architecture Routing](001-Architecture_Routing/PAGE.md) - Rules for finding and using existing dispatchers, interpreters, controllers, and service boundaries before adding new routes.
- [Frontend UI](002-Frontend_UI/PAGE.md) - Rules for UI components, composer/reply chrome, user intents, and presentation boundaries.
- [State Management](003-State_Management/PAGE.md) - Rules for store ownership, backend state authority, hydration, and avoiding duplicated state checks.
- [WebSocket Protocol](004-WebSocket_Protocol/PAGE.md) - Rules for WebSocket message additions, canonical client intent, backend routing, and handler ownership.
- [Universal Event Bus](005-Universal_Event_Bus/PAGE.md) - Rules for using the server-side universal event bus without confusing commands, facts, chat lifecycle, and provider protocol.
- [Harness Adapters](006-Harness_Adapters/PAGE.md) - Rules for provider-specific CLI/service adapters, canonical events, and canonical thread actions.
- [Persistence And Metadata](007-Persistence_And_Metadata/PAGE.md) - Rules for SQLite writes, migrations, thread managers, metadata, file mirrors, and durable state updates.
- [Testing And Smoke Slices](008-Testing_And_Smoke_Slices/PAGE.md) - Rules for vertical slices, focused smoke tests, route-level verification, and reporting residual risk.
