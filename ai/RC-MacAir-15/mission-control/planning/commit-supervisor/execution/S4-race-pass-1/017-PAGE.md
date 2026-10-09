---
name: "User Profile, Preferences and Design Philosophy"
description: Working guidance for communicating with the owner, shaping software, coordinating automation, and keeping human decisions at the right points.
metadata:
  source-files: []
  last-modified: "2026-09-27T22:46:36Z"
---

## Purpose

Use this profile to make collaboration clearer and to keep owner attention focused on intent, steering, and architectural choices. It records preferences stated by the owner and practical interpretations for agents. It is not a substitute for a task-specific instruction: the owner's current direction takes precedence.

## Knowledge and Experience

The owner is actively shaping Fusion Studio, its architecture, wiki, and AI-assisted development workflows. They reason about product boundaries, code standards, tickets, SPECs, roadmaps, dependencies, agent roles, and human review points. Treat them as a capable product and architecture decision-maker in this context.

Do not infer expertise in every programming language, library, or technical specialty from that context. When a concept may be unfamiliar or affects a decision, explain it in plain language as it comes up. Avoid both unexplained jargon and remedial explanations of ideas the owner is already using fluently.

## Explanation Style and Depth

- Lead with the answer, outcome, or decision needed.
- Use plain language. Briefly explain a technical term when it matters to the discussion.
- Give enough reasoning to make tradeoffs, risks, and evidence understandable; scale depth to the importance and complexity of the decision.
- Prefer a clear recommendation and its consequences over a long menu of possibilities. Surface alternatives when they change the decision.
- Keep routine status updates concise and reserve detail for meaningful changes, decisions, failures, and work that needs the owner's attention.

## Scope and the 80/20 Preference

The owner prefers avoiding technical debt over pursuing a simplistic 80/20 rule. A useful baseline may ship with known edge cases unresolved only when later work can fix them without being impaired by intervening changes. If new work would compound the issue, constrain the fix, or make the eventual correction harder, stop and ask the owner before proceeding.

For any deferred requirement or edge case, state what the current work will do, what remains unresolved, and whether later changes could make that resolution harder. Do not quietly relabel unfinished requirements as optional polish or claim a limitation is acceptable "as long as we never need" something when that future need has not been ruled out. Compare the tradeoff against the app's core philosophy and intended direction.

## Reuse, Services, and Abstraction

Before proposing a bespoke solution, check for existing functions, components, or services that can be reused or extended. Ask whether behavior belongs in a server function that may feed more than one app, view, or renderer; whether it can become a universal API when needed; and whether consumer boundaries remain split as intended. Consider a shared service when behavior is likely to serve multiple callers, needs a stable contract or independent lifecycle, or would benefit from finer-grained reuse later. Explicitly check whether the change duplicates existing functionality.

Prefer the smallest abstraction that addresses a demonstrated need. Plausible future reuse is a reason to consider a design, not by itself a reason to create a general-purpose framework. Keep files below 400 lines as a design goal to make AI changes focused and reduce the chance that edits break neighboring behavior. When a file approaches or exceeds that goal, look for cohesive seams to split responsibilities; explain and justify an exception when a split would make the design worse. Check that the change does not create a god file, violate code standards, or weaken the overall architecture. Where adjacent code falls short, consider focused SPEC work to bring it up to standard instead of extending the weaker pattern.

## Software Design Philosophy

The owner's stated design reference is John Ousterhout's *A Philosophy of Software Design*. Apply its spirit by making complexity visible, deciding what matters, and favoring designs that hide implementation detail behind clear, useful interfaces. Prefer deep modules and purposeful generality where they simplify the system as a whole; avoid adding layers that make the design harder to understand.

This is a guiding reference, not a claim that every decision has one universally correct answer. Explain the complexity a design removes as well as the complexity it introduces. See the [author's book page](https://web.stanford.edu/~ouster/cgi-bin/aposd.php).

## Human Decisions, Reversibility, and Git Publishing

Keep a person involved at irreversible or difficult-to-reverse failure points. Human checkpoints also help the owner understand what is changing in the codebase and reflect on product and architecture choices.

Autonomous agents may inspect, draft, build, evaluate, and prepare local integration work within their assigned scope. They must not autonomously push or pull to GitHub or GitLab. Publishing is an attended decision: report the completed work and its evaluation, then wait for the owner's explicit instruction to push. A successful agent review does not itself grant publishing authority.

Where an approved workflow requires owner acceptance between SPECs or before another consequential stage, preserve that checkpoint. Keep the report focused on the outcome, evidence, deviations, and the decision needed; do not make the owner repeat review of routine work that can be evaluated and summarized reliably.

## Intake, Shaping, and Delivery

The owner wants to steer intent, resolve meaningful ambiguity, and make architectural choices while grounded work proceeds autonomously between those decisions. Unspecified intent should be recorded and raised as an issue; an agent should not present an assumption-filled roadmap as finished.

For shaping work, build from an initial draft into researched and reviewed material. Enrich the draft with code impact and dependencies, applicable code standards and wiki updates, risks, unresolved questions, and needed approvals. Use independent review steps where they add a distinct perspective. Roadmaps may continue with unresolved edge cases when later fixes remain viable and will not be impaired or compounded by the planned work. If the work would make a later fix harder, constrain its options, or compound the underlying issue, stop and ask the owner. Otherwise, use fail-forward for correctable deviations and record them clearly rather than stopping the whole process.

## Attention and Mission Control

Mission Control's purpose is to supervise ongoing work and manage the owner's attention at the right level of detail. It should keep a durable record of roadmap and branch state, completed and pending work, dependencies, deviations, and decisions needed. It should bring the owner a concise, actionable update when their input is needed or when a meaningful milestone, failure, or completion changes the picture.

The goal is to let the owner be the minimal necessary bottleneck: available for conveying intent, steering, and architecture, while bounded and reversible work runs without constant interruption. Background activity should preserve awareness, not create a stream of low-value notifications or leave the owner surprised by what has changed.

## Calibration Question

- Beyond unresolved intent, architecture choices, work that could impair a later fix, required workflow checkpoints, and attended GitHub/GitLab publishing, which decisions should always be brought to the owner?
