# INTENT — CSS UI Changes

> Owner-directed purpose, desired outcomes, enduring goals, boundaries, and success conditions. Intent establishes direction across time horizons; it does not authorize implementation.

## Purpose

Bring light-theme behavior into conformity with the dark-theme reference implementation and establish a coherent path toward shared, token-driven UI components. Preserve the audit evidence and RC's decisions so later planning and specification work can proceed without reconstructing the conversation.

## Desired Outcomes

Every supported surface, hover, scrollbar, and slider behaves correctly in both light and dark modes. Theme-dependent chrome uses one explicit token contract, native controls receive the active `color-scheme`, and current one-off implementations have a documented consolidation path.

## Enduring Goals

Fusion Studio grows a componentized design language in which visual and behavioral consistency comes from shared primitives rather than repeated surface-specific implementations.

- A **universal color picker** serves anything that changes a color variable.
- A **universal menu paradigm** standardizes styling and modular behavior, including submenus and apply-and-close, apply-and-keep-open, and partial-close modes.
- A **standardized popup system** provides typed content and warning slots within constrained layouts; new needs become new reusable component types rather than stand-alone popups.
- A **shared paper-presentation contract** gives Office, Email, thumbnails, and future paper-like surfaces one source for base-paper and brightness/muting behavior instead of duplicating presentation logic.
- Shared components consume a canonical, mode-aware token contract so light/dark drift cannot regrow independently on each surface.

The immediate theme-conformance outcomes and this longer arc reinforce each other, but D-7's direction does not by itself approve the detailed scope or implementation of individual component proposals.

## Success Conditions

- The theme generator and its client mirror emit the same complete, mode-aware token contract.
- Every consumed theme token has a canonical definition; fallbacks provide resilience rather than acting as hidden definitions.
- `color-scheme` follows the active theme so native controls render consistently.
- A representative visual acceptance pass succeeds in both modes for sliders, scrollbars, hover and focus states, accent-backed text, Crepe chrome, and Office-standard paper surfaces.
- Office, Email, and thumbnails consume the same reusable paper-presentation behavior, with new paper-like consumers able to subscribe without reimplementing it.
- Approved shared-component direction is represented in later plan/spec work without silently expanding unapproved proposal scope.
- Documentation impacts are routed through `WIKI_IMPACT.md` and remain separate from implementation authority.

## Constraints

- Dark mode is the visual reference; the objective is light-mode parity rather than redesigning dark mode.
- Office is the canonical paper-presentation reference under D-20. Email, thumbnails, and future paper-like surfaces must consume the shared D-19 contract rather than introducing independent base colors, workspace mixing, or brightness/muting behavior.
- Product implementation, Wiki edits, plans, specs, and roadmaps require separate authorization.
- Current audit claims derived from source inspection still require the visual pass described in `CAPTURE.md` before implementation priority is finalized.

## Non-goals

- A visual redesign or new aesthetic language as part of the initial conformance work.
- Reworking the theme catalog or picker UX beyond what parity and component consolidation require.
- Folding every legacy Wiki correction exposed by the survey into the first CSS implementation spec.
- Treating a proposal, bulletin entry, or documentation update as implementation authorization.
