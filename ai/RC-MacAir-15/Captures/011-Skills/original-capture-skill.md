> Fossil — preserved 2026-07-13. This was the original Claude Code capture skill, written before Fusion Studio existed. It reads like a spec for the app: manifests, auto-conversion boot jobs, UI icons. Superseded by the capture-artifacts-and-docs skill and the Captures root README.

---
name: capture
description: Capture folder rules - Context Objects, naming conventions, manifests, and workspace conversion
---

# Capture Folder Rules

This folder holds Context Objects. Every subfolder is a capture or workspace.

---

## Capture vs Workspace

**Capture (1-2 md files):**
- Screenshot + md, OR just an md
- Atomic, simple unit
- Gets capture icon in UI

**Workspace (3+ md files):**
- 3 or more md files
- Can contain captures
- Captures can contain workspaces
- Gets workspace icon in UI

**Conversion:**
- JS boot job auto-converts capture → workspace when 3rd md is added
- Configurable via JSON (user can disable)
- User can manually request conversion anytime

---

## Naming Convention

**3 slugs.** Descriptive. Easy to locate.

```
{what}-{about}-capture/
{what}-{about}-workspace/
```

If user doesn't specify a name, generate one from what it contains.

---

## Manifest

`capture/manifest.json` lists everything:

```json
{
  "items": [
    {
      "folder": "new-capture-system-capture",
      "name": "New Capture System",
      "description": "Context Object architecture, visual layer",
      "type": "capture | workspace",
      "created": "2026-01-30",
      "status": "active",
      "md_count": 2,
      "tags": ["architecture", "context-object"]
    }
  ]
}
```

When creating or converting, update manifest.json.

---

## What You Can Do Here

When this folder is in your context:

1. **See all items at once** — Read manifest.json for name + description
2. **Find patterns** — Suggest connections organically
3. **Surface intersections** — Notice related ideas across items
4. **Check md_count** — Know if something is about to convert
5. **Offer connections** — "This relates to {other-item}..."

---

## Structure

**Capture:**
```
{slug}-capture/
├── capture.md         # The idea (1)
├── summary.md         # One-liner (2)
├── chat_logs.json
└── ledger.json
```

**Workspace (after 3rd md):**
```
{slug}-workspace/
├── capture.md         # Original idea
├── summary.md         # Overview
├── original-list.md   # 3rd file → triggered conversion
├── (more .md files)
├── chat_logs.json
└── ledger.json
```

---

## No Subfolder Rules

Rules apply at the capture/ level only. Individual items inherit this rule. Do not create rules for specific captures, workspaces, or their children.
