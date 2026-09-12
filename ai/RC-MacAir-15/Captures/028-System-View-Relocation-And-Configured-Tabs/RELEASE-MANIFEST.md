# Release Manifest

**Status:** `VIEW-01 APPROVED FOR IMPLEMENTATION`  
**Candidate ID:** `VIEW-PLATFORM-15c57f9457d64a13`  
**Prepared:** 2026-09-07

## Ordered normative files

The candidate fingerprint covers these files in this exact order, relative to
this bundle directory:

1. `BUNDLE-INDEX.md`
2. `DECISIONS.md`
3. `ISSUES.md`
4. `CODE-INVENTORY.md`
5. `GUIDANCE.md`
6. `SPEC-01-SYSTEM-VIEW-RELOCATION.md`
7. `SPEC-02-VIEW-CONFIGURED-TAB-ADOPTION.md`

`RELEASE-MANIFEST.md` and `CLEAN-ROOM-REVIEW.md` are evidence about the
candidate and are intentionally excluded from the recursive identity.

## Fingerprint command

Run from this bundle directory:

```bash
paths=(
  'BUNDLE-INDEX.md'
  'DECISIONS.md'
  'ISSUES.md'
  'CODE-INVENTORY.md'
  'GUIDANCE.md'
  'SPEC-01-SYSTEM-VIEW-RELOCATION.md'
  'SPEC-02-VIEW-CONFIGURED-TAB-ADOPTION.md'
)
for file in "${paths[@]}"; do
  shasum -a 256 "$file"
done | shasum -a 256
```

**Expected aggregate:**
`15c57f9457d64a13c177d58fe96e3bf665fa36881b443292363261a438f67e4b`

Candidate identity is `VIEW-PLATFORM-` plus the first 16 hexadecimal characters
of the expected aggregate. A mismatch means the bytes differ; it is a
reconciliation signal, not evidence that behavior is broken.

## Dependency order and gates

1. Owner approves this exact planning candidate.
2. Fresh orchestrator implements VIEW-01.
3. Independent implementation review and owner acceptance of VIEW-01.
4. Fresh orchestrator implements VIEW-02 against the accepted relocation.
5. Independent implementation review, automated gates, and owner visual
   acceptance of VIEW-02.
6. Owner explicitly releases the view-platform milestone.
7. BRIDGE-01 may begin; Chat remains downstream of the accepted bridge sequence.

Approval of the bundle does not authorize both implementations at once and does
not authorize Bridge, Chat, plug-in, or Side Chat work.

## Accepted prerequisites to reconcile at dispatch

- TABS-03 implementation `22cc435`, merge `2748f03`, accepted implementation
  fingerprint
  `59d6e036026ad0c609b1c40a271951671ee24075fbb1aa6637b2f5e4d6a14666`.
- PROV-01 source `acf12da`, merge `d31fc8a`, acceptance `3110bd0`.
- Trusted Fusion shell implementation `1baaffa`, acceptance `7f0d3c8`, final
  195-path manifest fingerprint
  `f77820d48883361ee1209a64c309e6e2249b914b4032a00d5294a0a28189b72e`.
- Current branch baseline at planning time: `agent/exact-workspace-paths` at
  `7f0d3c8`.

The orchestrator must read each accepted implementation report for its complete
contract. TABS-03's report contains its exact current-byte command. The two
commands below supply the missing immutable reconstruction for the other
prerequisites; neither relies on an ephemeral `/tmp` manifest.

### Trusted Fusion shell immutable reconstruction

Run from repository root. This reconstructs the accepted 195-path set from the
implementation commit itself, excluding its circular report:

```bash
evidence_dir=$(mktemp -d)
git diff-tree --no-commit-id --name-only -r 1baaffa^ 1baaffa \
  | grep -Fvx 'ai/RC-MacAir-15/Captures/025-Chat_Composition_Roadmap/SPEC-00-IMPLEMENTATION-REPORT.md' \
  | LC_ALL=C sort > "$evidence_dir/paths"
shasum -a 256 "$evidence_dir/paths"
while IFS= read -r file; do
  hash=$(git show "1baaffa:$file" | shasum -a 256 | awk '{print $1}')
  printf '%s  %s\n' "$hash" "$file"
done < "$evidence_dir/paths" > "$evidence_dir/manifest"
wc -l "$evidence_dir/paths"
shasum -a 256 "$evidence_dir/manifest"
rm -R "$evidence_dir"
```

