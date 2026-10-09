# WorkFolder Manager — Setup checkpoint

> Prepared role home; catalog migration and allocator implementation are pending.

## Current state

Owner wants this role to manage workfolders and maintain the registry used by Status Manager. [recordkeeping.md](../recordkeeping.md#workfolder-catalog-contract) proposes the catalog fields while preserving [the existing registry](../../registry.md).

Five existing Launchpad folders were observed at setup: chat-integration-and-retirement, fusion-health-and-governed-observability, governed-events-and-ledger, plugin-foundation and plugin-views-and-provisioning. Their live progress/sessions were not re-certified. No second catalog was populated.

## Next setup work

Settle canonical catalog ownership/location and coordinate the parent writer contract. Define folder/session/check registration, then adapt the relevant memory/template skills and create the profile. Existing ticket numbering/storage and mutable-scope decisions remain in the current ticket handoff; re-enumerate before any migration.
