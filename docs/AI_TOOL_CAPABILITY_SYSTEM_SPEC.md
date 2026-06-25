# AI Tool Capability System Spec

**Status:** Draft  
**Owner:** Fusion Studio core / System_Manager agent  
**Related:** `docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md`, `docs/CLI_CONFIG_SPEC.md`, `docs/AI_WORKSPACE_TEMPLATE_V2_SPEC.md`  
**Primary goal:** Design the reusable assistant-callable tool system before implementing workspace creation, calendar/email tools, database tools, or ad-hoc custom tools.

---

## 1. Purpose

Fusion Studio needs a repeatable paradigm where AI assistants can call tools, but tool access is scoped by workspace, agent, and policy.

The first concrete workflow is workspace creation from the System Viewer:

```text
User clicks New Workspace
→ UI collects mode, display name, and path
→ System_Manager chat starts with a structured request
→ /create-workspace skill runs
→ assistant calls workspace tools
→ tool returns confirmation
→ assistant validates registered workspaces
→ assistant asks whether to add views and what the workspace will be used for
```

This spec generalizes that pattern so it can also support future tools:

- calendar read/write
- email draft/search/send workflows
- SQLite/database query tools
- view management tools
- skill/tool creation tools
- system maintenance tools
- ad-hoc user-created tools

---

## 2. Core Principle

Tools are backend capabilities. Skills are assistant instructions. Policies decide which agents can see and call which tools.

```text
Tool implementation  → executable backend function
Tool manifest        → schema, permissions, risk, confirmation rules
Tool registry        → discovered catalog of all installed tools
Tool grant           → workspace/agent-specific allowed tool set
Skill                → assistant-facing workflow that uses tools
Delegation policy    → where forbidden/system-level requests get routed
Audit log            → immutable record of tool calls and outcomes
```

The UI should gather intent and present state. It should not contain system workflow logic.

---

## 3. Non-Goals

- Do not build a general arbitrary-code execution sandbox in the first pass.
- Do not let normal workspace agents mutate system-level tool or skill policy.
- Do not make tools depend on React stores, UI modals, or browser state.
- Do not give ad-hoc custom tools immediate execution rights after generation.
- Do not route all tools through shell commands if a server service already exists.
- Do not make tool policy hardcoded in assistant prompts.

---

## 4. Terminology

| Term | Meaning |
|---|---|
| Tool | Assistant-callable backend capability with a manifest and implementation. |
| Skill | Markdown instruction/workflow used by an assistant to accomplish a task. |
| Grant | Config that allows a workspace or agent to use specific tools. |
| Delegation | Policy that says a disallowed action should be referred to another workspace/agent. |
| System agent | The assistant running in System_Manager with system-level grants. |
| Custom tool | A user/assistant-created tool that must be drafted, validated, registered, and granted. |
| Risk class | Tool safety category such as read, write, external-write, system-write, destructive. |

---

## 5. Target Folder Layout

System_Manager owns the canonical global tool and skill source:

```text
System_Manager/
  Tools/
    registry.json
    workspace/
      list-workspaces.tool.json
      list-workspaces.js
      create-workspace.tool.json
      create-workspace.js
      add-existing-workspace.tool.json
      add-existing-workspace.js
    views/
      list-view-templates.tool.json
      add-view.tool.json
    calendar/
      list-events.tool.json
      create-event.tool.json
    email/
      search-mail.tool.json
      create-draft.tool.json
    db/
      query-readonly.tool.json
    custom/
      my-custom-tool/
        tool.json
        implementation.js
        README.md
  Skills/
    create-workspace/
      SKILL.md
    tool-author/
      SKILL.md
  Policies/
    tool-grants/
      system-source-files.json
      default-workspace.json
```

Each workspace can declare its local grants and local skill enablement:

```text
{workspace}/
  ai/
    system/
      config/
        tools.json
        skills.json
```

For v2 machine-scoped workspaces:

```text
{workspace}/
  ai/<machine>/
    System/
      config/
        tools.json
        skills.json
```

The resolver must use `workspace/ai-paths.js` helpers rather than hardcoding legacy `ai/system` paths.

---

## 6. Server Module Layout

```text
fusion-studio-server/lib/assistant-tools/
  index.js
  registry-loader.js
  manifest-schema.js
  grant-resolver.js
  runner.js
  confirmation-policy.js
  delegation-policy.js
  audit-log.js
  context-builder.js
  adapters/
    workspace-tools.js
    view-tools.js
    calendar-tools.js
    email-tools.js
    db-tools.js
    custom-tool-runner.js
```

