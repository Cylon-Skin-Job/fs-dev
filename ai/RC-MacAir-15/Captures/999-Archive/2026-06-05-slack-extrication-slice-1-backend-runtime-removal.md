# Handoff: Slack Extrication Slice 1 - Backend Runtime Removal

## Status

BLOCKED ON SLICE 0 REVIEW

## Objective

Remove isolated Slack backend/runtime files and remove the single shared startup hook.

Do not touch package files in this slice.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/SLACK_EXTRICATION_ORCHESTRATION.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-05-slack-extrication-slice-0-preflight-inventory.md
```

Use the reviewed Slice 0 removal manifest as authority.

## Intended Deletions

Delete only if confirmed by Slice 0 review:

```text
fusion-studio-server/lib/slack/
fusion-studio-server/test/slack/
fusion-studio-server/scripts/setup-slack-connector.js
fusion-studio-server/lib/db/migrations/024_slack_liaison_foundation.js
docs/SLACK_LIAISON_MVP_SPEC.md
docs/SLACK_LIAISON_ORCHESTRATION.md
docs/handoffs/*slack-liaison*
```

## Shared File Patch

Patch only `fusion-studio-server/lib/startup.js`:

- Remove `const { startSlackLiaison } = require('./slack/startup-runner');`
- Remove `await startSlackLiaison();`

Do not modify `fusion-studio-server/server.js`.

## Validation

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
node --check fusion-studio-server/lib/startup.js
git diff --check -- fusion-studio-server/lib/startup.js fusion-studio-server/lib/db/migrations docs
```

Then search for backend Slack leftovers:

```text
fusion-studio-server/lib/slack
setup-slack-connector
startSlackLiaison
SLACK_LIAISON_ENABLED
```

## Report Requirements

Report:

- Files/directories deleted.
- Shared file lines removed.
- Validation output.
- Any remaining Slack references and whether they are expected for later slices.

## Non-Goals

- Do not edit package files.
- Do not edit client files.
- Do not edit System Viewer Secrets Manager files.
- Do not commit.
