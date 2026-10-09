# Wiki session contract

## Folder binding

Resolve `wiki_home` from the assignment's absolute path, or the unique current/ancestor directory containing this package's AGENTS.md and `.agents/skills/wiki-update/SKILL.md`. Resolve `repository_root` separately with Git. Read applicable instructions before editing any destination.

Start manual update sessions with Wiki as their actual CWD. Codex discovers local skills/configuration through the launch directory's ancestry; a later shell `cd` is not evidence that startup context was reloaded. Pass absolute `wiki_home`, skill and report paths to every child, since profiles do not set CWD. Verify available roles and delegation capacity. Use a supported generic agent with the exact local role instructions when the named profile is unavailable, and disclose that fallback. If independent or nested delegation cannot run, report the limitation; do not claim the requested hierarchy or independent audit happened.

Profiles inherit the invoking model/effort and permissions. Research and audit are read-only on articles/code by assignment, while allowed to write their own reports. Package scope is an instruction boundary, not an access-control mechanism. No package file changes user-level configuration or registers a recurring automation.

## Manual assignment and baseline

Record the user's requested scope in a unique `.wiki-runs/<UTC-time-and-unique-suffix>/assignment.md` created only when a run starts. Keep this run directory outside article navigation. Check for active overlapping writers before assigning edits; do not interrupt or take over a writer merely because a run looks old.

For a commit-based update, resolve explicit before/after refs to full commit IDs and include adds, renames and deletes. If a relevant prior completed run supplies an unambiguous baseline, name it; never invent a comparison or assume HEAD~1 captures the requested merge. When no usable range or subject was supplied, ask for the scope while performing only useful read-only orientation. A user-requested current-state review instead records HEAD, selected subjects and hashes of relevant dirty/untracked inputs without pretending they are committed.

A merged target and the working checkout can differ. Compare them before describing current behavior. Read the pinned version or a disposable copy as appropriate; do not reset, stash, checkout over, or commit somebody else's work to obtain a clean baseline. Record which source revision each claim uses. Material source drift or changed article bytes invalidates affected conclusions and requires a bounded recheck.

## Assignment packet

Each worker/sub-agent assignment carries:

- Role, run ID, parent role, absolute wiki_home and repository_root.
- User scope, source commits or current-state snapshot, approved intent sources, and explicit exclusions.
- Bounded questions/articles and expected evidence, including relevant unchanged callers/consumers.
- Exact writable article paths (Repair only) and unique report destination; other files are read-only.
- The applicable absolute skill path, existing finding IDs and completion/stopping conditions.

Workers are not alone in the repository: preserve other edits and adjust to concurrent work. Parents partition responsibilities; no two repair assignments own the same article, heading or generated block concurrently. Sub-agents return evidence to their worker; the worker synthesizes one report to the supervisor. No nested worker may silently broaden its write scope. A task identifier is not necessarily a persistent chat UUID; record only observed identities.

## Run records and ownership

Use Markdown records inside the run directory, creating them when needed:

- Supervisor owns assignment.md, progress.md, findings.md and handoff.md.
- Research Worker owns research.md and its uniquely named research sub-reports.
- Repair Worker owns repair.md and its uniquely named repair sub-reports.
- Each independent audit pass owns a new audit-NN.md and distinct audit sub-reports; retain previous passes.

Record article preimage paths/hashes, resulting hashes, source evidence and checks actually performed. Reports may reference captures or owner conversation evidence; durable wiki articles should express the settled knowledge rather than depend on a temporary implementation plan.

Findings have stable IDs, material consequence, evidence, resolver and disposition: open, resolved, superseded, or explicitly deferred. Resolution needs evidence; changing an ID or dropping a report does not close a finding. Supervisor synthesis reconciles reports instead of simply concatenating them.

## Completion and recovery

Audit must independently cover the original assignment, missing documentation and adjacent contradictions, not just the repaired files. A clean result applies to the recorded scope and exact audited bytes. A post-audit edit requires rechecking the affected conclusions. Mechanical link/source/timestamp success does not certify factual accuracy or implemented product behavior.

Use run status `in-progress`, `needs-input`, `partial` or `complete`, with a separate audit assessment `clean`, `findings` or `insufficient-evidence`. Completion requires all assigned material findings resolved, independent audit clean, and final source/article hashes still matching the review. Report deliberately excluded work separately; unresolved in-scope material findings prevent completion.

Continue evidence-backed repair without routine approval prompts. Escalate only genuine missing owner intent, unauthorized scope or a repeat failure that cannot progress: explain what was tried and what information/action is needed. Do not hide a blocked loop or claim completion when a resource limit ends work. On resume, read current records and verify prior writers before continuing the next unfinished step.

Return a handoff to the invoking user with scope/baseline, articles changed or retained, evidence and checks, audit result, deviations, limitations and next action. No automatic commit, push, publication, Mission Control notification or follow-on session is part of this workflow.