File jobs:

| File | Job |
|---|---|
| `index.js` | Public API. Exports `listTools`, `resolveToolsForAgent`, `runTool`. |
| `registry-loader.js` | Discovers tool manifests from System_Manager and optional workspace-local tool folders. |
| `manifest-schema.js` | Validates manifest shape and input schema metadata. |
| `grant-resolver.js` | Computes effective tool access from global, workspace, and agent config. |
| `runner.js` | Executes allowed tools and normalizes results. |
| `confirmation-policy.js` | Decides whether user confirmation is required before execution. |
| `delegation-policy.js` | Resolves disallowed requests to a target workspace/agent. |
| `audit-log.js` | Persists tool call attempts, inputs metadata, result, caller, and policy decision. |
| `context-builder.js` | Builds safe tool context: workspace root, agent id, grants, service clients, audit handle. |
| `adapters/*` | Thin wrappers around existing backend services. |

---

## 7. Tool Manifest

Each tool has a manifest. The manifest is data, not executable code.

Example:

```json
{
  "schemaVersion": 1,
  "id": "workspace.create",
  "name": "Create Workspace",
  "description": "Create and register a new Fusion Studio workspace.",
  "namespace": "workspace",
  "implementation": "workspace/create-workspace.js",
  "entrypoint": "run",
  "inputSchema": {
    "type": "object",
    "required": ["displayName", "path", "mode"],
    "properties": {
      "displayName": { "type": "string" },
      "path": { "type": "string" },
      "mode": { "type": "string", "enum": ["new-folder", "existing-folder"] },
      "viewIds": { "type": "array", "items": { "type": "string" } }
    }
  },
  "permissions": ["workspace:create", "workspace:register"],
  "risk": "system-write",
  "confirmation": "required",
  "ownerWorkspaceId": "system-files",
  "auditable": true,
  "enabledByDefault": false
}
```

Required fields:

| Field | Meaning |
|---|---|
| `schemaVersion` | Manifest schema version. Start at `1`. |
| `id` | Stable tool id, namespace-qualified. |
| `name` | Human-readable label. |
| `description` | Assistant-facing concise behavior summary. |
| `namespace` | Group such as `workspace`, `views`, `calendar`, `email`, `db`, `system`. |
| `implementation` | Path relative to the tool package root or adapter id. |
| `entrypoint` | Exported function to call. Defaults to `run`. |
| `inputSchema` | JSON-schema-like input contract. |
| `permissions` | Permission atoms required by policy. |
| `risk` | Risk class used by confirmation and grant policy. |
| `confirmation` | `none`, `required`, or `policy`. |
| `ownerWorkspaceId` | Workspace that owns the tool. System tools use `system-files`. |
| `auditable` | Whether calls must be recorded. Defaults to true. |
| `enabledByDefault` | Whether default grants may include it automatically. |

---

## 8. Tool Implementation Contract

Every tool implementation exports an async `run(input, context)` function.

```js
async function run(input, context) {
  return {
    ok: true,
    data: {},
    summary: 'Workspace created and registered.'
  };
}

module.exports = { run };
```

Failure shape:

```js
return {
  ok: false,
  error: {
    code: 'WORKSPACE_PATH_EXISTS',
    message: 'The target folder already exists.'
  },
  recoverable: true
};
```

Tool context shape:

```ts
interface ToolContext {
  toolId: string;
  caller: {
    workspaceId: string;
    agentId: string;
    threadId: string | null;
  };
  workspace: {
    id: string;
    root: string;
    type: string;
  };
  grants: {
    permissions: string[];
    riskLimit: string;
  };
  services: {
    workspace: object;
    views: object;
    db: object;
    calendar?: object;
    email?: object;
  };
  audit: {
    append: (event: object) => Promise<void>;
  };
}
```

Rules:

- Tools call backend services, not UI stores.
- Tools receive only the services they are allowed to use.
- Tools return structured results, not arbitrary console output.
- Tools never directly modify grants or manifests unless they are policy-authoring tools granted only to System_Manager.
- Tools must be idempotent where practical or return enough metadata for the assistant to recover.

---

## 9. Grant Config

Workspace grants decide which tools are visible and callable.

Example default workspace grant:

