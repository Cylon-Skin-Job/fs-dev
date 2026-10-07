# S4 native UI retry — isolated window not targetable

## Result

The public UI smoke remains **NOT RUN** and overall disposition remains `RUNTIME_BLOCKED`. This follow-up did not send a prompt or create a thread.

After the owner started a two-hour `caffeinate -i` hold, I retried CUA. Two `cua.getState()` attempts timed out after 30 seconds and reset the CUA kernel. A direct `cua.getApp("Fusion Studio")` attempt returned `Computer Use server error -10005: timeoutReached`. `cua.listApps()` then succeeded and listed the running apps.

`cua.getApp("Electron")` successfully exposed the pre-existing development window. Its UI visibly showed the normal `FS Dev` workspace, `ai/RC-MacAir-15`, connected state, and pre-existing thread history. I did not use this window for the smoke. The exact Electron bundle identifier was ambiguous because multiple Fusion Studio and Alpha bundles share it; binding to the Electron runtime path/display name repeatedly returned the older normal-profile window. Its Window menu showed only the current `Fusion Studio` window. `Bring All to Front` and the standard macOS window-cycle shortcut did not expose a second window in the CUA accessibility state. `cua.listWindows()` is not available in this macOS CUA runtime. Thus the native tool was reachable but could not select/verify the isolated instance; using the visible normal profile would violate the SPEC.

## Isolated launch and cleanup

Created a private scratch root `/tmp/fusion-chat-ar-smoke.wZoDy5` with:

- scratch workspace `/tmp/fusion-chat-ar-smoke.wZoDy5/workspace`, containing only `ai/RC-MacAir-15/System/config/cli.json` and `opencode-models.json` copied from the current workspace policy;
- fresh Electron profile `/tmp/fusion-chat-ar-smoke.wZoDy5/profile`, including its isolated `server-data/fusion.db`, `server-live.log` and `server.port`.

Started the ordinary development Electron entry point with `FUSION_APP_USER_DATA=/tmp/fusion-chat-ar-smoke.wZoDy5/profile` and `FUSION_LOCAL_MACHINE=RC-MacAir-15`. The server announced ready on port `57436`; its Electron main process was PID `56521` and had the expected isolated child server PID `56526`. The process arguments showed the development `node_modules/electron/dist/Electron.app` executable. The profile is separate from both the normal Fusion profile and Alpha. No workspace was added because the isolated product window could not be reached; no authentication, thread, prompt, provider child/session, response, or durable exchange was attempted.

Sent SIGTERM to only isolated Electron PID `56521`. `electron/main.cjs` installs a SIGTERM handler that invokes its cleanup path; afterward both PID `56521` and child PID `56526` were absent. Scratch files and logs remain preserved under the path above for review. Existing development and Alpha processes were left running and untouched.

## Resume

Repeat only when CUA can bind a distinct isolated development Electron window (for example, when the tool can select an exact native window/process despite duplicate Electron app identifiers). Keep the normal and Alpha profiles untouched. Verify the active workspace and isolated profile in the native UI before sending one short non-sensitive OpenCode prompt, then collect every exact §6.S4 acceptance item. No code repair is indicated by this attempt.

## Owner-authorized identity-clone retry

The owner explicitly authorized a reversible copy of the Electron bundle with a unique bundle identifier/display name, running the unchanged development entry point against a new isolated profile. Created `/tmp/fusion-chat-ar-smoke.wZoDy5/runtime/Fusion Studio Smoke.app`; only the copied `Info.plist` identity fields were changed. The source Electron bundle and product code were untouched. Launched the ordinary `electron/main.cjs` entry point with `FUSION_APP_USER_DATA=/tmp/fusion-chat-ar-smoke.wZoDy5/profile-isolated` and `FUSION_LOCAL_MACHINE=RC-MacAir-15`. CUA uniquely listed and bound `com.fusionstudio.codex.smoketest`; process PID `57121` and renderer arguments confirmed the scratch profile. The server started on port `57563`.

The product UI showed `Connected` and machine source `ai/RC-MacAir-15`, but the isolated database had auto-registered the development checkout as its default workspace. The visible application was darkened by an open macOS Connectors surface and a capture preview. Clicking its accessibility Close and workspace-switch controls did not dismiss the overlay or expose a workspace menu; repeated fresh AX reads showed the same active `Fusion Studio` workspace and its unrelated checkout captures. I did not create a thread or send a prompt because the scratch workspace was not visibly active. This retry therefore also leaves the public UI smoke **NOT RUN** and the S4 runtime acceptance blocked. Sent SIGTERM only to isolated smoke PID `57121`; normal development and Alpha processes were untouched. The smoke profile and scratch evidence remain under `/tmp/fusion-chat-ar-smoke.wZoDy5`.

Next safe action: resolve the native UI overlay/workspace selector behavior for this uniquely targetable app window, add and visibly activate `/tmp/fusion-chat-ar-smoke.wZoDy5/workspace` through the product UI, then resume the exact §6.S4 flow. Do not send from the current workspace or report S4 runtime acceptance complete.
