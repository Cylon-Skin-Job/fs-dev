/**
 * SecretsManager — popover container.
 * v1 body is always the API Keys panel; tabs strip is reserved for future sub-modules.
 * See SECRETS_MANAGER_SPEC.md §5b.
 */

import ApiKeysPanel from './api-keys/ApiKeysPanel';

interface Props { onClose: () => void; }

export default function SecretsManager({ onClose }: Props) {
  return (
    <div className="rv-secrets-manager">
      <div className="rv-secrets-manager-header">Secrets</div>
      <div className="rv-secrets-manager-divider" />
      <div className="rv-secrets-manager-body">
        <ApiKeysPanel onClose={onClose} />
      </div>
    </div>
  );
}
