# Office & Home Suite — Bookkeeping, Contacts, CRM, Social Glass

Status: CAPTURE — app roadmap riff; sequencing loose except document viewer → email first
Captured: 2026-07-13

## Sequence

1. **Document viewer** (in progress) — logic carries forward to everything below.
2. **Email plugin** — install and chew on it for a weekend.
3. **Calendar** — ride the email auth: if Google, one OAuth consent carries Gmail + Calendar (+ Drive) scopes on the same token; add scopes incrementally, one consent screen. Microsoft Graph works the same. One auth flow, three doors. No separate auth needed.
4. **Bookkeeping app** (wireframing now) — third build.
5. **Home contacts app** — the consumer sibling.

## Bookkeeping — Third Build

History:
1. Frontend with a mock database (pre-Firebase understanding).
2. Pieces hobbled together on Google Apps Script to manipulate email and calendar. Felt brittle.

Realized at the start of this project it would one day roll into the platform. **Why the third build works where two died:** the first had no real backend; the second glued integrations to that one app. This time email/calendar/contacts/iMessage land at the **platform** level once, and the bookkeeping app is a view over shared substrate — it can't be brittle about email because it never touches email; it reads person-scoped projections. (Thin client doctrine paying off.)

Plan: lay it out as wanted → grab the master spreadsheet off Google Drive → show it the schema. Adding CRM-type features.

## Home Contacts App

The more home-oriented side, with a handful of CRM-type features:

- Birthdays and events; notes applied to people; a calendar inside.
- See what you've done, when you've called — keep track of how well you're doing with your friendships.
- Plan ahead: start looking for a present **four weeks** ahead instead of four days.
- **Local model** so it's not creepy. It doesn't have to be smart — notes, reminders, and basic to-do tracking is orchestration, not intelligence. Harness abstraction (any CLI, any key) means a local model slots in without special plumbing. Friendships never leave the machine.

### Starred Contacts → Profiles

It's just a contacts app — but starring someone asks: *"Do you want to save a profile? Keep basic information so your AI can help you stay aware?"* Announce-before-recall as an onboarding gesture: memory is an explicit, per-person grant. The ethical design and the only design that won't feel creepy.

## Notes — The Cross-App Substrate

One big notes app with categories — and the same notes surface inside the CRM in bookkeeping, inside contacts profiles, attached to plans. One notes store, many views; the content type carries across apps (platform vision: everything is a content type).

## The Person Is the Join Key

The core product insight: texts, emails, missed phone calls, notes — **by person**. "30 phone calls last week — let me see them by person." A materialized view keyed on a human being. The customer view (bookkeeping/CRM) and the friend view (contacts) are the same query against the same substrate with different theming. Contacts attach inside the bookkeeping app as well as plans.

Integration notes:
- **iMessage:** local SQLite at `~/Library/Messages/chat.db`, readable with Full Disk Access — genuinely tractable, and fits the local-and-private stance. Customer texts visible in the customer view; friend texts in the friend view.
- **Email / missed calls:** platform-level, per-person projections.

## Social Glass Panes

Embed the service's own web app in the contact card so the user can log into Instagram right there, leaving a pane open to that person's message stream (the Franz/Rambox/Ferdium model).

- **Not literally an iframe** — social sites send `frame-ancestors`/`X-Frame-Options` that block framing. In Electron use a **WebContentsView** (or `<webview>`): an embedded browser, headers don't apply. Persistent **session partition** → login survives restarts. Instagram DMs deep-link (`instagram.com/direct/t/<thread-id>`) so a starred contact's card opens onto that person's stream. Same trick: WhatsApp Web, Messenger, LinkedIn.
- **Glass, not data.** The pane is for human eyes. The AI never reads the webview's DOM — that would be scraping (ToS trouble) and would ingest the friend's side of a conversation without their knowledge. If the user wants something remembered, they copy it into a note: announce-before-recall performed by a human hand. Nothing enters the second brain without the user physically carrying it across.
- The card ends up tiered like the whole architecture: local structured data (notes, calls, iMessage) the AI can use; live external glass it can't. Visible together, never mingled.

## Platform Stance — Hooks, Not Scrapers

The platform ships glass and general hooks. If someone builds an extractor, it's a registered federation app in its own data container, behind its own config-with-toggles consent, filing tickets that fail unless something chose to receive them (`../012-App_Federation/app-federation-and-ticket-boundary.md`). The creepiness has a name, an owner, an audit trail, and an uninstall button. Enforcement constrains the AI mechanically; the user is trusted on their own machine — the browser-extension / Full-Disk-Access deal: visible grant, scoped capability, responsibility transferred at the toggle.

## Relationships

- Second brain (profiles are person-scoped artifact stores): `../014-Second_Brain_Chat/second-brain-chat-vision.md`
- Federation/ticket boundary (plugin containment): `../012-App_Federation/app-federation-and-ticket-boundary.md`
- Consensus mode (linked HTML artifacts as the universal content type): `../015-Consensus_Mode/consensus-mode.md`
- Platform vision: home office suite on shared content types (email, docs, sheets, calendar, brochures).
