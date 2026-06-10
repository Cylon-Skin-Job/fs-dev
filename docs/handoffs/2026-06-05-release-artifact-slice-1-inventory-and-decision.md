# Handoff: Release Artifact Slice 1 - Inventory And Decision

## Status

READY FOR EXECUTION

## Objective

Inventory the untracked packaged release artifact directory and recommend how to handle it.

This is report-only. Do not delete, regenerate, or edit release artifacts in this slice.

## Context

Slack extrication validation intentionally excluded:

```text
fusion-studio-client/release/
```

because it is untracked packaged output and may contain copied/built files with stale Slack references. It is not source code.

We need to decide whether to:

1. Ignore it and keep excluding it from source validation.
2. Delete the untracked release artifact directory.
3. Regenerate release artifacts from clean source.
4. Add/update ignore rules if release output should not appear in `git status`.

## Required Checks

Run from repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git status --short -- fusion-studio-client/release
```

Inspect the directory shape and size using safe commands. Do not dump large binary contents.

Check whether it is ignored or tracked:

```bash
git check-ignore -v fusion-studio-client/release || true
git ls-files -- fusion-studio-client/release
```

Search only filenames/text files as feasible for stale Slack/Liaison references. Do not treat binary/package internals as source cleanup targets.

Search terms:

```text
Slack
slack
Liaison
rv-liaison
```

## Report Requirements

Report:

- Whether `fusion-studio-client/release/` is untracked, tracked, or ignored.
- High-level contents of the release directory.
- Whether stale Slack/Liaison references exist there.
- Whether those references appear to be copied source/build artifacts or something else.
- Recommendation: ignore, delete, regenerate, or update ignore rules.
- Any risk of deleting it, such as active package/testing dependency.

## Non-Goals

- Do not delete `fusion-studio-client/release/`.
- Do not regenerate release artifacts.
- Do not edit `.gitignore` yet.
- Do not edit source files.
- Do not commit.
