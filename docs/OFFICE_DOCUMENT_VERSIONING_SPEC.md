# Office Document Versioning Spec

## 1. Overview

The Office Viewer maintains a **local Git repository** inside `ai/views/office-viewer/content/` for lightweight, automatic document versioning. Commits are created transparently as the user works — no manual `git` interaction is required.

This spec covers **local versioning only**. GitLab push/pull, ticket generation, and multi-user sync are explicitly out of scope; they may be layered on later via the existing trigger system or user-managed remotes.

---

## 2. Goals

- Preserve every meaningful editing session as a recoverable snapshot.
- Avoid empty commits (no-change auto-saves do not create Git noise).
- Keep the workspace root Git repo clean by auto-isolating the document store.
- Require zero user configuration.

## 3. Non-Goals

- GitLab integration, CI hooks, or remote push/pull (user may add a remote manually).
- Ticket / issue generation on version events.
- Branching, pull requests, or merge workflows.
- Visual diff or blame UI inside the Office Viewer.

---

## 4. Architecture

```
Workspace Root (Fusion-Home/)
├── .git/                        ← optional outer repo
├── ai/
│   └── views/
│       └── office-viewer/
│           └── content/         ← DOCUMENT REPO ROOT
│               ├── .git/        ← inner git repo (this spec)
│               ├── captures/
│               ├── specs/
│               │   └── roadmap.md
│               └── todo/
│
└── .gitignore                   ← auto-injected: ai/views/office-viewer/content/
```

### 4.1 Components

| Component | Location | Role |
|-----------|----------|------|
| `versioning.js` | `server/lib/versioning.js` | Git operations: init, diff guard, commit, status |
| `file-explorer.js` | `server/lib/file-explorer.js` | Calls versioning hooks inside `handleFileSaveRequest` |
| `OfficeDocumentPage.tsx` | `client/src/components/office/OfficeDocumentPage.tsx` | Emits milestone reasons on export/share; tracks session state |
| `fileDataStore.ts` | `client/src/state/fileDataStore.ts` | Carries `reason` on `file_save` WS messages |

---

## 5. Commit Triggers

Commits are created server-side after the file has been written to disk. The client sends a `reason` with every `file_save` message.

### 5.1 Trigger Types

| Reason | When | Commit Message Example |
|--------|------|------------------------|
| `autosave` | 3-second debounce after typing stops | *(never commits — diff guard prevents no-op commits)* |
| `manual` | `Ctrl+S` pressed | *(never commits)* |
| `session_end` | User navigates away (back, sibling, Escape) | `session: roadmap.md` |
| `checkpoint` | 30 minutes of active editing elapsed | `checkpoint: roadmap.md @ 2026-05-15T14:30:00Z` |
| `milestone` | Export, print, or share action invoked | `milestone: export pdf — roadmap.md` |

### 5.2 Active Editing Checkpoints

- A checkpoint timer resets after every successful `file_save` with dirty content.
- If 30 minutes elapse **and** the document is still dirty, the next auto-save carries `reason: 'checkpoint'`.
- If the user closes the document before 30 minutes, only the `session_end` commit is created.

### 5.3 Diff Guard

Before any commit, the server compares the file on disk against `HEAD`:

```js
const lastCommitted = await gitShow(contentRoot, `HEAD:${relativePath}`);
const current = fs.readFileSync(absolutePath, 'utf8');
if (lastCommitted === current) return; // skip empty commit
```

Files not yet in `HEAD` always pass the guard.

---

## 6. WebSocket Protocol

### 6.1 Client → Server

```ts
type SaveReason = 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';

// Existing file_save message, extended
{
  type: 'file_save',
  panel: 'office-viewer',
  path: 'specs/roadmap.md',
  content: '# Roadmap\n\n...',
  reason?: SaveReason,        // NEW — default 'autosave'
  milestone?: string          // NEW — e.g. 'export_pdf', only with reason: 'milestone'
}
```

### 6.2 Server → Client

No new response types. `file_save_response` remains unchanged. Versioning is silent; failures are logged server-side but do not block the save.

---

## 7. Client Behavior

### 7.1 `OfficeDocumentPage.tsx`

