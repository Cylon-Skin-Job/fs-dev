# SOAK04 native-control capability boundary

2026-09-27 UTC. Run `chat-arch-1790481623664-99ce1140a0`, exact owned Electron PID 41953/window 1. Initial native focus acquired automatically. First Delete checkpoint began 1790481647698, deadline 1790481767698 (04:02:47.698 UTC), outside all typing measurements. The fixture had already completed its public Delete and durable absence checks.

Supervisor read the fresh sequence-1 READY receipt, then attempted documented CUA operations only: existing app getAXState (31.7-second initialization timeout), getState (32-second native initialization timeout; in-app browser inventory still available), and known Electron bundle getApp (32-second initialization timeout). Zero native actions, zero ACKs. No late action after deadline. The run correctly failed with `native Delete ACK deadline elapsed`, exit 1, 145,545 ms. No 45-minute workload, resource baseline or measured typing window completed. This is neither a product performance failure nor a pass.

Supervisor independently inspected run-result, exact temporary root absence and owned PIDs 41197/41209/41953 absence. Orchestrator separately confirmed SQLite quick-check OK, ports/roots removed, no leaks, and all 1,957 source/200 build entries unchanged.

## Safe recovery attempted

With no test running, repeated native inventory failed. Resetting the CUA runtime and making a fresh documented getState call also failed at initialization. The existing independent orchestrator performed exactly one getState from its separate runtime: native apps empty with `Computer Use server error -10005: codex app-server exited before returning a response`, while in-app browser inventory remained available. Thus the failure is not confined to the supervisor's session.

Read-only local process/log inspection found the shared SkyComputerUseService still running as PID 11078 under desktop app PID 10980. Its presence is not proof of a healthy connection. Logs inspected did not establish a narrower root cause or a documented automatic repair. A large shared CUA runtime population was observed but is not causally attributed. No shared process was killed, no permission/settings changed, no plugin uninstalled, and no Codex or Mac restart performed.

## Preserved work and next authority

B20 product guard has 23 passing targeted checks at both levels, successful build and both fresh reviews CLEAN. COMPOSITION02 native revalidation and VRENDER04 all six cases remain valid with their documented limits. The supervisor's Roadmap Implementation Supervisor workflow keeps the acceptance gates intact and routes the repair through the original chain; it does not fabricate acceptance from the tooling failure.

Only one assessed, unchanged-candidate SOAK05 coordination retry is authorized after native control health is demonstrated. No repeated launches while capability is unavailable. The next proposed recovery is restarting the shared native computer-use helper; because it can affect other tasks, obtain explicit owner approval before doing so. Do not assume permission to restart the whole desktop app, Mac, live Fusion/Alpha, or security services. After approved recovery, prove native inventory/target binding healthy before launching; continue real 45-minute testing, then explicit owner symptom acceptance and 06C in order.

No independent product/test work currently remains executable that would satisfy the missing soak gate. No owner keyboard click is requested as a substitute. This is a genuine external capability/authority boundary, not a test finding or dirty-worktree blocker.

## Owner-approved helper restart — 2026-09-27 05:09–05:13 UTC

Owner replied “Yes” to restarting only the native computer-use helper and resuming testing if healthy. Supervisor verified the executable and bundle, terminated only helper PID 11078 with TERM, and reopened `/Users/rccurtrightjr./.codex/computer-use/Codex Computer Use.app` in the background. The old helper exited; its guardian ended with it. New helper PID 59859 was verified alive more than two minutes later. Desktop PID 10980, its runtime PID 11010, and the existing eight-hour caffeinate PID 55084 were not restarted. No Mac reboot, permission changes, plugin reinstall, live Fusion/Alpha changes, or source/fixture changes occurred.

After resetting the CUA runtime, fresh native inventory failed in 5.6022 seconds with `Computer Use server error -10005: codex app-server exited before returning a response`. A bounded second health check after verifying the replacement helper alive failed in 31.5873 seconds with `timed out waiting for initialize from codex app-server`. Both returned an empty native app inventory. Listing an in-app browser entry does not demonstrate a usable browser connection. Zero UI actions were sent; SOAK05 was not launched.

The approved helper restart was performed but did not restore native control. Logs did not establish a narrower cause or guarantee a next repair. The next proposed recovery is a restart of the hosting desktop application, which requires separate authority and may interrupt this conversation and other active tasks. Do not perform it under helper-only approval. Preserve B20, COMPOSITION02, VRENDER04 and all prior failed evidence; resume the single assessed SOAK05 only after demonstrated native health. Hourly monitoring remains paused while no test/orchestrator work is executable. Final owner symptom acceptance and 06C remain pending.
