import { enabledMenuItems, focusInitialMenuItem } from './MenuSurface';
import { createMenuActionRuntime } from './menuActionRuntime';
import { createMenuExternalRegistry } from './menuExternalRegistry';
import { handleMenuTreeKeyDown } from './menuKeyboard';
import { positionChildMenu, positionRootMenu } from './menuPositioning';
import {
  createMenuSurfaceRecord,
  findMenuSurfaceItem,
  focusClosestMenuSurfaceItem,
  focusMenuSurfaceItem,
  menuSurfaceItemReference,
  rerenderMenuSurfaceRecord,
} from './menuSurfaceRecords';
import type { InteractiveMenuDescriptor, MenuSurfaceRecord } from './menuTreeRecords';
import type {
  MenuCloseReason,
  MenuDescriptor,
  MenuExternalChildContext,
  MenuExternalChildMenuOptions,
  MenuHandle,
  MenuOpenOptions,
  MenuOutcome,
} from './types';

if (typeof document !== 'undefined') void import('./MenuSurface.css');
let menuTreeSequence = 0;
function findDescriptor(items: readonly MenuDescriptor[], id: string) {
  return items.find((item) => item.id === id);
}
export function openMenuTree(options: MenuOpenOptions): MenuHandle {
  const treeId = ++menuTreeSequence;
  let generation = 1;
  let surfaceSequence = 0;
  let open = true;
  let rootItems = options.items;
  const surfaces: MenuSurfaceRecord[] = [];
  const externals = createMenuExternalRegistry();
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
  const isNodeInsideTree = (node: Node | null) => Boolean(node && (
    surfaces.some((surface) => surface.element.contains(node))
    || externals.contains(node)
  ));

  const focusClosestParent = (closed: MenuSurfaceRecord) => {
    const parent = surfaces.find((surface) => surface.id === closed.parentSurfaceId);
    if (parent?.element.contains(document.activeElement)) return;
    if (closed.parentFocusElement?.isConnected) {
      closed.parentFocusElement.focus({ preventScroll: true });
      return;
    }
    if (!parent) return;
    if (closed.parentItemId && closed.parentItemIndex !== null && focusClosestMenuSurfaceItem(parent, {
      itemId: closed.parentItemId,
      index: closed.parentItemIndex,
    })) return;
    enabledMenuItems(parent.element)[0]?.focus({ preventScroll: true });
  };

  const removeSurfacesAfter = (surfaceIndex: number) => {
    const removed = surfaces.splice(surfaceIndex + 1);
    const removedIds = new Set(removed.map(({ id }) => id));
    externals.removeWhere((record) => removedIds.has(record.ownerSurfaceId));
    removed.reverse().forEach((surface) => surface.element.remove());
    const surviving = surfaces[surfaceIndex];
    if (surviving) {
      surviving.element.querySelectorAll('[aria-expanded="true"]')
        .forEach((element) => element.setAttribute('aria-expanded', 'false'));
    }
    return removed;
  };

  const prepareOwner = (surface: MenuSurfaceRecord, itemId: string, keepExternal = false) => {
    const index = surfaces.indexOf(surface);
    if (index < 0) return;
    removeSurfacesAfter(index);
    if (!keepExternal) {
      externals.removeWhere((record) => (
        record.ownerSurfaceId === surface.id && record.ownerItemId !== itemId
      ));
    }
  };

  const positionSurface = (surface: MenuSurfaceRecord) => {
    const rect = surface.element.getBoundingClientRect();
    const size = { width: rect.width, height: rect.height };
    const point = surface.source === 'root'
      ? positionRootMenu(surface.anchor, size, viewport())
      : positionChildMenu(
        surface.parentFocusElement?.getBoundingClientRect()
          ?? (surface.anchor.kind === 'element'
            ? surface.anchor.element.getBoundingClientRect()
            : { left: 8, right: 8, top: 8 }),
        size,
        viewport(),
      );
    surface.element.style.left = `${point.left}px`;
    surface.element.style.top = `${point.top}px`;
  };

  const positionAll = () => {
    surfaces.forEach(positionSurface);
    externals.repositionAll();
  };

  const closeTree = (reason: MenuCloseReason) => {
    if (!open) return;
    const focusWasInside = isNodeInsideTree(document.activeElement);
    open = false;
    generation += 1;
    window.removeEventListener('pointerdown', onWindowPointerDown, true);
    window.removeEventListener('keydown', onWindowKeyDown, true);
    window.removeEventListener('resize', onWindowResize);
    externals.removeWhere(() => true);
    surfaces.splice(0).reverse().forEach((surface) => surface.element.remove());
    actions.clear();
    if (reason === 'cancel') options.restoreInvocationFocus();
    else if (reason === 'action' && focusWasInside) options.focusAfterAction();
    options.onClose?.(reason);
  };

  const applyOutcome = (outcome: MenuOutcome, surface: MenuSurfaceRecord) => {
    if (!open || !surfaces.includes(surface)) return;
    if (outcome.kind === 'stay') return;
    if (outcome.kind === 'close-all') {
      closeTree('action');
      return;
    }
    const surfaceIndex = surfaces.indexOf(surface);
    if (outcome.kind === 'back' && surfaceIndex === 0) return;
    const count = outcome.kind === 'close-levels' ? outcome.count : 1;
    if (!Number.isInteger(count) || count <= 0) {
      throw new TypeError('Menu close-levels outcomes require a positive integer count.');
    }
    if (surfaceIndex - count < 0) {
      closeTree('action');
      return;
    }
    const targetIndex = surfaceIndex - count;
    const firstClosed = surfaces[targetIndex + 1];
    removeSurfacesAfter(targetIndex);
    if (firstClosed) focusClosestParent(firstClosed);
  };

  const actions = createMenuActionRuntime({
    getGeneration: () => generation,
    isCurrent: (surface, actionGeneration) => (
      open && generation === actionGeneration && surfaces.includes(surface)
    ),
    getCurrentElement: findMenuSurfaceItem,
    getHandle: () => handle,
    applyOutcome,
    onActionError: options.onActionError,
  });

  const registerExternal = (
    surface: MenuSurfaceRecord,
    ownerItemId: string,
    ownerElement: HTMLButtonElement,
    element: HTMLElement,
    registrationOptions: Parameters<MenuExternalChildContext['registerSurface']>[1],
  ) => externals.register({
    ownerSurfaceId: surface.id,
    ownerItemId,
    ownerElement,
    element,
    teardown: registrationOptions.teardown,
    reposition: registrationOptions.reposition,
    onOwnerReenter: registrationOptions.onOwnerReenter,
    isCurrent: () => open && surfaces.includes(surface),
    openChildMenu: (childOptions) => openExternalChild(surface, ownerItemId, childOptions),
    closeTree: (reason) => closeTree(reason),
  });
  const externalContext = (
    surface: MenuSurfaceRecord,
    descriptor: Extract<InteractiveMenuDescriptor, { kind: 'external-child' }>,
    element: HTMLButtonElement,
  ): MenuExternalChildContext => ({
    ownerItemId: descriptor.id,
    anchorElement: element,
    menu: handle,
    retainTreeOnNextAction: () => externals.retainTreeOnNextAction(surface.id, descriptor.id),
    registerSurface: (externalElement, registrationOptions) => (
      registerExternal(surface, descriptor.id, element, externalElement, registrationOptions)
    ),
  });

  const focusedExternalOwner = (surface: MenuSurfaceRecord) => {
    const focusedOwner = externals.focusedOwner(surface.id);
    if (!focusedOwner) return null;
    return {
      ...focusedOwner,
      index: menuSurfaceItemReference(surface, focusedOwner.ownerItemId).index,
    };
  };

  const reconcileExternalOwners = (
    surface: MenuSurfaceRecord,
    focusedOwner: ReturnType<typeof focusedExternalOwner>,
  ) => {
    externals.reconcileOwnerSurface(surface.id, (ownerItemId) => {
      const descriptor = findDescriptor(surface.items, ownerItemId);
      if (descriptor?.kind !== 'external-child' || descriptor.disabled) return null;
      return findMenuSurfaceItem(surface, ownerItemId);
    });
    if (!focusedOwner || externals.hasOwner(surface.id, focusedOwner.ownerItemId)) return;
    focusClosestMenuSurfaceItem(surface, {
      itemId: focusedOwner.ownerItemId,
      index: focusedOwner.index,
    });
  };

  const openSubmenu = (
    surface: MenuSurfaceRecord,
    descriptor: Extract<InteractiveMenuDescriptor, { kind: 'submenu' }>,
    element: HTMLButtonElement,
    focusFirst: boolean,
  ) => {
    const surfaceIndex = surfaces.indexOf(surface);
    const candidate = surfaces[surfaceIndex + 1];
    const existing = candidate?.parentSurfaceId === surface.id
      && candidate.parentItemId === descriptor.id ? candidate : undefined;
    if (!existing) prepareOwner(surface, descriptor.id);
    if (existing) {
      if (focusFirst) focusInitialMenuItem(existing.element, descriptor.items);
      return;
    }
    element.setAttribute('aria-expanded', 'true');
    const child = createSurfaceRecord({
      items: descriptor.items,
      ariaLabel: descriptor.label,
      anchor: { kind: 'element', element, placement: 'right-start' },
      parentSurfaceId: surface.id,
      parentItemId: descriptor.id,
      parentItemIndex: menuSurfaceItemReference(surface, descriptor.id).index,
      parentFocusElement: element,
      source: 'submenu',
    });
    surfaces.push(child);
    document.body.appendChild(child.element);
    positionSurface(child);
    if (focusFirst) focusInitialMenuItem(child.element, descriptor.items);
  };

  function openExternalChild(
    surface: MenuSurfaceRecord,
    ownerItemId: string,
    childOptions: MenuExternalChildMenuOptions,
  ) {
    if (!open || !surfaces.includes(surface)) return false;
    prepareOwner(surface, ownerItemId, true);
    const child = createSurfaceRecord({
      items: childOptions.items,
      ariaLabel: childOptions.ariaLabel,
      minWidth: childOptions.minWidth,
      anchor: { kind: 'element', element: childOptions.anchorElement, placement: 'right-start' },
      parentSurfaceId: surface.id,
      parentItemId: ownerItemId,
      parentItemIndex: menuSurfaceItemReference(surface, ownerItemId).index,
      parentFocusElement: childOptions.anchorElement,
      source: 'external',
    });
    surfaces.push(child);
    document.body.appendChild(child.element);
    positionSurface(child);
    const focusId = childOptions.initialFocusId;
    if (!focusId || !focusMenuSurfaceItem(child, focusId)) {
      enabledMenuItems(child.element)[0]?.focus({ preventScroll: true });
    }
    return true;
  }

  const onActivate = (
    surface: MenuSurfaceRecord,
    descriptor: MenuDescriptor,
    element: HTMLButtonElement,
  ) => {
    if (descriptor.kind === 'separator' || descriptor.disabled) return;
    if (descriptor.kind === 'submenu') {
      openSubmenu(surface, descriptor, element, true);
      return;
    }
    if (descriptor.kind === 'external-child' && !descriptor.onSelect) {
      prepareOwner(surface, descriptor.id, true);
      descriptor.onOpen(externalContext(surface, descriptor, element));
      return;
    }
    void actions.invoke(surface, descriptor, element);
  };

  const onHover = (
    surface: MenuSurfaceRecord,
    descriptor: MenuDescriptor,
    element: HTMLButtonElement,
  ) => {
    if (descriptor.kind === 'separator' || descriptor.disabled) return;
    if (descriptor.kind === 'submenu') {
      openSubmenu(surface, descriptor, element, false);
      return;
    }
    if (descriptor.kind === 'external-child' && descriptor.openOn === 'hover') {
      prepareOwner(surface, descriptor.id, true);
      const alreadyRegistered = externals.hasOwner(surface.id, descriptor.id);
      if (alreadyRegistered) externals.notifyOwnerReentry(surface.id, descriptor.id);
      else descriptor.onOpen(externalContext(surface, descriptor, element));
      return;
    }
    prepareOwner(surface, descriptor.id);
  };

  const surfaceContext = {
    treeId,
    pendingItemIds: actions.pendingItemIds,
    onActivate,
    onHover,
  };

  const createSurfaceRecord = (input: Omit<MenuSurfaceRecord, 'id' | 'element'>) => (
    createMenuSurfaceRecord(
      { ...input, id: ++surfaceSequence },
      input.source === 'root' ? 0 : surfaces.length,
      surfaceContext,
    )
  );

  const update = (items: readonly MenuDescriptor[]) => {
    if (!open) return;
    rootItems = items;
    const rootFocusedExternalOwner = focusedExternalOwner(surfaces[0]);
    rerenderMenuSurfaceRecord(surfaces[0], rootItems, surfaceContext);
    reconcileExternalOwners(surfaces[0], rootFocusedExternalOwner);
    for (let index = 1; index < surfaces.length; index += 1) {
      const surface = surfaces[index];
      const parent = surfaces[index - 1];
      const descriptor = surface.parentItemId
        ? findDescriptor(parent.items, surface.parentItemId)
        : undefined;
      if (surface.source === 'external') {
        if (descriptor?.kind === 'external-child'
          && !descriptor.disabled
          && externals.hasOwner(parent.id, descriptor.id)) continue;
        const firstClosed = surfaces[index];
        removeSurfacesAfter(index - 1);
        if (firstClosed) focusClosestParent(firstClosed);
        break;
      }
      if (descriptor?.kind !== 'submenu' || descriptor.disabled) {
        const firstClosed = surfaces[index];
        removeSurfacesAfter(index - 1);
        if (firstClosed) focusClosestParent(firstClosed);
        break;
      }
      surface.parentItemIndex = menuSurfaceItemReference(parent, descriptor.id).index;
      surface.parentFocusElement = findMenuSurfaceItem(parent, descriptor.id);
      surface.anchor = { kind: 'element', element: surface.parentFocusElement!, placement: 'right-start' };
      const surfaceFocusedExternalOwner = focusedExternalOwner(surface);
      rerenderMenuSurfaceRecord(surface, descriptor.items, surfaceContext);
      reconcileExternalOwners(surface, surfaceFocusedExternalOwner);
      surface.parentFocusElement?.setAttribute('aria-expanded', 'true');
    }
    positionAll();
  };

  const focusItem = (itemId: string) => {
    if (!open) return false;
    for (let index = surfaces.length - 1; index >= 0; index -= 1) {
      if (focusMenuSurfaceItem(surfaces[index], itemId)) return true;
    }
    return false;
  };

  const handle: MenuHandle = {
    update,
    focusItem,
    close: (reason = 'programmatic') => closeTree(reason),
    isOpen: () => open,
  };

  function activeSurface() {
    const active = document.activeElement;
    for (let index = surfaces.length - 1; index >= 0; index -= 1) {
      if (surfaces[index].element.contains(active)) return surfaces[index];
    }
    return undefined;
  }

  function onWindowPointerDown(event: PointerEvent) {
    if (!open || isNodeInsideTree(event.target as Node)) return;
    closeTree('outside');
  }

  function onWindowKeyDown(event: KeyboardEvent) {
    handleMenuTreeKeyDown(event, {
      isOpen: () => open,
      closeForCancellation: () => closeTree('cancel'),
      activeSurface,
      surfaceIndex: (surface) => surfaces.indexOf(surface),
      closeChildSurface: (surface) => {
        const index = surfaces.indexOf(surface);
        removeSurfacesAfter(index - 1);
        focusClosestParent(surface);
      },
      openSubmenu: (surface, descriptor, element) => (
        openSubmenu(surface, descriptor, element, true)
      ),
      activate: onActivate,
    });
  }

  function onWindowResize() {
    if (open) positionAll();
  }

  const rootSurface = createSurfaceRecord({
    items: rootItems,
    ariaLabel: options.ariaLabel,
    minWidth: options.minWidth,
    anchor: options.anchor,
    parentSurfaceId: null,
    parentItemId: null,
    parentItemIndex: null,
    parentFocusElement: null,
    source: 'root',
  });
  surfaces.push(rootSurface);
  document.body.appendChild(rootSurface.element);
  positionSurface(rootSurface);
  window.addEventListener('pointerdown', onWindowPointerDown, true);
  window.addEventListener('keydown', onWindowKeyDown, true);
  window.addEventListener('resize', onWindowResize);
  if (!options.initialFocusId || !focusMenuSurfaceItem(rootSurface, options.initialFocusId)) {
    enabledMenuItems(rootSurface.element)[0]?.focus({ preventScroll: true });
  }
  return handle;
}
