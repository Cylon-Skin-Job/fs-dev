# Handoff: Electron Model Packaging Slice 12 - Unsigned Packaging Repair

## Status

READY FOR EXECUTION

## Objective

Repair local Electron directory packaging so `npm run electron:pack` exits successfully with the bundled Gwen/Qwen2.5 and Whisper assets, without attempting macOS signing for local smoke builds.

Do not change model runtime, Whisper, chat, thread, or wire behavior in this slice.

## Verified Prior State

Slice 11 successfully swapped Gwen from incompatible Qwen3.5 to Qwen2.5.

Model target:

```text
onnx-community/Qwen2.5-0.5B-Instruct
```

Local Gwen warm passed:

```js
{
  result: { success: true, capability: 'sttCleanup', status: 'ready' },
  ms: 1696
}
```

No `CausalConvWithState` error remains.

Current local model assets:

```text
fusion-studio-client/electron/resources/models/gwen-0-8b/ 759M
fusion-studio-client/electron/resources/models/whisper/ 1.5G
fusion-studio-client/release/ 3.5G
```

Packaged output was produced and contains Qwen2.5 assets at:

```text
fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/
```

But `npm run electron:pack` exited nonzero during macOS signing:

```text
RangeError: Invalid array length
    at Reader.next (.../node_modules/@electron/osx-sign/node_modules/isbinaryfile/lib/index.js:41:18)
```

This slice is about disabling or bypassing signing for local `--dir` packaging smoke builds.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-11-clean-swap-to-qwen25.md
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

The worktree is expected to be dirty and contains large untracked model/release assets. Do not revert unrelated changes.

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

Do not change Gwen/Qwen or Whisper runtime code in this slice.

## Scope

### 1. Inspect Current Electron Builder Config

Inspect:

```text
fusion-studio-client/package.json
```

Current relevant scripts/config likely include:

```text
electron:prepare
electron:pack
electron:dist
build.mac.target = dir
extraResources = electron/resources
```

### 2. Disable Signing For Local Directory Pack

Make local `electron:pack` avoid macOS signing.

Acceptable approaches:

1. Add `CSC_IDENTITY_AUTO_DISCOVERY=false` to the `electron:pack` script.
2. Set Electron Builder mac signing identity to `null` for local dir builds.
3. Add a separate explicit unsigned script and make `electron:pack` use it.

Preferred outcome:

```text
npm run electron:pack
```

should produce a directory build and exit `0` without signing.

Do not break future `electron:dist`; if signing/notarization is needed later, leave it as a separate future concern.

### 3. Re-run Packaging

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

Expected:

- command exits `0`,
- packaged app directory exists,
- resources are included,
- no signing `RangeError`.

### 4. Verify Packaged Resource State

Confirm packaged app contains:

```text
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/config.json
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/gwen-0-8b/onnx/model_q4.onnx
release/mac-arm64/Fusion Studio.app/Contents/Resources/models/whisper/ggml-large-v3-turbo.bin
release/mac-arm64/Fusion Studio.app/Contents/Resources/prompts/Gwen-0-8B/STT_PROMPT.md
```

### 5. Optional Packaged Launch Smoke

If `electron:pack` exits `0`, launch the packaged app with explicit temp user data:

```bash
FUSION_APP_USER_DATA=/private/tmp/fusion-pack-smoke-user-data-$(date +%Y%m%d-%H%M%S) \
open "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app"
```

Confirm:

- app window opens,
- server emits `SERVER_READY`,
- resources root is packaged `Contents/Resources`,
- fresh DB migrates.

Do not run voice transcription in this slice.

## Non-Goals

- Do not run real Whisper transcription.
- Do not call `/api/transcribe`.
- Do not change Gwen model target.
- Do not change Whisper model handling.
- Do not add first-run download UI.
- Do not add model manager UI.
- Do not expose AI-callable tools.
- Do not touch chat/thread/wire/runtime files.
- Do not commit large model binaries unless explicitly instructed.

## Required Checks

Syntax/package checks:

```bash
cd /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client
npm run electron:pack
```

If Electron files are changed:

```bash
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/main.cjs
node --check /Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/electron/server-spawn.cjs
```

Resource existence checks can be done with Node or shell, but do not delete release output unless needed.

## Acceptance Criteria

- `npm run electron:pack` exits successfully.
- Local directory packaging does not attempt/fail macOS signing.
- Packaged output includes Gwen/Qwen2.5, Whisper, and prompts.
- Optional packaged launch smoke passes if run.
- No model runtime/chat/thread/wire code is changed.
- Large assets remain untracked unless explicitly instructed otherwise.

## Final Report Requirements

Report:

- changed files,
- exact packaging config/script change,
- `npm run electron:pack` result,
- packaged app path,
- packaged resource checks,
- whether packaged launch smoke was run,
- server ready line if launched,
- resource root and DB path if launched,
- large untracked assets still present,
- any remaining blocker/error exactly as emitted.
