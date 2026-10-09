/**
 * @module EmojiTrigger
 * @role Icon button for the native system emoji picker
 */

import { useCallback, useRef, type MouseEvent, type RefObject } from 'react';
import '../components/hover-icon-modal/HoverIconModal.css';

interface EmojiTriggerProps {
  onInsert?: (text: string) => void;
  className?: string;
  icon?: string;
  title?: string;
  inputTargetRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

export function EmojiTrigger({
  onInsert,
  className = 'rv-hover-icon-trigger',
  icon = 'add_reaction',
  title = 'Open system emoji picker',
  inputTargetRef,
}: EmojiTriggerProps) {
  void onInsert;
  const buttonRef = useRef<HTMLButtonElement>(null);

  const keepComposerFocused = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const handleClick = useCallback(async () => {
    const input = inputTargetRef?.current
      ?? buttonRef.current
        ?.closest('.rv-chat-footer')
        ?.querySelector<HTMLTextAreaElement>('.rv-chat-input:not(:disabled)')
      ?? document.querySelector<HTMLTextAreaElement>('.rv-panel.active .rv-chat-input:not(:disabled)');
    input?.focus();

    if (window.electronAPI?.showEmojiPanel) {
      await window.electronAPI.showEmojiPanel();
      return;
    }

    window.alert('Use Control + Command + Space to open the macOS emoji picker.');
  }, [inputTargetRef]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      title={title}
      aria-label={title}
      onMouseDown={keepComposerFocused}
      onClick={handleClick}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  );
}
