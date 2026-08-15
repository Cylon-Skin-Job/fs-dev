# Office Document Versioning Spec

## 1. Overview

The Office Viewer uses Fusion Studio's Universal Event Bus (UEB) and SQLite persistence to maintain recoverable document revision history, checkpoints, undo/redo fuel, and shareable workspace mirrors.

The previous local-Git approach is superseded. Git remains useful for the outer project repository, but document safety should not depend on hidden nested repositories or on the user's last Git checkpoint.

The canonical Electron database is protected infrastructure. AI may search and read it through approved app surfaces, but AI does not write to it directly. Writes to canonical state happen through user-originated UI CRUD and server-owned handlers that emit UEB events.

Repo-local mirror databases are different: they are work product. They are optional, disposable, user/AI accessible, customizable, and shareable through Git when the user chooses.

---

## 2. Goals

- Preserve every meaningful editing session as recoverable revisions and checkpoints.
- Support undo/redo and session review without relying on Git history.
- Allow recovery after destructive AI edits, even when the outer Git checkpoint is stale.
- Store versioning data in canonical SQLite tables derived from UEB document CRUD events.
- Allow repo-local mirror SQLite databases to duplicate selected canonical workspace tables for sharing and review.
- Keep mirror databases optional, disposable, configurable, and partitioned by user-machine folder to avoid Git conflicts.

## 3. Non-Goals

- Nested local Git repositories for document versioning.
- Replacing the outer project Git repository.
- AI direct-write access to the protected Electron database.
- Treating repo mirror databases as canonical state.
- Branching, pull requests, or merge workflows.
- Visual diff or blame UI inside the Office Viewer in the first implementation slice.

---

## 4. Architecture

```text
Electron app data
└── fusion.db                    ← canonical protected database
    ├── event_log                ← UEB event index / append log
    ├── documents                ← current document state/index
    ├── document_versions        ← incremental revisions
    └── document_checkpoints     ← restore-worthy milestones

Project repo
├── ai-data/
│   └── <user-machine>/
│       └── workspace.db         ← optional shareable mirror of selected canonical tables
├── ai-chat/
│   └── <user-machine>/threads/<thread-id>/CHAT.md
├── ai-runs/
│   └── <user-machine>/...
├── ai-wiki/
├── ai-issues/
├── ai-skills/
├── ai-agents/
├── ai-system/
└── ai-views/
```

### 4.1 Components

| Component | Location | Role |
|-----------|----------|------|
| `document-versioning` service | `fusion-studio-server/lib/versioning/` | Records revisions/checkpoints from document CRUD events |
| UEB event log | canonical SQLite | Append/index document CRUD events and versioning events |
| Document tables | canonical SQLite | Current document state plus revision/checkpoint history |
| Mirror DB creator | server script/service | Creates optional repo-local `ai-data/<user-machine>/workspace.db` from canonical schema/template |
| Mirror DB config table | mirror SQLite | Enables/disables mirrored modules and retention policy from inside the mirror DB |
| Office editor UI | client | Emits user-originated save/checkpoint intents through normal server handlers |

---

## 5. Revision And Checkpoint Policy

Revisions and checkpoints are recorded server-side after user-originated document CRUD passes through the UEB. The client may send a `reason` with save/checkpoint messages, but the server owns canonical version records.

### 5.1 Version Reasons

| Reason | When | Versioning Behavior |
|--------|------|---------------------|
| `autosave` | Debounced user edit save | Record incremental revision if content changed |
| `manual` | User presses save | Record incremental revision if content changed; optional checkpoint is user decision |
| `ai_edit` | AI-originated edit applied through user-approved UI path | Record revision and checkpoint |
| `document_close` | User closes/navigates away from document | Record checkpoint if content changed in session |
| `workspace_switch` | User switches workspace with dirty/recent document activity | Record checkpoint |
| `interval_checkpoint` | Every 20 revisions if no other checkpoint occurred | Record checkpoint |
| `milestone` | Export, print, share, or explicit user milestone | Record checkpoint |

### 5.2 Retention

- Keep the last 30 non-checkpoint revisions per document.
- FIFO old non-checkpoint revisions beyond the retention window.
- Preserve checkpoints even when they overlap with the last 30 revisions.
- Create an `interval_checkpoint` every 20 revisions if no other checkpoint has been created in that span.
- Checkpoints are restore-worthy semantic boundaries; revisions are fine-grained undo/session-review fuel.

### 5.3 Change Guard

The server should not record duplicate revisions when content hash, path, and relevant metadata are unchanged.

---

## 6. WebSocket Protocol

### 6.1 Client → Server

```ts
type SaveReason = 'autosave' | 'manual' | 'ai_edit' | 'document_close' | 'workspace_switch' | 'interval_checkpoint' | 'milestone';

// Existing file_save message, extended
{
  type: 'file_save',
  panel: 'office-viewer',
  path: 'specs/roadmap.md',
  content: '# Roadmap\n\n...',
  reason?: SaveReason,
  milestone?: string
}
```

### 6.2 Server → Client

`file_save_response` remains the save acknowledgement. Versioning failures should be logged and surfaced as non-fatal diagnostics; the user's save should not be lost because a revision/checkpoint write failed after the document write.

