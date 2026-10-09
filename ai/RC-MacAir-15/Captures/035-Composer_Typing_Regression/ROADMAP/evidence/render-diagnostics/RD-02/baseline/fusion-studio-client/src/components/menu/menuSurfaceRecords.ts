import { createMenuSurface } from './MenuSurface';
import { isInteractiveMenuDescriptor } from './menuDescriptors';
import type { MenuSurfaceRecord } from './menuTreeRecords';
import type { MenuDescriptor } from './types';

interface MenuSurfaceRecordContext {
  treeId: number;
  pendingItemIds: (surfaceId: number, items: readonly MenuDescriptor[]) => ReadonlySet<string>;
  onActivate: (
    surface: MenuSurfaceRecord,
    descriptor: MenuDescriptor,
    element: HTMLButtonElement,
  ) => void;
  onHover: (
    surface: MenuSurfaceRecord,
    descriptor: MenuDescriptor,
    element: HTMLButtonElement,
  ) => void;
}

function renderSurface(record: MenuSurfaceRecord, context: MenuSurfaceRecordContext) {
  return createMenuSurface({
    items: record.items,
    ariaLabel: record.ariaLabel,
    minWidth: record.minWidth,
    zIndex: record.zIndex,
    pendingItemIds: context.pendingItemIds(record.id, record.items),
    callbacks: {
      onActivate: (descriptor, element) => context.onActivate(record, descriptor, element),
      onHover: (descriptor, element) => context.onHover(record, descriptor, element),
    },
  });
}

export function findMenuSurfaceItem(surface: MenuSurfaceRecord, itemId: string) {
  return surface.element.querySelector<HTMLButtonElement>(
    `:scope > .rv-menu-item[data-menu-item-id="${CSS.escape(itemId)}"]`,
  );
}

export function focusMenuSurfaceItem(surface: MenuSurfaceRecord, itemId: string) {
  const item = findMenuSurfaceItem(surface, itemId);
  if (!item || item.disabled) return false;
  item.focus({ preventScroll: true });
  return true;
}

export interface MenuSurfaceItemReference {
  itemId: string;
  index: number;
}

export function menuSurfaceItemReference(
  surface: MenuSurfaceRecord,
  itemId: string,
): MenuSurfaceItemReference {
  return {
    itemId,
    index: surface.items.filter(isInteractiveMenuDescriptor)
      .findIndex(({ id }) => id === itemId),
  };
}

export function focusClosestMenuSurfaceItem(
  surface: MenuSurfaceRecord,
  reference: MenuSurfaceItemReference,
) {
  if (focusMenuSurfaceItem(surface, reference.itemId)) return true;
  const candidates = Array.from(
    surface.element.querySelectorAll<HTMLButtonElement>(':scope > .rv-menu-item'),
  ).map((element, index) => ({ element, index }))
    .filter(({ element }) => !element.disabled)
    .sort((left, right) => (
      Math.abs(left.index - reference.index) - Math.abs(right.index - reference.index)
    ));
  const candidate = candidates[0]?.element;
  if (!candidate) return false;
  candidate.focus({ preventScroll: true });
  return true;
}

export function createMenuSurfaceRecord(
  input: Omit<MenuSurfaceRecord, 'element'>,
  level: number,
  context: MenuSurfaceRecordContext,
): MenuSurfaceRecord {
  const record = { ...input } as MenuSurfaceRecord;
  record.element = renderSurface(record, context);
  record.element.dataset.menuTreeId = String(context.treeId);
  record.element.dataset.menuLevel = String(level);
  record.element.style.setProperty('--rv-menu-level', String(level));
  return record;
}

export function rerenderMenuSurfaceRecord(
  surface: MenuSurfaceRecord,
  items: readonly MenuDescriptor[],
  context: MenuSurfaceRecordContext,
) {
  const activeElement = document.activeElement;
  const activeId = surface.element.contains(activeElement) && activeElement instanceof HTMLElement
    ? activeElement.dataset.menuItemId ?? null
    : null;
  const activeReference = activeId ? menuSurfaceItemReference(surface, activeId) : null;
  surface.items = items;
  const replacement = renderSurface(surface, context);
  replacement.dataset.menuTreeId = String(context.treeId);
  replacement.dataset.menuLevel = surface.element.dataset.menuLevel;
  replacement.style.setProperty(
    '--rv-menu-level',
    surface.element.style.getPropertyValue('--rv-menu-level'),
  );
  replacement.style.left = surface.element.style.left;
  replacement.style.top = surface.element.style.top;
  surface.element.replaceWith(replacement);
  surface.element = replacement;
  if (activeReference) focusClosestMenuSurfaceItem(surface, activeReference);
}
