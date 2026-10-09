# Software Work Profile

Load this profile for code changes, application behavior, architecture, contracts, migrations, technical planning, or implementation preparation. Use only the artifacts earned by current content.

## Typical Evidence

- Current code, tests, runtime configuration, and reproducible behavior outrank stale explanatory notes for implemented behavior.
- Owner statements establish desired behavior and scope, not current implementation facts unless independently verified.
- Architecture documentation governs intended contracts when current code does not contradict it.
- Preserve the distinction between observed behavior, inference, proposal, and approved direction.

## Candidate Extension Documents

| Document | Kind | Use when |
|---|---|---|
| `REFERENCES.md` | `evidence_corpus` | User statements, code, wiki/standards, runtime evidence or prior work need a shared source catalog. |
| `CHANGE_SURFACE.md` | `change_surface` | A meaningful set of behavior, code, data, wiki, planning or operational surfaces and downstream consumers must be bounded. |
| `CONTRACTS.md` | `interface_contracts` | APIs, events, data shapes, UI contracts, or subsystem boundaries need stable cross-cutting treatment. |
| `SCHEMA.md` | `data_schema` | Tables, fields, migrations, relationships, or persistent formats form a substantial technical corpus. |
| `ARCHITECTURE.md` | `architecture_model` | Components and their responsibilities or interactions need a durable model beyond intent and proposals. |
| `TESTING.md` | `test_strategy` | Verification matrices, fixtures, environments, or acceptance coverage require their own lifecycle. |
| `IMPLEMENTATION.md` | `implementation_notes` | Pre-roadmap sequencing or technical discoveries need a working surface without becoming an approved roadmap. |
| `WIKI_IMPACT.md` | `wiki_impact_map` | Future canonical documentation effects need bounded analysis separate from actually editing the Wiki. |

Starter forms for REFERENCES, CHANGE_SURFACE and CONTRACTS are available in the [Launchpad template](../../../../template/AGENTS.md#use-the-starter-documents-to-guide-discussion). Reuse their section and record conventions where useful; inclusion is not a requirement to invent content.

Do not create both `SCHEMA.md` and `CONTRACTS.md` merely because data shapes exist. Use contracts for externally relied-upon behavior and schema for substantial persisted structure; combine them when the same readers maintain both through the same lifecycle.

## Useful Procedures

- Repository and architecture survey
- Current-behavior verification
- Change-surface mapping
- Contract comparison
- Data migration analysis
- Risk and regression analysis
- Test-matrix construction
- Roadmap-readiness reconciliation

## Handoff Signals

Software work approaches Roadmap Creator readiness when desired behavior is explicit, important current behavior has been verified, major affected surfaces and contracts are bounded, unresolved owner choices are visible, and proposed implementation details remain distinguishable from approved requirements.
