/**
 * @module SendButtonGroup
 * @role Chat composer send button.
 */

import type { ChatInputRef } from '../ChatInput';

interface SendButtonGroupProps {
  chatInputRef: React.RefObject<ChatInputRef | null>;
  onSend: (text: string) => void;
  disabled?: boolean;
  warming?: boolean;
}

export function SendButtonGroup({ chatInputRef, onSend, disabled = false, warming = false }: SendButtonGroupProps) {
  const handleSendClick = () => {
    if (disabled) return;
    const text = chatInputRef.current?.getText();
    if (text?.trim()) {
      onSend(text.trim());
    }
  };

  return (
    <div className="rv-send-button-group">
      <button
        className="rv-send-btn-main"
        onClick={handleSendClick}
        disabled={disabled}
        title={warming ? 'Connecting thread runtime' : 'Send message'}
        aria-label={warming ? 'Connecting thread runtime' : 'Send message'}
      >
        {warming ? (
          <span className="rv-send-warming-wheel" aria-hidden="true" />
        ) : (
          <span className="material-symbols-outlined rv-icon-md" aria-hidden="true">
            arrow_upward
          </span>
        )}
      </button>
    </div>
  );
}
