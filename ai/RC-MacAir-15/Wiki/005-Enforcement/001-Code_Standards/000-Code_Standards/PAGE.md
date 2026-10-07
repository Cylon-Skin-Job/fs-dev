---
name: Code Standards
description: Modularity expectations, file structure rules, architecture layers, CSS rules, naming conventions, and planning checklist for code changes.
metadata:
  source-files: []
  last-modified: "2026-09-28T04:56:08Z"
---

# Code Standards

Modularity expectations, file structure rules, and architecture principles. Reference this page during planning phases before writing or modifying code.

---

## Standards Map

Before changing code, identify the change category and read the relevant
subpage. The front page is the shared rulebook; subpages are the detailed
standards for specific code surfaces.

| Change Type | Read |
|---|---|
| New route, handler, service, dispatcher, action, or adapter path | [Architecture Routing](../001-Architecture_Routing/PAGE.md) |
| React components, buttons, composer chrome, reply chrome, user workflows | [Frontend UI Standards](../002-Frontend_UI/PAGE.md) |
| Store state, hydration, disabled state, runtime state mirrors | [State Management Standards](../003-State_Management/PAGE.md) |
| WebSocket message types, client/server protocol, message handlers | [WebSocket Protocol Standards](../004-WebSocket_Protocol/PAGE.md) |
| Event emission, subscribers, audit/fan-out, automation facts | [Universal Event Bus Standards](../005-Universal_Event_Bus/PAGE.md) |
| CLI/service harness adapters, provider commands, canonical events | [Harness Adapter Standards](../006-Harness_Adapters/PAGE.md) |
| SQLite, migrations, exchange metadata, thread mirrors, durable state | [Persistence And Metadata Standards](../007-Persistence_And_Metadata/PAGE.md) |
| Vertical slices, smoke tests, route-level verification | [Testing And Smoke Slices](../008-Testing_And_Smoke_Slices/PAGE.md) |

## Hard Routing Rule

### Governed capability planning

Owner direction recorded 2026-09-27 PDT: new cross-capability behavior must be designed within the schema/provenance/subscriber model, not added as a parallel bespoke server route. Roadmap Creators and implementers must:

1. Identify existing owners and classify commands, facts, observations, queries and projections. Link the [Event Taxonomy and executable schema catalog](../../../010-Events_And_Ledger/002-Event_Taxonomy/PAGE.md), [Provenance Model](../../../010-Events_And_Ledger/003-Provenance_Model/PAGE.md) and [UEB standards](../005-Universal_Event_Bus/PAGE.md).
2. Reuse definitions when meaning, identity, units, timing and authority agree. Create closed, versioned domain definitions when they do not; avoid a generic optional-field envelope merely to make unrelated capabilities look alike.
3. Declare producer authority, subscriber grants/capabilities, delivery/failure behavior and storage ownership. A missing framework capability becomes an explicit foundation dependency or same-SPEC extension, not an undocumented bypass. Registration is not permission and legacy emit/on is not governed admission.
4. Measure/publish once at each owned stage and fan out authorized projections. Diagnostics and retained health consumers share scalar derivation; server arrival and renderer receipt are legitimately different stages. UI reset must not reset or double-count retention state.
5. Separate required protection/provenance from best-effort sampled telemetry. Governance does not require every observation to block a command, enter the System ledger or live in fusion.db. A separate health store does not itself enforce access permissions.
6. Include exact schema/consumer references, migration/retirement, tests and affected wiki updates in the SPEC. Label each capability implemented, approved direction or missing. Preserve current evidence limits; passing a planning review is not runtime validation.

This applies to new capability boundaries, not every private helper or keystroke. Existing legacy paths require explicit migration planning; this direction does not pretend they have already migrated. The [follow-up brief](../../../../mission-control/launchpad/fusion-health-and-governed-observability/TICKET.md) captures logger/render/ledger/plugin/view coordination; it is not an approved implementation roadmap.

Do not add a new user action, WebSocket message, backend handler, service,
event, or harness method until the existing owner for that category of work has
been identified.

