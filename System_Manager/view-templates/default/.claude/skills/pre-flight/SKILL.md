---
name: pre-flight
description: Turn a spec into vertical implementation slices with smoke tests, handoff context, and explicit clarification questions before execution.
---

# Pre Flight

Use this skill before implementation begins on a spec, workflow, or multi-step change.

The goal is to prepare targeted handoffs for individual sessions so each session can execute one vertical slice with the context, memory, files, smoke tests, and pass/fail conditions it needs.

## Guidance

- Read the spec and any referenced tickets, wiki pages, files, or prior notes.
- Inspect the codebase when file paths, APIs, or current behavior can be verified directly.
- Divide the spec into vertical slices that each produce a working, testable increment.
- Define a smoke test after each slice.
- Include the minimum context needed for another session to execute the slice without rediscovering everything.
- Identify blockers, risks, and dependencies before work starts.

## Slice Output

For each slice, produce:

1. Slice name.
2. Objective.
3. Required context and memory.
4. Files or directories likely affected.
5. Implementation boundaries.
6. Smoke test.
7. Pass conditions.
8. Fail conditions.
9. Handoff notes for the next session.

Slices should be narrow enough for targeted work and broad enough to verify real behavior. Avoid horizontal slices like "add database columns" unless the slice can be smoked end-to-end.

## Second Pass

After slicing, make a second pass over the spec.

Add or propose a section in the spec for:

- Assumptions.
- Decisions made on the user's behalf.
- Unclear instructions.
- Open questions.
- Dependencies between decisions.
- Protected changes that need explicit approval.

Then invoke `/clarify` or the `clarify` skill to resolve the list one question at a time.

## Handoff Discipline

Each slice should be suitable for another assistant/session to run independently.

Include enough context to know:

- What is being built.
- Why this slice exists.
- What not to touch.
- Which files to inspect first.
- How to verify the result.
- What evidence to return.

## Do Not Execute Yet

Pre-flight prepares the work. It does not implement the slices unless the user explicitly shifts from planning into execution.
