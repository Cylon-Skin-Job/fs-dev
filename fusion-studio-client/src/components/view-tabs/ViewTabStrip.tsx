import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  viewTabDomId,
  viewTabPanelDomId,
  viewTabSingleIdentityDomId,
} from './viewTabDomIds';

export interface ViewTabDescriptor {
  id: string;
  label: string;
  icon: string;
  iconClassName?: string;
  closeLabel: string;
  closable?: boolean;
  closeDisabled?: boolean;
}

export interface ViewTabAddAction {
  label: string;
  icon?: string;
  onAdd: () => string | null;
}

interface ViewTabStripProps {
  panelId: string;
  label: string;
  tabs: ViewTabDescriptor[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  add?: ViewTabAddAction;
}

export function ViewTabStrip({
  panelId,
  label,
  tabs,
  activeId,
  onActivate,
  onClose,
  add,
}: ViewTabStripProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [rovingId, setRovingId] = useState(() => activeId || tabs[0]?.id);
  const [compact, setCompact] = useState(false);
  const [railFocused, setRailFocused] = useState(false);
  const effectiveRovingId = railFocused && tabs.some((tab) => tab.id === rovingId)
    ? rovingId
    : (activeId || tabs[0]?.id);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const updateDensity = () => {
      const first = rail.querySelector<HTMLElement>('[role="tab"]');
      setCompact(Boolean(first && first.getBoundingClientRect().width <= 120));
    };
    const observer = new ResizeObserver(updateDensity);
    observer.observe(rail);
    updateDensity();
    return () => observer.disconnect();
  }, [tabs.length]);

  const focusTab = (id: string) => {
    setRovingId(id);
    requestAnimationFrame(() => {
      const button = Array.from(railRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])
        .find((candidate) => candidate.dataset.tabId === id);
      button?.focus();
    });
  };

  const recoverFocus = (id: string | null, origin?: HTMLElement | null) => {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (origin
        && activeElement
        && activeElement !== document.body
        && activeElement !== origin) {
        return;
      }
      if (id) {
        const button = document.getElementById(viewTabDomId(panelId, id));
        if (button) {
          setRovingId(id);
          button.focus();
          return;
        }
        const singleIdentity = document.getElementById(
          viewTabSingleIdentityDomId(panelId, id),
        );
        if (singleIdentity) {
          singleIdentity.focus();
          return;
        }
      }
      document.querySelector<HTMLElement>(
        `.rv-panel[data-panel="${CSS.escape(panelId)}"].active .rv-content-area`,
      )?.focus();
    });
  };

  const close = (id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const descriptor = tabs[index];
    if (!descriptor?.closable || descriptor.closeDisabled) return;
    const focusId = id === activeId
      ? (tabs[index - 1]?.id ?? tabs[index + 1]?.id ?? null)
      : activeId;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onClose(id);
    recoverFocus(focusId, origin);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    let nextId: string | null = null;
    if (event.key === 'ArrowLeft') nextId = tabs[(index - 1 + tabs.length) % tabs.length]?.id ?? null;
    if (event.key === 'ArrowRight') nextId = tabs[(index + 1) % tabs.length]?.id ?? null;
    if (event.key === 'Home') nextId = tabs[0]?.id ?? null;
    if (event.key === 'End') nextId = tabs.at(-1)?.id ?? null;
    if (nextId) {
      event.preventDefault();
      focusTab(nextId);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate(id);
      focusTab(id);
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      close(id);
    }
  };

  const onTabClick = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setRovingId(id);
    onActivate(id);
    event.currentTarget.focus();
  };

  return (
    <div
      ref={railRef}
      className={`rv-view-tab-rail rv-interaction-context${compact ? ' is-compact' : ''}`}
      onFocus={() => setRailFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setRailFocused(false);
          setRovingId(activeId || tabs[0]?.id);
        }
      }}
    >
      <div className="rv-view-tab-list" role="tablist" aria-orientation="horizontal" aria-label={label}>
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          const roving = tab.id === effectiveRovingId;
          return (
            <div
              key={tab.id}
              className={`rv-view-tab-item${selected ? ' is-selected' : ''}`}
              role="presentation"
            >
              <button
                type="button"
                id={viewTabDomId(panelId, tab.id)}
                className="rv-view-tab"
                role="tab"
                aria-selected={selected}
                aria-controls={viewTabPanelDomId(panelId)}
                aria-keyshortcuts={tab.closable ? 'Delete' : undefined}
                data-tab-id={tab.id}
                tabIndex={roving ? 0 : -1}
                onFocus={() => setRovingId(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, tab.id)}
                onClick={(event) => onTabClick(event, tab.id)}
              >
                <span
                  className={`material-symbols-outlined rv-view-tab-icon${tab.iconClassName ? ` ${tab.iconClassName}` : ''}`}
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
                <span className="rv-view-tab-label">{tab.label}</span>
              </button>
              {tab.closable ? (
                <button
                  type="button"
                  className="rv-view-tab-close"
                  aria-label={tab.closeLabel}
                  title={tab.closeLabel}
                  disabled={tab.closeDisabled}
                  tabIndex={roving ? 0 : -1}
                  onClick={(event) => {
                    event.stopPropagation();
                    close(tab.id);
                  }}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {add ? (
        <button
          type="button"
          className="rv-view-tab-add"
          aria-label={add.label}
          title={add.label}
          onClick={(event) => {
            const createdId = add.onAdd();
            if (createdId) recoverFocus(createdId);
            else event.currentTarget.focus();
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">{add.icon ?? 'add'}</span>
        </button>
      ) : null}
    </div>
  );
}
