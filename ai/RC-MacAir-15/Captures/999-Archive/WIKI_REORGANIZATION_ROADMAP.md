# Wiki Reorganization Roadmap

Date: 2026-06-09

Repo root: `/Users/rccurtrightjr./projects/fs-dev`

Active wiki root: `/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki`

Important: `ai/` is ignored by git in this workspace. Wiki edits under
`ai/<machine>/Wiki/` are real filesystem edits, but `git status` will
not reliably show them unless a file was already tracked before the ignore rule.
Keep roadmap/status artifacts in `docs/` when they need to survive handoff.

## Current State

The wiki has been migrated to the folder-first model described by:

`/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/PAGE.md`

The current runtime wiki source of truth is:

`/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/`

The old generated/mirrored content tree was removed:

`/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/`

The app code points at the folder-first wiki:

- `fusion-studio-client/src/lib/resource-path.ts`
- `fusion-studio-client/src/components/wiki/WikiExplorer.tsx`
- `fusion-studio-server/lib/views/index.js`
- `fusion-studio-server/lib/wiki/wiki-tree.js`

Recent cleanup already completed:

- Removed old `Model_Config` article folder.
- Removed old `Chat_Panel_Architecture` article folder.
- Removed old `Chat_Thread_Lifecycle` article folder.
- Removed stale `Coding-CLIs` mini-wiki.
- Renamed `002-Chat` to `002-Chat_System`.
- Moved `002-Chat_System` to `001-Workspaces_And_Views/003-Chat_System`.
- Moved `009-Wiki` to `001-Workspaces_And_Views/004-Wiki_View`.
- Folded workspace paradigm, workspace agent model, workspace index, and
  progressive disclosure material into `001-Workspaces_And_Views/`.
- Split legacy Browser Views into `001-Workspaces_And_Views/005-Browser` and
  `001-Workspaces_And_Views/006-Custom_Iframe`.
- Moved legacy enforcement pages into `005-Enforcement` and removed the old
  duplicate `003-Enforcement` heading.
- Added frontmatter to all Chat System articles using the contract from:
  `ai/<machine>/Wiki/001-Workspaces_And_Views/004-Wiki_View/001-Architecture/006-Frontmatter_Model/PAGE.md`

## Current Top-Level Shape

Slice 1 skeleton was added on 2026-06-09. Slices 2-4 moved or condensed the
workspace/view docs into `001-Workspaces_And_Views/`. The duplicate legacy
`003-Enforcement/` heading was removed. The legacy `001-Project/` folder still
exists for pages that have not moved yet.

Current top-level wiki folders:

```text
ai/<machine>/Wiki/
  PAGE.md
  001-Project/
  001-Workspaces_And_Views/
  002-Server_And_Runtime/
  002-System_Tools/
  003-Automation_And_Agents/
  004-Integrations_And_Tools/
  005-Enforcement/
  006-Operations/
```

Current `001-Project/` article folders:

```text
001-Home/
004-Path_Resolution/
013-Background_Agents/
014-Background_Services_Audit/
017-GitLab/
018-Hooks/
019-Run_Auditing/
020-Screenshot_Capture/
021-Setup_Wizard/
022-Ticket_Routing/
023-Warmth_Settings/
```

Current `001-Workspaces_And_Views/` article folders:

```text
001-Workspace_Paradigm/
002-View_Architecture/
003-Chat_System/
004-Wiki_View/
005-Browser/
006-Custom_Iframe/
```

This still reads like a historical page dump. The target should be a smaller set
of durable domains.

## Target Shape

Preferred high-level shape:

```text
ai/<machine>/Wiki/
  PAGE.md
  001-Workspaces_And_Views/
  002-Server_And_Runtime/
  003-Automation_And_Agents/
  004-Integrations_And_Tools/
  005-Enforcement/
  006-Operations/
```

Do not keep a separate `Project` heading if it only contains product/system
architecture. The root wiki can expose durable system domains directly.

