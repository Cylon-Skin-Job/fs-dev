import type { ChatLinkAttachment, ChatLinkAttachmentKind } from './file-link-types';
import { basename, hasFileExtension, isMarkdownPath, pathSegments, stripExtension } from './file-link-filter';

interface CreateAttachmentInput {
  panel: string;
  relativePath: string;
  absolutePath: string;
  metadata?: Record<string, unknown>;
}

function slugSegment(value: string): string {
  return value
    .replace(/^\d+-/, '')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sourceNameFromPath(relativePath: string, kind: ChatLinkAttachmentKind): string {
  if (kind === 'wiki') {
    const segments = pathSegments(relativePath).filter((segment) => !/^page\.md$/i.test(segment));
    const folder = segments[segments.length - 1];
    if (folder) return folder.replace(/^\d+-/, '').replace(/[_-]+/g, ' ').trim() || folder;
  }

  const name = basename(relativePath);
  return stripExtension(name) || name;
}

function wikiLabel(relativePath: string): string {
  const segments = pathSegments(relativePath)
    .filter((segment) => !/^page\.md$/i.test(segment))
    .map(slugSegment)
    .filter(Boolean);

  return `wiki:${segments.join(':') || 'page'}`;
}

function ticketLabel(relativePath: string): string {
  const id = basename(relativePath).match(/^(\d{5})/)?.[1]
    || basename(relativePath).match(/(\d{5})/)?.[1]
    || stripExtension(basename(relativePath));
  return `ticket:${id}`;
}

function docLabel(relativePath: string): string {
  return `doc:${slugSegment(stripExtension(basename(relativePath))) || 'document'}`;
}

function folderLabel(relativePath: string): string {
  const segments = pathSegments(relativePath).map(slugSegment).filter(Boolean);
  return `folder:${segments.join(':') || 'root'}`;
}

function classifyAttachment(panel: string, relativePath: string): ChatLinkAttachmentKind {
  if (panel === 'wiki-viewer') return 'wiki';
  if (panel === 'issues-viewer' && /^(\d{5})/.test(basename(relativePath))) return 'ticket';
  if (panel === 'issues-viewer' && /\/\d{5}[^/]*\.md$/i.test(relativePath)) return 'ticket';
  if (isMarkdownPath(relativePath)) return 'doc';
  if (!hasFileExtension(relativePath)) return 'folder';
  return 'file';
}

function labelFor(kind: ChatLinkAttachmentKind, relativePath: string): string {
  if (kind === 'wiki') return wikiLabel(relativePath);
  if (kind === 'ticket') return ticketLabel(relativePath);
  if (kind === 'doc') return docLabel(relativePath);
  if (kind === 'folder') return folderLabel(relativePath);
  return `file:${basename(relativePath)}`;
}

export function createSendToChatAttachment({
  panel,
  relativePath,
  absolutePath,
  metadata,
}: CreateAttachmentInput): ChatLinkAttachment {
  const kind = classifyAttachment(panel, relativePath);
  const label = labelFor(kind, relativePath);
  const identity = `${kind}:${absolutePath}:${label}`;

  return {
    id: identity,
    kind,
    label,
    path: absolutePath,
    sourceName: sourceNameFromPath(relativePath, kind),
    panel,
    relativePath,
    metadata,
  };
}
