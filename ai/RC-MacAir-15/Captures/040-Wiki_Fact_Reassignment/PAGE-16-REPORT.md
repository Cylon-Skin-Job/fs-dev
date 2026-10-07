# PAGE-16 — Secrets Manager fact reassignment

Status: REVIEW_READY. This is a source investigation and proposed prose, not an edit to the live wiki.

## 1. Assignment and evidence boundary

- Source: `ai/RC-MacAir-15/Wiki/002-System_Tools/002-Secrets_Manager/PAGE.md`; SHA-256 `516c2b69cade6c657b0d937521c884130f3d7e5b0f453a65a505264a1964ea7a`; 6,512 bytes; filesystem mtime `2026-07-03T17:48:59Z` (not a verification date). No source frontmatter exists.
- Proposed canonical owner: **new** `ai/RC-MacAir-15/Wiki/004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md`, subject to coordinator reconciliation. The current section heading explicitly reserves `002-Secrets_Manager/`; that article does not yet exist.
- Read: assignment packet; Capture README and retirement audit; Wiki Style Guide, Creating Wikis, Updating Wikis, Audit Workflow; Code Standards router plus WebSocket and Persistence standards; Integrations and Tools heading; source LOG; `RCC-0094` issue; active source, destination, and incoming link search.
- Code inspected: `fusion-studio-server/lib/secrets.js`, `lib/secrets/api-keys/{index-table,backend,handlers,fingerprint}.js`, `lib/secrets/index.js`, migrations `013_secrets_index.js` and `015_drop_use_when.js`, `lib/db.js`, `lib/startup.js`, `lib/harness/child-environment.js`, OpenCode spawn and configured-secrets/diagnostic-redaction paths, `lib/ws/{client-message-router,redaction-map}.js`, `lib/wire/wire-log.js`, Electron Tools menu, React modal/panel/store/client WebSocket paths. Important code SHA-256: `secrets.js` `142c6954348e2557e31fcf216a30555790bc29f8549963`; API backend `aef6d6dc725418df2b8a44a58da14e17427826ef1f23fd7607a64b7ed592e876`; API handlers `f4d89640c79c178ba9c62f8efa5ac1328cc7eb6274d96aede2ecc47020afd657`; child environment `a60e49cefa91b3d72a5a0cdc1df659f001b0e74038c664445f7c9f1d86701e66`; startup `9e6d99316fde584d08828685c3df762d1ea3e557d118b1e1207defe52993e382`; redaction map `1aa9adf3f0267d2cb26ab02d77e52d81b140e6a0caa47c8577304593b4ef2f95`.
- No secret store, SQLite data, environment value, runtime app, credential example, external provider, or product test was accessed or executed. This is code and documentation inspection; it does not prove end-to-end safety or a particular credential's presence.

## 2. Source-section coverage

- [x] Opening purpose and scope: retain the user task (find a stored credential name and use it carefully); correct product identity and limit claims of guaranteed non-disclosure.
- [x] What this is: verify split between Keychain value and SQLite metadata; correct account, database and future-platform wording.
- [x] How to list: retain name/description discovery, but qualify `$ROBIN_DB` propagation and avoid teaching an access path that the current harness filters out.
- [x] How to use: preserve the no-transcript/no-file principle; retire executable `open-robin` recipes and their absolute safety claims.
- [x] Discipline rules: retain policy, distinguish it from enforced runtime guarantees and avoid a blanket refusal rule for all requests.
- [x] Missing credential: retain user-facing resolution, distinguish absent index row from Keychain lock/access/backend failure, correct UI location.
- [x] Metadata fields: verify schema, name format, description cap, expiry units, fingerprint computation; reject automatic warning and “not sensitive” blanket.
- [x] Progressive disclosure: retain one-off versus repeated-workflow concept as a guarded proposal; no assertion that agents have an approved value-read interface.

## 3. Claim disposition

