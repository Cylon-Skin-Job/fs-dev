# DECISIONS — CSS UI Changes

> Durable owner decisions stated by RC. Proposals remain in `PROPOSALS.md`; an approved proposal links back here so decision authority is not duplicated.

## Process and Schema

### D-1 — Establish the original working folder

- **Date:** 2026-08-09
- **Category:** process
- **Status:** superseded
- **Source:** RC statement in the primary chat
- **Superseded by:** D-10, D-11, D-14
- **Decision:** Use `020-CSS_UI_Changes` as the working area. It originally began with CAPTURE, VISION, ISSUES, DECISIONS, and APPROVALS; later schema decisions replaced that structure.

### D-2 — Use the capture-to-spec workflow

- **Date:** 2026-08-09
- **Category:** process
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** Progress from capture and discussion to proposals and owner decisions, then plan and spec; create a roadmap with multiple specs when one spec would be too large.

### D-8 — Record directions without implementing them

- **Date:** 2026-08-09
- **Category:** process
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** When RC says “fix X” or “do X” in this conversation, record the direction as a decision. Do not begin implementation; execution happens through the later plan/spec pipeline.

### D-9 — Maintain documents through focused side chats

- **Date:** 2026-08-09
- **Category:** process
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** Use focused side chats to maintain the working documents instead of repeated inline clean-room loops. Documentation work does not authorize product-code or Wiki changes unless a later prompt explicitly grants that scope.

### D-10 — Bootstrap the Second Brain MVP

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** Use this folder as the Second Brain proof of concept. A folder-local `AGENTS.md` defines the curator role, `index.json` provides static routing metadata, and the reusable personal skill lives at `~/.codex/skills/second-brain`. Markdown documents remain the content sources of truth.

### D-11 — Add a working-folder bulletin

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** Use `BULLETIN.md` as the live side-chat coordination layer with stable `B-*` identifiers. Bulletin entries are advisory and cannot create owner decisions, approvals, or implementation authority.

### D-12 — Keep bulletin behavior inside Second Brain

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** active
- **Source:** RC correction in the primary chat
- **Decision:** Keep the working-folder bulletin protocol inside `$second-brain`; do not create a standalone bulletin skill. A capture constructor must preserve rather than redefine that curator-side-chat contract.

### D-13 — Create the first explicit capture constructor

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** superseded
- **Source:** RC approval in the primary chat
- **Superseded by:** D-14, D-18
- **Decision:** Create an explicit-only `$capture` constructor using highest-prefix-plus-one numbering, reserved `999`, `NNN-Descriptive_Name`, an INTENT-based five-document kernel, optional extensions, and a `$second-brain` handoff. D-14 refines the filenames and record structure without changing those numbering or role boundaries.

### D-14 — Adopt role-based filenames and record schemas

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** superseded
- **Source:** RC approval: “Let's do it.”
- **Superseded by:** D-17
- **Supersedes:** D-13 where filenames or record structure differ
- **Decision:** Use `CAPTURE.md`, `INTENT.md`, `DECISIONS.md`, `ISSUES.md`, and `PROPOSALS.md` as the default kernel. Prefer `WIKI_IMPACT.md` for the optional documentation-impact extension and reserve `VISION.md` for long-range aspirations. Treat document role, authority, category, action, and status as separate axes; use stable indexed `##` categories, individual `###` records, neutral IDs, and structured record fields. Preserve historical aliases when migrating referenced IDs.

### D-15 — Treat contradictions as an issue type by default

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** active
- **Source:** RC direction: “Let's remake our ISSUES.md to fit the new profile.”
- **Decision:** Organize `ISSUES.md` by stable subject category and record issue type, severity, and status as separate fields. Route verified contradictions into the affected issue category with `Type: contradiction`. Do not create `CONTRADICTIONS.md` unless contradictions become a substantial pairwise-source reconciliation corpus with authority or lifecycle distinct from ordinary issues.

