---
name: "Status"
description: "Read-only research prompt for refreshing the corresponding Wiki Guide section."
metadata:
  source-files: []
  last-modified: "2026-09-28T04:56:08Z"
---

Write `## Status`. Read current domain headings, subject articles and their evidence. Separate four questions: Is documentation substantial or only a placeholder? Which claims were source-verified, and when? What is approved future direction? What behavior is implemented and with what validation? Counted children or recent timestamps cannot answer the last three. Identify remaining uncertainty and specialized articles needing review. Do not label a whole domain fully built merely because its pages exist. Write new guidance in current domain owners; historical `.versions/` is not a source of current product truth.

Return the requested Markdown section plus a separate evidence note naming inspected files and uncertainties. Do not write files. The coordinator owns synthesis, verification and edits.
