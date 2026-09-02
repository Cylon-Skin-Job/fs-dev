import type { InteractiveMenuDescriptor, MenuSurfaceRecord } from './menuTreeRecords';
import type { MenuActionContext, MenuDescriptor, MenuHandle, MenuOutcome } from './types';

type ActionDescriptor = Extract<
  InteractiveMenuDescriptor,
  { kind: 'action' | 'radio' | 'external-child' }
>;

interface MenuActionRuntimeOptions {
  getGeneration: () => number;
  isCurrent: (surface: MenuSurfaceRecord, generation: number) => boolean;
  getCurrentElement: (surface: MenuSurfaceRecord, itemId: string) => HTMLButtonElement | null;
  getHandle: () => MenuHandle;
  applyOutcome: (outcome: MenuOutcome, surface: MenuSurfaceRecord) => void;
  onActionError?: (error: unknown, itemId: string) => void;
}

export function createMenuActionRuntime(options: MenuActionRuntimeOptions) {
  const pending = new Set<string>();
  const pendingKey = (surfaceId: number, itemId: string) => `${surfaceId}:${itemId}`;

  const invoke = async (
    surface: MenuSurfaceRecord,
    descriptor: ActionDescriptor,
    element: HTMLButtonElement,
  ) => {
    const action = descriptor.onSelect;
    if (!action) return;
    const key = pendingKey(surface.id, descriptor.id);
    if (pending.has(key)) return;
    pending.add(key);
    element.dataset.pending = 'true';
    element.setAttribute('aria-busy', 'true');
    element.setAttribute('aria-disabled', 'true');
    const generation = options.getGeneration();
    const context: MenuActionContext = {
      itemId: descriptor.id,
      element,
      menu: options.getHandle(),
    };
    try {
      const outcome = await action(context);
      if (options.isCurrent(surface, generation)) options.applyOutcome(outcome, surface);
    } catch (error) {
      if (options.isCurrent(surface, generation)) options.onActionError?.(error, descriptor.id);
    } finally {
      pending.delete(key);
      if (options.isCurrent(surface, generation)) {
        const currentElement = options.getCurrentElement(surface, descriptor.id);
        if (currentElement) {
          delete currentElement.dataset.pending;
          currentElement.removeAttribute('aria-busy');
          if (!currentElement.disabled) currentElement.removeAttribute('aria-disabled');
          if (document.activeElement === document.body) currentElement.focus({ preventScroll: true });
        }
      }
    }
  };

  return {
    clear: () => pending.clear(),
    invoke,
    pendingItemIds: (surfaceId: number, items: readonly MenuDescriptor[]) => new Set(
      items.filter((item) => pending.has(pendingKey(surfaceId, item.id))).map(({ id }) => id),
    ),
  };
}
