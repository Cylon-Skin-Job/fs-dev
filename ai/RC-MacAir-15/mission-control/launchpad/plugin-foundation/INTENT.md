# Plugin foundation — owner intent

> Desired outcome and approved folder boundary; implementation details remain open.

## Outcomes

Define the smallest usable plugin foundation early enough that the first real plugin, including a later logger if chosen, need not begin as a throwaway built-in.

Enable a custom view to behave as an app: compose approved plugin-provided display and server functions, use app-owned files or a separate app database, and receive results and meaningful events through Fusion's existing service and UEB boundaries.

## Boundaries

This folder owns package identity, installed-home decision, classification, manifest/contribution grammar, registration, grants, lifecycle and first proof selection. It does not own governed event schemas, view-instance provisioning, health measurements, or a general catalog/distribution build. Folder creation does not alter earlier product acceptance or authorize implementation.

Plugin functions do not write `fusion.db` directly; they may receive approved audit/log queries and use their own data stores through app-owned services. This folder specifies the plugin-facing contract and routes UI-action producers, UEB schemas, view binding and automation provenance to their existing owners. The owner's existing focus-warm and server-background behavior is the lifecycle to integrate with, not a new workspace-open policy to invent here.

The no-app-data boundary includes bundled first-party and native-integrated apps. Bookkeeping may own a separate database; Mail/Calendar may pass through the native source. Fusion's System database is not a second live app store. The exact audit payload and reconstruction promise remain open because retained field values can themselves be a secondary copy of app data.

For Apple-first native Mail and Calendar, monitor changes through bounded connector capabilities rather than the repo-file snapshot fallback or recursive watching of native app storage. The owner needs new mail and calendar changes within a useful interval, while full native Mail/Calendar UI and assistant tooling remain later scope. Apple remains the initial platform; Linux and Windows adapters come later. [D-019](DECISIONS.md) records that boundary and [I-021](ISSUES.md) holds the exact latency, coverage, permissions and resource budget.

Mail and Calendar are protected plugins in the intended architecture. Their plugin-owned server-side listeners or source queries use a System-managed scheduling capability where an interval is needed. Verified changes enter the governed UEB through registered, granted producer admission with System-assigned provenance; authorized subscribers can refresh a view or initiate another named command. A plugin view's focus does not own the background listener lifetime. The earlier async UI-command/result path remains separate from this listener-driven fact path. See [D-020](DECISIONS.md) and [I-022](ISSUES.md).

Carousel workspace PNGs are System shell previews under [D-007](DECISIONS.md). File-level thumbnails belong with file folders under the existing `.thumbnails` convention and feed a reusable card/preview API. This folder shapes the plugin contribution and grant seam for a thumbnail provider, while file/view/attachment owners define rendering and close lifecycle behavior. Preserve current product paths.

The shared file collection should let a view instance bind an authorized folder to a protected plugin, choose square/rectangular file and folder cards or one-depth folder headings, and choose raw/rendered preview and current-surface/new-tab opening where supported. Office and Capture (later Launchpad) should share card chrome, stars, expansion and folder pinning through configured host actions. [D-009 and D-010](DECISIONS.md) record the owner direction; the platform file surface and shell retain rendering/editing and tab authority.

Small cards use the chat attachment language with a folder icon or file icon/preview beside filename and details; large file thumbnails fit card width while folder cards retain the folder icon. Thumbnail mode uses a miniature 8.5 × 11 page frame, and icon mode follows File Explorer's file-type mapping. Preserve these owner choices when defining the shared presentation contract.

The app supplies a reusable server-backed single-file tab for documents, images and PDFs, with a raw/rendered switch where applicable. File cards and Capture-style panels/modals are view-only; editing occurs in the file tab through canonical services. Office and Capture/Launchpad are configurable collection presets: Office clicks open a new file tab, while Capture clicks preview and offers a header action to send the file to a tab. Mixed file types are allowed in either collection; defaults and type-supported modes determine presentation, not collection membership. See [D-011 and D-012](DECISIONS.md).

Snapshotting remains System-owned, while file-content/version storage moves to a repository-local SQLite separate from `fusion.db`. Plugins supply source/destination and permission/grant configuration; System enforces the approved grants. Preserve user-edit versioning and required save preimages, prompt snapshots from trigger and harness events, and use approximately 30-minute scans as a fallback retaining both observed content copies and their capture window. Record the snapshot reason and event/file links without claiming causality; unmatched evidence is left for user/assistant audit. The owner wants to remove Chokidar. Under [D-016](DECISIONS.md), new snapshot capture/scanning and trigger migration are future work, not prerequisites for Chokidar removal or actual chat verification. Record their need here for a separate future assignment; preserve existing independently functioning user-save/version/tool-observation paths. [D-015](DECISIONS.md) supersedes the capture alternatives in [D-013](DECISIONS.md), while its optional record-retention configuration direction remains. Exact location, migration, declarations, scope and replacement of live freshness/trigger-input detection remain [I-016, I-017 and I-019](ISSUES.md).

This folder's active conversation plans the successor capability and grant contracts while another session prepares the Chokidar-removal SPEC and later verifies chat. [D-017](DECISIONS.md) clarifies that ownership split; it does not make completed retirement a prerequisite for planning here.

The owner is using this folder as a long-running Launchpad and Capture conversation for a multi-step roadmap. Capture choices and open questions here, run preflight when preparing a planning handoff, then develop a First Draft and proceed to Roadmap Creation as separate stages. [D-018](DECISIONS.md) makes clear that discussion does not authorize product-code changes or implementation.

The proposed repo snapshot store should publish a consistent copy to a configured GitHub or GitLab remote by default. The writable local database remains independent of Git checkout/pull and is never overwritten from the remote automatically. Warn at the owner-stated 80 MB size and explain that Git publication stops at an effective ceiling of 100 MB or an applicable lower host limit; local capture continues. [D-014](DECISIONS.md) records this direction, while [I-020](ISSUES.md) keeps exact units, cadence, path, failure handling and history strategy open. The separate proposed 1 GB local-capacity notification remains [I-018](ISSUES.md).

Every plugin-facing call should yield a bounded outcome and be subject to invocation limits. The outcome does not replace server authorization. Whether a System read also publishes an access fact is unresolved; the earlier read-light direction remains visible in [I-006](ISSUES.md).

## Success and unresolved detail

A useful return from this folder identifies exact source authority, concrete contracts or findings, dependencies on sibling folders, verification needed for the next decision, and any owner choice still open. Detailed mechanisms, first proof, schedule and execution authorization will be settled with the owner in the folder.
