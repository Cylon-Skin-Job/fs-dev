# Release Manifest

**Status:** `APPROVED`
**Candidate ID:** `BRIDGE-d13b0d39d691ec58`
**Prepared:** 2026-09-12
**Bundle:** `TABS-PROVENANCE-BRIDGE`

## Ordered normative files

The candidate fingerprint covers these files in this exact order, relative to
this bundle directory:

1. `BUNDLE-INDEX.md`
2. `HANDOFF.md`
3. `DECISIONS.md`
4. `GUIDANCE.md`
5. `ROADMAP.md`
6. `roadmap.json`
7. `SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md`
8. `SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md`

`RELEASE-MANIFEST.md` is evidence about the candidate and is intentionally
excluded from the recursive identity.

## Fingerprint command

Run from this bundle directory:

```bash
paths=(
  'BUNDLE-INDEX.md'
  'HANDOFF.md'
  'DECISIONS.md'
  'GUIDANCE.md'
  'ROADMAP.md'
  'roadmap.json'
  'SPEC-01-COMPONENT-TAB-ACTION-CONTEXT.md'
  'SPEC-02-CHAT-TAB-PROVENANCE-INTEGRATION.md'
)
for file in "${paths[@]}"; do
  shasum -a 256 "$file"
done | shasum -a 256
```

**Expected aggregate:**
`d13b0d39d691ec588db6866efcb986f0e60193b5b6d9c40c5b368d560a4948e8`

Candidate identity is `BRIDGE-` plus the first 16 hexadecimal characters of the
expected aggregate. A mismatch means the bytes differ; it is a reconciliation
signal, not evidence that behavior is broken. Any normative change after
approval updates the living candidate and requires only the affected review
again.

## Dependency order and gates

1. Owner approves this exact planning candidate.
2. Fresh orchestrator implements BRIDGE-01 (SPEC-01) only.
3. Independent review and owner acceptance of BRIDGE-01.
4. Owner approves BRIDGE-02 (SPEC-02, contract-only); the `025` chat packet is
   overlaid against it before CHAT dispatch.
5. Chat packet execution, then view decomposition/unification — both owner-gated.

Approval of this bundle does not authorize both implementations at once and does
not authorize chat, view, plug-in, or retention work.

## Accepted prerequisites to reconcile at dispatch

- TABS-03 placement chokepoint (implementation `22cc435`, merge `2748f03`) —
  client only; the frozen `componentTabPlacement*` types are not edited.
- PROV-01 provenance platform (source `acf12da`, merge `d31fc8a`) — migrations
  `035`/`036`, `lib/agent-provenance/*`, governed `publishFact`.
- Mediated-save path (`023` SPEC-03/SPEC-04) — `reportedUiContext` carrier.
- Current line baseline `7372933` (handoff commits `5d0460f`, `333d49e`);
  migration head `039`; next free `040`.

## Evidence

- Pass 1 (authored bundle): FINDINGS — 3 blocking (citation path depth in both
  SPECs, status/next-action contradictions, missing bundle `GUIDANCE.md`), 4
  advisory. Repaired: added `GUIDANCE.md`; corrected path depth; updated status
  and next actions; clarified advisories.
- Pass 2 (repaired bundle): FINDINGS — 2 blocking (`GUIDANCE.md` `AGENTS.md`
  path depth; `HANDOFF.md` overstated clean status contradicting this
  manifest's own findings record), 2 advisory (shorthand path; type-file
  attribution). All repaired; fingerprint recomputed.
- Pass 3 (current candidate): **CLEAN** — no blocking findings; fingerprint
  recomputed and exact (`d13b0d39d691ec58…`), confirming the reviewed normative
  bytes are the current bytes. Two minor advisories recorded: (a) SPEC-02 §6
  cites "SPEC-02 §4/§8" meaning the `025` `SPEC-02-COMPOSABLE-CHAT-SURFACES.md`;
  (b) HANDOFF's "immediate next action" phrasing could be read as skipping the
  clean-pass gate that this record now satisfies. Advisories coexist with
  `CLEAN` and are non-blocking.

## Owner approval record

- **Approved candidate ID:** `BRIDGE-d13b0d39d691ec58`
- **Owner statement/date:** “Yes.” — 2026-09-12
- **Authorized next action:** Implement **BRIDGE-01 (SPEC-01) only** through a
  fresh orchestrator, in a session appointed by the owner. BRIDGE-02 remains
  gated on BRIDGE-01 acceptance. Nothing else in this bundle is authorized.
- **Dispatch note:** the owner will appoint separate sessions for each SPEC's
  work; this bundle is the handoff, and this manifest is the approval ledger.
  The approved normative bytes are unchanged by this record (the manifest is
  excluded from the candidate identity).

## Implementation acceptance ledger

- **BRIDGE-01 ACCEPTED — 2026-09-12.** Owner statement: “I approve.” after an
  independent owner-side review (first-principles inspection + one fresh
  independent reviewer; terminal verdict `CLEAN`, no blocking findings, no
  unresolved in-scope findings).
  - **Evidence:** `BRIDGE-01-IMPLEMENTATION-REPORT.md` (orchestrator complete;
    READY FOR INDEPENDENT OWNER-SIDE REVIEW) and `BRIDGE-01-EXECUTION-LEDGER.md`;
    unrelated worktree bytes confirmed untouched (coordination
    `OWNER-DECISIONS.md`, `031-Remote_Access/`, and app-runtime `openedAt` drift
    in `002-file-viewer/state/state.json` from the running dev app).
  - **Identity:** approved bundle fingerprint `d13b0d39d691ec58…` unchanged;
    implementation changed-set (37 paths) aggregate
    `39b4b55955e9ab5a1dfb432fa018604ce8f12d6c55a9aae3601b1e268056bd55`
    reproduced per-file and in aggregate.
  - **Gates reproduced (reviewer and owner-side):** client build PASS; source
    suite 65 passed; server suite 198/198 (2898 passed, 1 pre-existing skip);
    bridge live `BRIDGE_01_INTEGRATION_OK` (emitted = durable = command-fact
    context; same-database restart; `state.json` hash `bcde113f…` stable);
    file-viewer live PASS; durable smoke `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK`
    with gate pin `a5cad011…` intact.
  - **Accepted deviations:** D-01 (live proof is a real-module/real-server/
    real-SQLite integration proof, not an Electron UI drive — compatible;
    verified: only Office/Email document pages carry save controls, the File
    presenter does not, and SPEC-01 §10 says "equivalent to"); D-02 (additive,
    generation-gated trusted-shell browser-fixture stubs repairing a
    pre-existing test-harness gap). Advisories D-03, F-04, F-05, A-1, A-2 are
    non-blocking.
  - **Gate status:** BRIDGE-02 (SPEC-02, contract-only) is now unblocked for
    owner approval; the `025` chat packet must be overlaid against it before
    CHAT dispatch. The implementation remains uncommitted; commit/publication
    are the owner's call.