```json
{
  "schemaVersion": 1,
  "workspaceId": "default",
  "tools": {
    "workspace.list": true,
    "workspace.create": false,
    "workspace.addExisting": false,
    "views.listTemplates": true,
    "calendar.list": true,
    "calendar.createEvent": false,
    "db.queryReadonly": false,
    "tool.install": false,
    "tool.modifyPolicy": false
  },
  "riskLimit": "read",
  "delegations": {
    "system-write": {
      "targetWorkspaceId": "system-files",
      "targetAgentId": "system-agent"
    },
    "tool-authoring": {
      "targetWorkspaceId": "system-files",
      "targetAgentId": "system-agent"
    }
  }
}
```

System_Manager grant:

```json
{
  "schemaVersion": 1,
  "workspaceId": "system-files",
  "tools": {
    "workspace.list": true,
    "workspace.create": true,
    "workspace.addExisting": true,
    "views.listTemplates": true,
    "views.add": true,
    "tool.draft": true,
    "tool.validate": true,
    "tool.register": true,
    "tool.grant": true,
    "skill.create": true
  },
  "riskLimit": "system-write"
}
```

Effective permissions are the intersection of:

```text
global tool enabled
∩ tool manifest constraints
∩ workspace grant
∩ agent grant
∩ runtime confirmation/safety policy
```

---

## 10. Agent Config

Workspace config grants broad capability. Agent config can further narrow it.

```json
{
  "schemaVersion": 1,
  "agents": {
    "system-agent": {
      "tools": {
        "workspace.create": true,
        "tool.register": true
      },
      "riskLimit": "system-write"
    },
    "workspace-assistant": {
      "tools": {
        "workspace.list": true,
        "calendar.list": true
      },
      "riskLimit": "read"
    }
  }
}
```

If no agent-specific file exists, the agent inherits the workspace grant.

---

## 11. Delegation Model

When a normal workspace agent receives a disallowed request, it should not fail silently or improvise. It should produce a delegation request.

Example:

```json
{
  "type": "delegation.requested",
  "fromWorkspaceId": "fs-dev",
  "fromAgentId": "workspace-assistant",
  "targetWorkspaceId": "system-files",
  "targetAgentId": "system-agent",
  "reason": "system-write",
  "request": "Create a new workspace named Media Lab at ~/projects/media-lab"
}
```

Initial UX can be simple:

```text
I cannot perform system-level workspace creation from this workspace.
I can hand this to the System_Manager agent.
```

Later UX can auto-open or queue the System_Manager chat.

---

## 12. Assistant Tool Call Flow

Runtime flow:

```text
assistant emits tool call
→ server receives tool call
→ registry resolves manifest
→ grant resolver checks caller/workspace/agent
→ confirmation policy checks risk
→ runner validates input schema
→ runner builds tool context
→ implementation runs
→ audit log records result
→ normalized result returns to assistant
```

Result returned to assistant:

```json
{
  "toolId": "workspace.list",
  "ok": true,
  "summary": "6 registered workspaces found.",
  "data": {
    "workspaces": []
  }
}
```

Denied result:

```json
{
  "toolId": "workspace.create",
  "ok": false,
  "error": {
    "code": "TOOL_NOT_GRANTED",
    "message": "workspace.create is not granted to this workspace agent."
  },
  "delegation": {
    "targetWorkspaceId": "system-files",
    "targetAgentId": "system-agent"
  }
}
```

---

## 12a. Harness Exposure Boundary

Fusion Studio supports multiple harness styles over time. The tool system must not be hardcoded to one provider's tool-call format.

Boundary:

```text
harness-specific tool event
→ canonical Fusion tool call event
→ assistant-tools runner
→ canonical tool result event
→ harness/client stream renderer
```

The canonical tool call shape should be independent of OpenCode, ACP, Kimi, Gemini, or any future CLI protocol:

```json
{
  "type": "fusion.tool_call",
  "toolCallId": "call-...",
  "threadId": "2026-...",
  "workspaceId": "system-files",
  "agentId": "system-agent",
  "toolId": "workspace.list",
  "input": {}
}
```

Canonical tool result:

```json
{
  "type": "fusion.tool_result",
  "toolCallId": "call-...",
  "toolId": "workspace.list",
  "ok": true,
  "summary": "6 registered workspaces found.",
  "data": {}
}
```

Harness adapters own translation between provider-specific tool syntax and Fusion's canonical event. The assistant tool runner only accepts canonical calls.

Rules:

- Do not expose raw server functions directly to harness adapters.
- Do not let harness-specific code perform grant checks.
- Grant checks, confirmation policy, execution, and audit stay in `lib/assistant-tools/runner.js` and its collaborators.
- The renderer displays canonical tool events and does not decide whether a call is allowed.