If the existing route cannot support the change, document why before creating a
new route. Frontend code sends canonical product intent. Backend code owns
validation and routing. Adapters translate canonical intent into provider or
external-system syntax.

---

## File Size Guidance

One job per file, not a line count.

| Size | Action |
|------|--------|
| Under 200 lines | Don't think about it |
| 200-400 lines | Check if it's still one job |
| Over 400 lines | Almost certainly doing too much — split it |

A 350-line SSE controller handling parsing, buffering, and recovery = fine (one job).
A 250-line file rendering UI + calling APIs + managing state = not fine (three jobs).

**The test:** Can you describe what this file does in one sentence without "and"? If not, split it.

---

## Modularity Rules

1. **One job per file.** Not one function — one responsibility. A file can have many functions if they all serve the same job.
2. **No God files.** If a file is the only place where X, Y, and Z happen, it's doing too much.
3. **Imports tell the story.** If a file imports from 5+ unrelated modules, it's probably orchestrating too many concerns.
4. **Extract when the second consumer appears.** Don't pre-extract. Three similar lines of code is better than a premature abstraction. Extract when a second file needs the same thing.
5. **Delete, don't deprecate.** No `_unused` prefixes, no `// removed` comments, no backwards-compatibility shims for one-time operations. If it's dead, delete it.
6. **Ship the target, don't preserve the old path.** When a replacement composition, host, or flow is accepted, it becomes the production behavior in the same program of work. Do not keep the previous production path alive "for compatibility" behind flags, docks, or legacy hosts — that hides the accepted feature and doubles the surface every future change must support. Local and developer data is disposable: prefer wiping or migrating it over carrying legacy modes. If a transition period is genuinely required, the owner asks for it explicitly.

---

## Architecture Layers

Data flows down. Events flow up. Nothing skips a layer.

```
VIEW (Presentation)
  ├── Pure presentation, renders state, emits user events
  ├── NEVER calls services or APIs directly
  └── NEVER imports controllers or services

CONTROLLER (Orchestration)
  ├── Handles events, orchestrates services, emits results
  ├── NEVER touches DOM directly
  └── NEVER imports view modules

SERVICE (Data Access)
  ├── Pure data access, returns data only
  ├── Called by controllers only
  └── NEVER emits events or touches DOM

STATE (Single Source of Truth)
  ├── Read-only from View, written only by controllers
  └── Emits state.changed on writes
```

**However:** "Layer as little code as possible." Don't build an event bus, controller layer, and service layer if the feature is simple. The layers exist for when complexity demands them, not as mandatory ceremony. A direct function call is fine when the data flow is obvious.

---

## Dependency Rules

```
VIEW may import:     state (read-only), components
VIEW must NOT:       controllers, services, API calls, write state

CONTROLLER may:      state (read/write), services, event bus
CONTROLLER must NOT: views, components, DOM

SERVICE may:         API clients, network
SERVICE must NOT:    event bus, state, controllers, views, DOM

COMPONENT may:       create DOM, accept config/callbacks, use CSS variables
COMPONENT must NOT:  controllers, services, state, network
```

### Portable components and connected hosts

The `COMPONENT` rule applies to reusable presentation boundaries. A connected
feature host or controller hook may read established stores and invoke
established actions, but it must pass explicit data and callbacks into the
portable component. Do not make a supposedly reusable component discover its
workspace, view, thread, or network route from app-global state.

For chat composition, keep these identities explicit:

- `viewId` identifies the immutable owning view capsule;
- `threadGroupId` identifies the visible thread/body of work;
- `threadId` identifies one independently routed chat session; and
- `surfaceId` identifies one transient mounted UI instance.

Existing live protocol continues to route by `threadId`. Do not rename that
field to `sessionId` as part of an otherwise bounded component extraction.

---

## Component Portability

Components are reusable across projects. They must be self-contained.

