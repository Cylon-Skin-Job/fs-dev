# S00 source inspection

Scope: read-only working-tree inspection on 2026-09-23T12:38:55Z. No runtime, build, harness discovery, permission enforcement or installed Alpha certification. Source hashes identify observed bytes, not feature acceptance.

## Contract interpretation

- Latest DECISIONS D01–D12 governs the layered target. Historical folder schemas, fixed inventory/iframe-only extension, raw-only/current-tab restrictions and blanket provenance fail-open do not override it.
- Read the whole standards hub and six routed pages, plus all four wiki authoring guides. Portable components receive explicit data/actions; authorization and canonical file persistence retain current owners.
- Read all required source entries. Large code files were inspected at the material boundary symbols recorded in CLAIMS; archive documents were read for classification, folder/template/context, renderer, shell and provenance boundaries rather than treated as executable contracts.
- Existing Chat overview includes a now-removed ViewWorksurfaceDock source and dated host/default claims. These are preexisting read-only dependency defects; do not copy as current facts or recertify them. Link its owner decisions for side chat target semantics.
- Missing guessed search paths thread-runtime.js and replay-reconciler.js were resolved to thread-runtime-controller/manager, harness compat, and fact-replay.js. No missing normative source was skipped.
- Current view protection is specifically the view namespace/path policy, not a fully implemented global System/plugin permission system.

## Producer/consumer evidence

- **PP-CUR01**: Built-ins use fixed ID React dispatch; custom/local app and browser branches remain separate. Owner `fusion-studio-client/src/components/ContentArea.tsx` (CONTENT_COMPONENTS; ContentArea; ContentFrame); dependent scopes: `fusion-studio-client/src/components/view-tabs/ViewTabBar.tsx` (ViewTabBar).
- **PP-CUR02**: Closed two-entry code-owned Capture/File launcher catalog, not arbitrary plugin loading. Owner `fusion-studio-client/src/components/view-tabs/componentTabLauncherCatalog.ts` (COMPONENT_TAB_LAUNCHER_CATALOG; findComponentTabLauncherCatalogEntry); dependent scopes: `fusion-studio-client/src/components/view-tabs/componentTabConnectedOwner.ts` (createConnectedTabOwner; beginLaunch).
- **PP-CUR03**: Generic component tab machinery delegates read/apply to established owner ports; no second durable tab store. Owner `fusion-studio-client/src/components/view-tabs/componentTabConnectedOwner.ts` (ConnectedTabOwnerPorts; createConnectedTabOwner; commit); dependent scopes: `fusion-studio-client/src/components/view-tabs/fileConnectedOwnerPorts.ts` (readCollection; applyCollection); `fusion-studio-client/src/components/view-tabs/ComponentTabPanel.tsx` (ComponentTabPanel; resolveSafely).
- **PP-CUR04**: File presenter has a code-owned target identity consumed through connected ports. Owner `fusion-studio-client/src/components/view-tabs/fileConnectedPresenterTargets.ts` (canonicalFilePath; fileDocumentTargetKey); dependent scopes: `fusion-studio-client/src/components/view-tabs/fileConnectedOwnerPorts.ts` (resolveFilePlacementTarget); `fusion-studio-client/src/components/file-explorer/FilePickerDrawerLayer.tsx` (FilePickerDrawerLayer); `fusion-studio-client/src/components/file-explorer/FileViewer.tsx` (FileViewer).
- **PP-CUR05**: Current creation copies bundled System_Manager templates into machine System/Views, not installed plugin templates. Owner `fusion-studio-server/lib/workspace/create-service.js` (scaffoldProjectV2Unchecked; readV2Manifest); dependent scopes: `fusion-studio-server/lib/workspace/ai-paths.js` (getMachineViewsRoot); `fusion-studio-server/lib/views/index.js` (listV2ViewFolders; loadV2ViewShellFromEntry).
- **PP-CUR06**: OpenCode adapter uses its supplied projectRoot for --dir and process cwd. View-local context contract remains unverified end to end. Owner `fusion-studio-server/lib/harness/opencode/index.js` (buildRunArgs; startThread/sendMessage); dependent scopes: `fusion-studio-server/lib/harness/compat.js` (spawnThreadWire; startHarness).
- **PP-CUR07**: Mediated save prepares required preimage before replacement; postwrite fact trouble is tracked separately from source-write outcome. Owner `fusion-studio-server/lib/file-mutations/save-controller.js` (save; finishSuccess); dependent scopes: `fusion-studio-server/lib/file-mutations/fact-replay.js` (publishCommand; publishResource); `fusion-studio-server/lib/subscriptions/admission.js` (STATIC_PUBLISHERS; bootstrapAdmission; createPublisher).
- **PP-CUR08**: Custom route has a local URL wrapper and iframe rendering; these paths do not establish a generic hybrid operation interface. Owner `fusion-studio-client/src/components/browser/CustomViewer.tsx` (CustomViewer; validateCustomViewerUrl); dependent scopes: `fusion-studio-client/src/components/ContentArea.tsx` (ContentArea); `fusion-studio-client/src/components/iframe/IframeSurface.tsx` (IframeSurface); `fusion-studio-client/src/components/iframe/core/useIframeNavigation.ts` (useIframeNavigation; handleLoad).
- **PP-CUR09**: Purpose-built current view-path mutation checks exist; they are not proof of complete future plugin capability enforcement. Owner `fusion-studio-server/lib/views/protected-path-policy.js` (assertGenericViewMutationAllowed; isProtectedAiNamespace); dependent scopes: `fusion-studio-server/lib/file-mutations/save-controller.js` (save).

