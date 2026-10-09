export type ChatLinkAttachmentKind = 'file' | 'folder' | 'wiki' | 'ticket' | 'doc';

export interface ChatLinkAttachment {
  id: string;
  kind: ChatLinkAttachmentKind;
  label: string;
  path: string;
  sourceName: string;
  panel?: string;
  relativePath?: string;
  metadata?: Record<string, unknown>;
}

export type ChatFileAutocompleteSource = 'open-tab' | 'thread-metadata' | 'turn-text' | 'file-mutation';

export interface ChatFileAutocompleteCandidate {
  id: string;
  label: string;
  path: string;
  basename: string;
  source: ChatFileAutocompleteSource;
  openedAt?: number;
  mentionedAt?: number;
}
