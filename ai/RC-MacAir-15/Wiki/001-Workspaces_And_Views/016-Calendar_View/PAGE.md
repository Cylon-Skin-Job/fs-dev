---
name: Calendar View
description: A mounted calendar demo surface with an existing but incomplete sync and storage path.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/calendar/CalendarViewer.tsx
    - fusion-studio-client/src/state/calendarStore.ts
    - fusion-studio-server/lib/calendar/db-writer.js
    - fusion-studio-server/lib/calendar/index.js
    - fusion-studio-server/lib/calendar/google/poller.js
    - fusion-studio-server/lib/http/calendar-routes.js
  last-modified: "2026-09-21T13:37:22Z"
---

**Calendar** has a bundled `calendar-viewer` template and a mounted React component. `CalendarViewer` currently calls `loadDemoData` when opened and renders the calendar store's month and event UI. The store has HTTP read helpers and the server has optional background sync readers/writers, but those definitions do not establish a live, configured round trip in the mounted view. Store create, update and delete operations currently warn that write-back is deferred.

## Current status and limits

Calendar is optional in the five-view New Workspace profile. Existing server sync can write source and event rows to `fusion.db` when enabled; this conflicts with the approved direction that connected calendar services remain authoritative for live content. [Server And Runtime: Current calendar storage gap](../../002-Server_And_Runtime/PAGE.md#current-calendar-storage-gap) records the bounded route and conditions. This page does not assume sync is enabled, data exists, or a migration is approved.

The template declares a type, not a finished external-service integration or future plugin contract.

## Current refresh behavior

The Apple Calendar directory listener has been retired. Current startup therefore does not automatically sync or refresh Apple Calendar data; existing imported rows are not deleted and may become stale. Calendar UI and routes remain, as does the shared `calendar:sync_complete` broadcaster. The independently enabled Google connector retains its five-minute polling path. Repo-local thirty-minute snapshots are not Calendar freshness and do not replace an Apple connector.

Future Apple monitoring is a separate proof and capability track: [D-019/D-020](../../../mission-control/launchpad/plugin-foundation/DECISIONS.md#d-019--treat-apple-mail-and-calendar-monitoring-separately-from-repo-snapshots) and [I-021/I-022](../../../mission-control/launchpad/plugin-foundation/ISSUES.md#i-021--low-resource-apple-mail-and-calendar-change-monitoring). Its latency, coverage, permissions, resource use, lifecycle and admission choices remain open. No native monitoring implementation is included here. See [Background Services](../../002-Server_And_Runtime/006-Background_Services/PAGE.md#configuration-and-calendar).
