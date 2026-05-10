import { usePanelStore } from '../state/panelStore';
import { useResolvedCliList } from '../config/harness';
import { useCliAccentResolver } from '../hooks/useCliAccentStyle';
import type { HarnessStatus, ResolvedCliEntry } from '../types';

interface CliPickerDropdownProps {
  panel: string;
  statuses: Record<string, HarnessStatus>;
  onSelect: (harnessId: string) => void;
}

function isSelectable(entry: ResolvedCliEntry, statuses: Record<string, HarnessStatus>): boolean {
  const s = statuses[entry.id];
  if (s) return s.installed || s.builtIn;
  return entry.enabled;
}

function badgeLabel(entry: ResolvedCliEntry, s: HarnessStatus | undefined): string | null {
  if (s?.builtIn) return 'Built-in';
  if (s?.installed) return 'Installed';
  if (s?.action === 'install') return 'Not installed';
  if (entry.recommended) return 'Recommended';
  return null;
}

export function CliPickerDropdown({ panel, statuses, onSelect }: CliPickerDropdownProps) {
  const open = usePanelStore((s) => !!s.cliPickerOpen[panel]);
  const closeCliPicker = usePanelStore((s) => s.closeCliPicker);
  const resolveCliAccent = useCliAccentResolver();
  const resolvedList = useResolvedCliList();

  const handleSelect = (id: string) => {
    onSelect(id);
    closeCliPicker(panel);
  };

  // CLI_CONFIG_SPEC §8c: filter hidden entries; list is already sorted by order.
  const visible = resolvedList.filter((e) => e.enabled);
  const anySelectable = visible.some((e) => isSelectable(e, statuses));

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
        visible.map((entry) => {
          const s = statuses[entry.id];
          const selectable = isSelectable(entry, statuses);
          const label = badgeLabel(entry, s);
          return (
            <button
              key={entry.id}
              role="menuitem"
              className="rv-dropdown-item"
              style={resolveCliAccent(entry.id)}
              onClick={() => selectable && handleSelect(entry.id)}
              disabled={!selectable}
              aria-label={`Start chat with ${entry.name}`}
            >
              <span className="material-symbols-outlined">{entry.materialIcon}</span>
              <span>{entry.name}</span>
              {label && <span className="rv-dropdown-item-badge">{label}</span>}
            </button>
          );
        })
      )}
    </div>
  );
}

export default CliPickerDropdown;
