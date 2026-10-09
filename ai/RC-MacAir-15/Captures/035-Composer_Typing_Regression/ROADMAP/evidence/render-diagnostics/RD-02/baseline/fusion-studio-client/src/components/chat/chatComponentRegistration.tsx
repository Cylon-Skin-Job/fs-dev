/**
 * @module chatComponentRegistration
 * @role Code-owned first-party registration for `fusion.chat-surface` through
 *       the accepted Generic Host resolver seam (SPEC-02 §8, Slice 02C;
 *       BRIDGE-02 overlay §4.3).
 *
 * The registration is closed and code-owned: it never scans or imports a
 * component at resolution time. Its `render` returns the connected chat mount
 * for the already-validated descriptor; semantic tuple validation and the
 * transient `surfaceId` derivation live inside that mount.
 *
 * The connected mount (which carries the chat presentation CSS) is loaded
 * lazily so pure/spec consumers of the registration chain stay CSS-free,
 * matching the existing first-party presenter registrations.
 *
 * This slice adds NO launcher, empty-tab, targetKey, placement, persistence,
 * dedupe, catalog, or production tab/descriptor. It only makes the seam real.
 */

import { createElement, lazy, Suspense } from 'react';
import type { FirstPartyComponentRegistration } from '../view-tabs/componentTabResolver';
import { CHAT_SURFACE_COMPONENT_TYPE } from './chatSurfaceRegistrationContract';

export { CHAT_SURFACE_COMPONENT_TYPE } from './chatSurfaceRegistrationContract';
export {
  mintChatComponentSurfaceId,
  parseChatSurfaceDescriptorInput,
} from './chatSurfaceRegistrationContract';
export type { ChatSurfaceDescriptorInput } from './chatSurfaceRegistrationContract';

const LazyChatSurfaceComponentMount = lazy(async () => ({
  default: (await import('./ChatSurfaceComponentMount')).ChatSurfaceComponentMount,
}));

/**
 * First-party registrations contributed by the chat domain. The Generic Host
 * resolver performs the generic descriptor/schema validation and the
 * disabled/unknown/version handling; the chat mount validates the durable
 * identity set and the hydrated tuple.
 */
export function chatConnectedRegistrations(): readonly FirstPartyComponentRegistration[] {
  return [
    {
      componentTypeId: CHAT_SURFACE_COMPONENT_TYPE,
      label: 'Chat surface',
      render: ({ descriptor }) => createElement(
        Suspense,
        { fallback: null },
        createElement(LazyChatSurfaceComponentMount, { descriptor }),
      ),
    },
  ];
}
