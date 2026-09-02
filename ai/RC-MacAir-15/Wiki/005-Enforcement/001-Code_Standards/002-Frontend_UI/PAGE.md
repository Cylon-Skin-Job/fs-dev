---
name: Frontend UI Standards
description: Rules for UI components, composer/reply chrome, user intents, and presentation boundaries.
metadata:
  incoming-edges:
    - Code Standards
  outgoing-edges:
    - Architecture Routing
    - State Management Standards
    - Chat Styling And Workspace CSS
  source-files:
    - fusion-studio-client/src/components/
    - fusion-studio-client/src/lib/chat-action.ts
  connected-skills: []
  related-trigger-files: []
---

Use this page before changing React components, chat chrome, buttons, menus,
toolbar controls, or visible user workflows.

## Rule

UI presents state and emits canonical user intent. It does not interpret backend,
harness, provider, or persistence details.

Reusable presentation components receive all durable identity and behavior
through props. Connected feature hosts and controller hooks may read established
stores and actions, then adapt them into that explicit component contract.

## Allowed Responsibilities

- render state from stores and props
- manage local visual state such as modal open/closed
- emit user intents through the existing frontend bridge or WebSocket client
- disable controls for generic UI conditions, such as no current thread,
  inactive chat, active turn, or unavailable socket
- use shared component and CSS patterns already present in the same surface

## Forbidden Responsibilities

- inspect provider-specific fields to decide product behavior
- call backend services or APIs directly from presentation components
- mutate global store outside established store actions
- create one-off browser events for a domain that already has an action bridge
- duplicate backend validation rules in the UI
- place thread/session actions under per-message chrome when the action affects
  the whole thread

## User Intent Naming

Use product vocabulary in UI code. Provider vocabulary belongs in adapters.

Examples:

| Product intent | UI label may say | Adapter may translate to |
|---|---|---|
| `move_chat_to_side` | Move Chat to Side Chat | Fusion-owned group mutation; no adapter call |
| `compact` | Compress context | OpenCode `--command compact` |

## Chat identity and action scope

- `viewId` owns placement in a view.
- `threadGroupId` owns the visible rail row and group actions such as rename,
  collection assignment/clear, delete, and Move Chat to Side Chat.
- `threadId` owns one transcript, composer, runtime, usage state, and live route.
- `surfaceId` owns transient DOM, menu, focus, and mounted-instance state.

Do not derive one identity from whichever global chat happens to be selected.
The same chat component must be able to render a primary chat or a side-chat tab
from an explicit identity contract.

## Shared menu semantics

New or migrated context menus, kebab menus, and nested action menus use the
shared menu module under `src/components/menu/`. One descriptor tree should
serve every invocation gesture for the same menu, including right-click and a
visible button. Do not recreate outside-click, focus restoration, submenu
positioning, pending-action, or keyboard behavior in a feature component.

Use semantic selection kinds:

- `radio` for one mutually exclusive value;
- `checkbox`/`menuitemcheckbox` for independently selectable values; and
- `action` for commands such as clearing all selections.

Several visually checked values must never be exposed as radio items. Shared
visual checkmarks do not override the selection semantics communicated to
assistive technology.

## Required Checks

- What existing component owns this chrome?
- Is the action per-message, per-thread, per-workspace, or app-wide?
- Does the UI send canonical intent rather than provider syntax?
- Is disabled state generic, not provider-specific?
- Does the visible placement match the action scope?
- Does a reusable component receive explicit identity and callbacks from a connected host?

## Related Pages

- [Code Standards](../000-Code_Standards/PAGE.md)
- [Architecture Routing](../001-Architecture_Routing/PAGE.md)
- [State Management Standards](../003-State_Management/PAGE.md)
- [Chat Styling And Workspace CSS](../../003-Chat_Styling_And_Workspace_CSS/PAGE.md)
- [Reply Action Chrome](../../../007-Chat_System/004-Chat_UI/004-Reply_Action_Chrome/PAGE.md)
- [Composer](../../../007-Chat_System/004-Chat_UI/001-Composer/PAGE.md)
