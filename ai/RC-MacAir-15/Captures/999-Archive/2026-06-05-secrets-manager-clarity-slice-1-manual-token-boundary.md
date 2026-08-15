# Handoff: Secrets Manager Clarity Slice 1 - Manual Token Boundary

## Status

READY FOR EXECUTION

## Objective

Clarify the System Viewer Secrets Manager tab so it represents manual token/API-key apps only.

Remove Slack from the Secrets Manager manual-token list because Slack's intended product direction is OAuth/Connectors, not user-pasted app tokens.

This is a small content/UI cleanup slice. Do not build live Secrets Manager behavior.

## Context

Slack runtime/code extrication is complete. A no-op migration tombstone remains intentionally:

```text
fusion-studio-server/lib/db/migrations/024_slack_liaison_foundation.js
```

Do not remove that tombstone.

The System Viewer currently has a Secrets Manager tab added during planning. We want to keep the tab, but avoid implying users should manually paste Slack app tokens.

## Required Files

Inspect before editing:

```text
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/<machine>/Views/system-viewer/app/app.js
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/<machine>/Views/system-viewer/content/secrets/user.md
/Users/rccurtrightjr./projects/fs-dev/System Source Files/ai/<machine>/Views/system-viewer/content/index.json
```

## Work

Update the System Viewer Secrets Manager source only.

Expected changes:

- In the Secrets Manager left-side list, keep:
  - GitHub
  - GitLab
- Remove Slack from the Secrets Manager left-side list.
- Keep the `In-Use` and `Inactive` sections.
- `In-Use` should still show `None` for now.
- `Inactive` should contain GitHub and GitLab only.
- Update `content/secrets/user.md` to explain:
  - Secrets Manager is for manual tokens/API keys.
  - OAuth/sign-in apps belong in Connectors or a future OAuth Apps flow.
  - Slack should be treated as a future OAuth connector, not a manual token template.

Do not remove Slack references from connector planning/wiki docs in this slice.

## Non-Goals

- Do not edit server code.
- Do not edit package files.
- Do not edit `fusion-studio-client/release/`.
- Do not delete the migration 024 tombstone.
- Do not build Slack OAuth.
- Do not wire live Secrets Manager storage.
- Do not commit.

## Validation

Run from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
node --check "System Source Files/ai/<machine>/Views/system-viewer/app/app.js"
node -e "JSON.parse(require('fs').readFileSync('System Source Files/ai/<machine>/Views/system-viewer/content/index.json','utf8'));"
git diff --check -- "System Source Files/ai/<machine>/Views/system-viewer"
```

Search the System Viewer Secrets Manager area for Slack manual-token leftovers:

```text
SLACK_BOT_TOKEN
SLACK_APP_LEVEL_TOKEN
SLACK_SIGNING_SECRET
Bot and Socket Mode tokens
manual-token MVP
```

It is okay if Slack remains mentioned in `content/secrets/user.md` only as a future OAuth connector example.

## Report Requirements

Report:

- Files changed.
- Confirmation the Secrets Manager left menu contains only GitHub and GitLab under Inactive.
- Confirmation Slack is no longer presented as a manual-token template.
- Validation commands and results.
- Any remaining Slack mentions and why they are intentional.
