# Handoff: Electron Model Packaging Slice 4 - Packaged Resource Smoke

## Status

READY FOR EXECUTION

## Objective

Verify that a packaged Electron build can start the app, spawn the server, pass resource paths, and resolve packaged prompts/model directories without downloading or loading Gwen/Qwen or Whisper models.

This is a smoke/repair slice. Prefer small targeted fixes over expanding the packaging system.

## Coordinator Constraints

These constraints come from the main orchestrator session and must be preserved before continuing.

### Preserve Dev Runtime DB Behavior

Do not reintroduce unconditional `FUSION_APP_USER_DATA` for dev Electron launches.

Required behavior:

```text
dev Electron:
  pass null/undefined userDataPath to spawnServer unless FUSION_APP_USER_DATA was explicitly set

packaged Electron:
  may pass app.getPath('userData')

server-spawn.cjs:
  only set env.FUSION_APP_USER_DATA when userDataPath is truthy
```

Reason:

```text
dev app must keep using fusion-studio-server/data/fusion.db, or thread lists disappear
packaged app can use user-data DBs
```

### Do Not Touch Chat Runtime Code

Avoid changes in these paths while finishing packaging:

```text
fusion-studio-server/server.js unless absolutely required
fusion-studio-server/lib/thread/*
fusion-studio-server/lib/wire/*
fusion-studio-client/src/lib/ws/*
chat UI files
```

This slice is packaging/resource smoke only.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-1-resource-resolution.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-2-build-time-downloads.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-3-packager-integration.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Startup Checks

Run from the repo root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The working tree is expected to be dirty with unrelated user/worker changes. Do not revert unrelated files.

## Current State

Slice 3 added Electron packaging integration:

- `electron-builder` config in `fusion-studio-client/package.json`.
- `electron:prepare`, `electron:pack`, and `electron:dist` scripts.
- `electron/resources/**` included as `extraResources`.
- `FUSION_RESOURCES_PATH` and `FUSION_APP_USER_DATA` forwarded from Electron to the spawned server.
- `prepare-ai-resources.cjs` creates `.resource-placeholder` files so empty model dirs survive packaging.

Packaged resources should contain:

```text
resources/
  prompts/Gwen-0-8B/STT_PROMPT.md
  prompts/Gwen-0-8B/THREADS_PROMPT.md
  prompts/Gwen-0-8B/CONTEXT_PROMPT.md
  models/gwen-0-8b/.resource-placeholder
  models/whisper/.resource-placeholder
  pandoc/...
```

## Scope

### 0. Preserve Dev/UserData Fix Before Packaging

Before any packaging smoke, inspect and preserve:

```text
fusion-studio-client/electron/main.cjs
fusion-studio-client/electron/server-spawn.cjs
```

Required checks:

```text
main.cjs dev mode does not pass app.getPath('userData') unless FUSION_APP_USER_DATA is explicitly set
main.cjs packaged mode may pass app.getPath('userData')
server-spawn.cjs only sets env.FUSION_APP_USER_DATA when userDataPath is truthy
```

### 1. Build Packaged Directory Output

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Do not run `electron:dist` unless local signing/notarization settings are known to work.

### 2. Inspect Packaged Resource Layout

Confirm packaged output contains resource folders under the actual packaged `resources` root.

Expected checks:

```text
prompts/Gwen-0-8B/STT_PROMPT.md exists
prompts/Gwen-0-8B/THREADS_PROMPT.md exists
prompts/Gwen-0-8B/CONTEXT_PROMPT.md exists
models/gwen-0-8b/.resource-placeholder exists
models/whisper/.resource-placeholder exists
```

If the files are copied under an unexpected nested folder, fix either `extraResources.to` or the resource resolver/env path so `FUSION_RESOURCES_PATH` points at the folder containing `models/`, `prompts/`, and `pandoc/`.

### 3. Launch Packaged App If Practical

Launch the packaged app from the `electron-builder --dir` output if possible.

