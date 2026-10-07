# SPEC-01 — Server authorization policy

Status: DRAFT candidate. Prerequisite: accepted existing shell baseline; candidate approval.

## Execution packet

Read BUNDLE-INDEX.md, DECISIONS.md, ROADMAP.md, GUIDANCE.md and ISSUES.md in this directory. GUIDANCE.md's fresh builder/reviewer lifecycle applies to each slice below without exception. Each slice is a complete public-route increment, including necessary integration and its checks. A new builder handles the next slice only after orchestrator review is clean. Record every deviation and its consumers. Owner acceptance is required before the following SPEC.

Baseline: record the accepted current commit, relevant dirty paths and existing test results at dispatch. The planning snapshot is not a frozen execution branch. No live profile/DB mutations in fixtures. No migration may rewrite existing machine identities, workspaces, transcripts or view state. New module names below are proposed owner locations; if existing owners suffice, use them and report the mapping.

## Exact code standards

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read fully, plus:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Objective and scope

Introduce a server-owned principal/action/resource authorization interface with one `full-access` policy. Establish the requested permission foundation without a scoped-policy engine or permission editor. Preserve existing shell authentication, source-owned validations and untrusted standalone behavior. No network exposure, browser credentials, hierarchy, OpenCode hook, regex evaluator or harness isolation.

## Authorities and expected areas

BR-D03/D09/D16. Read Chat overview and accepted 025 shell SPEC/report listed in BUNDLE-INDEX. Current owners: `fusion-studio-server/lib/ws/trusted-shell-authority.js`, `privileged-thread-guard.js`, `thread-ws-handlers.js`, `workspace-request-handlers.js`, `client-message-router.js`, and `lib/ws/product-session-registry.js`. New policy owner may be `lib/access/`. Do not rename connectionRole into a permission tier.

## Contract

- Effective principal is attached by a private authentication owner, never deserialized from request content. Include server instance ID, actor ID, authentication kind, registration ID where applicable, connection ID and policy ID. Browser-reported labels are not identity proof.
- Evaluation accepts canonical action plus server-resolved resource context (workspace/view/thread/path as applicable). It returns a bounded allow/deny result. Domain services still resolve paths, ownership and readiness normally.
- `full-access` allows every explicitly registered supported ordinary product action/resource. Unknown action, missing principal, unknown policy and revoked browser registration are denied. No global `return true`, permissive absent-policy default or wildcard that activates retired routes.
- Existing verified shell sessions get full-access through their authentication owner. Raw localhost/standalone connections retain their existing behavior and never inherit a new owner principal. New permission evaluator returns deny for them; do not incidentally redesign standalone read paths.
- Replace ordinary mutation eligibility checks with the canonical evaluator while retaining shell-specific proof/admin checks where their purpose is actually shell trust. Preserve bounded existing errors when needed; do not conflate product access and authentication-kind checks.
- An ordinary product principal never becomes a provider credential, ambient automation grant or executable plugin capability. No thread/provider metadata schema expansion solely to carry browser credentials.

## Slices

### 01A — Principal and action catalog through an existing mutation

Own the central policy module, shell principal attachment and one existing thread mutation route. Inventory all current trusted-shell guard consumers and all public WS message families into a checked-in action catalog/inventory. Exercise accepted shell action through the production dispatcher; spoofed fields, untrusted session and unknown action cannot gain authority. Test fixture includes a server-minted browser principal solely to prove policy behavior; it must not create production browser admission yet.

Check: `cd fusion-studio-server && npx jest --runInBand test/access/policy.test.js test/access/policy-routes.test.js test/ws/trusted-shell-authority.test.js` (first two new). Pass: allowed known actions follow owning services; rejected calls have no side effects and no fabricated trusted-shell role.

### 01B — Complete existing guard integration and route inventory

Migrate remaining ordinary thread/workspace/view guard consumers to the policy owner, maintaining the old shell predicate for actual shell-only checks. Classify local admin/bootstrap messages separately from ordinary product actions; catalog becomes input to SPEC-03's complete remote dispatch boundary. Add public route tests for create/open-assistant, prompt activation, view creation/relocation/config writes and invalid role replay. Keep existing System-file write services and UI-mediated authority requirements.

Check: 01A command plus GUIDANCE existing targeted server suite and full server suite. Update relevant wiki/025 report with a precise additive eligibility note during implementation, preserving historical acceptance.

## Failure, compatibility and migration

No DB migration in this SPEC unless existing source inspection proves essential; browser durable records belong to SPEC-02. Policy exceptions fail closed before mutations. Preserve accepted shell HMAC/error/turn/Stop behavior and provider environment exclusions. Do not change unrelated provenance grants or drop any source-owned validation.

## Final SPEC acceptance

All current guard consumers have an explicit policy or shell-bootstrap classification, real public routes exercise each category, forged principals cannot authorize, and the local desktop behavior is unchanged. There is still no externally exposed browser service. Full server suite passes or pre-existing failures are evidenced and unrelated; new failures must be repaired. Regression surface: trusted thread/view/System mutations and session authority lifecycle.
