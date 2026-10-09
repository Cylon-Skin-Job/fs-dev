# 06B remaining acceptance plan

Updated 2026-09-27 after B20 reviews and COMPOSITION02 native revalidation. This plan implements the approved criteria; it adds no new acceptance gates.

## Approved requirements and retained evidence

SPEC-06 lines48/50 require native/OS input and IME on the isolated candidate, exact text, numeric gates and explicit timestamped owner judgment. VALIDATION line56 separately requires emoji, autocomplete, IME/composition and paste correctness; line60 defines the45-minute workload and owner requirement. Neither requires Character Palette specifically, OS-native autocomplete specifically, or the native/manual session sharing the measured soak renderer. Those were earlier session choices. Unavailable optional methods alone are not blockers.

VRENDER03 passed all six cases, including the five-minute sustained window. Its composer correctness case separately checks synthetic composition and paste/drop, emoji insertion, actual app file-autocomplete acceptance, selection and resize. These are bounded browser/component checks, not proof of OS IME. Native05 separately passed exact OS keyboard/paste/name checks and recorded agent Send/Stop/switch observations. Preserve their actual scopes. Any later product/build or executed-dependency change invalidates affected current acceptance and requires fresh verification; unchanged evidence is not repeated without cause.

SOAK03 failed the first short typing window at rAF maximum50.8999996ms against50ms, despite exact68characters and valid focus. The measured45-minute workload has not completed. Retain the numeric failure with no waiver or retry-until-green policy.

## Current rendering evidence

B20 is frozen and both fresh reviews are CLEAN. Builder and root each passed23 browser checks; the client build passed. Source1957/build200 are inventoried in B20-IDENTITY.json. The product guard checks native isComposing or229 before the actual shortcut owners, without timers or suppression of later ordinary keys.

COMPOSITION02 completed443 native events with zero loss and clean owned cleanup. Separated/batched native pairs show composing Enter unprevented and composing Escape retaining one accent without premature blur; later ordinary keys still act normally. Native commit producedé, keyboard/paste retained exact text, and ordinary Send/Stop/New Chat/switch worked. Backspace's empty outcome resulted from ordinary deletion after the recorded untrusted compositionend, not proven native cancellation. See COMPOSITION-02-ROOT-INSPECTION.json and SUPERVISOR-COMPOSITION02-CUA.md for exact methods and limits. Supervisor accepts the bounded repair; no further product change or duplicate native window is identified.

VRENDER04 now passes all six cases on B20, including all ten short windows and9520 exact characters over349689ms with no violations, longtasks, typing traffic or unrelated renders. Root independently verified cleanup/frozen hashes. See VRENDER-04-ROOT-INSPECTION.json. Historical VRENDER03 remains preserved. Full45-minute workload is next; no tests/builds/native input overlap measured windows.

## Recover native control, then complete the automated soak

SOAK04 stopped at the first warmup Delete ACK deadline because the supervisor’s native-control initialization calls timed out. No native input was sent, and measured typing never began. Owned cleanup and unchanged B20 identity are verified; VRENDER04 remains valid. Supervisor will recover and demonstrate native-control readiness while idle before one authorized unchanged-candidate coordination retry. No automatic launch or deadline waiver.

B18 native Delete closure integration passed29builder/32root tests and both fresh reviews. It retains actual public/CDP Delete acceptance and durable SQL/DOM deletion, then emits per-sequence exact run/PID/window/group/nonce/deadline READY. The supervisor uses native CUA to verify no sheet or Cancels only the exact residual and freshly observes no sheet, then writes the matching ACK from B18-REPORT.md. Unknown dialogs fail closed. The helper passively requires stable actual native focus; it performs no native UI action.

These checkpoints cover warmup, streaming cleanup and every lifecycle Delete outside measured typing. The unchanged loop can exceed20 checkpoints because it continues through the required wall-time workload. Preserve at least20 cycles, full45minutes, initial/final five-minute idle windows and the five-minute streaming window, resource equivalence, all numeric/focus gates, and55-minute hard deadline. No app input during measured typing, threshold changes, arbitrary refocus or shell-driven native clicks.

Before each runtime, confirm exclusive owned lane, frozen relevant identities, unlocked desktop and protected display assertion. Builder owns the runner and cleanup; supervisor owns native CUA; orchestrator owns evidence and gates. Send imminent notice and precise READY/ACQUIRED/FAILED identities. Read fresh receipts immediately before each native action. No owner click is required for these agent-operated checkpoints.