All retained items route to proposed `004-Integrations_And_Tools/002-Secrets_Manager/PAGE.md` (abbreviated **I/002**) unless otherwise stated. The old page has no unique canonical coverage elsewhere; the Integrations heading is only a planned-child navigation stub. `RCC-0094` corroborates the storage migration gap but is an issue, not shipped-code proof.

| ID | Source claim / section | Class and evidence | Disposition, destination and coverage | Confidence / limit |
|---|---|---|---|---|
| P16-F001 | Opening: an agent can discover and use a user-stored credential without showing its value in chat | Current task plus policy; API list returns metadata only (`api-keys/handlers.js` `list`, `index-table.js` `list`), but no supported agent value-read route was found in the inspected owner | Merge as purpose and boundary under I/002 `## Finding a credential`; explain documented safety policy, not guarantee | High for index; agent retrieval unresolved |
| P16-F002 | What this is: values in macOS Keychain, metadata in SQLite | Current fact: `secrets.js` `ACCOUNT`, `get/set/del`; migration `013`; `db.js` `DB_PATH` | New I/002 `## Current storage and platform status`; say value uses macOS `/usr/bin/security` under `fusion-studio`, metadata uses `fusion.db` `secrets_index` | High from code; encryption-at-rest properties not independently audited |
| P16-F003 | What this is: Electron `safeStorage` will give Linux/Windows parity | Open proposal, not current behavior: `RCC-0094`; current `secrets.js` invokes macOS CLI; active Electron paths searched without `safeStorage` calls | I/002 `## Current storage and platform status` as pending migration, link issue; do not describe interface or platform parity as shipped | High for current gap; future design open |
| P16-F004 | What this is: description carries summary and retrieval hint | Current fact: migration `015_drop_use_when.js`; API backend `validateDescription`, UI description hint | I/002 `## Finding a credential` and metadata table; new prose needed | High |
| P16-F005 | What this is: one value can be captured for a command, cannot survive across commands or enter transcript | Policy/proposal, not technical guarantee. Shell process isolation is contextual; old examples do not prove no logs, argv exposure, response echo or child-process access | I/002 `## Safe use boundary`: values must not be pasted into chat/logs/files; no approved universal retrieval recipe claimed | High for limitation; exact sanctioned agent retrieval is open in `RCC-0094` |
| P16-F006 | How to list: `ROBIN_DB` is exported; query `secrets_index` for JSON rows, not values | Mixed. `startup.js` sets `process.env.ROBIN_DB = DB_PATH`; `db.js` points to `fusion.db`. `harness/child-environment.js` allowlists keys and omits `ROBIN_DB`; OpenCode `index.js` uses that builder at spawn. `index-table.js` `list` is canonical application read | I/002 `## Finding a credential`: show metadata model and UI route; say legacy env name remains server-side but its use inside current harness is not established. Do **not** reproduce executable SQLite recipe | High for default OpenCode path; other spawn variants not exhaustively runtime-tested |
| P16-F007 | How to list: value absent from table, description chooses among names | Current fact from `013`, `index-table.js` columns, `handlers.js` state; no raw value selected | I/002 `## Finding a credential`, new prose | High; metadata exposure still a permission consideration |
| P16-F008 | How to use: `security -a open-robin` and examples for curl, gh, env | Incorrect current identity: `secrets.js` uses account `fusion-studio`; old examples invoke stale account. Command strings also do not prove value stays out of tool results: provider response/logging can reveal it; environment and process args can expose it | Exclude runnable recipes from active article; retain in exact predecessor/LOG only. I/002 `## Safe use boundary` states the need for an approved retrieval mechanism | High for account mismatch and lack of guarantee |
| P16-F009 | How to use: `security` is macOS-only; non-mac agent should explain unavailable backend | Current fact from `/usr/bin/security` call; `RCC-0094` tracks safeStorage design. `secrets.js` error mapping lacks platform-specific treatment | I/002 `## Current storage and platform status`; new prose, with failure steps under `## When lookup fails` | High from code; not tested on non-mac host |
| P16-F010 | Discipline: no echo, tracing, file, chat, ticket, tool-output or generated `.env` containing a value | Documented policy worth retaining; app's current WS diagnostics use `redaction-map.js` `secrets:api-keys:set`, generic ingress logging is value-free, client incoming debug projection is type-only. These are specific safeguards, not universal egress controls | I/002 `## Safe use boundary`; link to relevant security/runtime owner if one emerges; new prose with explicit scope | High for listed inspected paths; no global non-leak proof |
| P16-F011 | Discipline: “refuse anything outside this discipline” | Overbroad policy phrasing; user can intentionally use a credential via a trusted app integration. Existing source gives no authority to forbid every alternative workflow | Replace with “do not ask for/publish the value in chat; explain when a safe route is unavailable” in I/002 `## Safe use boundary` | Medium; product policy may require owner wording |
| P16-F012 | Missing index row or empty `security` output means credential is not stored | Incorrect. Index absence only means no registered metadata row; Keychain `get` distinguishes `NOT_FOUND` (returns null) from locked/access/unknown failures (`SecretsError`). The example suppresses stderr and does not check exit status | I/002 `## When lookup fails`: distinguish unregistered name, missing Keychain item, locked/denied/unavailable store and list/hydration failure | High from code; UI error mapping still incomplete |
| P16-F013 | Missing key instructions: tell expected name, purpose, provider location, add it in top-right key icon; never request paste into chat | User guidance mostly useful. `main.cjs` Tools > Secrets Manager and `useElectronMenu.ts` open globally mounted modal. Key icon exists in `SecretsManagerButton.tsx` but that component is unused in current app. `RCC-0094` notes list hydration gap | I/002 `## When lookup fails`: tell name/purpose, point to provider and **Tools → Secrets Manager**; no chat paste | High for menu path; UI runtime not launched |
| P16-F014 | `name` UPPER_SNAKE_CASE slot/keychain service | Current fact with nuance: `secrets.js` `KEY_PATTERN` allows uppercase letters/digits/underscore, must start letter; API backend validates, UI mirrors | I/002 `## Metadata`, new table; examples may use generic placeholder | High |
| P16-F015 | `description` max 150; `expires_at` Unix ms; warn automatically within week | First two current from backend, migration/schema, UI. Automatic 7-day warning is unsupported: inspected panel renders a date but no threshold/warning, and backend stores timestamp only | I/002 `## Metadata`: state storage/display; omit proactive-warning behavior or mark as future idea | High for inspected path; no whole-app proof of no independent reminder consumer |
| P16-F016 | fingerprint = 12 bullets plus last four, “not sensitive” | Computation current (`fingerprint.js`); absolute sensitivity claim unjustified because suffix can identify a secret or aid matching. It is exposed in list state/UI | I/002 `## Metadata`: describe display/matching aid; treat as credential metadata, not a raw value or blanket public datum | High |
| P16-F017 | Progressive disclosure: one-off, repeated helper, background script | Proposal/policy. `RCC-0094` explicitly leaves safe agent/script retrieval unresolved. A script reading Keychain may be feasible on macOS but requires design/authority and need not be AI-authored automatically | I/002 `## Agent and script workflows`: describe requirement and pending design, not current turnkey recipe; link issue | High for unresolved status |
| P16-F018 | Error and redaction behavior in current implementation | Useful unique replacement context: backend defines `BACKEND_UNAVAILABLE` only for failed rollback; handlers catch only `ApiKeysBackendError`, while raw `SecretsError` bubbles. UI banner is wired to `BACKEND_UNAVAILABLE`; list is triggered only by currently-unused button; server WS map redacts set value. OpenCode diagnostic provider reads configured names/values for exact-value redaction, but provider failure returns `[]` and pattern/path redaction continues | I/002 `## Current limitations` with concise, user-facing status; detailed implementation belongs in `RCC-0094`/code standards, so link rather than duplicate | High from inspected paths; no end-to-end test |

