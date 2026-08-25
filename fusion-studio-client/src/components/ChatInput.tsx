/**
 * ChatInput — Send button + Stop button in the same position.
 *
 * Send: visible when no turn is active. Sends user rv-message.
 * Stop: visible when a turn is active (streaming or revealing).
 *       Immediately ends the turn — renders all remaining content
 *       instantly and finalizes to history.
 *
 * The stop button has a spinning 3/4-circle border to indicate
 * the AI is working. Clicking it kills the turn cleanly.
 */

import { useState, useRef, forwardRef, useImperativeHandle, useCallback, useEffect, useLayoutEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import { useFileAutocomplete } from '../hooks/useFileAutocomplete';
import { EmojiTrigger } from '../emojis';
import {
  extractEmojis,
  getInsertedText,
  listEmojiRecents,
  recordEmojiRecent,
  recordEmojiRecentsFromText,
  type EmojiRecentItem,
} from '../emojis/emoji-recents-api';

export interface ChatInputRef {
  insertText: (text: string) => void;
  replaceText: (text: string) => void;
  getText: () => string;
  focus: () => void;
  clearText: () => void;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  panel: string;
  /** Optional placeholder override (SPEC-26c: set when chat is inactive). */
  placeholder?: string;
  /** True when the AI is streaming or the renderer is still revealing. */
  isTurnActive: boolean;
  onWarmIntent?: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput(
  { onSend, onStop, disabled, panel, placeholder, isTurnActive, onWarmIntent },
  ref
) {
  const [text, setText] = useState('');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [emojiRecentsOpen, setEmojiRecentsOpen] = useState(false);
  const [emojiRecents, setEmojiRecents] = useState<EmojiRecentItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiCaptureRef = useRef<HTMLInputElement>(null);
  const recentsRef = useRef<HTMLDivElement>(null);
  const textareaWidthRef = useRef(0);
  const config = usePanelStore((s) => s.getPanelConfig(panel));
  const autocomplete = useFileAutocomplete(text, cursorIndex);

  const syncCursor = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setCursorIndex(textarea.selectionStart);
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const style = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(style.lineHeight) || 21;
    const verticalChrome =
      (Number.parseFloat(style.paddingTop) || 0)
      + (Number.parseFloat(style.paddingBottom) || 0)
      + (Number.parseFloat(style.borderTopWidth) || 0)
      + (Number.parseFloat(style.borderBottomWidth) || 0);
    const minHeight = Math.max(42, (lineHeight * 2) + verticalChrome);
    const maxHeight = (lineHeight * 12) + verticalChrome;
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    const overflowing = textarea.scrollHeight > maxHeight + 1;

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = overflowing ? 'auto' : 'hidden';
    if (overflowing) textarea.scrollTop = textarea.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;

    textareaWidthRef.current = textarea.getBoundingClientRect().width;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(width - textareaWidthRef.current) < 0.5) return;
      textareaWidthRef.current = width;
      resizeTextarea();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [resizeTextarea]);

  const setTextareaText = useCallback((nextText: string, nextCursor: number) => {
    const textarea = textareaRef.current;
    setText(nextText);
    setCursorIndex(nextCursor);
    window.setTimeout(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }, []);

  useImperativeHandle(ref, () => ({
    insertText: (newText: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = textarea.value;
      
      // Insert at cursor position, or append if no cursor
      const before = currentText.substring(0, start);
      const after = currentText.substring(end);
      const updatedText = before + newText + after;
      
      recordEmojiRecentsFromText(newText);
      setTextareaText(updatedText, start + newText.length);
      
      // Cursor and height are restored by setTextareaText.
    },
    replaceText: (newText: string) => {
      recordEmojiRecentsFromText(newText);
      setTextareaText(newText, newText.length);
    },
    getText: () => text,
    focus: () => {
      textareaRef.current?.focus();
    },
    clearText: () => {
      setText('');
      setCursorIndex(0);
    }
  }), [setTextareaText, text]);

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (autocomplete.match && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
      e.preventDefault();
      const acceptedText = autocomplete.accept();
      setTextareaText(acceptedText, autocomplete.match.tokenStart + autocomplete.match.replacement.length + 1);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isTurnActive) {
        onStop();
      } else {
        handleSend();
      }
    }
  };

  const handleChange = (nextText: string) => {
    const insertedText = getInsertedText(text, nextText);
    if (insertedText) recordEmojiRecentsFromText(insertedText);
    if (emojiRecentsOpen) setEmojiRecentsOpen(false);
    setText(nextText);
    window.requestAnimationFrame(syncCursor);
  };

  const handleContextMenu = async (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    onWarmIntent?.();
    textareaRef.current?.focus();

    if (emojiRecentsOpen) {
      setEmojiRecentsOpen(false);
      return;
    }

    setEmojiRecents([]);
    setEmojiRecentsOpen(true);

    try {
      const items = await listEmojiRecents(20);
      setEmojiRecents(items);
    } catch (err) {
      console.error('[EmojiRecents] Failed to load recents:', err);
      setEmojiRecents([]);
    }
  };

  const insertEmojiRecent = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const updatedText = before + emoji + after;

    recordEmojiRecentsFromText(emoji);
    setTextareaText(updatedText, start + emoji.length);
    setEmojiRecentsOpen(false);
  };

  const captureEmojiRecent = (capturedText: string) => {
    const capturedEmojis = extractEmojis(capturedText);
    if (capturedEmojis.length === 0) return;

    const capturedAt = Date.now();
    for (const emoji of capturedEmojis) recordEmojiRecent(emoji);
    setEmojiRecents((current) => {
      const capturedItems = capturedEmojis.map((emoji, index) => {
        const existing = current.find((item) => item.emoji === emoji);
        return {
          id: existing?.id ?? -(capturedAt + index),
          emoji,
          last_used_at: capturedAt + index,
        };
      }).reverse();
      const capturedSet = new Set(capturedEmojis);
      return [...capturedItems, ...current.filter((item) => !capturedSet.has(item.emoji))].slice(0, 20);
    });
  };

  useEffect(() => {
    if (!emojiRecentsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (recentsRef.current?.contains(target)) return;
      setEmojiRecentsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEmojiRecentsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [emojiRecentsOpen]);

  return (
    <div className="rv-chat-input-container">
      <div className="rv-chat-input-wrapper">
        {emojiRecentsOpen && (
          <div ref={recentsRef} className="rv-chat-emoji-recents" role="menu" aria-label="Recent emojis">
            {emojiRecents.length > 0 ? (
              emojiRecents.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rv-chat-emoji-recent"
                  onClick={() => insertEmojiRecent(item.emoji)}
                  role="menuitem"
                >
                  {item.emoji}
                </button>
              ))
            ) : (
              <span className="rv-chat-emoji-recents-empty">No recent emojis yet</span>
            )}
            <EmojiTrigger
              className="rv-chat-emoji-add"
              icon="add"
              title="Add emoji to recents"
              inputTargetRef={emojiCaptureRef}
            />
            <input
              ref={emojiCaptureRef}
              className="rv-chat-emoji-capture"
              aria-label="Emoji selection capture"
              tabIndex={-1}
              autoComplete="off"
              value=""
              onChange={(event) => captureEmojiRecent(event.target.value)}
            />
          </div>
        )}
        <div className="rv-chat-input-text-stack">
          {autocomplete.match && (
            <div className="rv-chat-autocomplete-ghost" aria-hidden="true">
              <span className="rv-chat-autocomplete-ghost-prefix">{text}</span>
              <span>{autocomplete.match.ghostSuffix}</span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            className="rv-chat-input"
            placeholder={placeholder ?? `Ask about ${(config?.name || panel).toLowerCase()}...`}
            value={text}
            onFocus={onWarmIntent}
            onClick={syncCursor}
            onKeyUp={syncCursor}
            onSelect={syncCursor}
            onPaste={onWarmIntent}
            onChange={(e) => handleChange(e.target.value)}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={2}
          />
        </div>

      </div>
    </div>
  );
});