1. **All styles use CSS variables with fallbacks:** `var(--token, fallback)`
2. **All class names prefixed:** `.rv-toast`, `.rv-modal` (no collisions)
3. **Pure functions:** input (config object) → output (DOM element)
4. **Styles inject once** via flag (prevent duplicate `<style>` tags)
5. **No imports** of controllers, services, app-state, or network
6. **No knowledge** of what project they're in

---

## CSS Rules

1. **NEVER hardcode** colors, spacing, or z-index
2. **NEVER put** component styles in global CSS files — styles live in the component
3. **EVERY value** traces back to CSS variables
4. **Theme switching** only swaps variable values

### Core Token Categories

```css
--palette-*          /* Color palette */
--bg-*               /* Backgrounds */
--text-*             /* Text colors */
--space-xs|sm|md|lg  /* Spacing */
--z-*                /* Z-index layers */
--shadow-*           /* Shadows */
--transition-*       /* Animation durations */
```

---

## Naming Conventions

```
Files:     feature-view.js, feature-controller.js, feature-service.js
           feature.styles.js, feature.template.js

Events:    domain:action          (chat:turn_end, ticket:claimed, agent:run_completed)
           Colon-separated.       Matches wire protocol convention (thread:create, thread:open).

CSS vars:  --palette-name, --bg-name, --text-name
           --space-xs|sm|md|lg, --z-layer, --shadow-weight

Classes:   .rv-component, .rv-component-part
```

---

## Anti-Patterns

| Don't | Do |
|-------|----|
| Hidden div in HTML that JS toggles visible | JS creates element on demand |
| View calls `authenticatedFetch()` | Emit event to controller |
| Controller does `document.getElementById()` | Emit event to view |
| Hardcoded color `#FF6B35` | Use `var(--palette-accent, #FF6B35)` |
| Component importing app-state | Accept config object instead |
| One giant app.js | Split into view + controller + service |
| Inline styles on elements | Component injects scoped `<style>` once |
| Add features beyond what was asked | Do what was asked, nothing more |
| Add error handling for impossible scenarios | Trust internal code and framework guarantees |
| Create helpers for one-time operations | Inline it |
| Add a one-off route because it is faster | Use the existing dispatcher/interpreter or document why it cannot fit |
| Put provider syntax in frontend or product protocol | Send canonical product intent and translate in the adapter |

---

## Planning Phase Checklist

Before writing code, verify the plan against these standards:

- [ ] Each new file has one job (describable in one sentence without "and")
- [ ] No file will exceed 400 lines
- [ ] Imports don't cross layer boundaries
- [ ] Existing dispatcher/interpreter owner has been identified
- [ ] New routes or modules have a written reason the existing path cannot fit
- [ ] Frontend emits canonical product intent, not provider-specific syntax
- [ ] Backend owns validation, state checks, routing, and capability errors
- [ ] Provider or external syntax is contained in the adapter layer
- [ ] CSS values use variables with fallbacks
- [ ] Components are portable (no app-state, no services, no network)
- [ ] Connected hosts pass explicit data/actions into portable components
- [ ] View, visible-thread, session, and mounted-surface identities are not conflated
- [ ] No premature abstractions (is there actually a second consumer?)
- [ ] No scope creep (does this change do more than what was asked?)

---

## Compliance Migration — Audit Specs

Full audit completed 2026-04-06. 22 specs with dependencies, gotchas, and silent fail risks.

**Spec index:** `ai/<machine>/Captures/todo/specs/00-INDEX.md`

### CSS / Style Layer (target: settings system, not variables.css)

- [ ] **Z-index hierarchy** — 2 active collision bugs, 10 hardcoded values
  `ai/<machine>/Captures/todo/specs/15-css-zindex-standardization.md`

- [ ] **Spacing & font variables** — 38 hardcoded values, no scale exists
  `ai/<machine>/Captures/todo/specs/17-css-spacing-standardization.md`

- [ ] **Inline styles extraction** — 6+ components, blocked by spacing variables
  `ai/<machine>/Captures/todo/specs/21-inline-styles-extraction.md`

- [ ] **.rv- class prefix** — 0/395 classes namespaced, querySelector gotcha
  `ai/<machine>/Captures/todo/specs/18-rv-prefix-migration.md`

