# Handoff: Electron Model Packaging Slice 1 - Resource Resolution

## Status

READY FOR EXECUTION

## Objective

Prepare the capability/Whisper stack for Electron-packaged model and prompt resources without downloading or loading large models during this slice.

The user requirement is: when Fusion Studio is bundled in Electron, Gwen/Qwen and Whisper should either be bundled or managed by the app with no manual user setup.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/ai/views/wiki-viewer/content/enforcement/code-standards/PAGE.md
/Users/rccurtrightjr./projects/fs-dev/AGENTS.md
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-server/AGENTS.md
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

Capability layer slice has already been implemented:

```text
fusion-studio-server/lib/capabilities/
System Source Files/Prompts/Gwen-0-8B/
POST /api/capabilities/warm
POST /api/transcription/warm
```

Known current limitations:

- `prompt-loader.js` resolves prompts from the repo path only.
- `providers/transformers-js.js` loads a Hugging Face model ID directly.
- Whisper still resolves through `nodejs-whisper`, `~/.whisper`, and its package model directory.
- `fusion-studio-client/electron/server-spawn.cjs` does not pass Electron resource paths to the spawned server.

## Scope

### 1. Add Server Resource Resolver

Create:

```text
fusion-studio-server/lib/resources/resolver.js
```

One job:

```text
Resolve app resource paths across Electron packaged mode, Electron dev resources, repo fallback paths, and writable user-data cache.
```

Suggested exports:

```js
getResourcesRoot()
getPromptsRoot(promptSet)
getModelRoot(modelName)
getWhisperModelPath(modelName)
getWritableModelCacheRoot()
```

Resolution inputs:

```text
process.env.FUSION_RESOURCES_PATH
process.env.FUSION_APP_USER_DATA
repo root fallback
```

Do not import transcription, capabilities, or Electron modules from this resolver.

### 2. Pass Electron Resource Env To Server

Update:

```text
fusion-studio-client/electron/server-spawn.cjs
```

The spawned server should receive:

```text
FUSION_RESOURCES_PATH
FUSION_APP_USER_DATA
```

In dev mode, resources can point at:

```text
fusion-studio-client/electron/resources
```

When packaged, resources should use Electron's `process.resourcesPath` from main process. If `server-spawn.cjs` does not currently have direct access to `app`, pass these values into `spawnServer()` from `electron/main.cjs` rather than importing Electron in the spawn helper.

### 3. Update Prompt Loader

Update:

```text
fusion-studio-server/lib/capabilities/prompt-loader.js
```

Resolution order:

```text
1. packaged/dev resources prompts/Gwen-0-8B/<file>
2. repo System Source Files/Prompts/Gwen-0-8B/<file>
```

Keep basename validation.

### 4. Prepare Gwen Model Local Root Support

Update registry/provider minimally so local model roots are possible without changing consumers.

Files:

```text
fusion-studio-server/lib/capabilities/registry.js
fusion-studio-server/lib/capabilities/providers/transformers-js.js
```

Required behavior:

- If a local model root exists for `gwen-0-8b`, pass that local path to Transformers.js.
- If not, keep the current Hugging Face model ID fallback for dev.
- Do not download or warm the model in tests for this slice.

### 5. Prepare Whisper Packaged Model Resolution

Update:

```text
fusion-studio-server/lib/transcription/index.js
```

Required behavior:

- Prefer packaged/userData Whisper model paths when present.
- Keep existing `~/.whisper` fallback for dev.
- Keep current `nodejs-whisper` expected models directory behavior.
- Do not write into the installed app bundle.

If `nodejs-whisper` requires the file under its package models directory, copy or hard-link only from a read-only packaged model source into a writable expected/cache location. If the expected package model directory is writable in dev, preserve current behavior.

## Non-Goals

- Do not implement download scripts yet.
- Do not bundle actual model files yet.
- Do not run Gwen/Qwen warm if it would download the model.
- Do not run a real Whisper transcription unless the model is already available and the test is explicitly safe.
- Do not add Perplexity, Nano Banana, OpenAI, or Anthropic providers.
- Do not add a model manager UI.
- Do not expose AI-callable tools.

## Required Checks

Server syntax checks:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node -c lib/resources/resolver.js
node -c lib/capabilities/prompt-loader.js
node -c lib/capabilities/providers/transformers-js.js
node -c lib/capabilities/registry.js
node -c lib/transcription/index.js
```

Lightweight resolver check:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node -e "const r=require('./lib/resources/resolver'); console.log({resources:r.getResourcesRoot(), prompts:r.getPromptsRoot('Gwen-0-8B'), model:r.getModelRoot('gwen-0-8b')})"
```

Client build check if Electron spawn code changed:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

## Acceptance Criteria

- Server has a focused resource resolver module.
- Electron passes resource/userData paths to the server process.
- Prompt loader can load packaged prompts when present and repo prompts in dev.
- Gwen/Qwen capability can resolve a local model path when present while preserving Hugging Face fallback.
- Whisper init prefers packaged/userData model sources before `~/.whisper`.
- No large model download is required for verification.
- No unrelated dirty worktree changes are reverted.

## Notes For Reviewer

After this slice, the next slice should add idempotent build-time download scripts for Gwen/Qwen and Whisper, mirroring `fusion-studio-client/scripts/download-pandoc.cjs`.
