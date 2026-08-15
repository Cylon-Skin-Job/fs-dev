# Handoff: Electron Model Packaging Slice 2 - Build-Time Downloads

## Status

READY FOR EXECUTION

## Objective

Add idempotent build-time download/prep scripts for Gwen/Qwen and Whisper model assets so Electron builds can include required local AI resources without user setup.

This slice should prepare assets under `fusion-studio-client/electron/resources/`; it should not change runtime inference behavior beyond what is necessary to support the resource layout.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-1-resource-resolution.md
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/scripts/download-pandoc.cjs
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

## Dependency

This slice should be executed after Slice 1 resource resolution is complete, or should preserve compatibility with the paths defined there:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
fusion-studio-client/electron/resources/models/whisper/
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/
```

If Slice 1 is not complete, do not modify runtime resolver behavior in this slice. Keep this slice focused on build-time asset preparation.

## Scope

### 1. Add Gwen/Qwen Model Download Script

Create:

```text
fusion-studio-client/scripts/download-gwen-model.cjs
```

One job:

```text
Download or prepare the Transformers.js-compatible Gwen/Qwen model files into Electron resources.
```

Target directory:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
```

Model target from current registry/spec:

```text
onnx-community/Qwen3.5-0.8B-Text-ONNX
```

Requirements:

- Idempotent: skip if required model files are already present.
- No user prompts.
- Create parent directories as needed.
- Keep implementation focused and readable.
- Include constants for model ID, target directory, and required marker/check files.
- Add a TODO or placeholder for SHA256 verification if exact checksums are not yet known.
- Do not import Electron.

Implementation note:

Transformers.js model repos may contain multiple files. Prefer a robust approach that downloads the required repository snapshot/files into the target directory. If exact file list is not yet known, implement a conservative script that clearly fails with instructions rather than silently producing an incomplete model directory.

### 2. Add Whisper Model Download Script

Create:

```text
fusion-studio-client/scripts/download-whisper-model.cjs
```

One job:

```text
Download or copy the Whisper large-v3-turbo model into Electron resources.
```

Target directory:

```text
fusion-studio-client/electron/resources/models/whisper/
```

Target file:

```text
ggml-large-v3-turbo.bin
```

Resolution/download order:

```text
1. If target file exists, skip.
2. If ~/.whisper/ggml-large-v3-turbo.bin exists, copy or hard-link it into resources.
3. Otherwise download using the existing nodejs-whisper mechanism or documented direct URL if known.
```

Requirements:

- Idempotent.
- No user prompts.
- Reuse local `~/.whisper` cache when available.
- Do not require a real transcription run.
- Include a TODO or placeholder for checksum verification if exact checksum is not known.
- Preserve executable permissions only for binaries if a future `whisper-cli` copy is added.

### 3. Copy Prompts Into Electron Resources

Create either a small dedicated script or extend a model-prep script only if it stays one job.

Preferred file:

```text
fusion-studio-client/scripts/prepare-ai-resources.cjs
```

One job:

```text
Prepare Electron AI resources by ensuring prompts and model directories exist.
```

Prompt source:

```text
System Source Files/Prompts/Gwen-0-8B/
```

Prompt target:

```text
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/
```

Required prompt files:

```text
STT_PROMPT.md
THREADS_PROMPT.md
CONTEXT_PROMPT.md
```

### 4. Add Package Scripts

Update:

```text
fusion-studio-client/package.json
```

Add scripts similar to existing `download-pandoc`:

```json
{
  "download-gwen-model": "node scripts/download-gwen-model.cjs",
  "download-whisper-model": "node scripts/download-whisper-model.cjs",
  "prepare-ai-resources": "node scripts/prepare-ai-resources.cjs"
}
```

If `prepare-ai-resources` calls the other scripts, keep it clear and non-interactive.

Do not make normal `npm run build` download large models in this slice unless explicitly required by the existing build process. Prefer an explicit resource-prep command for now.

## Non-Goals

- Do not implement first-run download UI.
- Do not add a model manager UI.
- Do not expose AI-callable tools.
- Do not add external providers.
- Do not change transcription cleanup behavior.
- Do not run Gwen/Qwen warm if it downloads/loads the model.
- Do not run real Whisper transcription.
- Do not commit large downloaded model binaries unless explicitly instructed by the user.

## Required Checks

Syntax checks:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
node -c scripts/download-gwen-model.cjs
node -c scripts/download-whisper-model.cjs
node -c scripts/prepare-ai-resources.cjs
```

Package script visibility:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run
```

Safe prompt/resource prep check:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run prepare-ai-resources
```

If this command would download large models, stop and split prompt-copy prep from model downloads. `prepare-ai-resources` should be safe to run without pulling gigabytes unless explicitly documented otherwise.

## Acceptance Criteria

- Gwen/Qwen download/prep script exists and is idempotent.
- Whisper download/prep script exists and is idempotent.
- Prompts can be copied into Electron resources.
- `package.json` exposes clear resource-prep scripts.
- No large model files are committed unless explicitly requested.
- No verification step requires loading Gwen/Qwen or transcribing audio.
- Existing Pandoc script remains unchanged unless a directly necessary shared pattern is discovered.

## Notes For Reviewer

After this slice, the next likely slice is packaging/build integration: include `electron/resources/models` and `electron/resources/prompts` as unpacked Electron resources and verify `process.resourcesPath` points to them in packaged mode.