## Owner judgment and subsequent work

After independent requirements are complete, present the isolated candidate and evidence limits to the owner. Obtain four explicit timestamped judgments: responsive typing; clear Send outcomes and pending/finalizing/assistant states; no freezing during switching/streaming; sustained-use symptoms. Agent observations, synthetic numbers, silence and generic approval do not supply this receipt.

A fresh native/manual renderer must be described as fresh. There is no normative requirement to repeat a successful45-minute soak solely because its post-soak manual window was disabled. The owner can accept sustained evidence as presented or request additional direct observation; never claim personal use of a post-soak renderer that did not occur.

06B acceptance reviews and owner judgment precede06C. No Git publishing, Alpha deployment, live-profile operations, system/input-source changes or unrelated native app work are included.


## Approved helper-only recovery unsuccessful

Supervisor reports that the owner approved restarting only the native computer-use helper. Supervisor verified and terminated exact SkyComputerUseService PID11078, relaunched its verified installed application, and verified replacement PID59859 alive. Desktop PID10980 and runtime PID11010 were unchanged; protected caffeinate55084 remained alive. These are supervisor-reported observations, not additional process operations or independent checks by this orchestrator.

After CUA reset, fresh getState failed in5.6s with -10005/app-server exited before response. After the replacement helper remained alive2m39s, another getState failed after31.6s with initialization timeout. Native apps remained empty. Inventory listing IAB does not prove actual browser health. No UI actions or fixture launches occurred.

The approved helper-only recovery is exhausted without demonstrated native health. External native-control capability remains BLOCKED. Broader desktop restart is not authorized; supervisor owns the next recovery-authority request. Preserve frozen B20, COMPOSITION02 bounded native evidence and VRENDER04 six-case pass. No source/fixture changes, SOAK05 launch, owner acceptance or06C advancement. The single assessed unchanged-candidate SOAK05 remains pending actual native-health confirmation. Evidence: `06B/CUA-HELPER-RECOVERY-SUPERVISOR-RESULT.json`.


## Owner-authorized human-test model configuration

Supervisor reports the owner requested development defaults `togetherai/deepseek-ai/DeepSeek-V4.1-Flash`, variant`high`, thinking retained true for forthcoming human testing. Supervisor changed only `ai/RC-MacAir-15/System/config/cli.json` and `opencode-models.json`, adding Together/model low/high/max and selecting defaultProvider togetherai while preserving other providers. Supervisor reports installed OpenCode catalog confirmation, high→reasoningEffort high, credential-entry existence without disclosure, and successful Fusion resolveCliConfig/validatePortableSelection checks. This orchestrator did not repeat catalog/credential validation or invoke inference.

Current file hashes and B20 manifest membership are recorded independently in `06B/HUMAN-TEST-MODEL-CONFIG-PROVENANCE.json`. Treat this as owner-authorized configuration provenance separately from unchanged product/runtime-test evidence; do not claim complete old manifest equality without reassessment. Carry the settings into subsequently authorized human-test preparation. No live inference, Alpha change, restart, existing-thread rewrite, source/fixture implementation or acceptance is performed by this notification. Native-control capability remains blocked, SOAK05 remains unlaunched, and owner acceptance/06C remain pending.


## Owner supersession: prepare a durable human-operated session now

The supervisor relays explicit owner direction to prepare the logs and functioning Fusion human-test window immediately. This supersedes the prior hold on manual preparation and the sequence requiring automated soak completion before presenting a human session. Native CUA availability is not a prerequisite. The supervisor remains the sole user-facing decision owner; no generic setup approval is required.

Retained builder06b is resumed as sole implementation writer for one isolated disposable development session using real OpenCode, `togetherai/deepseek-ai/DeepSeek-V4.1-Flash`, variant`high`, thinking true. It must record lightweight buffered input/event delay, focus, longtask/heartbeat gaps, Send/Stop/request state, stream/error/lifecycle and periodic memory/resources as feasible, persist logs on disk through crashes, and disclose instrumentation limits. Owner permits content logging; credentials/authentication secrets must not enter logs. Normal app switching and blur are allowed. No synthetic typing or automated clicking during the owner's session.

