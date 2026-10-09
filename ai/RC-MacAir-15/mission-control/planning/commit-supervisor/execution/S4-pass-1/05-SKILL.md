---
name: fusion-electron-restart
description: Fully rebuild, clear cached renderer/session state, and restart the Fusion Studio development app and its server from the intended checkout or worktree. In a Fusion Studio development context, use whenever the user asks to refresh or restart the app, Fusion, Fusion Studio, Electron, or the server, including when frontend changes appear stale. Do not use for unrelated apps or servers, or for the packaged Fusion Studio Alpha app, which follows the repository's separate Alpha workflow.
---

# Fusion Electron Restart

Use the repository's canonical `restart-fusion.sh` so a refresh or restart request completes the entire job without choosing among modes. It resolves the checkout/profile and process ownership, rebuilds the client, stops its owned process tree, clears that profile’s `Cache`, `Code Cache`, `GPUCache`, `Local Storage`, and `Session Storage`, then launches the selected checkout’s Electron and server. Readiness requires matching main/server/renderer identity and a sustained connected shell after `workspace:init`.

## Run it

1. Resolve and honor the checkout or worktree the user is testing. Read its `AGENTS.md` and confirm it contains `fusion-studio-client/`, `fusion-studio-server/`, and `restart-fusion.sh`.
2. Resolve machine and profile identity. `--machine` overrides inherited `FUSION_LOCAL_MACHINE`, otherwise the default is `RC-MacAir-15`. `--user-data /absolute/profile` overrides inherited `FUSION_APP_USER_DATA`. With neither profile setting, Electron uses the ordinary Fusion Studio profile while the unpackaged server retains the checkout’s `fusion-studio-server/data/fusion.db`; an explicit or inherited profile instead owns `<profile>/server-data/fusion.db`. Use an explicit disposable profile for isolated candidate testing.
3. Run the checkout's own script. A direct request to refresh or restart Fusion, the app, Electron, or the server authorizes this full restart and cache/session reset.

```bash
/absolute/path/to/checkout/restart-fusion.sh \
  --repo /absolute/path/to/checkout \
  --machine RC-MacAir-15
```

For an isolated candidate, add `--user-data /absolute/disposable/profile`. Use the selected checkout’s own script and installed Electron binary; another checkout’s runtime is never borrowed. The script refuses shared or conflicting profile ownership before signals/cache changes and preserves databases. It ignores global pidfiles and stops only the verified selected process tree.

Verification attaches through loopback CDP using the selected client’s existing `@playwright/test` dependency. It reads the existing shell connection indicator, which mounts after `workspace:init` and derives from the actual WebSocket OPEN state, then rechecks server ancestry/listener, paths, profile and machine. Missing probe/runtime support or a disconnected/wrong-profile app fails with readiness withheld. A listening port alone cannot pass.

Per-run launch, Electron and renderer logs are under `<profile>/fusion-restart/run-*/`, with scoped `TMPDIR`; server logs follow the actual default or profile mode. Failed runs retain their evidence and may leave the selected launched app available for diagnosis. A stale restart lock requires checking its writer/process ownership before removal. `--dry-run` reports resolved paths without restarting or proving runtime health; use it when target resolution is uncertain.

Never use this skill for `/Applications/Fusion Studio Alpha.app`, the Alpha source checkout, or the Alpha user-data profile. Follow the repository's separate Alpha restart workflow, including both Alpha identity variables.

Report the checkout, machine identity, and verified server URL. If verification fails, report the log path shown by the script and do not silently fall back to another checkout's product code.
