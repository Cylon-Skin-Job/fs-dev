/**
 * @module office-palette-handlers
 * @role Correlate direct workspace palette reads and acknowledged mutations.
 */

import { useOfficePaletteStore } from '../../state/officePaletteStore';
import { useWorkspaceStore } from '../../state/workspaceStore';
import type {
  OfficePaletteErrorCode,
  OfficePaletteErrorMessage,
  OfficePaletteOperation,
  OfficePaletteProtocolState,
  OfficePaletteStateMessage,
  WebSocketMessage,
} from '../../types';

const SOCKET_OPEN = 1;
const MAX_REQUEST_ID_BYTES = 128;
const HEX_COLOR = /^#[0-9a-f]{6}$/;
const OPERATIONS = new Set<OfficePaletteOperation>(['get', 'add', 'remove', 'set_sync']);
const MUTATIONS = new Set<OfficePaletteOperation>(['add', 'remove', 'set_sync']);
const ERROR_CODES = new Set<OfficePaletteErrorCode>([
  'INVALID_REQUEST', 'UNKNOWN_WORKSPACE', 'WORKSPACE_NOT_ACTIVE', 'PATH_REJECTED',
  'SYMLINK_REJECTED', 'NOT_REGULAR_FILE', 'INVALID_SCHEMA', 'FILE_TOO_LARGE',
  'READ_FAILED', 'PALETTE_LIMIT', 'DIRECTORY_CREATE_FAILED', 'READ_ONLY', 'WRITE_FAILED',
]);

export interface OfficePaletteSocket {
  readyState: number;
  send: (data: string) => void;
}

type PaletteStoreActions = Pick<ReturnType<typeof useOfficePaletteStore.getState>,
  'setActiveWorkspace' | 'beginRequest' | 'cancelRequest' | 'applyState' | 'applyError'>;

interface OfficePaletteControllerDependencies {
  getActiveWorkspaceId: () => string | null;
  getPaletteStore: () => PaletteStoreActions;
  createRequestId?: () => string;
}

interface PendingRead {
  requestId: string;
  workspaceId: string;
}

interface PendingMutation {
  requestId: string;
  workspaceId: string;
  operation: 'add' | 'remove' | 'set_sync';
  resolve: (state: OfficePaletteStateMessage) => void;
  reject: (error: OfficePaletteMutationError) => void;
}

export class OfficePaletteMutationError extends Error {
  readonly code: OfficePaletteErrorCode;
  readonly operation: OfficePaletteOperation;
  readonly state?: OfficePaletteProtocolState;

  constructor(message: OfficePaletteErrorMessage) {
    super(message.message);
    this.name = 'OfficePaletteMutationError';
    this.code = message.code;
    this.operation = message.operation;
    this.state = message.state;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && utf8Length(value) <= MAX_REQUEST_ID_BYTES;
}

function hasValidProjection(value: Record<string, unknown>): boolean {
  return Array.isArray(value.customColors)
    && value.customColors.length <= 20
    && value.customColors.every((color) => typeof color === 'string' && HEX_COLOR.test(color))
    && typeof value.syncEnabled === 'boolean';
}

function isSuccessState(value: unknown): value is OfficePaletteProtocolState {
  if (!isRecord(value) || !hasValidProjection(value)) return false;
  return (value.source === 'request' || value.source === 'mutation')
    && value.availability === 'ready'
    && value.syncStatus === 'ok';
}

function isSafeErrorState(value: unknown): value is OfficePaletteProtocolState {
  if (!isRecord(value) || !hasValidProjection(value)) return false;
  return value.source === 'error'
    && value.availability === 'unavailable'
    && value.syncStatus === 'degraded';
}

function parseStateMessage(msg: WebSocketMessage): OfficePaletteStateMessage | null {
  const value = msg as unknown as Record<string, unknown>;
  if (!isValidRequestId(value.requestId) || !isNonemptyString(value.workspaceId)) return null;
  if (typeof value.operation !== 'string' || !OPERATIONS.has(value.operation as OfficePaletteOperation)) return null;
  if (!isSuccessState(value)) return null;
  const validRoute = value.operation === 'get'
    ? value.source === 'request'
    : value.source === 'mutation' && MUTATIONS.has(value.operation as OfficePaletteOperation);
  return validRoute ? value as unknown as OfficePaletteStateMessage : null;
}

function parseErrorMessage(msg: WebSocketMessage): OfficePaletteErrorMessage | null {
  const value = msg as unknown as Record<string, unknown>;
  const allowedKeys = new Set(['type', 'requestId', 'workspaceId', 'operation', 'code', 'message', 'state']);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  if (!isValidRequestId(value.requestId) || !isNonemptyString(value.workspaceId)) return null;
  if (typeof value.operation !== 'string' || !OPERATIONS.has(value.operation as OfficePaletteOperation)) return null;
  if (typeof value.code !== 'string' || !ERROR_CODES.has(value.code as OfficePaletteErrorCode)) return null;
  if (!isNonemptyString(value.message)) return null;
  if (value.state !== undefined && !isSafeErrorState(value.state)) return null;
  return value as unknown as OfficePaletteErrorMessage;
}

let requestSequence = 0;

function createOpaqueRequestId(): string {
  requestSequence = (requestSequence + 1) % Number.MAX_SAFE_INTEGER;
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `palette-${random}-${requestSequence.toString(36)}`;
}

function localMutationError(
  workspaceId: string,
  operation: OfficePaletteOperation,
  code: OfficePaletteErrorCode,
  message: string,
): OfficePaletteMutationError {
  return new OfficePaletteMutationError({
    type: 'office:palette_error', workspaceId, operation, code, message,
  });
}

export class OfficePaletteClientController {
  private readonly dependencies: OfficePaletteControllerDependencies;
  private socket: OfficePaletteSocket | null = null;
  private activeWorkspaceId: string | null = null;
  private requestedWorkspaceId: string | null = null;
  private pendingRead: PendingRead | null = null;
  private readonly pendingMutations = new Map<string, PendingMutation>();

