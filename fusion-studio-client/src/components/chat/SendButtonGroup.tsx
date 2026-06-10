/**
 * @module SendButtonGroup
 * @role Send button with dropdown modal (MicTrigger pattern).
 */

import { useEffect, useState } from 'react';
import {
  useHoverIconModal,
  HoverIconModalContainer,
  HoverIconModalList,
} from '../hover-icon-modal';
import type { ChatInputRef } from '../ChatInput';

interface SendButtonGroupProps {
  chatInputRef: React.RefObject<ChatInputRef | null>;
  onSend: (text: string) => void;
  disabled?: boolean;
  warming?: boolean;
}

export function SendButtonGroup({ chatInputRef, onSend, disabled = false, warming = false }: SendButtonGroupProps) {
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);

  const {
    isOpen,
    state,
    triggerRef,
    popoverRef,
    triggerProps,
    popoverProps,
    close,
  } = useHoverIconModal({
    id: 'send-dropdown',
    triggerMode: 'click',
    stayOpenOnLeave: true,
  });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const modalWidth = 200;
      setPopoverPos({
        left: rect.right - modalWidth,
        bottom: window.innerHeight - rect.top + 8,
      });
    }
  }, [isOpen, triggerRef]);

  const handleSendClick = () => {
    if (disabled) return;
    const text = chatInputRef.current?.getText();
    if (text?.trim()) {
      onSend(text.trim());
    }
  };

  return (
    <>
      <div className="rv-send-button-group">
        <button
          className="rv-send-btn-main"
          onClick={handleSendClick}
          disabled={disabled}
          title={warming ? 'Connecting thread runtime' : 'Send message'}
        >
          {warming ? <span className="rv-send-warming-wheel" aria-label="Connecting" /> : 'Send'}
        </button>
        <div className="rv-send-btn-divider" />
        <button
          ref={triggerRef}
          className="rv-send-btn-secondary"
          title="More options"
          disabled={disabled}
          {...triggerProps}
        >
          <span className="material-symbols-outlined rv-icon-md">
            arrow_drop_down
          </span>
        </button>
      </div>

      <HoverIconModalContainer
        isOpen={isOpen}
        state={state}
        position={popoverPos ?? { left: 0, bottom: 0 }}
        popoverRef={popoverRef}
        popoverProps={popoverProps}
        className="rv-send-dropdown-modal"
      >
        <HoverIconModalList>
          <div className="rv-send-dropdown-content">
            <button className="rv-send-dropdown-item" onClick={() => { close(); }}>
              <span className="material-symbols-outlined">chat</span>
              <span>Send as chat</span>
            </button>
            <button className="rv-send-dropdown-item" onClick={() => { close(); }}>
              <span className="material-symbols-outlined">code</span>
              <span>Send as code block</span>
            </button>
            <button className="rv-send-dropdown-item" onClick={() => { close(); }}>
              <span className="material-symbols-outlined">terminal</span>
              <span>Send as command</span>
            </button>
          </div>
        </HoverIconModalList>
      </HoverIconModalContainer>
    </>
  );
}
