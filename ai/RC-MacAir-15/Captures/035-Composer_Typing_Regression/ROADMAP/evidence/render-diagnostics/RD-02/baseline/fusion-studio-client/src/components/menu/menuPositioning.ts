import type { MenuAnchor } from './types';

export interface MenuSize {
  width: number;
  height: number;
}

export interface MenuViewport {
  width: number;
  height: number;
}

export interface MenuPoint {
  left: number;
  top: number;
}

const VIEWPORT_MARGIN = 8;
const CHILD_GAP = 4;
const ROOT_GAP = 4;

export function clampMenuPoint(
  preferred: MenuPoint,
  size: MenuSize,
  viewport: MenuViewport,
): MenuPoint {
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - size.width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - size.height - VIEWPORT_MARGIN);
  return {
    left: Math.min(Math.max(VIEWPORT_MARGIN, preferred.left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_MARGIN, preferred.top), maxTop),
  };
}

function anchorRect(anchor: Exclude<MenuAnchor, { kind: 'pointer' }>) {
  return anchor.kind === 'element' ? anchor.element.getBoundingClientRect() : anchor.rect;
}

export function positionRootMenu(
  anchor: MenuAnchor,
  size: MenuSize,
  viewport: MenuViewport,
): MenuPoint {
  if (anchor.kind === 'pointer') {
    return clampMenuPoint({ left: anchor.clientX, top: anchor.clientY }, size, viewport);
  }
  const rect = anchorRect(anchor);
  const preferred = (anchor.placement ?? 'below-start') === 'right-start'
    ? { left: rect.right + ROOT_GAP, top: rect.top }
    : { left: rect.left, top: rect.bottom + ROOT_GAP };
  return clampMenuPoint(preferred, size, viewport);
}

export function positionChildMenu(
  parentRect: Pick<DOMRect, 'left' | 'right' | 'top'>,
  size: MenuSize,
  viewport: MenuViewport,
): MenuPoint {
  const right = parentRect.right + CHILD_GAP;
  const left = right + size.width <= viewport.width - VIEWPORT_MARGIN
    ? right
    : parentRect.left - size.width - CHILD_GAP;
  return clampMenuPoint({ left, top: parentRect.top }, size, viewport);
}
