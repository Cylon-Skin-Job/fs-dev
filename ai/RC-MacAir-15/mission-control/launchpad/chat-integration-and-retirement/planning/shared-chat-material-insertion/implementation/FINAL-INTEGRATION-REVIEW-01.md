REVIEW_COMPLETE — CLEAN

CHAT-MATERIAL-SPEC-01 has no material findings and no insufficient-evidence finding within the assigned scope. This completes the independent integration review; it does not grant owner acceptance, publication or Alpha approval.

Reviewed read-only as Codex side chat (ephemeral), `/root/final_integration_review_01`, at 2026-10-07T23:43:08Z. No files were changed, agents delegated, apps launched, or builds/tests executed during this review. Prior reviewer verdicts were not used as evidence.

The reviewed checkout is `/Users/rccurtrightjr./.codex/worktrees/chat-material-01/fs-dev`, branch `codex/chat-material-01`, HEAD `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`. The approved candidate is `sha256:65b324647b7e52f0426f7b2005849d053f4f239420fab07c848170b21ec1d3f3`. The bounded input packet matches SHA-256 `5729c1996e458936ca56d9073dd0821bbbeda4652c37a691f7c9ae98a9228fe4`; the 65-file source seal matches `35cda972a106468eaa279c60da9ef51fc04ec23333f03de4226269b84e14ad07`. All 65 current product files still match. The exact implementation approval supersedes the older planning hold for this candidate only.

I inspected the approved TICKET, SPEC, owner request and approval; applicable AGENTS/session/Review Gate/Orchestrator contracts; routed standards and Chat/Wiki guidance; integrated diffs and new files; immediate dependencies; public callers; test oracles; raw logs, trace, native receipts, staging and cleanup records. The packet’s 38 authority-file and 132 raw-evidence hash bindings matched.

| Contract coverage | Independent assessment |
|---|---|
| R-01; A06, A12, A16 | One app-lifetime Chat action consumer performs shared material commits. Text and attachment actions each mutate their existing authoritative store once. Transient mounted state is composed through the existing Chat slice; it adds no persistent composer owner. |
| R-02; A01–A05 | Global targeting uses actual eligible Main/Side activation, including pointer, keyboard, explicit row/tab and acknowledged New Chat intent. Registration order, hydration and stored Main/Side selection cannot substitute for activity. Missing or stale activity has no Legacy/Main fallback. |
| R-03; A06, A08, A16 | Composer controls use their originating committed lease. Explicit Main components and managed Side placements, including adapterless hosts, retain distinct transient lifetimes. |
| R-04; A07–A12 | Begin precedes resource preparation, clipboard fetch/list, most-recent requests, recording permission/preparation, diagnostic retrieval and native capture. Completion uses the captured destination. |
| R-05; A09, A11, A13 | Tuple changes, unmount, placement closure, authority/hydration loss and socket replacement retire operations permanently. Equal-string restoration cannot revive the old generation. Screenshot cancellation before save emits no save; cancellation after save prevents attachment without claiming PNG rollback. |
| R-06; A07, A08, A10 | Retained operations survive unrelated focus/view changes and unrelated Main selection. Current panel, `isActive` and later DOM focus do not redirect or independently cancel them. Caret restoration checks the original editor and avoids focus theft. |
| R-07; A10, A12–A14 | Screenshot request/workspace correlation, concurrent operation ownership, duplicate handling, saved-path validation and terminal listener/timer cleanup are present. Missing/empty/error native results, save rejection, send exceptions, disconnect and deadline produce no misleading successful insertion. |
| R-08; A15–A17 | Material APIs are compose-only. Pending acceptance remains busy; unknown outcomes permit composition without resend or warming. Eligible warming targets the captured owner and is best effort. Ordinary Send retains server ACK ownership, with no optimistic user bubble or premature clearing. |
| R-09; §3, A17 | Every listed entry point was reconciled. No remaining production external-material store/DOM bypass, retired browser insertion listener, screenshot-specific destination resolver or `currentThreadId` fallback was found. |
| R-10; A01–A17, §§7–9 | Fresh final build, full/focused server, exact renderer lane, Wiki readback and actual native/ACK evidence cover current integrated bytes. Historical evidence is retained only within its original scope. |

The §3 sweep includes the global resource button and FloatingPathActions; direct Wiki topic/FileNode/FolderNode consumers; Capture, File, Wiki, Office, Email, Issues and Agents wrappers; header/composer cameras; screenshot gallery; selected/top clipboard and recents; microphone and diagnostic preparation; and the removed local insertion callbacks. SystemViewer’s explicit workspace Create path remains separate, with result/cancellation coverage. Explicit Send and New Chat remain independent commands. Ordinary typing, paste, autocomplete, native emoji and workspace-preview capture retain their existing owners.

Raw final evidence under `implementation/orchestrator-checks/final-integration-01` establishes:

