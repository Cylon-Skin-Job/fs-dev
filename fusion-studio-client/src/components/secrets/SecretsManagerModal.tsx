import { usePanelStore } from '../../state/panelStore';
import SecretsManager from './SecretsManager';

export function SecretsManagerModal() {
  const open = usePanelStore((s) => s.isSecretsManagerOpen);
  const setOpen = usePanelStore((s) => s.setSecretsManagerOpen);

  if (!open) return null;

  return (
    <>
      <div className="rv-secrets-scrim" onClick={() => setOpen(false)} />
      <div className="rv-secrets-modal">
        <SecretsManager onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
