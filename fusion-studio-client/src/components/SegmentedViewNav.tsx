import './SegmentedViewNav.css';

export interface SegmentedViewNavItem {
  value: string;
  label: string;
  controls?: string;
}

interface SegmentedViewNavProps {
  ariaLabel: string;
  items: readonly SegmentedViewNavItem[];
  activeValue: string;
  onChange: (value: string) => void;
}

export function SegmentedViewNav({ ariaLabel, items, activeValue, onChange }: SegmentedViewNavProps) {
  return (
    <nav className="rv-segmented-view-nav" aria-label={ariaLabel}>
      <div className="rv-segmented-view-nav-list" role="tablist">
        {items.map((item) => {
          const active = item.value === activeValue;
          return (
            <button
              key={item.value}
              type="button"
              className={`rv-segmented-view-nav-item${active ? ' is-active' : ''}`}
              role="tab"
              aria-selected={active}
              aria-controls={item.controls}
              onClick={() => onChange(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
