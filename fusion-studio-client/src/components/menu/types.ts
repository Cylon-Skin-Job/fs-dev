export type MenuOutcome =
  | { kind: 'stay' }
  | { kind: 'back' }
  | { kind: 'close-current' }
  | { kind: 'close-levels'; count: number }
  | { kind: 'close-all' };

export type MenuAnchor =
  | { kind: 'pointer'; clientX: number; clientY: number }
  | { kind: 'element'; element: Element; placement?: 'below-start' | 'right-start' }
  | { kind: 'rect'; rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>; placement?: 'below-start' | 'right-start' };

export type MenuCloseReason = 'action' | 'cancel' | 'outside' | 'programmatic' | 'replaced';

export interface MenuActionContext {
  itemId: string;
  element: HTMLButtonElement;
  menu: MenuHandle;
}

export interface MenuExternalRegistration {
  unregister: () => void;
  isActive: () => boolean;
  openChildMenu: (options: MenuExternalChildMenuOptions) => boolean;
  closeTree: (reason?: 'action' | 'programmatic') => void;
}

export interface MenuExternalChildContext {
  ownerItemId: string;
  anchorElement: HTMLButtonElement;
  menu: MenuHandle;
  retainTreeOnNextAction: () => void;
  registerSurface: (
    element: HTMLElement,
    options: {
      teardown: () => void;
      reposition?: (anchorElement: HTMLButtonElement) => void;
      onOwnerReenter?: () => void;
    },
  ) => MenuExternalRegistration | null;
}

interface MenuInteractiveDescriptorBase {
  id: string;
  label: string;
  icon?: string;
  secondaryText?: string;
  disabled?: boolean;
  disabledReason?: string;
  ariaLabel?: string;
  tone?: 'normal' | 'destructive';
}

export interface MenuActionDescriptor extends MenuInteractiveDescriptorBase {
  kind: 'action';
  onSelect: (context: MenuActionContext) => MenuOutcome | Promise<MenuOutcome>;
}

export interface MenuRadioDescriptor extends MenuInteractiveDescriptorBase {
  kind: 'radio';
  checked: boolean;
  onSelect: (context: MenuActionContext) => MenuOutcome | Promise<MenuOutcome>;
}

export interface MenuSubmenuDescriptor extends MenuInteractiveDescriptorBase {
  kind: 'submenu';
  items: readonly MenuDescriptor[];
}

export interface MenuExternalChildDescriptor extends MenuInteractiveDescriptorBase {
  kind: 'external-child';
  openOn: 'activate' | 'hover';
  onOpen: (context: MenuExternalChildContext) => void;
  onSelect?: (context: MenuActionContext) => MenuOutcome | Promise<MenuOutcome>;
}

export interface MenuSeparatorDescriptor {
  kind: 'separator';
  id: string;
}

export type MenuDescriptor =
  | MenuActionDescriptor
  | MenuRadioDescriptor
  | MenuSubmenuDescriptor
  | MenuExternalChildDescriptor
  | MenuSeparatorDescriptor;

export interface MenuOpenOptions {
  anchor: MenuAnchor;
  items: readonly MenuDescriptor[];
  ariaLabel: string;
  initialFocusId?: string;
  minWidth?: number;
  restoreInvocationFocus: () => void;
  focusAfterAction: () => void;
  onActionError?: (error: unknown, itemId: string) => void;
  onClose?: (reason: MenuCloseReason) => void;
}

export interface MenuExternalChildMenuOptions {
  anchorElement: HTMLElement;
  items: readonly MenuDescriptor[];
  ariaLabel: string;
  initialFocusId?: string;
  minWidth?: number;
}

export interface MenuHandle {
  update: (items: readonly MenuDescriptor[]) => void;
  focusItem: (itemId: string) => boolean;
  close: (reason?: MenuCloseReason) => void;
  isOpen: () => boolean;
}
