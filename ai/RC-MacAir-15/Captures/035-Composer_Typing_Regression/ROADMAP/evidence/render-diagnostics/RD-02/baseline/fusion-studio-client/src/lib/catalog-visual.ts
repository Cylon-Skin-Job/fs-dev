/**
 * Catalog Visual — Unified Visual Definitions
 *
 * Single source of truth for how segments look (icon, color, label, borders).
 * Used by ToolCallBlock, InstantSegmentRenderer, tool-grouper, and ws-client.
 *
 * This file contains ONLY visual identity and behavior metadata.
 * Pipeline data (strategies, renderers, transforms, speed) lives in catalog.ts.
 */

import type { SegmentType } from '../types';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/** Visual identity — everything that affects final appearance */
export interface SegmentVisualStyle {
  /** Material icon name (empty string = no icon) */
  icon: string;
  /** CSS color value for the icon */
  iconColor: string;
  /** Icon size in pixels */
  iconSize: number;

  /** CSS color for the label text */
  labelColor: string;
  /** Font style for the label */
  labelStyle: 'normal' | 'italic';

  /** Background color (undefined = transparent) */
  backgroundColor?: string;
  /** Left border styling */
  borderLeft?: {
    width: string;
    color: string;
  };
  /** Full border styling */
  border?: {
    width: string;
    color: string;
    radius?: string;
  };

  /** Typography for the content */
  contentTypography: 'body' | 'italic' | 'monospace' | 'markdown';
  /** CSS color for content text */
  contentColor: string;
}

/** Render mode — determines which content renderer submodule handles this segment */
export type RenderMode = 'markdown' | 'line-stream' | 'diff' | 'code' | 'grouped-summary';

/** Behavior — affects how it's rendered (but not timing) */
export interface SegmentBehavior {
  /** What kind of content format */
  contentFormat: 'plain' | 'markdown' | 'code' | 'diff';
  /** How content is displayed (which renderer submodule) */
  renderMode: RenderMode;
  /** Whether to apply syntax highlighting */
  syntaxHighlight?: boolean;
  /** How to detect language for highlighting */
  languageDetection?: 'auto' | 'from-path' | 'from-meta';

  /** Whether this segment type can be grouped with adjacent same-type segments */
  groupable: boolean;
  /** Which tool arg to show in grouped-summary mode (e.g., 'file_path', 'pattern', 'url') */
  summaryField?: string;
}

/** Complete segment definition */
export interface SegmentDefinition {
  type: SegmentType;
  visual: SegmentVisualStyle;
  behavior: SegmentBehavior;
  /** Build label text from tool args */
  buildLabel: (args?: Record<string, unknown>) => string;
}

// =============================================================================
// DEFAULTS
// =============================================================================

/** Default visual style applied to all segments */
const DEFAULT_VISUAL_STYLE: SegmentVisualStyle = {
  icon: '',
  /* Tool calls belong to the chat chrome color system. Keep icon, label, and
   * non-semantic content on Chat Tools so its slider updates every tool
   * rendering path together. */
  iconColor: 'var(--chat-tools-color, var(--text-dim))',
  iconSize: 16,
  labelColor: 'var(--chat-tools-color, var(--text-dim))',
  labelStyle: 'italic',
  contentTypography: 'body',
  contentColor: 'var(--chat-tools-color, var(--text-dim))',
};

/** Default behavior applied to all segments */
const DEFAULT_BEHAVIOR: SegmentBehavior = {
  contentFormat: 'plain',
  renderMode: 'line-stream',
  syntaxHighlight: false,
  languageDetection: 'auto',
  groupable: false,
};


// =============================================================================
// PER-TYPE OVERRIDES
// =============================================================================

/** Visual style overrides per segment type (deep-merged with defaults) */
const VISUAL_OVERRIDES: Record<SegmentType, Partial<SegmentVisualStyle>> = {
  text: {
    icon: '',
    iconSize: 0,
    contentTypography: 'markdown',
    contentColor: 'var(--text-white)',
  },

  think: {
    icon: 'lightbulb',
    borderLeft: { width: '1px', color: 'var(--chat-tools-color, var(--theme-primary))' },
    contentTypography: 'italic',
  },

  shell: {
    icon: 'terminal',
    contentTypography: 'monospace',
    borderLeft: { width: '1px', color: 'var(--chat-tools-color, var(--theme-primary))' },
  },

  read: {
    icon: 'description',
    contentTypography: 'monospace',
  },

  write: {
    icon: 'edit_note',
    contentTypography: 'monospace',
    borderLeft: { width: '1px', color: 'var(--chat-tools-color, var(--theme-primary))' },
  },

  edit: {
    icon: 'find_replace',
    contentTypography: 'monospace',
    borderLeft: { width: '1px', color: 'var(--chat-tools-color, var(--theme-primary))' },
  },

  glob: {
    icon: 'map_search',
  },

  grep: {
    icon: 'document_search',
  },

  web_search: {
    icon: 'travel_explore',
  },

  fetch: {
    icon: 'link_2',
  },

  subagent: {
    icon: 'smart_toy',
  },

  todo: {
    icon: 'list_alt_check',
  },
};