  constructor(dependencies: OfficePaletteControllerDependencies) {
    this.dependencies = dependencies;
  }

  onSocketOpen(socket: OfficePaletteSocket, requestImmediately = true): void {
    this.socket = socket;
    this.requestedWorkspaceId = null;
    this.pendingRead = null;
    this.activeWorkspaceId = this.dependencies.getActiveWorkspaceId();
    this.dependencies.getPaletteStore().setActiveWorkspace(this.activeWorkspaceId);
    if (requestImmediately) this.requestCurrentState();
  }

  onSocketClose(socket: OfficePaletteSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.requestedWorkspaceId = null;
    const store = this.dependencies.getPaletteStore();
    if (this.pendingRead) store.cancelRequest(this.pendingRead.workspaceId);
    this.pendingRead = null;
    for (const pending of this.pendingMutations.values()) {
      store.cancelRequest(pending.workspaceId);
      pending.reject(localMutationError(
        pending.workspaceId,
        pending.operation,
        'READ_FAILED',
        'The palette connection closed before acknowledgment.',
      ));
    }
    this.pendingMutations.clear();
  }

  onWorkspaceChanged(workspaceId: string | null): void {
    if (workspaceId !== this.activeWorkspaceId) {
      const store = this.dependencies.getPaletteStore();
      if (this.pendingRead) store.cancelRequest(this.pendingRead.workspaceId);
      this.activeWorkspaceId = workspaceId;
      this.requestedWorkspaceId = null;
      this.pendingRead = null;
      for (const [requestId, pending] of this.pendingMutations) {
        if (pending.workspaceId === workspaceId) continue;
        store.cancelRequest(pending.workspaceId);
        pending.reject(localMutationError(
          pending.workspaceId,
          pending.operation,
          'WORKSPACE_NOT_ACTIVE',
          'The palette target is stale after a workspace switch.',
        ));
        this.pendingMutations.delete(requestId);
      }
    }
    this.dependencies.getPaletteStore().setActiveWorkspace(workspaceId);
    this.requestCurrentState();
  }

  refreshCurrentState(): string | null {
    this.requestedWorkspaceId = null;
    if (this.pendingRead) this.dependencies.getPaletteStore().cancelRequest(this.pendingRead.workspaceId);
    this.pendingRead = null;
    return this.requestCurrentState();
  }

  requestCurrentState(): string | null {
    const workspaceId = this.activeWorkspaceId;
    if (!workspaceId || !this.socket || this.socket.readyState !== SOCKET_OPEN) return null;
    if (this.requestedWorkspaceId === workspaceId) return this.pendingRead?.requestId ?? null;
    if ([...this.pendingMutations.values()].some((pending) => pending.workspaceId === workspaceId)) return null;
    const requestId = (this.dependencies.createRequestId ?? createOpaqueRequestId)();
    if (!isValidRequestId(requestId)) return null;
    this.requestedWorkspaceId = workspaceId;
    this.pendingRead = { requestId, workspaceId };
    this.dependencies.getPaletteStore().beginRequest(workspaceId);
    this.socket.send(JSON.stringify({ type: 'office:palette_get', requestId, workspaceId }));
    return requestId;
  }

