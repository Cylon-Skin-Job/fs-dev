# Electron Model Packaging Spec

## Objective

Make Gwen/Qwen and Whisper available in the Electron app with no user setup.

The packaged app must not require the user to run terminal commands, manually download model files, or understand Hugging Face/Whisper cache paths.

This spec extends `docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md`.

## Current State

The capability layer slice exists and is currently dev-path oriented:

- Prompts live at `System Source Files/Prompts/Gwen-0-8B/` and `prompt-loader.js` resolves them relative to the repo.
- Gwen/Qwen uses `onnx-community/Qwen3.5-0.8B-Text-ONNX` as a remote Hugging Face model ID.
- Whisper setup uses `nodejs-whisper`, `~/.whisper`, and `node_modules/nodejs-whisper/cpp/whisper.cpp/models/`.
- Electron dev mode spawns the server from source via `fusion-studio-client/electron/server-spawn.cjs`.
- The spawned server does not currently receive Electron's `process.resourcesPath`.
- The project already has a build-time binary download pattern for Pandoc at `fusion-studio-client/scripts/download-pandoc.cjs`.

## Product Requirement

For Electron demo/release builds:

```text
User installs/opens app
→ Gwen/Qwen is available
→ Whisper is available
→ prompts are available
→ no manual setup required
```

The app may either:

1. ship models inside the app resources, or
2. perform a managed first-run download.

The first implementation should support packaged resources first. Managed first-run download can be added later if release size becomes a problem.

## Resource Layout

Packaged resources should use this shape:

```text
resources/
  models/
    gwen-0-8b/
      ... Transformers.js / ONNX model files ...
    whisper/
      ggml-large-v3-turbo.bin
      whisper-cli              optional, platform-specific
  prompts/
    Gwen-0-8B/
      STT_PROMPT.md
      THREADS_PROMPT.md
      CONTEXT_PROMPT.md
```

Development resources may use repo paths:

```text
System Source Files/Prompts/Gwen-0-8B/
fusion-studio-client/electron/resources/models/gwen-0-8b/
fusion-studio-client/electron/resources/models/whisper/
```

Large model files and native binaries must not be packed into `asar`. They should be added as unpacked `extraResources` or equivalent release assets.

## Server Resource Resolver

Add a server-side resolver that is the only module responsible for locating packaged resources.

Proposed file:

```text
fusion-studio-server/lib/resources/resolver.js
```

One job:

```text
Resolve app resources across Electron packaged mode, Electron/dev resources, and repo fallback paths.
```

Resolution order:

```text
1. process.env.FUSION_RESOURCES_PATH
2. fusion-studio-client/electron/resources/ from repo root
3. repo root fallback paths
4. user cache fallback, when needed for writable model copies
```

Public API example:

```js
getResourcesRoot()
getPromptsRoot('Gwen-0-8B')
getModelRoot('gwen-0-8b')
getWhisperModelPath('large-v3-turbo')
getWritableModelCacheRoot()
```

The resolver should not import transcription, capabilities, or Electron modules. It should only resolve paths.

## Electron Env Bridge

Update `fusion-studio-client/electron/server-spawn.cjs` so the spawned server receives resource paths from Electron.

Required env vars:

```text
FUSION_RESOURCES_PATH=/path/to/Electron/Resources
FUSION_APP_USER_DATA=/path/to/Electron/userData
```

In dev mode, `FUSION_RESOURCES_PATH` may point to:

```text
fusion-studio-client/electron/resources
```

In packaged mode, it should point to:

```js
process.resourcesPath
```

`FUSION_APP_USER_DATA` should come from:

```js
app.getPath('userData')
```

The server process should not attempt to call Electron APIs directly.

## Prompt Resolution

Update `fusion-studio-server/lib/capabilities/prompt-loader.js` to use the resource resolver.

Prompt resolution order:

```text
1. FUSION_RESOURCES_PATH/prompts/Gwen-0-8B/<file>
2. repo System Source Files/Prompts/Gwen-0-8B/<file>
```

Do not hardcode Electron paths inside the prompt loader.

## Gwen/Qwen Model Resolution

