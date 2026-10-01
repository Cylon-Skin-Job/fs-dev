# Plugin Backend — Architecture

**Capture:** backend capture · **Parent:** [`../030-Plugin_System/plugin-system-vision.md`](../030-Plugin_System/plugin-system-vision.md)
**Status:** working architecture — not a SPEC; design phase
**Updated:** 2026-09-15
**Trickle-down:** root vision, P1–P7, vocabulary, `PLUG-D###` decisions
**Roll-up:** backend findings → this capture's changelog/handoff; material ones promote to the root capture

---

## 1. Purpose

This capture is the backend interpretation of the plugin system: what the server
must do for each layer, how the provenance platform binds to it, what is free to
build now versus what waits on platform gates, and the playbook for lifting
existing server capabilities into plugin-shaped services — the "modularize bit
by bit, serve up APIs, make into plugin" engine.

## 2. What the gates block — and why the plugin system is free to move

The provenance gates (SPEC-32–40 and the Solobooks decisions) are decisions
about **what the platform publishes and retains as canonical fact**: envelope
shapes, event families, hashing/redaction policy, retention, storm control,
audit tables, and the tool/automation contracts. They are **not** decisions
about how plugins are packaged, trusted, or consented. That line is load-bearing
because it says which majority of the plugin system can be built, shipped, and
iterated now without rework: everything on the *authorization* side of the trust
contract.

The plugin system can run on **local facts** — consent records, per-file
hashes for tamper detection (kept out of provenance fields, because LED/ULV
forbid coupling content hashes today), territory locks, the Plugins view and
its register flow, enforcement, local workflow run records. The one discipline
that makes deferral safe: shape local facts against the parts of the
provenance contract that *are* settled — durable `automation.runId` and `kind`,
outcome carried in the envelope's lifecycle status rather than a second status
field, server-assigned actor and cause — so closing the gates is a **wiring
step at the producer boundary, not a rewrite**. Five postures make that promise
real:

1. Only server-registered producers emit; unregistered emitters are rejected
   (`unregistered_producer`).
2. The server assigns actor and cause; plugins never declare them.
3. Provenance fails open: it never delays, rolls back, or suppresses the
   source operation.
4. Subscriber/plugin work is async-only and bounded — no plugin callbacks in
   capture or command-response paths, no inline retry, no unbounded deferred
   work.
5. Consent hashes stay in our store, never welded to ledger hashes while
   LED/ULV policies are undecided.

**Blocked:** canonical automation result/lifecycle semantics (`AUT-D01/D03`),
tool contracts (`TOOL-D01/D02`), the app-domain event family for database
changes (`SOL-D008` analogue, unapproved), ledger payload hashing/retention
(`LED-D01`, `ULV-D10/D12`), storm control/compaction (`ULV-D04`), audit
persistence (`AUD-D01`), plus two registration decisions that don't exist yet:
whether UI actions may fire triggers (kickoff §2i correction) and how plugin
emitters enter the producer registry (kickoff Q8).

**Free to move:** classification, the mockup, enforcement, manifest/permission
grammar, the consent ceremony, hashing and the Register diff, territory locks,
local run and inbox records, producer-registration *design*, and skills/agent
assembly. The seam between the halves is the **producer registry** — design it
now, wire it later.

One caveat: two provenance vocabularies coexist in-tree (SPEC-32 canonical
types versus the BRIDGE-01 carrier). The accepted stack (BRIDGE-01 mediated
saves, PROV-01 shell authority, the event-registry carrier) can carry some
plugin-adjacent evidence today — file mutations, UI context — but
plugin-*emitted* facts are not part of it. "Emit later" needs a single
acknowledged adapter target when the gates close.

## 3. The layers

**1. Classification** — The system's first act is deciding what class something
belongs to: policy, contribution, content, or platform. Policy sets values for
known keys (System config, harness policy, shell config); contribution declares
typed capabilities and carries an install/enable/consent lifecycle; content is
created in place and edited like files; platform is chrome that is never
modular. The class — not the folder, not the author — decides everything
downstream: whether a manifest exists, whether bytes get hashed, whether consent
applies, and who may edit what.

This is still the flagged next design item because the universal test alone
doesn't separate preinstalled plugins from system configuration; `shell` is
universal and never a plugin, while the owner's own corpus is universal and
ships as preinstalled modules and default views. Until that resolves (kickoff
Q13), consent treatment inherits the ambiguity and the grammar shouldn't freeze.

