---
name: Set Up Fusion Studio
description: Paths for using Fusion Studio, developing it from source, and enabling optional integrations.
metadata:
  source-files:
    - fusion-studio-server/lib/cli-config/resolver.js
    - fusion-studio-client/electron/server-spawn.cjs
  last-modified: "2026-09-28T04:16:38Z"
---

## Choose the path

Opening an installed Electron app, developing Fusion Studio from source and enabling optional integrations have different prerequisites. This page is an orientation; use the owning instructions for a specific integration.

## Use chat

Workspace chat policy comes from `ai/<machine>/System/config/cli.json`. In this development workspace, OpenCode is the enabled default and Kimi is disabled. Make the configured harness available and set up its provider credentials through that harness's supported flow. [Chat decisions](../../007-Chat_System/000-Overview_and_References/002-Decisions/PAGE.md) own the policy; do not treat an old Kimi login command as current onboarding.

## Develop from source

Work in the primary `fs-dev` checkout with a compatible Node.js/npm toolchain. Install dependencies in `fusion-studio-client/` and `fusion-studio-server/`. From the client directory, `npm run electron:dev` builds the renderer and opens Electron; the shell starts the server process. For server-only validation, run `node server.js` or `npm test` from the server directory. These are development commands, not installed-app onboarding steps. The package manifests do not establish the old page's blanket Node 18 minimum.

Browser end-to-end tests use Playwright from the client directory; its Chromium installation is optional for that work. Consult [Chat testing and operations](../../007-Chat_System/005-Testing_And_Operations/PAGE.md) before using a live profile for Electron tests.

## Workspaces and optional features

Attach a project folder through Fusion Studio's workspace flow. Workspace content uses a machine-scoped `ai/<machine>/` tree; [Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md) owns the current layout. Changing the macOS screenshot location and adding credentials are user-chosen actions, not universal setup prerequisites. See [Screenshot Capture](../../004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md), [Secrets Manager](../../004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md) and [GitLab](../../004-Integrations_And_Tools/001-GitLab/PAGE.md) for their actual limits. A configured AI harness or external integration may communicate with external services; no all-data-local guarantee follows from this setup.

## Alpha dogfood installation

Alpha has a separate source checkout, installed app, user-data profile and machine identity. Changes in this development checkout do not update it. Follow the machine's approved Alpha workflow when a sync, build/install or restart is requested; Alpha deployment is not part of ordinary source setup.
