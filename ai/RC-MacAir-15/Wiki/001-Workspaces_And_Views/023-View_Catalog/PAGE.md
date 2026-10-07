---
name: View Catalog
description: Introductions and current availability for 13 bundled view templates plus the System surface.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
  last-modified: "2026-09-21T13:37:22Z"
---

The current source tree bundles **13 view templates**. A template is a provisioning input, not proof of a working mounted view or installed instance. The renderer currently dispatches by known panel ID or config type; the approved plugin model is a future replacement for this fixed catalog path. The New Workspace profile selects Capture, Files, Wiki, Issues and Agents. Other entries can be optional or profile-specific. See [Workspace Compositions](../021-Workspace_Compositions/PAGE.md) for the intended selection model.

## Bundled template introductions

| View | Current source-inspected status |
|---|---|
| [Browser](../005-Browser/PAGE.md) | Configured browser iframe; optional. |
| [Capture](../015-Capture_View/PAGE.md) | Mounted React surface; default. |
| [Office](../014-Office_Viewer/PAGE.md) | Mounted React surface; in startup profiles, not New Workspace default. |
| [Library](../019-Library_View/PAGE.md) | Template; no built-in renderer. |
| [Media](../020-Media_View/PAGE.md) | Template; no built-in renderer. |
| [Email](../017-Email_View/PAGE.md) | Mounted mail/document UI; mailbox demo data. |
| [Calendar](../016-Calendar_View/PAGE.md) | Mounted UI; demo load and incomplete write-back. |
| [Contacts](../018-Contacts_View/PAGE.md) | Disabled experimental template; no built-in renderer. |
| [Custom](../006-Custom_Iframe/PAGE.md) | Configured local iframe or app path. |
| [Files](../007-File_View/PAGE.md) | Mounted React surface; default. |
| [Issues](../009-Issues_View/PAGE.md) | Mounted ticket board; default. |
| [Wiki](../004-Wiki_View/000-Wiki_View/PAGE.md) | Mounted React surface; default. |
| [Agents](../008-Agent_View/PAGE.md) | Mounted React surface; default. |

## Other surfaces and specialist material

[System Manager](../011-System_Manager/PAGE.md) has its own mounted `system-viewer` surface but is **not** one of the 13 bundled view templates above. Voice input and document editors are capabilities or content surfaces, not additional template types inferred from this census. The [Wiki architecture](../004-Wiki_View/001-Architecture/000-Architecture/PAGE.md) and [Voice Input](../010-Voice_Input/000-Voice_Input/PAGE.md) trees remain retained specialist references, outside this reconstruction's recertification scope.

The actual workspace label can differ from the template name: an Office instance labeled Drive does not create a global Drive type. Read each introduction for its content source, current limits and code owners.
