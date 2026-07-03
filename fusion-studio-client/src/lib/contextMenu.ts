/**
 * @module contextMenu
 * @role Self-contained right-click context menu
 *
 * Creates its own DOM, injects its own styles once, and cleans up after itself.
 */

export interface ContextMenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

interface ShowContextMenuOptions {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .rv-context-menu {
      position: fixed;
      z-index: var(--z-modal, 1003);
      min-width: 160px;
      padding: var(--space-xs, 4px) 0;
      background: var(--panel-chrome-bg, #1a1a1a);
      border: 1px solid var(--neutral-chrome-border, rgba(255, 255, 255, 0.12));
      border-radius: var(--radius-md, 4px);
      font-size: var(--font-md, 13px);
      color: var(--text-primary, #e0e0e0);
      user-select: none;
    }
    .rv-context-menu-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: var(--space-sm, 8px) var(--space-md, 12px);
      background: none;
      border: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background var(--transition-fast, 0.12s ease);
    }
    .rv-context-menu-item:hover,
    .rv-context-menu-item:focus {
      background: var(--glass-md, rgba(255, 255, 255, 0.08));
      outline: none;
    }
    .rv-context-menu-item-danger {
      color: var(--status-error, #ef4444);
    }
    .rv-context-menu-item-danger:hover,
    .rv-context-menu-item-danger:focus {
      background: var(--glass-md, rgba(255, 255, 255, 0.08));
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function showContextMenu({ x, y, items }: ShowContextMenuOptions): () => void {
  injectStyles();

  const menu = document.createElement('div');
  menu.className = 'rv-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rv-context-menu-item${item.danger ? ' rv-context-menu-item-danger' : ''}`;
    button.textContent = item.label;
    button.addEventListener('click', () => {
      close();
      item.action();
    });
    menu.appendChild(button);
  }

  document.body.appendChild(menu);

  // Nudge back onto screen if it overflows
  const rect = menu.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  }
  if (y + rect.height > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  }

  function close() {
    if (menu.parentNode) menu.parentNode.removeChild(menu);
    document.removeEventListener('click', handleClickOutside, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  }

  function handleClickOutside(e: MouseEvent) {
    if (!menu.contains(e.target as Node)) {
      close();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }

  // Defer outside-click binding so the opening click doesn't close the menu immediately
  requestAnimationFrame(() => {
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
  });

  return close;
}
