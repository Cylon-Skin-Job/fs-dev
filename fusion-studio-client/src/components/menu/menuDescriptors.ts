import type { MenuDescriptor } from './types';

export type InteractiveMenuDescriptor = Extract<
  MenuDescriptor,
  { kind: 'action' | 'radio' | 'submenu' | 'external-child' }
>;

export function isInteractiveMenuDescriptor(
  descriptor: MenuDescriptor,
): descriptor is InteractiveMenuDescriptor {
  return descriptor.kind === 'action'
    || descriptor.kind === 'radio'
    || descriptor.kind === 'submenu'
    || descriptor.kind === 'external-child';
}
