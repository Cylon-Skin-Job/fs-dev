# Composer typing investigation — 2026-09-19

Status: reproducible rendering defect confirmed; experimental candidate passes settled typing and existing chat isolation checks. Product implementation awaits owner approval. The owner-window hard freeze and recent onset are not fully explained.

## Established result

There is a reproducible application rendering performance defect. Ordinary ASCII draft updates invalidate the chat host, which rerenders unchanged transcripts, including Markdown conversion and reply chrome. This is not explained by per-keystroke WebSocket sends or machine starvation.

The exact adjacent-commit comparison for the synthetic-history fixture is:

| Build | 68-character wall time (25 ms configured delay) | Next-rAF p95 | Long tasks |
| --- | ---: | ---: | ---: |
| `4f972c5` (local input state) | 1,929 ms | 15.9 ms | 0 |
| `501eb35` (shared draft subscribed by host) | 6,190 ms | 72.5 ms | 68 |
| `16ccecf` | 5,969 ms | 68.6 ms | 68 |
| `5073b10` | 6,148 ms | 72.6 ms | 68 |
| `88637d1`, repeat | 5,960 ms | 69.2 ms | 68 |
| Current uncommitted view-bound shell | 2,781 ms | 18.0 ms | 0 |
| `88637d1` + experimental MessageList memo | 2,040 ms | 16.0 ms | 0 |

`501eb35` is dated August 28, not the September chat-composition integration. Its diff removes ChatInput's local text state, adds the session draft store, and subscribes in the containing chat host. This establishes when the reproduced transcript-amplification defect was introduced; it does **not** establish why the owner first experienced lag a few days ago. The recent-onset report remains valid and unexplained in full.

The stress fixture combines the first 30 exchange payloads from the read-only backup into one newly created fixture session (60 rendered messages). It is deliberately not represented as an actual conversation. All versions used the same installed Electron/dependencies and synthetic keyboard harness. Early probes overlapped some build/startup work; the repeated shipped result remained approximately 6 seconds. These are local diagnostic measurements, not a controlled physical-input benchmark.

## Real conversation and workspace-content evidence

The largest actual backup conversation contains two exchanges totaling 521,561 assistant JSON characters. The copied-content fixture excludes runtime policy/state, dependency directories, binaries, generated data, and unsafe symlinks. It retains a fresh fixture registry and view policy; it is not an exact clone of the owner's open-view state.

- Current development build with copied workspace content and that actual conversation: 58,275 ms for 68 characters, next-rAF p95 643.8 ms, 201 long tasks (max 1,263 ms), zero outgoing WS messages and 80 incoming messages during measurement.
- Experimental transcript + content memo boundaries, same fixture immediately after startup: 31,788 ms; next-rAF p95 1.3 ms but **143 long tasks**, 76 incoming messages. This is still a failure, and demonstrates why next-rAF alone cannot certify responsiveness.
- The same experimental boundaries and actual conversation in the empty fixture: 1,944 ms; zero long tasks, zero incoming/outgoing WS messages.
- A transcript-only candidate's sustained realistic run stalled and was terminated through its exact owned Electron PID. It is not a passing soak. A one-second OS sample was taken only from this isolated renderer after it stalled; symbolication is unreliable and provides no trustworthy native root-cause attribution. The owner's app was never sampled.

The candidate completed the settled five-minute realistic test: 9,520 characters retained, input p95 0.6 ms, next-rAF p95 14.9 ms / max 17.6 ms, zero long tasks, zero incoming/outgoing WS messages, ending JS heap about 61 MB. This does not compare directly with the startup-loaded results above. The matched settled current-build control completed: **36,506 ms for 68 characters, next-rAF p95 578.6 ms, 136 long tasks (35,862 ms total), zero incoming/outgoing WS messages**. This isolates the reproduced sustained delay from network traffic or startup loading. The candidate and control both used the same actual two-exchange conversation and filtered workspace-content copy after a 45-second focus settling period. The first part of the soak overlapped the final older-build comparison, which affected wall pacing; no long tasks were observed across the full window. Initial workspace loading/background traffic must be separated from steady-state typing before assigning all observed time to draft rendering.

## Recent integration amplification

