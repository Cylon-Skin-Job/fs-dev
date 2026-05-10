import { usePanelStore } from '../state/panelStore';
import { useWorkspaceStore } from '../state/workspaceStore';

interface ToolsPanelProps {
  currentPanel: string;
  onSwitch: (id: string) => void;
}

export function ToolsPanel({ currentPanel, onSwitch }: ToolsPanelProps) {
  const configs = usePanelStore((s) => s.panelConfigs);
  const workspaceType = useWorkspaceStore((s) => s.workspaceType);

  // Code workspaces: flat list (existing behavior)
  if (workspaceType === 'code') {
    return (
      <nav className="rv-tools-panel">
        {configs.map((config) => (
          <button
            key={config.id}
            className={`rv-tool-btn ${currentPanel === config.id ? 'active' : ''}`}
            onClick={() => onSwitch(config.id)}
            title={config.name}
          >
            <span className="material-symbols-outlined rv-icon-xl">
              {config.icon}
            </span>
          </button>
        ))}
      </nav>
    );
  }

  // App workspaces: two zones with divider
  const apps = configs.filter((c) => c.category === 'app');
  const tools = configs.filter((c) => c.category === 'tool');

  return (
    <nav className="rv-tools-panel rv-tools-panel--app">
      {/* Apps zone — spaced out, top */}
      <div className="rv-tools-apps">
        {apps.map((config) => (
          <button
            key={config.id}
            className={`rv-tool-btn rv-tool-btn--app ${currentPanel === config.id ? 'active' : ''}`}
            onClick={() => onSwitch(config.id)}
            title={config.name}
          >
            <span className="material-symbols-outlined rv-icon-xl">
              {config.icon}
            </span>
          </button>
        ))}
      </div>

      {/* Divider */}
      {apps.length > 0 && tools.length > 0 && (
        <hr className="rv-tools-divider" />
      )}

      {/* Tools zone — bottom */}
      <div className="rv-tools-tools">
        {tools.map((config) => (
          <button
            key={config.id}
            className={`rv-tool-btn rv-tool-btn--tool ${currentPanel === config.id ? 'active' : ''}`}
            onClick={() => onSwitch(config.id)}
            title={config.name}
          >
            <span className="material-symbols-outlined rv-icon-xl">
              {config.icon}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
