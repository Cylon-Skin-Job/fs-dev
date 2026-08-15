# Handoff: Electron Model Packaging Slice 14 - Dev Voice Flow Smoke

## Status

READY FOR EXECUTION

## Objective

Run the first end-to-end dev Electron voice-flow smoke using local Whisper and local Gwen/Qwen2.5 cleanup.

This slice verifies the actual user path:

```text
mic modal opens
→ transcription warm endpoint runs
→ short recording is captured
→ Whisper transcribes
→ Gwen/Qwen2.5 cleanup runs or safely falls back
→ cleaned/raw text is inserted into chat input
```

Do not change packaging, model download scripts, chat runtime, thread runtime, or wire code unless the smoke exposes a directly related voice/transcription bug.

## Current Verified State

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

Restart script:

```text
/Users/rccurtrightjr./projects/Fusion-Home/restart-fusion.sh
```

Model/resource state:

```text
Gwen/Qwen2.5 local model:
fusion-studio-client/electron/resources/models/gwen-0-8b/

Whisper local model:
fusion-studio-client/electron/resources/models/whisper/ggml-large-v3-turbo.bin

Prompt resources:
fusion-studio-client/electron/resources/prompts/Gwen-0-8B/
```

Verified milestones:

- Gwen/Qwen2.5 local warm passed in about 1.7s.
- Whisper `initWhisper()` passed in about 140ms.
- Unsigned `npm run electron:pack` passed.
- Packaged launch smoke passed with explicit temp `FUSION_APP_USER_DATA`.
- Packaged resources and fresh DB migration were verified.

Packaged smoke details for reference:

```text
Packaged app:
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app

Server ready:
SERVER_READY:56528

Resource root:
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources

Fresh DB migration:
migrationCount=24
lastMigration=025_workspace_ribbon_membership.js
```

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/CAPABILITY_LAYER_AND_GWEN_ONESHOT_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

Relevant implementation files:

```text
fusion-studio-client/src/mic/MicTrigger.tsx
fusion-studio-client/src/mic/useAudioCapture.ts
fusion-studio-server/lib/transcription/index.js
fusion-studio-server/lib/capabilities/registry.js
fusion-studio-server/lib/capabilities/providers/transformers-js.js
fusion-studio-server/lib/capabilities/prompt-loader.js
fusion-studio-server/lib/resources/resolver.js
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

### Do Not Touch Runtime Areas

Avoid changes in these paths:

```text
fusion-studio-server/server.js unless absolutely required
fusion-studio-server/lib/thread/*
fusion-studio-server/lib/wire/*
fusion-studio-client/src/lib/ws/*
chat runtime/display files
```

This slice is voice/transcription/capability smoke only.

### Do Not Commit Large Assets

Large model/package assets are expected to remain untracked unless explicitly instructed otherwise:

```text
fusion-studio-client/electron/resources/models/
fusion-studio-client/release/
```

## Preflight Checks

### 1. Syntax Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
node --check lib/transcription/index.js
node --check lib/capabilities/registry.js
node --check lib/capabilities/providers/transformers-js.js
node --check lib/capabilities/prompt-loader.js
node --check lib/resources/resolver.js
```

If client mic files are touched, also run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run build
```

### 2. Local Detection

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const r=require('./lib/resources/resolver'); const {getModel}=require('./lib/capabilities/registry'); console.log({resources:r.getResourcesRoot(), prompts:r.getPromptsRoot('Gwen-0-8B'), gwen:r.getModelRoot('gwen-0-8b'), whisper:r.getWhisperModelPath('large-v3-turbo'), model:getModel('gwen-0-8b')})"
```

Expected:

- resources root points to `fusion-studio-client/electron/resources`,
- Gwen model ID is local model path,
- Whisper model path is Electron resource model file.

### 3. Direct Warm Checks

Run Gwen/Qwen2.5 warm:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const {warmCapability}=require('./lib/capabilities'); warmCapability('sttCleanup').then(r=>console.log({result:r, ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

Run Whisper warm:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-server
FUSION_RESOURCES_PATH=/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/resources \
node -e "const started=Date.now(); const t=require('./lib/transcription'); t.initWhisper().then(()=>console.log({result:'whisper ready', ms:Date.now()-started})).catch(e=>{console.error(e);process.exit(1)})"
```

If either direct warm fails, stop and report the exact error. Do not proceed to UI smoke.

## Restart Dev Electron

Run:

```bash
cd /Users/rccurtrightjr./projects/Fusion-Home
./restart-fusion.sh
```

Expected:

- client build succeeds,
- Electron launches,
- script prints server URL.

Record:

- Electron PID,
- Electron log path,
- server URL.

## HTTP Warm Endpoint Smoke

Using the server URL from restart, run:

```bash
curl -s http://localhost:<PORT>/api/health
curl -s -X POST http://localhost:<PORT>/api/capabilities/warm -H 'Content-Type: application/json' -d '{"capability":"sttCleanup"}'
curl -s -X POST http://localhost:<PORT>/api/transcription/warm
```

Expected:

- `/api/health` responds,
- capability warm succeeds or reports already ready,
- transcription warm succeeds,
- no model download occurs.

## Manual Voice Flow Smoke

In the launched dev Electron app:

1. Open an existing workspace/thread where the chat input is visible.
2. Click the mic trigger.
3. Confirm the modal opens.
4. Confirm logs show the warm endpoint path running, if logged.
5. Record a short clear phrase, for example:

```text
Claude should clean up this transcript and make a short bullet list: apples, bananas, oranges.
```

6. Stop/send the recording.
7. Confirm text appears in the chat input.

Expected result:

- Whisper returns a transcript.
- Gwen/Qwen2.5 cleanup runs.
- If cleanup succeeds, text is cleaned/punctuated.
- If cleanup fails, raw Whisper transcript is inserted and the response includes/records cleanup failure without breaking transcription.

Do not send the chat prompt unless needed for manual visibility. The smoke is about voice-to-input, not model chat response.

## Log Checks

Inspect relevant logs after voice flow:

```text
/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/fusion-electron.log
/tmp/fusion-studio.log if present
fusion-studio-server/server-live.log if present
```

Report any relevant lines for:

- `[Transcription]`,
- `[Capabilities]` or capability warm/run logs if present,
- cleanup failure/fallback,
- server errors.

Do not add logging unless necessary to diagnose a failure.

## Non-Goals

- Do not package or rebuild release output unless directly needed.
- Do not run `electron:pack` in this slice.
- Do not edit model download scripts.
- Do not change the Gwen/Qwen model target.
- Do not touch chat/thread/wire/runtime files.
- Do not implement first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not commit large model binaries.

## Acceptance Criteria

- Direct Gwen/Qwen2.5 warm passes.
- Direct Whisper warm passes.
- Dev Electron restarts successfully.
- HTTP warm endpoints pass.
- Mic modal opens.
- Short recording produces text in chat input.
- Cleanup succeeds or raw fallback is confirmed.
- No model redownload occurs.
- No chat/thread/runtime files are touched.

## Final Report Requirements

Report:

- repo status summary before/after,
- direct local detection output,
- direct Gwen warm result/time,
- direct Whisper warm result/time,
- Electron restart result: PID/log/server URL,
- HTTP warm endpoint responses,
- manual voice flow result,
- whether cleanup succeeded or fallback occurred,
- relevant logs/errors,
- changed files,
- large untracked assets still present,
- any remaining blocker exactly as emitted.
