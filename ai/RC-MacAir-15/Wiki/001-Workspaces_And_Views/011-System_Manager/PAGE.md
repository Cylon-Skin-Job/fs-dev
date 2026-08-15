---
name: System Manager
description: Defines System Manager as the protected view/workspace surface for system-level prompts, triggers, tools, skills, and delegated changes.
metadata:
  incoming-edges:
    - Workspaces And Views
    - View Architecture
    - Workspace Paradigm
  outgoing-edges:
    - Chat System
    - Wiki View
    - Code Standards
  source-files:
    - fusion-studio-client/src/components/SystemViewer.tsx
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/resources/resolver.js
    - fusion-studio-server/lib/workspace/create-service.js
  connected-skills: []
  related-trigger-files: []
---

System Manager is the protected system-level workspace/view surface in Fusion Studio.

From the application code perspective, System Manager is a view/workspace target that can load system-backed prompt files, expose system wiki guidance, and receive delegated requests from normal workspace agents. It should not duplicate the operational System Manager wiki content inside `fs-dev`; that detailed guidance lives in the `System_Manager` workspace itself.

## Boundary

Normal workspace agents can read system documentation and request system-level changes, but they should not directly edit protected system files.

Protected system files include:

- Prompt files that can grant or guide tool scope.
- `TRIGGERS.md` or trigger-like files that can execute scripting behavior.
- Tool and skill definitions.
- System-wide templates, connector configuration, and cross-workspace automation rules.

These files can indirectly create unsafe behavior if edited by a local agent. For example, a trigger could fetch secrets, pass them into a prompt, run an unsafe script, or send data outside the system without clear user awareness.

## Delegation Flow

When a normal workspace agent wants a protected change, it should file or send a System Manager request instead of editing directly.

The request should include:

- The source workspace and thread.
- The user request or relevant chat history.
- The proposed file path.
- The proposed create/update/delete operation.
- A summary of intended behavior.
- The proposed diff, replacement strings, or generated file body.
- Any claimed user approval context.

System Manager then evaluates the request and returns one of the governed outcomes:

- `blocked`: unsafe, under-specified, or outside policy.
- `approval_needed`: plausible but requires explicit user approval.
- `instituted`: safe enough under policy and applied by System Manager.

## Trigger Requests

A future `request_trigger` tool should behave like a tool call from the local agent's perspective, but it should not directly write trigger files.

Instead, it sends a structured request to System Manager. System Manager reviews the requested trigger, checks the source thread, decides whether the user clearly approved the behavior, and either blocks it, asks for approval, or applies it.

Trigger definitions should be kept narrow. Prefer triggers that wake, evaluate criteria, fetch bounded information, and pass well-scoped context to a deterministic custom tool. Avoid broad triggers that can arbitrarily script system behavior.

## Approval UI Direction

If System Manager prepares a protected change, the user should be able to review it before application.

Useful approval surfaces include:

- An inline `Approve` action with a concise summary.
- A click-to-view file or diff preview.
- A clear description of what the trigger/tool/prompt will be able to do.
- A record of why System Manager believes the user asked for the change.

## Example Pattern

A user might ask for a recurring workflow that finds recent music videos in a genre, checks what is buzzworthy, compares results against listening history, and returns a curated list.

The safe shape is not an open-ended trigger that can do anything. The safer shape is:

- A narrow trigger decides when the workflow should wake.
- Deterministic search tools fetch bounded YouTube/catalog results.
- Deterministic verification confirms candidate existence and metadata.
- The assistant ranks results using a prompt and a local preference ledger.
- The preference ledger updates from user feedback over time.
- Any new trigger behavior is requested through System Manager approval.

This keeps automation composable while preserving user awareness and system-level review.
