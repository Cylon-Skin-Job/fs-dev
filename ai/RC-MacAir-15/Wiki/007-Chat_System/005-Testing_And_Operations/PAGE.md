---
name: Chat Testing And Operations
description: Vertical smoke tests, browser Playwright, Electron Playwright, and Fusion restart guidance for chat work.
metadata:
  incoming-edges:
    - Chat System
    - Chat Overview
  outgoing-edges:
    - Chat Smoke Tests
    - Chat Browser Playwright
    - Chat Electron Playwright
    - Fusion Restart
  source-files:
    - fusion-studio-client/playwright.config.ts
    - fusion-studio-server/server.js
  connected-skills: []
  related-trigger-files: []
---

Use this section before validating chat changes.

Fusion Studio is a single-machine Electron workspace app with a browser
renderer and a Node server. Browser Playwright is useful for focused renderer
and server assertions. Electron Playwright or the Fusion Home restart script is
needed when the app shell itself matters.

<!-- children:start -->
## Children

- [Chat Smoke Tests](001-Smoke_Tests/PAGE.md) - Vertical-slice smoke testing guidance for chat changes.
- [Chat Browser Playwright](002-Playwright_Browser/PAGE.md) - Browser Playwright configuration and when to use it for chat validation.
- [Chat Electron Playwright](003-Playwright_Electron/PAGE.md) - Target structure for future Electron Playwright coverage.
- [Fusion Restart](004-Fusion_Restart/PAGE.md) - Fusion restart script behavior and when to use it for chat validation.
<!-- children:end -->
