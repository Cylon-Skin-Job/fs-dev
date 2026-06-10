/**
 * @module MicTrigger
 * @role Microphone button with voice input modal
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  useHoverIconModal,
  HoverIconTrigger,
  HoverIconModalContainer,
  HoverIconModalList,
} from '../components/hover-icon-modal';
import { VoiceRecorder } from './VoiceRecorder';
import './VoiceRecorder.css';

interface MicTriggerProps {
  onInsert?: (text: string) => void;
}

export function MicTrigger({ onInsert }: MicTriggerProps) {
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [savedPromptText, setSavedPromptText] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptSavedMessage, setPromptSavedMessage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const promptGutterRef = useRef<HTMLDivElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const warmStartedRef = useRef(false);

  const promptLineNumbers = useMemo(() => {
    const lineCount = Math.max(1, promptText.split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [promptText]);
  const promptDirty = promptText !== savedPromptText;

  const warmTranscription = useCallback(() => {
    if (warmStartedRef.current) return;
    warmStartedRef.current = true;
    fetch('/api/transcription/warm', { method: 'POST' }).catch((error) => {
      console.warn('[VoiceRecorder] Warm-up failed:', error);
      warmStartedRef.current = false;
    });
  }, []);

  const handleOpen = useCallback(() => {
    warmTranscription();
  }, [warmTranscription]);

  const {
    isOpen,
    state,
    triggerRef,
    popoverRef,
    triggerProps,
    popoverProps,
    close,
  } = useHoverIconModal({
    onOpen: handleOpen,
    id: 'mic',
    triggerMode: 'click', // Mic opens on click only, no hover preview
    stayOpenOnLeave: true, // Once open, stays open until Escape/Enter/click outside
  });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverPos({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 12,
      });
    }
  }, [isOpen, triggerRef]);

  const handleTranscribe = useCallback((text: string) => {
    if (onInsert && text.trim()) {
      onInsert(text.trim());
    }
    close();
  }, [onInsert, close]);

  const handleClose = useCallback(() => {
    close();
  }, [close]);

  const handleContextMenu = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPos({
      left: Math.min(event.clientX, window.innerWidth - 220),
      top: Math.min(event.clientY, window.innerHeight - 120),
    });
  }, []);

  const openPromptPreview = useCallback(async () => {
    setMenuPos(null);
    setPromptOpen(true);
    setPromptLoading(true);
    setPromptError(null);

    try {
      const response = await fetch('/api/capabilities/prompts/stt');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load prompt');
      }
      setPromptText(result.prompt || '');
      setSavedPromptText(result.prompt || '');
      setPromptSavedMessage(null);
    } catch (error) {
      setPromptError(error instanceof Error ? error.message : 'Failed to load prompt');
    } finally {
      setPromptLoading(false);
    }
  }, []);

  const savePrompt = useCallback(async () => {
    setPromptSaving(true);
    setPromptError(null);
    setPromptSavedMessage(null);

    try {
      const response = await fetch('/api/capabilities/prompts/stt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save prompt');
      }
      setSavedPromptText(result.prompt || promptText);
      setPromptSavedMessage('Saved');
    } catch (error) {
      setPromptError(error instanceof Error ? error.message : 'Failed to save prompt');
    } finally {
      setPromptSaving(false);
    }
  }, [promptText]);

  const handlePromptScroll = useCallback(() => {
    if (!promptGutterRef.current || !promptTextareaRef.current) return;
    promptGutterRef.current.scrollTop = promptTextareaRef.current.scrollTop;
  }, []);

  useEffect(() => {
    if (!menuPos) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && menuRef.current.contains(event.target as Node)) return;
      setMenuPos(null);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [menuPos]);

  useEffect(() => {
    if (!promptOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPromptOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        savePrompt();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [promptOpen, savePrompt]);

  return (
    <>
      <span
        className="rv-mic-trigger-wrap"
        onContextMenu={handleContextMenu}
        onMouseEnter={warmTranscription}
        onFocus={warmTranscription}
      >
        <HoverIconTrigger
          icon="mic"
          title="Voice input (click to open)"
          isOpen={isOpen}
          triggerRef={triggerRef}
          triggerProps={triggerProps}
        />
      </span>

      {menuPos && (
        <div
          ref={menuRef}
          className="rv-mic-context-menu"
          style={{ left: menuPos.left, top: menuPos.top }}
          role="menu"
        >
          <button className="rv-mic-context-action" type="button" onClick={openPromptPreview}>
            <span className="material-symbols-outlined">edit_note</span>
            <span>Edit prompt</span>
          </button>
        </div>
      )}

      <HoverIconModalContainer
        isOpen={isOpen}
        state={state}
        position={popoverPos ?? { left: 0, bottom: 0 }}
        popoverRef={popoverRef}
        popoverProps={popoverProps}
      >
        <HoverIconModalList listRef={listRef}>
          <VoiceRecorder
            onTranscribe={handleTranscribe}
            onClose={handleClose}
            maxDuration={60}
          />
        </HoverIconModalList>
      </HoverIconModalContainer>

      {promptOpen && (
        <div className="rv-mic-prompt-backdrop" role="presentation" onClick={() => setPromptOpen(false)}>
          <section
            className="rv-mic-prompt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rv-mic-prompt-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="rv-mic-prompt-header">
              <div>
                <h2 id="rv-mic-prompt-title">STT Prompt</h2>
                <p>Gwen transcript cleanup instructions · raw markdown</p>
              </div>
              <div className="rv-mic-prompt-actions">
                {promptSavedMessage && <span className="rv-mic-prompt-saved">{promptSavedMessage}</span>}
                {promptDirty && !promptLoading && (
                  <button className="rv-mic-prompt-action" type="button" onClick={() => setPromptText(savedPromptText)} disabled={promptSaving}>
                    Revert
                  </button>
                )}
                <button className="rv-mic-prompt-action rv-mic-prompt-action--primary" type="button" onClick={savePrompt} disabled={promptLoading || promptSaving || !promptDirty}>
                  {promptSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
              <button className="rv-mic-prompt-close" type="button" onClick={() => setPromptOpen(false)} aria-label="Close prompt preview">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="rv-mic-prompt-body">
              {promptLoading && <div className="rv-mic-prompt-status">Loading prompt...</div>}
              {promptError && <div className="rv-mic-prompt-error">{promptError}</div>}
              {!promptLoading && (
                <div className="rv-mic-prompt-editor rv-code-editor rv-md-source">
                  <div className="rv-code-gutter rv-mic-prompt-gutter" ref={promptGutterRef} aria-hidden="true">
                    {promptLineNumbers.map((lineNumber) => (
                      <span key={lineNumber} className="rv-line-number">{lineNumber}</span>
                    ))}
                  </div>
                  <textarea
                    ref={promptTextareaRef}
                    className="rv-mic-prompt-textarea"
                    value={promptText}
                    onChange={(event) => {
                      setPromptText(event.target.value);
                      setPromptSavedMessage(null);
                    }}
                    onScroll={handlePromptScroll}
                    spellCheck={false}
                    aria-label="Edit STT prompt markdown"
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
