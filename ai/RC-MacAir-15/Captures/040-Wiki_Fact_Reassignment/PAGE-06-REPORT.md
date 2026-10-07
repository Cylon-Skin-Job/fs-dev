# PAGE-06 — GitLab fact reassignment report

Status: **REVIEW_READY** for coordinator reconciliation; no live wiki edits.

## 1. Assignment and evidence boundary

- Source: `ai/RC-MacAir-15/Wiki/001-Project/017-GitLab/PAGE.md`; SHA-256 `db35c205d42de7ee1769217d7ca9ba44adb65946df89f47039f29a90d2cd69e5`; filesystem mtime `2026-07-03T17:48:59-0700` (mtime is not a verification date). Read all 2,757 bytes.
- Proposed primary owner: `ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/001-GitLab/PAGE.md` (**new, proposed**). The existing Integrations heading explicitly reserves that child for GitLab and is the better home than a legacy Project catch-all. Ticketing should own any detailed issue-source workflow, with a link from this page.
- Inspected: repository `AGENTS.md`; Capture README and retirement audit; all four Wiki Guidance pages; full Code Standards router and Platform Ownership article; `004-Integrations_And_Tools/PAGE.md`; old Project TOC and Ticket Routing; owner ticket `Issues/inbox/RCC-0091.md`; the GitLab credential helper, secrets module, issue sync modules and their callers; read-only searches for app startup/call sites and incoming links. Current relevant source identities: `lib/sync/index.js` `015fff8b…`, `request.js` `e35e830e…`, `push.js` `d9f8269d…`, `pull.js` `ddf4703f…`, `lib/git-credential-fusion-studio.sh` `00345218…`, `lib/secrets.js` `142c6954…`, `lib/tickets/dispatch.js` `0e9b22ed…`, `lib/runner/index.js` `c1811044…` (all under `fusion-studio-server/`; full hashes were computed during review).
- Verified by read-only code and path inspection only. No credential values, Keychain items, token permissions/expiry, remote URLs, GitLab account/project state, API responses, global Git helper configuration, application runtime, or external GitLab documentation were inspected. `git remote` showed names `origin` and `gitlab` in this checkout; this does not establish either remote's URL, current reachability or a universal project convention.

## 2. Source-section coverage

- [x] Opening identity and claimed GitLab use for repos, wikis and automation.
- [x] Namespace tree and unused group assertion.
- [x] Dual-Remote Pattern table and two push commands.
- [x] Authentication, Keychain location, two-helper cache flow, UI prompt, global Git configuration.
- [x] API Access example and Wiki API endpoint.
- [x] Token Rotation commands, scope and date.
- [x] Creating a New Project command and remote/push example.
- [x] The embedded `[Secrets](Secrets)` link and generated/navigation implications.

## 3. Claim ledger

In this table `I/G` means the proposed Integrations/GitLab article; `I/S` means proposed Integrations/Secrets Manager; `T` means the proposed `003-Automation_And_Agents/002-Ticketing/PAGE.md`. These are proposed article paths, not existing files. “Historical only” leaves the claim in the preserved predecessor or version, without active duplicate prose.

