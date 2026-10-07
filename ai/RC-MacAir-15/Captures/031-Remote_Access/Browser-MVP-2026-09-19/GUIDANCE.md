# Implementation and review contract

Read this with every SPEC and slice. Planning only until exact candidate approval. The requested output is a reviewable plan, not product code.

## Baseline and work ownership

Before dispatch, resolve repository root, record commit, dirty paths, relevant accepted reports, migration head and baseline tests. Work in primary development checkout; preserve unrelated edits and the earlier parent draft. No Alpha pull/build/install/restart, publishing or credential provisioning follows from plan approval. Reconcile concurrent changes before altering shared modules. New schema uses the next free migration number, never a reserved number in this plan. Never test against live fusion.db, Alpha profiles, real tokens or real workspace history.

## Fresh execution lifecycle (normative for every slice)

One fresh `spec-slice-builder` implements each slice end to end, including mechanically necessary omitted integration, self-reviews, runs required checks and records every deviation. The builder may spawn only fresh `clean-room-reviewer` agents, never another builder. Repair forward and stop after the first materially clean builder-owned review; there is no arbitrary pass ceiling. Return `READY_FOR_ORCHESTRATOR_REVIEW` with files, exact commands/results, warnings, residual risks and deviations.

The SPEC orchestrator independently inspects work and uses fresh `clean-room-reviewer` passes, stopping after the first clean pass and routing repairs until clean otherwise. Each new slice gets a new builder. Material acceptance repairs return through a builder, fresh builder-owned review and fresh orchestrator-owned review. Every descendant inherits the invoking root thread's model and reasoning effort. Report all deviations and downstream effects. The supervisor presents each completed SPEC to the owner and obtains explicit acceptance before the next SPEC.

Every slice below incorporates this lifecycle; acceptance checklists are not permission to skip independent review. Advisory findings may coexist with CLEAN. A material new product decision updates the candidate and receives affected review and owner approval; routine technical choices within contract do not require repeated permission.

## Standards and source contracts

Repository paths in BUNDLE-INDEX.md are normative routing references. Read the hub and every page selected for your SPEC fully. Expected paths are ownership hints, not exclusive file lists. New routes require a documented reason the current route cannot fit. Ordinary actions stay in their existing domain routers; authorization is not an alternate command bus. Preserve chat acceptance/Stop/turn routing and postcommit fan-out, file-save preimage/provenance contracts, custom-content trust boundaries and immutable view identity.

New remote enrollment/status/logout/bootstrap endpoints have a dedicated owner because authentication must occur before ordinary product routers exist. Browser and desktop reuse the same domain services and product-session activation factory. Credentials, authentication proofs, cookies, invitations and CSRF values never enter content logs, diagnostic payloads, UEB, ledger, harness environment or prompts.

## Validation conventions

SPECs name exact proposed test paths; create these tests in their owning slice. Use existing production boundaries in isolated fixtures, not copied fake app implementations. Builder reports distinguish newly created tests from existing baseline tests. Required common server checks: `cd fusion-studio-server && npm test -- --runInBand`. Required common client check: `cd fusion-studio-client && npm run build` when client/Electron assets change. Browser changes use the new isolated `playwright.remote.config.ts` and tests named below; it must not reuse any existing user server. Evidence from a mocked transport is not the two-machine Tailscale acceptance.

Existing targeted checks: `cd fusion-studio-server && npx jest --runInBand test/startup-loopback.test.js test/shell-bootstrap.test.js test/ws/shell-auth.test.js test/ws/shell-auth-dispatch.test.js test/ws/shell-auth-public-route.test.js test/ws/shell-auth-recipient-isolation.test.js test/ws/shell-auth-server-inventory.test.js test/ws/trusted-shell-authority.test.js test/ws/server-runtime-activation.test.js test/ws/workspace-session.test.js test/shell-cors.test.js`; `cd fusion-studio-client && node --test electron/shell-launch-authority.test.cjs electron/shell-proof-ipc.test.cjs electron/server-spawn.test.cjs electron/runtime-descriptor.test.cjs electron/shell-protocol.test.cjs electron/shell-navigation-policy.test.cjs`.

Remote fixture config runs renderer transport tests (`e2e/runtime-transport.spec.ts`, `e2e/shell-auth-client.spec.ts`) without a live user profile, and served-page tests against disposable workspaces/profile, actual built dist, production listeners and a local test HTTPS reverse proxy. Browser test TLS trust is fixture-only. Production HTTPS validation cannot be disabled.

## Handoff

After candidate approval: invoke `$orchestrator` with one approved SPEC whose prerequisites are accepted, or `$roadmap-implementation-supervisor` with ROADMAP.md. Neither route may infer acceptance of later SPECs. A missing real-device environment remains an explicitly pending acceptance gate, not a simulated pass.
