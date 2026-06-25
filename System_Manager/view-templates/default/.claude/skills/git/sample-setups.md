# Sample Git And Sync Setups

These are example workspace setup patterns. Treat them as decision aids, not automatic defaults.

Some referenced mirror, ledger, and per-machine folder behavior is specified or partially built but not fully implemented yet. Confirm current server support before promising automation.

## Minimalist

Best for non-code-focused repos and repos that store private or personal data, such as Fusion Home.

Shape:

- No required outer git workflow.
- SQLite handles internal versioning.
- Keep a rolling mirror of workspace-related ledger events, chat, agent runs, and file versioning.
- Suggested mirror retention: 100 days.
- Set up once; server auto-recognizes `ai/data/mirror/workspace.db` when built.
- Internal mirror config and deterministic tables tell server code what to maintain.

Backup option:

- Create an iCloud folder named `Fusion-Studio`.
- Create one subfolder per workspace.
- Symlink selected workspace folders into the iCloud workspace folder.
- Example mirror location: `iCloud/Fusion-Studio/workspace-name/ai/data/`.

Use when:

- The user values local privacy over collaboration.
- The repo is mostly notes, documents, personal data, or workspace state.
- Git would add noise or risk.

## Single Dev

Best for one developer using git mainly as an off-site code backup.

Shape:

- Use git.
- Use GitHub for off-site storage.
- Git ignore `ai/system/`.
- No SQLite mirror.
- Push code changes daily.
- Do not use GitHub Issues or GitHub Wiki.
- Allow the rest of `ai/` to be pushed as markdown folders when the user wants workspace context backed up.

Use when:

- One person owns the repo.
- GitHub is just remote storage.
- Local markdown workspace artifacts are acceptable in the repo.

## Multi Machine

Best for one user running work across a laptop and a second machine with background agents.

Shape:

- Use GitLab.
- Push all committed work.
- Another machine watches for commits, pulls, and runs background agents.
- Second-machine ticketing is managed in its own per-machine issue folder.
- Laptop has its own per-machine issue folder.

Example structure:

```text
ai/machine-name/issues
ai/laptop-name/issues
```

Sync behavior:

- Background machine pushes its work and ticket updates to GitLab.
- Laptop pulls those updates and can inspect the background machine's issue folder.
- Laptop-local issues are git ignored so the background machine never sees them.

Notes:

- This depends on the per-machine `ai/<machine-name>/...` structure described in the related spec, which is partially built.
- Confirm current implementation before relying on automatic routing.

Use when:

- One user wants a separate machine doing autonomous work.
- GitLab is the transport and audit trail.
- Local laptop tickets should stay private/local.

## Multi-User Collaboration

Best for multiple users collaborating with shared auditability.

Shape:

- Do not git ignore `ai/` folders by default.
- Users can view and audit each other's logs through SQLite mirrors.
- Maintain separate wikis, local tickets, runs, and logs through user-machine folders under `ai/`.
- User-machine partitioning prevents conflicts.
- Use GitHub for shared issue tracking between people.
- Users file, view, and claim tickets through webhook or API flows.
- Local ticket stores are mutated when provider-side issue changes occur.
- Ticket changes sync to GitHub immediately on both ends.

Notes:

- This depends on the user-machine folder spec and provider sync workflows, which are not fully built yet.
- Confirm current GitHub/GitLab token availability and webhook/API support before setting this up.

Use when:

- Multiple people need shared visibility.
- Auditing agent/user activity matters.
- GitHub Issues should be the shared collaboration surface while local workspace stores remain deterministic.