Expected: path-list digest
`d4f04fb4df880c41f530f281d3f09d3e0013ebf47f691279a24c7df602acb00f`,
195 paths, manifest digest
`f77820d48883361ee1209a64c309e6e2249b914b4032a00d5294a0a28189b72e`.

### PROV-01 integrated immutable reconstruction

Authority:
`../024-Agent-Tool-Provenance/PROV-01-INTEGRATION-REPORT.md` and its tracked
`PROV-01-INTEGRATION-PATHS.tsv`. Run from repository root:

```bash
ledger='ai/RC-MacAir-15/Captures/024-Agent-Tool-Provenance/PROV-01-INTEGRATION-PATHS.tsv'
shasum -a 256 "$ledger"
evidence_dir=$(mktemp -d)
bad=0
while IFS=$'\t' read -r entry_status expected relation file; do
  case "$entry_status" in
    A|M)
      actual=$(git show "d31fc8a:$file" | shasum -a 256 | awk '{print $1}')
      if [ "$actual" != "$expected" ]; then bad=$((bad + 1)); fi
      printf '%s  %s\n' "$expected" "$file" >> "$evidence_dir/manifest"
      ;;
  esac
done < "$ledger"
test "$bad" -eq 0
wc -l "$evidence_dir/manifest"
shasum -a 256 "$evidence_dir/manifest"
rm -R "$evidence_dir"
```

Expected: ledger digest
`24903c8398fd0cc5134b98a8f08f4537e02f9f6471f45c02ff4534e3df3d370f`,
275 paths, aggregate
`b10150cd731bf09ed44cc1aec14a8e3f99b16db05f3c677ce805acc6a132c80a`.

These commands authenticate immutable accepted baselines. The orchestrator then
inventories current-byte drift on attributable prerequisite paths. An explained
accepted downstream change is not failure; an unexplained material contract
change stops implementation.

## Owner approval record

- **Approved candidate ID:** `VIEW-PLATFORM-15c57f9457d64a13`
- **Owner statement/date:** “Assign out the first spec.” — 2026-09-07
- **Authorized next action:** Implement VIEW-01 only through an independent
  orchestrator and return its implementation report for owner acceptance.
  VIEW-02 remains unauthorized until VIEW-01 is accepted.

### Acceptance ledger

- **VIEW-01 ACCEPTED — 2026-09-09.** Owner statement: “We're looking good.” after the
  visual walk and byte-exact restart readback (evidence:
  `VIEW-01-IMPLEMENTATION-REPORT.md` §9, `RECOVERY-002-CLOSURE.md`). Gate 4 is now
  open: VIEW-02 may dispatch through a fresh orchestrator. Gate 6 (view-platform
  milestone release) remains owner-controlled and is required before BRIDGE-01.
- **VIEW-02 ACCEPTED — 2026-09-11.** Owner statement: “everything looks more or less
  the way that I want it to, acceptance” after dogfooding the corrections build
  (evidence: `VIEW-02-IMPLEMENTATION-REPORT.md`; final-integration gate CLEAN; standing
  gates reproduced: build ✓, durable smoke `VIEW_CAPSULE_PUBLIC_SHELL_SMOKE_OK` with the
  gate file sha256-identical, server jest 196/2883/1). Two walk findings (tab min-width,
  side-menu open) did not reproduce after the owner refreshed onto the S7 renderer
  build — recorded as stale-window observations, not defects; the tab-width floor
  (`min-width: 0` in ViewTabBar.css) remains a known trait for the successor tab work.
  **Accepted condition:** the shell clickable-object design language
  (`AiSourceSelector` trigger: 12px/1 type, 10/6px word padding, uniform 6px radius,
  shared hover/pressed tokens; NO border carry-over; persistent active-tab highlight
  retained) harmonized into the top tab strip — applied 2026-09-11 as a
  presentation-only change (`ViewTabBar.css` radius unification), post-acceptance,
  pre-commit. Commit granularity remains an owner decision; the candidate is the
  uncommitted worktree at `7f0d3c8` (322+ dirty paths). Gate 6 (view-platform milestone
  release) remains owner-controlled and is required before BRIDGE-01.
