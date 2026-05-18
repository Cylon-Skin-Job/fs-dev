/**
 * @module front-matter
 * @role Parse and serialize YAML front matter for markdown documents
 *
 * Front matter stores global document settings (font, alignment, margins)
 * under the `fs:` namespace to avoid collisions with Jekyll/Obsidian data.
 */

import matter from 'gray-matter';

export interface DocumentSettings {
  font: {
    family: string;
    size: number;
  };
  alignment: 'left' | 'center' | 'right' | 'justify';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  font: { family: 'serif', size: 16 },
  alignment: 'left',
  margins: { top: 72, bottom: 72, left: 90, right: 90 },
};

export const FONT_CSS_MAP: Record<string, string> = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Courier, monospace',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  courier: '"Courier New", Courier, monospace',
};

export const ALIGNMENT_OPTIONS: Array<DocumentSettings['alignment']> = [
  'left',
  'center',
  'right',
  'justify',
];

/**
 * Extract front-matter settings and body markdown from raw file content.
 * Falls back to defaults if parsing fails or no front matter exists.
 */
export function parseDocumentSettings(content: string): {
  body: string;
  settings: DocumentSettings;
} {
  try {
    const parsed = matter(content);
    const fsData = parsed.data?.fs || {};

    const alignment = fsData.alignment;
    const validAlignment = ALIGNMENT_OPTIONS.includes(alignment)
      ? alignment
      : DEFAULT_SETTINGS.alignment;

    const settings: DocumentSettings = {
      font: {
        family: fsData.font?.family ?? DEFAULT_SETTINGS.font.family,
        size: Number.isFinite(fsData.font?.size)
          ? fsData.font.size
          : DEFAULT_SETTINGS.font.size,
      },
      alignment: validAlignment,
      margins: {
        top: Number.isFinite(fsData.margins?.top)
          ? fsData.margins.top
          : DEFAULT_SETTINGS.margins.top,
        bottom: Number.isFinite(fsData.margins?.bottom)
          ? fsData.margins.bottom
          : DEFAULT_SETTINGS.margins.bottom,
        left: Number.isFinite(fsData.margins?.left)
          ? fsData.margins.left
          : DEFAULT_SETTINGS.margins.left,
        right: Number.isFinite(fsData.margins?.right)
          ? fsData.margins.right
          : DEFAULT_SETTINGS.margins.right,
      },
    };

    return { body: parsed.content, settings };
  } catch {
    // If gray-matter chokes on the content, treat it all as body
    return { body: content, settings: { ...DEFAULT_SETTINGS } };
  }
}

/**
 * Re-assemble a full markdown file from body content and settings.
 */
export function serializeDocumentSettings(
  body: string,
  settings: DocumentSettings
): string {
  return matter.stringify(body.trim(), { fs: settings });
}

/**
 * Resolve a font-family key to a CSS font-family string.
 */
export function getFontCss(fontKey: string): string {
  return FONT_CSS_MAP[fontKey] || FONT_CSS_MAP.serif;
}
