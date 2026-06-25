---
title: Styleguide
description: Writing conventions for System Viewer documentation.
icon: edit_note
---

# Wiki Edit Styleguide

Conventions for writing and editing articles in the System Viewer wiki.

---

## File Organization

```
content/{section}/
├── {section}_guide.md          # Root guide — overview + table of contents
├── ai.md                        # AI implementation notes (backend details)
├── {Category}/                  # Subfolder for article groups
│   ├── article_one.md
│   └── article_two.md
└── resources/                   # Reference docs, taxonomies, templates
    ├── Styleguide.md
    └── ...
```

---

## Front Matter

Every markdown file must begin with YAML front matter:

```yaml
---
title: Article Title
description: One-sentence summary for SEO and previews.
icon: material_icon_name    # Optional. See Google Material Symbols.
---
```

Rules:
- `title` — sentence case, no trailing period.
- `description` — 80–160 characters, describes what the reader will learn.
- `icon` — a valid [Material Symbols](https://fonts.google.com/icons) name, lowercase with underscores.

---

## Progressive Disclosure Format

Articles follow a top-down disclosure pattern. Each `---` (horizontal rule) separates a self-contained section that can be scanned independently.

```markdown
# Article Title

One-paragraph elevator pitch. What this is and why it matters.

---

## Section One

Body text. Keep paragraphs short (2–4 sentences).

---

## Section Two

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |

> **Note:** Callout blocks for warnings, tips, or important caveats.
```

Rules:
- Start with an H1 (`#`) matching the front-matter `title`.
- Use H2 (`##`) for major sections separated by `---`.
- Use H3 (`###`) sparingly, only inside large H2 sections.
- Every article ends with a "Status Reference" table if the feature has visual states.

---

## Linking Convention

Links between articles use **relative paths** from the current file's location:

```markdown
<!-- From 002-System/001-Connectors/PAGE.md -->
See the [Mail guide](001-MacOS_Connectors/001-Apple_Mail/PAGE.md).

<!-- From 001-MacOS_Connectors/001-Apple_Mail/PAGE.md -->
See the [Connectors overview](../../PAGE.md).
```

Rules:
- Never use absolute URLs for internal wiki links.
- Prefer descriptive link text over bare URLs.
- If linking to a section anchor, use `#section-slug`.

---

## Writing Tone

- **Address the user directly** — "You can enable..." not "The user can enable..."
- **Active voice** — "Fusion Studio reads the database" not "The database is read by Fusion Studio."
- **Specific over vague** — "~1,400× faster" not "much faster."
- **Action-oriented headings** — "How It Works" not "Implementation Details."

---

## Terminology

| Use This | Not This | Reason |
|----------|----------|--------|
| MacOS | macOS | Project convention |
| Fusion Studio | the app, FS | Consistent product name |
| System Settings | Preferences | macOS Ventura+ naming |
| Full Disk Access | FDA | Spell out on first use, then acronym OK |
| connector | plugin, integration | Unified term |

---

## Status Reference Table

Any article describing a feature with visual states must include:

```markdown
## Status Reference

| Color | Meaning |
|-------|---------|
| **Gray** | Feature is off. |
| **Yellow** | Waiting for permission or loading. |
| **Green** | Active and working. |
| **Red** | Error — check permissions or logs. |
```

---

## AI-Facing Articles

Files named `ai.md` are **not shown to end users**. They contain:
- Backend architecture notes
- Database schemas
- Event bus integration details
- Implementation TODOs

Write `ai.md` in a terse, reference style. Bullet points over prose. Code snippets over explanations.