## 4. Proposed destination prose and source metadata

**Proposed new I/002 article** (coordinator may adjust headings to fit neighboring integrated pages):

```markdown
# Secrets Manager

Use Secrets Manager to register manual API keys and tokens by name. Open it from **Tools → Secrets Manager**. Add the value there; do not paste it into chat. Give each entry a distinct uppercase name and a short description of what it is and when it is useful. The description is also the discovery hint when several names are similar.

## Current storage and platform status

The current API-key backend stores values in macOS Keychain under the `fusion-studio` account. `fusion.db` holds the `secrets_index` metadata: name, description, optional expiry, fingerprint and timestamps. Listing entries returns metadata, not values. This backend depends on macOS `/usr/bin/security`. Electron `safeStorage` and cross-platform migration are tracked in [RCC-0094](...); they are not the current storage path.

## Finding a credential

Use the name and description shown by the Secrets Manager to identify the intended slot. Names match uppercase letters, digits and underscores and begin with a letter; descriptions are capped at 150 characters. An absent list entry means the app has no registered index row for that name. It does not prove whether a same-named item exists outside this index. The historical `$ROBIN_DB` variable remains set in server startup, but the current harness child environment does not pass it through, so the former agent-side SQLite command is not a reliable discovery recipe.

## Safe use boundary

Keep credential values out of chat messages, tickets, logs, tool outputs and generated files such as `.env`. The current app redacts the value field in its Secrets Manager WebSocket diagnostic path and lists metadata to the renderer. Those safeguards do not make arbitrary shell commands safe: child process arguments, environment, tracing, failures and provider responses can expose a value. An approved agent/script retrieval interface remains open in RCC-0094. If the available route cannot meet the task's exposure boundary, explain the limitation and ask the user to add or use the credential through the app; do not request the value in chat.

## When lookup fails

Tell the user the expected slot name and purpose. If it has not been registered, point them to the provider's key settings and **Tools → Secrets Manager**. If metadata exists but the value cannot be read, distinguish a missing Keychain item from a locked or denied Keychain and a backend failure. Do not claim the user lacks a credential solely because a command returned an empty result. The current UI's list hydration and backend error mapping are tracked in RCC-0094.

## Metadata

`expires_at` is an optional Unix millisecond timestamp displayed as a date. The current UI does not implement the old page's one-week proactive warning. The fingerprint is twelve bullets followed by the last four value characters; it is display metadata for distinguishing entries, not proof that the suffix is harmless to disclose broadly.

## Agent and script workflows

Repeated and background use needs a reviewed integration or helper that retrieves a value without passing it through a model-visible result or durable file. The current product has no documented, supported cross-platform agent retrieval interface. RCC-0094 owns that design; do not generate a credential-reading helper or assume a shell command preserves the boundary.

## Current limitations

The globally mounted Secrets Manager modal currently does not request a fresh list when opened, and raw Keychain failures are not consistently mapped to the UI's backend-unavailable state. Treat an empty or stale list and a failed lookup as different conditions. RCC-0094 tracks both repairs.
```

