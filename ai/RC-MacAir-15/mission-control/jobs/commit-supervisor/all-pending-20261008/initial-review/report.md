# Initial integration review

REVIEW_COMPLETE — result `findings`, mode `initial`. One independently validated material defect remains: **IR-001**, linked to the Supervisor's canonical **ALL-SCREENSHOT-001**. The Supervisor has assigned its repair; this initial review does not accept the repair or current final candidate.

## Assignment and reviewed identity

Manager/reviewer: `/root/all_pending_initial_review`; assigning Commit Supervisor: `/root`. Actual memory CWD and controller home: `/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control`, in the primary `/Users/rccurtrightjr./projects/fs-dev` repository. Separate independent candidate clone: `/private/tmp/fusion-main-consolidation-95vxg0_h/candidate`. HEAD and target baseline: `a4a4262587a7f72f89f5b9b9c2f54878fe5381bb`.

The initial reviewed identity is `/private/tmp/fusion-main-consolidation-95vxg0_h/candidate-identity-01.json`, SHA-256 `6e8487a5173edc192f8f3d112b137f1ff0b6e0f6b603ceb94036adc003281762`, with 17,603 changed leaves. Independent manager readback found zero hash/mode drift across those leaves and zero mismatch across the accepted 65-file M3 product seal. The unchanged screenshot server dependency is separately bound by SHA-256 `8d11853e29ee8f0264090145aaf1d461384caeac6b58797a63cb687869756254`; it was still that hash at manager report evidence capture.

Read the exact controller-home session contract, assigned review skill, full Commit Supervisor workflow and full review gate, applicable repository instructions, original request, approved CHAT-MATERIAL-SPEC-01, implementation approval and owner completion acceptance. Owner publication direction is “Commit everything and make main up to date,” as recorded in assignment.json. It authorizes the assigning Supervisor's consolidation scope; this review remains read-only. Root settings and host permissions were inherited without overrides; no literal model identity or persistent task UUID is invented. Only unique initial-review report/evidence files were written.

Accepted implementation inputs, current Restart/helper/article inputs, current MC/Launchpad/config records and archival diagnostics/evidence were reviewed within the assigned grouping. Historical code snapshots, rehearsal payloads and archived raw diagnostic captures remain records; they were not treated as activated product or setup acceptance. Known harness/health/plugin follow-on scopes remain separate.

## Validated material finding and repair packet

**IR-001 / ALL-SCREENSHOT-001 — concurrent screenshot saves alias one file**

- Disposition: initial `open`; Supervisor reports `repair-assigned` to `/root/screenshot_unique_path_repair`. Preserve the original ID/report link. The Supervisor owns the append-only disposition ledger and any later handoff/final resolution.
- Severity: `material`. Confidence: high for collision/overwrite mechanics; native UI overlap frequency is unmeasured.
- Authority: approved CHAT-MATERIAL-SPEC-01 §4.4 and A12 require distinct concurrent screenshot operations to preserve their correlated saved image and owner isolation.
- Affected route: `fusion-studio-server/lib/screenshot/ws-handlers.js:22–35,118–138`. The source filenames use only ISO time to millisecond precision, then `fs.promises.writeFile` replaces that path. Both successful responses return the same path when preparation occurs in the same millisecond.
- Observable consequence: distinct request IDs may produce two pills referring to one shared path. The later save replaces the first image, so a chat can show the other owner's capture despite correct renderer request-ID/destination routing.
- Independent validation: source reviewer and manager each executed the exact current handler with unmodified Date/Buffer, distinct synthetic payloads, mocked accepted workspace/protection dependencies and an in-memory filesystem sink. Both reproduced a collision on pair 1. Manager evidence records IDs `pair-1-0` and `pair-1-1` returning `/owned-repo/ai/Owned/Data/Screenshots/fusion-capture-2026-10-09T01-06-49-385Z.png`; final bytes were `distinct-image-1-1`, replacing `distinct-image-1-0`. This is direct save-owner mechanics evidence, without native or physical filesystem execution by review.
- Existing check gap: browser A12 exercises concurrent result routing using distinct injected `main.png`/`side.png` paths; historical native captures are serial. Neither proves server filename allocation under concurrent saves. This dependency predates the candidate, but the accepted SPEC expressly requires the observable concurrent isolation.