Update the Transformers.js provider and/or registry so local model paths are supported.

Target behavior:

```text
packaged/offline mode:
  load local resources/models/gwen-0-8b

dev mode with local resources:
  load fusion-studio-client/electron/resources/models/gwen-0-8b

dev mode without local resources:
  allow Hugging Face model ID fallback
```

The consumer should still call:

```js
warmCapability('sttCleanup')
runCapability('sttCleanup', { input })
```

No transcription or thread-title code should know whether the model came from local resources or Hugging Face.

## Whisper Model Resolution

Current `nodejs-whisper` expects the model under its package tree:

```text
node_modules/nodejs-whisper/cpp/whisper.cpp/models/ggml-large-v3-turbo.bin
```

Packaged Electron should avoid requiring user-level `~/.whisper` setup.

Resolution order:

```text
1. FUSION_RESOURCES_PATH/models/whisper/ggml-large-v3-turbo.bin
2. FUSION_APP_USER_DATA/models/whisper/ggml-large-v3-turbo.bin
3. ~/.whisper/ggml-large-v3-turbo.bin for dev fallback
4. npx nodejs-whisper download large-v3-turbo only in dev or explicit setup mode
```

If `nodejs-whisper` must read from its package model directory, then `initWhisper()` should copy or hard-link from packaged resources into a writable cache or into the expected package location when that location is writable.

Packaged app code must not attempt to write into the installed app bundle.

## Build-Time Downloads

Mirror the existing Pandoc pattern with idempotent scripts.

Potential scripts:

```text
fusion-studio-client/scripts/download-gwen-model.cjs
fusion-studio-client/scripts/download-whisper-model.cjs
```

Targets:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/
fusion-studio-client/electron/resources/models/whisper/
```

Requirements:

- Idempotent: skip if target files already exist.
- Checksum-ready: include a place for SHA256 verification even if not enforced in the first slice.
- Platform-aware for Whisper binaries if bundling `whisper-cli`.
- No user interaction.
- Fail the release build if required model assets are missing.

## First-Run Download Future

First-run download is a future option, not the first implementation.

If added later, it must include:

- visible progress UI,
- retry,
- checksum validation,
- app-data cache location,
- offline error message,
- no partial/corrupt model use.

## Security And Privacy

- Local Gwen/Qwen and Whisper require no secrets.
- Future external providers should use the existing Secrets Manager.
- Packaged model assets should be treated as read-only.
- Writable model cache should live under Electron userData, not the repo and not the app bundle.

## Non-Goals

- Do not build a model manager UI in this slice.
- Do not implement first-run download in this slice.
- Do not expose AI-callable tools in this slice.
- Do not add Perplexity, Nano Banana, OpenAI, or Anthropic adapters in this slice.
- Do not redesign transcription or capability APIs.

## First Execution Slice

1. Add `fusion-studio-server/lib/resources/resolver.js`.
2. Pass `FUSION_RESOURCES_PATH` and `FUSION_APP_USER_DATA` from Electron to the spawned server.
3. Update prompt loading to use packaged prompts when available.
4. Update Gwen model config/provider to support local model roots while retaining dev fallback to Hugging Face.
5. Update Whisper model resolution to prefer packaged/userData model paths before `~/.whisper`.
6. Add documentation comments that packaged app code must not write into the app bundle.
7. Add syntax/unit checks that do not require downloading or loading the large models.

## Verification

Run checks that avoid model download unless explicitly requested:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node -e "const r=require('./lib/resources/resolver'); console.log(r.getResourcesRoot())"
node -c lib/resources/resolver.js
node -c lib/capabilities/prompt-loader.js
node -c lib/capabilities/providers/transformers-js.js
node -c lib/transcription/index.js
```

Electron dev smoke:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
npm run electron
```

Manual assertions:

- Server starts with `FUSION_RESOURCES_PATH` in its environment.
- Prompt loader can find packaged prompts when present.
- Prompt loader falls back to repo prompts in dev.
- Whisper warm still works when no packaged model is present and dev fallback exists.
- Gwen warm is not required for this slice unless local model files are present.