| ID | Source claim | Classification and evidence | Disposition; destination and coverage | Confidence / limit |
|---|---|---|---|---|
| P06-F001 | “kimi-claude” uses GitLab for project repos, wikis and API automation. | Historical identity plus overbroad current capability. `AGENTS.md` identifies this as Fusion Studio. This checkout has a `gitlab` remote name; `lib/sync/request.js` has a fixed project-scoped GitLab issue API client. No app Wiki API caller found in scoped client/server search. | Retain the narrow observed remote and issue-code facts in I/G §Current boundaries; exclude old product identity and wiki-sync implication from active prose. | High for code and current naming; GitLab server state unverified. |
| P06-F002 | All projects are under the named personal namespace; named project tree and unused group. | Historical/personal deployment assertion. No generic architecture owner; remote URLs/account inventory deliberately not inspected. | Historical only. Do not migrate personal namespace or group/project inventory into I/G. | High that it is unsuitable as a universal current instruction; actual remote namespace unknown. |
| P06-F003 | Every project has GitHub `origin` and GitLab `gitlab`, with fixed roles. | Mixed: this checkout has both remote **names** (`git remote`); `AGENTS.md` defines GitHub publishing for fs-dev. No verification of every project or remote URLs. | In I/G §Repository remotes state that this checkout has a `gitlab` remote, and readers must inspect each repository before use. No universal dual-remote policy. | High for local names; broad claim unsupported. |
| P06-F004 | `git push origin main` then `git push gitlab main`. | Conditional Git procedure, not a safe universal operation. Current branch/remote tracking and authorization were not established. | Replace with role-neutral setup guidance in I/G §Repository remotes: inspect the repository's branch/remotes and push only to intended approved destination. Do not carry fixed `main` commands. | High. |
| P06-F005 | GitLab PAT stored in macOS Keychain. | Current code capability: `lib/secrets.js` account `fusion-studio`, key-name convention; `lib/sync/request.js:getToken` and `lib/git-credential-fusion-studio.sh` read service `GITLAB_TOKEN`. The token's existence was not checked. | I/G §Authentication explains the code's expected credential name/account and links to I/S for credential handling. Needs new prose; no active equivalent. | High for code contract, no runtime proof. |
| P06-F006 | `git-credential-cache` with 12-hour TTL, then `scripts/git-credential-kimi.sh`, first-session Allow, globally configured two helpers. | Incorrect/superseded as current Fusion Studio instructions. Current helper file is `fusion-studio-server/lib/git-credential-fusion-studio.sh`, not the source's path; repository search found no current configuration of it. Current `request.js` caches token in process memory but makes no 12-hour guarantee. Keychain consent is OS/user-state dependent. | Exclude old flow and example configuration. I/G §Authentication can state the current repository includes an optional Git credential helper, but installation/configuration is **unverified**. | High for code path and no in-repo wiring; global Git config deliberately unverified. |
| P06-F007 | Same token can access GitLab API; example calls project Wiki endpoint with `kimi-ide` Keychain account. | General API possibility, but current code only proves `PRIVATE-TOKEN` use for one fixed project and issue endpoints (`request.js`, `pull.js`, `push.js`). `kimi-ide` account is superseded by `fusion-studio`. No Wiki endpoint integration verified. | I/G §Current boundaries: issue API helper exists in source; API Wiki example and old shell token extraction are excluded. Link to T for issue-source status. | High for code; API permissions and responses unverified. |
| P06-F008 | Rotation via `/personal_access_tokens/self/rotate`, `self_rotate` scope and immediate Keychain update. | Unresolved external procedure; no local implementation or current official service docs inspected. Shell example reads/handles raw token. | Do not reproduce executable rotation procedure. I/G §Authentication may advise using current GitLab account guidance and updating the credential through its owning local secrets flow, if needed. Exact scope/endpoint belongs to current GitLab docs, not this source's durable article. | High on no local implementation; current external procedure not verified. |
| P06-F009 | “Current token expires 2026-06-20.” | Dated historical observation, already past on 2026-09-27; credential state deliberately not accessed. | Historical only; exclude from active prose. | High. |
| P06-F010 | Create a private Wiki-enabled GitLab project by POST, then add hardcoded personal-namespace remote and push `main`. | Generic service possibility but command is tied to old personal account, relies on an unverified token, and creates external state. No Fusion Studio project-provisioning path found in scoped app code. | Preserve reader task at high level in I/G §Connecting a repository: create/select a project in GitLab through an authorized workflow, inspect its actual URL, configure remote for that repository. No hardcoded namespace, API example or automatic Wiki capability claim. | High for code scope; external project-creation API not verified. |
| P06-F011 | `[Secrets](Secrets)` resolves to current secrets documentation. | Broken relative slug: no `001-Project/017-GitLab/Secrets` target. The new I/S page does not yet exist. | New I/G link should point to the verified new I/S page once integrated, or to an existing correctly owned secrets article if the coordinator chooses one. | High for local path. |
| P06-F012 | GitLab issue synchronization is an active capability implied by “API-driven automation.” | Current code has `sync/pull.js` and `sync/push.js` plus dispatch/runner calls, but read-only call-site search found `startDispatchWatcher` only in `dispatch.js` itself/standalone CLI, not app startup. Current Ticket Routing calls sync inactive; owner ticket RCC-0091 keeps remote issue source tabs/actions as open target and says local tickets should not automatically create remote issues. | I/G §Current boundaries: source modules exist; no integrated automatic sync or GitLab Issues viewer source tab is established. Detailed intended issue-source behavior belongs to T and RCC-0091; link, do not duplicate. | High for call graph within searched repo; runtime and external CLI use unverified. |

