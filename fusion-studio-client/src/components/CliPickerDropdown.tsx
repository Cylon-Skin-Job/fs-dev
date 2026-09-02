import '../styles/dropdown.css';
import './CliPickerDropdown.css';
import { useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { getSelectableHarnesses, useResolvedCliList } from '../config/harness';
import { useCliAccentResolver } from '../hooks/useCliAccentStyle';
import type { HarnessStatus, ResolvedCliEntry } from '../types';

interface CliPickerDropdownProps {
  panel: string;
  statuses: Record<string, HarnessStatus>;
  onSelect: (harnessId: string, modelId?: string) => void;
}

function isSelectable(entry: ResolvedCliEntry, statuses: Record<string, HarnessStatus>): boolean {
  const s = statuses[entry.id];
  if (s) return s.installed || s.builtIn;
  return entry.enabled;
}

function resolveDefaultModel(models: NonNullable<ResolvedCliEntry['models']>): string | null {
  const pick = (provider: NonNullable<NonNullable<ResolvedCliEntry['models']>['providers'][number]>) =>
    provider?.defaultModel || provider?.models?.[0]?.id || null;
  if (models.defaultProvider) {
    const provider = models.providers.find((p) => p.id === models.defaultProvider);
    if (provider) {
      const model = pick(provider);
      if (model) return model;
    }
  }
  return pick(models.providers[0]);
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

  const [modelPickerFor, setModelPickerFor] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    onSelect(id);
    closeCliPicker(panel);
  };

  const handleModelSelect = (id: string, modelId: string) => {
    onSelect(id, modelId);
    closeCliPicker(panel);
  };

  // CLI_CONFIG_SPEC §8c: filter hidden entries; list is already sorted by order.
  const visible = resolvedList.filter((e) => e.enabled);
  const anySelectable = getSelectableHarnesses(visible, statuses).length > 0;
  const modelTarget = modelPickerFor ? visible.find((e) => e.id === modelPickerFor) : null;

  if (modelTarget?.models?.providers?.length) {
    const defaultModel = resolveDefaultModel(modelTarget.models);
    const currentModel = modelTarget.runtime?.model || defaultModel;
    return (
      <div
        className="rv-dropdown rv-cli-picker-dropdown"
        role="menu"
        data-open={open}
        id={`cli-picker-${panel}`}
        aria-label={`Choose a model for ${modelTarget.name}`}
      >
        <button
          className="rv-dropdown-item rv-cli-picker-back"
          role="menuitem"
          onClick={() => setModelPickerFor(null)}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>{modelTarget.name}</span>
        </button>
        {modelTarget.models.providers.map((provider) => (
          <div key={provider.id || provider.label || provider.models[0]?.id} className="rv-cli-picker-group">
            {provider.label && (
              <div className="rv-cli-picker-group-label">{provider.label}</div>
            )}
            {provider.models.map((modelEntry) => (
              <button
                key={modelEntry.id}
                role="menuitem"
                className={`rv-dropdown-item${modelEntry.id === currentModel ? ' rv-dropdown-item-active' : ''}`}
                style={resolveCliAccent(modelTarget.id)}
                onClick={() => handleModelSelect(modelTarget.id, modelEntry.id)}
              >
                <span className="material-symbols-outlined">
                  {modelEntry.id === currentModel ? 'check' : 'smart_toy'}
                </span>
                <span className="rv-cli-picker-model-name">{modelEntry.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

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
          const hasModels = !!entry.models?.providers?.length;
          return (
            <button
              key={entry.id}
              role="menuitem"
              className="rv-dropdown-item"
              style={resolveCliAccent(entry.id)}
              onClick={() => (hasModels ? setModelPickerFor(entry.id) : selectable && handleSelect(entry.id))}
              disabled={!hasModels && !selectable}
              aria-label={`Start chat with ${entry.name}${hasModels ? ' (choose model)' : ''}`}
            >
              <span className="material-symbols-outlined">{entry.materialIcon}</span>
              <span>{entry.name}</span>
              {hasModels && <span className="material-symbols-outlined rv-cli-picker-chevron">chevron_right</span>}
              {label && <span className="rv-dropdown-item-badge">{label}</span>}
            </button>
          );
        })
      )}
    </div>
  );
}

export default CliPickerDropdown;