The uncommitted App.tsx change moves useViewChatHost into PanelContent. Its transitive useLegacyChatHost draft subscription now invalidates not only ChatArea but also its sibling ContentArea and Sidebar. ContentArea has no memo boundary in current source. This introduces a new route from every draft change to the active workspace view. It is a concrete code path and a candidate contributor to the owner's recent integration suspicion; its individual cost has not yet been isolated from transcript work in a settled single-boundary comparison. The settled two-boundary experiment removes the measured delay with zero WS traffic on both sides.

The store's selector returns the string for the exact workspace/session. It is not a newly allocated object selector or a demonstrated Zustand infinite subscription loop. Legacy panels select the same session and can all rerender; current view-bound hosts select their individual sessions. The current draft store itself does no disk/DB/event-bus work. Ordinary ASCII typing sent zero WS messages in measured windows. Emoji insertion is an exception to the blanket RAM-only claim: ChatInput calls the emoji-recents transport for inserted emoji.

## Candidate and scope

`EXPERIMENTAL-RENDER-BOUNDARIES.patch` is an unapplied experiment against the current development source:

1. Memoize MessageList with React's normal shallow prop comparison. Its own store subscriptions continue to receive live turn/activity/finalization updates, and changed transcript references still render.
2. Memoize ContentArea with its panel prop. Its own store subscription and descendant subscriptions remain active. This prevents unrelated parent draft changes from re-entering the workspace view.

No custom comparator, delayed draft write, legacy-host restoration, store identity change, or output truncation is proposed. The candidate compiled successfully in an isolated checkout. The existing rendered chat-surface isolation suite passed 10/10 in a fixture-only Playwright configuration (no server/live DB): Send, interleaved live frames, Stop, readiness, model selection, draft/attachment ownership, menus, collapse/state continuity, and surface-owned pending state. Owner acceptance, a dedicated render regression gate, and the final view-bound shell smoke remain outstanding. The main source files remain exactly as found.

## Measurement limitations and remaining acceptance

- Keydown-to-input observes DOM event dispatch before React finishes its work; low values did not rule out severe lag.
- `frameP95` is keydown-handler to next requestAnimationFrame callback, not proof of presented pixels, OS input queue latency, or caret animation.
- No physical-keyboard/AppleScript comparison, Wispr Flow control, streaming-turn test, or 30–60 minute growth test has been completed.
- No DB-write-volume measurement was taken. Zero outgoing ASCII typing frames narrows the transport hypothesis but does not prove absence of background server writes.
- The owner-window hard freeze has not been definitively attributed. The isolated stalled run is separate evidence, not proof of the same failure.
- No Alpha source/profile/app changes, live DB changes, commit, amend, or push were performed.
- Product implementation follows the brief's SPEC/orchestrator and explicit acceptance requirement. This investigation and temporary experiments do not authorize silently landing the patch.

## Reproduction

Use `fusion-studio-client/e2e/composer-regression-probe.mjs`. Build the selected client first. Set COMPOSER_CLIENT_ROOT to its absolute client directory; the script initializes that checkout's schema in a new temp profile. Use COMPOSER_HISTORY=30 for stress history, or COMPOSER_HISTORY=1 COMPOSER_REAL_THREAD=1 for the actual largest backup conversation. COMPOSER_WORKSPACE_SOURCE points to the source workspace for the filtered content copy. COMPOSER_SETTLE_MS and COMPOSER_DURATION_MS control settling and repeated typing. Each run should write a unique timestamped log. The script verifies retained draft text and sends no prompt.

An initial older-build launch failed because the probe seeded a newer schema; it now uses the selected checkout's DB initializer. An older URL assumption and post-reload panel selection also required probe repairs. Failed setup runs are excluded from measurements. Initial full-copy probing copied unnecessary resource bytes before exclusions were tightened; temp fixture/profile directories were removed by cleanup.

Raw completed measurements are in `MEASUREMENTS-2026-09-19.json`. Diagnostic build worktrees are under `/tmp/fs-composer-*`; they are not Alpha deployments.

## Candidate fingerprint

- `fusion-studio-client/src/components/MessageList.tsx` SHA-256: `1bc2ae9604691bed3254f410a0fc9e7b434b6641523b5dc419bd08e696a72a18`
- `fusion-studio-client/src/components/ContentArea.tsx` SHA-256: `53bfea95cb42e075bedff954486d6517d8ac0e330ea160aea7e736bb4ba3d7d2`
