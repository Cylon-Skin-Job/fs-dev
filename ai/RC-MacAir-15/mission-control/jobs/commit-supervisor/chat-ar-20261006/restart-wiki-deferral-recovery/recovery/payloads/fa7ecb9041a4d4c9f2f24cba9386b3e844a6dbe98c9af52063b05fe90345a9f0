---
name: Fusion Restart
description: Fusion restart script behavior and when to use it for chat validation.
metadata:
  incoming-edges:
    - Chat Testing And Operations
    - Chat Electron Playwright
  outgoing-edges: []
  source-files: []
  connected-skills: []
  related-trigger-files: []
---

The restart script lives at the root of this repository:

```text
/Users/rccurtrightjr./projects/fs-dev/restart-fusion.sh
```

It kills previous Fusion/Electron/server processes, builds the client, launches
Electron through macOS LaunchServices, waits for the Electron-owned server port
file, and prints the live server URL.

Use it for final visual validation of the real app shell or when client bundle
changes must be reflected in the running Electron app.

Because it opens a GUI app, tool runs may require approval.
