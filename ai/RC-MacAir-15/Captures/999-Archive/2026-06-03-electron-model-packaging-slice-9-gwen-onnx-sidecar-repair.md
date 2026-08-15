# Handoff: Electron Model Packaging Slice 9 - Gwen ONNX Sidecar Repair

## Status

READY FOR EXECUTION

## Objective

Repair the local Gwen/Qwen model resource set by adding the missing ONNX external data sidecar file required by Transformers.js:

```text
onnx/model_q4f16.onnx_data
```

Then re-run local detection and Gwen/Qwen warm smoke only.

Do not run Whisper transcription or chat/voice flow in this slice.

## Verified Prior State

Slice 8 warm smoke results:

```text
Local detection: passed
Whisper init warm: passed, 140ms
Gwen/Qwen warm: failed locally
```

Gwen/Qwen error:

```text
Local file missing at ".../models/gwen-0-8b/onnx/model_q4f16.onnx_data"
```

Current Gwen ONNX file present:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/onnx/model_q4f16.onnx
```

Missing required sidecar:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/onnx/model_q4f16.onnx_data
```

Whisper is not blocked:

```text
fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin
initWhisper() passed
```

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-8-authorized-warm-smoke.md
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Startup Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The worktree is expected to be dirty. Do not revert unrelated changes.

## Coordinator Constraints

Do not touch chat runtime code:

```text
fusion-studio-server/server.js unless absolutely required
fusion-studio-server/lib/thread/*
fusion-studio-server/lib/wire/*
fusion-studio-client/src/lib/ws/*
chat UI files
```

Do not change dev Electron DB behavior:

```text
dev Electron must not receive unconditional FUSION_APP_USER_DATA
server-spawn.cjs only sets env.FUSION_APP_USER_DATA when userDataPath is truthy
```

## Scope

### 1. Fix Gwen Download Required Files

Update:

```text
fusion-studio-client/scripts/download-gwen-model.cjs
```

Add the missing required file:

```text
onnx/model_q4f16.onnx_data
```

Ensure the script remains:

- idempotent,
- one-file-at-a-time,
- required-files-only,
- no full repo snapshot download,
- safe on stream errors,
- compatible with relative Hugging Face redirects.

### 2. Download Only Missing Sidecar

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run download-gwen-model
```

Expected:

- script skips existing required files,
- downloads `onnx/model_q4f16.onnx_data`,
- does not redownload Whisper,
- does not download full model repo.

### 3. Re-run Local Detection

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), model:getModel('gwen-0-8b')})"
```

Expected:

- local Gwen path still selected,
- `localModelRoot` still present.

### 4. Re-run Gwen Warm Smoke

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log({result:r, ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

Expected:

- Gwen/Qwen warm succeeds, or
- fails with the next exact local runtime/model-file error.

No remote fallback/download should occur during warm.

### 5. Rebuild Package Only If Warm Passes

If Gwen warm passes, rebuild packaged output:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Verify the packaged app resources include:

```text
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/onnx/model_q4f16.onnx_data
```

Do not launch full voice flow in this slice.

## Non-Goals

- Do not run Whisper warm again unless needed for regression confirmation.
- Do not run real Whisper transcription.
- Do not call `/api/transcribe`.
- Do not add first-run download UI.
- Do not add model manager UI.
- Do not touch chat/thread/wire/runtime files.
- Do not commit large model binaries unless explicitly instructed.

## Required Checks

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
```

After download:

```bash
test -s "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources/models/gwen-0-8b/onnx/model_q4f16.onnx_data"
```

Detection:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const {getModel}=require('./lib/capabilities/registry'); console.log(getModel('gwen-0-8b'))"
```

Warm:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log({result:r, ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

## Acceptance Criteria

- `download-gwen-model.cjs` includes `onnx/model_q4f16.onnx_data` as required.
- Missing sidecar file is downloaded into Electron resources.
- Gwen local detection still selects local resource path.
- Gwen warm succeeds or fails with a new exact local error.
- No remote fallback occurs during warm.
- No Whisper transcription is run.
- No chat/runtime files are touched.

## Final Report Requirements

Report:

- changed files,
- sidecar file size,
- local detection output,
- Gwen warm result and elapsed time,
- whether any network access occurred beyond downloading the missing sidecar,
- whether package output was rebuilt,
- large untracked assets still present,
- any remaining blocker/error exactly as emitted.
