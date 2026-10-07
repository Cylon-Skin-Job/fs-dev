# Fusion Server — Shared Knowledge and Instance Identity

Captured: 2026-09-25

Updated: 2026-09-25 — local instances push their knowledge to Server; clients query the consolidated knowledge remotely. This supersedes the earlier optional downstream history replication model.

Status: conversation capture for long-range planning. The owner requested this note; it does not authorize implementation or replace an approved roadmap. Owner direction and supporting design recommendations are distinguished below.

## Owner direction: Server as execution host and knowledge hub

Consider Fusion Server as a separate headless service/product responsibility, with Fusion Studio providing setup and administration. The owner proposed installing Studio on the host and having it set up Server; other computers should need only Studio, with no separately managed server installation.

Logging into Server means using **Server's harnesses and SQLite**, regardless of which computer displays the interface. Server creates and retains its own work sessions. It also receives knowledge from participating Fusion Studio instances, retaining the identity of the instance/machine that owned and hosted the work.

Studio contains its own locally owned threads and pushes their updates to Server. Server holds those contributions alongside its own saved sessions and makes the consolidated knowledge remotely queryable. Studios query Server for other instances' history, context, and recall; they do not pull the combined collection into their local SQLite databases. The schema agreement below establishes explicit instance ownership in common tables as the design direction; exact fields and migrations remain future work.

The desired capabilities include machine/workspace/session targeting in tool calls, reading work from other sessions, shared context and activity logs, semantic and recency recall, and handoff. Cross-instance continuity should become a platform responsibility rather than depending entirely on each workspace's `ai/` folder.

## Owner agreement: instance, connection, and ownership schema

The owner agreed to distinguish three concepts:

- **Instance:** a Fusion installation/profile with a stable UUID, current name, name history, and Studio/Server role.
- **Connection:** the access path to another instance, including its target identity, endpoint, pairing information, and connection status.
- **Ownership and ingestion:** the source instance that owns a record and the freshness of its uploaded copy on Server.

Use a common session/message schema with explicit instance ownership rather than separate per-machine tables as the identity divider. `ownerInstanceId` is the proposed field name; the exact schema is not yet specified. Server's consolidated tables include uploaded source-owned records and Server-owned records. Each Studio's local tables retain its own work. Connections and upload progress have separate storage responsibilities.

Local/remote is derived relative to the instance evaluating the record. Server can answer queries from an uploaded copy while the originating Studio is offline, with freshness made explicit. A Studio requires a connection to Server for consolidated recall; the plan no longer provides a local replica of other instances' history. Copy location does not change ownership or execution location. Receiving a query result is not downstream database replication.

## Owner direction: remote UI takeover

The owner's wording: **“The UI is takeover. The perception and implementation is ‘This work is being done elsewhere’.”**

When connected to another instance for remote work, Studio presents and controls that instance's environment. That instance's harnesses execute the work and its SQLite owns the resulting sessions. The computer displaying the interface is the client; it does not become the owner merely by initiating a prompt or displaying the response.

The owner clarified the current presentation plan: **a full-screen browser view displaying the React interface served by the remote instance**. React renders in the client's browser surface; the remote instance supplies the application and owns harness execution and persistence.

The interface should make the remote execution context understandable. This is distinct from querying Server's consolidated knowledge within local Studio: reading another instance's history neither enters takeover nor transfers its execution. Connection indicators and return-to-local interaction remain unspecified; the full-screen browser presentation is established owner direction.

## Owner direction: the same remote workspace and thread across clients

The owner clarified: **“I can log off one machine and use the same open thread on another. Last workspace seen is the one I see.”**

Remote clients access the same instance-owned workspaces, chats, and working state. The last active workspace and open thread belong to that shared remote experience, rather than being independently restored for each connecting machine. Switching client machines returns the user to that same workspace and thread; it does not create a new thread, copy the conversation, or transfer execution to the new client.

