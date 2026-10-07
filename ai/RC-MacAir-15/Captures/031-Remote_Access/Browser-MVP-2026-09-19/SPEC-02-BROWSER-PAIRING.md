# SPEC-02 — Browser registration and pairing

Status: DRAFT candidate. Prerequisite: accepted SPEC-01.

## Execution packet

Read BUNDLE-INDEX.md, DECISIONS.md, ROADMAP.md, GUIDANCE.md and ISSUES.md in this directory. GUIDANCE.md's fresh builder/reviewer lifecycle applies to each slice below without exception. Each slice is a complete public-route increment, including necessary integration and its checks. A new builder handles the next slice only after orchestrator review is clean. Record every deviation and its consumers. Owner acceptance is required before the following SPEC.

Baseline: record the accepted current commit, relevant dirty paths and existing test results at dispatch. The planning snapshot is not a frozen execution branch. No live profile/DB mutations in fixtures. No migration may rewrite existing machine identities, workspaces, transcripts or view state. New module names below are proposed owner locations; if existing owners suffice, use them and report the mapping.

## Exact code standards

Hub: `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/000-Code_Standards/PAGE.md`. Read fully, plus:

- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/001-Architecture_Routing/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/002-Frontend_UI/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/003-State_Management/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/004-WebSocket_Protocol/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md`
- `ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/008-Testing_And_Smoke_Slices/PAGE.md`

## Objective and scope

Build owner-controlled browser enrollment, remembered credentials, listing and revocation. Deliver pairing service/routes in isolated route fixtures and a local trusted-shell management UI; network listener activation belongs to SPEC-03. No account passwords, public signup, QR containing a durable credential, Tailscale admin key or workspace permission UI.

## Authorities and expected areas

BR-D02/D03/D11/D12. `fusion-studio-server/lib/db.js`, `lib/db/migrations/`, `lib/ws/client-message-router.js`, `lib/secrets/index.js` (reuse management UI patterns, not raw-secret storage), `fusion-studio-client/src/components/secrets/`, header/settings menu owner discovered before UI addition. Dedicated `lib/remote-access/` enrollment service/router is justified because unauthenticated pairing cannot use ordinary product dispatch. Add next migration, not assumed 045 if concurrent work changes the head.

## Contract and persistence

Add platform-owned tables for browser registrations (opaque ID, actor owner ID, label, full-access policy ID, credential digest, creation/revocation timestamps), and remote configuration/server UUID under its owning configuration service. Store a high-entropy opaque credential only as a cryptographic digest. No recoverable token in Keychain, logs, UEB or ordinary state. Generate secrets with crypto randomness; constant-time digest verification; parameterized queries.

Pairing invitations and pending approvals are bounded in-memory records: expire within 10 minutes, maximum 20 pending invitations and 20 pending claims per host; restart invalidates them. Each invitation is random >=256 bits and single-use. Never treat possession as automatic permanent enrollment. A browser GET loads public pairing shell only. Fragment invitation is extracted, immediately scrubbed using replaceState, then POSTed to the enrollment owner. Claim binds to a separate random HttpOnly pending cookie; a second claim/replay cannot take over the pending record. Owner sees matching confirmation code and browser label, then approves or rejects in authenticated local Fusion. Approval and final credential issuance are atomic/single-use; failure cannot leave an orphan usable registration. Poll/finalize requires the pending cookie, not just an invitation ID.

Final credential uses a `__Host-` cookie: Secure, HttpOnly, SameSite=Strict, Path=/, no Domain. Remember browser across restart with a persistent cookie (400-day Max-Age renewed on valid use; browser policy may shorten retention); registration itself remains until revoked. Clearing cookies/profile requires pairing again. Do not put credential in localStorage, IndexedDB, URL, JS-readable state or WS subprotocol. Credential cannot be retrieved from management UI.

The local shell mints invitations, approves/rejects, lists registrations and revokes one/all. This uses actual trusted-shell authentication even though browsers hold full ordinary access. Browser logout revokes its own registration and expires cookie (all tabs using it lose access); it cannot revoke unrelated registrations. Metadata response never returns credential digest.

Remote endpoints are limited to `/remote/pair/claim`, `/remote/pair/status`, `/remote/pair/finish`, `/remote/session` and `/remote/logout`. Claim/finish/logout are POST, status/session GET. Same-origin checks and CSRF for authenticated mutation are required; SPEC-03 owns outer ingress enforcement. Bounded body size, TTL and request limits: claim/finish <=4 KiB, max 10 claim/finish attempts per minute per peer and 100 total per minute; rejected excess 429 without secrets. Shared proxy peer limits are intentionally conservative. State-changing GET is forbidden.

## Slices

### 02A — Local enrollment owner and migration

Implement migration, credential repository/service, trusted-shell management command family and small settings surface to generate invitation/confirm pairing. Create dedicated message family only after recording why existing Secrets/settings dispatch cannot carry it. Fixture claim and finish exercise production enrollment handlers over HTTPS, including cookie flags, one-use races and rollback. Test fresh DB and upgrade/reopen without touching chats/config.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/registration-migration.test.js test/remote-access/pairing-routes.test.js`; `cd fusion-studio-client && npm run build`.

### 02B — Remembered identity and revocation

List/revoke through local management and self-logout through browser route. Establish revocation notification seam consumed by SPEC-03. Commit revocation before success; DB failure returns failure and does not claim revoked. Cached verifiers invalidate before next authorized action. Restart preserves valid registrations and revocations, not invitations. Missing DB/digest failure denies. Tests verify spoofed shell commands from browser principal cannot administer pairing.

Check: `cd fusion-studio-server && npx jest --runInBand test/remote-access/pairing-routes.test.js test/remote-access/revocation.test.js test/remote-access/registration-migration.test.js`; client build and full server suite.

## Failure and compatibility

Expired/used/rejected invitations show bounded retry guidance. Cookie copy is credential theft, not hardware binding; document this accurately. No renewal resurrects a revoked registration. Label edits never change identity. Raw network headers or client claimed role never approve enrollment. Rollback does not delete unrelated data; downgrade with new registrations needs disabling browser access rather than exporting secrets. Keep new settings disabled/not advertised as remotely ready until SPEC-03/04/05 complete.

## Final SPEC acceptance

Trusted owner approves a browser registration using fixture HTTPS; durable remember/revoke and concurrency tests pass. Real server product ingress remains unexposed. Implementation report includes schema, retention/cookie contract and redaction inventory. Regression surface: local settings/secrets UI, DB startup/migration and trusted management dispatch.
