# Handoff: Slack Extrication Slice 0 - Preflight Inventory

## Status

READY FOR EXECUTION

## Objective

Create a precise inventory for removing Slack Liaison work without deleting unrelated branch changes.

Do not edit or delete files in this slice. This is a report-only preflight.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/SLACK_EXTRICATION_ORCHESTRATION.md
```

## Commands

Run from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
git log --oneline -10
```

Then search for Slack/Liaison references using available tools. If `rg` is unavailable, use another search tool.

Search terms:

```text
slack
Slack
SLACK
Liaison
@slack/bolt
setup-slack-connector
```

## Report Requirements

Report:

- Exact files/directories that appear safe to delete as isolated Slack/Liaison work.
- Exact shared files that need surgical line removal.
- Any Slack/Liaison references that should remain for now, especially System Viewer Secrets Manager planning content.
- Confirmation that `fusion-studio-server/server.js` has no Slack-specific changes.
- Unrelated dirty files that must be preserved.

## Non-Goals

- Do not delete files.
- Do not patch files.
- Do not run package cleanup.
- Do not commit.

## Expected Outcome

Return a removal manifest and blockers, if any.
