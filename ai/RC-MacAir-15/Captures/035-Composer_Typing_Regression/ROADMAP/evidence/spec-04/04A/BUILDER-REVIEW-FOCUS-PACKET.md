# SPEC-04 Slice 04A Focus-Determinism Builder Review Packet

## Candidate

- Repository: `/Users/rccurtrightjr./projects/fs-dev`
- Branch/HEAD: `agent/exact-workspace-paths` / `88637d11c65be53d4f2ad0f049f64a07fa3db1de`
- Shared dirty checkout: review only the 23 current paths sealed by `SOURCE-SHA256.txt`; do not edit files or disturb unrelated/current bytes.
- Manifest digest: `2b6208a648ee63c0e876512182b87b61437bc8b3d9fd25fc5630f85db43f6594`.

## Authority and requested review

Read `/Users/rccurtrightjr./.codex/skills/spec-review-gate/SKILL.md` completely and apply its four-part materiality rule. Review against `AGENTS.md`, release candidate `CHAT-AR-4641ca5897f0`, SPEC-04 slice 04A, the approved roadmap bundle, accepted SPEC-01/02/03 reports/manifests, Chat Wiki overview, routed standards, and the full `SLICE-04A-IMPLEMENTATION-REPORT.md`.

Read `ORCHESTRATOR-REVIEW-PASS-2.md`. Its material finding was that R1 silently applied a focus-sensitive wall threshold while only recording focus after all windows. Independent final-manifest runs `chat-arch-1790134943915-593b3bc5bd` and `chat-arch-1790135231454-f851d1f150` were unfocused and failed all wall budgets despite otherwise clean metrics; focused run `chat-arch-1790133916558-82b5890715` passed.

Independently verify the current smallest test-only repair:

- `window-focus.mjs` provides bounded retry-to-focus and explicit `R1_FOCUS_UNAVAILABLE` / lost-before-typing errors; its deterministic unit covers success, unavailable, and lost-focus paths.
- Before every measurement, only the isolated staged Electron application is asked to focus itself (`page.bringToFront`, `app.focus({steal:true})`, and exact target BrowserWindow show/restore/moveTop/focus/webContents.focus).
- The exact target window must report focused before measurement; focus is reverified immediately before `keyboard.type`, recorded before/after per window, and enforcement rejects focus loss.
- If focus is unavailable, the run stops before any timing window and records structured foreground/visibility/window identity plus clean owned cleanup. The wall threshold is unchanged and is never applied to an unfocused window.
- No final source uses System Events/CUA, owner Fusion, live profiles, product hooks, or product behavior.

## Current evidence

- Combined coverage/focus helper units: PASS 5/5.
- On the currently locked Mac, requested full command run `chat-arch-1790136116775-c09e77fb49` stopped before timing with structured `R1_FOCUS_UNAVAILABLE`, exact `{focused:false, visible:true, minimized:false}` staged-window evidence, no leaked process, SQLite `ok`, and owned roots removed. Computer-use state independently reported the Mac locked and unable to auto-unlock.
- Correctness rerun `chat-arch-1790136157276-44fa4c0199`: PASS; helper units 5/5 and composer input/locality 2/2, clean cleanup.
- Last valid focused full R1 `chat-arch-1790133916558-82b5890715`: all ten windows passed the unchanged wall threshold and every render/formatter/network/latency criterion. Product bytes are unchanged since this run.
- Parent reports independent V-BUILD, coverage authenticity, and V-ISOLATION green before this test-only repair. Prior V-SUBMIT 7/7 and identity/threaded 29/29 remain unchanged.

Also verify the earlier repairs remain sound: fail-closed CDP discovery/calibration; no production observer; no whole-`threads` parent subscription; unrelated-row locality; and exact typing-interval outbound-frame rejection. Do not require 04B/04C.

Return material findings with authority/current-byte evidence/consequence/bounded correction, separate advisories/deviation dispositions, reviewer identity, and exactly one final disposition: `CLEAN`, `NOT CLEAN`, `BLOCKED`, or `AUTHORITY_BLOCKED`. No edits.
