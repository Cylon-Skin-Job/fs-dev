# Chunking Guide

The live renderer should operate on semantic chunks, not raw transport text.

## Current Direction

- `think` uses line chunks
- `shell` uses output lines after the result arrives
- `read` stays compact and shows a short path per file
- `grep` should chunk by match row
- `web_search` should chunk by search result block
- `fetch` should chunk by paragraph
- `todo` should chunk by task line or task item

## Rule

The parser decides what a chunk means. The orchestrator decides how fast it should appear.

That separation keeps the renderer consistent across different harnesses and output shapes. The transport protocol can change, but once the data reaches the canonical stream, chunking should stay stable and predictable.