The issue link placeholder should be replaced by a verified relative Markdown link at integration time. Suggested exact `metadata.source-files` for this technical article: `fusion-studio-server/lib/secrets.js`, `fusion-studio-server/lib/secrets/api-keys/backend.js`, `fusion-studio-server/lib/secrets/api-keys/index-table.js`, `fusion-studio-server/lib/secrets/api-keys/handlers.js`, `fusion-studio-server/lib/secrets/api-keys/fingerprint.js`, `fusion-studio-server/lib/harness/child-environment.js`, `fusion-studio-server/lib/startup.js`, `fusion-studio-client/src/components/secrets/SecretsManagerModal.tsx`, `fusion-studio-client/src/components/secrets/api-keys/ApiKeysPanel.tsx`, `fusion-studio-client/electron/main.cjs`, `fusion-studio-server/lib/ws/redaction-map.js`. Validate list against final prose and use the actual quoted UTC edit time; no source metadata can be stamped on the untouched predecessor by this agent.

## 5. Exclusions and historical record

- Remove the current-product name **Open Robin**, `open-robin` Keychain account and top-right key-icon instruction from active guidance. Current implementation is Fusion Studio with `fusion-studio` account and Tools menu. The exact historical page and `LOG.md` preserve the earlier recipe.
- Do not copy the command blocks. The account is wrong; `$ROBIN_DB` is not passed to the current default harness child; the examples assume silent capture and safe provider output without proving either. `echo "$TOKEN" | ...` also clashes with the page's blanket “never echo” wording even though it pipes rather than prints to the tool result.
- Do not claim that missing metadata or empty command output proves absence, that fingerprint suffixes are categorically non-sensitive, that week-before-expiry warnings run, or that a `safeStorage` interface has shipped. Preserve those claims in the predecessor history only, with corrections in its successor route.
- Do not duplicate the old page's broad policy as an enforcement guarantee. The app has specific redaction paths; it does not have an audited universal protection for every script, shell, provider response, log or future integration.

