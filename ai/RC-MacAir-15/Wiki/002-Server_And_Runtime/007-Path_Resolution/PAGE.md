---
name: Path Resolution And Containment
description: Current workspace and view path resolution for reads and writes, including symlink behavior and containment limits.
metadata:
  source-files:
    - fusion-studio-server/lib/views/panel-paths.js
    - fusion-studio-server/lib/views/index.js
    - fusion-studio-server/lib/file-explorer.js
    - fusion-studio-server/lib/fs/symlinks.js
    - fusion-studio-server/lib/file-mutations/path-authority.js
    - fusion-studio-server/lib/http/panel-file-route.js
    - fusion-studio-server/lib/wiki/wiki-tree.js
  last-modified: "2026-09-28T04:16:38Z"
---

## Panel and workspace roots

The server obtains a project root from the connection's workspace session or the active workspace registry. `getPanelPath` resolves named panels through numbered V2 capsules under `ai/<machine>/System/Views`; a view's `content.json` can bind its content to another root. File Viewer defaults to the project root or its selected folder. Wiki Viewer defaults to `ai/<machine>/Wiki`; Capture and Office have separate machine-scoped roots. [View Architecture](../../001-Workspaces_And_Views/002-View_Architecture/PAGE.md) owns the content binding model.

The `__panels__` and `__workspace__` aliases expose V2 metadata. `__apps__` and `__settings__` are separate explicit pseudo-panels, not ordinary view tabs.

## Reads and symlinks

WebSocket file-tree and file-content requests check a requested path against the selected panel root using lexical, separator-aware relative-path checks. Configured content roots also reject lexical escapes from their allowed roots. Those checks constrain path spelling; they do not by themselves confine a symlink's physical target. The file browser deliberately follows readable user-created symlinks, including links outside its panel root, and exposes symlink information where available.

`path.resolve()` normalizes an absolute path without following symlinks; `fs.realpath()` follows them. The newer file-mutation path authority starts from the workspace registry, resolves physical workspace, panel and parent paths, checks physical containment, and rejects a symlink as the final target. The older `file_save_request` handler has its own write path and resolves a final symlink before writing. The HTTP panel-file route also has its own resolver and `sendFile` path. Assess each entry point before making a global containment claim.

## Wiki tooling

`wiki-tree.js` resolves the V2 wiki content root through the view resolver for terminal queries and uses physical paths for directory traversal and cycle protection. [Wiki View](../../001-Workspaces_And_Views/004-Wiki_View/000-Wiki_View/PAGE.md) owns the wiki-specific folder and query rules.