  mutate(
    operation: 'add' | 'remove' | 'set_sync',
    value: string | boolean,
  ): Promise<OfficePaletteStateMessage> {
    const workspaceId = this.activeWorkspaceId;
    if (!workspaceId || !this.socket || this.socket.readyState !== SOCKET_OPEN) {
      return Promise.reject(new Error('The workspace palette is not connected.'));
    }
    if (
      this.pendingRead?.workspaceId === workspaceId
      || [...this.pendingMutations.values()].some((pending) => pending.workspaceId === workspaceId)
    ) {
      return Promise.reject(localMutationError(
        workspaceId,
        operation,
        'INVALID_REQUEST',
        'A workspace palette operation is already pending.',
      ));
    }
    const requestId = (this.dependencies.createRequestId ?? createOpaqueRequestId)();
    if (!isValidRequestId(requestId)) return Promise.reject(new Error('Could not create a palette request ID.'));
    const payload = operation === 'set_sync'
      ? { type: 'office:palette_set_sync', requestId, workspaceId, enabled: value }
      : { type: `office:palette_${operation}`, requestId, workspaceId, color: value };
    this.dependencies.getPaletteStore().beginRequest(workspaceId);
    return new Promise((resolve, reject) => {
      this.pendingMutations.set(requestId, { requestId, workspaceId, operation, resolve, reject });
      this.socket!.send(JSON.stringify(payload));
    });
  }

  handleMessage(msg: WebSocketMessage): boolean {
    if (msg.type !== 'office:palette_state' && msg.type !== 'office:palette_error') return false;
    const parsed = msg.type === 'office:palette_state' ? parseStateMessage(msg) : parseErrorMessage(msg);
    if (!parsed) return true;

    const { requestId, workspaceId } = parsed;
    const mutation = requestId ? this.pendingMutations.get(requestId) : undefined;
    if (mutation) {
      if (parsed.operation !== mutation.operation) return true;
      this.pendingMutations.delete(requestId!);
      if (workspaceId !== mutation.workspaceId || workspaceId !== this.activeWorkspaceId) {
        this.dependencies.getPaletteStore().cancelRequest(mutation.workspaceId);
        mutation.reject(localMutationError(
          mutation.workspaceId,
          mutation.operation,
          'WORKSPACE_NOT_ACTIVE',
          'The palette target is stale after a workspace switch.',
        ));
        return true;
      }
      const store = this.dependencies.getPaletteStore();
      if (parsed.type === 'office:palette_state') {
        store.applyState(workspaceId!, parsed, parsed.operation);
        mutation.resolve(parsed);
      } else {
        store.applyError(workspaceId!, {
          code: parsed.code, message: parsed.message, operation: parsed.operation,
        }, parsed.state);
        mutation.reject(new OfficePaletteMutationError(parsed));
      }
      return true;
    }

    const pending = this.pendingRead;
    if (
      !pending
      || pending.requestId !== requestId
      || pending.workspaceId !== workspaceId
      || parsed.operation !== 'get'
    ) return true;
    this.pendingRead = null;
    if (workspaceId !== this.activeWorkspaceId) return true;
    const store = this.dependencies.getPaletteStore();
    if (parsed.type === 'office:palette_state') {
      store.applyState(workspaceId, parsed, parsed.operation);
    } else {
      store.applyError(workspaceId, {
        code: parsed.code, message: parsed.message, operation: parsed.operation,
      }, parsed.state);
    }
    return true;
  }
}

const officePaletteController = new OfficePaletteClientController({
  getActiveWorkspaceId: () => useWorkspaceStore.getState().activeWorkspaceId,
  getPaletteStore: () => useOfficePaletteStore.getState(),
});

export const addOfficePaletteColor = (color: string) => officePaletteController.mutate('add', color);
export const removeOfficePaletteColor = (color: string) => officePaletteController.mutate('remove', color);
export const setOfficePaletteSync = (enabled: boolean) => officePaletteController.mutate('set_sync', enabled);
export const refreshOfficePalette = () => officePaletteController.refreshCurrentState();
export const handleOfficePaletteMessage = (msg: WebSocketMessage) => officePaletteController.handleMessage(msg);
export const handleOfficePaletteSocketOpen = (
  socket: OfficePaletteSocket,
  options: { requestImmediately?: boolean } = {},
) => officePaletteController.onSocketOpen(socket, options.requestImmediately ?? true);
export const handleOfficePaletteSocketClose = (socket: OfficePaletteSocket) => officePaletteController.onSocketClose(socket);
export const handleOfficePaletteWorkspaceChanged = (workspaceId: string | null) => (
  officePaletteController.onWorkspaceChanged(workspaceId)
);