### 001-Workspaces_And_Views

Purpose: product/workspace/view architecture and user-facing surfaces.

Proposed shape:

```text
001-Workspaces_And_Views/
  PAGE.md                         # overview/map
  001-Workspace_Paradigm/
  002-View_Architecture/
  003-Chat_System/
  004-Wiki_View/
  005-Browser/
  006-Custom_Iframe/
  007-File_View/
  008-Agent_View/
  009-Issues_View/
```

`Workspace_Paradigm` should contain the conceptual rulebook:

- what a workspace is
- why workspaces exist
- workspace ownership boundaries
- reader workspaces vs executor workspaces
- view folders and view content roots
- how opening/browsing differs from activation
- how workspace-level configuration is discovered
- what should not be coupled across workspaces

`Workspaces_And_Views/PAGE.md` should be a short navigation map, not a long
architecture article.

Current source pages to fold here:

- `001-Project/008-Workspaces/PAGE.md`
- `001-Project/006-Workspace_Agent_Model/PAGE.md`
- `001-Project/007-Workspace_Index/PAGE.md`
- `001-Project/005-Progressive_Disclosure/PAGE.md`
- `001-Project/002-Chat_System/`
- `001-Project/009-Wiki/`
- `001-Project/012-Browser_Views/`

Notes:

- The Agent View is underdeveloped. Create only a concise `Agent_View/PAGE.md`
  placeholder if needed, with a clear "planned/underdeveloped" status.
- The Issues View/ticketing surface is incomplete. If included here, note that
  backend ticketing logic is not complete and avoid over-documenting behavior
  that does not exist yet.
- Browser and Custom Iframe must stay separate. Browser is the internet-capable
  browsing surface. Custom Iframe is a single local-server display for user-built
  custom views and should not be documented or implemented as general internet
  browsing.

### 002-Server_And_Runtime

Purpose: backend ownership, runtime state, persistence, WebSockets, filesystem
resolution, and process/service behavior.

Proposed shape:

```text
002-Server_And_Runtime/
  PAGE.md
  001-Runtime_Overview/
  002-Thread_Runtime/
  003-WebSocket_Protocol/
  004-SQLite_Persistence/
  005-Harness_Runtime/
  006-Background_Services/
  007-Path_Resolution/
```

Current source pages to fold here:

- `001-Project/002-Chat_System/001-Architecture/006-Runtime_Model/PAGE.md`
- `001-Project/002-Chat_System/001-Architecture/004-Protocol/PAGE.md`
- `001-Project/004-Path_Resolution/PAGE.md`
- `001-Project/014-Background_Services_Audit/PAGE.md`
- relevant parts of `001-Project/018-Hooks/PAGE.md`
- relevant parts of `001-Project/023-Warmth_Settings/PAGE.md`

Notes:

- Chat System should still own user-facing chat architecture, but server/runtime
  articles can link to the Chat System runtime/protocol pages or pull backend
  details into a shared runtime section.
- Avoid creating duplicate "protocol" docs. Either keep protocol under Chat
  System and link to it, or move the protocol article under Server And Runtime
  and link back from Chat System.

### 003-Automation_And_Agents

Purpose: background agents, ticket routing, orchestration, run auditing, and
future automation loops.

Proposed shape:

```text
003-Automation_And_Agents/
  PAGE.md
  001-Agent_Model/
  002-Ticketing/
  003-Orchestration/
  004-Run_Auditing/
  005-Background_Agents/
```

Current source pages to fold here:

- `001-Project/013-Background_Agents/PAGE.md`
- `001-Project/022-Ticket_Routing/PAGE.md`
- `001-Project/019-Run_Auditing/PAGE.md`
- relevant planned material from `001-Project/008-Workspaces/PAGE.md`

Notes:

- Ticketing is only about half finished.
- Backend ticketing logic is not complete.
- Do not create deep subfolders for planned concepts unless there is enough
  stable information to justify them.
