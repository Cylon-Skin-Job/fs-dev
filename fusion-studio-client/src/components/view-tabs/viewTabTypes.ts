export interface ViewTabItem {
  id: string;
  label: string;
  icon: string;
  iconClassName?: string;
  closeDisabled?: boolean;
}

export interface ViewTabPlusConfig {
  label: string;
  icon?: string;
  availability: 'always' | 'expanded';
  onPlus: () => void;
}

export interface ViewTabStripProps {
  tabs: readonly ViewTabItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  plus?: ViewTabPlusConfig;
}

export type ViewTabVisibility =
  | { mode: 'always' }
  | { mode: 'state'; isVisible: (snapshot: unknown) => boolean };

/**
 * Store-facing panel adapter. The presentational strip only receives resolved
 * ViewTabItems, so it stays independent of file/capture/future view unions.
 */
export interface ViewTabAdapter {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
  getTabs: (snapshot: unknown) => readonly unknown[];
  getActiveId: (snapshot: unknown) => string | null;
  getId: (tab: unknown) => string;
  getLabel: (tab: unknown) => string;
  getIcon: (tab: unknown) => string;
  getIconClassName?: (tab: unknown) => string | undefined;
  isCloseDisabled?: (tab: unknown) => boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  visibility: ViewTabVisibility;
  plus?: ViewTabPlusConfig & {
    isAvailable?: (snapshot: unknown) => boolean;
  };
}