---

## 7. Client Behavior

### 7.1 `OfficeDocumentPage.tsx`

1. **Track session start** when `markdownUpdated` fires for the first time after mount.
2. **Incremental saves** send `reason: 'autosave'` or `reason: 'manual'` through the normal save path.
3. **Navigation away** calls `saveFile` with `reason: 'document_close'`.
4. **Workspace switch** sends or causes `reason: 'workspace_switch'` for dirty/recent document activity before switching context.
5. **AI edit acceptance** must pass through a user-approved UI/server path that marks the save `reason: 'ai_edit'`.
6. **Export/share handlers** send `reason: 'milestone'`, `milestone: 'export_pdf'` after saving dirty content.

### 7.2 `fileDataStore.ts`

```ts
export type SaveReason = 'autosave' | 'manual' | 'ai_edit' | 'document_close' | 'workspace_switch' | 'interval_checkpoint' | 'milestone';

saveFile: (panel: string, path: string, content: string, reason?: SaveReason, milestone?: string) => void;
```

The `sendWs` payload includes `reason` and `milestone` when provided.

---

## 8. Server Behavior

### 8.1 `lib/versioning/` Service

The versioning service subscribes to or is called from the same server-owned document save path that emits UEB document CRUD events.

Responsibilities:

- Normalize document identity: workspace id, path, document type, content hash.
- Record a `document_versions` row when content changed.
- Record a `document_checkpoints` row for checkpoint-worthy reasons.
- Maintain the last 30 non-checkpoint revisions per document with FIFO pruning.
- Preserve checkpoints even when non-checkpoint revisions are pruned.
- Emit/index versioning events so later mirror DBs can duplicate canonical rows.
- Fail non-fatally after the document save has succeeded.

### 8.2 Canonical Tables

Exact column names should align with existing Electron DB conventions, but the schema needs these logical tables:

```text
documents
  document_id
  workspace_id
  path
  document_type
  current_hash
  current_version_id
  created_at
  updated_at

document_versions
  version_id
  document_id
  workspace_id
  path
  version_number
  reason
  content_hash
  diff_kind
  diff_payload_or_ref
  snapshot_ref
  ueb_event_id
  created_at

document_checkpoints
  checkpoint_id
  document_id
  version_id
  workspace_id
  path
  reason
  label
  ueb_event_id
  created_at

undo_stack
  stack_id
  document_id
  version_id
  position
  created_at
```

### 8.3 Restore Behavior

Restore should support:

- Restore whole document to a checkpoint.
- Restore whole document to a revision.
- Inspect revision history for a session.
- Later: compare and merge another user's mirrored document revisions.

---

## 9. Workspace Mirror Database

The repo-local mirror DB is optional work product, not canonical state.

Mirror path:

```text
ai-data/<user-machine>/workspace.db
```

Rules:

- Mirror DBs use the same canonical schema where practical.
- Mirroring filters rows by workspace/module/retention instead of inventing a separate share schema.
- A `config` table inside the mirror DB controls enabled modules and retention policy.
- Default retention target is 120 days for share/review workflows.
- A size warning/hard guard may be added to avoid GitHub/GitLab file-size rejection, but 120 days is the human policy.
- User-machine partitioning avoids Git conflicts between collaborators.
- AI and users may read, modify, delete, and regenerate mirror DBs because they are repo work product.

Example mirror use:

```text
ai-data/Josh-HomePC/workspace.db
ai-chat/Josh-HomePC/threads/<thread-id>/CHAT.md
```

A user can ask an assistant to inspect Josh's mirror DB, follow links to chat markdown, inspect document revisions, and compare snapshots against local state.

---

## 10. Files to Create / Modify

| File | Action | Change |
|------|--------|--------|
| `fusion-studio-server/lib/versioning/` | **Create** | Versioning service, diff/snapshot helpers, retention logic |
| SQLite migrations | **Create** | `documents`, `document_versions`, `document_checkpoints`, `undo_stack` |
| Document save handlers | **Modify** | Emit/index UEB document CRUD events and call versioning service |
| Mirror DB script/service | **Create** | Create `ai-data/<user-machine>/workspace.db` from canonical schema/template and copy selected rows |
| `client/src/state/fileDataStore.ts` | **Modify** | Add `SaveReason` type; accept `reason` and `milestone` in `saveFile` |
| `client/src/components/office/OfficeDocumentPage.tsx` | **Modify** | Pass `reason` on close, workspace switch, AI edit acceptance, and exports |

---

## 11. Out of Scope

The following may be built later but are **not part of this spec**:

- GitLab remote configuration, push, or pull
- Ticket / issue generation from version events
- Visual version history browser inside Office Viewer
- Conflict resolution UI
- Branching or merge workflows
- Binary artifact storage design beyond content hashes or external snapshot refs

---

## 12. Open Questions

1. Should `manual` save create only a revision, or should users be able to opt into manual checkpoints?
2. Should revision diff payloads live inline in SQLite, as external refs, or hybrid by size/type?
3. Should deleted files create tombstone versions/checkpoints?
4. What exact tables/modules belong in the default workspace mirror template?
5. Should mirror DB size guardrails be warnings only, hard stops, or both?