Record which machine remoted in on each **chat pair** (the prompt/response exchange). This is client-origin attribution, separate from the remote instance that executes the work and owns the session. A single continuing thread may therefore contain pairs initiated from different client machines while retaining one remote owner.

Client logout/disconnection is not a request to close the shared thread or stop the remote host. Exact attribution fields, unsent-draft behavior, and other transient browser state remain to be specified; these details must preserve the agreed same-workspace/same-thread continuity.

## Owner direction: one active remote UI connection

The remote instance must reject a second simultaneous full-takeover UI connection. The owner selected this boundary to prevent two client sessions from controlling the same thread or making conflicting edits in the shared environment. Takeover admission is exclusive across the remote instance, not merely per thread or workspace. A second client must not silently replace the admitted client. The owner subsequently confirmed that virtual shared-workspace collaboration permits multiple participants and is outside this takeover limit.

Moving between client machines requires ending or releasing the first connection before admitting the next. Server-side admission must enforce this rule; hiding controls in the client is insufficient.

Connection here means a full-takeover UI session, not each HTTP request or resource fetch used by the browser. Background knowledge uploads, remote knowledge queries, and virtual shared-workspace collaboration are separate from takeover admission. Queries and uploads must not consume the one takeover slot.

Implementation details remain open: how the host detects and releases a lost connection, fences a stale client after admitting a replacement, and treats any host-local administrative UI that could also edit the shared environment. These must preserve one admitted remote controller; this decision alone does not claim to prevent edits by background agents or external filesystem tools.

## Owner direction: upload knowledge and query Server

The owner revised the model: **“We just need local machines to push to server and make the db query able remotely.”** This supersedes the earlier push-then-pull cycle and optional local copies of the combined collection.

When a local instance is running and Server is reachable, it uploads its own new records and changes. Repeat periodically; the exact cadence is unspecified. Studios retrieve cross-instance history and recall through Server queries. Server's own sessions are already present there and need no inbound upload or downstream fan-out.

Each source exclusively authors its own partition. Server ingests those changes without becoming a second author of the source's sessions, and separately authors its own sessions. This preserves the single-writer rule and avoids concurrent-write merge conflicts within each source partition. Staleness while a source is offline or has not uploaded is acceptable and should be visible in query results.

If Server is unreachable, Studio can continue its own local work and retain changes for later upload. Consolidated recall is unavailable until reconnection; no offline copy of the wider collection is promised. Server-hosted virtual documents remain uneditable without connection, independently of local chat availability.

The proposed access boundary is a Server-owned query API/tool surface, not raw remote access to a SQLite file. Exact API and ingestion contracts remain to be specified. Uploads and query results preserve source identities. Reading a foreign session does not authorize writing its partition or continuing its runtime.

## Owner direction: virtual shared workspaces for live collaboration

The owner added a distinct workspace experience for a server-hosted corpus of shared documents and artifacts that participants contribute to and annotate. This is focused on shared content rather than repository-wide synchronization.

Although initially described as syncing files into local project folders, the owner immediately clarified the intended model: **the workspace is virtual, with no local filesystem copy of its shared content**. Participants add/access it within their own Fusion Studio. It is not the full-screen remote browser takeover described above.

- Server hosts the authoritative project content.
- Studio presents the virtual workspace within its own working environment.
- Document editing updates live, character by character, rather than periodically exchanging whole-file copies.
- Editing requires a connection. There is no independently editable local content and no offline edit queue to merge later.
- Chat threads are saved by the Fusion instance in whose environment the participant is working. Using the virtual workspace in local Studio saves threads locally and uploads their knowledge to Server. The owner explicitly confirmed that the same shared workspace is also available while logged into Server; threads created there are saved server-side, using Server's harnesses and SQLite, and are available to remote knowledge queries without copying them into Studio databases. The physical client displaying Server's interface does not become their owner. Shared content ownership and thread ownership are therefore distinct.
- Contributions and annotations form part of the collaborative corpus; exact artifact types and annotation behavior remain unspecified.

