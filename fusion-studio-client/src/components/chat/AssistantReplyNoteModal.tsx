import type { FormEvent } from 'react';

interface AssistantReplyNoteEditorProps {
  noteDraft: string;
  noteChanged: boolean;
  disabled?: boolean;
  onNoteDraftChange: (value: string) => void;
  onCopyNote: () => void | Promise<unknown>;
  onClearNote: () => void;
  onRevertNote: () => void;
}

export interface AssistantReplyNoteModalProps extends AssistantReplyNoteEditorProps {
  open: boolean;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void | Promise<unknown>;
}

export function AssistantReplyNoteEditor({
  noteDraft,
  noteChanged,
  disabled = false,
  onNoteDraftChange,
  onCopyNote,
  onClearNote,
  onRevertNote,
}: AssistantReplyNoteEditorProps) {
  return (
    <div className="rv-assistant-reply-editor-note">
      <textarea
        className="rv-assistant-reply-editor-textarea"
        value={noteDraft}
        onChange={(event) => onNoteDraftChange(event.target.value)}
        disabled={disabled}
        aria-label="Note"
        title="Note"
        placeholder="Note"
        rows={5}
      />
      <div className="rv-assistant-reply-editor-note-actions" aria-label="Note actions">
        <button
          type="button"
          className="rv-assistant-reply-editor-icon-button"
          onClick={disabled ? undefined : onCopyNote}
          disabled={disabled}
          aria-label="Copy note"
          title="Copy note"
        >
          <span className="material-symbols-outlined" aria-hidden="true">copy_content</span>
        </button>
        <button
          type="button"
          className="rv-assistant-reply-editor-icon-button"
          onClick={disabled ? undefined : onClearNote}
          disabled={disabled}
          aria-label="Clear note"
          title="Clear note"
        >
          <span className="material-symbols-outlined" aria-hidden="true">delete_sweep</span>
        </button>
        {noteChanged ? (
          <button
            type="button"
            className="rv-assistant-reply-editor-icon-button"
            onClick={disabled ? undefined : onRevertNote}
            disabled={disabled}
            aria-label="Restore note"
            title="Restore note"
          >
            <span className="material-symbols-outlined" aria-hidden="true">rotate_left</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantReplyNoteModal({
  open,
  noteDraft,
  noteChanged,
  saving = false,
  disabled = false,
  onNoteDraftChange,
  onCopyNote,
  onClearNote,
  onRevertNote,
  onCancel,
  onSave,
}: AssistantReplyNoteModalProps) {
  if (!open) return null;

  const controlsDisabled = disabled || saving;
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!controlsDisabled) onSave();
  };

  return (
    <form className="rv-assistant-reply-editor" onSubmit={handleSubmit}>
      <div className="rv-assistant-reply-editor-header">
        <span className="rv-assistant-reply-editor-title">Note</span>
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
          aria-label="Cancel note"
          title="Cancel note"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rv-assistant-reply-editor-button rv-assistant-reply-editor-button--primary"
          disabled={controlsDisabled}
          aria-label="Save note"
          title="Save note"
        >
          Save
        </button>
      </div>
    </form>
  );
}
