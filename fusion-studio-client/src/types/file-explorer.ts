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
  content: string;
  size: number;
  loading: boolean;
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

export type SaveReason = 'autosave' | 'manual' | 'session_end' | 'checkpoint' | 'milestone';

export interface FileSaveRequest {
  type: 'file_save';
  panel: string;
  path: string;
  content: string;
  reason?: SaveReason;
  milestone?: string;
}

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
export interface FileSaveResponse {
  type: 'file_save_response';
  panel: string;
  path: string;
  success: boolean;
  error?: string;
  code?: FileErrorCode;
}

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
