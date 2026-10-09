/**
 * @module worksurface/types
 * @role CHAT-03 / SPEC-03 §4–§7 portable worksurface contract.
 *
 * One versioned adapter contract per participating built-in view. `content` is
 * adapter-owned and opaque to the generic server/service; the server only
 * validates that it is bounded JSON and merges it without touching the
 * service-owned managed-placement lane. No transcript, runtime, draft,
 * attachment, model, rail, shell, transcript `threadId`, or the transient
 * mounted-UI id may appear in either lane.
 */

/** JSON-safe value (the adapter payload boundary). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type WorksurfaceLane = 'content' | 'placement';

export type ManagedPlacementDisposition = 'open' | 'closed';

export interface ManagedPlacementRecord {
  placementId: string;
  disposition: ManagedPlacementDisposition;
  /** Durable descriptor only; never a transient mounted-UI id. */
  descriptor?: JsonValue;
  updatedAt: string;
}

/** Mirrors the server-persisted `ThreadWorksurfaceEntry` (SPEC-03 §4). */
export interface ThreadWorksurfaceEntry {
  schemaVersion: number;
  adapterId: string;
  adapterVersion: number;
  contentRevision: string;
  placementRevision: string;
  updatedAt: string;
  content: JsonValue;
  managedComponentPlacements: Record<string, ManagedPlacementRecord>;
}

export interface SanitizedResult {
  ok: boolean;
  /** Sanitized JSON-safe content when `ok`; otherwise null (inert). */
  content: JsonValue | null;
  /** Classified, user-inert warning code when the data is unsupported. */
  warning?: string;
}

export interface RestoreResult {
  restored: boolean;
  /** Unavailable resources reported without inventing a replacement identity. */
  unavailable?: string[];
  warning?: string;
}

/**
 * Implementation-equivalent adapter contract (SPEC-03 §5). Connected adapters
 * may touch their own view store; the generic service never interprets content.
 */
export interface WorksurfaceAdapter {
  adapterId: string;
  adapterVersion: number;
  capture(): JsonValue;
  sanitize(input: JsonValue, storedVersion: number): SanitizedResult;
  restore(content: JsonValue): Promise<RestoreResult>;
}

// ── Registered route frames (workspace/view-state `state:*` family) ──────────

export interface WorksurfaceGetRequest {
  type: 'state:worksurface_get';
  viewId: string;
  threadGroupId: string;
  requestId: string;
}

export interface WorksurfacePutRequest {
  type: 'state:worksurface_put';
  viewId: string;
  threadGroupId: string;
  requestId: string;
  expectedContentRevision: string | null;
  adapterId: string;
  adapterVersion: number;
  content: JsonValue;
}

export interface WorksurfacePlacementRequest {
  type: 'state:worksurface_placement';
  viewId: string;
  threadGroupId: string;
  requestId: string;
  placementId: string;
  expectedPlacementRevision: string | null;
  operation: 'upsert' | 'close';
  descriptor?: JsonValue;
}

export interface WorksurfaceResultFrame {
  type: 'state:worksurface_result';
  viewId: string;
  threadGroupId: string;
  requestId?: string;
  workspaceId?: string | null;
  lane: WorksurfaceLane;
  entry: ThreadWorksurfaceEntry | null;
  contentRevision: string | null;
  placementRevision: string | null;
  applied?: boolean;
  acknowledged?: boolean;
}

export interface WorksurfaceErrorFrame {
  type: 'state:worksurface_error';
  viewId: string | null;
  threadGroupId: string | null;
  requestId?: string;
  workspaceId?: string | null;
  lane: WorksurfaceLane;
  code: string;
  message?: string;
  entry?: ThreadWorksurfaceEntry | null;
  contentRevision?: string | null;
  placementRevision?: string | null;
}

export interface WorksurfaceChangedFrame {
  type: 'state:worksurface_changed';
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  lane: WorksurfaceLane;
  contentRevision: string | null;
  placementRevision: string | null;
}
