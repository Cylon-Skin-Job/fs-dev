# Handoff: Electron Model Packaging Slice 8 - Authorized Warm Smoke

## Status

READY FOR EXECUTION

## Objective

Run the first authorized local warm smoke for the packaged AI assets:

1. Warm Gwen/Qwen through the capability layer using local Electron resource files.
2. Warm Whisper through `initWhisper()` using the local Electron resource model.
3. Confirm neither path redownloads model files or falls back to remote model loading.

Do not run real audio transcription in this slice.

## Repo And Project Context

Repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Client:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
```

Server:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
```

Fusion Home restart script:

```text
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

Current Electron dev app was successfully restarted with that script. Last known restart result:

```text
Electron PID: 91603
Server URL: http://localhost:55573
Electron log: /var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-electron.log
```

## Required Reading

Read these before changing or running anything expensive:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Prior slice handoffs, for background only:

```text
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-1-resource-resolution.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-2-build-time-downloads.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-3-packager-integration.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-4-packaged-resource-smoke.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-5-model-assets-local-detection.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-6-explicit-model-download.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-7-local-warm-smoke.md
```

## Current Verified State

The capability layer exists:

```text
fusion-studio-server/lib/capabilities/
```

Prompt files exist in source and Electron resources:

```text
System Source Files/Prompts/Gwen-0-8B/
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/
```

Prompt files:

```text
STT_PROMPT.md
THREADS_PROMPT.md
CONTEXT_PROMPT.md
```

Local model resources exist:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin
```

Known sizes from prior slice:

```text
Gwen/Qwen resource dir: 19M
Whisper model file: 1.5G
Packaged release dir: 2.7G
```

Gwen/Qwen required files present:

```text
config.json
tokenizer.json
tokenizer_config.json
generation_config.json
onnx/model_q4f16.onnx
```

Whisper was hard-linked from:

```text
/Users/rccurtrightjr./.whisper/ggml-large-v3-turbo.bin
```

Packaged resource smoke passed:

```text
Packaged app path:
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/MacOS/Fusion Studio

Packaged resource root:
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources

Packaged smoke DB path:
/private/tmp/fusion-pack-smoke-user-data-20260603-1/server-data/fusion.db
```

## Critical Guardrails

### Preserve Dev DB Behavior

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

Avoid changes in these paths:

```text
fusion-studio-server/server.js unless absolutely required
fusion-studio-server/lib/thread/*
fusion-studio-server/lib/wire/*
fusion-studio-client/src/lib/ws/*
chat UI files
```

This slice is local model warm smoke only.

### Do Not Commit Large Assets

Large model assets are expected to remain untracked unless explicitly instructed otherwise:

```text
fusion-studio-client/electron/resources/models/
fusion-studio-client/release/
```

Do not clean/delete `fusion-studio-client/release/` unless needed. If cleanup is needed, say why and limit cleanup to that directory only.

## Startup Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The worktree is expected to be dirty because multiple sessions are active. Do not revert unrelated changes.

## Authorization

This handoff explicitly authorizes warm smoke only:

```text
AUTHORIZED:
  Gwen/Qwen local warm
  Whisper init warm

NOT AUTHORIZED:
  real audio transcription
  /api/transcribe with an audio file
  chat/thread runtime edits
  committing large model files
```

## Preflight: Confirm Local Detection

Run from server:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo'), model:getModel('gwen-0-8b')})"
```

Expected:

```text
gwenPath points to fusion-studio-client/electron/resources/models/gwen-0-8b
whisper points to fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin
model.modelId is the local Gwen/Qwen resource path
model.localModelRoot is present
```

If this fails, stop and report. Do not warm models.

## Syntax Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node --check lib/capabilities/registry.js
node --check lib/capabilities/providers/transformers-js.js
node --check lib/transcription/index.js
node --check lib/resources/resolver.js
```

## Gwen/Qwen Warm Smoke

Run local warm only:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log({result:r, ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

Expected:

```text
warmCapability('sttCleanup') completes using local model path
no remote Hugging Face fallback
no unexpected network download
```

If it fails:

- capture the exact error,
- report whether it is WebGPU/runtime/model-file related,
- do not redesign the provider unless the fix is tiny and clearly local to runtime config,
- do not touch unrelated files.

## Whisper Warm Smoke

Run init only:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const t=require('./lib/transcription'); t.initWhisper().then(()=>console.log({result:'whisper ready', ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

Expected:

```text
initWhisper() completes
uses Electron resource model or link/copy from it
does not redownload Whisper
does not transcribe audio
```

If it tries to redownload Whisper, stop and report why. Do not let it continue downloading.

## Optional HTTP Warm Smoke

Only if both direct warms pass, optionally verify through the running dev Electron server.

Use current server URL if still live from restart:

```text
http://localhost:55573
```

Check health/warm endpoints without audio transcription:

```bash
curl -s http://localhost:55573/api/health
curl -s -X POST http://localhost:55573/api/capabilities/warm -H 'Content-Type: application/json' -d '{"capability":"sttCleanup"}'
curl -s -X POST http://localhost:55573/api/transcription/warm
```

If the port is stale, use the Electron port file or restart using:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Do not call `/api/transcribe` in this slice.

## Non-Goals

- Do not run real transcription.
- Do not record audio.
- Do not call `/api/transcribe`.
- Do not edit chat/thread/wire/runtime files.
- Do not add first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not commit large model binaries.
- Do not delete packaged release output unless needed.

## Acceptance Criteria

- Local detection confirms Gwen/Qwen and Whisper resource paths.
- Gwen/Qwen warm either succeeds locally or fails with a clearly reported local runtime/config error.
- Whisper init warm either succeeds locally or fails with a clearly reported local runtime/path error.
- No model redownload occurs.
- No real transcription occurs.
- Dev DB behavior remains preserved.
- Chat runtime files are untouched.

## Final Report Requirements

Report:

- repo status summary before/after,
- local detection output,
- syntax check results,
- Gwen/Qwen warm result and elapsed time,
- Whisper warm result and elapsed time,
- whether any network access/download occurred unexpectedly,
- whether HTTP warm endpoints were tested,
- changed files,
- large untracked assets still present,
- any blockers or exact errors.