1. **Track session start** when `markdownUpdated` fires for the first time after mount.
2. **Checkpoint timer**: `setInterval` every 60 seconds checks `Date.now() - sessionStart >= 30 * 60 * 1000`. If true and `isDirty`, the next save carries `reason: 'checkpoint'` and `sessionStart` resets.
3. **Navigation away**: `handleSaveAndLeave` calls `saveFile` with `reason: 'session_end'`.
4. **Export/share handlers** (Export PDF, Export DOCX, etc.):
   - If `isDirty`, save first with `reason: 'autosave'`.
   - Then send `file_save` with `reason: 'milestone'`, `milestone: 'export_pdf'` (even if file is already saved — ensures commit hash matches exported artifact).
   - Then proceed with export.

### 7.2 `fileDataStore.ts`

```ts
export type SaveReason = 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';

saveFile: (panel: string, path: string, content: string, reason?: SaveReason, milestone?: string) => void;
```

The `sendWs` payload includes `reason` and `milestone` when provided.

---

## 8. Server Behavior

### 8.1 `lib/versioning.js`

```js
async function ensureRepo(contentRoot);
async function commitIfChanged(contentRoot, relativePath, message);
async function shouldCommit(contentRoot, relativePath);
```

**`ensureRepo`**:
- Checks for `contentRoot/.git`.
- If missing, runs `git init`, sets `user.name = "Fusion Studio"`, `user.email = "fusion@localhost"`.
- If the workspace root contains `.git`, appends `ai/views/office-viewer/content/` to workspace `.gitignore` (idempotent).

**`commitIfChanged`**:
1. `git add <relativePath>`
2. Run diff guard (`git diff --cached --quiet`)
3. If changes exist, `git commit -m <message> --quiet`

### 8.2 `lib/file-explorer.js`

Inside `handleFileSaveRequest`, after the atomic rename succeeds:

```js
const reason = msg.reason || 'autosave';
if (reason === 'session_end' || reason === 'checkpoint' || reason === 'milestone') {
  const milestone = msg.milestone;
  const fileName = path.basename(requestPath);
  const message = reason === 'milestone'
    ? `milestone: ${milestone} — ${fileName}`
    : reason === 'checkpoint'
      ? `checkpoint: ${fileName} @ ${new Date().toISOString()}`
      : `session: ${fileName}`;

  try {
    await versioning.commitIfChanged(basePath, requestPath, message);
  } catch (err) {
    console.warn('[Versioning] Commit failed:', err.message);
  }
}
```

Failures are non-fatal. The file is already saved.

---

## 9. Auto-Guard for Nested Repos

If the workspace root is (or later becomes) a Git repository, the document store must not appear as an untracked directory or submodule.

**`ensureRepo` handles this automatically:**

```js
const workspaceRoot = path.resolve(contentRoot, '..', '..', '..', '..');
const gitignorePath = path.join(workspaceRoot, '.gitignore');
const line = 'ai/views/office-viewer/content/';

if (fs.existsSync(path.join(workspaceRoot, '.git'))) {
  let contents = '';
  try { contents = fs.readFileSync(gitignorePath, 'utf8'); } catch {}
  if (!contents.includes(line)) {
    fs.appendFileSync(gitignorePath, '\n# Fusion Studio document versions\n' + line + '\n');
  }
}
```

This guarantees the outer repo never sees the inner `.git` directory or document files.

---

## 10. Files to Create / Modify

| File | Action | Change |
|------|--------|--------|
| `server/lib/versioning.js` | **Create** | `ensureRepo`, `commitIfChanged`, `shouldCommit`, auto-guard |
| `server/lib/file-explorer.js` | **Modify** | Import versioning; commit hook after atomic rename in `handleFileSaveRequest` |
| `client/src/state/fileDataStore.ts` | **Modify** | Add `SaveReason` type; accept `reason` and `milestone` in `saveFile` |
| `client/src/components/office/OfficeDocumentPage.tsx` | **Modify** | Track `sessionStart`; checkpoint timer; pass `reason` on nav-away and exports |

---

## 11. Out of Scope

The following may be built later but are **not part of this spec**:

- GitLab remote configuration, push, or pull
- Ticket / issue generation from version events
- Visual version history browser inside Office Viewer
- Conflict resolution UI
- Branching or merge workflows
- `.versions/` fallback (this spec uses Git exclusively)

---

## 12. Open Questions

1. Should `manual` (`Ctrl+S`) ever commit? (Current answer: no — it is just a disk flush.)
2. Should milestone commits also trigger a `file_changed` event for listeners? (Current answer: yes, reuse existing emit.)
3. If a file is deleted, should a commit be created? (Current answer: out of scope — Office Viewer does not support file deletion yet.)