### D-16 — Promote mature capture threads and compact their source records

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** active
- **Source:** RC direction in the primary chat: “Let's make it so.”; CAP-001
- **Decision:** Treat `CAPTURE.md` as a curated conversational checkpoint and active open-loop surface. Keep unresolved user threads and decision prompts there until their outcome is known. Then promote the outcome to the appropriate authoritative document, replace the active source record with a compact routed reference, and preserve a backlink to its `CAP-*` identifier. A routed Capture record transfers memory responsibility but does not claim downstream implementation is complete. Close an explored thread without promotion only with an explicit reason.

### D-17 — Consolidate desired outcomes and enduring goals in INTENT

- **Date:** 2026-08-09
- **Category:** schema
- **Status:** active
- **Source:** RC direction in the primary chat; CAP-005
- **Decision:** Keep `CAPTURE.md`, `INTENT.md`, `DECISIONS.md`, `ISSUES.md`, and `PROPOSALS.md` as the default kernel, with optional `WIKI_IMPACT.md` and earned domain extensions. Use one `INTENT.md` for purpose, current `Desired Outcomes`, optional `Enduring Goals`, success conditions, constraints, and non-goals. Enduring goals establish owner direction but do not approve detailed proposal scope or implementation. Retire the current `VISION.md`; create a future vision or strategy extension only when it forms a substantial corpus with authority, lifecycle, or readership genuinely distinct from intent. This supersedes D-14 while preserving its role-based filenames, category/record separation, stable-ID guidance, and historical-alias requirements.

### D-18 — Use Launchpad as the resumable pre-roadmap fronting workflow

- **Date:** 2026-08-09
- **Category:** process
- **Status:** active
- **Source:** RC clarification and approval in the primary chat; CAP-006
- **Supersedes:** D-13 for fronting-command and capture-constructor ownership
- **Decision:** Use the explicit-only `$launchpad` skill as the user-facing, resumable pre-roadmap workflow. On invocation it surveys an existing working-memory folder, reconstructs the current phase and open threads, and continues shaping the work; when invoked mid-conversation without a folder, it creates the next numbered capture and hydrates the default kernel. Launchpad may evolve the local schema from earned semantic needs, composable genre and domain examples, and locally invented conventions that satisfy the role, authority, lifecycle, substantive-content, and validation tests. Use `$second-brain` for bounded backstage research, focused side chats, reconciliation, and document maintenance. Retain `$capture` only as an explicit lightweight checkpoint inside an active workspace. Recommend `$roadmap-creator` when the indexed corpus is coherent and sufficiently bounded, but do not invoke planning or implementation without separate authorization.

## Product and Scope

### D-3 — Scope the CSS/UI discussion

- **Date:** 2026-08-09
- **Category:** scope
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** The active product scope is light/dark theming uniformity and slider-control uniformity across the app.

### D-4 — Bring light mode into conformity

- **Date:** 2026-08-09
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** Bring light mode into conformity with dark mode. Dark mode is the reference implementation; light themes must reach parity, not the other way around.

### D-5 — Keep paper surfaces pure white

- **Date:** 2026-08-09
- **Category:** product
- **Status:** superseded
- **Source:** RC statement in the primary chat
- **Superseded by:** D-20
- **Decision:** Office and Email paper surfaces remain pure white in both modes. Markdown and code may theme with the background; paper does not. The shared mute overlay is an intentional brightness filter, though a better implementation or clearer documentation may be proposed.

### D-6 — Fix mode-aware scrollbars

- **Date:** 2026-08-09
- **Category:** product
- **Status:** active
- **Source:** RC direction: “Scroll bar — fix please.”
- **Decision:** Make `--scrollbar-thumb` and `--scrollbar-thumb-hover` mode-aware so scrollbars remain visible in light themes. Implementation remains deferred under D-8.

### D-7 — Build a universal component design language