- A concise `Ticketing/PAGE.md` can document the intended state and current
  implementation gap.
- Keep future `/orchestrate` ideas as planned concepts unless code exists.

### 004-Integrations_And_Tools

Purpose: external systems, app/tool integrations, CLI/tooling references, setup
adjacent integrations.

Proposed shape:

```text
004-Integrations_And_Tools/
  PAGE.md
  001-GitLab/
  002-Secrets_Manager/
  003-Hooks/
  004-Screenshot_Capture/
  005-Custom_Theme_CSS/
```

Current source pages to fold here:

- `001-Project/017-GitLab/PAGE.md`
- `001-Project/018-Hooks/PAGE.md`
- `001-Project/020-Screenshot_Capture/PAGE.md`
- `002-System_Tools/001-Custom_Theme_CSS/PAGE.md`
- `002-System_Tools/002-Secrets_Manager/PAGE.md`

Notes:

- The old `System_Tools` top-level heading can probably disappear after these
  pages move.
- Keep external integration docs factual. If an integration is planned or only
  partially implemented, say that explicitly.

### 005-Enforcement

Purpose: standards and rules that constrain implementation and state.

Proposed shape:

```text
005-Enforcement/
  PAGE.md
  001-Code_Standards/
  002-Themes_And_State/
```

Current source pages:

- `003-Enforcement/001-Code_Standards/PAGE.md`
- `003-Enforcement/002-Themes_And_State/PAGE.md`

Notes:

- This section can remain top-level because it is a rulebook, not a feature.
- Update incoming/outgoing frontmatter after moving.

### 006-Operations

Purpose: setup, maintenance, startup, packaging, troubleshooting, and operator
procedures.

Proposed shape:

```text
006-Operations/
  PAGE.md
  001-Setup/
  002-Smoke_Tests/
  003-Packaging/
  004-Troubleshooting/
```

Current source pages to fold here:

- `001-Project/021-Setup_Wizard/PAGE.md`
- selected operational notes from `001-Project/014-Background_Services_Audit/PAGE.md`
- any future packaging docs if they are migrated into wiki

Notes:

- Do not mix architecture decisions with one-off operational recipes.
- If a page is mostly a historical audit, either condense it into a lesson or
  archive it outside the main navigation.

## Pages To Audit First

Start with these because they are most likely stale or duplicative:

1. `ai/<machine>/Wiki/001-Project/008-Workspaces/PAGE.md`
   - Likely source for `Workspaces_And_Views/PAGE.md` and
     `Workspace_Paradigm/PAGE.md`.
   - Check for old workspace assumptions and old model-config references.

2. `ai/<machine>/Wiki/001-Project/006-Workspace_Agent_Model/PAGE.md`
   - Contains stale `api.json` / hot-swap assumptions.
   - Fold durable conceptual material into `Workspace_Paradigm` or
     `Automation_And_Agents/Agent_Model`.

3. `ai/<machine>/Wiki/001-Project/007-Workspace_Index/PAGE.md`
   - Likely belongs under `Workspaces_And_Views/View_Architecture`.
   - Verify current code still uses described index behavior.

4. `ai/<machine>/Wiki/001-Project/005-Progressive_Disclosure/PAGE.md`
   - Conceptual and probably useful, but not a top-level project article.
   - Fold into `Workspace_Paradigm` or keep as a small child page only if it
     remains actionable.

5. `ai/<machine>/Wiki/001-Project/012-Browser_Views/`
    - Deep, detailed subtree.
    - Verify whether current browser/custom iframe implementation still matches.
    - Split into `Workspaces_And_Views/Browser` and
      `Workspaces_And_Views/Custom_Iframe` instead of preserving one merged
      Browser Views section.

6. `ai/<machine>/Wiki/001-Project/013-Background_Agents/PAGE.md`
   - Move under `Automation_And_Agents`.
   - Mark planned/incomplete sections clearly.

