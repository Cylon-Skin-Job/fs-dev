---
name: Troubleshooting Background Services
description: Bounded checks for background-service setup and failures.
metadata:
  source-files:
    - fusion-studio-server/lib/background-services/config.js
    - fusion-studio-server/lib/background-services/log.js
    - fusion-studio-client/src/clipboard/clipboard-monitor.ts
    - fusion-studio-server/lib/transcription/index.js
  last-modified: "2026-09-28T04:18:57Z"
---

## Background-service checks

If Calendar data is absent, check whether the relevant Apple or Google adapter is enabled. Apple needs its local Calendar database; Google needs bridge configuration. A service failure that reaches the shared safety boundary writes a generic redacted line to `fusion-studio-server/data/background-services.log`; a missing line does not prove success, and the line does not identify the underlying exception. Correlate with startup status and the owning service.

Current renderer code starts system clipboard polling only when `fusion.clipboard.monitor.enabled` is `true` in localStorage; denied reads are warning-throttled. This is transitional managed-history behavior, not the approved direct-copy target. Automatic panel screenshots and screenshot-list requests have separate ownership. Harness discovery can probe local binaries at startup or on a client status request. On-demand transcription may download a model or build its binary if local assets are absent.

## Checks to run when changing a service

On a disposable profile, separately exercise an unavailable Calendar database, missing bridge configuration, denied clipboard permission, malformed trigger, missing harness CLI and missing style file. Observe process survival, skip/status behavior and the relevant log or UI result. This is an operator checklist, not a claim that these scenarios passed during this documentation migration.
