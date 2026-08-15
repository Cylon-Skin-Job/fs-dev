# CAPTURE — CSS UI Changes

> Curated conversational checkpoint and re-entry surface. Preserve the discussion's working synthesis and active open loops here; promote mature outcomes to their authoritative documents and leave compact routed references.

## Working Synthesis

This capture began as a read-only audit of light/dark theming and slider-control uniformity across Fusion Studio. It later became the proof-of-concept for a broader Capture and Second Brain workflow: early conversation is preserved as readable working memory, while explicit decisions, verified issues, and candidate actions mature into dedicated documents without losing their conversational provenance.

**Workflow and authority.** RC's statements, questions, tentative ideas, and the circumstances of the discussion begin here. Explicit owner positions are recorded in `DECISIONS.md`; verified actionable problems in `ISSUES.md`; candidate actions in `PROPOSALS.md`; purpose, desired outcomes, enduring goals, and boundaries in `INTENT.md`; and documentation consequences in `WIKI_IMPACT.md`. A direction such as “fix X” is recorded but does not authorize implementation. The lifecycle remains capture and discussion → proposals and decisions → plan → spec → roadmap when needed → implementation only when separately authorized.

**Launchpad and Second Brain proof of concept.** RC chose a resumable fronting agent plus focused backstage work instead of repeated inline clean-room loops. The explicit-only `$launchpad` skill now surveys an existing folder, restores orientation, continues the conversation, or creates a numbered capture when invoked midstream. It uses the five-document kernel—`CAPTURE.md`, `INTENT.md`, `DECISIONS.md`, `ISSUES.md`, and `PROPOSALS.md`—while allowing earned local extensions derived from schema heuristics and composable software, research-writing, and media-production examples. `$second-brain` is the backstage research, delegation, reconciliation, and document-maintenance engine governed by local `AGENTS.md`, static `index.json`, and volatile `BULLETIN.md`. `$capture` is retained only as an explicit lightweight checkpoint inside an active workspace.

**Capture lifecycle.** Saying “capture this” means checkpoint and reconcile the discussion, not merely append a transcript. The working synthesis stays readable; user-originated threads, assistant-originated possibilities, and unresolved owner choices remain active below. Once a thread produces an explicit decision, verified issue, proposal, intent change or enduring goal, Wiki impact, or other indexed outcome, it is promoted to that document. The active `CAP-*` record is then compacted into `Routed Outcomes`. Routing transfers memory responsibility; it does not claim that downstream implementation is finished.

**CSS/UI direction.** RC decided that dark mode is the reference implementation and light mode must reach parity. The current Office warm-paper base and brightness/muting behavior are now the canonical paper standard. Paper presentation must be unified behind one reusable contract used by Office and Email and exposed to thumbnails and future paper-like surfaces, with the concrete function or module boundary left to technical design. Thumbnail PNGs are intentionally captured clean; the displayed thumbnail receives the slider-controlled dimming overlay afterward, so brightness is not baked into the image. Email's independent workspace-color mixing should not define a separate paper result. RC also established direction toward a universal color picker, menu paradigm, popup system, and shared component language. Mode-aware scrollbars should be fixed, while implementation remains deferred pending later authorization.

**Current phase.** The overall CSS/UI effort remains in shaping, not handoff-ready. Only the approved paper branch has a bounded implementation draft. Theme foundations, editor/chrome parity, shared controls and accessibility, and cleanup still have open issues and mostly unapproved proposals; they must be discussed and scoped before this whole capture can move to Roadmap Creator.

**Audit evidence.** Theme tokens originate in `fusion-studio-client/src/styles/variables.css`; `fusion-studio-server/lib/theme/theme-css-generator.js` re-emits active root variables; `useSharedWorkspaceStyles.ts` injects them; and `src/lib/theme/live-preview.ts` maintains a client mirror. The generator omits glass, overlay, scrollbar, and legacy families, leaving dark-biased defaults in light themes. A 2026-08-10 recheck counted 170 current references across 12 representative phantom token names with silent fallbacks. The client sets no active `color-scheme`, and three slider implementations exist without a shared Slider component. Other confirmed islands include Crepe pinned to `frame-dark.css`, 42 Office steel-blue or dark-fallback occurrences, hardcoded white liquid-glass panels, and black text on accent backgrounds.

