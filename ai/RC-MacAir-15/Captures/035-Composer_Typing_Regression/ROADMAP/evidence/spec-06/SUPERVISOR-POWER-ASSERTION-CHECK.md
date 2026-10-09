# Supervisor power-assertion check — 2026-09-26

Owner asked whether caffeinate expired at the V-RENDER02 focus loss and reported lid open and power on. This does not establish whether an app switch occurred.

Read-only `pmset -g log` provides these exact local timestamps (PDT):

- 04:53:30: PID 97410(caffeinate) created display-idle, system-sleep and user-active assertions.
- 04:53:31: the same assertions received `ClientDied`, duration 00:00:01. The supervisor's background `nohup` launch did not persist for the requested eight hours. Cause of termination was not established. Earlier supervisor statements implying continued runtime were incorrect; verifying a process after one second was insufficient.
- 05:14:31: PID 24310(caffeinate), the V-RENDER02 command-lifetime wrapper, created `PreventUserIdleDisplaySleep`.
- 05:15:05.397/05:15:05.699: native hide/blur in the preserved V-RENDER02 receipt.
- 05:15:42: PID 24310's display assertion received `ClientDied`, after the test's focus failure and teardown.

Thus expiry of the requested eight-hour assertion does not explain this event: it ended much earlier, and the test-specific display assertion covered the failure. No matching system sleep/wake/display-off line was returned by the bounded 05:14–05:15 power-log query. This does not establish who or what caused native focus loss, nor exclude explicit lock or other non-sleep causes.

At 16:03 PDT, PID 97410 was absent and current assertions had no caffeinate display assertion. The supervisor repaired its failed earlier operation by starting `/usr/bin/caffeinate -dismu -t 28800` in persistent exec session 82784, PID 55084. Separate later checks verified it still running, all five assertions present, and about 28,791 seconds remaining. Session polling also confirmed it remains active. This replaces the unfulfilled eight-hour request; fixture cleanup must not terminate it. No lock/security settings were changed and no performance test restarted.