- **Date:** 2026-08-09
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary chat
- **Decision:** Establish reusable design-language direction for a universal color picker, universal menu paradigm, and standardized popup system. This approves the direction, not the detailed scope of each proposal.

### D-19 — Use one reusable paper-presentation contract

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary Launchpad conversation
- **Decision:** Unify paper presentation behind one reusable contract shared by Office and Email and available to thumbnails and future paper-like surfaces. Consumers should call or subscribe to the same behavior rather than reproduce it independently; the implementation may use a shared function, module, or other appropriately factored primitive. This establishes shared ownership and consumer scope; D-20 selects current Office behavior as the canonical output. Neither decision authorizes implementation.

### D-20 — Make Office paper behavior the canonical standard

- **Date:** 2026-08-10
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary Launchpad conversation; CAP-007
- **Supersedes:** D-5
- **Decision:** Treat the current Office paper-presentation behavior as the canonical standard, including its warm-paper base and brightness/muting model. Email, thumbnails, and future paper-like surfaces must consume the shared contract from D-19 and conform to the Office result rather than applying independent paper-color mixing or presentation rules. If the Office behavior changes later, shared consumers should receive that change through the common contract. This records product direction without authorizing implementation.

### D-21 — Approve the first theme-foundation package

- **Date:** 2026-08-13
- **Category:** product
- **Status:** active
- **Source:** RC approval in the primary Launchpad conversation; B-016
- **Decision:** Approve one first theme-foundation package: publish a complete shared light/dark token set from both the server generator and immediate client preview; state the active `color-scheme`; and use those values for mode-aware scrollbars, shared hover/focus and overlay behavior, readable on-accent text, and the Office hue-slider fallback. Preserve existing background/text/accent calculations and keep saved-theme output aligned with immediate preview. This includes P-001, the active-token portion of P-002, P-003, and P-014. It excludes the broad hardcoded glass-panel sweep (P-004), status/diff colors (P-008), shared Slider work (P-005), and legacy database-seed retirement (the remaining scope of P-002). This records approved future scope only; it does not authorize product implementation.

### D-22 — Replace the Office steel-blue palette with shared tokens

- **Date:** 2026-08-13
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary Launchpad conversation; B-018
- **Decision:** The Office steel-blue palette is historical workspace styling, not a permanent Office visual language. Replace its literals and fallbacks with shared theme tokens after the theme-foundation package supplies them. Preserve Office controls and interactions, document/table data and layout, color persistence, and the Office-reference paper behavior. This approves P-006's future scope only; it does not authorize implementation.

### D-23 — Defer a standalone Crepe-menu parity fix

- **Date:** 2026-08-13
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary Launchpad conversation
- **Decision:** Do not create a separate package to make Crepe's supplied menus match light mode. Leave the current Crepe menu behavior in place until the future shared menu-components system replaces that functionality. This defers P-007 and does not approve P-011's detailed replacement scope or product implementation.

### D-24 — Preserve the paper-brightness control's compact presentation

- **Date:** 2026-08-14
- **Category:** product
- **Status:** active
- **Source:** RC statement in the primary Launchpad conversation
- **Decision:** A future shared numeric Slider may be reused by `PaperBrightnessControl`, but it must preserve the control's current compact dropdown presentation and width. Do not make paper brightness a full-width slider like Theme Picker controls. This constrains future P-005 scope without approving that package or implementation.

### D-25 — Make shared pane-resize handles accessible

- **Date:** 2026-08-14
- **Category:** product
- **Status:** active
- **Source:** RC approval in the primary Launchpad conversation; B-020
- **Decision:** Approve accessibility improvements for the shared pane-resize handles: keyboard resizing, assistive-technology semantics, and visible keyboard focus. Preserve existing pointer dragging and saved-width behavior. This approves P-015's future scope only; it does not approve the separate shared numeric Slider package or product implementation.
