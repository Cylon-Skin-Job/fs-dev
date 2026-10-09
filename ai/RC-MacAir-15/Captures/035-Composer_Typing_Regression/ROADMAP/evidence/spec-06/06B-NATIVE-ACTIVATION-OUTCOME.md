# B13 native activation / protocol outcome

## Current B13 outcome — 2026-09-26T02:40Z

The single authorized native-activation/protocol diagnostic completed and cleaned up. **06B remains BLOCKED on unmet native foreground execution evidence**, with full rendering/sustained/soak, native methods and explicit owner original-symptom acceptance still required. 06C has not begun. No retry, performance run or follow-on launch occurred. Earlier preparation/GO-pending records are superseded for B13 only.

Frozen source: 1,943 files SHA256 `9faf3014487a04223f2452d7312fe8a099b5ce18d31f5a819eac558ec1041c64`; unchanged build: 200 files SHA256 `6c06602b58f8dc0e4a9b1ed6588c5670b8e628b21044040a581e9e9d55f05234`. Root independently rehashed every entry after the run, with zero mismatches (`06B/B13-ROOT-POSTRUN-IDENTITY.json`). Ten fixture/test changes, five exact predecessor snapshots, no product/dependency edits. Builder and root each passed 20 Node and four Chromium checks. Fresh builder `/root/builder06b/review06b_activation1` and root `/root/review06b_activation1` returned terminal CLEAN. This is bounded fixture integration, not acceptance or a standards waiver.

Run `chat-arch-1790390151299-353c7fc4ec` started 02:35:51.299 UTC, lasted 137.268 seconds and exited 0 without timeout/interruption. The exact owned Electron PID was 66074/window1. Prelaunch notice and READY identity were relayed to the supervisor, with clickRequired:false. The command used its own display-sleep assertion and left the supervisor's eight-hour assertion untouched. No human click, typing, later reactivation or app-management action was requested or injected. The runner's `passed` is diagnostic completion only: `measurementStarted:false` and `observation-completed-no-acceptance` remain explicit.

### Independently inspected raw evidence

Root read all 1,254 native records, 2,779 Node protocol records and 414 correlated timeline entries, plus run/result/cleanup summaries in `../spec-01/01B/chat-arch-1790390151299-353c7fc4ec/`.

| UTC | Recorded fact |
|---|---|
| 02:35:56.764 | Main observer installed: already inactive, unfocused and owned window not key |
| 02:35:56.769–56.774 | One initial activation sequence; window.show, moveTop, app.focus, window.focus and webContents.focus each return without throwing, with no observed native state change |
| 02:35:56.774–02:38:06.774 | Exactly 130,000 ms observation; 1,250 successful queries, zero failures |
| 02:38:06.803 | Diagnostic complete/closing marker |
| 02:38:07.854 | Explicit close request, after native/renderer observer restoration |
| 02:38:07.936 | Node disconnect during the planned close tail |
| 02:38:08.148 | Owned Electron process exits 0 |
| 02:38:08.469–08.570 | Close complete, protocol hook restored, fixture cleanup complete |

Every one of the 1,250 queries reports `appActive:false`, `focused:false`, `ownedWindowIsKey:false`, `visible:true`, `minimized:false`, `appHidden:false`. The independent 130 main samples agree. No did-become-active/did-resign-active, focus/blur, hide/show or corresponding later method event is present during the observed interval. Consequently this run records **failure to establish native activation from an already inactive state**, not an observed deactivation transition or loss after successful activation. Calls returning normally do not prove that macOS granted activation. Any earlier progress wording suggesting a newly observed focus loss is superseded by this complete record.

The single renderer document has 131 samples with hasFocus=true/visibilityState=visible. These are explicitly non-independent foreground signals because installed Playwright enables focus emulation and Fusion disables background throttling. They do not contradict or override the native predicate failure.

All 1,388 observed allowed Runtime requests have matching responses. There are zero original protocol errors during observation **and during shutdown**, zero recorded context-create/destroy/clear events after hook installation, zero pending requests, and one expected Node disconnect after explicit close. The logger was restored. There is no protocol-rewrite cause to classify in this run: B12's generic main-evaluation failure did not recur. B13 uses a different diagnostic path and a later-installed tap, so this bounded non-reproduction cannot disprove B12, establish its original reason or claim a repair. Pre-install context history is unavailable.

Native/protocol/timeline receipts show zero overflow, write/recording/observation/emission errors and no recorded timeline poll gaps. Complete flags mean recording scope completed only. No reload, calibration, settling, sustained typing, native input or performance acceptance was attempted.

### Disposition and concrete next step

- App deactivation versus key-window-only loss: neither transition is captured. App inactivity and key-window absence coexist from the first observable state. The key-loss-while-app-active hypothesis does not describe this run; the event that produced initial inactivity remains outside observed coverage.
- Original Node error versus generic rewrite: no error recurred, including close tail; B12's reason remains unresolved. Do not call the planned disconnect an acquisition-error recurrence.
- Cause/repair: no product, macOS, external actor, owner action or activation-policy cause is established. No focus workaround or relaxed gate is justified.

The concrete next investigation is a read-only audit of the exact owned launch path and Electron bundle activation prerequisites, followed—only under a new bounded supervisor direction—by early owned-process/window lifecycle observation before firstWindow/Connected waits. Current tracing starts after these launch waits, so it cannot explain why the app is already inactive when B13 begins. Earlier observation should preserve launch/activation behavior and collect only this process's activation/window readiness predicates/events, with existing privacy and cleanup boundaries. Do not simply repeat the same 130-second probe or launch full performance tests from this completion. No implementation or next runtime is authorized by this proposal.

Cleanup reports SQLite quick-check okay, removed port/profile/workspace/stage roots and no lingering/leaked owned processes. Root independently confirmed the exact run root and recorded PIDs 65418, 65430, 65442 and 66074 absent at 02:39:11.573 UTC (`06B/B13-ROOT-CLEANUP.json`). No unrelated process survey/termination, live profile/DB, settings/security/input-source change, dependency patch, release or Alpha operation occurred. Runtime lane is released. Both fresh reviewers and builder `/root/builder06b` are terminal; the builder returned its completed bounded handoff with overall06B BLOCKED. No close_agent tool exists.

The [orchestrator skill](/Users/rccurtrightjr./.codex/skills/orchestrator/SKILL.md) requires “Block only for genuine authority or execution impossibility.” The unmet native execution prerequisite is recorded rather than waived. SPEC06/06B still requires “V-RENDER; V-SOAK; R9 isolated native manual checklist with timestamped owner acceptance”; 06C requires “06B evidence complete; owner symptom acceptance recorded.” Those requirements remain open; this diagnostic supplies no replacement acceptance.