7. `ai/<machine>/Wiki/001-Project/022-Ticket_Routing/PAGE.md`
   - Move under `Automation_And_Agents/Ticketing`.
   - Note ticketing is partially finished and backend ticketing logic is not
     complete.

8. `ai/<machine>/Wiki/001-Project/014-Background_Services_Audit/PAGE.md`
   - Decide whether it is durable architecture, operational audit, or archive.
   - If mostly historical, fold durable lessons into `Server_And_Runtime` or
     `Operations` and remove from main nav.

9. `ai/<machine>/Wiki/001-Project/023-Warmth_Settings/PAGE.md`
   - Audit against current chat runtime decisions.
   - Likely fold into `Chat_System/Runtime_Model` or `Server_And_Runtime`.

10. `ai/<machine>/Wiki/001-Project/009-Wiki/`
    - This subtree is likely valuable and already aligned with the
      folder-first model.
    - Move under `Workspaces_And_Views/Wiki_View` or keep as `Wiki_View`
      depending on final naming.

## Pages Probably Ready To Move As-Is

These looked like useful durable content during the current cleanup:

- `ai/<machine>/Wiki/001-Project/002-Chat_System/`
- `ai/<machine>/Wiki/001-Project/009-Wiki/`
- `ai/<machine>/Wiki/003-Enforcement/001-Code_Standards/PAGE.md`
- `ai/<machine>/Wiki/003-Enforcement/002-Themes_And_State/PAGE.md`

Still update frontmatter and links after moving.

## Pages Likely To Condense

These may not need full standalone sections:

- `001-Project/004-Path_Resolution/`
- `001-Project/005-Progressive_Disclosure/`
- `001-Project/007-Workspace_Index/`
- `001-Project/018-Hooks/`
- `001-Project/020-Screenshot_Capture/`
- `001-Project/023-Warmth_Settings/`

Condense when the page is:

- mostly conceptual but short
- only relevant as a subsection of a broader domain
- stale in implementation details but still useful as a lesson

## Pages To Treat Carefully

`001-Project/012-Browser_Views/` is large and nested. Do not blindly flatten it.
First verify whether its custom viewer, iframe, security, and WebContentsView
claims match current code.

`001-Project/014-Background_Services_Audit/` may be historical. Preserve durable
lessons, but avoid keeping an audit as a prominent architecture page if it no
longer guides day-to-day work.

`001-Project/022-Ticket_Routing/` likely describes desired behavior more than
completed backend behavior. Keep it, but label current implementation status
clearly.

## Migration Method

Use small, reviewable slices.

For each slice:

1. Read the source page and nearby sibling pages.
2. Check referenced source files when claims could be stale.
3. Move or rewrite into the target section.
4. Add frontmatter using the contract in:
   `ai/<machine>/Wiki/001-Workspaces_And_Views/004-Wiki_View/001-Architecture/006-Frontmatter_Model/PAGE.md`
5. Update relative links.
6. Delete old folders once nothing points to them.
7. Run validation checks.

Do not preserve moved stubs unless there is a real runtime link that would break.
The folder-first wiki is small enough that stale stubs create more confusion than
value.

## Suggested Execution Slices

### Slice 1: Create Target Skeleton - Complete

Created the new top-level folders:

```text
001-Workspaces_And_Views/
002-Server_And_Runtime/
003-Automation_And_Agents/
004-Integrations_And_Tools/
005-Enforcement/
006-Operations/
```

Added short `PAGE.md` files with frontmatter and navigation maps. No large
content was moved and no old folders were deleted.

Acceptance:

- `find ai/<machine>/Wiki -maxdepth 2 -type d | sort` shows the target
  top-level folders.
- Root `Wiki/PAGE.md` points to the new top-level domains.
- No old folders deleted yet.

### Slice 2: Move Chat System And Wiki View - Complete

Moved:

- `001-Project/002-Chat_System/` -> `001-Workspaces_And_Views/003-Chat_System/`
- `001-Project/009-Wiki/` -> `001-Workspaces_And_Views/004-Wiki_View/`