## 6. Incoming references and coordination

- **Three active wiki body links** to this exact old page: `002-System_Tools/PAGE.md` (root tools index), `002-System_Tools/000-System_Tools/PAGE.md` (heading article), and `004-Integrations_And_Tools/PAGE.md` (migration source). The two Tools pages share navigation ownership with PAGE-14; keep a successor route in the source until both are reconciled.
- **One active issue path reference**: `ai/RC-MacAir-15/Issues/inbox/RCC-0094.md`, which deliberately points to the old article as documentation cleanup work. Its canonical bug scope remains valid; do not edit ticket state as part of this page investigation. The issue board's ticket body also discusses the feature without that explicit Markdown path.
- **One runtime view-state file with two recorded old-page entries**: `ai/RC-MacAir-15/System/Views/004-wiki-viewer/state/state.json` contains the old page ID/path twice. It is out-of-scope runtime state; preserve the route for those saved tabs until retired by the separate pass.
- **Shipped templates** retain old source links and a copied old article in `System_Manager/ai-template/Wiki/` (also `ai-v2` historical machine copy). They are outside this pass. `002-System_Tools/003-Clipboard_History/PAGE.md` mentions Secrets Manager semantically but has no path link; coordinate eventual destination navigation with PAGE-17. No broken relative Markdown slug to this existing source was found; the proposed successor path is currently absent, so links to it must wait for article creation.
- Shared destination: `004-Integrations_And_Tools` with PAGE-06 GitLab and PAGE-09 Screenshot Capture; PAGE-14 owns old Tools navigation. Runtime redaction details may overlap Events/Ledger and Chat diagnostic documentation; keep only the Secrets Manager user boundary here and link to their authoritative contract if added.

## 7. Open questions and recommended treatment

1. **Researchable code fact:** Does a current non-default harness path expose `ROBIN_DB` through another launch mechanism? The inspected production child builder strips it for OpenCode and other listed adapters. Recommend state only that the old recipe is unreliable for the current default route; do not infer universal absence.
2. **Implementation work, not a documentation decision:** How should scripts/agents safely retrieve a value after the planned `safeStorage` migration, and how should Keychain errors become `BACKEND_UNAVAILABLE`? `RCC-0094` owns these gaps. Recommend describing current limitations and linking that issue; do not invent a replacement command.
3. **Implementation work:** The global modal does not call `listApiKeys()` on open; only unused `SecretsManagerButton` does. Recommend document the current list-hydration limitation briefly rather than implying a reliable list in every new session. `RCC-0094` already tracks repair.
4. **No indispensable owner decision for this migration:** Existing owner direction is sufficient to route verified facts and label the unresolved retrieval design. A new permission or exposure policy would require a product decision outside this documentation pass.

## 8. Retirement readiness

**Ready for a short successor route after the destination is created and verified**, with the historical original preserved by an exact `.versions` predecessor. Keep the old file physically present because two Tools navigation paths, the Integrations migration link, the issue and saved wiki-view state still refer to it. Physical deletion belongs to the later retirement pass after navigation and saved-state dependencies are handled. No wiki, issue, template, runtime file or secret value was changed by this agent.
