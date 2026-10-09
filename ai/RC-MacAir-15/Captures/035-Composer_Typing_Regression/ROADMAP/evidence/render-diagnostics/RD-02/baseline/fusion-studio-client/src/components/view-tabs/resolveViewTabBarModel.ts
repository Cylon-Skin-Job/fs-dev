import type { ViewTabAdapter, ViewTabItem, ViewTabPlusConfig } from './viewTabTypes';

export interface ViewTabBarModel {
  tabs: ViewTabItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  plus?: ViewTabPlusConfig;
}

/** Resolve shell visibility and adapter data without coupling the strip to tab kinds. */
export function resolveViewTabBarModel(
  adapter: ViewTabAdapter,
  snapshot: unknown,
): ViewTabBarModel | null {
  const sourceTabs = adapter.getTabs(snapshot);
  const plus = adapter.plus
    && (adapter.plus.availability === 'always' || adapter.plus.isAvailable?.(snapshot) === true)
    ? adapter.plus
    : undefined;
  const visible = adapter.visibility.mode === 'always'
    ? sourceTabs.length > 0 || Boolean(plus)
    : adapter.visibility.isVisible(snapshot);
  if (!visible) return null;

  return {
    tabs: sourceTabs.map((tab) => ({
      id: adapter.getId(tab),
      label: adapter.getLabel(tab),
      icon: adapter.getIcon(tab),
      iconClassName: adapter.getIconClassName?.(tab),
      closeDisabled: adapter.isCloseDisabled?.(tab),
    })),
    activeId: adapter.getActiveId(snapshot),
    onSelect: adapter.onSelect,
    onClose: adapter.onClose,
    plus,
  };
}
