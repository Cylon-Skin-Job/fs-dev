---
name: GitLab
description: Repository remote and credential support, plus the current limits of GitLab issue integration.
metadata:
  source-files:
    - fusion-studio-server/lib/secrets.js
    - fusion-studio-server/lib/sync/request.js
    - fusion-studio-server/lib/sync/pull.js
    - fusion-studio-server/lib/sync/push.js
    - fusion-studio-server/lib/tickets/dispatch.js
    - fusion-studio-server/lib/git-credential-fusion-studio.sh
  last-modified: "2026-09-28T04:18:57Z"
---

## Repository remotes

Remotes belong to each checkout: inspect that repository's configured URLs, branch and approved publishing flow before adding or pushing a GitLab remote. Do not assume another workspace uses the same namespace or branch. The current development publishing flow uses GitHub as recorded in this repository's `AGENTS.md`.

## Authentication

The repository contains a macOS Keychain-backed GitLab credential helper and GitLab issue API code. The current code expects a Keychain item named `GITLAB_TOKEN` under account `fusion-studio`; installation of the Git credential helper in a user's global Git configuration is not established by this repository. [Secrets Manager](../002-Secrets_Manager/PAGE.md) covers the app's credential storage and exposure limits. Credential creation and rotation must follow the actual project and account settings; do not paste tokens into wiki examples or shell history.

## Integration boundary

GitLab issue pull/push modules exist for a project-specific ticket flow. The standalone dispatch watcher that calls them is not mounted by normal server startup in the inspected checkout, and the current Issues view does not establish a live GitLab source tab or automatic synchronization. [Ticketing](../../003-Automation_And_Agents/002-Ticketing/PAGE.md) owns the local board and dispatch status. No Fusion Studio Wiki API synchronization or automatic GitLab project provisioning is established here.
