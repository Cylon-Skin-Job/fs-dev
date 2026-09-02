import type { MenuAnchor, MenuDescriptor } from './types';

export type InteractiveMenuDescriptor = Exclude<MenuDescriptor, { kind: 'separator' }>;

export interface MenuSurfaceRecord {
  id: number;
  element: HTMLDivElement;
  items: readonly MenuDescriptor[];
  ariaLabel: string;
  minWidth?: number;
  anchor: MenuAnchor;
  parentSurfaceId: number | null;
  parentItemId: string | null;
  parentItemIndex: number | null;
  parentFocusElement: HTMLElement | null;
  source: 'root' | 'submenu' | 'external';
}
