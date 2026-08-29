/**
 * @module types/workspace
 * @role Workspace domain types — workspace registry entries, view templates,
 * office palette protocol, resolved CLI catalog entries, thread records, and
 * harness install status.
 *
 * Split out of the former monolithic types module (SPEC-04 Slice A).
 * Pure type surface: no runtime logic.
 */

export interface Workspace {
  id: string;
  label: string;
  icon: string;
  description: string | null;
  repoPath: string;
  sortOrder: number;
  type?: 'code' | 'app';
  ribbonVisible?: boolean;
  ribbonSortOrder?: number | null;
}

export type OfficePaletteAvailability = 'ready' | 'unavailable';
export type OfficePaletteSource = 'request' | 'error' | 'mutation';
export type OfficePaletteOperation = 'get' | 'add' | 'remove' | 'set_sync';
export type OfficePaletteSyncStatus = 'ok' | 'degraded';
export type OfficePaletteErrorCode =
  | 'INVALID_REQUEST'
  | 'UNKNOWN_WORKSPACE'
  | 'WORKSPACE_NOT_ACTIVE'
  | 'PATH_REJECTED'
  | 'SYMLINK_REJECTED'
  | 'NOT_REGULAR_FILE'
  | 'INVALID_SCHEMA'
  | 'FILE_TOO_LARGE'
  | 'READ_FAILED'
  | 'PALETTE_LIMIT'
  | 'DIRECTORY_CREATE_FAILED'
  | 'READ_ONLY'
  | 'WRITE_FAILED';

export interface OfficePaletteProtocolState {
  customColors: string[];
  syncEnabled: boolean;
  source: OfficePaletteSource;
  availability: OfficePaletteAvailability;
  syncStatus: OfficePaletteSyncStatus;
}

export interface OfficePaletteStateMessage extends OfficePaletteProtocolState {
  type: 'office:palette_state';
  requestId?: string;
  workspaceId: string;
  operation: OfficePaletteOperation;
}

export interface OfficePaletteErrorMessage {
  type: 'office:palette_error';
  requestId?: string;
  workspaceId?: string;
  operation: OfficePaletteOperation;
  code: OfficePaletteErrorCode;
  message: string;
  state?: OfficePaletteProtocolState;
}

export interface WorkspaceViewTemplate {
  id: string;
  label: string;
  group: 'default' | 'optional';
  status: 'ready' | 'active-development' | 'stub';
  icon?: string;
  templatePath: string;
}

export interface WorkspaceTemplateProfile {
  schemaVersion: number;
  id: string;
  label: string;
  category: 'new' | 'startup' | string;
  description?: string;
  selectedViewIds: string[];
  profilePath?: string | null;
}

export interface WorkspaceCreateManifest {
  version: number;
  views: WorkspaceViewTemplate[];
  workspaceTemplates?: WorkspaceTemplateProfile[];
}

export interface WorkspaceHiddenView {
  id: string;
  baseViewId: string;
  label: string;
  icon: string;
}

// CLI_CONFIG_SPEC §6: resolved CLI catalog entry (factory + workspace + view).
export interface ResolvedCliEntry {
  id: string;
  name: string;
  description: string;
  materialIcon: string;
  accentColor?: string;
  details: {
    provider: string;
    model: string;
    features: string[];
  };
  runtime?: {
    model?: string | null;
    thinking?: boolean;
    pure?: boolean;
  };
  enabled: boolean;
  comingSoon?: boolean;
  recommended?: boolean;
  order: number;
}

export type CliEntryOverride = Partial<Pick<ResolvedCliEntry, 'enabled' | 'name' | 'materialIcon' | 'accentColor' | 'order'>> & {
  details?: Partial<ResolvedCliEntry['details']>;
  runtime?: ResolvedCliEntry['runtime'];
};

// Thread Types
export interface ThreadEntry {
  // null when the thread has no display name yet. SPEC-24e: UI falls back
  // to the thread ID with milliseconds stripped (e.g. 2026-04-09T14-30-22).
  name: string | null;
  createdAt: string;
  resumedAt?: string;
  messageCount: number;
  status: 'active' | 'suspended';
  // RCC-0095: server returns scope: 'project' on every thread entry (wire compat)
  scope?: string;
  viewId?: string | null;
  // CLI_IDENTITY_SPEC: which harness owns this thread
  harnessId?: string;
  harnessConfig?: ThreadHarnessConfig | null;
}

export interface ThreadForkMetadata {
  type?: string;
  status?: string;
  sourceThreadId?: string;
  sourceThreadName?: string;
  sourceExchangeId?: number | null;
  sourceExchangeSeq?: number | null;
  sourceOpenCodeSessionId?: string;
  createdOpenCodeSessionId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ThreadHarnessConfig {
  opencodeSessionId?: string;
  pendingFork?: ThreadForkMetadata | null;
  forkProvenance?: ThreadForkMetadata | null;
  [key: string]: unknown;
}

// Moved from ChatHarnessPicker — harness installation status
export interface HarnessStatus {
  id: string;
  installed: boolean;
  builtIn: boolean;
  version: string | null;
  action: string | null;
  installCommand: string | null;
}

export interface Thread {
  threadId: string;
  entry: ThreadEntry;
}
