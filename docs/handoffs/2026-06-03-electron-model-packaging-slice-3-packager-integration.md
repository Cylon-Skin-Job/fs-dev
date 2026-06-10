# Handoff: Electron Model Packaging Slice 3 - Packager Integration

## Status

READY FOR EXECUTION

## Objective

Add Electron packaging/build integration so prepared AI resources are included in packaged app output as unpacked resources, and so the spawned server can locate those resources through `FUSION_RESOURCES_PATH` and `FUSION_APP_USER_DATA`.

This slice should not download or load Gwen/Qwen or Whisper models. It should make the packaging path real and verifiable with small prompt/resource files.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-1-resource-resolution.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-2-build-time-downloads.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
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

As of this handoff, `fusion-studio-client` has Electron dev launch support but no visible packager config:

```text
fusion-studio-client/electron/main.cjs
fusion-studio-client/electron/server-spawn.cjs
fusion-studio-client/package.json scripts: electron, electron:dev
```

Slice 2 added resource prep scripts:

```text
fusion-studio-client/scripts/download-gwen-model.cjs
fusion-studio-client/scripts/download-whisper-model.cjs
fusion-studio-client/scripts/prepare-ai-resources.cjs
```

Prepared resources live under:

```text
fusion-studio-client/electron/resources/
  models/
  pandoc/
  prompts/
```

## Scope

### 1. Add Minimal Packaging Configuration

Choose the smallest practical packaging path for the existing Electron setup.

Preferred option:

```text
electron-builder
```

Reason:

- Existing docs mention electron-builder as the likely path.
- It supports `extraResources` and `asarUnpack` directly.
- It is enough for local packaged verification.

If another packager is already present but hidden in project docs/config, use the existing packager and document why.

Package config should include:

```text
fusion-studio-client/dist/
fusion-studio-client/electron/
fusion-studio-client/electron/resources/** as unpacked resources
```

Large model files must not be packed into `asar`.

### 2. Add Package Scripts

Update:

```text
fusion-studio-client/package.json
```

Add scripts with clear names. Example:

```json
{
  "electron:prepare": "npm run build && npm run prepare-ai-resources && npm run download-pandoc",
  "electron:pack": "npm run electron:prepare && electron-builder --dir",
  "electron:dist": "npm run electron:prepare && electron-builder"
}
```

Do not make `electron:prepare` download Gwen/Qwen or Whisper by default yet unless explicitly documented. Large AI model downloads should remain separate commands:

```text
npm run download-gwen-model
npm run download-whisper-model
```

### 3. Include Resources As Unpacked Resources

Packaging config must include:

```text
electron/resources/**
```

Expected packaged layout should expose resources roughly as:

```text
process.resourcesPath/
  models/
  prompts/
  pandoc/
```

If the packager copies them under a subfolder, update the resource resolver or packaging config so `FUSION_RESOURCES_PATH` points at the actual root containing `models/`, `prompts/`, and `pandoc/`.

### 4. Verify Electron Env Bridge

Confirm Slice 1 behavior exists. If not, implement the minimal missing piece:

- `electron/main.cjs` passes resource/userData paths into `spawnServer()`.
- `electron/server-spawn.cjs` forwards them as env vars.

Required server env vars:

```text
FUSION_RESOURCES_PATH
FUSION_APP_USER_DATA
```

In dev mode:

```text
FUSION_RESOURCES_PATH = fusion-studio-client/electron/resources
```

In packaged mode:

```text
FUSION_RESOURCES_PATH = process.resourcesPath or the nested resource root that contains models/prompts/pandoc
```

### 5. Add Lightweight Diagnostics

Add one lightweight startup log line either in Electron spawn or server resource resolver path usage so packaged verification can confirm resource paths without loading models.

Example:

```text
[Resources] root=/... userData=/...
```

Do not spam logs. One line on server startup is enough.

## Non-Goals

- Do not download Gwen/Qwen or Whisper models in default packaging scripts.
- Do not commit large model binaries.
- Do not run Gwen/Qwen warm.
- Do not run real Whisper transcription.
- Do not add first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not change capability behavior beyond resource path plumbing.

## Required Checks

Package/resource prep checks:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run prepare-ai-resources
npm run build
```

Syntax checks for changed Electron files:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
node -c electron/main.cjs
node -c electron/server-spawn.cjs
```

If `electron-builder` is added:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Do not run `electron:dist` unless local signing/notarization settings are known to work.

## Manual Verification

After `electron:pack`, inspect packaged output and confirm:

```text
resources/prompts/Gwen-0-8B/STT_PROMPT.md exists
resources/models/gwen-0-8b/ exists
resources/models/whisper/ exists
resources/pandoc/ exists if Pandoc prep was run
```

Launch packaged app if practical and confirm the server logs show resource env paths.

No model warm/transcription is required for this slice.

## Acceptance Criteria

- Electron packaging config exists.
- Prepared AI resources are included as unpacked packaged resources.
- Package scripts distinguish safe resource prep from large model downloads.
- Server receives `FUSION_RESOURCES_PATH` and `FUSION_APP_USER_DATA` in dev and packaged modes.
- Packaged output can be produced with prompts/directories included.
- No large model files are committed or downloaded by default.

## Notes For Reviewer

After this slice, the next likely slice is a packaged-mode smoke test with small fixture resources and then an optional explicit model download run on a machine with enough bandwidth/storage.
