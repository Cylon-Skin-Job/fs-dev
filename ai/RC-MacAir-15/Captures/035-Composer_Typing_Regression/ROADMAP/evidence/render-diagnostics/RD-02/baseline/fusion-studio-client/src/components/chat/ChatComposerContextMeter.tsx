/**
 * @module ChatComposerContextMeter
 * @role Compact composer context percentage with hover details.
 */

import { useEffect, useState } from 'react';
import type { TokenUsage } from '../../types';
import { formatContextTokenSummary } from '../../lib/chat/context-usage';
import {
  HoverIconModalContainer,
  useHoverIconModal,
} from '../hover-icon-modal';

const POPOVER_WIDTH = 220;

interface ChatComposerContextMeterProps {
  contextUsage: number;
  tokenUsage: TokenUsage | null;
}

export function ChatComposerContextMeter({
  contextUsage,
  tokenUsage,
}: ChatComposerContextMeterProps) {
  const clampedUsage = Math.min(Math.max(contextUsage, 0), 1);
  const contextPercent = Math.round(clampedUsage * 100);
  const contextFill = `${clampedUsage * 100}%`;
  const tokenSummary = formatContextTokenSummary(clampedUsage, tokenUsage);
  const [popoverPos, setPopoverPos] = useState<{ left: number; bottom: number } | null>(null);
  const {
    isOpen,
    state,
    triggerRef,
    popoverRef,
    triggerProps,
    popoverProps,
  } = useHoverIconModal({ id: 'composer-context-usage' });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPos({
      left: Math.max(12, Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 12)),
      bottom: window.innerHeight - rect.top + 12,
    });
  }, [isOpen, triggerRef]);

  return (
    <>
      <div className="rv-chat-composer-context">
        <button
          ref={triggerRef}
          type="button"
          className={`rv-chat-composer-context-trigger${isOpen ? ' open' : ''}`}
          style={{ '--ctx-fill': contextFill } as React.CSSProperties}
          title={`Context usage: ${contextPercent}%`}
          aria-label={`Context usage: ${contextPercent}%`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          {...triggerProps}
        />
      </div>

      <HoverIconModalContainer
        isOpen={isOpen}
        state={state}
        position={popoverPos ?? { left: 0, bottom: 0 }}
        popoverRef={popoverRef}
        popoverProps={popoverProps}
        className="rv-chat-context-menu"
      >
        <div className="rv-chat-context-details">
          <div className="rv-chat-context-bar" aria-hidden="true">
            <div
              className="rv-chat-context-bar-fill"
              style={{ '--ctx-fill': contextFill } as React.CSSProperties}
            />
          </div>
          <span className="rv-chat-context-token-summary">
            {tokenSummary} · <span className="rv-chat-context-percent">{contextPercent}%</span>
          </span>
        </div>
        <button
          type="button"
          className="rv-chat-context-compact"
          role="menuitem"
          title="Compact is not connected yet"
          data-stub="true"
        >
          <span className="material-symbols-outlined" aria-hidden="true">compress</span>
          <span>Compact</span>
        </button>
      </HoverIconModalContainer>
    </>
  );
}
