/**
 * @module chatSurfaceRegistrationContract
 * @role Dependency-free descriptor-input contract for the code-owned
 *       `fusion.chat-surface` first-party component registration
 *       (SPEC-02 §8; BRIDGE-02 overlay §4.3).
 *
 * The JSON-safe descriptor input carries durable identities ONLY: explicit
 * `workspaceId`, view-bound `viewId`, `threadGroupId`, `threadId`, and `host`.
 * It never carries a transient `surfaceId`, store, socket, callback, path,
 * React element, import, or authority claim. The connected resolver mints the
 * transient `surfaceId` from the unique `componentInstanceId` + runtime mount
 * generation and never persists it.
 *
 * This module imports no store, socket, controller, service, or tab owner so
 * the shape can be validated before any live mount is reached.
 */

import type { ChatSurfaceHostKind } from './chatSurfaceContract';

export const CHAT_SURFACE_COMPONENT_TYPE = 'fusion.chat-surface';

/** Durable identities carried by the descriptor input. No transient fields. */
export interface ChatSurfaceDescriptorInput {
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  threadId: string;
  host: ChatSurfaceHostKind;
}

/**
 * Exact allowed input key set. Input with any other key (notably a transient
 * `surfaceId`, or a store/socket/callback/path/authority claim) is rejected and
 * never reaches a live mount.
 */
const ALLOWED_INPUT_KEYS: readonly string[] = Object.freeze([
  'workspaceId',
  'viewId',
  'threadGroupId',
  'threadId',
  'host',
]);

const HOST_KINDS: readonly ChatSurfaceHostKind[] = Object.freeze(['main', 'side-tab']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Matches the Generic Host's bounded-opaque-id discipline for durable identities. */
function isBoundedIdentity(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && new TextEncoder().encode(value).byteLength <= 256
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
}

/**
 * Strict parse of the JSON-safe descriptor input. Returns null for any
 * malformed, incomplete, extra-keyed (including `surfaceId`), or
 * non-durable input. Callers render the inert unavailable body on null.
 */
export function parseChatSurfaceDescriptorInput(
  input: unknown,
): ChatSurfaceDescriptorInput | null {
  if (!isPlainRecord(input)) return null;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Object.keys(descriptors);
    if (keys.length !== ALLOWED_INPUT_KEYS.length) return null;
    if (Object.getOwnPropertySymbols(input).length > 0) return null;
    for (const key of keys) {
      if (!ALLOWED_INPUT_KEYS.includes(key)) return null;
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || !('value' in descriptor)) return null;
    }
    const workspaceId = descriptors.workspaceId.value;
    const viewId = descriptors.viewId.value;
    const threadGroupId = descriptors.threadGroupId.value;
    const threadId = descriptors.threadId.value;
    const host = descriptors.host.value;
    if (!isBoundedIdentity(workspaceId)
      || !isBoundedIdentity(threadGroupId)
      || !isBoundedIdentity(threadId)) {
      return null;
    }
    if (!isBoundedIdentity(viewId)) return null;
    if (typeof host !== 'string' || !HOST_KINDS.includes(host as ChatSurfaceHostKind)) return null;
    return {
      workspaceId,
      viewId,
      threadGroupId,
      threadId,
      host: host as ChatSurfaceHostKind,
    };
  } catch {
    return null;
  }
}

/**
 * Mint one transient component-backed `surfaceId` from the descriptor's unique
 * `componentInstanceId` plus the runtime mount generation (BRIDGE-02 overlay
 * §2 rule 4). Deterministic so the derivation is provable; never persisted,
 * sent, or accepted as input.
 */
export function mintChatComponentSurfaceId(
  componentInstanceId: string,
  generation: number,
): string {
  return `chat-surface:component:${componentInstanceId}:${generation}`;
}
