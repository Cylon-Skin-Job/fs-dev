import { useEffect, useRef } from 'react';
import '../styles/dropdown.css';
import './ConnectorsDropdown.css';
import { usePanelStore } from '../state/panelStore';
import type { ConnectorId } from '../state/panelStoreTypes';

const CONNECTOR_META: {
  id: ConnectorId;
  name: string;
  icon: string;
}[] = [
  { id: 'mail',      name: 'Apple Mail',     icon: 'mail' },
  { id: 'calendar',  name: 'Apple Calendar', icon: 'calendar_month' },
  { id: 'notes',     name: 'Apple Notes',    icon: 'note_stack' },
  { id: 'reminders', name: 'Apple Reminders', icon: 'task_alt' },
];

const STATUS_LABEL: Record<string, string> = {
  gray:   'Off',
  yellow: 'Syncing',
  green:  'Connected',
  red:    'Error',
};

export function ConnectorsDropdown() {
  const rootRef = useRef<HTMLDivElement>(null);
  const open = usePanelStore((s) => s.isConnectorsDropdownOpen);
  const statuses = usePanelStore((s) => s.connectorStatuses);
  const toggleConnector = usePanelStore((s) => s.toggleConnector);
  const setConnectorsDropdownOpen = usePanelStore((s) => s.setConnectorsDropdownOpen);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setConnectorsDropdownOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [open, setConnectorsDropdownOpen]);

  useEffect(() => () => setConnectorsDropdownOpen(false), [setConnectorsDropdownOpen]);

  return (
    <div
      ref={rootRef}
      className="rv-dropdown rv-connectors-dropdown"
      role="menu"
      data-open={open}
      aria-label="macOS Connectors"
    >
      <div className="rv-dropdown-header">
        <span className="material-symbols-outlined">hub</span>
        <span>macOS Connectors</span>
      </div>

      {CONNECTOR_META.map((meta) => {
        const state = statuses[meta.id];
        const statusLabel = STATUS_LABEL[state.status] ?? state.status;
        return (
          <div key={meta.id} className="rv-dropdown-item rv-connectors-item" role="menuitem">
            <span className="material-symbols-outlined rv-connectors-icon">{meta.icon}</span>

            <div className="rv-connectors-info">
              <span className="rv-connectors-name">{meta.name}</span>
              {state.lastSync && (
                <span className="rv-connectors-meta">
                  {new Date(state.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className="rv-connectors-right">
              <span
                className={`rv-connectors-status rv-connectors-status--${state.status}`}
                title={statusLabel}
                aria-label={statusLabel}
              />
              <button
                className={`rv-connectors-toggle ${state.enabled ? 'on' : ''}`}
                onClick={() => toggleConnector(meta.id)}
                aria-label={`${state.enabled ? 'Disable' : 'Enable'} ${meta.name}`}
                type="button"
              >
                <span className="rv-connectors-toggle-knob" />
              </button>
            </div>
          </div>
        );
      })}

      <div className="rv-dropdown-footer">
        <button
          className="rv-dropdown-footer-btn"
          onClick={() => setConnectorsDropdownOpen(false)}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default ConnectorsDropdown;
