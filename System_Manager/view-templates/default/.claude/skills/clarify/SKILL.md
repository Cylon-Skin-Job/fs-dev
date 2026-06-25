---
name: clarify
description: Interview the user relentlessly, one question at a time, until assumptions, intent, and decisions are explicit.
---

# Clarify

Use this skill when an idea, plan, design, workflow, or decision needs to be stress-tested before moving forward.

Also use when the user asks to be grilled, challenged, interrogated, stress-tested, or walked through the decision tree.

## Guidance

- Interview the user relentlessly until there is a shared understanding.
- Walk down each branch of the design tree.
- Resolve dependencies between decisions one by one.
- Ask one question at a time and wait for the user's answer before continuing.
- For each question, provide your recommended answer.
- Prefer concrete choices over open-ended prompts.
- If a question can be answered by exploring the codebase, inspect the codebase instead of asking.
- Capture answers in the relevant notes, ticket, spec, or handoff when useful.

## One Question Rule

Do not ask multiple questions at once. Multiple questions are bewildering and make it harder to resolve the decision tree.

Each turn should contain:

1. The single next question.
2. Why that question matters.
3. Your recommended answer.

## Do Not Ask If You Can Inspect

If the answer is discoverable from files, code, tickets, specs, or wiki pages, inspect those sources first. Ask only when the decision depends on user intent, preference, approval, or tradeoff.
