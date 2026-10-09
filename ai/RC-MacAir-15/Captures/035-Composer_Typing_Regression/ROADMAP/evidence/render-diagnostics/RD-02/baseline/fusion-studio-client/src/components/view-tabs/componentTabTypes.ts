export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface EmptyTabContent {
  kind: 'empty';
  revision: number;
}

export interface ComponentDescriptor {
  schemaVersion: 1;
  componentTypeId: string;
  componentInstanceId: string;
  input: { [key: string]: JsonValue };
  targetKey?: string;
}

export interface ComponentTabContent {
  kind: 'component';
  revision: number;
  component: ComponentDescriptor;
}

export type TabContentDescriptor = EmptyTabContent | ComponentTabContent;

export interface TabContentRecord {
  tabId: string;
  content: TabContentDescriptor;
}

export interface ReservationError {
  code: string;
  message: string;
}

export type ReservationFailureKind =
  | 'launch_failed'
  | 'timed_out'
  | 'unavailable'
  | 'invalid_component'
  | 'component_instance_conflict';

export interface EmptyTabReservation {
  tabId: string;
  operationId: string;
  expectedRevision: number;
  launcherId: string;
  status: 'pending' | 'failed';
  error?: ReservationError;
}

export type ReservationIdentity = Pick<
  EmptyTabReservation,
  'tabId' | 'operationId' | 'expectedRevision'
>;

/** Runtime state remains with the connected owner; this is not a store or persistence schema. */
export interface ComponentTabCollectionState {
  tabs: readonly TabContentRecord[];
  activeTabId: string | null;
  reservations: readonly EmptyTabReservation[];
}

export const COMPONENT_TAB_LIMITS = Object.freeze({
  maxIdBytes: 256,
  maxTargetKeyBytes: 512,
  maxInputBytes: 64 * 1024,
  maxJsonDepth: 16,
  maxJsonNodes: 4096,
  maxContainerEntries: 512,
  maxObjectKeyBytes: 256,
  maxErrorCodeBytes: 64,
  maxErrorMessageBytes: 512,
});

export type ComponentTabValidationErrorCode =
  | 'invalid_shape'
  | 'unknown_field'
  | 'unsupported_schema_version'
  | 'invalid_id'
  | 'invalid_revision'
  | 'invalid_json_value'
  | 'unsafe_key'
  | 'excessive_depth'
  | 'excessive_size';

export type ComponentTabValidationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: {
        code: ComponentTabValidationErrorCode;
        message: string;
      };
    };

export type ComponentTabTransitionFailureCode =
  | 'invalid_id'
  | 'id_conflict'
  | 'tab_not_found'
  | 'tab_not_empty'
  | 'reservation_not_failed'
  | 'stale_completion'
  | 'invalid_component'
  | 'component_instance_conflict';

export interface ComponentTabTransitionFailure {
  ok: false;
  state: ComponentTabCollectionState;
  code: ComponentTabTransitionFailureCode;
  message: string;
}

/** Callers supply opaque IDs that are globally fresh, including versus retired operations. */
export type ComponentTabIdFactory = () => string;
