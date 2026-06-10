# Handoff: Electron Model Packaging Slice 11 - Clean Swap To Qwen2.5

## Status

READY FOR EXECUTION

## Objective

Cleanly remove the incompatible local Qwen3.5 model assets from the Gwen resource folder, switch the underlying Gwen helper model to a Transformers.js-compatible Qwen2.5 0.5B baseline, download only the required Qwen2.5 files, and run a local warm smoke.

Keep the product/helper identity as `Gwen`. Only the underlying model target changes.

## Why This Slice Exists

The current local model target is:

```text
onnx-community/Qwen3.5-0.8B-Text-ONNX
```

Local packaging and detection work, but warm fails with:

```text
Fatal error: com.microsoft:CausalConvWithState(-1) is not a registered function/op
```

That is a runtime compatibility blocker, not a packaging blocker. Qwen3.5 uses newer ONNX contrib/custom ops that the current Transformers.js/ONNX runtime path does not support reliably.

Use this compatibility-first baseline instead:

```text
onnx-community/Qwen2.5-0.5B-Instruct
```

This is not the newest model, but it is the safer immediate fit because it is explicitly used in current Transformers.js text-generation examples and avoids the `CausalConvWithState` blocker.

## Current State

Repo root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

Current incompatible Gwen resource directory:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
  .resource-placeholder
  config.json
  generation_config.json
  tokenizer_config.json
  tokenizer.json
  onnx/model_q4f16.onnx
  onnx/model_q4f16.onnx_data
```

Current size:

```text
467M fusion-studio-client/electron/resources/models/gwen-0-8b
```

Current script target:

```text
fusion-studio-client/scripts/download-gwen-model.cjs
MODEL_ID = onnx-community/Qwen3.5-0.8B-Text-ONNX
REQUIRED_FILES includes onnx/model_q4f16.onnx and onnx/model_q4f16.onnx_data
```

Current registry target:

```text
fusion-studio-server/lib/capabilities/registry.js
modelId = onnx-community/Qwen3.5-0.8B-Text-ONNX
localFiles includes onnx/model_q4f16.onnx
```

Whisper is healthy and should not be touched:

```text
fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin = 1.5G
initWhisper() previously passed
```

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-10-qwen25-compatible-model-swap.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
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

The worktree is expected to be dirty because multiple sessions are active. Do not revert unrelated changes.

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

Do not touch Whisper assets or transcription behavior in this slice.

## Scope

### 1. Update Downloader To Qwen2.5 Target

Update:

```text
fusion-studio-client/scripts/download-gwen-model.cjs
```

Set:

```text
MODEL_ID = onnx-community/Qwen2.5-0.5B-Instruct
```

Update `REQUIRED_FILES` to the correct files for that repo.

Known likely required files:

```text
config.json
tokenizer.json
tokenizer_config.json
generation_config.json
onnx/model_q4.onnx
onnx/model_q4.onnx_data
```

Do not assume blindly. Use the existing Hugging Face tree validation in the script to confirm required files exist before downloading.

Keep script behavior:

- required-files-only,
- idempotent,
- one-at-a-time,
- no full repo snapshot,
- relative redirect handling,
- temp cleanup on stream errors.

### 2. Update Registry To Qwen2.5 Target

Update:

```text
fusion-studio-server/lib/capabilities/registry.js
```

Set fallback model ID:

```text
onnx-community/Qwen2.5-0.5B-Instruct
```

Update local required files to match the Qwen2.5 assets. Include the external data sidecar if required.

Likely local files:

```text
config.json
tokenizer.json
tokenizer_config.json
generation_config.json
onnx/model_q4.onnx
onnx/model_q4.onnx_data
```

Use `dtype: 'q4'` unless the model card/tree requires otherwise. Do not keep `q4f16` if the selected model file is `model_q4.onnx`.

### 3. Remove Old Incompatible Qwen3.5 Assets

Clean only this directory:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
```

Remove old Qwen3.5 files before downloading Qwen2.5 so assets are not mixed.

Do not delete:

```text
fusion-studio-client/electron/resources/prompts/
fusion-studio-client/electron/resources/models/whisper/
fusion-studio-client/release/ unless explicitly needed
```

After cleanup, recreate the Gwen directory if needed.

Report exactly what was removed.

### 4. Download Qwen2.5 Required Files

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run download-gwen-model
```

Expected:

- downloads only Qwen2.5 required files,
- does not touch Whisper,
- does not download the full repo,
- no Qwen3.5 files remain in the Gwen resource directory.

### 5. Verify Local Detection

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const {getModel}=require('./lib/capabilities/registry'); console.log(getModel('gwen-0-8b'))"
```

Expected:

- `modelId` is the local Gwen resource path,
- `localModelRoot` is present,
- fallback model ID in source is Qwen2.5, not Qwen3.5,
- dtype aligns with downloaded ONNX file.

### 6. Run Gwen Warm Smoke

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log({result:r, ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

Expected:

- no `CausalConvWithState` error,
- no remote fallback/download during warm,
- warm succeeds or reports a new exact local runtime/model-file error.

### 7. Rebuild Package If Warm Passes

If warm passes, run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Verify packaged output includes Qwen2.5 assets under:

```text
fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/
```

Do not run voice flow or transcription in this slice.

## Non-Goals

- Do not run real Whisper transcription.
- Do not call `/api/transcribe`.
- Do not alter Whisper assets.
- Do not add first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not touch chat/thread/wire/runtime files.
- Do not commit large model binaries unless explicitly instructed.
- Do not rename `Gwen-0-8B` prompt folder in this slice.

## Required Checks

Syntax:

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/capabilities/registry.js
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

Package only if warm passes:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

## Acceptance Criteria

- Downloader targets `onnx-community/Qwen2.5-0.5B-Instruct`.
- Registry fallback targets `onnx-community/Qwen2.5-0.5B-Instruct`.
- Old Qwen3.5 local files are removed from `models/gwen-0-8b`.
- New Qwen2.5 required files are present.
- Local detection selects the local Gwen path.
- Gwen warm no longer fails with `CausalConvWithState`.
- No Whisper transcription is run.
- No chat/runtime files are touched.

## Final Report Requirements

Report:

- changed files,
- old Qwen3.5 files removed,
- selected Qwen2.5 required file list,
- downloaded files and sizes,
- local detection output,
- warm result and elapsed time,
- whether package output was rebuilt,
- large untracked assets still present,
- any remaining blocker/error exactly as emitted.
