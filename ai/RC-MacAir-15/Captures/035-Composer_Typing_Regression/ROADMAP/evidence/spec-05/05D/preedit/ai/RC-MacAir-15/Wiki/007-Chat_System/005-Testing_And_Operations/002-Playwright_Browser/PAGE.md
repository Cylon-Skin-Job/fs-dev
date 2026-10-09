---
name: Chat Browser Playwright
description: Browser Playwright configuration and when to use it for chat validation.
metadata:
  incoming-edges:
    - Chat Testing And Operations
    - Chat Smoke Tests
  outgoing-edges:
    - Chat Electron Playwright
  source-files:
    - fusion-studio-client/playwright.config.ts
    - fusion-studio-server/server.js
  connected-skills: []
  related-trigger-files: []
---

Browser Playwright runs against the local web renderer/server path.

Current config:

```text
fusion-studio-client/playwright.config.ts
testDir: ./e2e
baseURL: http://localhost:3001
webServer: node ../fusion-studio-server/server.js
```

Run focused tests from `fusion-studio-client`:

```text
npx playwright test <spec> --workers=1
```

Use `--workers=1` for app-state focused chat specs. The configured browser
lane is good for renderer/server assertions but does not validate the real
Electron shell.
