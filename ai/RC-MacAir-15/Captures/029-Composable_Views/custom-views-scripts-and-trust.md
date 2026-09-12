# Custom Views, Scripts on a Schedule, and the System-Folder Trust Line

**Captured:** 2026-09-11, follow-up riff to `composable-views-vision.md` (same session)
**Status:** vision, not a SPEC. Companion capture — read the vision doc first.

---

## 1. The trust line (answers direction for the vision's open question #3)

RC's stated design direction:

- **The System folder is off-limits to the assistant without explicit user
  input.** Assistant-proposed changes to System contents require the owner's
  involvement, by rule.
- **View folders move into System.** A view that lives under System is,
  by placement, owner-vetted.
- This placement-based gating **is** what facilitates the plugin
  architecture: "scooped-up" server-side JavaScript (vision doc L5) is safe
  not because it's sandboxed, but because of **where it's allowed to come
  from** — a System location the assistant cannot write to without the
  owner saying so.

Open question #3 (JS trust boundary) now has a direction: **placement =
trust**, with the assistant's System write-gate as the enforcement rule.
Remaining SPEC work: whether placement alone is sufficient (vs defense in
depth — sandboxing/manifests), and where the assist-gate is enforced
(session discipline, tool permissions, or server-side refusal).

## 2. The long-term product vision (what most usage looks like)

RC's long-term vision for what a person actually does in this app:

> Create a **custom view** plus some **scripts set to run on a cron or
> trigger** — so if they want to download research studies every 24 hours,
> or create a bespoke RSS feed as a daily inbox, or pull calendar events in
> and have a daily agenda created every morning, etc. Whatever presentation
> of data and navigating/browsing that data — **without building a node
> server and manually running the script each time.**

This adds a layer the vision doc didn't name:

```
L6  AUTOMATION RUNTIME (new layer from this riff)
    User scripts on cron or trigger, run by the server:
      - download research studies every 24h
      - bespoke RSS feed → a daily inbox
      - calendar events → a daily agenda doc, every morning
    Scripts write their output into the data layer (files or
    provisioned DB slices, L4); views (L1-L3 presets) present
    and navigate it.
    The loop: custom view (config) + scheduled script (automation)
    = an app. No node server, no manual runs.
```

## 3. How the pieces interlock

- **L5 + L6 share the scoop-up mechanism:** server-side user JS, gathered
  from System-gated locations. Same trust line governs both (module code and
  scheduled scripts).
- **L4 gains producers:** the data slices views present are written by L6
  automations, not only by the user or AI sessions. A "daily inbox" is a
  slice with a script feeding it and a view presenting it.
- **Creation flow for a user app:** pick/duplicate a view preset (L1
  sample-config strategy) → scope it to a data location → drop/schedule
  scripts → the server provisions and serves it. The three-tier story
  (presentation config + data slice + automation) is the product's unit of
  extension.
- **Open tie-in:** relationship between scheduled scripts and the existing
  harness delegation (OpenCode et al.) is undecided — plain JS modules,
  harness tasks on a schedule, or both. Park for the SPEC.

## 4. New open questions from this riff

1. Scheduler design: cron syntax? event triggers? what event vocabulary
   (file-write, message, time)? Where do schedules live (config? System?)?
2. Output contract: do automations write files only, DB slices only, or a
   declared mix? Error/missed-run surfacing in the UI (a failed nightly
   download must be visible somewhere).
3. Assistant boundary mechanics: how is the System write-gate enforced in
   practice for AI sessions (tool permissions, server refusal, convention)?
4. Do scheduled scripts get provenance records (BRIDGE-01 relevance: an
   automation is an actor; its outputs are tool-provenance events)?
