# Plugin System — Open Issues

**Capture:** root issues/gates record · **Parent:** [`plugin-system-vision.md`](./plugin-system-vision.md)
**Status:** living record · **Updated:** 2026-09-15 · **Prefix:** `PLUG-I###`

## Design queue (gravity order)

| ID | Issue | Status | Note |
|---|---|---|---|
| PLUG-I001 | **Classification:** policy vs contribution vs content vs platform; the universal test doesn't separate preinstalled plugins from system config (kickoff Q13). | **Open — next design item** | Gates consent treatment and the manifest grammar (VISION §3, §6.1). |
| PLUG-I002 | **Atomic unit:** one manifest with typed contribution sections, or distinct plugin kinds each with a lifecycle (kickoff Q1). | Open | Must settle before grammar freezes. |
| PLUG-I003 | **Permission vocabulary + manifest shape** (final scopes list, request syntax). | Open — draft in progress | Mockup uses a provisional list (`read`, `write`, `events`, `network`, `secrets`, `exec`, `models`, `notify`). |
| PLUG-I004 | **Write boundary:** territory-only mutations with everything else ticketed, or broader granted scopes (kickoff Q3). | Open | Interaction default is settled (PLUG-D007); extent is not. |
| PLUG-I005 | **Trust tiers:** owner-authored placement-trust only, or third-party tier (signing/review/sandboxing) from day one (kickoff Q2). | Open | Third-party eventually; day-one scope undecided. |
| PLUG-I006 | **Automation runtime:** schedule syntax, event vocabulary, missed-run surfacing, harness delegation (kickoff Q4). | Blocked by `AUT-D01/D02/D03` | Local run records can be shaped now (`automation.runId`/`kind` settled). |
| PLUG-I007 | **Tool surface:** native capability registry, MCP bridge, or both; how plugin tools appear per harness (kickoff Q5). | Blocked by `TOOL-D01/D02` | |
| PLUG-I008 | **Producer registration:** how plugin emitters enter the producer registry — server registers from the manifest, or manifests declare entries (kickoff Q8). | Open — design free | The plugin↔provenance seam; design now, wire when gates close. |
| PLUG-I009 | **Actor identity:** stay inside existing enums (`script`, `trigger`, `scheduler`, `sync`, `agent`, `system`) or propose a `plugin` actor (kickoff Q9). | Open | Taxonomy change if pursued. |
| PLUG-I010 | **UI→trigger initiation** is undefined; clicks firing workflows would be a new registration decision (kickoff §2i correction). | Open | Not defined in current specs. |
| PLUG-I011 | **View-scope activation plumbing:** spawns hardcode `viewId: null`; re-plumb `panel_changed` / `thread_groups.view_id` before view skills attach per turn (kickoff Q12). | Open — dependency | Needed for the view layer of injection. |
| PLUG-I012 | **`System_Manager` bundled defaults vs catalog tier** (README open item). | Open | Affects machine-scope seeding. |
| PLUG-I013 | **Catalog mechanics:** folder layout, Browse index/manifest, merge placement in fs-dev, public-repo mechanics (README open item). | Open | Mockup reader is tolerant/provisional. |
| PLUG-I014 | **Slice ownership on uninstall:** retain, export, or purge — per-plugin owner choice at revoke time (kickoff §2e). | Open | |

## Platform gates touching plugins

From `provenance-research.md` §11: `UEB-D01`, `RSC-D16/D17`, `AUT-D01/D02/D03`,
`TOOL-D01/D02`, `AUD-D01`, `LED-D01–D04`, `ULV-D02/03/04/05/09/10/12`,
`CHAT-D01`, Solobooks `SOL-A004/A006/A007/A009`, `SOL-I002/I006/I007/I008`,
`RCC-0113`. Gate → what-it-blocks mapping lives in the backend capture (§6).
