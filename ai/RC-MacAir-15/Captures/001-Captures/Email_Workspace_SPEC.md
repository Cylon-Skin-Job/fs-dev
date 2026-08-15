# Email Workspace — SPEC

**Status:** Living planning document — Phase 1 (mockup) feeds decisions back into this spec
**Created:** 2026-07-05
**Origin:** Planning conversation over `fusion-local-pim-core.md` (external architecture sketch, corrected and adapted to fs-dev reality)

---

## Product Stance

Email becomes a first-class surface inside Fusion Studio. Fusion owns the mailbox: full local copy in SQLite, provider accounts are sync endpoints. No dependence on local mail apps (no Apple Mail connectors, no platform-specific bridges) — protocol-only connections so one codebase runs identically on macOS, Windows, and Linux.

The mail data is the substrate for AI/agent work later: local copy means grep/search/logic across the database works offline and fast.

---

## Decisions — Locked

### Identity & Placement

- Email is a **new workspace type** (server-side change; workspace types already exist via migration 019).
- Lives in the **Fusion Home** workspace context; UI cloned from the existing **Office view** layout (~80% reusable per user).
- Layout: **25/75 split** — left sidebar is the folder list (`li` items: Inbox, Sent, etc.), right is the reading/view area.
- **Search** composes from the existing search system, extended with mail-specific bits.
- **Account avatar upper-right** with a dropdown for multiple email addresses. Multi-account from day one. "Add account" lives in this dropdown.
- View capsule contains **no content folders** — all message content lives in SQLite.

### Label Model (folders are labels)

- GUI presents **folders**; the engine treats them as **labels**. A message can carry many labels and appear in many folders.
- System labels: `inbox`, `sent`, `snoozed`, `drafts`, `trash`, `outbox`. **No label = archive.**
- Users create folders freely = user labels. Add/remove without limit.
- **There is no "move" — only label transitions.** UI "move to X" = remove current folder's label + add X. Archive = remove `inbox`. Delete = add `trash`; hard-purge after 30 days via scheduled trigger.
- `snoozed` is the one system label with behavior: label + server-side timer. Timer fires → remove `snoozed`, restore `inbox` (`on-wake` trigger).
- Fusion's custom labels are **local-only** — providers never learn about them.
- Gmail bonus: `X-GM-LABELS` imports the user's existing Gmail labels on ingest, so the folder sidebar arrives pre-populated with their real taxonomy.

### Kernel & Stack

- **ImapFlow** (IMAP, MIT) + **Nodemailer** (SMTP send, MIT) + **Mailparser** (MIME, MIT). In-process inside fusion-studio-server — no separate service, no Redis.
- **EmailEngine rejected:** $995/year commercial license + Redis dependency; built for multi-tenant SaaS, wrong weight class for a single-user local-first app.
- Code lives in `fusion-studio-server/lib/mail/` following the `lib/calendar/` pattern: per-provider adapters under a neutral index, opt-in via background-services config, wrapped in `runSafely`.
- Reuses existing infra: fusion.db migration system, secrets/keychain layer, event ledger, background-services framework, sync-watcher patterns.

### Providers & Auth

Day one: **iCloud, Gmail, Outlook.** Later: **Proton** (via Bridge, requires paid Proton plan; presents as localhost IMAP — just a provider preset).

| Provider | Transport | Auth | Notes |
|---|---|---|---|
| iCloud | IMAP/SMTP | App-specific password (in-app form) | Generated at appleid.apple.com. No OAuth, no browser. This IS "Apple Mail support." |
| Gmail | IMAP/SMTP | App password (in-app form; account needs 2FA) | OAuth deliberately skipped in v1 (own GCP project + weekly token expiry for unpublished apps). `X-GM-THRID` gives free threading; `X-GM-MSGID` gives stable IDs; SMTP send auto-saves to Gmail Sent. |
| Outlook | IMAP/SMTP | **OAuth2 mandatory** (XOAUTH2) | Microsoft killed basic auth + app passwords for IMAP (late 2024). Requires Azure app registration. |
| Proton (later) | localhost IMAP/SMTP via Bridge | Bridge-provided credentials | Provider preset only. |
| Generic IMAP | IMAP/SMTP | Credentials form (host/port/user/pass) | Fastmail, custom domains, etc. |