The absence of offline editing removes offline divergence from this experience, but simultaneous connected edits still require a server-coordinated collaboration contract. Source-owned knowledge uploads and shared-document editing are different mechanisms; the former's single-writer rule is not by itself a live text collaboration algorithm. The remote-query change does not remove character-by-character document collaboration.

### Owner-confirmed boundary: connection exclusivity

The owner confirmed: **“Yes—limit takeover, allow workspace collaboration.”** Only full remote takeover is limited to one active connection. Multiple participants may concurrently use virtual shared workspaces. Collaborative content operations need their own coordination regardless of whether a takeover client is also connected; takeover exclusivity must not be mistaken for an exclusive lock on all shared documents.

Other open details include how local harnesses access virtual documents without local filesystem paths, which operations are supported for non-text artifacts, and how the interface handles edits in flight when connectivity is lost. Recording local threads does not by itself establish where their harness execution occurs.

## Identity direction discussed

The owner asked whether to reuse the earlier machine fingerprint checker, assign a UUID, and bind the current machine name and previous name edits to it.

Recommended model recorded for later design:

- **Instance UUID:** stable owner of a synchronization partition, scoped to a Fusion instance/profile. Development and Alpha can coexist on the same physical machine with different databases and must remain distinct owners.
- **Current name:** editable human-facing label.
- **Name history:** previous labels with dates, retained for recall and attribution. A rename preserves the UUID.
- **Hardware fingerprint:** supporting matching/diagnostic evidence, not the primary key or an authentication credential.

Reuse the fingerprint checker to help detect an installation moved or copied to another computer. Moving an existing instance and creating an additional instance need distinct handling so two live writers do not accidentally share a partition UUID. Exact recovery/enrollment behavior remains open.

Preserve explicit user control over `ai/<machine>/` namespace changes. A stable UUID or fingerprint must not silently reverse a chosen folder/name change. Historical names are attribution/search metadata, not automatic filesystem redirects.

## Verified existing code

Source inspected in the development checkout during this conversation; no runtime fingerprint collection or implementation changes were performed.

- [machine-fingerprint.js](../../../../fusion-studio-server/scripts/machine-fingerprint.js) still exists as a standalone diagnostic script. It collects macOS hardware facts and computes stable and diagnostic fingerprints. Its own notes recommend an app-owned machine ID separate from the hardware matching hint. No integration reference was found in the inspected runtime and package entry points.
- [Migration 030](../../../../fusion-studio-server/lib/db/migrations/030_drop_local_machine_identity.js) deliberately removes the prototype `local_machine_identity` record. Its documented reason is that hidden fingerprint identity must not override intentional folder renames.
- [Current ai-paths identity handling](../../../../fusion-studio-server/lib/workspace/ai-paths.js) persists `local_machine_name`, supports the `FUSION_LOCAL_MACHINE` override, and does not maintain UUID identity or rename history.

## Supporting recommendations and open boundaries

These are design recommendations from the discussion, not a completed protocol:

- Use resumable per-source upload sequences, deletion records, and visible ingestion freshness. Durable change delivery must survive disconnects and retries; exact mechanics remain open.
- Keep remotely querying history distinct from controlling its original execution. A linked local continuation or explicit handoff was suggested; continuation semantics remain to be chosen.
- Keep shared summaries traceable to source sessions/artifacts and distinguish generated context from original records.
- Decide UUID persistence, clone/move handling, contribution/query visibility, and upload/query mechanics before implementation.
- Studio-managed installation with Server lifetime independent of an open Studio process was recommended; exact packaging and lifecycle remain to be designed.

## Dependency and contradiction review — 2026-09-25

These are planning dependencies, not an approved execution sequence or claims that the capabilities are implemented.

