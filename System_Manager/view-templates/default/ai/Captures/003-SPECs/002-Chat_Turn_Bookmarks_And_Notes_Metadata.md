# Chat Turn Bookmarks And Notes Metadata

## Scope

This note captures the recommended storage model for turn-end chrome that lets users add bookmarks and notes bound to a specific chat pair.

The intent is to store bookmarks and notes as structured metadata on the saved SQLite chat exchange. This reuses the `exchanges.metadata` storage surface, but bookmark/note edits are post-save user metadata updates, not automatic turn-end metadata collectors.

## Recommendation

Bookmarks and notes should be stored on the exchange metadata object for the chat pair they belong to.

Use separate metadata fields for bookmark state and note state. The bookmark
field should be nullable or absent when no bookmark exists; do not store a
separate `bookmark: true/false` alongside a type. The bookmark type itself is
the state.

Example:

```json
{
  "bookmark": {
    "type": "flag",
    "createdAt": 1782072000000,
    "updatedAt": 1782072000000
  },
  "note": {
    "body": "User decided attachments should be pills above input, not inline @ mentions.",
    "createdAt": 1782072000000,
    "updatedAt": 1782072000000
  }
}
```

## Best Practices

- Treat SQLite exchange metadata as durable state.
- Treat RAM as a derived cache that can be rebuilt from SQLite.
- Keep bookmarks and notes bound to the chat pair instead of storing them as global thread state.
- Store structured fields instead of display-only strings.
- Keep bookmark and note persistence in a focused post-save metadata update service.
- Add bookmark and note behavior as focused metadata modules, not as another responsibility inside chat persistence.
- Preserve unrelated metadata keys such as attachments, mentions, file mutations, and token/context usage when updating bookmark or note fields.

## Event Flow

```text
user creates bookmark or note
  -> UI sends chat-turn:metadata:update with threadId, exchangeId, and patch
  -> server metadata update service validates ownership and normalizes payload
  -> exchange metadata is updated for the bound chat pair
  -> server emits/sends chat-turn:metadata:updated with full metadata
  -> SQLite remains the source of truth
  -> thread warm-up can hydrate any RAM view state from exchange metadata
```

## Suggested Fields

The server owns `createdAt` and `updatedAt`. The client sends semantic intent
only: bookmark type/null and note body/null.

### Bookmark

```json
{
  "type": "flag",
  "createdAt": 1782072000000,
  "updatedAt": 1782072000000
}
```

Allowed bookmark types:

| Type | Icon | Label |
|---|---|---|
| `flag` | `bookmark_flag` | Flag |
| `star` | `bookmark_star` | Star |
| `heart` | `bookmark_heart` | Like |

Absence of a bookmark should be represented by a missing `bookmark` field or by
`"bookmark": null`.

### Note

```json
{
  "body": "Check this implementation before expanding mentions.",
  "createdAt": 1782072000000,
  "updatedAt": 1782072100000
}
```

Absence of a note should be represented by a missing `note` field, by
`"note": null`. Saving an empty or whitespace-only note normalizes to
`"note": null`.

## Bookmark And Note Modal

The empty bookmark affordance in reply chrome uses the `bookmark` icon.
Clicking it opens a pop-up editor bound to the current exchange.

Saved bookmark icon state:

- `bookmark: null` or missing: empty `bookmark`
- `bookmark.type === "flag"`: filled `bookmark_flag`
- `bookmark.type === "star"`: filled `bookmark_star`
- `bookmark.type === "heart"`: filled `bookmark_heart`

Top controls:

| Radio icon | Label | Metadata type |
|---|---|---|
| `bookmark_flag` | Flag | `flag` |
| `bookmark_star` | Star | `star` |
| `bookmark_heart` | Like | `heart` |

The pop-up contains one note input field below the radio group. The input is
prefilled from `metadata.note.body` when present, otherwise it starts empty.

Bookmark radio behavior:

- Selecting an unselected radio sets the draft bookmark type.
- Clicking the currently selected radio unselects it, leaving no bookmark type
  selected.
- If Save is pressed with no bookmark type selected, the exchange bookmark is
  removed by storing `bookmark: null` or omitting the bookmark field.
- Removing the bookmark does not remove the note.

Input chrome beneath the field:

| Icon | Action |
|---|---|
| `copy_content` | Copy the current note input through clipboard history |
| `delete_sweep` | Clear the current note input |
| `rotate_left` | Restore the note input to the value it had when the pop-up opened |

`rotate_left` only appears after the user changes the note input. It restores
only the note input. It does not affect the selected bookmark radio value.

`copy_content` must use the managed clipboard path, equivalent to
`writeAndRecord(noteDraft, "assistant-reply-note")`.

Footer buttons:

| Button | Action |
|---|---|
| Cancel | Close the pop-up without persisting changes |
| Save | Persist the selected bookmark type and current note body to exchange metadata |

While the pop-up is open, individual keystrokes are not logged and do not update
SQLite. The UI keeps a local draft. Only Save writes metadata changes; Cancel
and `rotate_left` revert local draft state as described above.

Saving persists both draft channels independently:

- Bookmark draft: selected type writes `metadata.bookmark`; no selected type
  removes `metadata.bookmark`.
- Note draft: current input writes `metadata.note.body`; empty or
  whitespace-only input writes `metadata.note = null`.

## Notes-Only Editor

The ellipsis menu's Notes entry opens a note editor for the same exchange. It
uses the same note input, input chrome, Cancel button, and Save button as the
bookmark pop-up, but it does not show the bookmark radio group.

The notes-only editor reads and writes only `metadata.note`. It must not modify
`metadata.bookmark`.

The Notes menu item is stateful:

- If `metadata.note` is null or missing, render `add_notes` with label
  `Add Note`.
- If `metadata.note` is truthy, render `sticky_note_2` with label `View Note`.

## Rationale

The chat pair is the natural boundary for turn-end chrome. Storing bookmarks and notes as exchange metadata keeps the UI behavior local to the turn while allowing the data to survive thread reloads, workspace refreshes, and RAM cache resets.

This also keeps the system aligned with the existing metadata decisions: SQLite stores the final exchange-level object, RAM is derived from SQLite, and user-authored metadata updates preserve automatic metadata already collected at turn end.
