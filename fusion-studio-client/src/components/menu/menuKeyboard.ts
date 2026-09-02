import { enabledMenuItems } from './MenuSurface';
import type { MenuSurfaceRecord } from './menuTreeRecords';
import type { MenuDescriptor } from './types';

interface MenuKeyboardOptions {
  isOpen: () => boolean;
  closeForCancellation: () => void;
  activeSurface: () => MenuSurfaceRecord | undefined;
  surfaceIndex: (surface: MenuSurfaceRecord) => number;
  closeChildSurface: (surface: MenuSurfaceRecord) => void;
  openSubmenu: (
    surface: MenuSurfaceRecord,
    descriptor: Extract<MenuDescriptor, { kind: 'submenu' }>,
    element: HTMLButtonElement,
  ) => void;
  activate: (
    surface: MenuSurfaceRecord,
    descriptor: Exclude<MenuDescriptor, { kind: 'separator' }>,
    element: HTMLButtonElement,
  ) => void;
}

function itemId(element: Element | null) {
  return element instanceof HTMLElement ? element.dataset.menuItemId ?? null : null;
}

export function handleMenuTreeKeyDown(event: KeyboardEvent, options: MenuKeyboardOptions) {
  if (!options.isOpen()) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    options.closeForCancellation();
    return;
  }
  if (event.key === 'Tab') {
    options.closeForCancellation();
    return;
  }
  const surface = options.activeSurface();
  if (!surface) return;
  const items = enabledMenuItems(surface.element);
  const active = document.activeElement as HTMLButtonElement;
  const activeIndex = items.indexOf(active);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = activeIndex < 0
      ? (direction === 1 ? 0 : items.length - 1)
      : (activeIndex + direction + items.length) % items.length;
    items[nextIndex]?.focus({ preventScroll: true });
    return;
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    event.stopPropagation();
    (event.key === 'Home' ? items[0] : items.at(-1))?.focus({ preventScroll: true });
    return;
  }
  const activeItemId = itemId(active);
  const descriptor = activeItemId
    ? surface.items.find((item) => item.id === activeItemId)
    : undefined;
  if (event.key === 'ArrowRight' && descriptor?.kind === 'submenu') {
    event.preventDefault();
    event.stopPropagation();
    options.openSubmenu(surface, descriptor, active);
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    event.stopPropagation();
    if (options.surfaceIndex(surface) > 0) options.closeChildSurface(surface);
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && descriptor && descriptor.kind !== 'separator') {
    event.preventDefault();
    event.stopPropagation();
    options.activate(surface, descriptor, active);
  }
}