**Representative visual pass.** B-007 through B-010 established the initial evidence, and B-012/B-013 completed the remaining direct light-theme checks with isolated, non-persisting Chromium harnesses on 2026-08-13. The pass confirmed fixed white-alpha dropdown and scrollbar states, `color-scheme: normal`, browser-native range styling, the dark PaperBrightnessControl dropdown, dark Crepe slash-menu chrome, Office warm-paper output, and active steel-blue Office controls. It did not reproduce unreadable Email content at minimum brightness. Mounted ThemePicker/dialog/resize-pane states, live Crepe selection/block handles, and Email accent-backed controls remained unavailable in the isolated fixtures and are explicitly source-backed rather than runtime-confirmed. D-20 remains the Office paper reference. The full evidence and confidence limits are in `ISSUES.md`; `WIKI_IMPACT.md` holds the documentation analysis.

## User Threads to Resume

### CAP-008 — Make hue selection visual rather than a generic slider

- **Origin:** user
- **Type:** idea
- **Status:** open
- **Source:** RC statement in the primary Launchpad conversation on 2026-08-14
- **Summary:** The Office custom-color hue control would be better as a visible color gradient that the user clicks or drags on, rather than being treated as an ordinary generic slider. This may belong in the future universal color picker rather than the shared Slider package.
- **Related:** I-12, P-005, P-010, D-7
- **Resume with:** Decide whether this is the required interaction model for the future universal color picker and whether it explicitly excludes the hue control from the general shared Slider component.

### CAP-002 — Complete a representative visual acceptance pass

- **Origin:** mixed
- **Type:** question
- **Status:** open
- **Source:** RC's request for inspectable light-mode examples and the CSS/UI audit
- **Summary:** The 2026-08-13 isolated Chromium checks covered the remaining direct light-theme states that could be represented without persisting theme state. They verified the major shared-chrome and surface findings while preserving explicit limits for controls and editor states that require mounted fixtures.
- **Related:** I-1 through I-12, I-16, B-007 through B-010, B-012, B-013
- **Resume with:** Add mounted fixtures for ThemePicker/dialog/resize-pane controls, live Crepe selection/block handles, and Email accent-backed controls if runtime confirmation is required. Otherwise proceed to bound the approved Office-reference paper primitive and the first implementation package.

## Assistant Possibilities

> Entries in this section originate with the assistant and remain unendorsed unless RC explicitly adopts or routes them.

### CAP-003 — Generate a cross-document dashboard if scanning becomes difficult

- **Origin:** assistant
- **Type:** idea
- **Status:** parked
- **Source:** Second Brain schema discussion in the primary chat
- **Summary:** A future generated `DASHBOARD.md` could project open issues, unresolved decisions, proposal states, and active capture threads without copying authority into CAPTURE.
- **Related:** index.json
- **Resume with:** Revisit only if manual navigation across the indexed documents becomes burdensome.

### CAP-004 — Split chronological history into LOG only after it earns a distinct role

- **Origin:** assistant
- **Type:** idea
- **Status:** parked
- **Source:** CAPTURE role discussion in the primary chat
- **Summary:** Keep lightweight checkpoint history here for the MVP; add `LOG.md` later only if many capture events create a substantial append-only provenance stream distinct from current re-entry memory.
- **Related:** AGENTS.md, index.json
- **Resume with:** Reassess when Capture History becomes too long or audit needs require immutable checkpoint detail.

## Decision Queue

## Routed Outcomes

### CAP-001 — Adopt promotion and compaction for mature capture threads

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC direction in the primary chat: “Let's make it so.”
- **Summary:** Structured user threads and decision prompts stay active in CAPTURE until their outcome is known, then move to the appropriate authoritative document while CAPTURE retains a compact reference.
- **Related:** D-16
- **Outcome:** Routed to `DECISIONS.md` as D-16. Routing means the conversational memory has a durable destination; it does not mean downstream work is implemented or complete.

### CAP-005 — Consolidate current outcomes and enduring goals in INTENT

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC direction in the primary chat: “Let's do it. Both in our current CSS project and in our new workflow schema.”
- **Summary:** Replace the separate Vision document with one INTENT schema that distinguishes current desired outcomes from enduring goals.
- **Related:** D-17
- **Outcome:** Routed to `DECISIONS.md` as D-17. The CSS design-language direction moved into `INTENT.md`, and the reusable workflow now treats a separate vision document as a legacy or specially earned extension rather than a default second intent surface.

### CAP-006 — Adopt Launchpad as the resumable fronting workflow

- **Origin:** user
- **Type:** decision_prompt
- **Status:** routed
- **Source:** RC clarification and direction in the primary chat ending with “Do it.”
- **Summary:** Make `$launchpad` the fronting agent that surveys or creates a working folder, restores the current phase, shapes the work, evolves an earned domain-aware schema, dispatches backstage work through Second Brain, and recognizes readiness for Roadmap Creator.
- **Related:** D-18
- **Outcome:** Routed to `DECISIONS.md` as D-18. `$capture` became a checkpoint-only command, while `$second-brain` became the explicit backstage work-and-memory engine.

