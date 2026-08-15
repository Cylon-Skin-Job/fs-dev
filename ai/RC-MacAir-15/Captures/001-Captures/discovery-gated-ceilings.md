# Discovery-Gated Ceilings — Point-of-Discovery Docs, READMEs as Wiki Sub-Articles

**Date:** 2026-07-04
**Status:** Capture from design riff. Generalizes the two-tier principle from `full-permissions-safety-architecture.md` into a reusable design pattern with two known instances.

## The Pattern

Some surfaces deliberately have two ceilings:

- **UI tier** — safe, curated, survivable. Everything reachable by clicking is blast-radius-bounded.
- **File tier** — the infinite ceiling. Deliberately unadvertised in the UI; you have to find it. Discovery is the gate, curiosity is the credential.

**Documentation rule: docs live at the point of discovery.** A README sits in the folder you had to find. The person who just found the folder is *exactly* the audience — no one else needs the warning label, and putting it in the UI would advertise the ceiling the design deliberately hides.

## READMEs as Wiki Sub-Articles

The wiki gets a section (e.g. Config) with an authored **summary article** (intent layer), whose sub-articles **are the on-disk READMEs themselves** — one file, two homes:

- On disk, next to the thing it documents (found at the moment of discovery).
- In the wiki knowledge graph (found at the moment of research).

**Mechanism (RESOLVED 2026-07-04): canonical home is the wiki; the README is the link.** The wiki keeps full control of folder names and ordering — the article lives as a real `PAGE.md` inside normal numbered wiki folders:

```
Wiki/.../001-Configs_Files/PAGE.md          ← section summary (authored)
Wiki/.../001-Configs_Files/Agent_Modes/PAGE.md   ← the article (canonical)
```

At the point of discovery, the config folder holds a **symlink named `README.md`** pointing at that `PAGE.md`. Link name is independent of target name (Decision 12's label-from-link property, applied to a file) — so it's `PAGE.md` where the wiki scanner needs it and `README.md` where a human browsing the folder expects it. No scanner changes, no fallback logic, no copies. The appears-in note (Decision 21) states the dual-location truth on the page.

**Frontmatter: the same trick as everywhere.** The quartet renders as the article chrome — `name` becomes the title, `description` the summary line, then the body:

> **Modifying Agent Modes and Permissions**
> Create, delete and modify agent modes. Create custom permission profiles for each mode. Hide/Show profiles in UI dropdown.
> *(body)*

So READMEs are just articles: quartet frontmatter, audit-eligible, children-marker-eligible, versioned in `.archive/` like anything else. Edits happen at the canonical wiki path (a link inside a `settings/` folder correctly bounces AI writes through the link path; the wiki home stays writable).

Known trade-off, accepted: GitHub does not render symlinked READMEs (it shows the link target path), so the in-repo GitHub browsing experience loses the pretty README. The audience for point-of-discovery docs is in-app, and the canonical article is fully readable in the tracked Wiki tree on GitHub anyway.

**Bonus, and it's a big one: symlinked READMEs join the audit loop automatically.** As wiki articles they carry `source-files` (the folder they document), so Decision 7's git-freshness applies — change the config schema and the config README is deterministically flagged stale. Point-of-discovery docs usually rot precisely *because* they live outside any review system; this wiring puts them inside ours.

## Instance 1: The JSON Permission Config

README in the config folder: what each block does, the mode semantics, what YOLO actually unlocks, what the snapshot/ledger net does and does not catch. Linked into the wiki Config section as above. (See `full-permissions-safety-architecture.md` for the two-tier permission surface itself.)

## Instance 2: CSS / Themes

The second known instance, same shape:

- **UI tier:** theme picker / color settings — the curated cascade (system → workspace → view), safe by construction.
- **File tier:** all CSS is picked up from folders inside the ai/ workspace folder. Infinite ceiling: a user can make their workspace a full clown show — Joker-esque neon, not a single matching color — and that is a *feature*. Their machine, their aesthetic; enforcement constrains the AI, never the user.
- README in the CSS/theme folders: how pickup works, the token vocabulary, the cascade order, how to not break rendering (and that you can't really break anything permanently — snapshots).

## Open Threads

>> ~~Naming collision~~ RESOLVED — canonical `PAGE.md` in the wiki, symlink named `README.md` at the discovery point. See Mechanism above.
>> ~~Frontmatter~~ RESOLVED — full quartet, same rendering trick as every article (name → title, description → summary, body).
>> Types registry: does this warrant a distinct `type` (e.g. `readme`) in Decision 16's registry, or is it `guidance`/`article` with the appears-in note carrying the rest? Lean: no new type until the audit shows these need different rule treatment.
>> Enumerate other candidate instances: prompt folders? trigger files? dispatcher routes folder (opencode-harness-integration)? Anywhere the file tier outreaches the UI tier.
>> Does the Config wiki section's summary article get generated children markers pulling name/description from README frontmatter — i.e., do READMEs participate in the children-marker system too?
