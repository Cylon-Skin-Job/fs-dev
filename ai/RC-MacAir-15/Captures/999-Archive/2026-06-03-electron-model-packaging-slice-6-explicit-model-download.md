# Handoff: Electron Model Packaging Slice 6 - Explicit Model Download

## Status

WAITING FOR DOWNLOAD AUTHORIZATION

## Objective

Download Gwen/Qwen and Whisper model assets into Electron resources only after explicit authorization, then verify local model detection and packaged resource inclusion without committing large binaries.

This slice is intentionally separated from runtime warm/transcription so downloads, packaging, and inference can be controlled independently.

## Verified Prior State

Slice 5 completed the safe local-detection path without large downloads.

Current resource state:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
  .resource-placeholder only
  size: 4.0K
  required model files absent

fusion-studio-client/electron/resources/models/whisper/
  .resource-placeholder only
  size: 4.0K
  ggml-large-v3-turbo.bin absent
```

Prompts are prepared:

```text
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/CONTEXT_PROMPT.md
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/STT_PROMPT.md
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/THREADS_PROMPT.md
```

Resolver output from Slice 5:

```js
{
  resources: '/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources',
  prompts: '/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources/prompts/Gwen-0-8B',
  gwen: '/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources/models/gwen-0-8b',
  whisper: '/Users/rccurtrightjr./.whisper/ggml-large-v3-turbo.bin'
}
```

Local Gwen detection was verified with a temp fixture outside the repo. No `pipeline()`, warmup, or model loading was performed.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-5-model-assets-local-detection.md
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-whisper-model.cjs
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

## Authorization Gate

Do not run the download commands until the active orchestrator/user explicitly authorizes large downloads.

Commands requiring authorization:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run download-gwen-model
npm run download-whisper-model
```

Expected target paths:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin
```

If authorization is not given, stop after preflight and report that downloads remain pending.

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

### 1. Preflight Download Scripts

Run syntax checks:

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-whisper-model.cjs
```

Inspect current model directories and record rough sizes.

### 2. Run Downloads If Authorized

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run download-gwen-model
npm run download-whisper-model
```

If either download fails:

- do not retry in a loop,
- report exact error,
- leave partial `.tmp` files cleaned up if the scripts do not already clean them,
- do not modify runtime code unless the failure is clearly a script bug.

### 3. Verify Asset Presence

Confirm Gwen required files exist:

```text
config.json
tokenizer.json
tokenizer_config.json
generation_config.json
onnx/model_q4f16.onnx
```

Confirm Whisper model exists:

```text
ggml-large-v3-turbo.bin
```

Record rough directory/file sizes.

### 4. Verify Local Detection Without Warmup

Run resolver/model checks without `pipeline()` or Whisper transcription.

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo'), model:getModel('gwen-0-8b')})"
```

Expected:

- `getModel('gwen-0-8b').modelId` is the local Gwen resource path.
- `getModel('gwen-0-8b').localModelRoot` is present.
- Whisper resolver points to Electron resources if `ggml-large-v3-turbo.bin` exists there.

### 5. Rebuild Packaged Directory Output

If downloads succeed, run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Verify packaged output contains real model assets under:

```text
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/whisper/ggml-large-v3-turbo.bin
```

Do not launch warm/transcription unless separately authorized.

## Non-Goals

- Do not run Gwen/Qwen warm.
- Do not run real Whisper transcription.
- Do not implement first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not change chat/thread/wire/runtime files.
- Do not commit large downloaded model binaries unless explicitly instructed.

## Required Checks

Preflight:

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-whisper-model.cjs
```

Post-download detection:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo'), model:getModel('gwen-0-8b')})"
```

Package if downloads succeed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

## Acceptance Criteria

- Downloads are run only after explicit authorization.
- Gwen/Qwen required files exist in Electron resources, or download is reported pending/failed.
- Whisper model exists in Electron resources, or download is reported pending/failed.
- Local detection points to resource model paths when files exist.
- Packaged output includes model assets if downloads completed.
- No model warmup/transcription is performed without separate authorization.
- Large downloaded files remain uncommitted unless explicitly requested.

## Final Report Requirements

Report:

- authorization status,
- download commands run or skipped,
- Gwen resource directory size and required-file state,
- Whisper model file size/state,
- resolver/model detection output,
- package output path if rebuilt,
- changed files,
- untracked large model files remaining,
- validation commands and results.