- [ ] **Delete Vite boilerplate** — 3 dead color rules in App.css
  `ai/<machine>/Captures/todo/specs/16-css-color-standardization.md`

### Server Module Extraction

- [ ] **ThreadManager split** — session manager + auto-rename (do first, no deps)
  `ai/<machine>/Captures/todo/specs/04-thread-manager-split.md`

- [ ] **ThreadWebSocketHandler split** — CRUD + messages (after ThreadManager)
  `ai/<machine>/Captures/todo/specs/03-thread-ws-handler-split.md`

- [ ] **compat.js split** — alternate/parallel paths may be deletable
  `ai/<machine>/Captures/todo/specs/11-compat-js-split.md`

- [ ] **Qwen + Gemini shared extraction** — 95% identical, 5% subtle differences
  `ai/<machine>/Captures/todo/specs/10-qwen-harness-split.md`
  `ai/<machine>/Captures/todo/specs/14-gemini-harness-split.md`

- [x] **server.js decomposition** — DONE 2026-06-11: 1752 → 302-line glue file (SPEC-01a–01g)
  `ai/<machine>/Captures/todo/specs/01-server-js-decomposition.md`
  `ai/<machine>/Captures/todo/specs/01g-server-js-remaining-extractions.md`

### Client Component Extraction

- [ ] **ws-client.ts split** — turn lifecycle fragile, past bugs documented
  `ai/<machine>/Captures/todo/specs/05-ws-client-split.md`

- [ ] **RobinOverlay split** — 4 sub-components, after spacing tokens
  `ai/<machine>/Captures/todo/specs/02-robin-overlay-split.md`

- [ ] **HoverIconModal split** — hook + UI, module-level state gotcha
  `ai/<machine>/Captures/todo/specs/08-hover-icon-modal-split.md`

- [ ] **VoiceRecorder split** — audio hook + viz, cleanup order matters
  `ai/<machine>/Captures/todo/specs/06-voice-recorder-split.md`

### No Action Required

- **catalog-visual.ts** — one job, acceptable size → `specs/07-catalog-visual-split.md`
- **base-cli-harness.js** — one job, acceptable size → `specs/09-base-cli-harness-split.md`
- **LiveSegmentRenderer.tsx** — DO NOT SPLIT, breaks completion → `specs/13-live-segment-renderer-split.md`
- **State store decoupling** — Zustand pattern is standard → `specs/20-state-store-decoupling.md`
- **App.tsx imports** — root orchestrator, expected → `specs/22-app-tsx-import-reduction.md`

<!-- section-toc:start -->
## Technical Articles in this Wiki Section

- [Architecture Routing](../001-Architecture_Routing/PAGE.md) - Rules for finding and using existing dispatchers, interpreters, controllers, and service boundaries before adding new routes.
- [Frontend UI](../002-Frontend_UI/PAGE.md) - Rules for UI components, composer/reply chrome, user intents, and presentation boundaries.
- [State Management](../003-State_Management/PAGE.md) - Rules for store ownership, backend state authority, hydration, and avoiding duplicated state checks.
- [WebSocket Protocol](../004-WebSocket_Protocol/PAGE.md) - Rules for WebSocket message additions, canonical client intent, backend routing, and handler ownership.
- [Universal Event Bus](../005-Universal_Event_Bus/PAGE.md) - Rules for using the server-side universal event bus without confusing commands, facts, chat lifecycle, and provider protocol.
- [Harness Adapters](../006-Harness_Adapters/PAGE.md) - Rules for provider-specific CLI/service adapters, canonical events, and canonical thread actions.
- [Persistence And Metadata](../007-Persistence_And_Metadata/PAGE.md) - Rules for SQLite writes, migrations, thread managers, metadata, file mirrors, and durable state updates.
- [Testing And Smoke Slices](../008-Testing_And_Smoke_Slices/PAGE.md) - Rules for vertical slices, focused smoke tests, route-level verification, and reporting residual risk.
<!-- section-toc:end -->