Bounded correction belongs to the Supervisor's leaf writer: collision-safe save allocation through the existing screenshot save owner, retaining protected-path validation, request correlation, absolute/relative attachment metadata and gallery behavior. Required success oracle: overlapping public file-capture requests for the same workspace produce distinct paths with each request's own bytes preserved, including equal millisecond time. Preserve ordinary save/error/protected-path behavior. No new renderer mode, server message family or unrelated product scope is needed.

Release requires the bounded repair, its current-byte meaningful concurrency regression, renewed affected screenshot/protection/full-server/native checks, settled source-backed Wiki wording/preimage and a **separate fresh worker-handoff review**; final resolution additionally requires a **fresh independent final whole-candidate review**. Initial reviewers and this manager cannot supply either final gate. There is no owner-intent or named-provider dependency hold; this is executable repair work.

## Five-lens coverage

| Lens | Actual coverage, sources and result |
|---|---|
| Behavior & Verification | Original request/SPEC and current common target/commit/mounted-state owners; all source families, public callers, async source completion/cancellation, cursor/latest-draft preservation, pending/unknown acceptance, warming, Send ACK/SQLite seams; restart selection/probe/failure behavior; current MC helpers/index and raw evidence. IR-001 is the one material violation. |
| Standards Compliance | Full current Code Standards hub and applicable architecture/UI/state/protocol/event/persistence/testing routes. Reuse of existing action/store/save owners, portable callbacks, cohesive helper responsibilities, no new material send/create mode, governed publisher or storage schema. No additional material hard-rule conflict found. |
| Integrations & Dependencies | Accepted 65 product inputs, unchanged immediate server/Electron dependencies, managed Side placements, exact workspace/view/group/session/surface/generation authority, source resource versus destination identity, configuration/runtime/migration boundaries, restart profile/process ownership and MC role/contract routing. The immediate screenshot save dependency causes IR-001; archived copies grant no runtime authority. |
| Forward Compatibility | Actual approved shared-material consumers, S5/S6 restart consumers, and known separate harness/health/plugin scope. Future paste-and-send/new-chat modes remain excluded; MC setup publication does not activate operational MC. No evidenced additional consumer obstruction found. |
| Wiki Impact | Canonical Composer, Screenshot Capture, Structure, Testing/Operations, UI Action Provenance and Wiki/File children; current Restart article; relevant unchanged authority and current MC/Launchpad references. No additional material omission found. Screenshot repair must retain accurate concurrent capture/save claims. Four wording/migration advisories below remain optional. |

Concrete risk routing used four fresh read-only clean-room reviewers: core insertion/state, source/native/Wiki, restart process/profile boundary, and MC/config/archive publication. The latter independently inspected direct files and 123 ZIP archives (2,818 text members) for concrete credential disclosure boundaries, plus immutable SQLite fixture contents. No generic specialist or invented future scope was added.

## Checks, provenance and invalidation

Detailed current-byte/readback evidence is in `manager-byte-evidence.json`, `initial-review-evidence.json` and `screenshot-collision-validation.json`.

- Fresh candidate `npm run build`: exact `/private/tmp/fusion-main-consolidation-95vxg0_h/client-build.json`, exit 0; build log SHA-256 `ed24eaadbd1a3bec8d51b678b3fa1867332de4585792f843a5f3baad02657f47`. Generated preload before/after hashes match. Existing chunk-size and static/dynamic import warnings remain disclosed.
- Fresh 16-suite Playwright command: `renderer.json`, exit 0, 269 passed; log SHA-256 `948471269598028dde1772a1e107cbda4ff0f7c6350ee4d917cf93b538c644a8`. **Sequencing limit:** build and renderer began concurrently at 01:02:49 UTC; SPEC requires build before suites serving built artifacts. Preserve the pass as observed, withhold a complete sequencing claim, and renew after the completed build. Root acknowledged this renewal.
- Raw MC runner reports 55 tests OK. Root's `verification-in-progress.json` records exact command and that its sequential shell invocation did not separately capture the unit-process exit. Current syntax/diff/index checks and recovery capture/verify were supplied by Root; the MC reviewer independently validated controller and seven Launchpad/template indexes and parsed Python sources.
- Historical accepted raw full-server/build/renderer/native/Wiki logs were independently hash-validated at original local receipt paths. Historical full-server: 221 suites, 3,265 passed, one skipped; renderer: 269 passed; native: eight captures/four Send readbacks; Wiki: one passed. They are dated executions, not new candidate runs. Original `.log` payloads are excluded from the clone by existing ignore rules but remain locally accessible; this archive portability limit is explicit.
- Core raw report records an ignored observer-binary mismatch observed earlier. Root subsequently preserved both failed binding attempts and supplied `retained-evidence-03.json`, resolving all 16 hashed source/binary dependencies by copying the exact accepted-worktree generated observer into the isolated candidate. This corrects that timing limit without rewriting the raw report. Executable rows resolve paths rather than claiming hashed tool bytes.
- Once the screenshot save source/Wiki repair changes, old server/native/current whole-candidate claims covering that dependency are invalidated. Root has committed to renewed full-server and affected native checks, build-before-renderer sequencing, separate fresh handoff and fresh final review. Narrow unchanged initial source inspection remains valid only within its recorded dependency surface.

