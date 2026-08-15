# Kimi Legacy Worker Standards Gate

Use this standards gate for every handoff created from `docs/KIMI_HARNESS_LEGACY_REMOVAL_ROADMAP.md`.

Primary standards source:

```text
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Required Startup Checks

Run from the repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

If `git rev-parse` fails, the session is in the wrong directory. Do not report "repo is not initialized" until checking the repo root above.

## Standards To Enforce During Each Slice

- One responsibility per file. Do not add a new mixed-concern file.
- No scope creep. Do exactly the slice task, not adjacent cleanup.
- Delete dead code instead of leaving deprecated shims, `_unused` names, or "removed" comments.
- Do not create abstractions for one-time use.
- Do not split `LiveSegmentRenderer.tsx`; the code standards page explicitly marks it as no-action because splitting it can break completion behavior.
- Do not use frontend aliases to hide backend vendor-name leaks.
- Do not mix backend harness routing with frontend render cleanup.
- For CSS edits, prefer deleting stale rules or using existing CSS variables with fallbacks. Do not introduce hardcoded colors, spacing, or z-index values.
- Preserve existing layer boundaries: presentation renders state, orchestration coordinates behavior, services own data access.

## Required Validation Additions

Every worker must run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git diff --check
```

Every worker final response must include:

- Whether `git rev-parse --show-toplevel` matched `/Users/rccurtrightjr./projects/fs-dev`.
- `git status --short` summary before and after edits.
- `git diff --check` result.
- Slice-specific build/test/lint results.
- Any code standards exception, with the reason.

## Review Rule For Orchestration

Before accepting a slice, the orchestration session should verify:

1. The worker stayed inside the slice scope.
2. The worker did not add compatibility shims or silent fallbacks.
3. The worker did not split files marked as no-action in the code standards page.
4. The worker removed obsolete code instead of preserving a second path.
5. Slice-specific `rg` acceptance checks pass.
