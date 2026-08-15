# Email Workspace — Session Handoff

**Date:** 2026-07-05
**Companion doc:** `Email_Workspace_SPEC.md` (same folder) — the living spec. Read it first; it has every decision with rationale. This file is the "where we physically are" snapshot.

---

## What this project is

Building a full email client inside Fusion Studio (fs-dev repo), planned collaboratively with the user. Fusion owns the mailbox: full local copy in SQLite, ImapFlow/Nodemailer under the hood (EmailEngine rejected — $995/yr + Redis), providers are sync endpoints (iCloud + Gmail via app passwords, Outlook via OAuth loopback; Proton later). Labels-presented-as-folders (no label = archive), machine-scoped trigger artifacts under `ai/<machine>/System/triggers/`, outbox + pending_ops offline model. All in the spec.

**Current phase: Phase 1 — UI mockup with fake data.** No protocol code, no schema yet. The user iterates on the UI, decisions get pulled back into the spec.

## State of the build (all working, verified in-app)

- `email-viewer` view exists: full clone of office-viewer, registered client + server + Fusion-Home capsule (`ai/RC-MacAir-15/Views/007-email-viewer/`, icon `mail`, content root `ai/${machine}/Email`). Trigger placeholders moved out of the email view capsule; live machine-scoped triggers now live under `ai/RC-MacAir-15/System/triggers/`.
- Sidebar: mail menu (Inbox/Starred/Snoozed/Sent/Scheduled/Drafts/Spam/Trash with Material icons) + "Folders" section header + stub folders Banking, Client Email. New button opens compose.
- Content: thin Gmail-style toolbar (select+arrow compound unit, archive/report/delete | unread/snooze/folders | add_task/calendar; 16px icons, edge-to-edge border, flush against list). Below: 25/75 message list / reading pane, 12 fake messages in `emailFakeData.ts` filtered by sidebar mode.
- Message list rows have a visible left checkbox and hover/focus actions on the right: archive, trash, mark unread, snooze. Hover-action backing uses the original list chrome fill for non-selected rows and one opaque selected fill for selected rows, preventing the upper-right action strip from double-compositing lighter than the selected row. Actions are visual stubs.
- Reading pane + compose render as muted white paper (office thumbnail heuristic: `color-mix(in srgb, #faf9f6 84%, content-fill 16%)`), dark ink tokens.
- Reading pane corner actions (upper right, dark ink): `link_2` (stub) | `chat_paste_go` Send to Chat (stub) | `print` (stub) | brightness dial | `expand_content`. Expand fills the ENTIRE email shell (sidebar, search, everything); expanded mode adds the inbox-style action toolbar at the top, minus the checkbox/select compound unit. Expanded z=25, compose layer z=30 (compose floats above).
- Reading pane message meta row has message-local actions to the right of the time/date: `star`, `reply`, `more_vert`. Ellipsis menu: Reply, Forward, Delete, Mark as unread, Print, Download Message, Send to Chat. No smiley/reaction control in that row.
- Compose: multiple floating windows (`composeStore`, session-only geometry, click-to-front), upper-RIGHT controls `check_indeterminate_small` / `expand_content`↔`collapse_content` / `close`; minimize → Gmail-style bottom tab strip with restore/close. Expand = whole shell. Stoplight buttons are chat-only, never compose.
- Account avatar + multi-address dropdown now sits upper-right in the email search row (`EmailAccountSwitcher`), with a `home_storage_gear` settings icon immediately to its left. Clicking the settings icon opens a full email-shell popover that covers the sidebar/search/menu area like an expanded email, slides up from the bottom, and is titled **Rules and Automations**. List header layout: search icon upper left, four-button top bar (`Triggers`, `Scheduled`, `Incoming`, `Templates`), close button upper right, title in a lower row, no header border, no summary text. Tapping search opens an overlay search field over the top buttons. Each top section opens a row-based asset list first (Zapier-style table). Clicking a row opens a trigger editor view that removes the list search/top buttons; the top header becomes **Name** in bold plus a 70-character description preview, the editor toolbar keeps only the file path/name on the left, and actions include **Test run**, **Save**, and more. The lower editor surface is an inset, rounded dark 2/3 + 1/3 split; the left canvas holds a centered 400px static card using wiki document color/text tokens, and the right detail pane is blank for selected-card details. No raw trigger text editor is shown. Fake iCloud/Gmail/Outlook accounts live in `emailFakeData.ts`; selection is session-only; dropdown includes account rows with unread counts/checkmark plus stub Add account. `arrow_drop_down` used because local Material files do not include `expand_more`.
- `useFloatingWindow` hook extracted (`src/hooks/useFloatingWindow.ts`): drag/resize with live-local-geometry, ONE commit on mouse-up — this also fixed SecondaryChat's per-mousemove state:set flood. SecondaryChat refit, genie animation untouched.
- `PaperBrightnessControl` extracted (`src/components/PaperBrightnessControl.tsx`): shared by email reading pane AND OfficeDocumentToolbar (controlled mode preserves office's margins-menu mutex; buttonClassName overrides styling). Office's inline slider + dead CSS deleted. Email persists `emailPaperBrightness` per-view.

## Key files

**Email components** (`fusion-studio-client/src/components/email/`): EmailGrid.tsx (shell/routing — still contains dormant office doc-grid machinery), EmailToolbar, EmailSurface, EmailMessageList, EmailReadingPane, EmailAccountSwitcher, EmailComposeLayer, EmailComposeWindow, composeStore.ts, emailFakeData.ts, + CSS files.
**Shared:** `src/hooks/useFloatingWindow.ts`, `src/components/PaperBrightnessControl.{tsx,css}`.
**State:** `emailViewer*` + `emailPaperBrightness` keys in `types/index.ts` + `viewSlice.ts` defaults.
**Server:** `lib/views/index.js` (Email fallbacks), `lib/view-folders.js`, `lib/ws/workspace-request-handlers.js` (mutationPanels).
**Capsule:** `~/projects/Fusion-Home/ai/RC-MacAir-15/Views/007-email-viewer/` + `~/projects/Fusion-Home/ai/RC-MacAir-15/Email/`.

## Session rules that matter (also in Claude's memory)

- After ANY fs-dev change: run `~/projects/fs-dev/restart-fusion.sh` automatically (kills, rebuilds, relaunches, prints URL). Paste the URL for the user.
- Planning = real chat dialogue, never AskUserQuestion, surface the full decision inventory.
- Material Symbols are LOCAL: font via npm package; SVGs at `~/projects/Fusion-Home/material-symbols/{style}/`. Verify icon names against that folder before using (`child_star` didn't exist → used `kid_star`).
- Spec updates: every UI decision made during mockup iteration gets appended to the spec's Phase 1 section.

## Uncommitted / repo state

NOTHING from this session is committed. fs-dev worktree is heavily dirty and includes OTHER instances' work (System_Manager templates, office paper-brightness feature, issues/wiki churn). Do NOT blanket-commit; if asked to commit email work, stage only the files listed above.

## Open questions (spec has full detail)

1. Storage layout — fusion.db vs separate mail.db (lean: separate); raw .eml retention; attachment store; FTS timing.
2. HTML email rendering security — sanitizer, remote-image policy, sandboxing. The big one before real mail ever renders.
3. AI/agent access boundaries to mail (read? send? tool surface?).
4. Search integration specifics with the existing composable search.
5. Threading UI (Gmail X-GM-THRID is free; generic IMAP threading is work).
6. Trigger context API shape.
7. Fate of the dormant office doc-grid machinery inside EmailGrid.tsx — user floated reusing the folder logic for a "settings" area exposing the trigger JS automations; also the markdown editor might serve drafts/compose. Decide before deleting.
8. System-label vocabulary: menu added Spam + Scheduled beyond the spec's original list; Starred is arguably a flag not a label. Fold into Phase 2 schema.

## Likely next steps (user drives)

- Reply/Forward opening prefilled compose.
- More mockup polish per user's eye, then Phase 2: storage decision → migrations → label engine → trigger runner.
