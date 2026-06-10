/**
 * @module wiki-frontmatter
 * @role Parse wiki PAGE.md frontmatter for display and future graph tooling
 */

import matter from 'gray-matter';

export interface WikiFrontmatter {
  name: string;
  description: string;
  metadata: Record<string, string[]>;
}

const METADATA_ALIASES: Record<string, string> = {
  incomingEdges: 'incoming-edges',
  outgoingEdges: 'outgoing-edges',
  sourceFiles: 'source-files',
  connectedSkills: 'connected-skills',
  relatedTriggerFiles: 'related-trigger-files',
};

const METADATA_KEYS = [
  'incoming-edges',
  'outgoing-edges',
  'source-files',
  'connected-skills',
  'related-trigger-files',
];

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.replace(/^-\s*/, '').trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeMetadata(raw: unknown): Record<string, string[]> {
  const metadata: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return metadata;

  const source = raw as Record<string, unknown>;
  for (const key of METADATA_KEYS) {
    const alias = Object.entries(METADATA_ALIASES).find(([, canonical]) => canonical === key)?.[0];
    metadata[key] = normalizeList(source[key] ?? (alias ? source[alias] : undefined));
  }

  return metadata;
}

export function parseWikiPage(content: string): { body: string; frontmatter: WikiFrontmatter | null } {
  try {
    const parsed = matter(content || '');
    const name = typeof parsed.data?.name === 'string' ? parsed.data.name.trim() : '';
    const description = typeof parsed.data?.description === 'string' ? parsed.data.description.trim() : '';
    const metadata = normalizeMetadata(parsed.data?.metadata);

    return {
      body: parsed.content,
      frontmatter: name || description || Object.values(metadata).some((items) => items.length > 0)
        ? { name, description, metadata }
        : null,
    };
  } catch {
    return { body: content || '', frontmatter: null };
  }
}
