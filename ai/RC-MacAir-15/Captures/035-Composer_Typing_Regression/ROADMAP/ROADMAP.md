# Chat architecture recovery roadmap

Current disposition (2026-09-27 PDT / 2026-09-28 UTC): owner-closed with residuals. SPEC-01–05 were accepted in sequence; SPEC-06 is accepted under the [owner closure addendum](SPEC-06-OWNER-CLOSURE-ADDENDUM.md). Read the [supervisor ledger](ROADMAP-LEDGER.md) for receipts. This document retains the original planned completion contract below; incomplete checks are not retrospectively passed.

Original planning status: DRAFT CANDIDATE, subsequently approved in RELEASE-MANIFEST.md.
Program ID: CHAT-AR. Repository: `/Users/rccurtrightjr./projects/fs-dev`.

## Outcome

Typing, sending, switching chats, stopping a turn, and invoking chat actions must have explicit owners and predictable outcomes. The architecture must prevent unchanged history and workspace views from becoming per-character work. Accepted commands must not disappear into a spinner; failed or uncertain commands must preserve the user's text and expose the actual state.

This is an architectural recovery program, not authorization to apply the experimental two-memo patch. Reproduce failures first, then refactor each affected responsibility with its fixes and public-route regression checks. Splitting a large file without separating observation, command, or lifecycle ownership is insufficient.

## Order and acceptance boundaries

| Order | SPEC | User-observable result | Prerequisite |
| --- | --- | --- | --- |
| 1 | SPEC-01 — Reproduction and architecture gates | Existing failures become executable evidence; test tooling cannot touch live profiles | Exact roadmap approval |
| 2 | SPEC-02 — Prompt submission and recovery | Send has one owner and a correlated outcome; no pending spinner when nothing was transmitted | Owner acceptance of 01 |
| 3 | SPEC-03 — Action routing and host responsibilities | Send to Chat, attachments, prompt actions, and menus reach the intended chat and report actual outcomes | Owner acceptance of 02 |
| 4 | SPEC-04 — Independent rendering lifetimes | Draft edits and streaming do not reprocess unrelated history or content | Owner acceptance of 03 |
| 5 | SPEC-05 — Backend lifecycle and persistence ownership | Existing thread operations survive failure/restart under focused services rather than a God manager | Owner acceptance of 04 |
| 6 | SPEC-06 — Integrated acceptance and retirement | Production flows, real input, sustained usage, recovery, and documentation agree | Owner acceptance of 05 |

Dependencies are deliberately serial: each stage changes shared chat boundaries. Read-only work can be concurrent, but no next SPEC implementation starts without explicit owner acceptance of its predecessor. A clean agent review is not that acceptance.

## What stays authoritative

See AUTHORITY-AND-DECISIONS.md and ARCHITECTURE.md. Preserve workspace/view/group/session/turn/surface identity separation, server-owned acceptance and Stop, canonical event sequencing, trusted-shell authorization, current eager New Chat, peer Main/Side semantics, and the accepted view-bound production direction. No provider migration, new chat product, general event-bus rewrite, or UI redesign.

## Completion

Every SPEC and its deviations has owner acceptance. The old aggregate host and manager no longer own multiple independent policies; the responsibilities and update boundaries in ARCHITECTURE.md are implemented. All owned regressions pass; unrelated baseline failures have exact records and explicit non-blocking dispositions. Final realistic idle typing has no long tasks over 50 ms, preserves every character, and meets the latency limits in VALIDATION.md. Streaming and recovery meet their separate criteria. The owner explicitly accepts the original typing/freeze and Send symptom checks; lack of reproduction alone cannot close them.

## Not automatic

No commit, push, Alpha sync/build/install/restart, live profile mutation, or destructive data migration is included. Changes go into the development checkout with unrelated dirty bytes preserved. Live-window diagnostic attachment or restart requires separate authorization under the investigation brief. Final manual acceptance may use an isolated candidate window.

## Handoff

After candidate approval, invoke `$orchestrator` with SPEC-01 and its mandatory packet dependencies, or `$roadmap-implementation-supervisor` with this roadmap and RELEASE-MANIFEST.md. Both routes enforce owner acceptance between SPECs. Planning work does not dispatch implementation agents.
