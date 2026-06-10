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

import { useState, useRef, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import {
  getInsertedText,
  listEmojiRecents,
  recordEmojiRecentsFromText,
  type EmojiRecentItem,
} from '../emojis/emoji-recents-api';

export interface ChatInputRef {
  insertText: (text: string) => void;
  getText: () => string;
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
  const [emojiRecentsOpen, setEmojiRecentsOpen] = useState(false);
  const [emojiRecents, setEmojiRecents] = useState<EmojiRecentItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recentsRef = useRef<HTMLDivElement>(null);
  const config = usePanelStore((s) => s.getPanelConfig(panel));

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
      setText(updatedText);
      
      // Set cursor position after inserted text
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newCursorPos = start + newText.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
          // Adjust height
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
        }
      }, 0);
    },
    getText: () => text,
    clearText: () => {
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }));

  const handleSend = useCallback(() => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isTurnActive) {
        onStop();
      } else {
        handleSend();
      }
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const handleChange = (nextText: string) => {
    const insertedText = getInsertedText(text, nextText);
    if (insertedText) recordEmojiRecentsFromText(insertedText);
    if (emojiRecentsOpen) setEmojiRecentsOpen(false);
    setText(nextText);
  };

  const handleContextMenu = async (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    onWarmIntent?.();
    textareaRef.current?.focus();

    if (emojiRecentsOpen) {
      setEmojiRecentsOpen(false);
      return;
    }

    try {
      const items = await listEmojiRecents(20);
      setEmojiRecents(items);
      setEmojiRecentsOpen(items.length > 0);
    } catch (err) {
      console.error('[EmojiRecents] Failed to load recents:', err);
      setEmojiRecentsOpen(false);
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
    setText(updatedText);
    setEmojiRecentsOpen(false);

    window.setTimeout(() => {
      textarea.focus();
      const nextCursor = start + emoji.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
    }, 0);
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
            {emojiRecents.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rv-chat-emoji-recent"
                onClick={() => insertEmojiRecent(item.emoji)}
                role="menuitem"
              >
                {item.emoji}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="rv-chat-input"
          placeholder={placeholder ?? `Ask about ${(config?.name || panel).toLowerCase()}...`}
          value={text}
          onFocus={onWarmIntent}
          onPaste={onWarmIntent}
          onChange={(e) => handleChange(e.target.value)}
          onContextMenu={handleContextMenu}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          rows={5}
        />

      </div>
    </div>
  );
});
