import { useWorkspaceStore } from '../state/workspaceStore';
import './AiSourceSelector.css';

/** App-header selector for the ai/<machine>/ source currently owned by the server. */
export function AiSourceSelector() {
  const sourceMachineName = useWorkspaceStore((state) => state.sourceMachineName);

  return (
    <label className="rv-ai-source-selector">
      <span className="rv-ai-source-selector__label">AI source</span>
      <select
        className="rv-ai-source-selector__select"
        defaultValue="local"
        aria-label="AI source"
        title={`Local AI source: ai/${sourceMachineName}`}
      >
        <option value="local">Local: {sourceMachineName}</option>
        <option value="remote" disabled>Remote: Not configured</option>
      </select>
      <span className="material-symbols-outlined rv-ai-source-selector__arrow" aria-hidden="true">
        arrow_drop_down
      </span>
    </label>
  );
}