Use an explicit temp user-data path for the packaged smoke, for example:

```bash
FUSION_APP_USER_DATA=/private/tmp/fusion-pack-smoke-user-data-$(date +%s) open /path/to/Fusion\ Studio.app
```

Confirm:

- App window opens.
- Server starts and emits `SERVER_READY`.
- Logs contain one resource diagnostic similar to:

```text
[Resources] root=... userData=...
```

- `FUSION_RESOURCES_PATH` points at packaged resources, not repo dev resources.
- `FUSION_APP_USER_DATA` is the explicit temp path for packaged smoke.
- Fresh SQLite DB migrations complete without error.

### 4. Verify Server Resource Resolver In Packaged-Like Env

If full packaged launch is not practical, simulate packaged env from the server directory using the packaged resources root:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH="/path/to/packaged/resources" \
FUSION_APP_USER_DATA="/tmp/fusion-studio-user-data-smoke" \
node -e "const r=require('./lib/resources/resolver'); console.log({resources:r.getResourcesRoot(), prompts:r.getPromptsRoot('Gwen-0-8B'), model:r.getModelRoot('gwen-0-8b')})"
```

Use the actual resource path discovered from `electron:pack`.

### 5. Verify Prompt Loader Against Packaged Resources

Run a no-model prompt-loader check with packaged env:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH="/path/to/packaged/resources" \
FUSION_APP_USER_DATA="/tmp/fusion-studio-user-data-smoke" \
node -e "require('./lib/capabilities/prompt-loader').loadPrompt('STT_PROMPT.md').then(t=>console.log(t.slice(0,80))).catch(e=>{console.error(e);process.exit(1)})"
```

This must not warm or load Gwen/Qwen.

### 6. Preserve Generated Package Output Unless Cleanup Is Needed

Do not clean/delete generated release output unless needed. If cleanup is needed, limit it to:

```text
fusion-studio-client/release
```

and report why.

## Non-Goals

- Do not download Gwen/Qwen or Whisper models.
- Do not run Gwen/Qwen warm.
- Do not run real Whisper transcription.
- Do not implement first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not change runtime APIs unless a smoke failure requires a narrow fix.

## Required Checks

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run prepare-ai-resources
npm run build
npm run electron:pack
```

Before packaging, run syntax checks:

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/main.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/server-spawn.cjs
```

Before packaging, start the server with a fresh temp `FUSION_APP_USER_DATA`, confirm `SERVER_READY`, then stop it:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_APP_USER_DATA=/private/tmp/fusion-server-smoke-user-data-$(date +%s) PORT=0 node server.js
```

Stop the server after `SERVER_READY:<port>` appears.

Syntax checks if files are changed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
node -c scripts/prepare-ai-resources.cjs
```

Server checks if resource resolver/prompt loader are changed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node -c lib/resources/resolver.js
node -c lib/capabilities/prompt-loader.js
```

## Acceptance Criteria

- Packaged directory output is produced successfully.
- Packaged output contains prompts and model placeholder directories under the expected resources root.
- Server resource env path points at packaged resources in packaged mode.
- Prompt loader can read packaged `STT_PROMPT.md` using `FUSION_RESOURCES_PATH`.
- No large model downloads or model warmups are performed.
- Dev Electron still uses the normal dev DB path and does not receive unconditional `FUSION_APP_USER_DATA`.
- Packaged smoke uses an explicit temp `FUSION_APP_USER_DATA`.
- Fresh SQLite DB migrates without error in packaged smoke.

## Final Report Requirements

Report:

- exact packaged app path launched
- server ready port/log line
- whether `FUSION_APP_USER_DATA` was an explicit temp path
- resource root used
- DB path used
- changed files
- validation commands and results
- whether generated release output was kept or removed, and why

## Notes For Reviewer

If this smoke passes, the next slice should be an explicit, user-approved model asset run: download Gwen/Qwen and Whisper into `electron/resources/models/`, then verify local model path detection without committing large binaries.
