/**
 * @module ChatComposerModelMenu
 * @role Composer provider/model/effort picker with nested flyout menus.
 *
 * Source of truth: the per-machine `opencode-models.json` surfaced through the
 * resolved opencode harness entry (`cliConfig.opencode.models`). Selecting a
 * provider loads its default model; effort defaults to 'high' on every change
 * and can then be adjusted from the chosen model's variant list.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { useResolvedHarness } from '../../config/harness';
import type { ResolvedCliEntry } from '../../types';

const DEFAULT_EFFORT = 'high';

interface ModelMenuEntry {
  id: string;
  name: string;
  variants: string[];
}

interface ProviderMenuEntry {
  id: string | null;
  label: string | null;
  defaultModel: string | null;
  models: ModelMenuEntry[];
}

interface OpenCodeModels {
  defaultProvider: string | null;
  providers: ProviderMenuEntry[];
}

type MenuLevel = 'root' | 'provider' | 'model' | 'effort';

function getModels(harness: ResolvedCliEntry | null): OpenCodeModels | null {
  const models = harness?.models;
  if (!models || !Array.isArray(models.providers)) return null;
  return models as OpenCodeModels;
}

function findProvider(models: OpenCodeModels | null, providerId: string | null): ProviderMenuEntry | null {
  if (!models || !providerId) return null;
  return models.providers.find((p) => p.id === providerId) ?? null;
}

function findModel(provider: ProviderMenuEntry | null, modelId: string | null): ModelMenuEntry | null {
  if (!provider || !modelId) return null;
  return provider.models.find((m) => m.id === modelId) ?? null;
}

function currentModelLabel(
  models: OpenCodeModels | null,
  provider: ProviderMenuEntry | null,
  model: ModelMenuEntry | null,
): string {
  if (model) return model.name;
  if (provider?.defaultModel) {
    return findModel(provider, provider.defaultModel)?.name ?? provider.defaultModel;
  }
  return models?.providers[0]?.models[0]?.name ?? 'DeepSeek V4 Flash';
}

export function ChatComposerModelMenu() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuLevel>('root');
  const [hoverProvider, setHoverProvider] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const harness = useResolvedHarness('opencode');
  const composerModelConfig = usePanelStore((s) => s.composerModelConfig);
  const setComposerModelConfig = usePanelStore((s) => s.setComposerModelConfig);
  const currentPanel = usePanelStore((s) => s.currentPanel);

  const models = useMemo(() => getModels(harness), [harness]);
  const selection = composerModelConfig[currentPanel] ?? { providerId: null, modelId: null, effort: null };

  // Seed the initial selection (default provider → default model → effort high)
  // once models hydrate, so the first prompt already carries the defaults and
  // the Effort item reflects 'high' without requiring an interaction.
  useEffect(() => {
    if (!models || !models.providers.length) return;
    if (composerModelConfig[currentPanel]) return;
    const defaultProvider = models.defaultProvider
      ? models.providers.find((p) => p.id === models.defaultProvider) ?? models.providers[0]
      : models.providers[0];
    const defaultModelId = defaultProvider?.defaultModel ?? defaultProvider?.models?.[0]?.id ?? null;
    const defaultModelEntry = defaultProvider?.models?.find((m) => m.id === defaultModelId) ?? null;
    const seedEffort = defaultModelEntry?.variants?.includes(DEFAULT_EFFORT)
      ? DEFAULT_EFFORT
      : defaultModelEntry?.variants?.[0] ?? null;
    setComposerModelConfig(currentPanel, {
      providerId: defaultProvider?.id ?? null,
      modelId: defaultModelId,
      effort: seedEffort,
    });
  }, [models, composerModelConfig, currentPanel, setComposerModelConfig]);

  const provider = useMemo(
    () => findProvider(models, selection.providerId ?? models?.defaultProvider ?? null),
    [models, selection.providerId],
  );
  const model = useMemo(
    () => findModel(provider, selection.modelId ?? provider?.defaultModel ?? null),
    [provider, selection.modelId],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (level !== 'root') {
          setLevel('root');
          return;
        }
        setOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setLevel('root');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open, level]);

  const resetToDefaultEffort = (patch: { providerId?: string | null; modelId?: string | null }) => {
    const nextProvider = patch.providerId !== undefined
      ? findProvider(models, patch.providerId)
      : provider;
    const nextModel = patch.modelId !== undefined
      ? findModel(nextProvider, patch.modelId)
      : model;
    const defaultEffort = nextModel?.variants?.includes(DEFAULT_EFFORT)
      ? DEFAULT_EFFORT
      : nextModel?.variants?.[0] ?? null;
    setComposerModelConfig(currentPanel, { ...patch, effort: defaultEffort });
  };

  const handleSelectProvider = (providerId: string) => {
    const providerEntry = findProvider(models, providerId);
    resetToDefaultEffort({
      providerId,
      modelId: providerEntry?.defaultModel ?? null,
    });
    setLevel('root');
  };

  const handleSelectModel = (modelId: string) => {
    resetToDefaultEffort({ modelId });
    setLevel('root');
  };

  const handleSelectEffort = (effort: string) => {
    setComposerModelConfig(currentPanel, { effort });
    setLevel('root');
  };

  const selectableProviders = models?.providers ?? [];
  const currentModelId = selection.modelId ?? provider?.defaultModel ?? null;
  const effortOptions = model?.variants?.length ? model.variants : [];

  return (
    <div className="rv-chat-composer-model" ref={rootRef}>
      <button
        type="button"
        className={`rv-chat-composer-model-trigger${open ? ' open' : ''}`}
        onClick={() => {
          setOpen((value) => !value);
          setLevel('root');
        }}
        title={currentModelLabel(models, provider, model)}
        aria-label={currentModelLabel(models, provider, model)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{currentModelLabel(models, provider, model)}</span>
        <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
      </button>

      {open && (
        <div
          className="rv-dropdown rv-chat-composer-model-menu"
          data-open="true"
          role="menu"
          aria-label="Model configuration"
        >
          {level === 'root' && (
            <>
              <button
                type="button"
                className="rv-chat-composer-model-option"
                role="menuitem"
                onClick={() => setLevel('provider')}
              >
                <span>Provider</span>
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
              <button
                type="button"
                className="rv-chat-composer-model-option"
                role="menuitem"
                onClick={() => setLevel('model')}
              >
                <span>Model</span>
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
              <button
                type="button"
                className="rv-chat-composer-model-option"
                role="menuitem"
                onClick={() => setLevel('effort')}
                disabled={effortOptions.length === 0}
              >
                <span>Effort</span>
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
            </>
          )}

          {level === 'provider' && (
            <>
              <button
                type="button"
                className="rv-chat-composer-model-back"
                role="menuitem"
                onClick={() => setLevel('root')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                <span>Providers</span>
              </button>
              {selectableProviders.map((p) => (
                <div
                  key={p.id ?? p.label ?? 'provider'}
                  className="rv-chat-composer-provider-row"
                  onMouseEnter={() => setHoverProvider(p.id)}
                  onMouseLeave={() => setHoverProvider((id) => (id === p.id ? null : id))}
                >
                  <button
                    type="button"
                    className="rv-chat-composer-model-option"
                    role="menuitem"
                    onClick={() => p.id && handleSelectProvider(p.id)}
                  >
                    <span>{p.label ?? p.id}</span>
                    <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                  </button>
                  {hoverProvider === p.id && p.models.length > 0 && (
                    <div className="rv-chat-composer-flyout" role="menu">
                      {p.models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`rv-chat-composer-model-option${m.id === currentModelId ? ' rv-chat-composer-model-option-active' : ''}`}
                          role="menuitem"
                          onClick={() => handleSelectModel(m.id)}
                        >
                          <span>{m.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {level === 'model' && (
            <>
              <button
                type="button"
                className="rv-chat-composer-model-back"
                role="menuitem"
                onClick={() => setLevel('root')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                <span>{provider?.label ?? 'Models'}</span>
              </button>
              {(provider?.models ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`rv-chat-composer-model-option${m.id === currentModelId ? ' rv-chat-composer-model-option-active' : ''}`}
                  role="menuitem"
                  onClick={() => handleSelectModel(m.id)}
                >
                  <span>{m.name}</span>
                </button>
              ))}
            </>
          )}

          {level === 'effort' && effortOptions.length > 0 && (
            <>
              <button
                type="button"
                className="rv-chat-composer-model-back"
                role="menuitem"
                onClick={() => setLevel('root')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                <span>Effort</span>
              </button>
              {effortOptions.map((effort) => (
                <button
                  key={effort}
                  type="button"
                  className={`rv-chat-composer-model-option${effort === selection.effort ? ' rv-chat-composer-model-option-active' : ''}`}
                  role="menuitem"
                  onClick={() => handleSelectEffort(effort)}
                >
                  <span>{effort}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
