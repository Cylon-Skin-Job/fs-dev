---
name: Chat Electron Playwright
description: Target structure for future Electron Playwright coverage.
metadata:
  incoming-edges:
    - Chat Testing And Operations
    - Chat Smoke Tests
  outgoing-edges:
    - Fusion Restart
  source-files:
    - fusion-studio-client/electron/main.cjs
  connected-skills: []
  related-trigger-files: []
---

Electron Playwright should be a separate test lane from browser Playwright.

Target structure:

```text
fusion-studio-client/playwright.electron.config.ts
fusion-studio-client/e2e-electron/
```

Run single-worker after `npm run build`. Launch `electron/main.cjs` with
isolated environment:

```text
FUSION_APP_USER_DATA=<temp-dir>
FUSION_LOCAL_MACHINE=playwright-e2e
```

Use this lane when the real app shell, preload, custom protocol, packaged
paths, or Electron-owned server lifecycle matters.