## Exact mandatory source inventory

| File | Kind | Execution SHA-256 | Preparation comparison |
|---|---|---|---|
| `AGENTS.md` | guidance | `41dc4e9dc4d58e7505cb6fc37b500129502231293894b5f90eda9398315e001d` | unchanged |
| `fusion-studio-server/AGENTS.md` | guidance | `00d56bfd0e50a512bd1d8e76110c6882ce7d9cbdac58782839ee6426c1d54fd2` | unchanged |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/001-Style_Guide/PAGE.md` | guidance | `28ae2301be3115e22b6d69691fb5208e2625945998393071874b9a1fbee70629` | unchanged |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/002-Creating_Wikis/PAGE.md` | guidance | `5e2c32b2c6e8ec2106ed9660f019525bc87f62f551f29eec368e85feaf037dc0` | unchanged |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/003-Updating_Wikis/PAGE.md` | guidance | `669827c9f3cbd8970d074ba55defa333a3a14b154ffe97a9e27047b4d1c674d9` | unchanged |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/004-Audit_Workflow/PAGE.md` | guidance | `c995d59bde9a95dacaa9f9ae844d1d9701b05c6f8a259b3ced9fe9b6608c3288` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md` | standards | `f1adcce948629e4d6b3221561c452558ebcbdc06c8de2532a96b76b790575b56` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md` | standards | `4c5fcbf62912c9e8ff6d3d0e1ec07016145e1f1c90c792a162dfcc3ca1b0bfba` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md` | standards | `8a2bdb1cc23e095ea5462e6c74a30e54f828a16db3e5a4d3609049378ba9ee60` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md` | standards | `f81aa22c196fc63e70fafb2229f7793d8509e485c3588d322c49e71f71f3f553` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/006-Harness_Adapters/PAGE.md` | standards | `5ece90e88dac136f7ec464b0219a3eb242b7837d118dbbdaba57de673b8a5919` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md` | standards | `bd3e7be468289ac0a6ee6502cd8b9fc340f03fd7568deb59370ed00cc3b2a7a3` | unchanged |
| `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md` | standards | `e7319750bd27b7ccdad8e5e451b9779044e8fc7a713fc6d461113b409b39018d` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/README.md` | design_history | `6b33002b3c56dfb4e1715259e320b4632a53eea5cd05fa426452d7fc1243c7f7` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/VISION.md` | design_history | `67e1899c239274230c1053b1cdc39613cf6b1074a0f0784e3a13adbae334d179` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/HANDOFF.md` | design_history | `8e0af0ae450a77cf9734f216e86ed5927187a6c4ddb5d3604c29e491f20f2c00` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/OBSERVATIONS.md` | design_history | `3c10be17ddc8c605caf1c4f7c38ed41620016f45ac0c38d28dbaf2e362d1c631` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/TODO.md` | design_history | `d6da622536c8c17328bbd2fafc72cbf376afeec1c445f3a286d6687a04d868e3` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/plugin-system-kickoff.md` | design_history | `ca659dbc928be6f6ec87e0968599fc10a73fb9545ec3ef72f37843d9038de414` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/provenance-research.md` | design_history | `a8cdd7742b477ac08394abde9f1af6ac30abaad1922c40acca306ea9807bd2ee` | unchanged |
| `/Users/rccurtrightjr./projects/plug-ins/ai/RC-MacAir-15/Captures/002-Specs/PLUGINS-VIEW-MOCKUP/SPEC-01-PLUGINS-VIEW-MOCKUP.md` | design_history | `e22d7837ea99d5f5b9ee7a8a94bc04358e1f24864200b41b72081bd037170ad2` | unchanged |
| `ai/RC-MacAir-15/Captures/030-Plugin_System/decisions.md` | design_history | `dae7996623d94c1b6ae41cb01faa44df519dc0b09ca383cb7f35a5ef14f89434` | unchanged |
| `ai/RC-MacAir-15/Captures/030-Plugin_System/plugin-system-vision.md` | design_history | `3cfa46ef0fb57f50f3ed82fd1f04f94004ecad0fdaf053a97465bbf11690c0c0` | unchanged |
| `ai/RC-MacAir-15/Captures/032-Plugin_Backend/backend-architecture.md` | design_history | `79631f233222e41dbb64813d8508b123930c37320963d2aced42e1fa27bd2bfc` | unchanged |
| `ai/RC-MacAir-15/Captures/029-Composable_Views/composable-views-vision.md` | design_history | `525bc29cc3538b158d4fe2a3aff7c2d7c72dfd01b42a982c86b9cc833b33981f` | unchanged |
| `ai/RC-MacAir-15/Captures/037-Plugin_Integration_And_Parallel_Roadmaps/handoff.md` | design_history | `bf88be4f3d2795011a508b12d3233c5e851c6a8d72c94880413643a64e44977f` | unchanged |
| `ai/RC-MacAir-15/Captures/037-Plugin_Integration_And_Parallel_Roadmaps/integration-overview.md` | design_history | `0f17bfe480b8d133d664f61ea40522881d05bf3499fd0633ba4712d0872684e1` | unchanged |
| `ai/RC-MacAir-15/Captures/036-Workspaces_And_Views_Wiki/HANDOFF.md` | design_history | `45239f709d4a6bdf1cfdeab0d69837ec04041c297e9c5568363f3d386b2eecb5` | unchanged |
| `ai/RC-MacAir-15/Wiki/007-Chat_System/000-Overview_and_References/PAGE.md` | live_authority | `be775a56a14b49b12ae47423a2c1e0c739091bc28174f28448185c00daab30ab` | unchanged |
| `ai/RC-MacAir-15/Wiki/010-Events_And_Ledger/000-Events_And_Ledger/002-Decisions/PAGE.md` | live_authority | `eb673397e881d241858ac47d4ad513c97d843f491f1190cbaf525e4a0f987eee` | unchanged |
| `ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md` | live_authority | `81fd3621d5273b98e69a142f4899e2604f5e04f31773a0e9a024637cd6a8f7a3` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/PAGE.md` | owned_existing_articles | `58165cc333b5b74108ab70dad2f26246207104fbff81eaac51800fbf6aafcbec` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/001-Vision/PAGE.md` | owned_existing_articles | `51a147b459c50632d2236fc01d3c0fe556a13f5cd4c14d03d578232469c98bfb` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/002-Decisions/PAGE.md` | owned_existing_articles | `77495240714010228061df9e2133488aa8eaaefbe01f6e87b7c7f4b147e53628` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/000-Workspaces_And_Views/003-Unfinished_Work/PAGE.md` | owned_existing_articles | `1bbc11c6794ae2fbee8971716a6551ef54117b3b619c65f441e1ed161fa9cca2` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/002-View_Architecture/PAGE.md` | owned_existing_articles | `37255baf982013ea6afb3728eb7a1b69f12fa2b29ecb9fed2f3fd9b1d3448ad2` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/006-Custom_Iframe/PAGE.md` | owned_existing_articles | `50e99e6508f17819bc35b64964a64b7f2b5ddaa361535a66d093092e5e7614a6` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/021-Workspace_Compositions/PAGE.md` | owned_existing_articles | `df46717db98874b8e53cc6abbb615e87f9b156aa40cf99d7929af06a75646bdd` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/022-View_Configuration_And_Agents/PAGE.md` | owned_existing_articles | `a0aa796aa3ae7cc41e6d6ab619feb1c55e05d11e56afb5e176c2d7b1bcf0456f` | unchanged |
| `ai/RC-MacAir-15/Wiki/001-Workspaces_And_Views/007-File_View/PAGE.md` | owned_existing_articles | `b1a17c0ab9d5316d32d9d9caa1a72c3ad0da82d8795896f563803818be78bf55` | unchanged |
| `ai/RC-MacAir-15/Wiki/000-Wiki_Guidance/PAGE.md` | owned_existing_articles | `74cf6222a22bed763e08fd4f2df301447fe1dfedc067bfc352ba5a6d5a791d30` | unchanged |
| `fusion-studio-client/src/components/ContentArea.tsx` | code_entry_points | `f3b02f929a2baf1ba18025b41883bf351759815c2204537ccf61454e66ef1327` | unchanged |
| `fusion-studio-client/src/components/view-tabs/componentTabConnectedOwner.ts` | code_entry_points | `3b408af90beb3c514d238a10b7c436c6229167f0b917a036d93a121ef93d0c63` | unchanged |
| `fusion-studio-client/src/components/view-tabs/componentTabLauncherCatalog.ts` | code_entry_points | `bd144eddc1866b16e39ae8a2d9bfb1d2aa7ceaed1cc222e3ef1231c158c9c8c7` | unchanged |
| `fusion-studio-client/src/components/view-tabs/fileConnectedPresenterTargets.ts` | code_entry_points | `e3dcc0232b6f0edabbd6f7df7bfe48e4f68c12a5bb3c66efb124ebb1068d2805` | unchanged |
| `fusion-studio-client/src/components/view-tabs/ComponentTabPanel.tsx` | code_entry_points | `d407ee5a1eb5df41ea8dac3666475e745d931cf0eceaffd4064da45945b3fb53` | unchanged |
| `fusion-studio-client/src/components/file-explorer/FilePickerDrawerLayer.tsx` | code_entry_points | `8791acc3bb374377781432b8fb2255e2add1f07a70d756a1a8e64c835174c565` | unchanged |
| `fusion-studio-client/src/components/file-explorer/FileViewer.tsx` | code_entry_points | `d9790b5acc8299937ebea21e65a81123f82797be992ebd85036c7af3daefcaea` | unchanged |
| `fusion-studio-client/src/components/iframe/IframeSurface.tsx` | code_entry_points | `cb225687f7dd1976266e2712b815e93afb43087831629113ba5349609e1c8200` | unchanged |
| `fusion-studio-client/src/components/browser/CustomViewer.tsx` | code_entry_points | `94daad613f4f0f9bbdcf5e278ec29bec2133a414d3c6532e99a3fb3390a67792` | unchanged |
| `fusion-studio-server/lib/workspace/create-service.js` | code_entry_points | `09d5685c5c368e329fa18e68da798615c1aafc736b0d16b8f2008ba0e083e641` | unchanged |
| `fusion-studio-server/lib/views/index.js` | code_entry_points | `3adaacc60a3fa8c155a9fe9091e96e347400ba93c34b26235b2dc946afe776a3` | unchanged |
| `fusion-studio-server/lib/views/protected-path-policy.js` | code_entry_points | `424385815b58dcd432f16c83ae6004bb5ee096d9cad5a5006c5206946d269c8a` | unchanged |
| `fusion-studio-server/lib/harness/opencode/index.js` | code_entry_points | `8c1c6e9e9a8771b5d212bfad0d959e78e608fc0beb304399a3c3e450a13f430b` | unchanged |
| `fusion-studio-server/lib/file-mutations/save-controller.js` | code_entry_points | `9ef47d8de84e6e76274bb1c1928d6238415cfcd7a5a2c3c5d7947a3cc227a60d` | unchanged |
| `fusion-studio-server/lib/subscriptions/admission.js` | code_entry_points | `dc709809975c64c05a71b6c1c6fa5a87af764b0ffb633ef424489159adf8596d` | unchanged |
| `fusion-studio-server/scripts/wiki.js` | code_entry_points | `ebc3203f165ebda1cfcc9e5c1b467dde9243c99ebf7a2b199364b280e243812e` | unchanged |
| `fusion-studio-server/lib/wiki/audit/toc-sync.js` | code_entry_points | `8fa1b29f766bb7142ab89f54b3cf8606cecab0ede458d04004893e3c0ec40b5f` | unchanged |

Additional inspected code hashes are in ADDITIONAL-SOURCES.json. Final execution must reread current hashes and reassess affected claims. Planned claim output anchors and reviewer conclusions must be completed by the owning article slice; S00 does not certify unwritten prose.

## Excluded coverage

No old capture or external plugin document is modified. Legacy Chat internals, unrelated Wiki/Voice specialist content, complete plugin ABI, full System protection, template update lifecycle, harness-specific discovery/collision semantics, external-store transaction policy and iframe transport/SDK remain outside this documentation verification.

## S02 fresh inspection

S02-SOURCE-INSPECTION.json records exact current hashes and inspected producer/consumer symbols for bundled scaffolding, registry consumption, path-policy use, launcher bindings and existing connected-owner stores. The two S02 current-foundation sections are source-only observations, not runtime certification. Existing S00/S01 evidence is retained. No prior claim hash drift was observed in these sources.

## S03 source inspection

See S03-SOURCE-INSPECTION.json for exact source hashes and bounded symbols. The tab-owner/Files store chain, save/preimage/context/replay/admission chain, and custom iframe producer/render/navigation chain were inspected fresh. Existing product test source was inspected for contract boundaries, not executed. No source drift found against carried claim hashes. No product runtime certification or exhaustive absence/security proof.

## S04 execution inspection

See `S04-SOURCE-INSPECTION.json` for fresh exact hashes and symbol scope. Activation checks the workspace manager root, compat passes that root unchanged, and OpenCode uses it for both --dir and process cwd. The registry loads System/Views and does not establish the target context assembly. Current source assertions are bounded observations, with no runtime or product test certification. All nine S04 predecessor hashes matched BASELINE before writes. The validator will report these mapped source-article edits as source drift; EDIT-RECEIPTS attributes them to S04, and normative preparation hashes remain untouched.

## S05 final source reassessment

S05-SOURCE-INSPECTION.json records all mandatory current source hashes, the 29 unique claimed producer/consumer hashes and eight unchanged tooling/baseline/interface checks. Ten mandatory drift entries are intentional mapped article changes: the nine S04 WV edits and S05 Guidance, including final metadata stamps. Normative preparation hashes remain intact. No claimed code source drift was found; earlier bounded evidence remains valid. New PP gaps were independently traced through the component/Files, iframe and mediated-save owners, not inferred from a grep absence. Tests were read for boundaries only; no product runtime, build, security or universal absence certification. Timestamp is edit time, not source freshness.