The session has no ten-minute or55-minute automatic shutdown and remains open until the owner finishes/closes it. Preparation retains exact process/profile/workspace ownership and cleanup responsibility. One bounded harmless smoke through the actual configured harness is authorized before handoff to confirm a real reply. No native CUA recovery, Alpha work, Git publishing, settings/permissions, whole-desktop reboot or live-profile changes are authorized by this preparation.

The required deliverable is a verified open functioning window, active recording, confirmed provider/model/high selection, exact PID/title/run/log paths and concise owner instructions. Automated45-minute thresholds and prior failures remain pending, and this human session itself does not fabricate numerical acceptance or owner symptom judgment. Preserve B20's historical product evidence and separately record new instrumentation/configuration provenance. Build/check/review only affected preparation/instrumentation.


## Human session delivered — 2026-09-27 06:45 UTC

The owner-directed preparation is complete. One durable isolated real-provider window is OPEN for human use: `HUMAN TEST — human-1790491451072-fee1354e`, Electron PID64115/window1, detached driver64110, ephemeral port64361. READY was emitted06:44:17.754UTC only after public Send produced accepted receipt2abc3a4ca0287208cfa7ef0cdc7a6461 /turne29cde9d-ff38-4107-b2bb-e249e816ca56 and saved/rendered assistant text `HUMAN_SESSION_READY`. Actual provider subprocess64184 was observed using `togetherai/deepseek-ai/DeepSeek-V4.1-Flash`, variant high, thinking true. It is the completed smoke process, not a claim that this child remains alive.

Root independently inspected retained SQLite accepted receipt/exchange1 and exact live driver/Electron identities. Four resource samples included nativewindow focused/visible/unminimized. Disk events grew53,746→70,784bytes from06:44:59→06:45:16UTC, with fresh renderer batches and separate driver heartbeats. Evidence: `06B/HUMAN-RUNTIME-ROOT-INSPECTION.json`; builder runtime packet retained separately. Two generic safe error frames at06:44:13.963 preceded New Chat and successful smoke; no errorcode/details are retained by design, so their cause is unknown. They are not described as a failed provider turn.

Session/evidence: `06B/human-1790491451072-fee1354e/session.json` and `events/*.ndjson`; launchstdout `06B/human-launch-1790491450702.log`. Temporary ownedroot `/var/folders/ng/s9jvcvqs3sq9crldjc_5cvjh0000gn/T/human-1790491451072-fee1354e-dLMOat`; profile `/profile`, project `/workspace/Human-Test`, retained SQLite `/profile/server-data/fusion.db`. The driver has no automatic expiry. No synthetic input, clicks or refocus occur after READY. Owner may switch apps, chats and views normally and close the marked window when finished. Owned cleanup preserves diagnostic data. No CUA, Alpha, Git, live-profile or settings operations occurred.

Both fresh reviews CLEAN/nofindings: `/root/builder06b/review06b_human1` and `/root/review06b_human1`, terminal read-only, close_agent unavailable. Builder and root each passed7Node/3browser checks. Seven new fixture/test files are independently inventoried against all1964source/200unchangedbuild/2config entries. Current product/build evidence remains unchanged outside this new human-instrumentation surface. The accepted eight-field owner sequence/lifetime deviation and observation limits are in HUMAN-ROOT-REPORT.md and HUMAN-SESSION-REPORT.md.

The supervisor received exact READY paths, identities, realprovider proof and owner instructions before this handoff. This completes preparation only. Human observation/explicit symptom judgment and the quantified45-minute workload remain pending; no numerical waiver, full06B acceptance or06C clearance is inferred. The open runtime is intentionally retained for the owner, not a leaked test process.


## Authorized human runtime refresh completed — 2026-09-27 07:43 UTC

Old64110/64115 closedgracefully; allolddata retained. Newhuman-1790494814495-ca038557 window68197/driver68194/port64841 open, updatedClaude policy inactualcopiedserver, genuinelyfreshproviderconversation andsuccessfulpublicsmoke. Logsactivelypersist; currentvisiblecomposer Connected/editable confirmed readonly. Real20secondpostterminaldisabledinterval retained withoutcauseclaim, and template-style appearance differs fromcustomworkspace; neitherrepairedinthisscope. Fullhandoff/authority/skilloverride/evidencelimits: `06B/HUMAN-REFRESH-ROOT-REPORT.md`. No postREADYinput, regularprofile reset orfull06Bacceptance.