| Capability | Required foundation | Effect of the revised model |
|---|---|---|
| Local knowledge contribution | Stable instance/session identity; source-authorized writes; durable, resumable, idempotent upload; deletion/update handling | Retained, in the Studio-to-Server direction only. Local changes must remain recoverable while Server is offline. |
| Consolidated recall | Server ingestion and queryable storage; authenticated, authorized queries; source/workspace/session filters; pagination and freshness | Remote query access replaces downstream history replication. Semantic indexing, when added, can operate on the Server collection without requiring a copy on every Studio. |
| Connection/admission | Distinct purposes for takeover, contribution, query, and document collaboration | Only takeover consumes the exclusive UI slot. Remote reads do not grant control over foreign sessions. |
| Remote takeover continuity | Server-owned workspace/thread state, per-pair client attribution, exclusive admission and stale-client fencing | Unchanged by remote queries; the remote harness and SQLite still own this work. |
| Virtual collaborative workspace | Server-owned content, coordinated live edits, connected-only editing, virtual resource access for tools | Independent of knowledge upload/query. No local document mirror, offline fork handling, or download of all threads is required. |

Removed dependencies: per-Studio downstream history cursors, importing other instances' records into local session tables, distribution of Server's sessions to all Studio databases, and offline availability of the consolidated collection. Query-result presentation is still required; durable local history caching is not part of this plan.

Contradictions reconciled or explicitly routed:

- This capture's earlier optional pull-down, local foreign-history replicas, push-then-pull cycle, and offline consolidated recall claims are superseded and replaced above. The single-writer partition/UUID model remains necessary for uploads.
- The older [machine-sync note](machine-sync-sharing-model.md) discusses editable filesystem copies and offline fork-on-conflict. Those are a separate historical feature, not prerequisites for virtual workspaces or knowledge queries. A dated scope note there points to this capture. Its earlier claim that editor machinery alone suffices for live hosting must not omit connection authorization, coordinated edits, or virtual resource access.
- The [browser MVP candidate](../031-Remote_Access/Browser-MVP-2026-09-19/ROADMAP.md), final acceptance item 4, calls for workspace switching with two clients. Any test involving two simultaneous remote takeover clients conflicts with the newer one-takeover rule. Before reuse, that candidate needs explicit second-client rejection and sequential reconnect continuity checks; simultaneous local-host interaction remains an open design boundary. Its existing shared-workspace principle is compatible with this capture.
- Browser-only MVP deferrals of standalone Server packaging, Fusion-to-Fusion UI, and collaboration are earlier release boundaries, not evidence these long-range features already exist. This capture does not silently expand or reapprove the candidate bundle.
- The browser MVP's unavailable-server behavior applies to remote operations. It must not be generalized to prohibit Studio's own local work while knowledge upload/query is unavailable.
- The older document-sync note's provenance/file-versioning dependencies are not automatically inherited by knowledge ingestion. Reliable upload needs its own durable delivery contract; an observational event stream alone is insufficient. Exact reuse and implementation dependencies require later design.

Review scope: this capture, its linked machine-sync note, the browser MVP roadmap/decisions, and reference searches through active captures and Mission Control. No executable SPECs, product code, or approval records were changed by this review.

## Related planning

- [Machine sync and document sharing](machine-sync-sharing-model.md): earlier document-sync work, including durable delivery and conflict handling. Its filesystem/offline branch is separate from this capture's virtual, connected-only collaboration; knowledge upload/query does not depend on that branch.
- [Browser remote-access candidate](../031-Remote_Access/Browser-MVP-2026-09-19/ROADMAP.md): existing draft uses one host runtime/database and proposes a window-independent Electron host; a separate daemon is deferred there. This capture records a long-range destination without changing that candidate's scope or approval state.
- [Vision Roadmap capture](../022-Vision_Roadmap/CAPTURE.md) and [plugin integration overview](../037-Plugin_Integration_And_Parallel_Roadmaps/integration-overview.md): related umbrella planning. The specific “latest unified long-range roadmap” referenced by the owner was not conclusively located in this conversation; attach this note to that source once identified.
