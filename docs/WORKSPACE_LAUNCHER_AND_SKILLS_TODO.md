---
name: Workspace Launcher And Skills TODO
description: Working todo list for New Workspace launchers, global workspace setup skills, composer preloads, and System Manager handoff boundaries.
metadata:
  incoming-edges:
    - System Manager
    - Workspaces And Views
  outgoing-edges:
    - RCC-0103
    - RCC-0104
  source-files:
    - fusion-studio-client/src/lib/chat-action.ts
    - fusion-studio-client/src/components/chat/useChatArea.ts
    - fusion-studio-client/src/components/ChatInput.tsx
    - fusion-studio-server/lib/prompts/prompt-registry.js
  connected-skills: []
  related-trigger-files: []
---

# Workspace Launcher And Skills TODO

Working list before compaction. This captures the current direction so we can return to implementation without losing the design thread.

## External Skill Paradigm Note

OpenRouter examples use directory-based skills with `SKILL.md` files.

Observed pattern:

- Skills are discovered from folders containing `SKILL.md`.
- Startup/session context can see lightweight metadata such as name and description.
- Full skill body is loaded on demand through a skill-loading tool/context mutation.
- The loaded skill is injected into subsequent model turns, often with a marker to prevent duplicate loading.
- Related scripts/references are discovered but should be used through explicit runtime/tool paths, not blindly injected.

Fusion Studio should match the same progressive-disclosure idea:

- Global skills expose lightweight metadata at session start.
- Full skill content loads when matched by slash command, keyword/phrase match, BM25/vector retrieval, button metadata, or assistant request.
- Reference/wiki files load only when needed.

## Current Direction

We are building a shared system for passing user-intended information into chat:

- Ongoing chat or new chat.
- Suggested ghost text, real inserted text, or immediately sent text.
- Raw content or markdown-backed launcher content.
- Callable by UI buttons, hooks, small local models, and future workflow nudges.

This is not the hidden system prompt layer. It is user-visible composer/session input on the user's behalf.

## Naming Decisions To Apply

- Reserve `Prompts` for actual model prompts, background agent prompts, or one-off API call prompts.
- Rename markdown-backed user-entry artifacts from `Prompts` to `Launchers`.
- Use `LAUNCH.md` for launcher files.
- Use `launcher-id` in frontmatter.
- Use `launcherId` in client/server action payloads.
- Keep `Skills` as global matching/routing/reasoning artifacts.

Proposed structure:

```text
System_Manager/
  Launchers/
    Workspace Manager/
      Workspace Creation/
        LAUNCH.md
```

## Global Skill Work

Create a global skill, not System Manager-scoped, for workspace setup and view configuration.

Candidate skill name:

```text
workspace-view-setup
```

Purpose:

- Help any assistant answer “How do I set up a new workspace?”
- Guide workspace purpose discovery.
- Explain workspace/view structure.
- Help the user choose core views.
- Defer protected system-level changes to System Manager where needed.

Skill should reference subtopics/resources:

- `add-remove-views`
- `add-remove-workspace-folder`
- `appearance-and-behaviour`
- `create-custom-view`

Possible additional subtopics:

- `workspace-purpose-and-shape`
- `workspace-template-selection`
- `workspace-onboarding-tickets`
- `workspace-agent-and-tool-boundaries`
- `system-manager-delegation`

## Composer Action Work

Current action modes exist for:

- current insert
- current send
- new preload
- new send

Add suggested/ghost preload behavior:

- Gray text in composer.
- Disappears if user types.
- Enter sends it.
- Tab accepts it or moves cursor to end and makes it real text.
- Available to buttons, end-turn hooks, Qwen/local-model suggestions, and server nudges.

Default for nudges/hooks/models should be suggest, not send.

## New Workspace Button / Modal

Replace the two ribbon buttons with one button:

```text
New Workspace
```

Behavior:

- Opens a modal similar to the current System Manager/System Viewer modal.
- No chat icon in the button.
- Modal supports new folder or existing folder.
- Modal gathers minimal setup information.
- Completing modal creates/registers workspace and inserts minimum `ai/` folder structure.
- App auto-switches to the new workspace after creation.
- New workspace initially gets the four basic views.

After creation, prefill/suggest:

```text
Help me customize this workspace.
```

This should be a gentle nudge, not an automatic action.

## Workspace Creation Flow

Near-term implementation shape:

1. User clicks `New Workspace`.
2. Modal collects new/existing folder and name.
3. Server creates folder or registers chosen folder.
4. Server inserts minimum `ai/` structure.
5. Server adds basic views.
6. App switches to new workspace.
7. Composer receives suggested ghost text: `Help me customize this workspace.`
8. Global `workspace-view-setup` skill can match if user sends/continues.

## Onboarding Ticket

Design an onboarding ticket for new workspaces.

Place it in the new workspace template issues folder so newly created workspaces can start with a helpful task.

Future direction:

- Drop `@notify` tickets into the new workspace.
- Use tickets as gentle nudges rather than hidden automation.
- Keep first-run guidance visible and user-directed.

## Tool / Script Work

Give the assistant a tool or script to list and inspect newly created workspaces manually.

Need capabilities like:

- List registered workspaces.
- Show active workspace.
- Show workspace path and view list.
- Confirm new workspace scaffold exists.

This should support debugging and assistant guidance without granting broad mutation power.

## Rename Existing Prompt System

Rename current prompt-backed implementation to launcher-backed implementation.

Tasks:

- Move `System_Manager/Prompts/Workspace Manager/.../PROMPT.md` to `System_Manager/Launchers/Workspace Manager/.../LAUNCH.md` if we keep markdown-backed launch content.
- Change frontmatter from `prompt-id` to `launcher-id`.
- Rename server `prompt-registry.js` to launcher registry or add a new launcher registry and retire prompt-specific usage for this path.
- Rename WebSocket messages from `prompt:resolve` to `launcher:resolve` if the action uses launcher files.
- Keep model/background prompt handling separate under `Prompts`.

## What Stays In System Manager

System Manager keeps the detailed operational wiki and protected-change policy.

It owns:

- Protected system prompts/launchers.
- System-level triggers.
- Tool and skill definition changes.
- Connector configuration changes.
- Inbound protected-change tickets from other workspaces.

Normal workspace agents can read, request, and file tickets, but protected edits require System Manager approval or execution.

## Related Future Ticket

Protected trigger/prompt/tool approval system captured in:

```text
ai/views/issues-viewer/inbox/RCC-0104.md
```

## Open Questions

- Should `workspace-view-setup` live in `System_Manager/skills/`, `System_Manager/Skills/`, or a global skills registry folder?
- Should launchers be globally available, workspace-local, or both?
- Should the New Workspace modal create/register directly first, or should it remain assistant-guided until tools/grants are finished?
- What exact four basic views should every new workspace get?
- How much of the onboarding ticket should be static template text vs generated from selected workspace purpose?
- What event name should server nudges use: `composer:action`, `composer:suggest`, or continue through the existing client `chat-action` event?
