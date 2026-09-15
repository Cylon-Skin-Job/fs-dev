# Plugin System — The Vision (Root Capture)

**Capture:** root of the plugin-system capture suite · **Parent:** none (program root)
**Status:** working vision — not a SPEC; nothing here authorizes implementation
**Created:** 2026-09-15, carrying the 2026-09-14 design corpus out of `~/projects/plug-ins` and into fs-dev
**Children:** `../032-Plugin_Backend/backend-architecture.md`; one capture per view as execution begins
**Conventions:** [`capture-system.md`](./capture-system.md) · **Cross-read hub:** [`capture-map.md`](./capture-map.md)

---

## 1. The thesis

The long-term goal is that **the assistant produces graphical user interfaces on
demand**, through a staged authoring loop:

1. A person describes what they want to track and how they want it organized.
2. The assistant surveys a catalog of modules, plugins, and view configs, follows
   an authoring workflow, creates a view folder, drops in a config, points at
   modules, and seeds filler data.
3. The user clicks around the preview and suggests changes.
4. The assistant makes the changes.
5. The user provisions it on the server. Now they have their own app.

This liberates the AI interface out of the chat: **chat is the specification
surface; the view folder is the program; the assistant is the compiler; the
preview is the test; provisioning is the deploy.**

Corollaries: decomposition into config-over-modules is the enabler; the agent is
the integration layer (adaptation cost O(1), not O(N) integrations); config
covers the common 80%, bespoke modules cover the edge, iframe covers arbitrary
UI; and the average user never explores the guts.

## 2. What a plugin is

A plugin is a **folder with a manifest** that (1) declares typed contributions,
(2) requests capabilities, and (3) runs an install/enable/consent lifecycle.
Everything else in the ai tree is **content** — created in place and edited like
files. The four-part test (kickoff §2t): bundle — packaged and installed, not
created in place; declaration — a manifest of contributions and requests;
lifecycle — installed, approved, enabled, disabled, quarantined, revoked,
hash-checked; consequence — it can change platform behavior or touch other data,
so consent applies.

Categories (`views`, `chat`, `hooks`, `tools`, `api`, `agents`, `skills`,
`workflows`, `triggers`, `models`, `data`, `templates`, `assets`) are human
organization, **not enforcement** — any plugin may request anything and grants
are per-plugin. `shell` is platform-owned and never a category.

Definition versus instance: the **plugin folder is the definition** (display
config, modules, agent, skills, templates, data); the **view capsule is the
instance** (this workspace's binding, theme, UI state — a thin pointer plus
presentation shell). One plugin can back many capsules.

## 3. First principles

| # | Principle | The test it answers |
|---|---|---|
| P1 | **Mechanism is system-owned; variance is declared.** | Does the change land in config/manifest/scope values, or does it require replacing platform code? Code replacement is a fork, not a plugin. |
| P2 | **Classification precedes consent.** | Policy, contribution, content, or platform — the class decides lifecycle, hashing, and edit rights. |
| P3 | **Read is liberal; write is gated.** | Does this need write access, or only visibility? |
| P4 | **Off is the signal.** | Is there an explicit off state, and does the runtime re-verify bytes at the moment of use? No ambient write access, ever. |
| P5 | **The spawn boundary is the commit point.** | Must a change affect in-flight sessions, or is next-spawn sufficient? |
| P6 | **Fail closed, fail visible.** | On failure, does the system stop and surface it? Quiet continuation is the bug class. |
| P7 | **Inject the map, not the territory.** | Does the cascade put a navigable map in context, or full contents? |

## 4. The layer map

Full treatment lives in the backend capture (`../032-Plugin_Backend/backend-architecture.md` §3); one line each:

1. **Classification** — policy / contribution / content / platform; decides everything downstream. *(Still the flagged next design item.)*
2. **Package** — folder + manifest; hybrid container (category registry + interior `agent/`, `skills/`, `templates/`, `workflows/`).
3. **Contributions** — the typed things a plugin adds, each with a defined server interpretation.
4. **Surfaces** — Plugins view as trust root, capsules as instances, file detail as platform API.
5. **Runtime ladder** — config → stateless module → automation runtime → graduated process + own DB.
6. **Authority** — grants, tickets, extension points, territory locks, consent bound to bytes.
7. **Evidence** — producer registry → UEB → ledger; fail-open and bounded; the provenance gates live here.
8. **Injection** — skills/agents assembled per spawn across global → workspace → view.

## 5. The trust contract — two halves, one seam

**Authorization before the act** is the plugin system: manifest declarations,
visible grants, tickets, extension points, territory locks, per-file sha256 in
the server-side consent record, fail-closed tamper detection with a Register
diff. **Evidence after the act** is provenance: plugins never publish; the
server registers producers on their behalf, assigns actor and cause, and rejects
unregistered emitters.

The seam between the halves is the **producer registry** — design it now, wire
it when the platform gates close. The gates block canonical publication for new
families (automation results, tool contracts, app-domain events, ledger hashing,
storm control, audit); they do **not** block consent UX, hashing, territory
locks, local records, the mockup, or producer-registration design. That split,
and the five postures that make deferral safe, are detailed in the backend
capture §2.

## 6. Where the program stands

Design phase; no fs-dev code written for the plugin system. The next moves in
sequence:

1. **Classification** — resolve policy vs contribution vs content vs platform
   and the preinstalled-first-party question (kickoff Q13). This gates consent
   treatment and the manifest grammar.
2. **Plugins view mockup** — `SPEC-01-PLUGINS-VIEW-MOCKUP` (draft in the
   plug-ins archive) proves the trust root end to end in an isolated worktree.
3. **Enforcement** — off-is-the-signal write protection for plugin folders.
4. **Grammar + producer registration** — freeze the manifest/permission
   contract; define how plugin producers enter the registry.
5. **First lifted server capability** — extract server code behind a stable
   command surface, in-process first (the modularization engine of the backend
   capture §5).
6. **First process-tier plugin** — graduation when a capability owns schema,
   migrations, and domain transactions.

## 7. Related

- Suite: [`capture-system.md`](./capture-system.md) · [`capture-map.md`](./capture-map.md) · [`decisions.md`](./decisions.md) · [`issues.md`](./issues.md) · [`changelog.md`](./changelog.md) · [`handoff.md`](./handoff.md)
- Child capture: [`../032-Plugin_Backend/backend-architecture.md`](../032-Plugin_Backend/backend-architecture.md)
- Design archive (source corpus, 2026-09-14): `~/projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/{VISION.md,plugin-system-kickoff.md,provenance-research.md,OBSERVATIONS.md}`
- fs-dev relatives: `../029-Composable_Views/` (L1–L6 platform track), `../012-App_Federation/`, `../016-Per_View_Agents/`, `../018-Local_Model_Toolbox/`, `../025-Chat_Composition_Roadmap/` (SPEC-00 excludes plugins; chat road complete)
- Platform anchors: `../../Wiki/010-Events_And_Ledger/` (provenance/ledger), `../../Wiki/005-Enforcement/001-Code_Standards/` (routed standards)
- External contract reference: `~/projects/solobooks/` (app-domain graduation shape)
