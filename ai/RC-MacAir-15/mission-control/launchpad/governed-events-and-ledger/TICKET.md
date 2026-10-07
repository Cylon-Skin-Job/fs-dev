# Governed events and ledger — intake and return point

> Prepared scope and source pointers; not an executable roadmap or implementation approval.

## Assignment

The owner approved a distinct Launchpad folder for this subject in the current Mission Control setup conversation, after coordination with [Run roadmap supervisor](codex://threads/01a0c1c8-6e85-7f83-8d67-2cb5c1476007). Source direction: [UEB Wiki](../../../Wiki/010-Events_And_Ledger/001-Universal_Event_Bus/PAGE.md); supporting context: [event taxonomy](../../../Wiki/010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md), [provenance](../../../Wiki/010-Events_And_Ledger/003-Provenance_Model/PAGE.md), and [backend capture](../../../Captures/032-Plugin_Backend/backend-architecture.md). No main task is registered for this folder.

## Desired outcome

Give authorized plugin consumers specific, versioned event and ledger contracts without exposing raw publication or conflating required records with sampled telemetry.

## Scope and dependencies

This folder owns shared event/schema, publisher/subscriber admission, producer identity, delivery/failure, and system ledger questions. It does not own the health database or logger UI, plugin package lifecycle, or chat runtime commands. The work may be shaped alongside sibling folders, but a dependency is released only by a named, reviewed contract or accepted integration result. The owner will settle detailed scope and sequencing after provisioning.

## Current disposition

This folder is prepared for owner-managed re-entry. Its sources are linked, not moved; no current product candidate has been verified by this setup. See [INTENT](INTENT.md), [DECISIONS](DECISIONS.md), [ISSUES](ISSUES.md), and [REFERENCES](REFERENCES.md).

## Next safe action

Inventory the currently implemented event contracts and open provenance/ledger gates, then define the narrow contracts required by the first approved plugin proof and health consumer. Before any execution assignment, record its exact source revision, writer, report destination, verification and owner checkpoint. Mission Control and its recurring loop remain inactive.
