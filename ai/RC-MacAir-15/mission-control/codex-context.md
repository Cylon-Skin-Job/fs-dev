# Codex folder context

## Instructions and skills

Use `AGENTS.md` for standing role instructions. Codex assembles applicable instructions from the repository ancestry toward the session CWD; child instructions can specialize the role. See [official AGENTS.md guidance](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

The supported repository skill location is `.agents/skills/<name>/SKILL.md`. Discovery walks from CWD toward the repository root, so parent skills can reach child sessions; siblings are not automatically shared, and the parent does not automatically discover child skills. Codex initially exposes skill metadata and reads full instructions when a skill is selected. `.skills` is not the documented discovery directory. See [official skill guidance](https://learn.chatgpt.com/docs/build-skills).

Local skills and namespaced profiles are now created under D-007; see [deployment.md](deployment.md). Local skills use distinct mc- names; personal skills remain unchanged. The prompt-rendering check did not establish project-only suppression of same-name skills, so this package does not rely on it. The local Launchpad skill is scoped to the Launchpad parent. Mandatory main/side behavior remains in AGENTS.

## Full Access configuration

The local `.codex/config.toml` sets `danger-full-access` and `never` per the owner's direction. Trusted project config layers load from repository root toward CWD; nearer config and higher-priority host/session policy can affect the result. A separate implementation worktree outside this ancestry does not inherit this file by proximity of purpose. Verify effective permissions for every registered session; no fresh session was launched to test inheritance here.

Sources: [project configuration](https://learn.chatgpt.com/docs/config-file/config-advanced) and [Full Access settings](https://learn.chatgpt.com/docs/sandboxing). Documentation checked 2026-09-25 UTC; installed CLI observed as 0.144.5. No global permissions or trust settings were changed.
