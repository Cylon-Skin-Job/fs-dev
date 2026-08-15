---
name: captures
description: Save loose ideas, exploratory discussion, and lightweight todo items into durable workspace captures for later reference.
---

# Captures

Use this skill when the user wants to save ideas or lightweight tasks for later without turning them into an implementation spec.

Trigger phrases include:

- "Let's save these ideas."
- "Capture that."
- "Capture what we have so far."
- "Let's create a capture."
- "Capture these for later."
- "Let's make a ToDo list."

## Destinations

- Use `ai/Captures/001-Captures/` for loose, exploratory, not-yet-actionable ideas.
- Use `ai/Captures/004-ToDo/` for small actionable items that are somewhat decided but do not need a spec.
- Reference `ai/Captures/001-Captures/README.md` and `ai/Captures/004-ToDo/README.md` when present.

## Guidance

- This is not a RIF/spec session.
- Do not force loose ideas into an implementation plan.
- Preserve uncertainty, options, feelings, questions, and possible directions.
- If the idea is abstract or still forming, create or update a capture.
- If the items are small, actionable, and somewhat decided, create or update a To-Do list.
- If the work has clear scope, acceptance criteria, and implementation intent, suggest `spec` instead.
- If the user wants to keep exploring after capture, suggest `curiosity` as a natural next mode.

## Capture Shape

Captures should be easy to reference later. Prefer concise markdown with:

- Context.
- Ideas discussed.
- Open questions.
- Possible directions.
- Things that are not decided yet.
- Related files, wiki pages, issues, or specs when known.

## To-Do Shape

To-Do captures should be simple and actionable. Prefer:

- Clear checkbox items.
- Short context.
- Optional priority or grouping.
- No overbuilt spec structure unless the list grows into real implementation work.
