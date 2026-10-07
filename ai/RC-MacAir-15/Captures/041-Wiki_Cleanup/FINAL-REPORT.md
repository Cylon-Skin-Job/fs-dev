# Wiki cleanup — completed

## Result

The fact-reassignment work in Capture 040 was used as the prerequisite for retirement. Removed 27 PAGE.md files from live navigation: all 19 migrated legacy routes and eight duplicate contents pages. The live wiki now has 173 articles across 12 top-level sections, down from 200 across 15 at this cleanup’s start (the earlier 189-page audit preceded 11 new canonical articles).

Updated 42 retained articles, repaired eight supporting issue/template-issue files, and preserved 131 other live articles byte-for-byte. No product code, rule resources, database, runtime cache, Alpha checkout or installed application was changed by this cleanup. No commit or publication was performed.

## Retained-page findings and repairs

- **Wiki specialists:** removed obsolete edge/update-graph policy and Project routing, corrected the current query CLI and heading structure, and distinguished legacy renderer compatibility from source-only authoring. Current fact, approved intent and open decisions can coexist when labeled.
- **Voice:** corrected the documented source path; the rules themselves were not obsolete and were not changed. The preparation script selects `System_Manager/ai/views/wiki-viewer/content/system/Text-To-Speech/Rules` when present (it is present here), otherwise `System_Manager/resources/text-to-speech/rules`. Runtime prefers copied resource rules through the resource resolver. This pass covered paths and packaging/runtime selection, not a complete transcription algorithm recertification.
- **Chat:** current source composes view-bound rail/chat/content through WorkspacePanel. The old Legacy production host and ViewWorksurfaceDock are gone. Source ownership now names useChatSessionHost, useChatSessionActions and connected leaves. Side Chat still has the unwanted left Show threads control, which toggles the outer view sidebar. Removal remains product work; the retained right-hand list behavior remains undefined. Header and row menus now use the shared portal menu module.
- **Events/provenance:** attachment staging belongs to the Chat action controller; composer send snapshots pending resources in useChatSessionActions. These updates do not claim a general UI-action provenance adapter has been built.
- **Fusion Home:** removed unsupported shared-System-SQLite and four-shipped-app promises. Calendar routes to its mounted demo/incomplete integration owner; Email routes to its mounted mock-mail owner. Preserved useful Office/Documents/Tables/Milkdown/Crepe material and the dated changelog. Planning placeholders remain honest placeholders, not implemented storage or provisioning contracts.
- **Workflows/guidance:** repaired all seven workflow pages and supporting maintenance instructions. Researchers remain read-only; the coordinator resolves contradictions and owns edits. Documentation volume and modification timestamps are not evidence that features shipped. Navigation generation is staged and scoped.

## Preservation and relocation

See [RETIREMENT-MAP.md](RETIREMENT-MAP.md) for all 27 canonical successors and exact preserved preimages. Three retired sections, including all 80 files of their existing history/logs, moved beneath the Wiki root’s hidden `.versions/`. Six duplicate pages in retained sections moved to adjacent `.versions/` snapshots. Nothing from those histories was discarded or rewritten.

Capture 040 was left unchanged. Historical evidence paths into the three retired sections require the prefix relocation map in RETIREMENT-MAP.md. This is an explicit physical relocation, not a claim the original paths still exist. Saved runtime/cached page paths were not rewritten and may need reselection through the current wiki navigation.

[CHANGES.md](CHANGES.md) records 42 before/after article hashes, their complete preimage locations, actual modification timestamp and eight supporting pointer repairs. Support-file preimages are preserved in flat Markdown receipts. Issue status and old dated findings were not treated as current wiki truth or silently closed; some shorthand paths in the historical RCC-0102 discussion remain historical.

## Remaining work and limits

1. **Bundled/template wiki copies:** System_Manager/ai-template/Wiki and System_Manager/ai-v2/RC-MacAir-15/Wiki still contain old structures and content. They require a separate source/provisioning-aware cleanup so future workspaces do not inherit obsolete documentation. Only the two explicit Code Standards pointers in template issue files were repaired here.
2. **Specialist factual depth:** this was a bounded repair of the flagged material, not recertification of all 173 articles. Office editing/table behavior and Voice transcription semantics were retained; they were not exercised. Existing dated runtime/security/provenance claims retain their own verification scopes.
3. **Three untouched Code Standards pages** still list directory-valued source references: WebSocket Protocol (`src/lib/ws/`), Harness Adapters (`lib/harness/`), and Testing And Smoke Slices (`test/`, `src/`). Their next substantive review should replace those with exact owning files. No missing source path remains in the live metadata scan.
4. **Product gaps remain explicit:** Side Chat left-control removal, future right-list behavior, plugin provisioning/composition and incomplete connected-app integrations are not completed by documentation cleanup.
5. The existing audit generator still emits legacy metadata for newly generated root pages and does not maintain timestamps. This pass used its navigation generator only in a disposable copy, normalized/stamped actual live edits and imported no audit state.

No new owner decision is needed to accept this cleanup. No runtime, Electron, Alpha or product test suite was run because the changes are documentation and authored reference repairs.
