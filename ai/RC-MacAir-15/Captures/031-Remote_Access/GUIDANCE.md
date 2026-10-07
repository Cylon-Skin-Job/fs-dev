# Remote Access Implementation Guidance

## 1. Execution Boundary

This bundle authorizes planning only until the owner approves the exact release
candidate. After approval, each SPEC may be executed only in roadmap order and
only after every named prerequisite is accepted.

Do not implement product code from the Roadmap Creator session. Preserve all
unrelated user and worker changes in dirty worktrees (`RA-I-015`).

R1 is resolved (`DECISIONS.md` RA-RD-011: paired devices hold full mutation
capability; `FUSION_REMOTE_MUTATIONS` can forbid it). SPEC-05 implements that
resolution and records the owner-authorized contract change in the 025 lane's
deviation surface. SPECs 01–04 and 06 do not consume the decision.

## 2. Required Builder Lifecycle

For every slice, the SPEC orchestrator assigns one fresh `spec-slice-builder`.
That builder:

1. reads the accepted SPEC, this guidance, its accepted baseline, routed Code
   Standards, relevant wiki pages, and current code/tests;
2. implements the entire slice, including mechanically necessary integration
   omitted from an expected-path list;
3. preserves unrelated work and records every deviation;
4. self-reviews and runs the required checks;
5. repairs validated findings forward;
6. may spawn only fresh `spec-gate-reviewer` agents, never another builder;
7. continues builder-owned review until the first materially clean
   current-byte pass, without an arbitrary pass ceiling; and
8. returns `READY_FOR_ORCHESTRATOR_REVIEW` with changed paths, exact commands,
   results, warnings, residual risks, and deviations.

A new slice receives a fresh builder. Each pipeline role runs on its pinned
per-agent model and effort (configured in the agent definitions); no
substitution of model or effort is permitted.

## 3. Required Orchestrator Lifecycle

The SPEC orchestrator independently inspects every returned slice and uses
fresh `spec-gate-reviewer` passes. It stops at the first clean current-byte
pass and otherwise routes repairs through the owning builder until clean.

Material acceptance repairs return through a builder, fresh builder-owned
review, and fresh orchestrator-owned review. The orchestrator reports every
deviation and downstream effect. It cannot declare owner acceptance.

The implementation supervisor independently reviews the completed SPEC and
presents it to the owner. Only explicit owner acceptance permits the next SPEC.

## 4. Baselines And External Gates

- Every SPEC baseline is the accepted, integrated current branch state at
  dispatch time, including accepted SPEC-00 trusted-shell authority
  (`agent/exact-workspace-paths`, 2026-09-07) and the owner-accepted results of
  all earlier SPECs in this bundle.
- Before each SPEC, record: exact baseline commit, dirty paths, migration head,
  and every accepted test it must not regress.
- SPEC-01 records the current bind/refusal test baseline.
- SPEC-02 records renderer transport tests (Electron-lane contract) and must
  not weaken them.
- SPEC-03 records `lib/secrets` behavior and the shell-auth test suite; the
  shell-auth suite must remain byte-identical in behavior.
- SPEC-04 records Electron main unit tests and the shell/spawn tests.
- SPEC-05 records the three consumers of `trusted-shell-authority` and their
  tests, plus R1 resolution.
- SPEC-06 records the client build and the SPEC-02 browser smoke.

## 5. Deviation Policy

Mechanically necessary omitted integration is permitted and must be documented.
A deviation may not silently:

- weaken trusted-shell authority, alter the fd-3 bootstrap, or let any
  non-shell client assert `trusted-shell`;
- loosen the Electron lane's exact-loopback descriptor contract;
- place tokens in URLs, query strings, logs, or error text (fragment
  provisioning per RA-RD-005 and SPEC-03 is the sole permitted URL-adjacent
  carrier; RA-RD-007 forbids query strings and logs; the fragment is
  client-only and must be scrubbed after storage);
- expose QR minting or device management on any route reachable without a
  trusted-shell connection;
- bind a routable host without the explicit opt-in of RA-RD-008;
- introduce a second web server, a second client bundle, or a new WebSocket
  message family where an accepted route fits;
- change visible local-mode behavior of the desktop app;
- begin a later SPEC's behavior early; or
- edit accepted 025/026 lane paths (tabs, provenance, thread groups).

A material contract change requires an updated roadmap candidate, affected
fresh review, and owner approval before implementation continues.

## 6. Testing And Isolation

Use temporary databases, profiles, and workspaces. Never run migration or
destructive fixtures against `fusion-studio-server/data/fusion.db`, the Alpha
profile, or user workspace chat history. Device-token tests use a temporary
Keychain service name or the injectable keychain seam; they must not write
real `remote-device:*` entries outside test isolation.

The minimum whole-SPEC commands are:

```bash
cd fusion-studio-server && npm test
cd fusion-studio-client && npm run build
```

Each SPEC adds its exact targeted Jest/Playwright commands. SPEC-02 and SPEC-06
add a served-page browser smoke; SPEC-04 and SPEC-05 add an Electron smoke when
mode switching or shell composition is in scope.

## 7. Completion Vocabulary

- `READY_FOR_ORCHESTRATOR_REVIEW`: builder and builder-owned review are clean.
- `READY_FOR_SUPERVISOR_REVIEW`: integrated SPEC and orchestrator-owned review
  are clean.
- `AWAITING_OWNER_ACCEPTANCE`: supervisor has presented the result.
- `ACCEPTED`: owner explicitly accepted the completed SPEC.
- `BLOCKED`: genuine execution impossibility, not a failing test, finding,
  dirty worktree, changed hash, difficult repair, or incomplete work.
