/**
 * @module ChatComposerModelMenu
 * @role Composer provider/model/effort picker with nested flyout menus.
 *
 * Source of truth: the per-machine `opencode-models.json` surfaced through the
 * resolved opencode harness entry (`cliConfig.opencode.models`). Selecting a
 * provider loads its default model; effort defaults to 'high' on every change
 * and can then be adjusted from the chosen model's variant list.
 *
 * SPEC-02 §6.2: the menu renders one explicit session's selection. It receives
 * the exact `threadId`/`surfaceId` and the last server-acknowledged value; an
 * optimistic change is emitted through `onChangeSelection` and never becomes
 * Send authority until the exact-session acknowledgement promotes it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useResolvedHarness } from '../../config/harness';
import type { ResolvedCliEntry } from '../../types';
import type { ChatSurfaceModelSelection } from './chatSurfaceContract';

const DEFAULT_EFFORT = 'high';
const FLYOUT_GAP = 6;
const FLYOUT_TOP_OFFSET = 8;
const FLYOUT_MIN_WIDTH = 200;
const FLYOUT_CLOSE_DELAY_MS = 150;

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

type FlyoutCloseTimer = ReturnType<typeof setTimeout> | null;

function clearFlyoutTimer(timer: { current: FlyoutCloseTimer }) {
  if (timer.current) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

function getModels(harness: ResolvedCliEntry | null): OpenCodeModels | null {
  const models = harness?.models;
  if (!models || !Array.isArray(models.providers)) return null;
  return models as OpenCodeModels;
}

function findProvider(models: OpenCodeModels | null, providerId: string | null): ProviderMenuEntry | null {
  if (!models || !providerId) return null;
  return models.providers.find((p) => p.id === providerId) ?? null;
}

function findProviderForModel(models: OpenCodeModels | null, modelId: string | null): ProviderMenuEntry | null {
  if (!models || !modelId) return null;
  return models.providers.find((p) => p.models.some((m) => m.id === modelId)) ?? null;
}

function findModel(provider: ProviderMenuEntry | null, modelId: string | null): ModelMenuEntry | null {
  if (!provider || !modelId) return null;
  return provider.models.find((m) => m.id === modelId) ?? null;
}

function defaultEffortFor(model: ModelMenuEntry | null): string | null {
  if (!model) return null;
  return model.variants.includes(DEFAULT_EFFORT)
    ? DEFAULT_EFFORT
    : model.variants[0] ?? null;
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

export interface ChatComposerModelMenuProps {
  threadId: string | null;
  mountId: string;
  selection: ChatSurfaceModelSelection;
  onChangeSelection: (patch: { modelId?: string | null; variant?: string | null }) => void;
}

export function ChatComposerModelMenu({
  threadId,
  mountId,
  selection,
  onChangeSelection,
}: ChatComposerModelMenuProps) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuLevel>('root');
  const [hoverProvider, setHoverProvider] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const harness = useResolvedHarness('opencode');
  const models = useMemo(() => getModels(harness), [harness]);

  // The provider is derived from the acknowledged/optimistic model id; a null
  // model falls back to the catalog default for display only. Nothing is
  // written to the session until the user changes the selection.
  const provider = useMemo(
    () => findProviderForModel(models, selection.modelId)
      ?? findProvider(models, models?.defaultProvider ?? null)
      ?? models?.providers[0]
      ?? null,
    [models, selection.modelId],
  );
  const model = useMemo(
    () => findModel(provider, selection.modelId ?? provider?.defaultModel ?? null),
    [provider, selection.modelId],
  );

  // The provider flyout lives in a body portal, so hover handoff between the
  // row and the flyout crosses a DOM boundary; a short close delay bridges the
  // travel gap without flicker.
  const cancelFlyoutClose = () => {
    clearFlyoutTimer(flyoutCloseTimer);
  };

  const scheduleFlyoutClose = () => {
    cancelFlyoutClose();
    flyoutCloseTimer.current = setTimeout(() => {
      flyoutCloseTimer.current = null;
      setHoverProvider(null);
      setFlyoutPos(null);
    }, FLYOUT_CLOSE_DELAY_MS);
  };

  const openFlyout = (providerId: string, rowEl: HTMLElement) => {
    cancelFlyoutClose();
    setHoverProvider(providerId);
    const rect = rowEl.getBoundingClientRect();
    const right = rect.right + FLYOUT_GAP + FLYOUT_MIN_WIDTH;
    const flip = right > window.innerWidth;
    setFlyoutPos({
      x: flip ? rect.left - FLYOUT_GAP - FLYOUT_MIN_WIDTH : rect.right + FLYOUT_GAP,
      y: Math.max(FLYOUT_TOP_OFFSET, rect.top - FLYOUT_TOP_OFFSET),
    });
  };

  const clearFlyout = useCallback(() => {
    clearFlyoutTimer(flyoutCloseTimer);
    setHoverProvider(null);
    setFlyoutPos(null);
  }, []);

  const changeLevel = useCallback((next: MenuLevel) => {
    setLevel(next);
    if (next !== 'provider') clearFlyout();
  }, [clearFlyout]);

  useEffect(() => () => clearFlyoutTimer(flyoutCloseTimer), []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (level !== 'root') {
          changeLevel('root');
          return;
        }
        setOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (flyoutRef.current?.contains(target)) return;
      setOpen(false);
      changeLevel('root');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open, level, changeLevel]);

  const handleSelectProvider = (providerId: string) => {
    const providerEntry = findProvider(models, providerId);
    const nextModelId = providerEntry?.defaultModel ?? providerEntry?.models?.[0]?.id ?? null;
    const nextModel = findModel(providerEntry, nextModelId);
    onChangeSelection({ modelId: nextModelId, variant: defaultEffortFor(nextModel) });
    changeLevel('root');
  };

  const handleSelectModel = (modelId: string) => {
    const nextModel = findModel(provider, modelId);
    onChangeSelection({ modelId, variant: defaultEffortFor(nextModel) });
    changeLevel('root');
  };

  const handleSelectEffort = (effort: string) => {
    onChangeSelection({ variant: effort });
    changeLevel('root');
  };

  const selectableProviders = models?.providers ?? [];
  const currentModelId = selection.modelId ?? provider?.defaultModel ?? null;
  const currentEffort = selection.variant ?? defaultEffortFor(model);
  const effortOptions = model?.variants?.length ? model.variants : [];

  return (
    <div
      className="rv-chat-composer-model"
      ref={rootRef}
      data-chat-mount-id={mountId}
      data-thread-id={threadId ?? ''}
      data-model-pending={selection.pending ? 'true' : 'false'}
    >
      <button
        type="button"
        className={`rv-chat-composer-model-trigger${open ? ' open' : ''}`}
        onClick={() => {
          setOpen((value) => !value);
          changeLevel('root');
        }}
        title={currentModelLabel(models, provider, model)}
        aria-label={currentModelLabel(models, provider, model)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={selection.pending || undefined}
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
                onClick={() => changeLevel('provider')}
              >
                <span>Provider</span>
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
              <button
                type="button"
                className="rv-chat-composer-model-option"
                role="menuitem"
                onClick={() => changeLevel('model')}
              >
                <span>Model</span>
                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </button>
              <button
                type="button"
                className="rv-chat-composer-model-option"
                role="menuitem"
                onClick={() => changeLevel('effort')}
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
                onClick={() => changeLevel('root')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                <span>Providers</span>
              </button>
              {selectableProviders.map((p) => (
                <div
                  key={p.id ?? p.label ?? 'provider'}
                  className="rv-chat-composer-provider-row"
                  onMouseEnter={(e) => { if (p.id && p.models.length > 0) openFlyout(p.id, e.currentTarget); }}
                  onMouseLeave={scheduleFlyoutClose}
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
                onClick={() => changeLevel('root')}
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
                onClick={() => changeLevel('root')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                <span>Effort</span>
              </button>
              {effortOptions.map((effort) => (
                <button
                  key={effort}
                  type="button"
                  className={`rv-chat-composer-model-option${effort === currentEffort ? ' rv-chat-composer-model-option-active' : ''}`}
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

      {open && level === 'provider' && flyoutPos && hoverProvider && (() => {
        const hovered = selectableProviders.find((p) => p.id === hoverProvider);
        if (!hovered || hovered.models.length === 0) return null;
        return createPortal(
          <div
            ref={flyoutRef}
            className="rv-chat-composer-flyout"
            role="menu"
            style={{ left: flyoutPos.x, top: flyoutPos.y }}
            onMouseEnter={cancelFlyoutClose}
            onMouseLeave={scheduleFlyoutClose}
          >
            {hovered.models.map((m) => (
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
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}
