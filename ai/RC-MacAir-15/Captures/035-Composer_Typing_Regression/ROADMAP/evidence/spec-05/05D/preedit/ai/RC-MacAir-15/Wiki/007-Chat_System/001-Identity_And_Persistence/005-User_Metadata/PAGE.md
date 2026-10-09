---
name: Chat User Metadata
description: User-authored metadata for saved chat exchanges — bookmarks, notes, search/recall, and redaction.
metadata:
  incoming-edges:
    - Chat Identity And Persistence
    - Chat Exchange Metadata
  outgoing-edges:
    - Chat WebSocket Protocol
  source-files:
    - fusion-studio-server/lib/chat-metadata/exchange-metadata-aggregator.js
    - fusion-studio-server/lib/ws/redaction-map.js
    - fusion-studio-server/lib/ws/client-message-router.js
    - fusion-studio-server/lib/thread/HistoryFile.js
  connected-skills: []
  related-trigger-files: []
---

Bookmarks and notes are post-save user metadata updates on
`exchanges.metadata`. They are not automatic turn-end metadata collectors.

Metadata updates must merge with existing metadata and preserve unrelated keys
such as `attachments`, `mentions`, `fileMutations`, `contextUsage`, and
`tokenUsage`.

## Bookmarks

Bookmarks are optional user metadata on a saved exchange. No separate boolean
is needed. Bookmark presence is represented by the bookmark object itself.

```json
{
  "bookmark": {
    "type": "flag",
    "createdAt": 1782072000000,
    "updatedAt": 1782072000000
  }
}
```

No bookmark is represented by a missing `bookmark` field or `"bookmark": null`.

| Type | Icon | Label |
|---|---|---|
| `flag` | `bookmark_flag` | Flag |
| `star` | `bookmark_star` | Star |
| `heart` | `bookmark_heart` | Like |

Clicking the selected radio again unselects it. If saved with no selected type,
bookmark returns to null. Notes are independent and are not removed.

## Notes

Notes are optional user-authored metadata on a saved exchange.

```json
{
  "note": {
    "body": "Check this implementation before expanding mentions.",
    "createdAt": 1782072000000,
    "updatedAt": 1782072100000
  }
}
```

No note is represented by missing `note`, `"note": null`, or by normalizing an
empty/whitespace-only saved note to null.

Bookmarks and notes are independent:

- A note can exist without a bookmark.
- A bookmark can exist without a note.
- Bookmark modal edits both only for convenience.
- Notes-only editor reads and writes only `metadata.note`.

While a note editor is open, keystrokes are local draft state. Only Save writes
metadata. Cancel saves nothing. Revert restores the note text to its open-time
value and does not affect bookmark radio state.

## Search And Recall

Bookmark and note metadata exists to support recall.

The note body is the detail. Do not add separate note title, summary, tag, or
secondary detail fields unless a later spec explicitly asks for them.

- Notes-only search should find exchanges by `metadata.note.body`.
- Bookmark-only search should find exchanges by `metadata.bookmark.type`.
- Combined filters can use both fields, but the fields remain independent.

Bookmarks and notes attach to the whole saved exchange. Selected text ranges are
out of scope unless a future feature adds a range model.

## Redaction And Privacy

Note bodies are intentionally stored in `exchanges.metadata` when the user
saves them. They must be redacted from incidental WebSocket/debug logs.

Redact inbound and outbound paths such as:

```text
patch.note.body
note.body
metadata.note.body
```

Bookmark type does not need redaction.

API keys should not be silently logged through clipboard history or WebSocket
debug logging. Use the managed clipboard path and existing redaction safeguards.
