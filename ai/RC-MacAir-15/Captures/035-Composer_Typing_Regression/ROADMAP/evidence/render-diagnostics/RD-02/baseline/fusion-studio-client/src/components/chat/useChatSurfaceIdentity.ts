/**
 * @module useChatSurfaceIdentity
 * @role Mount-time transient `surfaceId` minting for a connected chat host.
 *
 * The connected host mints its own `surfaceId` at mount from the runtime mount
 * generation and never invents a component instance. The value is never
 * persisted, sent, or treated as session authority (SPEC-02 §4/§6.3,
 * BRIDGE-02 overlay §2 rule 4).
 */

import { useRef } from 'react';
import {
  mintChatSurfaceId,
  nextChatSurfaceMountGeneration,
  type ChatSurfaceHostKind,
} from './chatSurfaceContract';

export function useChatSurfaceIdentity(host: ChatSurfaceHostKind): string {
  const surfaceIdRef = useRef<string | null>(null);
  if (surfaceIdRef.current === null) {
    surfaceIdRef.current = mintChatSurfaceId(host, nextChatSurfaceMountGeneration());
  }
  return surfaceIdRef.current;
}
