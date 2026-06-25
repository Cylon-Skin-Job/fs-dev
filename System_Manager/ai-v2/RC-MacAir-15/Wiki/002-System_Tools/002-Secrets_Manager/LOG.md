# Log

## 2026-05-03 — Page created
Initial article. Teaches the shell-capture pattern for OS-keychain-stored
credentials: how to list the index from `$ROBIN_DB`, how to capture a value
with `security find-generic-password -w` inside a single bash invocation,
and the discipline rules that keep values out of the chat transcript.

## 2026-05-04 — `use_when` collapsed into `description`
Schema change (migration 015). The `use_when` column was dropped from
`secrets_index`; its job is absorbed by `description`, now a single
narrative field capped at 150 characters covering both *what the
credential is* and *when an agent should reach for it*. Updated the
`get-secret-list` example query and the metadata-fields table here to
match the new shape.
