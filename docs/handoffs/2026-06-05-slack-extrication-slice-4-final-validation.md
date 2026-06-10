# Handoff: Slack Extrication Slice 4 - Final Validation

## Status

BLOCKED ON SLICE 3 REVIEW

## Objective

Verify Slack/Liaison cleanup is complete and identify any intentional remaining planning references.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/SLACK_EXTRICATION_ORCHESTRATION.md
```

## Searches

Exclude untracked packaged release artifacts from source-cleanup searches unless explicitly instructed otherwise:

```text
fusion-studio-client/release/
```

That directory may contain copied/built app artifacts with Slack references. It is not the source cleanup target for this extrication pass.

Search the repo for:

```text
slack
Slack
SLACK
Liaison
@slack/bolt
setup-slack-connector
startSlackLiaison
rv-liaison
```

Classify each remaining match as one of:

```text
INTENTIONAL_REMAINING
NEEDS_REMOVAL
UNRELATED_EXISTING
```

Expected intentional remaining references may include System Viewer Secrets Manager planning content if we decide to keep it.

## Validation

Run targeted checks appropriate to changed files from prior slices:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git status --short
git diff --check
```

If backend files changed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
npm test -- --runInBand
```

If client `App.tsx` changed and dependencies are available:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

If full tests/builds are too broad or fail because of unrelated dirty work, stop after targeted evidence and report clearly.

## Report Requirements

Report:

- Remaining matches classified.
- Validation commands and results.
- Any cleanup still needed.
- Whether the repo is Slack-runtime-clean.

## Non-Goals

- Do not make new feature changes.
- Do not remove System Viewer Secrets Manager content unless explicitly approved.
- Do not commit.
