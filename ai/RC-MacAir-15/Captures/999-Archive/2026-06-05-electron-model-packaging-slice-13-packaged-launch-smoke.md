# Handoff: Electron Model Packaging Slice 13 - Packaged Launch Smoke

## Status

READY FOR EXECUTION

## Objective

Run a focused launch smoke against the existing unsigned packaged Electron app and verify the packaged resource/runtime wiring without changing unrelated code.

The app under test is:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app
```

## Verified Prior State

- Gwen/Qwen2.5 local warm passed.
- Whisper warm passed.
- `npm run electron:pack` succeeds unsigned.
- Packaged output exists at `fusion-studio-client/release/mac-arm64/Fusion Studio.app`.
- Packaged resources should be rooted at `Fusion Studio.app/Contents/Resources`.

## Required Reading

```text
/Users/rccurtrightjr./projects/fs-dev/docs/ELECTRON_MODEL_PACKAGING_SPEC.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-11-clean-swap-to-qwen25.md
/Users/rccurtrightjr./projects/fs-dev/docs/handoffs/2026-06-03-electron-model-packaging-slice-12-unsigned-packaging-repair.md
/Users/rccurtrightjr./projects/fs-dev/ai/<machine>/Wiki/enforcement/code-standards/PAGE.md
```

## Startup Checks

Run:

```bash
cd /Users/rccurtrightjr./projects/fs-dev
git rev-parse --show-toplevel
git status --short
git log -1 --oneline
```

Expected root:

```text
/Users/rccurtrightjr./projects/fs-dev
```

The worktree is expected to be heavily dirty and may contain large untracked model/release assets. Do not revert unrelated changes.

## Hard Boundaries

Do not work on:

```text
RCC-0076
validation cleanup
chat runtime
thread/wire code
anything inside fusion-studio-client/release/ directly
```

Do not edit code unless the packaged smoke fails and the fix is directly packaging/resource-path related.

Do not run real transcription or call `/api/transcribe` in this slice.

Do not rebuild or delete `release/` unless the coordinator explicitly asks.

## Smoke Procedure

### 1. Prepare Isolated User Data

Use a fresh temp directory outside the repo:

```bash
SMOKE_USER_DATA="/private/tmp/fusion-pack-smoke-user-data-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SMOKE_USER_DATA"
```

### 2. Launch Packaged App

Launch with explicit temp user data:

```bash
FUSION_APP_USER_DATA="$SMOKE_USER_DATA" \
open "/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app"
```

If `open` does not preserve the environment in the active shell, launch the binary directly instead:

```bash
FUSION_APP_USER_DATA="$SMOKE_USER_DATA" \
"/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/MacOS/Fusion Studio"
```

### 3. Confirm Launch Signals

Confirm:

- App window opens.
- Electron log reports server ready.
- Server stdout emits `SERVER_READY:<port>`.
- Resource root is the packaged app resource root:

```text
/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/release/mac-arm64/Fusion Studio.app/Contents/Resources
```

- User data is the explicit temp directory.
- Fresh SQLite DB is created under:

```text
$SMOKE_USER_DATA/server-data/robin.db
```

- Fresh migrations complete without startup crash.

Useful logs:

```text
/tmp/fusion-electron.log
/tmp/electron-renderer.log
```

### 4. Confirm Packaged Resource Presence

Check that packaged resources exist without modifying `release/`:

```text
Fusion Studio.app/Contents/Resources/models/gwen-0-8b/config.json
Fusion Studio.app/Contents/Resources/models/gwen-0-8b/onnx/model_q4.onnx
Fusion Studio.app/Contents/Resources/models/whisper/ggml-large-v3-turbo.bin
Fusion Studio.app/Contents/Resources/prompts/Gwen-0-8B/STT_PROMPT.md
```

### 5. Confirm Resolver Behavior

Use logs and startup behavior to verify:

- `FUSION_RESOURCES_PATH` resolves to packaged `Contents/Resources`.
- `FUSION_APP_USER_DATA` resolves to the temp smoke directory.
- Packaged prompts are available.
- Packaged Gwen/Qwen2.5 model files are available.
- Packaged Whisper model file is available.

Do not run model warmups unless launch alone does not provide enough evidence and the coordinator approves the extra runtime smoke.

## Acceptance Criteria

- Packaged app launches successfully from the `.app` bundle.
- `SERVER_READY:<port>` is observed.
- Electron loads `http://localhost:<port>` and the app window opens.
- Resource root is `Contents/Resources` from the packaged app.
- Explicit temp `FUSION_APP_USER_DATA` is used.
- Fresh SQLite DB is created in temp user data and migrations complete.
- Packaged prompt/model files are present and resolved from packaged resources.
- No code edits are made unless a directly packaging/resource-path-related smoke failure requires repair.
- No files inside `fusion-studio-client/release/` are edited directly.

## Final Report Requirements

Report:

- Whether any files changed.
- Packaged app path tested.
- Temp `FUSION_APP_USER_DATA` path used.
- `SERVER_READY` line/port observed.
- Resource root line observed.
- DB path observed and whether fresh migration succeeded.
- App window/open load result.
- Packaged prompt/model resource checks.
- Any blocker/error exactly as emitted.