### CAP-007 — Clarify whether the pure-white paper contract is literal

- **Origin:** mixed
- **Type:** decision_prompt
- **Status:** routed
- **Source:** D-5; I-11; B-008
- **Summary:** D-19 settles that Office, Email, thumbnails, and future consumers must share one paper-presentation contract, but it does not choose the contract's base color. Current Office paper uses warm white and Email mixes that base toward the workspace color before applying the separate brightness overlay. Decide whether D-5 requires a literal pure-white base before the overlay, or whether warm-white and color-mixed paper should be permitted through a refinement of D-5.
- **Related:** D-20 in DECISIONS.md, P-013 in PROPOSALS.md
- **Outcome:** Routed to D-20 in DECISIONS.md, P-013 in PROPOSALS.md.

## Capture History

- **2026-08-09 — Initial CSS/UI intake:** Captured the light/dark-theme and slider audit, owner direction, evidence summaries, and representative visual examples.
- **2026-08-09 — Second Brain bootstrap:** Added focused side-chat governance, static routing metadata, bulletin coordination, and the reusable personal skills.
- **2026-08-09 — Schema migration:** Adopted the INTENT-based kernel, `PROPOSALS.md`, `WIKI_IMPACT.md`, category-first records, and contradictions as an issue type.
- **2026-08-09 — Conversational-memory lifecycle:** Recast CAPTURE as the readable checkpoint and active open-loop surface, with promotion, compaction, and routed backlinks for mature outcomes.
- **2026-08-09 — Intent-horizon consolidation:** Merged the former Vision content into `INTENT.md` as `Enduring Goals` and removed the redundant second direction document.
- **2026-08-09 — Launchpad architecture:** Added the resumable fronting-agent skill, moved capture-folder construction and numbering into it, narrowed `$capture` to checkpointing, and made `$second-brain` the backstage batch engine.
- **2026-08-10 — Second Brain verification batch:** Revalidated all four issue sections against current source and representative runtime behavior, corrected stale counts and the paper-surface finding, recorded confidence limits for unexercised light-theme states, and surfaced the D-5 interpretation question.
- **2026-08-10 — Shared paper behavior:** Established one reusable paper-presentation contract for Office, Email, thumbnails, and future consumers while leaving the canonical base-color decision open.
- **2026-08-10 — Office paper standard:** Selected current Office paper behavior as the canonical output, superseding the literal pure-white rule and resolving CAP-007.
- **2026-08-13 — Isolated visual verification:** B-012 and B-013 completed the remaining non-persisting light-theme checks, recorded evidence and fixture limits, and left only optional mounted-fixture confirmation before implementation planning.
- **2026-08-13 — Thumbnail behavior clarified:** The saved Office thumbnail PNG remains clean by design; the displayed thumbnail adds the same brightness-controlled dimming layer afterward. The shared paper work must preserve that two-step behavior rather than treat it as an open product choice.
- **2026-08-13 — Paper implementation draft:** The approved Office-standard paper behavior now has a bounded pre-roadmap draft: one shared renderer-side paper contract, Office and Email consumers, clean capture plus displayed-thumbnail overlay, and a fixture-based acceptance plan. No further product decision is open for this package.
- **2026-08-13 — Readiness boundary corrected:** The paper package is ready for its own future planning slice, but the CSS/UI capture as a whole is still shaping. Its other verified issue groups and unapproved proposals must not be implied ready for Roadmap Creator.
- **2026-08-13 — First theme package approved:** D-21 approves the shared light/dark token, active-mode, scrollbar, overlay, and on-accent foundation. Broad glass replacement, semantic status colors, shared Slider work, and legacy theme-seed retirement remain separate follow-on discussions.
- **2026-08-13 — Office chrome token direction:** D-22 records that Office's historical steel-blue palette must yield to shared theme tokens; it is not an Office-specific visual standard.
- **2026-08-13 — Crepe-menu deferral:** D-23 leaves Crepe's supplied menus unchanged for now. Their functionality is a future replacement target for the shared menu-components direction, not a standalone light-mode parity package.
- **2026-08-14 — Paper-brightness presentation preserved:** D-24 allows future reuse of shared numeric-slider behavior, but paper brightness remains a compact dropdown control rather than adopting Theme Picker's full-width layout.
- **2026-08-14 — Pane-resize accessibility approved:** D-25 approves keyboard, assistive-technology, and focus support for the shared pane dividers while preserving pointer resizing and saved widths. The shared numeric Slider remains a separate decision.
