# Wiki agent package setup

The owner invokes Wiki Update manually from the Wiki folder. There is no Mission Control handoff requirement or automatic merge/commit trigger.

## Installed package

- Wiki/AGENTS.md: local entry and shared article rules.
- .agents/wiki-session-contract.md: assignments, source baselines, run records, write ownership and completion.
- .agents/skills/: wiki-update, wiki-research, wiki-repair and wiki-audit.
- .codex/agents/: wiki-update-supervisor, wiki-research-worker, wiki-repair-worker and wiki-auditor standalone TOML definitions.
- .codex/config.toml: enables agent tools locally; does not select models, permissions or concurrency.
- 008-Workflows/002-Wiki_Update/PAGE.md: human-readable entry reference.

## Validation and limits

All four skills passed Skill Creator's validator. All four profile files parse as TOML with name, description and developer_instructions; referenced skill files exist. Package Markdown links resolve. The new/edited wiki articles have valid source-only metadata and quoted modification timestamps. The shared wiki scanner exposes the new workflow article and excludes the hidden agent/configuration folders.

A Codex CLI prompt preview launched with Wiki as CWD included this folder's AGENTS.md and all four local skills. It did not execute a model turn or update run. The preview does not expose custom-agent tool definitions. A separate read-only app-server configuration check timed out during initialization, so runtime profile selection and nested spawning have not been verified. The first invoked run must verify actual role/delegation availability; the shared contract specifies an explicit-procedure fallback when a named profile is unavailable, without claiming an unperformed independent audit.

Current official Codex documentation describes standalone custom-agent TOML files, so this package does not duplicate the older per-role config_file registrations found in Mission Control. The directory-scoped structure is the same; global/user configuration and Mission Control files were not changed.

## Reference sources

- [Local skill discovery](https://learn.chatgpt.com/docs/build-skills)
- [Custom agent files and inherited settings](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Trusted folder-local configuration](https://learn.chatgpt.com/docs/config-file/config-basic)

This is a setup receipt, not an independent audit or a completed Wiki Update run.