**OAuth flow (Outlook, and canonical for any future OAuth provider):**

- Canonical: **system browser + loopback redirect** (`http://127.0.0.1:<port>/callback` caught by fusion-studio-server) + **auto-refocus** Fusion the instant the token lands. One-time per account; refresh is silent thereafter.
- Nicer path to attempt for Microsoft specifically: embedded Electron popup window hosting the consent page (Microsoft permits embedded contexts; test with real account, ship with loopback as fallback). Risk: enterprise Conditional Access configs can misbehave embedded.
- **Google blocks OAuth in ALL embedded Electron surfaces** (webview tag, BrowserView, popup BrowserWindow → `disallowed_useragent`). iframe is a guaranteed no. **No user-agent spoofing** — fragile and against policy.
- Credentials and tokens stored in the existing secrets/keychain layer. Sign-in UI is owned by Fusion.

### Sync — Bidirectional, Minimal Verbs

- Push back to provider: **read state, archive (inbox add/remove), trash.** Nothing else. Custom labels stay local.
- Rationale: user still opens provider apps on phone; without push-back the provider mailbox drifts into chaos while Fusion stays clean.

### Offline — Outbox + Ops Queue

- **Outbox pattern:** "Send" never touches the network. Send = draft transitions to `outbox` state; background worker drains it when online (SMTP send → apply `sent`, fire `on-send`; repeated failure → back to drafts, fire `on-send-failed`, surface error in UI).
- **Undo send falls out free:** outbox items ineligible for pickup for 30 seconds; undo = pull back to drafts.
- **`pending_ops` table:** every push-back action (read/archive/trash) writes locally first (instant UI), appends an op row (account, verb, target, timestamp). Sync worker replays in order when online.
- **Stable identity rule:** ops reference messages by Message-ID header / Gmail `X-GM-MSGID` — **never IMAP UIDs** (UIDVALIDITY can invalidate them). Current UID resolved at replay time. This single rule prevents an entire class of sync bugs.

### Conflicts