## 4. Proposed destination prose and metadata

### `004-Integrations_And_Tools/001-GitLab/PAGE.md` — proposed new article

Suggested frontmatter: `name: GitLab`, a description limited to repository remote, credential code and issue-integration status; `metadata.source-files` set to exact unique existing code files `fusion-studio-server/lib/secrets.js`, `fusion-studio-server/lib/git-credential-fusion-studio.sh`, `fusion-studio-server/lib/sync/request.js`, `fusion-studio-server/lib/sync/pull.js`, `fusion-studio-server/lib/sync/push.js`, and `fusion-studio-server/lib/tickets/dispatch.js` **only if** the following code-status paragraphs remain. Use the actual edit-time quoted UTC `metadata.last-modified`. A pure repository-remote setup paragraph has no code owner and should not force a guessed source-file entry. No `connected-skills` or edge metadata.

> ## Repository remotes
>
> This development checkout currently has remotes named `origin` and `gitlab`. Repository remotes belong to each checkout: inspect that repository's configured URLs, branch and intended publication workflow before adding or pushing a GitLab remote. Do not assume another workspace uses the same namespace or branch. Fusion Studio's current development publishing workflow uses GitHub as recorded in the repository's `AGENTS.md`.
>
> ## Authentication
>
> The repository contains a macOS Keychain-backed GitLab credential helper and a GitLab issue API helper. Their code expects a Keychain item named `GITLAB_TOKEN` under account `fusion-studio`. The Git helper responds only to credential requests for `gitlab.com`; its installation in any user's global Git configuration is not established by the repository. Handle credential creation, replacement and rotation through the current local secrets guidance and current GitLab account instructions. Do not paste tokens into wiki examples or shell histories.
>
> ## Current integration boundary
>
> GitLab issue pull/push modules are present in server source for a project-specific ticket flow. The dispatch watcher that calls them is not wired into the inspected app startup path, and the current Issues viewer does not establish a live GitLab source tab or automatic sync. [Ticketing] should own the local board behavior and the approved remote-source target; this page records only the GitLab integration boundary. There is no verified Fusion Studio Wiki API sync or automatic GitLab project provisioning here.
>
> ## Connecting a repository
>
> If a project needs GitLab, use its actual GitLab project URL and add a repository-specific remote through the approved repository workflow. Project creation, Wiki enablement, token scopes, and rotation should be checked against current GitLab account guidance for that project; the historical personal-namespace commands on the old Project page are not reusable setup instructions.

The coordinator should link “current local secrets guidance” to the reconciled `004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md`, and “Ticketing” to `003-Automation_And_Agents/002-Ticketing/PAGE.md`, once those pages exist. These are **proposed** links and should not be installed prematurely. The article should avoid copying GitLab API code examples, since the current source is project-fixed and not an active general connector.

### `003-Automation_And_Agents/002-Ticketing/PAGE.md` — cross-agent link only

If agent 11/13's reconciliation does not already cover it, add one short status sentence: legacy GitLab issue sync modules exist, but the board remains local and no startup wiring for the dispatch watcher was found in the inspected source; the GitLab source tab/API actions are an open approved direction in RCC-0091. Ticketing owns detailed local/remote source behavior. No separate GitLab detail duplication is needed.

## 5. Material to exclude from active prose

