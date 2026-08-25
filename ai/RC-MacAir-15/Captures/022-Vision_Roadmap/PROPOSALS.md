# Vision Roadmap Proposals

> Candidate product, experience, and system directions. Proposals remain unapproved until linked to an explicit owner decision.

## Inbox and Attention

### P-005 — Add secondary metadata beneath workspace names

- **Category:** inbox
- **Status:** proposed
- **Source:** CAP-099
- **Addresses:** CAP-093, CAP-097

Give each workspace entry in the system-wide inbox an optional secondary metadata line. The specific fields remain open and should be selected for attention value without making the workspace list noisy.

## Navigation and UI Flow

### P-006 — Choose the mobile workspace-picker presentation

- **Category:** interaction
- **Status:** proposed
- **Source:** CAP-105
- **Addresses:** CAP-004

Choose a mobile-native presentation for switching workspaces from the workspace-name header. Dropdown, slide-up sheet, full-screen picker, and adaptive variants remain candidates; the tap target and workspace-switching purpose are already settled.

### P-007 — Choose the Context Manager Wiki presentation

- **Category:** interaction
- **Status:** proposed
- **Source:** CAP-114
- **Addresses:** CAP-111, CAP-112

Present Context Manager either as a second tab within Wiki or as a distinct Wiki type. The choice should preserve a clear relationship to Wiki without obscuring that Context Manager has different history, indexing, and consent behavior.

## Chat and Threading

### P-002 — One daily thread for grouped or lower-density views

- **Category:** chat_threading
- **Status:** proposed
- **Source:** CAP-025
- **Addresses:** CAP-019, CAP-024, CAP-026

Use a single daily thread across the consolidated Productivity Suite, and create or resume a daily thread when a lower-density view such as Health & Fitness is opened. The proposal remains provisional pending RC's complete Thread Management model.

## Mobile and Cross-Device Experience

No proposals have been recorded yet.

## System Landscape

### P-001 — HTML artifacts with appendable templates

- **Category:** system_landscape
- **Status:** proposed
- **Source:** CAP-013
- **Addresses:** CAP-001, CAP-012

Represent inbox content as HTML artifacts produced from prefilled templates with empty placeholders. Provide bounded operations that append the next section and allow an AI process to fill its content. The metadata representation is deliberately unresolved in CAP-014.

### P-008 — Add a User Profile Wiki variant

- **Category:** system_landscape
- **Status:** proposed
- **Source:** CAP-115
- **Addresses:** CAP-111, CAP-113

Offer **User Profile** as another plugin-added Wiki variant, governed by the same opt-in extraction and user-controlled recording and surfacing boundaries as Context Manager. Its precise distinction from semantic history remains to be shaped.

### P-003 — Durable workflow state folder with JSON checkpoints

- **Category:** workflow
- **Status:** proposed
- **Source:** CAP-058
- **Addresses:** CAP-059

Give a reusable workflow a state folder whose individual processes update a shared JSON checkpoint. A recurring workflow can use the checkpoint to determine which unit to process next and what prior work has completed.

### P-004 — Since-last-run retrieval through event bus and ledger

- **Category:** workflow
- **Status:** proposed
- **Source:** CAP-058
- **Addresses:** CAP-059

Provide a tool that queries the event bus and event ledger for activity matching bounded search parameters since the workflow's previous invocation. This may replace or complement explicit JSON checkpoint state for incremental work.

## Future Planning Families

No roadmap or SPEC families have been proposed yet.
