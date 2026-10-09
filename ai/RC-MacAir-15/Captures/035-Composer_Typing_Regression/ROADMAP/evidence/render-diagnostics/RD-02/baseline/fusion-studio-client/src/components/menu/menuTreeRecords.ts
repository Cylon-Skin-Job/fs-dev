import type { MenuAnchor, MenuDescriptor } from './types';

export interface MenuSurfaceRecord {
  id: number;
  element: HTMLDivElement;
  items: readonly MenuDescriptor[];
  ariaLabel: string;
  minWidth?: number;
  zIndex?: string;
  anchor: MenuAnchor;
  parentSurfaceId: number | null;
  parentItemId: string | null;
  parentItemIndex: number | null;
  parentFocusElement: HTMLElement | null;
  source: 'root' | 'submenu' | 'external';
}