Keep the old page's exact preimage in its `.versions/` snapshot when the coordinator rewrites it, and retain historical Git context there. Do not carry forward the old `kimi-claude` identity, personal namespace/project list, “unused” group status, old `kimi-ide` Keychain account, nonexistent `scripts/git-credential-kimi.sh`, global helper settings, 12-hour cache guarantee, universal Keychain Allow prompt, 2026-06-20 expiry, direct raw-token shell examples, assumed rotation scope or fixed `main` push target. Each is personal, dated, unverified, or contradicted by current source as identified in the ledger. The code's fixed project ID in `request.js` also should not be advertised as a configurable general integration. The migration script `scripts/migrate-keychain.sh` is a one-time historical migration tool, not onboarding guidance and must not be run in this task.

## 6. Incoming references and shared ownership

- **Two resolving active live-wiki incoming owners** found for the exact source path: `Wiki/001-Project/PAGE.md` links `017-GitLab/PAGE.md`; `Wiki/004-Integrations_And_Tools/PAGE.md` links `../001-Project/017-GitLab/PAGE.md`. The second should route to its own new GitLab child after creation. Project's old TOC can retain a route until that page's separate navigation migration is reconciled.
- Broken slug examples: `Wiki/001-Project/001-Home/PAGE.md` uses `[GitLab](GitLab)`; `Wiki/001-Project/021-Setup_Wizard/PAGE.md` uses `[GitLab](GitLab)` and `[Secrets](Secrets)`; the source itself uses `[Secrets](Secrets)`. These do not resolve to current numbered PAGE paths. Home and Setup are other agents' files; coordinator should repair their references only as a bounded supporting migration.
- Active Issue references: `Issues/inbox/RCC-0091.md` records the intended GitLab source tab; `Issues/inbox/RCC-0102.md` discusses stale GitLab naming and calls for verification. They are context/owner evidence, not resolving incoming links to this exact page. Existing `Issues/content/tickets.json` mirrors issue text; do not rewrite it for this migration.
- Separate shipped/template copies under `System_Manager/ai-template/Wiki` and `System_Manager/ai-v2/RC-MacAir-15/Wiki` repeat old GitLab/Project/Integrations content and relative links. These are out-of-scope template debt and possible future reintroduction paths, not current live-wiki incoming owners. Captures, `.versions`, and runtime caches likewise are historical/generated references.
- Shared owners: agent 16's Secrets Manager should own credential handling; agents 11/13's Ticketing should own issue workflow; agent 10's Setup may need a pointer, not duplicate rotation instructions; agents 01/02 own Project navigation and old Home slugs. The current Integrations heading is itself another likely coordinator edit. No conflict should be resolved by converting legacy issue-sync modules into a shipped GitLab connector claim.

## 7. Unresolved questions and grounded resolutions

| Kind | Question | Recommended treatment |
|---|---|---|
| Researchable state | Is the current checkout's `gitlab` remote still reachable and which GitLab project/namespace does it target? | No credential or remote URL lookup was authorized in this page assignment. The new durable article should avoid a project name or URL; a later deployment-specific check can confirm one if needed. This does not block fact reassignment. |
| Researchable state | Is `lib/git-credential-fusion-studio.sh` configured in the user's global Git helpers, and is any token available? | Keep helper **present in source**, configuration/secret **unverified**. No need to inspect user credentials for documentation migration. |
| Researchable implementation | Can a live app path invoke issue pull/push outside the searched startup/call sites? | Current repository search found only standalone dispatch/runner chain. Treat app integration as unverified/inactive; recheck current code hashes and startup before final publication. |
| Implementation choice | Should GitLab issue sync be retained, replaced by source-aware API tabs, or removed? | RCC-0091 provides an approved open target; Ticketing and platform owners should reconcile in later product implementation. This fact migration should accurately state current status and link there. |
| Owner decision | Should every future workspace get a GitLab remote, and should Wiki hosting be required? | No owner-approved universal rule found. Avoid claiming either. The documentation migration does not require a new product decision. |

## 8. Retirement readiness

**Ready for fact migration after** the coordinator creates and links a verified Integrations/GitLab article, coordinates the short Ticketing/Secrets references, preserves the complete source preimage, changes the old source to a concise successor route or explicitly bounded historical note, and repairs active navigation/slug dependencies in scope. **Not ready for physical deletion in this assignment**: Project TOC and Integrations currently link the source, Home/Setup contain broken slug references, and template copies can reintroduce outdated content. No deletion or live wiki edit was performed.