Updated links from:

- root `Wiki/PAGE.md`
- `Chat System` pages
- `Wiki View` pages
- any `Project` pages that remain temporarily

Acceptance:

- No `001-Project/002-Chat_System` references remain.
- No `001-Project/009-Wiki` references remain.
- Chat System frontmatter remains present on all pages.

Notes:

- Old source folders were deleted by moving the directories into
  `001-Workspaces_And_Views/`.
- Roadmap historical references may still mention the old source paths when
  describing migration inputs.

### Slice 3: Build Workspace Paradigm - Complete

Created:

- `001-Workspaces_And_Views/001-Workspace_Paradigm/PAGE.md`
- `001-Workspaces_And_Views/002-View_Architecture/PAGE.md`

Folded from:

- `001-Project/008-Workspaces/PAGE.md`
- `001-Project/006-Workspace_Agent_Model/PAGE.md`
- `001-Project/007-Workspace_Index/PAGE.md`
- `001-Project/005-Progressive_Disclosure/PAGE.md`

Removed stale `api.json` / model hot-swap assumptions from the migrated model.

Acceptance:

- Workspace model no longer claims stale Kimi/config overlay behavior.
- View architecture explains folder-first wiki and view content roots.
- Old source folders are deleted only after their durable content is migrated.

Notes:

- `Workspace_Index` was condensed as a lesson, not preserved as current wiki
  behavior. The current wiki uses folder discovery plus `PAGE.md`, not
  `index.json` as the wiki navigation source of truth.

### Slice 4: Split Browser And Custom Iframe - Complete

Split and condensed:

- `001-Project/012-Browser_Views/` ->
  `001-Workspaces_And_Views/005-Browser/`
- `001-Project/012-Browser_Views/` ->
  `001-Workspaces_And_Views/006-Custom_Iframe/`

Before moving, verify key claims against current code:

- browser path: `fusion-studio-client/src/components/browser/WebBrowser.tsx`
- custom iframe path: `fusion-studio-client/src/components/browser/CustomViewer.tsx`
- WebContentsView migration status
- security/CSP/URL validation behavior

Acceptance:

- Browser is documented as internet-capable browsing.
- Custom Iframe is documented as a local-server-only custom view display.
- Legacy Browser Views content is split or condensed into the correct surface.
- Stale or speculative claims are marked as historical/planned or removed.

Notes:

- The legacy nested Browser Views tree was not moved wholesale because it mixed
  Browser, Custom Iframe, and WebContentsView claims.
- Browser now documents the current `WebBrowser.tsx` tabbed iframe browser.
- Custom Iframe now documents the current `CustomViewer.tsx` local-only iframe
  display and treats WebContentsView material as historical/planned.

### Slice 5: Create Server And Runtime

Create/fill:

- `002-Server_And_Runtime/001-Runtime_Overview/`
- `002-Server_And_Runtime/002-Thread_Runtime/`
- `002-Server_And_Runtime/003-WebSocket_Protocol/`
- `002-Server_And_Runtime/004-SQLite_Persistence/`
- `002-Server_And_Runtime/005-Harness_Runtime/`
- `002-Server_And_Runtime/006-Background_Services/`
- `002-Server_And_Runtime/007-Path_Resolution/`

Fold or link from:

- Chat System runtime/protocol docs
- `001-Project/004-Path_Resolution/PAGE.md`
- `001-Project/014-Background_Services_Audit/PAGE.md`
- `001-Project/023-Warmth_Settings/PAGE.md`

Acceptance:

- No duplicated contradictory protocol/runtime docs.
- Server/runtime pages link back to Chat System where user-facing chat behavior
  is documented.

### Slice 6: Automation And Agents

Create/fill:

