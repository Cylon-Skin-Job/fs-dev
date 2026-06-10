# Handoff: Slack Extrication Slice 3 - Package Cleanup

## Status

BLOCKED ON SLICE 2 REVIEW

## Objective

Remove the Slack SDK dependency while preserving unrelated package changes.

## Critical Constraint

Preserve unrelated `@huggingface/transformers` changes in:

```text
fusion-studio-server/package.json
fusion-studio-server/package-lock.json
```

Also preserve any other non-Slack dependency changes already present in the package files. This branch is dirty and package files are shared with unrelated work.

## Work

Remove only:

```text
@slack/bolt
```

from server package files.

Prefer package-manager cleanup over manual lockfile editing if it can be done without altering unrelated dependencies. If package-manager output would remove unrelated changes, stop and report.

Before applying package cleanup, inspect the package-file diff and identify which entries are Slack-specific versus unrelated.

## Validation

Run from server directory:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); JSON.parse(require('fs').readFileSync('package-lock.json','utf8'));"
```

Then from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check -- fusion-studio-server/package.json fusion-studio-server/package-lock.json
```

Search package files for:

```text
@slack/bolt
@slack/
```

## Report Requirements

Report:

- Package files changed.
- Confirmation `@huggingface/transformers` was preserved.
- Confirmation no unrelated dependency changes were removed.
- Validation output.
- Any remaining Slack package references.

## Non-Goals

- Do not run `npm audit fix`.
- Do not remove unrelated dependencies.
- Do not commit.
