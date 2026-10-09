# System Triggers

Machine-scoped automation artifacts live here. Trigger files should be readable
contracts first, with executable behavior constrained to explicit trigger blocks.

## Artifact Header

Every automation file starts with an artifact header. The header describes what
the file is, how Fusion should catalog it, and which safety rules apply.

```yaml
---
name: Parse Bank Transaction Emails
description: Monitors inbox for emails from Wells Fargo, copies personal expenses to Spending tracker and business expenses to Solobooks, then archives the email.
type: trigger
tags: [email, money, extract, writes-data]
status: active
scope: system
owner: user
version: 1
---
```

Canonical artifact `type` values: `wiki`, `trigger`, `readme`, `ticket`,
`prompt`, `workflow`, `skill`.

## Managed Tags

Tags should stay curated so the GUI can filter, audit, and gate risky behavior.
Flat tags are allowed in files, and Fusion should normalize them into managed
buckets for domain, intent, risk, and audience.

## Execution Model

- Trigger files are `*.trigger.md` or `TRIGGERS.md` files.
- JavaScript files are helper scripts referenced by `run:`.
- The trigger runner owns permissions, event context, retries, logs, and failure
  handling.
