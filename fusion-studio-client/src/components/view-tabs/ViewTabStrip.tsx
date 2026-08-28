import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { ViewTabStripProps } from './viewTabTypes';

export function ViewTabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  plus,
}: ViewTabStripProps) {
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [compactTabs, setCompactTabs] = useState(false);

  useEffect(() => {
    const tabStrip = tabStripRef.current;
    if (!tabStrip) return;

    const updateTabDensity = () => {
      const firstTab = tabStrip.querySelector<HTMLElement>('.rv-view-tab');
      setCompactTabs(Boolean(firstTab && firstTab.getBoundingClientRect().width <= 120));
    };

    const resizeObserver = new ResizeObserver(updateTabDensity);
    resizeObserver.observe(tabStrip);
    updateTabDensity();
    return () => resizeObserver.disconnect();
  }, [tabs.length, activeId]);

  function handleKeyDown(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect(id);
  }

  function handleClose(event: MouseEvent, id: string) {
    event.stopPropagation();
    onClose(id);
  }

  return (
    <div
      ref={tabStripRef}
      className={`rv-view-tab-strip${compactTabs ? ' compact' : ''}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            data-tab-id={tab.id}
            tabIndex={active ? 0 : -1}
            className={`rv-view-tab${active ? ' active' : ''}`}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
          >
            <span
              className={`material-symbols-outlined rv-view-tab-icon${tab.iconClassName ? ` ${tab.iconClassName}` : ''}`}
            >
              {tab.icon}
            </span>
            <span className="rv-view-tab-label">{tab.label}</span>
            <button
              type="button"
              className="rv-view-tab-close"
              onClick={(event) => handleClose(event, tab.id)}
              disabled={tab.closeDisabled}
              title="Close tab"
              aria-label={`Close ${tab.label}`}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        );
      })}
      {plus && (
        <button
          type="button"
          className="rv-view-tab-plus"
          aria-label={plus.label}
          title={plus.label}
          onClick={plus.onPlus}
        >
          <span className="material-symbols-outlined">{plus.icon ?? 'add'}</span>
        </button>
      )}
    </div>
  );
}
