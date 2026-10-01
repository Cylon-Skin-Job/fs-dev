# Capture System — How This Suite Works

**Capture:** the trickle-down / roll-up conventions for the plugin-system suite
**Status:** binding for this suite's captures; owner-directed 2026-09-15
**Updated:** 2026-09-15

---

## 1. Structure

One **root capture** holds the program vision. **Child captures** cover one
domain each (backend first; one per view as execution begins). Captures are
separate sections in the Captures view (`../NNN-Name/`), linked by this system —
not nested folders.

```
030-Plugin_System/          ← root: vision, system, map, decisions, issues, changelog, handoff
032-Plugin_Backend/         ← child: backend architecture, changelog, handoff
[...]-Plugin_View_<name>/   ← children to follow organically
```

## 2. Trickle-down

1. The root's vision, principles (P1–P7), vocabulary, and `decisions.md` are
   **binding on every child capture**.
2. A child inherits without restating: principles, decision IDs, terminology
   (plugin, capsule, definition/instance, trust root, territory).
3. A child that must diverge records the conflict in its own `decisions.md` or
   `issues.md` and raises it up — **only the owner resolves**; the root decision
   is updated and the change noted in both changelogs.
4. Changes flow one way for written records (root → child) and one way for
   discovery (child → root), never sideways silently.

## 3. Roll-up

- Every capture keeps its own `changelog.md` and `handoff.md`.
- Material findings and decisions-needed surface in the child's changelog and
  handoff; when promoted, the root `decisions.md` / `issues.md` get the entry
  and the root changelog gets one line referencing the child.
- Handoffs are per-capture: each session replaces `handoff.md` and appends the
  prior one under "Previous handoffs" with its date.

## 4. Mandatory files per capture

| File | Rule |
|---|---|
| `changelog.md` | Append-only; newest first; `YYYY-MM-DD — entry (capture)` lines; links to docs/decisions. |
| `handoff.md` | Current state, next actions, open decisions, constraints; prior handoffs kept below. |
| Root doc | The capture's spine (vision, architecture, etc.) — named descriptively. |
| `decisions.md` / `issues.md` | As needed. Root uses `PLUG-D###` / `PLUG-I###`; children use their own prefix (`BE-D###`, `BE-I###`, `V<name>-D###`). Promote material ones to the root. |
| `capture-map.md` | Root only. The cross-read hub. |

## 5. Doc header contract

Every capture doc starts with:

```
**Capture:** <name> · **Parent:** <root link or "none (program root)">
**Status:** <working | owner-directed | superseded | ...>
**Updated:** <date>
**Trickle-down:** <what it inherits> · **Roll-up:** <what it feeds upward>
```

## 6. Cross-reading

- `capture-map.md` (root) is the single hub: every capture, source archive, and
  related fs-dev capture is listed there with its purpose.
- Every doc links **up** (parent) and **sideways** (Related section). The map
  links **down**.
- Relative links (`../029-Composable_Views/...`) for fs-dev siblings; absolute
  `~/projects/...` paths for archives outside the repo.

## 7. House rules that still apply

- The Captures-view contract wins: numbered section folders; flat `.md` files
  only; no content files in the Captures root; descriptive kebab-case filenames.
- Routing unchanged: pure information → this suite; actionable-but-loose →
  `../003-TODO/`; actionable-and-precise → `../002-SPECs/` or a roadmap bundle.
- SPECs remain the executable layer; captures are the design layer; the Wiki
  becomes the living reference once behavior ships.
