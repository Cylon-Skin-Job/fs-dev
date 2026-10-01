---
name: Chat Smoke Tests
description: Vertical-slice smoke testing guidance for chat changes.
metadata:
  incoming-edges:
    - Chat Testing And Operations
  outgoing-edges:
    - Chat Browser Playwright
    - Chat Electron Playwright
  source-files:
    - fusion-studio-server/package.json
    - fusion-studio-client/package.json
  connected-skills: []
  related-trigger-files: []
---

Chat work should move in vertical slices with a narrow smoke test after each
slice.

## Default Order

1. Server/unit behavior for persistence or metadata.
2. Client type/build behavior.
3. Focused browser Playwright when renderer/server behavior can be tested in
   the browser lane.
4. Electron/manual smoke when shell behavior, bundled client, or app restart
   behavior matters.

## Commands

```text
cd fusion-studio-server && npm test
cd fusion-studio-client && npm run build
```

Use focused tests when possible. Do not broaden test scope just because a chat
change touches several concepts; broaden only when the behavior crosses shared
contracts.
