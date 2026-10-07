# Symlink and Send to Chat investigation

Date: 2026-09-21. “SIM link” interpreted as symlink in the context of RCC-0110. Scope: current source and existing isolated CHAT-AR evidence. No product changes, new runtime tests, active benchmark interference, live profile/DB reads or server starts.

## Authorized ticket retirement

RCC-0087 (standalone macOS Connectors panel) and RCC-0092 (standalone Connector SPEC updates) are closed as superseded in their Markdown files and tickets.json, following explicit owner direction that plugins replace connectors. Historical text remains clearly labeled. Native integration capabilities and permission requirements are not certified complete. RCC-0071 Calendar permission UX remains open; it can be assigned to the owning plugin/module when that integration is specified.

## Symlinks: current behavior depends on the route

1. **File browsing/reading follows existing links.** file-explorer.js checks logical containment and expressly permits user-created links to external targets. The newer file-reads/file-viewer-read-service.js likewise checks the logical requested path, then uses stat/readFile on it and reports symlink metadata. A linked folder or file can therefore expose target content while keeping its logical in-workspace path. Directory classification and traversal helpers handle links; watcher core has followSymlinks:true. This is not proof that every viewer/search/harness path has identical semantics.
2. **Governed saves are stricter.** Public file_save in client-message-router.js delegates to fileSaveRoute, not the old file-explorer save method. file-mutations/path-authority.js requires physical panel and parent containment and rejects a final symbolic-link target, including a link to a file inside the workspace. An intermediate directory symlink can pass when its resolved parent stays within both authority roots. A linked external parent fails. The old file-explorer writer follows final links, but its existence must not be mistaken for the public save contract.
3. **This difference was explicitly scoped.** Capture 023 ROADMAP says the mediated-save MVP rejects final links and parents outside workspace/panel authority. It labels linked-file save rejection an approved safety narrowing. Thus “existing symlinks can be read” does not imply “all existing symlinks can be edited through the governed File Viewer save route.”
4. **AI-created link policy is a separate unfinished requirement.** RCC-0110 requires blocking AI/tool creation of inbound external symlinks while allowing existing user-created links and permissioned outward publication. SPEC-31 explicitly leaves the general hook surface to RCC-0110. No implemented general Open Router tool interceptor fulfilling that ticket was found in the inspected harness paths. Agent provenance may exclude symlink/outside candidates from captured evidence; excluding a checkpoint is not preventing a tool from running ln -s or proving it had permission.

Disposition: keep RCC-0110 open as an execution/permission requirement; align its owner with the plugin/tool-capability design. Do not implement a second standalone connector or pretend ordinary path/read support closes it. If uniform user-created-link editing remains desired, name the governed-save compatibility requirement explicitly before changing the accepted boundary.

## Send to Chat: current product defect, not just future polish

- SendToChatButton constructs a resource attachment, dispatches fusion:chat-action with target=current and delivery=insert, then immediately displays “Link attached to chat.” Dispatch returns no result or acknowledgement.
- Production useViewChatHost passes explicitTarget:true. useLegacyChatHost refuses to register fusion:chat-action and fusion:chat-insert consumers in that mode. The existing controls can therefore dispatch without a receiver.
- The dormant/explicit Legacy action path also contains an uncorrelated new-chat listener: the first valid thread:opened can satisfy it, regardless of the creation request. Prompt resolution has a request ID, but pending socket listeners are not fully bound to host/socket lifetime.
- The normal composer Send path is separate. It marks pending acceptance before chatSlice.sendMessage checks for an open socket; that store action silently returns when disconnected. This can leave the retained draft disabled and the acceptance wheel visible even when no prompt was enqueued.

Existing runtime evidence: CHAT-AR SPEC-01 slice 01B report records builder-owned clean review and 17-case characterization (not final owner acceptance of the SPEC). Its current-product findings include:

- Wiki/Office/no-target callers showed success with no attachment/result; File/source-switch silently produced no attachment.
- Connected SystemViewer emitted its prompt/new-chat action but no prompt resolution, creation or draft resulted.
- Production instrumentation found zero fusion:chat-action consumers in the view-bound host.
- An unrelated valid thread:opened consumed a Legacy pending-create listener and replaced a retained draft; retired-socket listeners also remained.
- Both no-enqueue composer scenarios retained text but left input disabled and the real acceptance-pending wheel visible.
- Diagnostic Ask AI append worked through its existing separate path and did not auto-send. Not every composer insertion route is broken.

These are reported isolated runtime reproductions by the executing CHAT-AR task, corroborated by source inspection here; no fresh app launch was performed in this investigation. Expected failures in enforce mode are evidence of product defects, not failing characterization infrastructure.

Disposition: keep RCC-0103 open, tracked under approved CHAT-AR SPEC-03 (target/result owner, actual callers, correlated creation and listener cleanup), consuming SPEC-02 submission state/recovery. Do not duplicate that implementation. Neither SPEC is certified delivered by the inspected SPEC-01 characterization report.

## Source references

- [Read policy](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/file-explorer.js:48)
- [Current File Viewer read owner](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/file-reads/file-viewer-read-service.js:96)
- [Public save route](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/ws/client-message-router.js:442)
- [Governed path authority](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/file-mutations/path-authority.js:111)
- [Existing path-authority tests](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/test/resources/path-authority-and-atomic-writer.test.js:84)
- [Approved bounded save contract](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Captures/023-MVP-Provenance-Subscriptions/ROADMAP.md:58)
- [Tool creation requirement](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Issues/inbox/RCC-0110.md:13)
- [Shared action dispatcher](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/lib/chat-action.ts:17)
- [Button success before result](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/SendToChatButton.tsx:28)
- [Production explicit target](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/chat/useViewChatHost.ts:99)
- [Excluded event consumer and Legacy listener](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/components/chat/useLegacyChatHost.ts:603)
- [Silent no-enqueue return](/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/src/state/slices/chatSlice.ts:370)
- [Existing isolated evidence](/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-01/01B/SLICE-01B-REPORT.md:24)