| Receipt | Observed result |
|---|---|
| `build-01` | Fresh `npm run build`, exit 0, 23:15:01–23:15:09 UTC |
| `server-full-01` | Fresh direct Jest, exit 0: 221 suites, 3,265 tests passed; one baseline compatibility test skipped |
| `server-focused-01` | Exact screenshot correlation/protected-path/prompt-recovery files: three suites, ten tests passed |
| `renderer-02` | Exact approved 16-suite lane, one worker: 269/269 passed |
| `transport-focused-01` | Unchanged refusal case: one passed |
| `wiki-01` | Seven articles parsed and read back through production PageViewer |
| `native-01` | Eight actual PNG captures, four actual gallery selections, two retained Wiki resource handlers and four public Send/ACK/SQLite readbacks |

All eight final receipts, including failed `renderer-01`, bind the same 65 product files before and after execution. Their raw log hashes match. File dependencies remain current; receipt dependency bindings are unchanged across execution. Build warnings and fixture/deprecation diagnostics are preserved. Direct Jest does not establish npm’s native-observer pretest; the unchanged locally built observer artifact is separately bound.

The original `renderer-01` remains a failure: 268 passed and one precondition timeout. Its raw trace shows the refusal case timing out while filling a disabled composer with an empty thread identity and “No thread selected,” before refusal injection or Send. The fill ran approximately 23:19:18–23:19:48 UTC. Wiki/native launches began after 23:20:01, so those later launches cannot explain that failed action. The cause remains unknown. The focused repetition and exact full rerun used unchanged source and oracles; their passes satisfy the subsequent current renderer check without rewriting the original result, waiving its case or claiming a product fix.

Native evidence uses actual compiled renderer, preload/Electron capture, screenshot saving/path protection and SQLite. Saved PNG signature, dimensions, nonempty contents and hashes match the captured payload; correlated paths render on the captured owner while other drafts/pills remain intact. Staging causes no prompt or New Chat frame. Subsequent public Sends show draft retention and no user bubble before ACK, exact-owner clearing afterward, and durable exchange/attachment readback.

The native staging comparison is accurately bounded: 191 renderer files and 65 Electron files match current bytes; 478 server files match current bytes, with four explicit staged seams. I independently reconstructed those four seams in memory and matched their consumed hashes. `RAW-BINDINGS-01` honestly retains its four differences; `NATIVE-STAGING-BINDINGS-01` and `RAW-BINDINGS-02` resolve them without pretending staged server bytes are identical to delivery source.

All seven required Wiki articles match their recorded readback hashes. Their adjacent preimages match original HEAD bytes, actual timestamp metadata is consistent, concrete source-file/link checks pass, and generated navigation blocks remain unchanged. Current ownership, focus survival, real cancellation, source/destination separation and ordinary Send boundaries are documented without promoting future `ui.action` schemas. The routed architecture, frontend, state, WebSocket, UEB, persistence and testing requirements are met.

I assessed all 24 product deviations: M1-D01–D06, M2-D01–D08 and D-M3-01–D-M3-10. Their source and evidence agree with the recorded bounded changes: synchronous lifetime retirement and activation plumbing; shared source/selection/cancellation adapters; necessary modal and fixture integration; screenshot/API retirement and validation; isolated native/Wiki tooling; local unchanged addon build; generated-preload reconciliation; and preserved failed native attempts. None defers required material behavior or broadens delivery into server/provider, provenance, hardware or Alpha work. ROOT-EXEC-03 correctly expands untracked-file receipt discovery to the repository root; earlier narrower receipts are preserved rather than relabelled. No following SPEC is authorized.

The historical dependency recheck independently matches all 832 original entries: 825 file/hash/mode entries and seven absences. That supports historical or unchanged retention only; it supplies no fresh renderer, public-provider, native-pretest, soak or Alpha certification.

Nonblocking limits remain explicit: microphone tests control media/transcription boundaries rather than certify physical STT; native resource checks dispatch retained hidden Wiki DOM handlers to foreground File destinations, supplemented by visible browser source coverage; staged provider/fault seams do not certify a public provider; historical failure causes and SPEC-06 residuals remain unchanged. No material repair is justified by those limits.

Native cleanup records no lingering owned PIDs, successful SQLite quick-check, and removed fixture roots/port file. Final owned-port retirement is recorded. The protected-runtime comparison records 18 unchanged identities, one absent baseline process and zero changed identities; it does not establish causal attribution or runtime health. The finite caffeinate guard retains its existing expiry. The exact root-owned server dependency symlink remains intentionally retained through this review and is pending root’s scoped verification/unlink; resolved shared dependencies must remain untouched.

Root can persist this terminal result, finish the already scoped dependency-link cleanup and prepare the owner acceptance handoff. Owner acceptance, following-SPEC authorization, commit/publication and Alpha operations remain separate gates.
