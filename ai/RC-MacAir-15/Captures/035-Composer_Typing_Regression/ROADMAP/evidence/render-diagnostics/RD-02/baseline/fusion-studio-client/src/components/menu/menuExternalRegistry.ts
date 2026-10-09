import type {
  MenuExternalChildMenuOptions,
  MenuExternalRegistration,
} from './types';

interface ExternalSurfaceRecord {
  id: number;
  ownerSurfaceId: number;
  ownerItemId: string;
  ownerElement: HTMLButtonElement;
  element: HTMLElement;
  teardown: () => void;
  reposition?: (anchorElement: HTMLButtonElement) => void;
  onOwnerReenter?: () => void;
  retainNextActionClose: boolean;
}

interface RegisterExternalSurfaceOptions {
  ownerSurfaceId: number;
  ownerItemId: string;
  ownerElement: HTMLButtonElement;
  element: HTMLElement;
  teardown: () => void;
  reposition?: (anchorElement: HTMLButtonElement) => void;
  onOwnerReenter?: () => void;
  isCurrent: () => boolean;
  openChildMenu: (options: MenuExternalChildMenuOptions) => boolean;
  closeTree: (reason: 'action' | 'programmatic') => void;
}

export function createMenuExternalRegistry() {
  let sequence = 0;
  const records = new Map<number, ExternalSurfaceRecord>();

  const remove = (record: ExternalSurfaceRecord, invokeTeardown: boolean) => {
    if (!records.delete(record.id)) return;
    if (invokeTeardown) record.teardown();
  };

  const removeWhere = (predicate: (record: ExternalSurfaceRecord) => boolean) => {
    [...records.values()].filter(predicate).forEach((record) => remove(record, true));
  };

  const register = (options: RegisterExternalSurfaceOptions): MenuExternalRegistration | null => {
    if (!options.isCurrent()) {
      options.teardown();
      return null;
    }
    removeWhere((record) => (
      record.ownerSurfaceId === options.ownerSurfaceId
      && record.ownerItemId === options.ownerItemId
    ));
    const record: ExternalSurfaceRecord = {
      id: ++sequence,
      ownerSurfaceId: options.ownerSurfaceId,
      ownerItemId: options.ownerItemId,
      ownerElement: options.ownerElement,
      element: options.element,
      teardown: options.teardown,
      reposition: options.reposition,
      onOwnerReenter: options.onOwnerReenter,
      retainNextActionClose: false,
    };
    records.set(record.id, record);
    return {
      unregister: () => remove(record, false),
      isActive: () => records.has(record.id) && options.isCurrent(),
      openChildMenu: (childOptions) => (
        records.has(record.id) && options.isCurrent() && options.openChildMenu(childOptions)
      ),
      closeTree: (reason = 'programmatic') => {
        if (!records.has(record.id) || !options.isCurrent()) return;
        if (reason === 'action' && record.retainNextActionClose) {
          record.retainNextActionClose = false;
          return;
        }
        options.closeTree(reason);
      },
    };
  };

  return {
    contains: (node: Node) => [...records.values()].some(({ element }) => element.contains(node)),
    focusedOwner: (ownerSurfaceId: number) => {
      const activeElement = document.activeElement;
      if (!activeElement) return null;
      const record = [...records.values()].find((candidate) => (
        candidate.ownerSurfaceId === ownerSurfaceId
        && candidate.element.contains(activeElement)
      ));
      return record ? { ownerItemId: record.ownerItemId } : null;
    },
    hasOwner: (ownerSurfaceId: number, ownerItemId: string) => (
      [...records.values()].some((record) => (
        record.ownerSurfaceId === ownerSurfaceId && record.ownerItemId === ownerItemId
      ))
    ),
    register,
    retainTreeOnNextAction: (ownerSurfaceId: number, ownerItemId: string) => {
      records.forEach((record) => {
        if (record.ownerSurfaceId === ownerSurfaceId && record.ownerItemId === ownerItemId) {
          record.retainNextActionClose = true;
        }
      });
    },
    removeWhere,
    notifyOwnerReentry: (ownerSurfaceId: number, ownerItemId: string) => {
      records.forEach((record) => {
        if (record.ownerSurfaceId === ownerSurfaceId && record.ownerItemId === ownerItemId) {
          record.onOwnerReenter?.();
        }
      });
    },
    reconcileOwnerSurface: (
      ownerSurfaceId: number,
      resolveOwner: (ownerItemId: string) => HTMLButtonElement | null,
    ) => {
      records.forEach((record) => {
        if (record.ownerSurfaceId !== ownerSurfaceId) return;
        const ownerElement = resolveOwner(record.ownerItemId);
        if (!ownerElement) remove(record, true);
        else record.ownerElement = ownerElement;
      });
    },
    repositionAll: () => records.forEach((record) => record.reposition?.(record.ownerElement)),
  };
}
