/** Read the existing service-managed open Side Chat placement lane. */
import type { ComponentDescriptor } from '../../components/view-tabs/componentTabTypes';
import type { ThreadWorksurfaceEntry } from '../worksurface/types';

export const SIDE_CHAT_COMPONENT_TYPE = 'fusion.chat-surface';
export const SIDE_CHAT_HOST = 'side-tab';

export interface SideChatPlacement {
  placementId: string;
  threadId: string;
  descriptor: ComponentDescriptor;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function boundedIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

/**
 * Validate one persisted managed-placement descriptor as a durable
 * `fusion.chat-surface` Side Chat placement for the addressed view. A
 * transient `surfaceId`, a mismatched view, or a non-side host is rejected and
 * simply renders nothing.
 */
function parseSideChatDescriptor(value: unknown, viewId: string): {
  threadId: string;
  descriptor: ComponentDescriptor;
} | null {
  if (!isPlainRecord(value)) return null;
  if (value.componentTypeId !== SIDE_CHAT_COMPONENT_TYPE) return null;
  if (!boundedIdentity(value.componentInstanceId)) return null;
  const input = value.input;
  if (!isPlainRecord(input)) return null;
  if (Object.prototype.hasOwnProperty.call(input, 'surfaceId')) return null;
  if (!boundedIdentity(input.workspaceId)
    || !boundedIdentity(input.threadGroupId)
    || !boundedIdentity(input.threadId)) return null;
  if (input.viewId !== viewId) return null;
  if (input.host !== SIDE_CHAT_HOST) return null;
  return { threadId: input.threadId, descriptor: value as unknown as ComponentDescriptor };
}

/** Open Side Chat placements for one entry, in stable insertion order. */
export function readOpenSideChatPlacements(
  entry: ThreadWorksurfaceEntry | null,
  viewId: string,
): SideChatPlacement[] {
  const placements = entry?.managedComponentPlacements;
  if (!isPlainRecord(placements)) return [];
  const result: SideChatPlacement[] = [];
  for (const [placementId, record] of Object.entries(placements)) {
    if (!isPlainRecord(record) || record.disposition !== 'open') continue;
    if (!boundedIdentity(placementId)) continue;
    const parsed = parseSideChatDescriptor(record.descriptor, viewId);
    if (!parsed) continue;
    result.push({ placementId, threadId: parsed.threadId, descriptor: parsed.descriptor });
  }
  return result;
}

