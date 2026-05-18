/**
 * ThemePickerButton — circular swatch in rv-header-right.
 * Reads the active accent from the theme catalog and renders a colored dot.
 * Clicking toggles ThemePicker popover.
 * See THEME_PICKER_SPEC.md §3a.
 */

import { useRef, useEffect } from 'react';
import { usePanelStore } from '../state/panelStore';
import ThemePicker from './ThemePicker';

export default function ThemePickerButton() {
  const open = usePanelStore((s) => s.isThemePickerOpen);
  const setOpen = usePanelStore((s) => s.setThemePickerOpen);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  return (
    <div className="rv-theme-swatch-wrapper">
      <button
        ref={btnRef}
        className={`rv-theme-swatch-btn${open ? ' open' : ''}`}
        title="Workspace theme"
        onClick={() => setOpen(!open)}
        aria-label="Open theme picker"
      >
        <span className="material-symbols-outlined">palette</span>
      </button>
      {open && (
        <>
          <div className="rv-theme-picker-scrim" onClick={() => setOpen(false)} />
          <div className="rv-theme-picker-modal">
            <ThemePicker onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
