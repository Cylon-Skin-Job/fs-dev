---
name: git
description: Inspect worktree state, prepare commits, and preserve unrelated user or agent changes.
---

# Git

Use this skill when reviewing repository state or preparing commits.

## Guidance

- Inspect status, diff, and recent commits before committing.
- Stage only intended files.
- Never revert unrelated user or agent changes without explicit approval.
- Use scripts to detect whether the local project is git tracked.
- Use scripts to detect whether GitHub tokens/auth, GitLab tokens/auth, or both are available.
- Use scripts to detect whether remotes are synced to GitHub, GitLab, or both.
- Explain the correct push/pull path based on detected remotes and available auth.

## Provider Detection

Git helpers should determine the current project state before giving instructions or running sync commands:

- Is this folder inside a git worktree?
- What branch is checked out?
- Are there uncommitted changes?
- Which remotes exist?
- Do remotes point to GitHub, GitLab, or both?
- Is the local branch ahead, behind, diverged, or untracked?
- Is authenticated CLI/API access available for GitHub, GitLab, or both?

Do not assume a provider from repository name alone. Use the configured remotes and available authenticated tools/tokens as evidence.

## Folder References

Additional files in this skill folder can hold provider-specific and script-specific knowledge, such as:

- GitHub auth detection.
- GitLab auth detection.
- Remote classification.
- Push and pull safety rules.
- Commit message conventions.
- Multi-remote sync procedures.

Read those files when the task requires more detail than this top-level skill provides.
