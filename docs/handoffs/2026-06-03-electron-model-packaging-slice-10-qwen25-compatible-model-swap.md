# Handoff: Electron Model Packaging Slice 10 - Qwen2.5 Compatible Model Swap

## Status

READY FOR EXECUTION

## Objective

Replace the current local Gwen/Qwen model target with a Transformers.js-compatible Qwen2.5 0.5B model that does not require the unsupported `CausalConvWithState` ONNX op.

The previous Qwen3.5 0.8B target loads from local resources but fails at ONNX runtime initialization. This slice should switch model assets/config/download requirements to a compatible model, then re-run local warm smoke.

## Why This Slice Exists

Slice 9 advanced past missing local files and reached this runtime blocker:

```text
Fatal error: com.microsoft:CausalConvWithState(-1) is not a registered function/op
```

Live research confirmed this is a known Qwen3.5-style ONNX runtime compatibility issue: Qwen3.5 hybrid decoder exports use newer/custom ONNX Runtime contrib ops such as `CausalConvWithState` and `LinearAttention` that are not registered in the current runtime path.

Current 2026 verification found newer options, but the safer local helper model target for this product slice is:

```text
onnx-community/Qwen2.5-0.5B-Instruct
```

This model is not the newest Qwen-family model, but it is the best immediate fit because:

- it is explicitly used in current Transformers.js text-generation examples,
- it has an `onnx-community` Transformers.js-compatible export,
- it avoids the Qwen3.5 `CausalConvWithState` runtime blocker,
- it is small enough for fast local helper tasks,
- it should be sufficient for STT cleanup, thread titles, simple entity extraction, and context shaping.

Other models considered:

```text
onnx-community/Qwen3.5-0.8B-Text-ONNX
  newer, but blocked by CausalConvWithState in current runtime path

onnx-community/Llama-3.2-1B-Instruct-onnx-web-gqa
  plausible and stronger, but larger and has more license/packaging implications

onnx-community/Falcon3-1B-Instruct
  plausible, but less proven for this exact Transformers.js helper path

onnx-community/AMD-OLMo-1B-SFT-DPO
  plausible, but larger and less aligned with Qwen/Gwen naming

onnx-community/gemma-3n-E2B-it-ONNX
  newer, but overkill and much larger for this helper layer

onnx-community/Qwen3-Embedding-0.6B-ONNX
  good future embedding candidate, not a text-generation replacement
```

Treat Qwen2.5 0.5B as the compatibility-first baseline, not the permanent final model forever. Keep the internal product/helper identity as `Gwen`.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-9-gwen-onnx-sidecar-repair.md
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-gwen-model.cjs
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/lib/capabilities/registry.js
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

Do not run real Whisper transcription.

## Scope

### 1. Switch Logical Gwen/Qwen Model Target

Keep the internal logical model name:

```text
gwen-0-8b
```

This is the product/helper identity. Do not rename prompts or capability names in this slice.

Update the underlying model target to:

```text
onnx-community/Qwen2.5-0.5B-Instruct
```

Likely files:

```text
fusion-studio-server/lib/capabilities/registry.js
fusion-studio-client/scripts/download-gwen-model.cjs
```

### 2. Update Required Model Files

The Qwen2.5 model uses different ONNX filenames than the Qwen3.5 target.

Inspect the Hugging Face model tree and update `REQUIRED_FILES` in `download-gwen-model.cjs` to the correct required file set.

Known likely ONNX target:

```text
onnx/model_q4.onnx
onnx/model_q4.onnx_data
```

Do not assume exact names without checking the model tree. The script already reads Hugging Face tree metadata; use that mechanism to validate required files before downloading.

Keep download behavior:

- required-files-only,
- idempotent,
- one-at-a-time,
- no full repo download,
- safe temp cleanup,
- relative redirect handling.

### 3. Avoid Mixing Old Qwen3.5 Assets With New Qwen2.5 Assets

Before downloading the new target, either:

1. move the old Qwen3.5 resource directory aside, or
2. delete only the old Gwen/Qwen model files under:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
```

Do not delete prompts. Do not delete Whisper.

If deleting old files, limit deletion to:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
```

and report exactly what was removed.

### 4. Download New Qwen2.5 Required Files

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run download-gwen-model
```

Expected:

- downloads Qwen2.5 required files only,
- does not touch Whisper,
- does not download full model repo.

### 5. Verify Local Detection

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({gwenPath:r.getModelRoot('gwen-0-8b'), model:getModel('gwen-0-8b')})"
```

Expected:

- local Gwen path selected,
- `localModelRoot` present,
- fallback model ID is no longer Qwen3.5.

### 6. Run Gwen/Qwen Warm Smoke

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

Verify packaged output includes the new Qwen2.5 model files under:

```text
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/
```

## Non-Goals

- Do not run real Whisper transcription.
- Do not call `/api/transcribe`.
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

## Acceptance Criteria

- Underlying model target changed from Qwen3.5 to Qwen2.5 0.5B compatible target.
- Download script required files match the new model target.
- Old incompatible Qwen3.5 files are not mixed with new Qwen2.5 files.
- Local detection selects the local model path.
- Gwen/Qwen warm no longer fails with `CausalConvWithState`.
- No Whisper transcription is run.
- No chat/runtime files are touched.

## Final Report Requirements

Report:

- changed files,
- model repo selected,
- required files downloaded,
- any old files removed/moved,
- local detection output,
- warm result and elapsed time,
- whether package output was rebuilt,
- large untracked assets still present,
- any remaining blocker/error exactly as emitted.
