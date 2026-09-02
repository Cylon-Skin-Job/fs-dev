import type { MenuDescriptor } from './types';

export interface MenuSurfaceCallbacks {
  onActivate: (item: MenuDescriptor, element: HTMLButtonElement) => void;
  onHover: (item: MenuDescriptor, element: HTMLButtonElement) => void;
}

export interface RenderMenuSurfaceOptions {
  ariaLabel: string;
  items: readonly MenuDescriptor[];
  callbacks: MenuSurfaceCallbacks;
  pendingItemIds: ReadonlySet<string>;
  minWidth?: number;
}

export function enabledMenuItems(surface: HTMLElement): HTMLButtonElement[] {
  return Array.from(surface.querySelectorAll<HTMLButtonElement>(':scope > .rv-menu-item'))
    .filter((item) => !item.disabled);
}

export function focusInitialMenuItem(
  surface: HTMLElement,
  descriptors: readonly MenuDescriptor[],
) {
  const interactive = descriptors.filter(({ kind }) => kind !== 'separator');
  const checked = interactive.length > 0 && interactive.every(({ kind }) => kind === 'radio')
    ? surface.querySelector<HTMLButtonElement>(
      ':scope > .rv-menu-item[role="menuitemradio"][aria-checked="true"]:not(:disabled)',
    )
    : null;
  (checked ?? enabledMenuItems(surface)[0])?.focus({ preventScroll: true });
}

function renderInteractiveItem(
  descriptor: Exclude<MenuDescriptor, { kind: 'separator' }>,
  callbacks: MenuSurfaceCallbacks,
  pending: boolean,
) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'rv-menu-item';
  item.dataset.menuItemId = descriptor.id;
  item.tabIndex = -1;
  item.disabled = Boolean(descriptor.disabled);
  if (descriptor.tone === 'destructive') item.dataset.tone = 'destructive';
  if (pending) {
    item.dataset.pending = 'true';
    item.setAttribute('aria-busy', 'true');
    item.setAttribute('aria-disabled', 'true');
  }
  if (descriptor.kind === 'radio') {
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', String(descriptor.checked));
  } else {
    item.setAttribute('role', 'menuitem');
  }
  if (descriptor.disabled) {
    item.setAttribute('aria-disabled', 'true');
    if (descriptor.disabledReason) item.title = descriptor.disabledReason;
  }
  const accessibleLabel = descriptor.ariaLabel
    ?? (descriptor.disabledReason ? `${descriptor.label}: ${descriptor.disabledReason}` : undefined);
  if (accessibleLabel) item.setAttribute('aria-label', accessibleLabel);

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined rv-menu-item-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = descriptor.kind === 'radio' && !descriptor.icon
    ? (descriptor.checked ? 'check' : '')
    : (descriptor.icon ?? '');
  const label = document.createElement('span');
  label.className = 'rv-menu-item-label';
  label.textContent = descriptor.label;
  item.append(icon, label);

  if (descriptor.secondaryText) {
    const secondary = document.createElement('span');
    secondary.className = 'rv-menu-item-secondary';
    secondary.setAttribute('aria-hidden', 'true');
    secondary.textContent = descriptor.secondaryText;
    item.appendChild(secondary);
  }
  if (descriptor.kind === 'radio' && descriptor.icon) {
    const check = document.createElement('span');
    check.className = 'material-symbols-outlined rv-menu-item-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = descriptor.checked ? 'check' : '';
    item.appendChild(check);
  }
  if (descriptor.kind === 'submenu') {
    item.setAttribute('aria-haspopup', 'menu');
    item.setAttribute('aria-expanded', 'false');
    const chevron = document.createElement('span');
    chevron.className = 'material-symbols-outlined rv-menu-item-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = 'chevron_right';
    item.appendChild(chevron);
  }

  item.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  item.addEventListener('pointermove', () => callbacks.onHover(descriptor, item));
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!item.disabled) callbacks.onActivate(descriptor, item);
  });
  return item;
}

export function createMenuSurface(options: RenderMenuSurfaceOptions): HTMLDivElement {
  const surface = document.createElement('div');
  surface.className = 'rv-menu-surface';
  surface.setAttribute('role', 'menu');
  surface.setAttribute('aria-label', options.ariaLabel);
  if (options.minWidth) surface.style.setProperty('--rv-menu-min-width', `${options.minWidth}px`);
  surface.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  for (const descriptor of options.items) {
    if (descriptor.kind === 'separator') {
      const separator = document.createElement('div');
      separator.className = 'rv-menu-separator';
      separator.dataset.menuItemId = descriptor.id;
      separator.setAttribute('role', 'separator');
      surface.appendChild(separator);
      continue;
    }
    surface.appendChild(renderInteractiveItem(
      descriptor,
      options.callbacks,
      options.pendingItemIds.has(descriptor.id),
    ));
  }
  return surface;
}