- `003-Automation_And_Agents/001-Agent_Model/`
- `003-Automation_And_Agents/002-Ticketing/`
- `003-Automation_And_Agents/003-Orchestration/`
- `003-Automation_And_Agents/004-Run_Auditing/`
- `003-Automation_And_Agents/005-Background_Agents/`

Fold from:

- `001-Project/013-Background_Agents/PAGE.md`
- `001-Project/022-Ticket_Routing/PAGE.md`
- `001-Project/019-Run_Auditing/PAGE.md`

Acceptance:

- Agent View is explicitly marked underdeveloped if referenced.
- Ticketing is explicitly marked partially complete.
- Backend ticketing logic is explicitly marked incomplete.
- No page presents planned orchestration as implemented.

### Slice 7: Integrations, Enforcement, Operations

Move/fold:

- GitLab, Hooks, Screenshot Capture, Secrets Manager, Custom Theme CSS ->
  `004-Integrations_And_Tools/`
- Code Standards and Themes And State -> `005-Enforcement/`
- Setup Wizard and relevant operating notes -> `006-Operations/`

Acceptance:

- `002-System_Tools/` and `003-Enforcement/` old top-level headings are removed
  or replaced by the new target folders.
- Code Standards path is updated wherever referenced.

### Slice 8: Remove Old Project Shell

After all durable content is moved:

- Delete `001-Project/` if empty or reduce it to a short redirect-free overview
  only if there is a strong reason to keep it.
- Prefer deleting it entirely if top-level domains replace it.

Acceptance:

- Root wiki contains only the agreed top-level domains.
- No stale `001-Project/...` links remain.

## Validation Commands

Run from repo root:

`/Users/rccurtrightjr./projects/fs-dev`

Check old references:

```bash
grep -R "001-Project/002-Chat\\|002-Chat/\\|Coding-CLIs\\|Model_Config\\|Chat_Panel_Architecture\\|Chat_Thread_Lifecycle" -n ai/<machine>/Wiki
```

Check all wiki pages have the expected frontmatter once migrated:

```bash
node -e "const fs=require('fs'),path=require('path');function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):(e.name==='PAGE.md'?[p]:[])})}const bad=[];for(const f of walk('ai/<machine>/Wiki')){const s=fs.readFileSync(f,'utf8');if(!s.startsWith('---\\nname: '))bad.push(f)};if(bad.length){console.log(bad.join('\\n'));process.exit(1)}console.log('wiki frontmatter ok')"
```

Check no removed folders remain:

```bash
find ai/<machine>/Wiki -maxdepth 3 -type d | sort
```

Check active code does not point at old `content/` wiki paths:

```bash
grep -R "wiki-viewer/content\\|views/wiki-viewer/content" -n fusion-studio-client/src fusion-studio-server/lib ai/<machine>/Wiki
```

Whitespace check:

```bash
git diff --check -- ai/<machine>/Wiki docs/WIKI_REORGANIZATION_ROADMAP.md
```

Optional UI smoke:

1. Restart Fusion Studio.
2. Open Wiki view.
3. Confirm top-level folders render in the expected order.
4. Open each moved section.
5. Confirm right sidebar shows child pages where expected.
6. Confirm page frontmatter renders title/description/metadata correctly.

## Handoff Notes For The Next Session

Start by reading:

- `docs/WIKI_REORGANIZATION_ROADMAP.md`
- `ai/<machine>/Wiki/PAGE.md`
- `ai/<machine>/Wiki/001-Workspaces_And_Views/004-Wiki_View/001-Architecture/006-Frontmatter_Model/PAGE.md`
- `ai/<machine>/Wiki/001-Workspaces_And_Views/003-Chat_System/PAGE.md`

Remember:

- The active wiki is folder-first.
- JSON indexes are not source of truth for wiki navigation.
- The old `content/` folder is deleted.
- The Chat System tree is the most recently cleaned and should be treated as the
  pattern for frontmatter and article naming.
- Some current articles describe planned or incomplete systems. Preserve useful
  concepts, but label incomplete implementation states plainly.
