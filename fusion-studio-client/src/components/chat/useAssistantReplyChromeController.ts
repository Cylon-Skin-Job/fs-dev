import { useCallback, useEffect, useMemo, useState } from 'react';
import { copyChatId, copyNoteDraft, copyReplyText, guardAssistantReplySource } from '../../lib/chat/reply-chrome-actions';
import { updateReplyMetadata } from '../../lib/chat/reply-metadata-api';
import { showToast } from '../../lib/toast';
import type { AssistantReplyBookmarkModalProps } from './AssistantReplyBookmarkModal';
import type { AssistantReplyNoteModalProps } from './AssistantReplyNoteModal';
import type { ChatTurnBookmarkType, ChatTurnMetadataPatch } from '../../types';
import type {
  AssistantReplySourceRef,
  AssistantReplyTextPayload,
} from '../../lib/chat/reply-text';

interface UseAssistantReplyChromeControllerOptions {
  source: AssistantReplySourceRef;
  payload: AssistantReplyTextPayload;
  metadata?: Record<string, unknown>;
  disabled?: boolean;
}

function getBookmarkType(metadata: Record<string, unknown> | undefined): ChatTurnBookmarkType | null {
  const bookmark = metadata?.bookmark;
  const type = typeof bookmark === 'object' && bookmark !== null && 'type' in bookmark
    ? (bookmark as { type?: unknown }).type
    : null;
  return type === 'flag' || type === 'star' || type === 'heart' ? type : null;
}

function getNoteBody(metadata: Record<string, unknown> | undefined): string {
  const note = metadata?.note;
  if (typeof note === 'string') return note;
  if (typeof note === 'object' && note !== null && 'body' in note) {
    const body = (note as { body?: unknown }).body;
    return typeof body === 'string' ? body : '';
  }
  return '';
}

function showMetadataError(err: unknown) {
  const message = err instanceof Error && err.message ? err.message : 'Metadata update failed';
  showToast(message);
}

export function useAssistantReplyChromeController({
  source,
  payload,
  metadata,
  disabled = false,
}: UseAssistantReplyChromeControllerOptions) {
  const [effectiveMetadata, setEffectiveMetadata] = useState<Record<string, unknown> | undefined>(metadata);
  const [activeEditor, setActiveEditor] = useState<'bookmark' | 'note' | null>(null);
  const [bookmarkDraft, setBookmarkDraft] = useState<ChatTurnBookmarkType | null>(null);
  const [initialNoteDraft, setInitialNoteDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEffectiveMetadata(metadata);
  }, [metadata]);

  const noteChanged = noteDraft !== initialNoteDraft;

  const handleCopyReply = useCallback(() => {
    if (disabled) return Promise.resolve(false);
    return copyReplyText(payload, source);
  }, [disabled, payload, source]);

  const handleCopyChatId = useCallback(() => {
    if (disabled) return Promise.resolve(false);
    return copyChatId(source);
  }, [disabled, source]);

  const openBookmarkEditor = useCallback(() => {
    if (disabled) return;
    if (!guardAssistantReplySource(source, { requireExchangeId: true })) return;
    const noteBody = getNoteBody(effectiveMetadata);
    setBookmarkDraft(getBookmarkType(effectiveMetadata));
    setInitialNoteDraft(noteBody);
    setNoteDraft(noteBody);
    setActiveEditor('bookmark');
  }, [disabled, effectiveMetadata, source]);

  const openNoteEditor = useCallback(() => {
    if (disabled) return;
    if (!guardAssistantReplySource(source, { requireExchangeId: true })) return;
    const noteBody = getNoteBody(effectiveMetadata);
    setInitialNoteDraft(noteBody);
    setNoteDraft(noteBody);
    setActiveEditor('note');
  }, [disabled, effectiveMetadata, source]);

  const closeEditor = useCallback(() => {
    if (saving) return;
    setActiveEditor(null);
  }, [saving]);

  const handleCopyNote = useCallback(() => {
    if (disabled) return Promise.resolve(false);
    return copyNoteDraft(noteDraft, source);
  }, [disabled, noteDraft, source]);

  const clearNote = useCallback(() => {
    setNoteDraft('');
  }, []);

  const revertNote = useCallback(() => {
    setNoteDraft(initialNoteDraft);
  }, [initialNoteDraft]);

  const saveMetadata = useCallback(async (patch: ChatTurnMetadataPatch) => {
    if (disabled || saving) return false;
    if (!guardAssistantReplySource(source, { requireExchangeId: true })) return false;
    setSaving(true);
    try {
      const result = await updateReplyMetadata(source, patch);
      setEffectiveMetadata(result.metadata);
      setActiveEditor(null);
      return true;
    } catch (err) {
      showMetadataError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [disabled, saving, source]);

  const saveBookmarkEditor = useCallback(() => {
    return saveMetadata({
      bookmark: bookmarkDraft ? { type: bookmarkDraft } : null,
      note: noteDraft.trim() ? { body: noteDraft } : null,
    });
  }, [bookmarkDraft, noteDraft, saveMetadata]);

  const saveNoteEditor = useCallback(() => {
    return saveMetadata({
      note: noteDraft.trim() ? { body: noteDraft } : null,
    });
  }, [noteDraft, saveMetadata]);

  const bookmarkModalProps = useMemo<AssistantReplyBookmarkModalProps>(() => ({
    open: activeEditor === 'bookmark',
    bookmarkType: bookmarkDraft,
    noteDraft,
    noteChanged,
    saving,
    disabled,
    onBookmarkTypeChange: setBookmarkDraft,
    onNoteDraftChange: setNoteDraft,
    onCopyNote: handleCopyNote,
    onClearNote: clearNote,
    onRevertNote: revertNote,
    onCancel: closeEditor,
    onSave: saveBookmarkEditor,
  }), [
    activeEditor,
    bookmarkDraft,
    clearNote,
    closeEditor,
    disabled,
    handleCopyNote,
    noteChanged,
    noteDraft,
    revertNote,
    saveBookmarkEditor,
    saving,
  ]);

  const noteModalProps = useMemo<AssistantReplyNoteModalProps>(() => ({
    open: activeEditor === 'note',
    noteDraft,
    noteChanged,
    saving,
    disabled,
    onNoteDraftChange: setNoteDraft,
    onCopyNote: handleCopyNote,
    onClearNote: clearNote,
    onRevertNote: revertNote,
    onCancel: closeEditor,
    onSave: saveNoteEditor,
  }), [
    activeEditor,
    clearNote,
    closeEditor,
    disabled,
    handleCopyNote,
    noteChanged,
    noteDraft,
    revertNote,
    saveNoteEditor,
    saving,
  ]);

  return {
    metadata: effectiveMetadata,
    bookmarkModalProps,
    noteModalProps,
    handleCopyReply,
    handleCopyChatId,
    openBookmarkEditor,
    openNoteEditor,
  };
}
