---
thread-model: daily-rolling
session-invalidation: memory-mtime
idle-timeout: 9m
system-context: ["PROMPT.md", "MEMORY.md"]

# CLI profile
cli: kimi
profile: default
model: claude-sonnet-4-6
endpoint: https://api.anthropic.com/v1/messages

# Tool permissions
tools:
  allowed: [read_file, glob, grep, git_log, git_diff, git_show, list_directory, todo_read, todo_write]
  restricted:
    write_file: ["ai/<machine>/Wiki/project/**", "ai/<machine>/Views/<wiki-view-folder>/runs/**", "ai/STATE.md"]
    edit_file: ["ai/<machine>/Wiki/project/**"]
  denied: [shell_exec, git_commit, git_push]

# DB access
db:
  read: [wiki_topics, tickets, chat_history]
  write: [wiki_topics]
  denied: [system_config, secrets]
---