**2. Package** — A plugin is a folder with a manifest: it declares typed
contributions, requests capabilities, and runs an install/enable/consent
lifecycle. Categories are human organization, not enforcement — any plugin in
any category may request anything, and grants are per-plugin. Placement itself
is the trust signal: workspace scope lives at
`ai/<machine>/System/plugins/<category>/<plugin>/`, machine scope lives in a
Fusion-managed home outside any repo, and the catalog distributes into both.

The container is deliberately hybrid: top-level category folders are the
registry, while a rich plugin (especially a view) may carry interior `agent/`,
`skills/`, `templates/`, and `workflows/`. Category names are identical in every
scope so a plugin can be promoted workspace→machine without restructuring; the
definition/instance split keeps the plugin as definition while the existing view
capsule stays a thin instance.

**3. Contributions** — The typed things a plugin can contribute: behavior
(`views`, `chat`, `hooks`, `tools`, `api`, `agents`, `skills`, `workflows`,
`triggers`), systems (`models`, `data`), and scaffolding (`templates`,
`assets`), with `shell` platform-owned and never a category. The open
atomic-unit question — one manifest with typed sections versus distinct species
with separate lifecycles — doesn't block the mockup but must settle before the
grammar freezes.

Each contribution type needs a defined server interpretation — routing,
registration, runtime, surface — and the mechanism stays system-owned:
declarative variance (includes, precedence, patterns, toggles) is the sanctioned
form; anything that requires replacing platform code is a fork, not a
contribution (P1).

**4. Surfaces** — Where plugins meet the user and the platform. The Plugins view
is the trust root: hard-coded, pinned at the bottom with a shield,
non-removable, non-exportable — the bootstrap rule, since the surface that
governs plugins cannot itself be a plugin. It is the consent ceremony's home and
a security-state indicator.

Capsules and file detail are the other two surfaces. Capsules stay thin
instances while the plugin holds the definition; one plugin can back many
capsules, and disabling a plugin visibly deactivates them. File detail is
platform API, not a plugin surface: renderers and the type registry are
code-owned, editing exists only in a file's own tab flipped to raw, collections
show cards and link into it, and the iframe viewer is the sanctioned escape
hatch for arbitrary plugin UI.

**5. Runtime ladder** — Five rungs from declarative to autonomous: presentation
grammar and configuration (L1–L3), data-source tiers (L4), stateless server-side
composition scripts (L5), the automation runtime (L6), and beyond it graduation
to a managed child process with its own database. The graduation criterion is
settled: when a capability owns a schema, migrations, and domain transactions,
it leaves the module tier.

This ladder is also the modularization path for existing server code: extract a
capability behind a stable command surface and keep it in-process first, so
consumers see an API that doesn't change; promotion to the process tier later
swaps the runtime, not the consumers. See §5.

**6. Authority** — The authorization half of the trust contract. Ownership is
default; access is an explicit grant. Standing access is declared (the
consumer's manifest lists what it consumes, the owner approves through visible
toggles, grants are least-privilege and revocable). Transactional access is
ticketed (a tagged ticket lands in the provider's inbox; the provider's watcher
decides; no watcher, fail closed, visibly). Extension points are the declarative
door (`accepts: subscriptions/*.json` with a schema) where both sides must
build.

Enforcement is server-side territory locks: writes into another plugin's tree
bounce like the settings write-gate unless the target is a declared extension
point or ticket area. Consent binds to bytes: per-file sha256 in the
server-side consent record, verified at load and on change, mismatch
deactivating the plugin into a visible re-authorization with a permission diff.
Off is the signal — never ambient write access.

**7. Evidence** — The provenance half, and where the gates live (§2). Plugins
never publish; the server registers producers, assigns actor and cause, and
rejects unregistered emitters. Today the canonical-publication decisions for
new families are blocked, so the plugin system keeps local records shaped to
the settled parts (`automation.runId`, `kind`, lifecycle status), with the
producer-registry seam designed now and wired when gates close.

Postures are non-negotiable because they make deferral safe: failure open,
bounded and async-only, consent hashes separate. One live caution: the two
coexisting vocabularies need a single acknowledged adapter target when the
gates close.

**8. Injection** — How plugin content reaches the agents. Skills and agent
profiles are assembled per spawn, not discovered by accident: the server
generates a per-spawn harness config from the three scopes (global → workspace
→ view), with view-scoped assets attaching to view-bound threads — a genuine
dependency, since spawns currently hardcode `viewId: null` and need the
activation signal (`panel_changed`, durable `thread_groups.view_id`)
re-plumbed before view scope attaches per turn.