No review child launched npm/Jest/Playwright/native/runtime operations. The manager executed only read-only Git/source/hash inspection and the bounded in-memory save-handler reproduction, writing its results under initial-review. Root owns all cumulative checks and later isolated real-runtime handoff. No runtime readiness is certified here.

## Advisory dispositions and residual limits

All advisory raw claims are preserved; manager source validation supports their non-material classification:

- `CORE-A01`: Composer introductory shorthand says useChatSessionActions supplies attachment actions; its detailed prepared-material section and Structure map correctly identify the current shared owner. Optional wording consistency.
- `RB-A1`: relative `npm run electron:dev` entry is omitted by absolute-entry process recognition; canonical restart refuses the unverified renderer ancestry. S4 expressly requires refusal of ambiguous ownership and does not require this launch shape. Optional compatibility/documentation improvement; no native launch was performed.
- `MC-PUB-A01`: CHAT-AR TICKET next-safe-action wording still says to create the already recorded SPEC Orchestrator. Linked current state and writer/assignment verification prevent that shorthand from authorizing duplicate dispatch. Optional refresh.
- `MC-PUB-A02`: local mc-checkpoint still describes legacy registry/cursor/pairs while controlling CHAT-AR instructions require native recall and the installed state-only helper. Follow controlling folder instructions; no failure/cursor loss reproduced. Migration remains separately assignable.

Publication review confirms `.gitignore` exclusions, absent real 167,026,688-byte server backup, and 17 identical 61,440-byte rehearsal SQLite payloads with fixture-only metadata and empty operational tables. Direct/ZIP credential scans found no active credential candidate. Pattern scans do not certify image pixels or every possible secret format. Historical snapshots and UI/config state remain owner-authorized records. Setup owner acceptance, operational MC activation, current provider/Alpha adoption and actual app-runtime readiness are not certified.

The initial review introduces no product deviation. Raw inline report delivery for three read-only children is a reporting accommodation: manager preserved their terminal reports verbatim. Four-helper restart extraction and shared-material original deviations remain provenance in their existing records. The necessary server/test/Wiki correction outside the accepted 65-file set is an evidenced acceptance repair; Supervisor owns its deviation classification and downstream propagation.

No `needs-owner`, `waiting-dependency` or capability `unmet-gate` hold was established by this review. The exact open repair release above prevents readiness. Follow-on handoff/final/runtime gates remain required; an active Supervisor leaf repair is not an initial-review pass or a reason to relabel old evidence current.

## Raw reports and lifecycle

| Actual child identity | Terminal result | Raw report |
|---|---|---|
| `/root/all_pending_initial_review/core_material` | completed; bounded clean | `core-material-raw.md` |
| `/root/all_pending_initial_review/material_sources` | completed; findings IR-001 | `material-sources-raw.md` |
| `/root/all_pending_initial_review/restart_boundary` | completed; bounded clean/advisory | `restart-boundary-raw.md` |
| `/root/all_pending_initial_review/mc_publication` | completed; bounded clean/advisories | `mc-publication-raw.md` |

All spawned with `clean-room-reviewer`, `fork_turns=none`, no model/effort override; all attest fresh/read-only/root inheritance and no prior author/reviewer history. Runtime `list_agents` confirms all four completed. No close-agent API is available; terminal completion is recorded as best-effort lifecycle closure, not a gate failure. Raw report hashes are preserved in `initial-review-evidence.json`.

Return to Supervisor: REVIEW_COMPLETE `findings`, IR-001 linked to ALL-SCREENSHOT-001. Continue its already assigned bounded leaf repair and separate independent gates. No feature dispatch, central-record edit, commit-producing operation, publication, owner-app/Alpha operation or operational MC activation was performed by this review.