---

## 13. Confirmation Policy

Confirmation is separate from grants. A tool can be granted but still require user confirmation.

Risk classes:

| Risk | Examples | Default confirmation |
|---|---|---|
| `read` | list workspaces, list view templates, read calendar events | none |
| `write` | edit local workspace files, add view | required or policy |
| `external-write` | create calendar event, create email draft, send Slack message | required |
| `secret-read` | access token value | required and system-only |
| `system-write` | create workspace, grant tools, install tools | required |
| `destructive` | delete workspace, remove tool, erase calendar item | required plus explicit target echo |

First pass can return `confirmationRequired` to the assistant and rely on chat confirmation. Later, a native confirmation UI can be added.

---

## 14. Audit Log

Every tool call attempt should be auditable, including denied calls.

Minimum fields:

```json
{
  "id": "toolcall-...",
  "timestamp": 1760000000000,
  "toolId": "workspace.create",
  "workspaceId": "system-files",
  "agentId": "system-agent",
  "threadId": "2026-...",
  "decision": "allowed",
  "risk": "system-write",
  "inputSummary": {},
  "resultSummary": {},
  "ok": true,
  "errorCode": null
}
```

Do not store raw secret values in audit logs.

Potential storage:

- first pass: SQLite table in `fusion.db`
- later: mirror summaries to `ai/<machine>/Data/Runs/` or `Data/Workspace-db/`

---

## 15. Workspace Creation Workflow

System Viewer `Create` should not directly call backend workspace creation. It starts a System_Manager chat with structured intent.

Prompt template:

```text
Add a Workspace
Display Name: "{{displayName}}"
Mode: "{{new-folder|existing-folder}}"
Path: "{{path}}"

Use /create-workspace
```

Skill workflow:

```text
1. Parse display name, mode, path.
2. Validate required fields.
3. If mode is new-folder, call workspace.create.
4. If mode is existing-folder, call workspace.addExisting.
5. Call workspace.list.
6. Verify the expected workspace appears.
7. Report confirmation to the user.
8. Ask whether to add any views.
9. Offer to discuss what the workspace will be used for.
10. If user agrees, recommend view templates and call views.add as needed.
```

Initial tools:

| Tool | Purpose |
|---|---|
| `workspace.list` | List registered workspaces. |
| `workspace.create` | Create a new folder, scaffold `ai/`, register it. |
| `workspace.addExisting` | Register an existing folder and bootstrap/validate `ai/`. |
| `views.listTemplates` | Return available view templates. |
| `views.add` | Add a selected view template to a workspace. |

---

## 16. Existing Scripting To Tool Migration

Do not duplicate existing services. Tool adapters should wrap existing modules.

Existing sources:

| Existing module | Tool adapter use |
|---|---|
| `lib/workspace/create-service.js` | scaffolding new workspace folders and templates |
| `lib/workspace/workspace-controller.js` | lifecycle orchestration, active workspace behavior |
| `lib/workspace/registry-service.js` | list/add/remove registered workspaces |
| `lib/views/workspace-registry-writer.js` | add/restore/update view registry |
| `lib/workspace/ai-paths.js` | v1/v2 `ai` path resolution |

Adapter rule:

```text
Tool adapter → existing service/query module → filesystem/DB/API
```

Never:

```text
Tool adapter → UI modal
Tool adapter → React store
Tool adapter → fake WebSocket message unless no service boundary exists yet
```

If a useful workflow only exists as a WebSocket handler, extract the underlying service first.

---

## 17. Ad-Hoc Custom Tools

Ad-hoc custom tools are allowed, but they have a lifecycle.

```text
draft → validate → register-disabled → grant → execute → audit
```

Draft output:

```text
System_Manager/Tools/custom/<tool-id>/
  tool.json
  implementation.js
  README.md
```

Validation checks:

- manifest schema valid
- input schema valid
- implementation exports `run`
- declared permissions match imports/capabilities
- no forbidden imports unless explicitly allowed
- no raw filesystem/network/secrets access unless declared
- no shell execution unless tool risk and grant allow it

Registration:

- adds tool to registry as disabled
- writes audit entry
- requires System_Manager grant

Granting:

- modifies workspace/agent `tools.json`
- requires System_Manager grant
- writes audit entry

Execution:

- same tool runner as built-in tools
- no special bypass because it is custom

