# Shared Builder and Orchestrator Guidance

## Architecture Rules

- Extend `fusion-studio-server/lib/event-bus.js`; do not create a second bus.
- Mint governed publishers once from a host-owned static catalog, inject exact closures, and seal before dynamic workspace/project modules or public sockets start. Never export a string-selected publisher factory.
- Use migrations and repository modules; never hand-edit `fusion.db`.
- Keep file mutation ownership in a command/service layer. An MVP subscriber may persist or project only through its exact scoped context. Subscriber-triggered commands and fact emissions are reserved for a later capability catalog expansion.
- Use the existing renderer WebSocket. Add a typed projection message and route it through the central WebSocket client.
- Convert every validated panel/path alias to one canonical workspace-relative physical path before resource identity, locking, snapshots, facts, or queries. MVP projections target only the read-only File Viewer alias.
- Establish the server-issued workspace bind epoch in SPEC-03. Save/query replies and later file reads/projections must carry the captured epoch; clients require request ID plus current workspace/epoch, including A→B→A.
- Treat request workspace ID/epoch fields only as equality preconditions against the active server session. Reject stale intent before path resolution, mutation, or query/read I/O; never use those fields to choose a workspace or root.
- Keep built-in views as React components. Iframes remain for custom/browser surfaces.
- Treat expected file lists as advisory. Perform bounded integration necessary for the approved behavior and report it as a deviation.
- Preserve unrelated dirty worktree changes.

## Provenance Rules

- Generate every MVP `eventId`, `operationId`, `commandId`, `resourceId`, and `fileVersionId` on the server with opaque UUIDs. Any future `uiActionId`, thread/turn/tool/script ID, or stronger principal identity is also host-owned when its schema is introduced. DOM IDs, filenames, paths, and timestamps are not identities.
- Store timestamps as integer milliseconds and name their meaning (`acceptedAt`, `occurredAt`, `capturedAt`, `completedAt`).
- Record the facts available at the command boundary. Do not manufacture a cause because events are nearby.
- `operationId` is grouping evidence, not proof that every member caused every other member.
- Direct cause fields are absent from MVP schemas. Timeline order and a shared `operationId` remain available without claiming causation.
- Validation or subscriber failure must not convert a completed mutation into a failed mutation. Before-snapshot preparation is an operational precondition of the in-scope save: failure before the atomic write rejects the save; failure after the write is recorded/reconciled honestly and cannot make the filesystem success disappear.
- The MVP rejects any final symlink save target and any resolved parent outside the authoritative workspace/panel root. This deliberately narrows legacy linked-file editing; do not silently preserve it by following the link.
- Treat intended content as a validated Unicode-scalar, NUL-free JSON string encoded once to exact UTF-8 bytes. Existing bytes must fatal-decode, be NUL-free, and re-encode byte-identically; do not use filename extensions or lossy decoder replacement as a binary test.
- Do not store raw secrets, credentials, full chat prompts, tool outputs, or arbitrary binary content in event payload JSON.

## Registry and Permission Rules

- Requested, granted, and effective authority are distinct.
- New user/extension definitions are `pending`; a file/config claim of enabled or granted is never authoritative. System subscription rows are introduced only in the same accepted SPEC that supplies their handler.
- Revocation, narrowing, and quarantine may take effect without a new grant. Grant, restoration, expansion, and unquarantine require a human-owned authorization path; the UI for that path is deferred.
- System rows may be enabled by migrations because they are shipped code, not imported user bundles.
- Unknown schemas, handler keys, capabilities, invalid JSON, checksum drift, and impossible state combinations keep that registry entry inactive and diagnosed without changing its persisted human-owned lifecycle state or stopping the server.
- Runtime reload is fail-closed for authority reduction and atomic for additions: revoked/disabled/quarantined/checksum-invalid rows are removed from the active generation immediately even if another candidate row is malformed; no prior grant survives its own invalidation. Only a complete valid set of additions, widenings, or reconfigurations swaps in. Failure keeps prior descriptors solely for unchanged rows and reports diagnostics.

## Testing Rules

- Server repository/controller/subscriber behavior uses Jest with in-memory or temporary SQLite.
- Runtime/Electron/browser evidence uses a dedicated configuration/launcher with a temporary `FUSION_APP_USER_DATA`, `FUSION_LOCAL_MACHINE=Test-Provenance`, temporary workspace, unique non-3001 port, and `reuseExistingServer: false`. It must refuse developer/project/Application Support paths. Never reuse the default Playwright config, live developer database, or `ai/RC-MacAir-15` fixture content.
- Prove event counts and identities, not only final UI text.
- Include failure injection for database write failure, invalid registry rows, subscriber throw/rejection, duplicate delivery, snapshot failure, and WebSocket reconnect.
- Run the narrow target checks first, then full server tests and client build before SPEC acceptance.

## Review and Deviation Contract

Each slice report must include:

- delivered behavior;
- files changed;
- commands and runtime evidence;
- clean-room findings and repairs;
- every deviation from expected files, design, or sequencing;
- whether each deviation is required integration, benign variation, scope reduction, scope expansion, or unresolved risk;
- effect on accepted predecessor contracts and future SPECs;
- residuals and explicit out-of-scope work.

The builder owns fresh clean-room review until the first clean pass. The orchestrator then obtains a separate fresh clean-room review and routes any validated finding back for repair. Review has no arbitrary pass cap.
