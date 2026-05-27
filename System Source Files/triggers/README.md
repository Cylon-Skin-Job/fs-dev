# Trigger Definitions

Event trigger templates that ship with Fusion Studio.

Triggers define automated actions that run in response to workspace events (file save, AI completion, checkpoint created, etc.).

Each trigger should include:
- `trigger.yaml` — Front matter: name, summary (paragraph max), function explanations, event conditions
- `action/` — Script or command to execute when triggered

**Front matter standard:** Triggers use YAML front matter with name + summary for discoverability and AI searchability.
