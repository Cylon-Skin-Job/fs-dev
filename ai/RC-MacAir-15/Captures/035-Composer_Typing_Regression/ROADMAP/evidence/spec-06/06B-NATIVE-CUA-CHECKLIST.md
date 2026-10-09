# Native CUA evidence checklist

Updated 2026-09-27. This checklist specifies methods and evidence, not a passing result or extra acceptance gates.

## Authenticate the isolated session

Use only the announced existing owned PID/window/profile/thread and fresh READY receipt. Do not launch an unconfigured Electron app by opening its path. Builder owns runtime and cleanup; supervisor alone performs CUA actions. The existing manual native window is ten minutes with a15-minute runner deadline; the composition diagnostic uses the same bounds. No owner click is needed. No parallel timing benchmark, build or other runtime workload. Native actions remain in cua_repl; no new shell-driven UI automation or global settings changes.

## Map requirements to actual evidence

| Requirement | Evidence and remaining limits |
| --- | --- |
| Keyboard and paste | COMPOSITION02 on rebuilt B20 retained exact native keyboard text and pasted Unicode `native check 2468 — café 🙂`; supervisor records clipboard restoration. Native05 label evidence remains historical. Preserve exact methods and scope. |
| Emoji correctness | VRENDER03 composer case separately inserts emoji and asserts exact shared text; Native05 paste includes Unicode. Character Palette was an optional attempted method, not an approved mandatory gate. Do not claim Palette insertion occurred. |
| Autocomplete correctness | VRENDER03 checks the actual app file-autocomplete ghost and Tab acceptance to exact `open notes.ts `. This is app completion, not OS completion. An unavailable OS completion menu adds no normative blocker. |
| IME/composition | COMPOSITION02 resolves first composing-key interception across separated/batched pairs and commits exacté on both surfaces. Later ordinary keys still act. Backspace empties through ordinary deletion after untrusted end; do not call this dedicated native cancellation. Exact native-method limits remain explicit. |
| Send/Stop/switch symptoms | COMPOSITION02 on rebuilt B20 observed exact user text, Send clear/show Stop, Stop restore Send, and new empty thread2026-09-26T20-43-24-212. Agent observations do not replace explicit owner judgment or all automated state assertions. |

## Paired composition method (completed in COMPOSITION01 and COMPOSITION02)

Before acting, verify NATIVE_COMPOSITION_READY exact identity and deadline. The diagnostic names its iframe `Isolated native composition control` and textarea `Native composition control (unhandled)`; the real production composer remains separate. Confirm current UI targets, not assumed positions. Clear only the active disposable trial field between sequences.

Perform matched sequences on each surface: Option+e then e; Option+e then Escape; Option+e then Backspace; Option+e then Return. Record intended and observed values, focus, any submission and the exact CUA calls. Include both the earlier pattern with an intervening AX observation and a same-call key sequence before AX observation. This helps distinguish observation-induced preedit completion from key delivery and app behavior. If the composer unintentionally sends to the deterministic fixture, record it and Stop the owned turn. Do not silently call that a successful composition commit.

The recorder must retain all key/code/keyCode/isComposing/isTrusted flags, composition/beforeinput/input order, event identity, frame identity/clocks and bounded overflow. Do not infer a native key's composing state from the preceding text appearance. Untrusted compositionend is evidence to analyze, not an event to discard. A later-task focus/default-prevention snapshot must be identified as later; do not subtract unrelated frame performance clocks.

The paired diagnostic itself does not accept IME behavior, explain historical freezes or authorize a broad timing workaround. Review its raw result before product changes. Any resulting repair must preserve normal noncomposition keys, undergo meaningful regression checks and native revalidation, and rerun affected rendering/build evidence.

## B20 revalidation interpretation

COMPOSITION01 completed with204 retained events and no loss. Both paired patterns showed a trusted composing Enter/Escape (keyCode229, isComposing=true) before an untrusted end; the control also often received a later ordinary key. Real first composing Enter was default-prevented, and real first composing Escape caused blur/duplication before the ordinary key. See COMPOSITION-01-ROOT-INSPECTION.json and SUPERVISOR-COMPOSITION01-CUA.md for bounded evidence.

B20 targeted checks, build and both fresh reviews passed; COMPOSITION02 repeated matched native pairs against that frozen rebuilt candidate. Check the first composing event's correlated defaultPrevented state and blur/input ordering relative to any later ordinary key. A later-task value/focus snapshot may already include the ordinary key's legitimate action. Final Send or blur alone therefore cannot prove the guard failed; equally, a normal-looking final value cannot substitute for examining the first key. The textarea-scoped observer may stop capturing subsequent keys after focus moves or the textarea disables; disclose that boundary.

Record native commit and cancellation methods actually available (for example Option+e then e, Escape or Backspace), exact values and all trust flags. Do not classify ordinary deletion as proven IME cancellation. Stop any resulting disposable fixture turn and verify ordinary Send/Stop/switch behavior as applicable. Preserve previous results as historical; affected product/build claims require current evidence. No additional tool-generated key suppression or timing workaround is part of the authorized repair.

## Finish and owner receipt

Let normal bounded cleanup close owned resources; do not extend the app ad hoc. Ordinary native runner exit2 means acceptance remains pending, while a composition-diagnostic completion only establishes that observation finished. Inspect raw events and action receipts separately from exit status.

Present actual completed methods and four owner judgments: typing responsiveness; Send clarity; switching/streaming; sustained use. Record explicit timestamped acceptance or the precise missing criterion. No optional Palette/OS-completion requirement, same-renderer requirement, silence-based acceptance or agent-for-owner substitution is permitted.
