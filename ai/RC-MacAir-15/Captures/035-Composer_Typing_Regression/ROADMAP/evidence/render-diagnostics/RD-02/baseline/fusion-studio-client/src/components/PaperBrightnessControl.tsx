/**
 * @module PaperBrightnessControl
 * @role Composable paper-brightness button + slider dropdown. Portable:
 *       value/onChange via props, no store imports. Open state is
 *       self-managed by default; pass open/onOpenChange for controlled use
 *       (e.g. a toolbar with mutually exclusive dropdowns).
 *
 * Consumers: EmailToolbar, OfficeDocumentToolbar.
 */

import { useEffect, useRef, useState } from 'react';
import {
  OFFICE_PAPER_BRIGHTNESS_MAX,
  OFFICE_PAPER_BRIGHTNESS_MIN,
} from '../lib/officePaperBrightness';
import './PaperBrightnessControl.css';

interface PaperBrightnessControlProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** Controlled open state; omit for self-managed. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Replaces the default trigger-button class (consumer toolbar styling). */
  buttonClassName?: string;
  buttonActiveClassName?: string;
}

export function PaperBrightnessControl({
  value,
  onChange,
  ariaLabel = 'Paper brightness',
  open,
  onOpenChange,
  buttonClassName,
  buttonActiveClassName,
}: PaperBrightnessControlProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  const setOpenState = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const setOpenRef = useRef(setOpenState);
  setOpenRef.current = setOpenState;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpenRef.current(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenRef.current(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const baseButtonClass = buttonClassName ?? 'rv-paper-brightness-btn';
  const activeButtonClass = buttonActiveClassName ?? 'rv-paper-brightness-btn--active';

  return (
    <div className="rv-paper-brightness" ref={rootRef}>
      <button
        type="button"
        className={`${baseButtonClass}${isOpen ? ` ${activeButtonClass}` : ''}`}
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setOpenState(!isOpen)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">brightness_6</span>
      </button>
      {isOpen && (
        <div className="rv-paper-brightness-dropdown">
          <div className="rv-paper-brightness-control">
            <span className="rv-paper-brightness-icon rv-paper-brightness-icon--ringed" aria-hidden="true">
              <span className="material-symbols-outlined">light_mode</span>
            </span>
            <span className="rv-paper-brightness-slider-frame">
              <input
                className="rv-paper-brightness-slider"
                type="range"
                min={OFFICE_PAPER_BRIGHTNESS_MIN}
                max={OFFICE_PAPER_BRIGHTNESS_MAX}
                value={value}
                aria-label={ariaLabel}
                onChange={(event) => onChange(Number(event.target.value))}
              />
            </span>
            <span className="rv-paper-brightness-icon" aria-hidden="true">
              <span className="material-symbols-outlined">light_mode</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
