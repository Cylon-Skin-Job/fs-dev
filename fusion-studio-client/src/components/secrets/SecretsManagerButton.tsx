/**
 * SecretsManagerButton — circular key button in rv-header-right.
 * Toggles the SecretsManager popover. Mirrors ThemePickerButton.
 * See SECRETS_MANAGER_SPEC.md §5a.
 */

import { useRef, useEffect } from 'react';
import { usePanelStore } from '../../state/panelStore';
import SecretsManager from './SecretsManager';
import { listApiKeys } from './api-keys/api-keys-api';

export default function SecretsManagerButton() {
  const open = usePanelStore((s) => s.isSecretsManagerOpen);
  const setOpen = usePanelStore((s) => s.setSecretsManagerOpen);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Hydrate the store whenever the popover opens.
  useEffect(() => {
    if (open) listApiKeys();
  }, [open]);

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
    <div className="rv-secrets-swatch-wrapper">
      <button
        ref={btnRef}
        className={`rv-secrets-swatch-btn${open ? ' open' : ''}`}
        title="Secrets"
        onClick={() => setOpen(!open)}
        aria-label="Open secrets manager"
      >
        <span className="material-symbols-outlined">key</span>
      </button>
      {open && (
        <>
          <div className="rv-secrets-scrim" onClick={() => setOpen(false)} />
          <div className="rv-secrets-modal">
            <SecretsManager onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
