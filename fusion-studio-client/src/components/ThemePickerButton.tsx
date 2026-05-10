/**
 * ThemePickerButton — circular swatch in rv-header-right.
 * Reads the active accent from the theme catalog and renders a colored dot.
 * Clicking toggles ThemePicker popover.
 * See THEME_PICKER_SPEC.md §3a.
 */

import { useState, useRef, useEffect } from 'react';
import ThemePicker from './ThemePicker';

export default function ThemePickerButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div className="rv-theme-swatch-wrapper">
      <button
        ref={btnRef}
        className={`rv-theme-swatch-btn${open ? ' open' : ''}`}
        title="Workspace theme"
        onClick={() => setOpen(v => !v)}
        aria-label="Open theme picker"
      >
        <span className="material-symbols-outlined">palette</span>
      </button>
      {open && (
        <div ref={pickerRef} className="rv-theme-picker-popover">
          <div className="rv-theme-picker-arrow" />
          <ThemePicker onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
