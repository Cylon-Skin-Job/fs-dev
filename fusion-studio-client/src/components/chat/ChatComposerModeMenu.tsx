/**
 * @module ChatComposerModeMenu
 * @role Visual composer permission-mode menu mock-up.
 */

import { useEffect, useRef, useState } from 'react';

interface ModeOption {
  id: string;
  icon: string;
  label: string;
  description?: string;
}

export const CHAT_COMPOSER_MODES: ModeOption[] = [
  {
    id: 'ask-permission',
    icon: 'shield_lock',
    label: 'Ask Permission',
    description: 'Always ask to edit files, access the internet, and run commands.',
  },
  {
    id: 'auto-run',
    icon: 'arming_countdown',
    label: 'Auto Run',
    description: 'Run continuously with workspace-wide permissions.',
  },
  {
    id: 'disk-access',
    icon: 'gpp_maybe',
    label: 'Disk Access',
    description: 'Unrestricted access to the internet and any file on your computer.',
  },
  {
    id: 'custom-config',
    icon: 'shield_toggle',
    label: 'Set Custom Config',
  },
];

export function ChatComposerModeMenu() {
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
    <div className="rv-chat-composer-mode" ref={rootRef}>
      <button
        type="button"
        className={`rv-chat-composer-mode-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="Mode"
        aria-label="Mode"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined" aria-hidden="true">shield_lock</span>
        <span className="rv-chat-composer-mode-label">Mode</span>
      </button>

      {open && (
        <div
          className="rv-dropdown rv-chat-composer-mode-menu"
          data-open="true"
          role="menu"
          aria-label="Permission mode"
        >
          {CHAT_COMPOSER_MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              className="rv-chat-composer-mode-option"
              role="menuitem"
            >
              <span className="material-symbols-outlined rv-chat-composer-mode-option-icon" aria-hidden="true">
                {option.icon}
              </span>
              <span className="rv-chat-composer-mode-option-copy">
                <span className="rv-chat-composer-mode-option-label">{option.label}</span>
                {option.description && (
                  <span className="rv-chat-composer-mode-option-description">{option.description}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