- Messages are immutable — only flags, labels, and existence change. Resolution: **last-writer-wins per flag; delete beats everything.** No merge UI needed; worst case is an archived message reappearing once.
- **Drafts (the one mutable object): sync to provider Drafts folder, last-write-wins, with "conflicted copy" fallback** when both sides changed. (User's chosen option over local-only drafts.)

### Triggers

Trigger folders live inside the view capsule; user drops `.js` files in; the server executes them on the matching event. Trigger context gets the message plus a label API ("parse literally anything, apply/remove labels").

**Vocabulary:**

| Trigger | Fires when | Type |
|---|---|---|
| `on-receive` | Message ingested, before first render | **Interceptor** — may mutate labels pre-display (the core filing use case) |
| `before-send` | User hits send | **Interceptor** — may modify or cancel (signature injection, "you wrote 'attached' but no attachment") |
| `on-send` | SMTP send succeeded | Observer |
| `on-send-failed` | Send gave up / bounce | Observer |
| `on-draft` | Draft created/updated | Observer |
| `on-label-change` | Any label transition (covers move, archive, snooze, user labeling) | Observer |
| `on-delete` | Trash applied / purge | Observer |
| `on-read` | Message opened | Observer |
| `on-wake` | Snooze timer fires | Observer (system restores `inbox`) |
| `on-attachment` | Attachment extracted | Observer — bridge to OCR/Marker pipeline |
| `on-sync` | Sync cycle completed (batch of new messages) | Observer |
| `on-schedule` | Cron-style, not message-bound (daily digest, trash purge) | Observer |
| `on-account-connected` | Account added | Observer — kicks off backfill |

**Design rule:** only `on-receive` and `before-send` are interceptors; everything else observes and cannot block. **Mandatory guardrail:** any trigger that can send mail gets auto-responder loop protection (never auto-reply to bulk / `Auto-Submitted` / `Precedence: bulk|list` mail).

### Backfill

- Recent window first (~12 months, full bodies), then **trickle-backfill the rest in the background** until the full mailbox is local. First draw is allowed to take its time.

---

## Open Questions (not yet decided)

1. **Storage layout** — same `fusion.db` vs separate `mail.db` (lean: separate — mail is high-churn and large; keeps backup/vacuum independent). Raw `.eml` retention? Attachment store location + content-addressing? When does FTS indexing run?
2. **HTML rendering security** — sanitizer choice, remote-image/tracker policy, iframe sandboxing for message bodies. The one real attack surface in the app; deserves its own session.
3. **AI/agent access boundaries** — can the harness read mail? Send? What tool surface (`mail.search()` etc.), and when?
4. **Search integration specifics** — which hooks into the existing composable search, what mail-specific facets.
5. **Threading UI** — Gmail threads are free (`X-GM-THRID`); generic IMAP threading (References/In-Reply-To) is real work. Thread list vs flat message list for v1?
6. **Icons, visual details, feature list of the view** — to be discovered in Phase 1 mockup iteration and pulled back into this spec.
7. **Trigger context API surface** — exact shape of the object handed to trigger JS (message, label ops, send ops?, search?, log).

---

## Build Phases

### Phase 1 — Workspace type + UI mockup (CURRENT)

- ✅ **2026-07-05: email-viewer created as full clone of office-viewer.** Client: `src/components/email/` (Office→Email rename, `rv-email-*` classes, panel id `email-viewer`), registered in ContentArea/types/viewSlice/viewFolders. Server: registered in view-folders.js, mutationPanels, views/index.js fallbacks. Fusion-Home capsule: `Views/007-email-viewer/` (icon: `mail`, content root `ai/${machine}/Email`). Client build + all server tests pass.
- ✅ **2026-07-05: sidebar menu is now the mail menu.** Items (Material Symbols icon → label): `inbox` Inbox, `kid_star` Starred, `chronic` Snoozed, `send` Sent, `schedule_send` Scheduled, `edit_document` Drafts, `report` Spam, `delete` Trash. Divider, then a "Folders" section header (no icon, inset, larger than items) with stub label-folders Banking + Client Email (visual selection only; move to SQLite with the mail schema). Default selection = Inbox; header title follows selection. Note: menu adds **Spam** and **Scheduled** to the system-label vocabulary (spec's original list had inbox/sent/snoozed/drafts/trash/outbox) — fold into the label model in Phase 2. REVISION 2026-07-06: compose-only **New** button gets explicit vertical breathing room between the `Email` title and the mail menu list.
- ✅ **2026-07-05: mail surface replaces the document grid.** Title row ("Inbox" etc.) is gone in mail modes, replaced by a thin Gmail-style toolbar: `check_box_outline_blank`+`arrow_drop_down` (compound select unit, zero gap, pushed left) `archive` `report` `delete` | `mark_email_unread` `schedule` `kid_star` `folder_check` (labels+folders combined — later a dropdown select/unselect list) | `add_task` `calendar_add_on`. All stubs; 16px icons in 28px hover targets, 6px gaps, bottom border spans the panel edge to edge. (Note: user wrote `child_star`; that icon doesn't exist in the local set — `kid_star` used, matching the sidebar.) Content below splits 25/75: message list left, reading pane right. 12 fake messages in `emailFakeData.ts`, filtered by sidebar mode (Starred filters the starred flag); unread bold, folder chips, Reply/Forward stubs. New files: EmailToolbar, EmailMessageList, EmailReadingPane, EmailSurface (+CSS), emailFakeData; EmailViewerHeader gained a `toolbar` slot. The cloned doc-grid machinery (recent/starred docs, folder grid, editor) is now unreachable from mail modes but intact — decide its fate (esp. editor reuse for drafts/compose) before deleting.
- ✅ **2026-07-06: message-level reading actions revised.** Removed the star action from the thin message-list toolbar. Reading pane metadata row now places `star`, `reply`, and `more_vert` immediately to the right of the message time/date; no smiley/react action in that row. Ellipsis opens a Gmail-style paper menu with: Reply, Forward, Delete, Mark as unread, Print, Download Message, Send to Chat. All actions remain Phase 1 stubs.
- ✅ **2026-07-05: floating-window extraction + compose windows.** Extracted `useFloatingWindow` hook (drag/resize mechanics; live geometry local during gesture, ONE commit on mouse-up — fixed the chat popup's per-mousemove `state:set` write amplification). SecondaryChat refit onto the hook; genie animation and stoplight chrome untouched — **stoplights are exclusively a chat paradigm.** Compose windows: `composeStore` (session-only keyed collection, click-to-front z-order, geometry deliberately NOT persisted), `EmailComposeWindow` (upper-RIGHT controls: `check_indeterminate_small` minimize / `expand_content`↔`collapse_content` / `close`; expand fills the ENTIRE email view — covers sidebar menu, search bar, everything, not just the content panel — and collapse returns to the exact prior geometry; minimize remembers open-vs-expanded), `EmailComposeLayer` (overlay inside content panel; cascades new windows from lower-right; Gmail-style bottom tab strip for minimized windows with restore + close). Multiple simultaneous compose windows supported. Sidebar **New button now opens compose** (office New-dropdown removed from email view; create-modal machinery dormant pending doc-grid fate decision). Send is a stub that closes the window. No FloatingWindow shell component yet — chat keeps bespoke chrome, compose builds on the hook directly; extract a shell when a third window type appears (standards: second consumer rule).
- ✅ **2026-07-05: paper surfaces.** Reading pane + compose windows render as muted white "paper" using the office thumbnail heuristic: `--rv-email-paper: color-mix(in srgb, #faf9f6 84%, var(--rv-email-content-fill) 16%)` — warm white pulled slightly toward the theme's content fill so dark mode mutes the paper. Dark ink tokens (`--rv-email-paper-ink`, `-ink-soft`, `-line`) for text/borders/chips on paper. Message list stays on dark chrome; minimized compose tabs stay dark (they sit on chrome, not paper). ADOPTED same-day: paper brightness extracted to a composable `PaperBrightnessControl` (components/PaperBrightnessControl.tsx — brightness_6 button + light_mode slider dropdown; value/onChange props, no store imports, portable per standards). Email is the second consumer: control sits upper-right of the mail toolbar strip; `emailPaperBrightness` persists per-view like office's; mute overlay (`--rv-email-paper-mute-alpha`, same 0→0.1 alpha ramp via `officePaperMuteAlpha`) layers over both reading pane and compose paper. Office refit DONE (2026-07-05, after office work settled): OfficeDocumentToolbar now consumes the shared component via its controlled mode (`open`/`onOpenChange` preserves the two-way margins-menu mutex; `buttonClassName` keeps office toolbar button styling). Component supports uncontrolled (email) and controlled (office) use. Dead inline slider CSS deleted from OfficeDocumentPage.css; placement (e.g. `margin-left: auto`) is the consumer's job, not the component's. Also removed the 10px gap between the toolbar strip and the message list (toolbar now sits flush). SAME-DAY REVISION: brightness control moved OUT of the toolbar strip into the reading pane's upper-right corner actions — `print` | brightness (`brightness_6`) | `expand_content` — dark-ink styled on paper (via buttonClassName override) so users notice it. Expand fills the entire email shell like compose expand, but with collapse as the ONLY window control (no minimize tab, no close). Expanded pane z-index 25, below compose layer (30) so compose windows stay on top. Print is a stub. Expanded state is session-only in EmailSurface.
- ✅ **2026-07-06: reading-pane corner actions expanded.** All selected emails show `link_2` and `chat_paste_go` immediately to the left of `print`, followed by brightness and expand/collapse. Link and Send to Chat remain Phase 1 stubs until message identity/chat attachment payloads exist.
- ✅ **2026-07-06: expanded reading pane header.** When an email is expanded/full-size, the top of the overlay mirrors the inbox action toolbar but omits the checkbox/select compound unit. The same `EmailToolbar` component now supports `showSelect=false` for this mode.
- ✅ **2026-07-06: message list row affordances.** Each message row now has a visible checkbox column on the left. Hover/focus reveals row actions on the right, replacing the timestamp visually: `archive`, `delete` (Trash), `mark_email_unread`, `schedule` (Snooze). These are Phase 1 stubs. Hover-action backing uses two fills: the original list chrome fill for non-selected hover rows, and a single opaque selected fill for already-selected rows so the row and upper-right action strip match exactly without double-compositing.
- ✅ **2026-07-06: account avatar + multi-address dropdown.** Search row now has an upper-right account switcher (`EmailAccountSwitcher`) beside the search field, with a `home_storage_gear` settings icon immediately to its left. Clicking the settings icon opens a full email-shell popover that covers the sidebar/search/menu area like an expanded email, slides up from the bottom, and is titled **Rules and Automations**. The popover header uses a centered search bar in the top row with the `close` button at upper right; the title sits in a lower row with no summary text. No trigger tabs are shown. The left nav is: Filters, Scripts, Agents, Tickets, divider, Templates, History. Phase 1 data lives in `emailFakeData.ts` as fake accounts (iCloud/Gmail/Outlook), with session-only selected account state. The trigger is a circular initials avatar + `arrow_drop_down`; dropdown lists accounts with name/address/provider/unread count/checkmark and a stub **Add account** action at the bottom. No account persistence, auth, filtering, or protocol behavior yet — this is visual/interaction scaffolding for the Phase 2+ account model. Local icon check: `expand_more` is missing from the bundled Material files, so the existing verified `arrow_drop_down` symbol is used.
- ✅ **2026-07-06: trigger placeholder moved to machine System.** The live Fusion-Home trigger placeholder now lives at `ai/RC-MacAir-15/System/triggers/README.md`, not inside `Views/007-email-viewer/`. Trigger files remain placeholders until the mail trigger runner lands.
- ✅ **2026-07-06: Rules and Automations file-editor mock.** The Rules and Automations popover detail pane now mocks the intended GUI for editing System automation artifacts: the old left sidebar is gone; the list header has a four-button bar (`Triggers`, `Scheduled`, `Incoming`, `Templates`) plus a search icon that expands into an overlay search field over the buttons. Each section opens a row-based asset list first (Name, Status, Apps, Location, Updated, actions), and clicking a row opens the editor for that artifact. The open-file view removes the list search/top buttons and replaces the header with **Name** in bold plus a 70-character description preview. The editor toolbar keeps the filepath/name left-justified, removes tags, and exposes **Test run**, **Save**, and more actions. The lower editor surface is an inset, rounded dark 2/3 + 1/3 workspace; the centered 400px static name/description card uses wiki document color/text tokens, and the right detail pane is blank. This is visual scaffolding only; no filesystem read/write is wired yet.
- Next mockup steps: compose polish (Reply/Forward opening prefilled compose), snooze/schedule affordances, then wire toolbar actions to label transitions when the schema lands.
- Idea captured (user): reuse the folder logic for a "settings" area inside the view to click and view the trigger JS automations.
- **Stubs and fake data throughout:** fake accounts, fake folders (system + a few user labels), fake messages/threads. No protocol code, no real accounts.
- Purpose: iterate look/feel; every icon/feature/layout decision made here gets pulled back into this spec.

### Phase 2 — Storage + label engine

- Resolve open question #1; write migrations; message/label/account schema; label-transition engine; trigger runner skeleton with `on-label-change`.

### Phase 3 — Ingest (Gmail first)

- ImapFlow adapter, app-password auth form, backfill worker (window + trickle), `on-receive` pipeline, FTS indexing.

### Phase 4 — Send path

- Compose UI, outbox worker, Nodemailer SMTP, undo-send window, drafts sync (LWW + conflicted copy), `before-send`/`on-send`/`on-send-failed`.

### Phase 5 — Push-back sync

- `pending_ops` queue + replay worker, read/archive/trash propagation, conflict rules, stable-ID resolution.

### Phase 6 — Providers & triggers build-out

- iCloud preset, Outlook OAuth (loopback + embedded attempt), full trigger vocabulary, `on-schedule` cron, snooze timers.

### Later

- Proton Bridge preset, agent tool surface, auto-linking messages to clients/projects, HTML compose polish.

---

## Reference Facts (verified 2026-07-05)

- EmailEngine license: $995/year, self-hosted, Redis required — https://learn.emailengine.app/docs/licensing
- ImapFlow: MIT, async/await, auto-handles IDLE/CONDSTORE/QRESYNC, Gmail labels/raw search — https://github.com/postalsys/imapflow
- Microsoft ended basic auth + app passwords for Outlook.com IMAP (Sept 2024) → OAuth2/XOAUTH2 only.
- Google OAuth rejects embedded webviews (`disallowed_useragent`); native-app pattern is system browser + loopback redirect with PKCE.
- Gmail IMAP extensions: `X-GM-THRID` (thread ID), `X-GM-MSGID` (stable message ID), `X-GM-LABELS` (labels on the wire).
