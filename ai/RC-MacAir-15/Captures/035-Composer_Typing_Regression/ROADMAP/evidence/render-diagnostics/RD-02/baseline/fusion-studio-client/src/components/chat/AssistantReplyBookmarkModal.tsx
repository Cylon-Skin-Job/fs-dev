import type { FormEvent } from 'react';
import type { ChatTurnBookmarkType } from '../../types';
import { AssistantReplyNoteEditor } from './AssistantReplyNoteEditor';

interface BookmarkChoice {
  type: ChatTurnBookmarkType;
  icon: string;
  label: string;
}

export interface AssistantReplyBookmarkModalProps {
  open: boolean;
  bookmarkType: ChatTurnBookmarkType | null;
  noteDraft: string;
  noteChanged: boolean;
  saving?: boolean;
  disabled?: boolean;
  onBookmarkTypeChange: (type: ChatTurnBookmarkType | null) => void;
  onNoteDraftChange: (value: string) => void;
  onCopyNote: () => void | Promise<unknown>;
  onClearNote: () => void;
  onRevertNote: () => void;
  onCancel: () => void;
  onSave: () => void | Promise<unknown>;
}

const BOOKMARK_CHOICES: BookmarkChoice[] = [
  { type: 'flag', icon: 'bookmark_flag', label: 'Flag' },
  { type: 'star', icon: 'bookmark_star', label: 'Star' },
  { type: 'heart', icon: 'bookmark_heart', label: 'Like' },
];

export function AssistantReplyBookmarkModal({
  open,
  bookmarkType,
  noteDraft,
  noteChanged,
  saving = false,
  disabled = false,
  onBookmarkTypeChange,
  onNoteDraftChange,
  onCopyNote,
  onClearNote,
  onRevertNote,
  onCancel,
  onSave,
}: AssistantReplyBookmarkModalProps) {
  if (!open) return null;

  const controlsDisabled = disabled || saving;
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!controlsDisabled) onSave();
  };

  return (
    <form className="rv-assistant-reply-editor" onSubmit={handleSubmit}>
      <div className="rv-assistant-reply-editor-header">
        <span className="rv-assistant-reply-editor-title">Bookmark</span>
      </div>
      <div className="rv-assistant-reply-bookmark-options" role="radiogroup" aria-label="Bookmark type">
        {BOOKMARK_CHOICES.map((choice) => {
          const selected = bookmarkType === choice.type;
          return (
            <button
              key={choice.type}
              type="button"
              className={`rv-assistant-reply-bookmark-option${selected ? ' rv-assistant-reply-bookmark-option--selected' : ''}`}
              onClick={controlsDisabled ? undefined : () => onBookmarkTypeChange(selected ? null : choice.type)}
              disabled={controlsDisabled}
              aria-label={choice.label}
              aria-pressed={selected}
              title={choice.label}
              role="radio"
              aria-checked={selected}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{choice.icon}</span>
              <span>{choice.label}</span>
            </button>
          );
        })}
      </div>
      <AssistantReplyNoteEditor
        noteDraft={noteDraft}
        noteChanged={noteChanged}
        disabled={controlsDisabled}
        onNoteDraftChange={onNoteDraftChange}
        onCopyNote={onCopyNote}
        onClearNote={onClearNote}
        onRevertNote={onRevertNote}
      />
      <div className="rv-assistant-reply-editor-footer">
        <button
          type="button"
          className="rv-assistant-reply-editor-button"
          onClick={onCancel}
          disabled={controlsDisabled}
          aria-label="Cancel bookmark"
          title="Cancel bookmark"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rv-assistant-reply-editor-button rv-assistant-reply-editor-button--primary"
          disabled={controlsDisabled}
          aria-label="Save bookmark and note"
          title="Save bookmark and note"
        >
          Save
        </button>
      </div>
    </form>
  );
}
