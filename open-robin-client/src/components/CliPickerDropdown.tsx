import { usePanelStore } from '../state/panelStore';
import { HARNESS_OPTIONS, type HarnessOption } from '../config/harness';
import type { HarnessStatus } from './ChatHarnessPicker';

interface CliPickerDropdownProps {
  panel: string;
  statuses: Record<string, HarnessStatus>;
  onSelect: (harnessId: string) => void;
}

function isSelectable(option: HarnessOption, statuses: Record<string, HarnessStatus>): boolean {
  const s = statuses[option.id];
  if (s) return s.installed || s.builtIn;
  return option.enabled;
}

function badgeLabel(option: HarnessOption, s: HarnessStatus | undefined): string | null {
  if (s?.builtIn) return 'Built-in';
  if (s?.installed) return 'Installed';
  if (s?.action === 'install') return 'Not installed';
  if (option.recommended) return 'Recommended';
  return null;
}

export function CliPickerDropdown({ panel, statuses, onSelect }: CliPickerDropdownProps) {
  const open = usePanelStore((s) => !!s.cliPickerOpen[panel]);
  const closeCliPicker = usePanelStore((s) => s.closeCliPicker);

  const handleSelect = (id: string) => {
    onSelect(id);
    closeCliPicker(panel);
  };

  const anySelectable = HARNESS_OPTIONS.some((o) => isSelectable(o, statuses));

  return (
    <div
      className="rv-dropdown rv-cli-picker-dropdown"
      role="menu"
      data-open={open}
      id={`cli-picker-${panel}`}
      aria-label="Start a new chat with"
    >
      {!anySelectable ? (
        <div className="rv-dropdown-empty">No AI backends available</div>
      ) : (
        HARNESS_OPTIONS.map((option) => {
          const s = statuses[option.id];
          const selectable = isSelectable(option, statuses);
          const label = badgeLabel(option, s);
          return (
            <button
              key={option.id}
              role="menuitem"
              className="rv-dropdown-item"
              onClick={() => selectable && handleSelect(option.id)}
              disabled={!selectable}
              aria-label={`Start chat with ${option.name}`}
            >
              <span aria-hidden="true">{option.icon}</span>
              <span>{option.name}</span>
              {label && <span className="rv-dropdown-item-badge">{label}</span>}
            </button>
          );
        })
      )}
    </div>
  );
}

export default CliPickerDropdown;