/** Behavior overrides per segment type (deep-merged with defaults) */
const BEHAVIOR_OVERRIDES: Record<SegmentType, Partial<SegmentBehavior>> = {
  text: {
    contentFormat: 'markdown',
    renderMode: 'markdown',
  },

  think: {
    contentFormat: 'plain',
    renderMode: 'line-stream',
  },

  shell: {
    contentFormat: 'plain',
    renderMode: 'line-stream',
  },

  read: {
    contentFormat: 'code',
    renderMode: 'grouped-summary',
    groupable: true,
    // Read summary formatting handles path/file_path/filePath aliases.
    summaryField: 'path',
    syntaxHighlight: true,
    languageDetection: 'from-path',
  },

  write: {
    contentFormat: 'code',
    renderMode: 'code',
    syntaxHighlight: true,
    languageDetection: 'from-path',
  },

  edit: {
    contentFormat: 'diff',
    renderMode: 'diff',
    syntaxHighlight: true,
    languageDetection: 'from-path',
  },

  glob: {
    contentFormat: 'plain',
    renderMode: 'grouped-summary',
    groupable: true,
    summaryField: 'pattern',
  },

  grep: {
    contentFormat: 'plain',
    renderMode: 'grouped-summary',
    groupable: true,
    summaryField: 'pattern',
  },

  web_search: {
    contentFormat: 'plain',
    renderMode: 'line-stream',
    groupable: false,
    summaryField: 'query',
  },

  fetch: {
    contentFormat: 'plain',
    renderMode: 'line-stream',
    groupable: false,
    summaryField: 'url',
  },

  subagent: {
    contentFormat: 'plain',
    renderMode: 'line-stream',
  },

  todo: {
    contentFormat: 'plain',
    renderMode: 'line-stream',
  },
};

// =============================================================================
// LABEL BUILDERS
// =============================================================================

/** Label builder functions per segment type — return raw type names */
const LABEL_BUILDERS: Record<SegmentType, (args?: Record<string, unknown>) => string> = {
  text: () => '',
  think: () => 'Thinking',
  shell: () => 'Shell',
  read: () => 'Read',
  write: () => 'Write',
  edit: () => 'Edit',
  glob: () => 'Glob',
  grep: () => 'Grep',
  web_search: () => 'Web Search',
  fetch: () => 'Fetch',
  subagent: () => 'Subagent',
  todo: () => 'Update ToDo List',
};

// =============================================================================
// BUILDER FUNCTIONS
// =============================================================================

/**
 * Deep merge two objects (shallow merge is sufficient for our structures)
 */
function merge<T>(base: T, override: Partial<T>): T {
  return { ...base, ...override };
}

/**
 * Build a complete segment definition by merging defaults with type-specific overrides
 */
function buildSegmentDefinition(type: SegmentType): SegmentDefinition {
  return {
    type,
    visual: merge(DEFAULT_VISUAL_STYLE, VISUAL_OVERRIDES[type]),
    behavior: merge(DEFAULT_BEHAVIOR, BEHAVIOR_OVERRIDES[type]),
    buildLabel: LABEL_BUILDERS[type],
  };
}

// =============================================================================
// CATALOG
// =============================================================================

/** Complete catalog of all segment definitions */
export const SEGMENT_CATALOG: Record<SegmentType, SegmentDefinition> = {
  text: buildSegmentDefinition('text'),
  think: buildSegmentDefinition('think'),
  shell: buildSegmentDefinition('shell'),
  read: buildSegmentDefinition('read'),
  write: buildSegmentDefinition('write'),
  edit: buildSegmentDefinition('edit'),
  glob: buildSegmentDefinition('glob'),
  grep: buildSegmentDefinition('grep'),
  web_search: buildSegmentDefinition('web_search'),
  fetch: buildSegmentDefinition('fetch'),
  subagent: buildSegmentDefinition('subagent'),
  todo: buildSegmentDefinition('todo'),
};

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get the visual style for a segment type
 */
export function getSegmentVisual(type: SegmentType): SegmentVisualStyle {
  return SEGMENT_CATALOG[type].visual;
}

/**
 * Build the neutral chrome label for a segment type.
 *
 * Tool error details render inside the expanded body, not in the collapsed
 * icon/label chrome.
 */
export function buildSegmentLabel(
  type: SegmentType,
  args?: Record<string, unknown>,
): string {
  const def = SEGMENT_CATALOG[type];
  return def.buildLabel(args);
}

/**
 * Check if a segment type is groupable
 */
export function isGroupable(type: SegmentType): boolean {
  return SEGMENT_CATALOG[type].behavior.groupable;
}

/**
 * Get the neutral chrome icon name for a segment type.
 */
export function getSegmentIcon(type: SegmentType): string {
  const visual = SEGMENT_CATALOG[type].visual;
  return visual.icon;
}

/**
 * Get the neutral chrome icon color for a segment type.
 */
export function getSegmentIconColor(type: SegmentType): string {
  const visual = SEGMENT_CATALOG[type].visual;
  return visual.iconColor;
}

/**
 * Get the neutral chrome label color for a segment type.
 */
export function getSegmentLabelColor(type: SegmentType): string {
  const visual = SEGMENT_CATALOG[type].visual;
  return visual.labelColor;
}

/**
 * Get the render mode for a segment type
 */
export function getRenderMode(type: SegmentType): RenderMode {
  return SEGMENT_CATALOG[type].behavior.renderMode;
}

/**
 * Get the summary field for a segment type (used in grouped-summary mode)
 */
export function getSummaryField(type: SegmentType): string | undefined {
  return SEGMENT_CATALOG[type].behavior.summaryField;
}
