/**
 * SecretsManagerButton — circular key button in rv-header-right.
 * Toggles the SecretsManager popover. Mirrors ThemePickerButton.
 * See SECRETS_MANAGER_SPEC.md §5a.
 */

import { useState, useRef, useEffect } from 'react';
import SecretsManager from './SecretsManager';
import { listApiKeys } from './api-keys/api-keys-api';

export default function SecretsManagerButton() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Hydrate the store whenever the popover opens.
  useEffect(() => {
    if (open) listApiKeys();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
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
    <div className="rv-secrets-swatch-wrapper">
      <button
        ref={btnRef}
        className={`rv-secrets-swatch-btn${open ? ' open' : ''}`}
        title="Secrets"
        onClick={() => setOpen(v => !v)}
        aria-label="Open secrets manager"
      >
        <span className="material-symbols-outlined">key</span>
      </button>
      {open && (
        <div ref={popoverRef} className="rv-secrets-popover">
          <div className="rv-secrets-popover-arrow" />
          <SecretsManager onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