---

## 18. Skill Creation

Tools do work. Skills teach the assistant how to sequence tools.

Skill folder example:

```text
System_Manager/Skills/create-workspace/
  SKILL.md
```

`SKILL.md` should include:

- when to use the skill
- required input fields
- tool sequence
- validation steps
- user confirmation language
- recovery behavior
- delegation behavior

Normal workspaces can receive skill grants without receiving the underlying tools. In that case the skill may instruct the assistant to delegate system-level operations.

---

## 19. Security And Safety

Rules:

- Tool manifests are declarative and validated before registration.
- Tool implementations are not trusted just because they exist on disk.
- Normal workspace agents cannot grant themselves tools.
- System_Manager agent is the only initial policy-authoring agent.
- Secret values never appear in tool results unless the tool is secret-specific, confirmed, and system-granted.
- Destructive tools require explicit target echo confirmation.
- All tool calls are audited.
- Tool outputs must be structured and bounded.

Custom tool sandboxing is future work. First pass should restrict custom tools to reviewed/registered CommonJS modules with import validation and conservative grants.

---

## 20. Client/UI Responsibilities

The UI can:

- collect intent
- show available choices
- launch a chat with structured prompt
- show confirmation states
- display tool results/audit summaries later

The UI should not:

- decide tool permissions
- execute tools directly
- modify tool grants directly
- embed workflow logic that belongs in a skill

System Viewer New Workspace first-pass behavior:

```text
Create button → send structured message to System_Manager chat → close overlay or keep until chat opens
```

Implementation detail to decide later: whether the chat is opened in the current System_Manager workspace immediately or queued if another workspace is active.

---

## 21. Open Decisions

1. Tool invocation protocol from harness output to server runner: reuse current canonical tool-call stream, add Fusion-specific tool namespace, or both?
2. Confirmation UX: chat-only confirmation first, or native confirmation overlay for risk >= write?
3. Custom tool validation depth in first pass: static import scan only, or execute in a constrained child process?
4. Registry hot reload: startup only initially, or watch `System_Manager/Tools/`?
5. How should delegated requests appear in System_Manager: new thread, notification, queued ticket, or immediate chat message?
6. Should workspace-local custom tools be allowed, or should all custom tools live under System_Manager initially?
7. Should tool grants be file-based only, DB-backed only, or file source with DB cache?

---

## 22. Rollout Plan

### Phase 0: Spec And Contracts

- Land this spec.
- Decide manifest schema and grant config paths.
- Decide initial tool ids and skill names.

### Phase 1: Read-Only Registry

- Add `assistant-tools` module skeleton.
- Load manifests from `System_Manager/Tools/`.
- Validate manifests.
- Add `workspace.list` tool.
- Add `tool.list` debug/admin endpoint or internal test harness.
- Add audit logging for tool attempts.

### Phase 2: System_Manager Grants

- Add grant resolver.
- Add System_Manager grant config.
- Verify normal workspace agents cannot call system-write tools.
- Return delegation metadata for denied calls.

### Phase 3: Workspace Creation Tools

- Add `workspace.create` adapter around `create-service` + registry service.
- Add `workspace.addExisting` adapter.
- Add `views.listTemplates` and `views.add`.
- Add `/create-workspace` skill.
- Wire System Viewer Create button to start System_Manager chat with structured prompt.

### Phase 4: Confirmation And Audit UI

- Implement confirmation policy for write/system-write tools.
- Add audit list in System Viewer or a dedicated System tool page.

### Phase 5: Ad-Hoc Tool Authoring

- Add `tool.draft`, `tool.validate`, `tool.register`, `tool.grant` tools.
- Add `tool-author` skill.
- Keep custom tools disabled by default until explicitly granted.

### Phase 6: More Tool Namespaces

- Calendar tools.
- Email tools.
- Read-only DB query tools.
- External integration tools.

---

## 23. Acceptance Criteria

The first complete implementation is successful when:

- Tools are discovered from manifests under System_Manager.
- Tool availability is scoped by workspace and agent grants.
- Denied system-level calls return delegation metadata.
- System_Manager agent can call `workspace.list`.
- System_Manager agent can create/register a workspace via tool call.
- The assistant verifies creation by calling `workspace.list` afterward.
- The assistant asks whether to add views and can call view tools if confirmed/granted.
- Tool calls are audited.
- Normal workspace agents cannot create workspaces directly.
- Ad-hoc custom tools can be drafted and validated but not executed until registered and granted.