Global roots are harvested read-only, installs are validated copies (never
symlinks), the off-switch maps to `permission.skill` deny on the next spawn,
collision assembly fails loudly rather than silently shadowing, and
`AGENTS.md` composition goes through the ordered `instructions` array because
first-match discovery is not additive. This is where P7 does the most work:
only names and descriptions occupy context; bodies load on demand.

## 4. Command-surface contract

The target shape for any capability that will graduate (settled by the
SoloBooks/RCC-0113 reference):

- `commandId` + `expectedRevision` + bounded receipts; idempotent replay.
- Transactions execute **inside the owner** — never partially across the proxy.
- Restricted proxy between Fusion and the capability; no arbitrary paths, no
  `fusion.db` handles, no raw SQL. Tools express domain intent only.
- Fusion owns the shell, registry, provenance infrastructure, app lifecycle,
  and the proxy; the capability owns its frontend, domain rules, migrations, and
  data.
- Bounded local audit transactionally in the same DB transaction; accepted
  provenance refs are never serialized out to the capability.

A capability satisfying this contract in-process is already plugin-shaped: the
manifest, territory, grants, and producer registration are packaging, not
re-plumbing.

## 5. Modularization playbook (server code → APIs → plugins)

The strangler, applied to the server:

1. **Pick a capability** with a clear data territory and a small blast radius.
2. **Define its surface** — commands (with revision/idempotency/receipts),
   queries, and the events it would publish; keep it declarative.
3. **Refactor in place** so all consumers call the surface; behavior-identical,
   full tests green.
4. **Keep it in-process** (module tier) while it is stateless or ledger-free.
5. **Graduate** when it owns schema, migrations, and domain transactions:
   managed child process + own DB behind the proxy; consumers unchanged.
6. **Package**: folder + manifest, per-plugin grants, producer registration,
   optional view capsule. The extraction made it a plugin; the packaging makes
   it installable.

Selection candidates and the first target are a pending owner decision (see
`../030-Plugin_System/issues.md` `PLUG-I008`; candidates by category: connector/
sync-style subsystems, content services, and domain flows with existing data
territories). The kickoff's recommended first *plugin* remains the inbox
(§2n): it exercises bus subscriptions, view modules, data territory, and grants
without needing a child process — the natural acceptance test of this playbook
before graduation.

## 6. Gate → blocks map

| Gate | Blocks |
|---|---|
| `UEB-D01` | Bus registration semantics for new producers/event types |
| `RSC-D16/D17` | Resource-event contracts and cleanup |
| `AUT-D01/D02/D03` | Automation run results/lifecycle, file-trigger handoff, run/match contract |
| `TOOL-D01/D02` | Tool-call contracts for plugin tools |
| `AUD-D01` | Audit/review persistence |
| `LED-D01–D04` | Ledger payload hashing/retention/query/retry |
| `ULV-D02/03/04/05/09/10/12` | File-version eligibility, retention, storm, redaction, hash, envelope |
| `CHAT-D01` | Chat-provenance coupling |
| `SOL-A004/A006/A007/A009`, `SOL-I002/I006/I007/I008` | App-domain event schema, manifest/transport, DB location, receipt fields |
| `RCC-0113` | Managed child-process + proxy contract (open ticket) |

## 7. Related

- Parent + suite: [`../030-Plugin_System/plugin-system-vision.md`](../030-Plugin_System/plugin-system-vision.md) · [`../030-Plugin_System/capture-map.md`](../030-Plugin_System/capture-map.md) · [`../030-Plugin_System/decisions.md`](../030-Plugin_System/decisions.md) · [`../030-Plugin_System/issues.md`](../030-Plugin_System/issues.md)
- Sources: `~/projects/plug-ins/ai/RC-MacAir-15/Captures/001-Plugin_System/provenance-research.md` (gates, postures), `plugin-system-kickoff.md` (§2c/2e/2m/2n/2q/2r/2s/2t), `VISION.md` (P1–P7)
- fs-dev relatives: [`../029-Composable_Views/`](../029-Composable_Views/), [`../012-App_Federation/`](../012-App_Federation/), [`../018-Local_Model_Toolbox/`](../018-Local_Model_Toolbox/)
- Platform anchors: `../../Wiki/010-Events_And_Ledger/`, `../../Wiki/005-Enforcement/001-Code_Standards/`
- This capture: [`changelog.md`](./changelog.md) · [`handoff.md`](./handoff.md)
