# Handoff: Electron Model Packaging Slice 7 - Local Warm Smoke

## Status

WAITING FOR WARMUP AUTHORIZATION

## Objective

Verify that the packaged/local model assets can be resolved and warmed without falling back to remote downloads.

This slice may load local Gwen/Qwen weights and initialize Whisper. It must not run a real transcription unless explicitly authorized separately.

## Verified Prior State

Slice 6 completed explicit model asset prep.

Results:

```text
Authorized downloads: yes
Gwen/Qwen: completed required files only, one-at-a-time, then stopped
Whisper: not redownloaded; hard-linked from existing ~/.whisper/ggml-large-v3-turbo.bin
Packaged Electron output rebuilt
```

Resource state:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b = 19M

Gwen required files present:
  config.json
  tokenizer.json
  tokenizer_config.json
  generation_config.json
  onnx/model_q4f16.onnx

fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin = 1.5G
```

Packaged models verified at:

```text
fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/
fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources/models/whisper/ggml-large-v3-turbo.bin
```

Resolver check after Slice 6:

```text
Gwen modelId: Electron resource path
Gwen localModelRoot: present
Whisper: Electron resource path
```

Large model files remain uncommitted/untracked under:

```text
fusion-studio-client/electron/resources/
fusion-studio-client/release/
```

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-6-explicit-model-download.md
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

The working tree is expected to be dirty. Do not revert unrelated files. Do not commit large model binaries unless explicitly instructed.

## Authorization Gate

Do not run warmup commands until explicitly authorized by the active orchestrator/user.

Potentially expensive commands:

```text
warmCapability('sttCleanup')
POST /api/capabilities/warm { capability: 'sttCleanup' }
POST /api/transcription/warm
```

Do not run real transcription unless separately authorized.

## Coordinator Constraints

Preserve these rules:

```text
dev Electron:
  pass null/undefined userDataPath to spawnServer unless FUSION_APP_USER_DATA was explicitly set

server-spawn.cjs:
  only set env.FUSION_APP_USER_DATA when userDataPath is truthy
```

Do not touch chat runtime code:

```text
fusion-studio-server/server.js unless absolutely required
fusion-studio-server/lib/thread/*
fusion-studio-server/lib/wire/*
fusion-studio-client/src/lib/ws/*
chat UI files
```

## Scope

### 1. Preflight Local Asset Detection

Run resolver/model detection without warming:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo'), model:getModel('gwen-0-8b')})"
```

Expected:

- Gwen points at local Electron resources.
- Whisper points at local Electron resources.
- No remote model ID fallback.

### 2. Authorized Gwen/Qwen Warm Smoke

If authorized, run a direct warm only:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log(r)).catch(e=>{console.error(e);process.exit(1)})"
```

Acceptance:

- Warm completes or fails with a clear local-runtime error.
- It must not attempt network fallback if local files are present.
- Report time-to-warm if practical.

If it fails because WebGPU is unavailable in Node, report that and do not rewrite the provider in this slice unless the fix is a tiny config fallback already supported by Transformers.js.

### 3. Authorized Whisper Warm Smoke

If authorized, run transcription warm only via the server module or HTTP endpoint.

Preferred direct module path if available:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const t=require('./lib/transcription'); t.initWhisper().then(()=>console.log('whisper ready')).catch(e=>{console.error(e);process.exit(1)})"
```

Acceptance:

- Whisper init completes using Electron resource model path or expected local copy/link behavior.
- No model redownload occurs.
- No real transcription is run.

### 4. Optional Packaged Endpoint Warm Smoke

Only if direct module warm passes and the orchestrator authorizes it, launch packaged app with explicit temp user data and call warm endpoints:

```text
POST /api/capabilities/warm
POST /api/transcription/warm
```

Do not record audio or run `/api/transcribe` in this slice.

## Non-Goals

- Do not run real Whisper transcription.
- Do not clean up downloaded model assets.
- Do not commit large model binaries.
- Do not add first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not touch chat/thread/wire/runtime files.
- Do not redesign provider architecture.

## Required Checks

Preflight:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node --check lib/capabilities/registry.js
node --check lib/capabilities/providers/transformers-js.js
node --check lib/transcription/index.js
```

Resolver detection:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo'), model:getModel('gwen-0-8b')})"
```

Warm checks only if authorized:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log(r)).catch(e=>{console.error(e);process.exit(1)})"
```

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const t=require('./lib/transcription'); t.initWhisper().then(()=>console.log('whisper ready')).catch(e=>{console.error(e);process.exit(1)})"
```

## Acceptance Criteria

- Local assets are detected before warmup.
- Warmup commands are run only after explicit authorization.
- Gwen/Qwen warm succeeds or reports a clear local runtime/config error without network fallback.
- Whisper warm succeeds or reports a clear local path/runtime error without redownloading.
- No real transcription is run.
- No chat/runtime files are touched.
- Large model binaries remain uncommitted.

## Final Report Requirements

Report:

- authorization status for Gwen warm and Whisper warm,
- resolver/model detection output,
- Gwen warm result and time-to-warm if run,
- Whisper warm result and time-to-warm if run,
- whether any network access occurred unexpectedly,
- changed files,
- validation commands and results,
- large untracked files still present.
