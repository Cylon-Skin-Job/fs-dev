# Archived Specs

This folder stores historical specs, plans, and implementation notes that should
not be treated as active implementation instructions.

Current active chat lifecycle source of truth:

- `../PENDING_CHAT_INTENT_SPEC.md`

Recently archived chat documents:

- `ASSISTANT_REPLY_CHROME_PLAN.md` - historical assistant reply chrome and
  earlier fork integration plan.
- `OPENCODE_THREAD_FORK_SPEC.md` - historical click-time pending fork plan.
  Keep only the verified OpenCode `--session <sourceSessionId> --fork` behavior
  as background; implement current fork behavior from
  `../PENDING_CHAT_INTENT_SPEC.md`.
- `THREAD_LIFECYCLE_HARDENING_SPEC.md` - historical empty-thread cleanup and
  MRU guard plan. New Chat and Fork now avoid empty durable rows by using
  RAM-only pending intents.

When a root spec conflicts with a file in this archive, the root spec wins.
