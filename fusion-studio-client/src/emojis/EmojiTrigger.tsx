/**
 * @module EmojiTrigger
 * @role Icon button for the native system emoji picker
 */

import { useCallback, type MouseEvent } from 'react';
import '../components/hover-icon-modal/HoverIconModal.css';

interface EmojiTriggerProps {
  onInsert?: (text: string) => void;
}

export function EmojiTrigger(props: EmojiTriggerProps) {
  void props.onInsert;

  const keepComposerFocused = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  const handleClick = useCallback(async () => {
    const input = document.querySelector<HTMLTextAreaElement>('.rv-chat-input:not(:disabled)');
    input?.focus();

    if (window.electronAPI?.showEmojiPanel) {
      await window.electronAPI.showEmojiPanel();
      return;
    }

    window.alert('Use Control + Command + Space to open the macOS emoji picker.');
  }, []);

  return (
    <button
      className="rv-hover-icon-trigger"
      title="Open system emoji picker"
      aria-label="Open system emoji picker"
      onMouseDown={keepComposerFocused}
      onClick={handleClick}
    >
      <span className="material-symbols-outlined">add_reaction</span>
    </button>
  );
}
