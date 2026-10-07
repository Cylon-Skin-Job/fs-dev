# Governed events and ledger — issues

> Sourced gaps and consequential unresolved intent; no implementation defect is inferred from a planning question.

## Scope and contracts

### I-001 — Subscriber and producer admission

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** [UEB Wiki](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md); current setup conversation and linked predecessor records.
- **Observation:** Existing governed UEB support does not establish general plugin registration or safe chat/render subscriptions.
- **Affected scope:** Governed events and ledger and named consumers.
- **Consequence:** The first consumer may otherwise bypass authority or reuse contentful streams.
- **Resolution needed:** Specify registered producer/subscriber identity, grants, schema versions and denial behavior.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-002 — Ledger versus telemetry

- **Category:** scope and contracts
- **Type:** ambiguity
- **Severity:** unassessed
- **Status:** open
- **Source:** [UEB Wiki](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md); current setup conversation and linked predecessor records.
- **Observation:** System ledger, chat history, audit projections and optional sampled health retention have different durability and privacy needs.
- **Affected scope:** Governed events and ledger and named consumers.
- **Consequence:** A single event path could make safety-critical acknowledgments lossy or health writes blocking.
- **Resolution needed:** Define each destination and delivery guarantee before consumers depend on it.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).

### I-003 — Current contract freshness

- **Category:** scope and contracts
- **Type:** gap
- **Severity:** unassessed
- **Status:** open
- **Source:** [UEB Wiki](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md); current setup conversation and linked predecessor records.
- **Observation:** Older backend notes contain platform-gate claims that need comparison with current UEB and ledger implementation.
- **Affected scope:** Governed events and ledger and named consumers.
- **Consequence:** Planning from stale blocked/unblocked assumptions may mis-sequence work.
- **Resolution needed:** Check current Wiki and bounded code/evidence before freezing dependencies.
- **Owner:** Owner for product choices; assigned main folder session for evidence and routing.
- **Next:** Recheck cited current sources and bring the specific choice or finding into this folder.
- **Related:** [TICKET](TICKET.md), [REFERENCES](REFERENCES.md).
