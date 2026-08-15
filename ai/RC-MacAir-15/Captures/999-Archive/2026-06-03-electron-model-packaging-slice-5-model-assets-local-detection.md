# Handoff: Electron Model Packaging Slice 5 - Model Assets And Local Detection

## Status

READY FOR EXECUTION

## Objective

Run the explicit model asset preparation path for Gwen/Qwen and Whisper, then verify local model/resource detection without committing large model binaries.

This slice moves from placeholder resource directories to real model assets under Electron resources, but it must keep runtime scope narrow.

## Verified Prior State

Slice 4 packaged resource smoke passed with these results:

```text
Packaged app launched:
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/MacOS/Fusion Studio

Server ready log:
SERVER_READY:51683

Explicit smoke user data:
/private/tmp/fusion-pack-smoke-user-data-20260603-1

Resource root:
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources

DB path:
/private/tmp/fusion-pack-smoke-user-data-20260603-1/server-data/fusion.db
```

Confirmed:

- Packaged prompt loader found packaged `STT_PROMPT.md`.
- Fresh SQLite DB migrated without the previous `workspaces_old` error.
- Dev Electron behavior is preserved: dev mode passes null `userDataPath` unless `FUSION_APP_USER_DATA` is explicitly set.
- `server-spawn.cjs` only sets `env.FUSION_APP_USER_DATA` when `userDataPath` is truthy.
- Chat/thread/wire/client chat runtime files were not touched during the packaging smoke.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-1-resource-resolution.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-2-build-time-downloads.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-3-packager-integration.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-4-packaged-resource-smoke.md
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

## Coordinator Constraints

Preserve these rules:

```text
dev Electron:
  pass null/undefined userDataPath to spawnServer unless FUSION_APP_USER_DATA was explicitly set

packaged Electron:
  may pass app.getPath('userData')

server-spawn.cjs:
  only set env.FUSION_APP_USER_DATA when userDataPath is truthy
```

Do not touch chat runtime code while doing model asset work:

```text
fusion-studio-server/server.js unless absolutely required
fusion-studio-server/lib/thread/*
fusion-studio-server/lib/wire/*
fusion-studio-client/src/lib/ws/*
chat UI files
```

## Download Authorization

This slice may download large model files only if explicitly authorized by the active orchestrator/user at execution time.

Before running either command, report the expected target path and ask/confirm if bandwidth/storage use is acceptable:

```bash
npm run download-gwen-model
npm run download-whisper-model
```

If authorization is not available, do not run the large downloads. Instead, verify scripts and local detection behavior using existing files/placeholders only, and report that model download was skipped.

## Scope

### 1. Preflight Existing Model Asset State

Inspect resource targets:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
fusion-studio-client/electron/resources/models/whisper/
```

Report:

- whether only `.resource-placeholder` files exist,
- whether Gwen/Qwen required files already exist,
- whether `ggml-large-v3-turbo.bin` already exists,
- rough disk usage of each model directory.

### 2. Run Explicit Model Downloads If Authorized

From `fusion-studio-client`:

```bash
npm run download-gwen-model
npm run download-whisper-model
```

Expected targets:

```text
electron/resources/models/gwen-0-8b/
electron/resources/models/whisper/ggml-large-v3-turbo.bin
```

Do not commit downloaded model binaries unless explicitly requested.

### 3. Verify Local Resource Detection Without Full Runtime Warm

From `fusion-studio-server`, verify the resolver/provider paths detect local assets without loading the full model if possible.

Use lightweight resolver checks first:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); console.log({gwen:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo')})"
```

If a local model path helper exists in the capability provider/registry, verify it resolves the local Gwen root without calling `pipeline()`.

Do not call `warmCapability('sttCleanup')` unless explicitly authorized, because it can load large model weights.

### 4. Optional Packaged Resource Rebuild

If model assets were downloaded, rebuild packaged directory output:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Verify packaged output includes real model files, not just placeholders.

Do not run full packaged Gwen/Whisper warm unless explicitly authorized.

### 5. Preserve Release Output

Do not clean/delete generated release output unless needed. If cleanup is needed, limit it to:

```text
fusion-studio-client/release
```

and report why.

## Non-Goals

- Do not add first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not change chat/thread/wire/runtime files.
- Do not redesign capability APIs.
- Do not run real Whisper transcription unless explicitly authorized.
- Do not run Gwen/Qwen warm unless explicitly authorized.
- Do not commit large downloaded model files unless explicitly instructed.

## Required Checks

Syntax checks:

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-whisper-model.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/prepare-ai-resources.cjs
```

Safe prep check:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run prepare-ai-resources
```

Resolver check:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); console.log({resources:r.getResourcesRoot(), prompts:r.getPromptsRoot('Gwen-0-8B'), gwen:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo')})"
```

If package output is rebuilt:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

## Acceptance Criteria

- Current resource model asset state is reported.
- Large downloads are only run with explicit authorization.
- Gwen/Qwen and Whisper resource targets are prepared or intentionally skipped.
- Resolver detects local resource roots/files when present.
- No model warm/transcription is performed without explicit authorization.
- No chat/runtime files are touched.
- Downloaded model binaries are not committed unless explicitly requested.

## Final Report Requirements

Report:

- whether large downloads were authorized and run,
- Gwen/Qwen resource directory state and rough size,
- Whisper model file state and rough size,
- resolver output for Gwen and Whisper paths,
- whether packaged output was rebuilt,
- changed files,
- validation commands and results,
- any downloaded large files that remain untracked.
