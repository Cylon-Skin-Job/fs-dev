// File Explorer Types
// See docs/FILE_EXPLORER_WEBSOCKET_SPEC.md for protocol details

export interface FileTreeNode {
  name: string;           // filename on disk: "architecture.md"
  path: string;           // full relative path: "docs/architecture.md"
  type: 'file' | 'folder';
  extension?: string;     // normalized lowercase: "md" (files only)
  hasChildren?: boolean;  // folders only: true if non-empty
  isSymlink?: boolean;    // true if entry is a symlink
  symlinkTarget?: string; // resolved final target/source path for symlinks
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

interface EditorTabBase {
  /** Opaque, session-local identity. Consumers must not parse tab ids. */
  id: string;
}

/** One open file tab in the code viewer (file path is unique among file tabs). */
export interface FileEditorTab extends EditorTabBase {
  kind: 'file';
  file: FileInfo;
}

/** Session-only file-picker tab. It never enters persisted view activity. */
export interface EmptyEditorTab extends EditorTabBase {
  kind: 'empty';
}

export type EditorTab = FileEditorTab | EmptyEditorTab;

export function isFileEditorTab(tab: EditorTab): tab is FileEditorTab {
  return tab.kind === 'file';
}

export type FileErrorCode =
  | 'ENOENT'
  | 'EACCES'
  | 'ENOTDIR'
  | 'EISDIR'
  | 'ENOTPANEL'
  | 'ETOOLARGE'
  | 'EEXIST'
  | 'EINVAL'
  | 'UNKNOWN';

// Client -> Server
export interface FileTreeRequest {
  type: 'file_tree_request';
  panel: string;
  path?: string;
  includeHiddenFolders?: boolean;
}

export interface FileContentRequest {
  type: 'file_content_request';
  panel: string;
  path: string;
}

export interface FileViewerReadBaseV1 {
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: 'file-viewer';
  path: string;
}

export interface FileTreeRequestV1 extends FileViewerReadBaseV1 {
  type: 'file_tree_request';
  includeHiddenFolders?: boolean;
}

export interface FileContentRequestV1 extends FileViewerReadBaseV1 {
  type: 'file_content_request';
}

interface FileTreeNodeBaseV1 {
  name: string;
  path: string;
}

type FileReadSymlinkFieldsV1 =
  | { isSymlink?: never; symlinkTarget?: never }
  | { isSymlink: true; symlinkTarget: string };

export type FileTreeFileNodeV1 = FileTreeNodeBaseV1 & FileReadSymlinkFieldsV1 & {
  type: 'file';
  extension?: string;
};

export type FileTreeFolderNodeV1 = FileTreeNodeBaseV1 & FileReadSymlinkFieldsV1 & {
  type: 'folder';
  hasChildren: boolean;
};

export type FileTreeNodeV1 = FileTreeFileNodeV1 | FileTreeFolderNodeV1;

interface FileReadResponseBaseV1 extends FileViewerReadBaseV1 {
  success: boolean;
}

export type FileReadProtocolErrorV1<T extends 'file_tree_response' | 'file_content_response'> =
  | {
      type: T; version: 1; success: false; code: 'invalid_request'; requestId?: string; error: string;
    }
  | {
      type: T; version: 1; success: false; code: 'workspace_unavailable'; requestId: string; error: string;
    }
  | {
      type: T; version: 1; success: false; code: 'invalid_request' | 'stale_workspace';
      requestId: string; workspaceId: string; workspaceEpoch: string; error: string;
    };

export type FileTreeResponseV1 =
  | FileReadProtocolErrorV1<'file_tree_response'>
  | (FileReadResponseBaseV1 & {
      type: 'file_tree_response'; success: false;
      code: 'path_not_allowed' | 'not_found' | 'permission_denied' | 'not_directory' | 'too_many_entries' | 'read_failed';
      error: string;
    })
  | (FileReadResponseBaseV1 & FileReadSymlinkFieldsV1 & {
      type: 'file_tree_response'; success: true; nodes: FileTreeNodeV1[];
    });

export type FileContentResponseV1 =
  | FileReadProtocolErrorV1<'file_content_response'>
  | (FileReadResponseBaseV1 & {
      type: 'file_content_response'; success: false;
      code: 'path_not_allowed' | 'not_found' | 'permission_denied' | 'is_directory' | 'unsupported_text' | 'read_failed';
      error: string;
    })
  | (FileReadResponseBaseV1 & FileReadSymlinkFieldsV1 & {
      type: 'file_content_response'; success: true; content: string; size: number; lastModified: number;
    });

export interface ResourceChangedMessageV1 {
  type: 'resource:changed';
  version: 1;
  eventId: string;
  operationId: string;
  workspaceId: string;
  resourceId: string;
  resourceKind: 'file';
  operation: 'create' | 'modify';
  panel: 'file-viewer';
  path: string;
  occurredAt: number;
  workspaceEpoch: string;
}

interface ResourceChangedMessageV2Base {
  type: 'resource:changed';
  version: 2;
  projectionId: string;
  sourceActivityId: string;
  sourceEdgeId: string;
  workspaceId: string;
  resourceKind: 'file';
  changeKind: 'state_observed';
  panel: 'file-viewer';
  path: string;
  occurredAt: number;
  workspaceEpoch: string;
  snapshotId: string;
}

type ResourceChangedCheckpointFieldsV2 =
  | {
      relation: 'first_observation' | 'changed';
      checkpointEventId: string;
      checkpointObservationId: string;
    }
  | {
      relation: 'unchanged';
    };

type ResourceChangedStateFieldsV2 =
  | { state: 'bytes'; resourceId: string }
  | { state: 'absent' };

export type ResourceChangedMessageV2 = ResourceChangedMessageV2Base
  & ResourceChangedCheckpointFieldsV2
  & ResourceChangedStateFieldsV2;

export type ResourceChangedMessage = ResourceChangedMessageV1 | ResourceChangedMessageV2;

export interface ResourceRefreshRequiredV1 {
  type: 'resource:refresh_required';
  version: 1;
  workspaceId: string;
  panel: 'file-viewer';
  path: string;
  operationId: string;
  workspaceEpoch: string;
  reason: 'fact_publish_failed' | 'projection_failed' | 'projection_unavailable' | 'mutation_outcome_unknown';
}

export type SaveReason = 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';

/** Legacy save request retained until the atomic SPEC-03d activation. */
export interface LegacyFileSaveRequest {
  type: 'file_save';
  panel: string;
  path: string;
  content: string;
  reason?: SaveReason;
  milestone?: string;
}

interface FileSaveRequestBaseV1 {
  type: 'file_save';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
  content: string;
  clientActionId?: string;
  reportedUiContext?: {
    viewId?: string;
    viewInstanceId?: string;
  };
}

export type FileSaveRequestV1 = FileSaveRequestBaseV1 & (
  | { reason: 'milestone'; milestone: string }
  | { reason?: Exclude<SaveReason, 'milestone'>; milestone?: never }
);

export interface ResourceProvenanceQueryV1 {
  type: 'resource:provenance:query';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel?: string;
  path?: string;
  fileName?: string;
  folderPrefix?: string;
  operationId?: string;
  since?: number;
  limit?: number;
}

export interface ResourceProvenanceItemV1 {
  eventId: string;
  eventType: 'resource.mutated';
  occurredAt: number;
  acceptedAt: number;
  operationId: string;
  commandId: string;
  commandAcceptedEventId: string;
  resourceId: string;
  fileVersionId: string;
  mutationKind: 'create' | 'modify';
  canonicalPath: string;
  ingress: { panel: string; path: string };
  origin: { kind: 'local_client'; assurance: 'transport_only'; connectionId: string };
  snapshot:
    | { kind: 'bytes'; sha256: string; byteLength: number; capturedAt: number }
    | { kind: 'absent'; byteLength: 0; capturedAt: number };
}

export interface ResourceProvenanceResultV1 {
  type: 'resource:provenance:result';
  version: 1;
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  items: ResourceProvenanceItemV1[];
}

export type ResourceProvenanceErrorV1 =
  | {
      type: 'resource:provenance:error'; version: 1; code: 'invalid_request'; requestId?: string;
    }
  | {
      type: 'resource:provenance:error'; version: 1; code: 'invalid_request'; requestId: string;
      workspaceId: string; workspaceEpoch: string;
    }
  | {
      type: 'resource:provenance:error'; version: 1; code: 'workspace_unavailable'; requestId: string;
    }
  | {
      type: 'resource:provenance:error'; version: 1; code: 'query_failed' | 'stale_workspace';
      requestId: string; workspaceId: string; workspaceEpoch: string;
    };

export type ResourceProvenanceResponseV1 = ResourceProvenanceResultV1 | ResourceProvenanceErrorV1;

export interface FolderCreateRequest {
  type: 'folder_create';
  panel: string;
  parentPath?: string;
  name: string;
}

export interface DocumentCreateRequest {
  type: 'document_create';
  panel: string;
  parentPath?: string;
  name: string;
}

// Server -> Client (success)
export interface FileTreeResponse {
  type: 'file_tree_response';
  panel: string;
  path: string;
  success: true;
  nodes: FileTreeNode[];
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export interface FileContentResponse {
  type: 'file_content_response';
  panel: string;
  path: string;
  success: true;
  content: string;
  size: number;
  lastModified: number;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

// Server -> Client (error)
/** Legacy response retained until the atomic SPEC-03d activation. */
export interface LegacyFileSaveResponse {
  type: 'file_save_response';
  panel: string;
  path: string;
  success: boolean;
  error?: string;
  code?: FileErrorCode;
}

interface FileSaveResponseBaseV1 {
  type: 'file_save_response';
  version: 1;
  success: boolean;
  outcome: 'rejected' | 'failed_before_replace' | 'outcome_unknown' | 'succeeded';
}

export interface FileSaveEnvelopeInvalidResponseV1 extends FileSaveResponseBaseV1 {
  success: false;
  outcome: 'rejected';
  requestId?: string;
  errorCode: 'invalid_request';
  error: 'The save request is invalid.';
  retrySafe: true;
}

interface FileSavePairRejectedBaseV1 extends FileSaveResponseBaseV1 {
  success: false;
  outcome: 'rejected';
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  retrySafe: true;
}

export type FileSavePairRejectedResponseV1 = FileSavePairRejectedBaseV1 & (
  | { errorCode: 'invalid_request'; error: 'The save request is invalid.' }
  | { errorCode: 'stale_workspace'; error: 'The workspace changed before this save was accepted.' }
);

export interface FileSaveWorkspaceUnavailableResponseV1 extends FileSaveResponseBaseV1 {
  success: false;
  outcome: 'rejected';
  requestId: string;
  errorCode: 'workspace_unavailable';
  error: 'The workspace is not available.';
  retrySafe: true;
}

interface FileSavePreAcceptanceRejectedBaseV1 extends FileSaveResponseBaseV1 {
  success: false;
  outcome: 'rejected';
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
  retrySafe: true;
}

export type FileSavePreAcceptanceRejectedResponseV1 = FileSavePreAcceptanceRejectedBaseV1 & (
  | { errorCode: 'path_not_allowed'; error: 'The requested path is not allowed.' }
  | { errorCode: 'unsupported_text'; error: 'Only supported UTF-8 text can be saved.' }
  | { errorCode: 'too_large'; error: 'The file exceeds the 10 MiB limit.' }
  | { errorCode: 'save_busy'; error: 'Too many saves are queued for this file.' }
  | { errorCode: 'storage_unavailable'; error: 'Save storage is temporarily unavailable.' }
);

interface FileSaveAcceptedIdentityV1 extends FileSaveResponseBaseV1 {
  requestId: string;
  workspaceId: string;
  workspaceEpoch: string;
  panel: string;
  path: string;
  operationId: string;
  commandId: string;
  commandAcceptedEventId: string;
  resourceEventId: string;
  resourceId: string;
  fileVersionId: string;
  canonicalPath: string;
  commandFactState: 'admitted' | 'pending';
  resourceFactState: 'admitted' | 'pending' | 'not_emitted';
  ledgerState: 'stored' | 'pending' | 'conflict' | 'not_applicable';
}

interface FileSaveFailedBeforeReplaceBaseV1 extends FileSaveAcceptedIdentityV1 {
  success: false;
  outcome: 'failed_before_replace';
  retrySafe: true;
  resourceFactState: 'not_emitted';
  ledgerState: 'not_applicable';
}

export type FileSaveFailedBeforeReplaceResponseV1 = FileSaveFailedBeforeReplaceBaseV1 & (
  | { errorCode: 'snapshot_failed'; error: 'The existing file could not be captured safely.' }
  | { errorCode: 'unsupported_preimage'; error: 'The existing file is not supported UTF-8 text.' }
  | { errorCode: 'preimage_too_large'; error: 'The existing file exceeds the 10 MiB limit.' }
  | { errorCode: 'preimage_conflict'; error: 'The file changed before it could be replaced.' }
  | { errorCode: 'write_prepare_failed'; error: 'The replacement could not be prepared.' }
  | { errorCode: 'replace_failed'; error: 'The file could not be replaced.' }
  | { errorCode: 'permission_denied'; error: 'Permission was denied while saving the file.' }
);

export interface FileSaveOutcomeUnknownResponseV1 extends FileSaveAcceptedIdentityV1 {
  success: false;
  outcome: 'outcome_unknown';
  errorCode: 'mutation_outcome_unknown';
  error: 'The save outcome is uncertain and requires reconciliation.';
  retrySafe: false;
  resourceFactState: 'not_emitted';
  ledgerState: 'not_applicable';
}

interface FileSaveSucceededBaseV1 extends FileSaveAcceptedIdentityV1 {
  success: true;
  outcome: 'succeeded';
  resourceFactState: 'admitted' | 'pending';
  ledgerState: 'stored' | 'pending' | 'conflict';
}

type FileSaveCompleteProvenanceV1 = {
  commandFactState: 'admitted';
  resourceFactState: 'admitted';
  ledgerState: 'stored';
  provenanceState: 'complete';
};

type FileSavePendingProvenanceV1 = ({
  commandFactState: 'pending';
  resourceFactState: 'admitted' | 'pending';
  ledgerState: 'stored' | 'pending' | 'conflict';
} | {
  commandFactState: 'admitted';
  resourceFactState: 'pending';
  ledgerState: 'stored' | 'pending' | 'conflict';
} | {
  commandFactState: 'admitted';
  resourceFactState: 'admitted';
  ledgerState: 'pending' | 'conflict';
}) & {
  provenanceState: 'pending_reconciliation';
};

export type FileSaveSucceededResponseV1 = FileSaveSucceededBaseV1 & (
  | (FileSaveCompleteProvenanceV1 & {
    checkpointState: 'failed'; warningCodes: ['checkpoint_failed'];
  })
  | (FileSaveCompleteProvenanceV1 & {
    checkpointState: 'not_requested' | 'committed' | 'no_change'; warningCodes?: never;
  })
  | (FileSavePendingProvenanceV1 & {
    checkpointState: 'failed'; warningCodes: ['checkpoint_failed', 'provenance_pending'];
  })
  | (FileSavePendingProvenanceV1 & {
    checkpointState: 'not_requested' | 'committed' | 'no_change'; warningCodes: ['provenance_pending'];
  })
);

export type FileSaveResponseV1 =
  | FileSaveEnvelopeInvalidResponseV1
  | FileSavePairRejectedResponseV1
  | FileSaveWorkspaceUnavailableResponseV1
  | FileSavePreAcceptanceRejectedResponseV1
  | FileSaveFailedBeforeReplaceResponseV1
  | FileSaveOutcomeUnknownResponseV1
  | FileSaveSucceededResponseV1;

export type FileSaveRequest = LegacyFileSaveRequest | FileSaveRequestV1;
export type FileSaveResponse = LegacyFileSaveResponse | FileSaveResponseV1;

export interface FolderCreateResponse {
  type: 'folder_create_response';
  panel: string;
  parentPath: string;
  path?: string;
  success: boolean;
  error?: string;
  code?: FileErrorCode;
}

export interface DocumentCreateResponse {
  type: 'document_create_response';
  panel: string;
  parentPath: string;
  path?: string;
  name?: string;
  extension?: string;
  content?: string;
  success: boolean;
  error?: string;
  code?: FileErrorCode;
}

export interface FileOperationError {
  type: 'file_tree_response' | 'file_content_response';
  panel: string;
  path: string;
  success: false;
  error: string;
  code: FileErrorCode;
}

// Server -> Client (file watching stub)
export interface FileChangedNotification {
  type: 'file_changed';
  panel: string;
  filePath: string;
  change: 'created' | 'modified' | 'deleted';
  timestamp?: number;
}

// Server -> Client (panel configuration on connect)
export interface PanelConfigMessage {
  type: 'panel_config';
  panel: string;
  projectRoot: string;
  projectName: string;
}
