/**
 * @module ChatComposerModelMenu
 * @role Visual composer provider/model/effort menu mock-up.
 */

import { useEffect, useRef, useState } from 'react';

const MODEL_MENU_ITEMS = ['Provider', 'Model', 'Effort'];

export function ChatComposerModelMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open]);

  return (
    <div className="rv-chat-composer-model" ref={rootRef}>
      <button
        type="button"
        className={`rv-chat-composer-model-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="Deepseek V4 Flash"
        aria-label="Deepseek V4 Flash"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>Deepseek V4 Flash</span>
        <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
      </button>

      {open && (
        <div
          className="rv-dropdown rv-chat-composer-model-menu"
          data-open="true"
          role="menu"
          aria-label="Model configuration"
        >
          {MODEL_MENU_ITEMS.map((label) => (
            <button
              key={label}
              type="button"
              className="rv-chat-composer-model-option"
              role="menuitem"
            >
              <span>{label}</span>
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
